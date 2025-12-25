/**
 * Diet Entry Repository (Composite Key)
 */

const COLS = 'horse_id, feed_id, am_amount, pm_amount, created_at, updated_at';
const D_COLS = COLS.split(', ').map(c => 'd.' + c).join(', ');

export class DietEntryRepository {
  constructor(db) {
    this.db = db;
    this.stmts = {
      get: db.prepare(`SELECT ${COLS} FROM diet_entries WHERE horse_id = ? AND feed_id = ?`),
      getByHorse: db.prepare(`SELECT ${COLS} FROM diet_entries WHERE horse_id = ?`),
      getByFeed: db.prepare(`SELECT ${COLS} FROM diet_entries WHERE feed_id = ?`),
      getByDisplay: db.prepare(`SELECT ${D_COLS} FROM diet_entries d JOIN horses h ON d.horse_id = h.id WHERE h.display_id = ?`),
      upsert: db.prepare(`INSERT INTO diet_entries (horse_id, feed_id, am_amount, pm_amount) VALUES (?, ?, ?, ?) ON CONFLICT(horse_id, feed_id) DO UPDATE SET am_amount = excluded.am_amount, pm_amount = excluded.pm_amount`),
      updateAm: db.prepare(`INSERT INTO diet_entries (horse_id, feed_id, am_amount, pm_amount) VALUES (?, ?, ?, NULL) ON CONFLICT(horse_id, feed_id) DO UPDATE SET am_amount = excluded.am_amount`),
      updatePm: db.prepare(`INSERT INTO diet_entries (horse_id, feed_id, am_amount, pm_amount) VALUES (?, ?, NULL, ?) ON CONFLICT(horse_id, feed_id) DO UPDATE SET pm_amount = excluded.pm_amount`),
      delete: db.prepare('DELETE FROM diet_entries WHERE horse_id = ? AND feed_id = ?'),
      cleanup: db.prepare(`DELETE FROM diet_entries WHERE (am_amount IS NULL OR am_amount = 0) AND (pm_amount IS NULL OR pm_amount = 0)`),
    };
  }

  toApiFormat(row) {
    if (!row) return null;
    return { horseId: row.horse_id, feedId: row.feed_id, amAmount: row.am_amount, pmAmount: row.pm_amount, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  get(horseId, feedId) { return this.toApiFormat(this.stmts.get.get(horseId, feedId)); }
  getByHorseId(horseId) { return this.stmts.getByHorse.all(horseId).map((r) => this.toApiFormat(r)); }
  getByFeedId(feedId) { return this.stmts.getByFeed.all(feedId).map((r) => this.toApiFormat(r)); }
  getByDisplayId(displayId) { return this.stmts.getByDisplay.all(displayId).map((r) => this.toApiFormat(r)); }

  upsert(horseId, feedId, amAmount, pmAmount) {
    this.stmts.upsert.run(horseId, feedId, amAmount, pmAmount);
    return this.get(horseId, feedId);
  }

  setAmAmount(horseId, feedId, amount) { this.stmts.updateAm.run(horseId, feedId, amount); return this.get(horseId, feedId); }
  setPmAmount(horseId, feedId, amount) { this.stmts.updatePm.run(horseId, feedId, amount); return this.get(horseId, feedId); }

  bulkUpsert(entries) {
    const run = this.db.transaction((e) => { for (const x of e) this.stmts.upsert.run(x.horseId, x.feedId, x.amAmount, x.pmAmount); });
    run(entries);
    return entries.length;
  }

  delete(horseId, feedId) { return this.stmts.delete.run(horseId, feedId).changes > 0; }
  cleanup() { return this.stmts.cleanup.run().changes; }
}

export default DietEntryRepository;
