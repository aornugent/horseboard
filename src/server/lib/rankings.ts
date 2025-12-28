import type Database from 'better-sqlite3';

/**
 * Pending ranking calculation request
 */
interface PendingRanking {
  boardId: string;
  scheduledAt: number;
  timeoutId: NodeJS.Timeout;
}

/**
 * Async Feed Ranking Manager
 *
 * Implements eventual consistency for feed rankings with debouncing:
 * - Multiple rapid diet changes coalesce into a single recalculation
 * - Recalculation runs after a configurable delay (default 500ms)
 * - Non-blocking: HTTP response returns immediately, ranking updates asynchronously
 * - Batch updates: All feed ranks updated in a single transaction
 *
 * Trade-off: Rankings may be stale for up to `debounceMs` after a diet change.
 * This is acceptable because:
 * 1. Rankings are for display only (don't affect functionality)
 * 2. User is typically still editing when ranks would update
 * 3. SSE broadcast happens after recalculation completes
 */
export class FeedRankingManager {
  private db: Database.Database;
  private pending: Map<string, PendingRanking> = new Map();
  private debounceMs: number;
  private onComplete: ((boardId: string) => void) | null = null;

  // Prepared statements (lazy init to avoid startup blocking)
  private rankingStmt: Database.Statement | null = null;
  private updateStmt: Database.Statement | null = null;

  constructor(db: Database.Database, debounceMs = 500) {
    this.db = db;
    this.debounceMs = debounceMs;
  }

  /**
   * Set callback for when ranking calculation completes
   */
  setOnComplete(callback: (boardId: string) => void): void {
    this.onComplete = callback;
  }

  /**
   * Initialize prepared statements lazily
   */
  private ensureStatements(): void {
    if (!this.rankingStmt) {
      this.rankingStmt = this.db.prepare(`
        SELECT f.id, COUNT(DISTINCT d.horse_id) as usage_count
        FROM feeds f
        LEFT JOIN diet_entries d ON f.id = d.feed_id
          AND (d.am_amount > 0 OR d.pm_amount > 0)
        WHERE f.board_id = ?
        GROUP BY f.id
        ORDER BY usage_count DESC
      `);
    }

    if (!this.updateStmt) {
      this.updateStmt = this.db.prepare('UPDATE feeds SET rank = ? WHERE id = ?');
    }
  }

  /**
   * Schedule a ranking recalculation (debounced)
   *
   * Calling this multiple times for the same boardId within `debounceMs`
   * will only trigger one actual recalculation.
   */
  scheduleRecalculation(boardId: string): void {
    // Cancel any pending calculation for this board
    const existing = this.pending.get(boardId);
    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    // Schedule new calculation
    const timeoutId = setTimeout(() => {
      this.executeRecalculation(boardId);
    }, this.debounceMs);

    this.pending.set(boardId, {
      boardId,
      scheduledAt: Date.now(),
      timeoutId,
    });
  }

  /**
   * Execute the ranking recalculation
   * Uses a transaction for atomic batch updates
   */
  private executeRecalculation(boardId: string): void {
    this.pending.delete(boardId);

    try {
      this.ensureStatements();

      const rankings = this.rankingStmt!.all(boardId) as Array<{
        id: string;
        usage_count: number;
      }>;

      if (rankings.length === 0) {
        return;
      }

      // Use a transaction for batch updates (much faster than individual updates)
      const updateAll = this.db.transaction(() => {
        for (let i = 0; i < rankings.length; i++) {
          this.updateStmt!.run(rankings.length - i, rankings[i].id);
        }
      });

      updateAll();

      // Notify completion (triggers SSE broadcast)
      if (this.onComplete) {
        this.onComplete(boardId);
      }
    } catch (err) {
      console.error(`[Rankings] Error recalculating for board ${boardId}:`, err);
    }
  }

  /**
   * Force immediate recalculation (bypasses debounce)
   * Used for explicit API calls like POST /api/boards/:id/feeds/recalculate-rankings
   */
  recalculateNow(boardId: string): number {
    // Cancel any pending debounced calculation
    const existing = this.pending.get(boardId);
    if (existing) {
      clearTimeout(existing.timeoutId);
      this.pending.delete(boardId);
    }

    this.ensureStatements();

    const rankings = this.rankingStmt!.all(boardId) as Array<{
      id: string;
      usage_count: number;
    }>;

    if (rankings.length === 0) {
      return 0;
    }

    // Use transaction for batch updates
    const updateAll = this.db.transaction(() => {
      for (let i = 0; i < rankings.length; i++) {
        this.updateStmt!.run(rankings.length - i, rankings[i].id);
      }
    });

    updateAll();

    return rankings.length;
  }

  /**
   * Check if there's a pending calculation for a board
   */
  hasPending(boardId: string): boolean {
    return this.pending.has(boardId);
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { pendingCount: number; boardIds: string[] } {
    return {
      pendingCount: this.pending.size,
      boardIds: Array.from(this.pending.keys()),
    };
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeoutId);
    }
    this.pending.clear();
  }
}
