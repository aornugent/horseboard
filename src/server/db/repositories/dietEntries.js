/**
 * Diet Entry repository for CRUD operations
 */
export class DietEntryRepository {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      getByHorseAndFeed: this.db.prepare(`
        SELECT horse_id, feed_id, am_amount, pm_amount, created_at, updated_at
        FROM diet_entries WHERE horse_id = ? AND feed_id = ?
      `),
      getByHorseId: this.db.prepare(`
        SELECT horse_id, feed_id, am_amount, pm_amount, created_at, updated_at
        FROM diet_entries WHERE horse_id = ?
      `),
      getByFeedId: this.db.prepare(`
        SELECT horse_id, feed_id, am_amount, pm_amount, created_at, updated_at
        FROM diet_entries WHERE feed_id = ?
      `),
      getByDisplayId: this.db.prepare(`
        SELECT d.horse_id, d.feed_id, d.am_amount, d.pm_amount, d.created_at, d.updated_at
        FROM diet_entries d
        JOIN horses h ON d.horse_id = h.id
        WHERE h.display_id = ?
      `),
      upsert: this.db.prepare(`
        INSERT INTO diet_entries (horse_id, feed_id, am_amount, pm_amount)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(horse_id, feed_id) DO UPDATE SET
          am_amount = excluded.am_amount,
          pm_amount = excluded.pm_amount
      `),
      updateAmAmount: this.db.prepare(`
        INSERT INTO diet_entries (horse_id, feed_id, am_amount, pm_amount)
        VALUES (?, ?, ?, NULL)
        ON CONFLICT(horse_id, feed_id) DO UPDATE SET am_amount = excluded.am_amount
      `),
      updatePmAmount: this.db.prepare(`
        INSERT INTO diet_entries (horse_id, feed_id, am_amount, pm_amount)
        VALUES (?, ?, NULL, ?)
        ON CONFLICT(horse_id, feed_id) DO UPDATE SET pm_amount = excluded.pm_amount
      `),
      delete: this.db.prepare('DELETE FROM diet_entries WHERE horse_id = ? AND feed_id = ?'),
      deleteByHorseId: this.db.prepare('DELETE FROM diet_entries WHERE horse_id = ?'),
      deleteByFeedId: this.db.prepare('DELETE FROM diet_entries WHERE feed_id = ?'),
      // Clean up entries where both amounts are null or zero
      cleanup: this.db.prepare(`
        DELETE FROM diet_entries
        WHERE (am_amount IS NULL OR am_amount = 0)
          AND (pm_amount IS NULL OR pm_amount = 0)
      `),
    };
  }

  /**
   * Transform database row to API response format
   */
  toApiFormat(row) {
    if (!row) return null;
    return {
      horseId: row.horse_id,
      feedId: row.feed_id,
      amAmount: row.am_amount,
      pmAmount: row.pm_amount,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  get(horseId, feedId) {
    return this.toApiFormat(this.stmts.getByHorseAndFeed.get(horseId, feedId));
  }

  getByHorseId(horseId) {
    return this.stmts.getByHorseId.all(horseId).map((row) => this.toApiFormat(row));
  }

  getByFeedId(feedId) {
    return this.stmts.getByFeedId.all(feedId).map((row) => this.toApiFormat(row));
  }

  getByDisplayId(displayId) {
    return this.stmts.getByDisplayId.all(displayId).map((row) => this.toApiFormat(row));
  }

  /**
   * Upsert a diet entry (create or update)
   */
  upsert(horseId, feedId, amAmount, pmAmount) {
    this.stmts.upsert.run(horseId, feedId, amAmount, pmAmount);
    return this.get(horseId, feedId);
  }

  /**
   * Update only AM amount
   */
  setAmAmount(horseId, feedId, amount) {
    this.stmts.updateAmAmount.run(horseId, feedId, amount);
    return this.get(horseId, feedId);
  }

  /**
   * Update only PM amount
   */
  setPmAmount(horseId, feedId, amount) {
    this.stmts.updatePmAmount.run(horseId, feedId, amount);
    return this.get(horseId, feedId);
  }

  /**
   * Bulk upsert diet entries (atomic)
   */
  bulkUpsert(entries) {
    const upsertMany = this.db.transaction((entries) => {
      for (const entry of entries) {
        this.stmts.upsert.run(entry.horseId, entry.feedId, entry.amAmount, entry.pmAmount);
      }
    });
    upsertMany(entries);
    return entries.length;
  }

  delete(horseId, feedId) {
    const result = this.stmts.delete.run(horseId, feedId);
    return result.changes > 0;
  }

  /**
   * Clean up empty diet entries
   */
  cleanup() {
    const result = this.stmts.cleanup.run();
    return result.changes;
  }
}

export default DietEntryRepository;
