import type Database from 'better-sqlite3';
import type { Repository } from '@server/lib/engine';

/**
 * Tracked expiry record for in-memory scheduling
 */
interface ExpiryRecord {
  id: string;
  board_id: string;
  expires_at: Date;
  type: 'override' | 'note';
}

/**
 * Event-driven scheduler that avoids blind database polling
 *
 * Instead of querying the database every N seconds, this scheduler:
 * 1. Maintains an in-memory min-heap of pending expirations
 * 2. Only queries the database when an expiry time is reached
 * 3. Supports dynamic registration/cancellation of expiries
 */
export class ExpiryScheduler {
  private expiryQueue: ExpiryRecord[] = [];
  private timeoutId: NodeJS.Timeout | null = null;
  private db: Database.Database;
  private boardRepo: Repository<'boards'> | null = null;
  private horseRepo: Repository<'horses'> | null = null;
  private onExpiry: ((boardId: string) => void) | null = null;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Initialize with repositories and callback
   */
  init(
    boardRepo: Repository<'boards'>,
    horseRepo: Repository<'horses'>,
    onExpiry: (boardId: string) => void
  ): void {
    this.boardRepo = boardRepo;
    this.horseRepo = horseRepo;
    this.onExpiry = onExpiry;

    // Load existing expiries from database on startup
    this.loadExistingExpiries();
  }

  /**
   * Load any existing unexpired overrides/notes from database
   * Called once at startup to hydrate the in-memory queue
   */
  private loadExistingExpiries(): void {
    // Load unexpired board overrides
    const overrides = this.db
      .prepare(
        `SELECT id, id as board_id, override_until
         FROM boards
         WHERE time_mode != 'AUTO' AND override_until > datetime('now')`
      )
      .all() as Array<{ id: string; board_id: string; override_until: string }>;

    for (const row of overrides) {
      this.schedule({
        id: row.id,
        board_id: row.board_id,
        expires_at: new Date(row.override_until),
        type: 'override',
      });
    }

    // Load unexpired horse notes
    const notes = this.db
      .prepare(
        `SELECT id, board_id, note_expiry
         FROM horses
         WHERE note IS NOT NULL AND note_expiry > datetime('now')`
      )
      .all() as Array<{ id: string; board_id: string; note_expiry: string }>;

    for (const row of notes) {
      this.schedule({
        id: row.id,
        board_id: row.board_id,
        expires_at: new Date(row.note_expiry),
        type: 'note',
      });
    }

    console.log(
      `[Scheduler] Loaded ${overrides.length} override(s) and ${notes.length} note expir(ies)`
    );
  }

  /**
   * Schedule a new expiry event
   * Called when an override or note is created/updated with an expiry time
   */
  schedule(record: ExpiryRecord): void {
    // Remove any existing entry for this id+type
    this.cancel(record.id, record.type);

    // Add to queue (maintain sorted order by expires_at)
    this.expiryQueue.push(record);
    this.expiryQueue.sort((a, b) => a.expires_at.getTime() - b.expires_at.getTime());

    // Reschedule the next check
    this.scheduleNextCheck();
  }

  /**
   * Cancel a pending expiry (e.g., when manually cleared)
   */
  cancel(id: string, type: 'override' | 'note'): void {
    this.expiryQueue = this.expiryQueue.filter(
      (r) => !(r.id === id && r.type === type)
    );
    this.scheduleNextCheck();
  }

  /**
   * Schedule the next timeout based on the earliest expiry
   */
  private scheduleNextCheck(): void {
    // Clear any existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.expiryQueue.length === 0) {
      return;
    }

    const next = this.expiryQueue[0];
    const delay = Math.max(0, next.expires_at.getTime() - Date.now());

    this.timeoutId = setTimeout(() => this.processExpiries(), delay);
  }

  /**
   * Process all expired items
   */
  private processExpiries(): void {
    const now = Date.now();
    const expired: ExpiryRecord[] = [];

    // Collect all expired records
    while (this.expiryQueue.length > 0 && this.expiryQueue[0].expires_at.getTime() <= now) {
      expired.push(this.expiryQueue.shift()!);
    }

    // Process each expired record
    for (const record of expired) {
      this.handleExpiry(record);
    }

    // Schedule next check
    this.scheduleNextCheck();
  }

  /**
   * Handle a single expiry event
   */
  private handleExpiry(record: ExpiryRecord): void {
    if (!this.boardRepo || !this.horseRepo || !this.onExpiry) {
      console.error('[Scheduler] Not initialized');
      return;
    }

    try {
      if (record.type === 'override') {
        this.boardRepo.update({ time_mode: 'AUTO', override_until: null }, record.id);
        console.log(`[Scheduler] Reset override for board ${record.id}`);
      } else if (record.type === 'note') {
        this.horseRepo.update({ note: null, note_expiry: null }, record.id);
        console.log(`[Scheduler] Cleared note for horse ${record.id}`);
      }

      // Notify via SSE
      this.onExpiry(record.board_id);
    } catch (err) {
      console.error(`[Scheduler] Error processing expiry:`, err);
    }
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { pendingOverrides: number; pendingNotes: number } {
    return {
      pendingOverrides: this.expiryQueue.filter((r) => r.type === 'override').length,
      pendingNotes: this.expiryQueue.filter((r) => r.type === 'note').length,
    };
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.expiryQueue = [];
  }
}
