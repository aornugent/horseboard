import type Database from 'better-sqlite3';
import type { BoardsRepository, HorsesRepository } from '@server/lib/engine';

interface ExpiryRecord {
  id: string;
  board_id: string;
  expires_at: Date;
  type: 'override' | 'note';
}

export class ExpiryScheduler {
  private expiryQueue: ExpiryRecord[] = [];
  private timeoutId: NodeJS.Timeout | null = null;
  private db: Database.Database;
  private boardRepo: BoardsRepository | null = null;
  private horseRepo: HorsesRepository | null = null;
  private onExpiry: ((boardId: string) => void) | null = null;

  constructor(db: Database.Database) {
    this.db = db;
  }

  init(
    boardRepo: BoardsRepository,
    horseRepo: HorsesRepository,
    onExpiry: (boardId: string) => void
  ): void {
    this.boardRepo = boardRepo;
    this.horseRepo = horseRepo;
    this.onExpiry = onExpiry;

    this.loadExistingExpiries();
  }

  private loadExistingExpiries(): void {
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

  schedule(record: ExpiryRecord): void {
    this.cancel(record.id, record.type);

    this.expiryQueue.push(record);
    this.expiryQueue.sort((a, b) => a.expires_at.getTime() - b.expires_at.getTime());

    this.scheduleNextCheck();
  }

  cancel(id: string, type: 'override' | 'note'): void {
    this.expiryQueue = this.expiryQueue.filter(
      (r) => !(r.id === id && r.type === type)
    );
    this.scheduleNextCheck();
  }

  private scheduleNextCheck(): void {
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

  private processExpiries(): void {
    const now = Date.now();
    const expired: ExpiryRecord[] = [];

    while (this.expiryQueue.length > 0 && this.expiryQueue[0].expires_at.getTime() <= now) {
      expired.push(this.expiryQueue.shift()!);
    }

    for (const record of expired) {
      this.handleExpiry(record);
    }

    this.scheduleNextCheck();
  }

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

      this.onExpiry(record.board_id);
    } catch (err) {
      console.error(`[Scheduler] Error processing expiry:`, err);
    }
  }

  getStats(): { pendingOverrides: number; pendingNotes: number } {
    return {
      pendingOverrides: this.expiryQueue.filter((r) => r.type === 'override').length,
      pendingNotes: this.expiryQueue.filter((r) => r.type === 'note').length,
    };
  }

  shutdown(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.expiryQueue = [];
  }
}
