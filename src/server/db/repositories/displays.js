/**
 * Display Repository
 */

import { generateId, generatePairCode } from '../index.js';

const COLS = 'id, pair_code, timezone, time_mode, override_until, zoom_level, current_page, created_at, updated_at';

export class DisplayRepository {
  constructor(db) {
    this.db = db;
    this.stmts = {
      getById: db.prepare(`SELECT ${COLS} FROM displays WHERE id = ?`),
      getByPairCode: db.prepare(`SELECT ${COLS} FROM displays WHERE pair_code = ?`),
      create: db.prepare(`INSERT INTO displays (id, pair_code, timezone, time_mode, zoom_level, current_page) VALUES (?, ?, ?, 'AUTO', 2, 0)`),
      update: db.prepare(`UPDATE displays SET timezone = COALESCE(?, timezone), time_mode = COALESCE(?, time_mode), override_until = ?, zoom_level = COALESCE(?, zoom_level), current_page = COALESCE(?, current_page) WHERE id = ?`),
      updateTimeMode: db.prepare(`UPDATE displays SET time_mode = ?, override_until = ? WHERE id = ?`),
      delete: db.prepare('DELETE FROM displays WHERE id = ?'),
      getExpiredOverrides: db.prepare(`SELECT id FROM displays WHERE time_mode != 'AUTO' AND override_until < datetime('now')`),
      clearOverride: db.prepare(`UPDATE displays SET time_mode = 'AUTO', override_until = NULL WHERE id = ?`),
    };
  }

  toApiFormat(row) {
    if (!row) return null;
    return {
      id: row.id, pairCode: row.pair_code, timezone: row.timezone,
      timeMode: row.time_mode, overrideUntil: row.override_until,
      zoomLevel: row.zoom_level, currentPage: row.current_page,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  getById(id) { return this.toApiFormat(this.stmts.getById.get(id)); }
  getByPairCode(code) { return this.toApiFormat(this.stmts.getByPairCode.get(code)); }

  create(timezone = 'Australia/Sydney') {
    const id = generateId('d'), pairCode = generatePairCode(this.db);
    this.stmts.create.run(id, pairCode, timezone);
    return { id, pairCode };
  }

  update(id, updates) {
    return this.stmts.update.run(updates.timezone ?? null, updates.timeMode ?? null, updates.overrideUntil,
      updates.zoomLevel ?? null, updates.currentPage ?? null, id).changes > 0;
  }

  setTimeMode(id, timeMode, overrideUntil = null) {
    return this.stmts.updateTimeMode.run(timeMode, overrideUntil, id).changes > 0;
  }

  delete(id) { return this.stmts.delete.run(id).changes > 0; }

  clearExpiredOverrides() {
    const expired = this.stmts.getExpiredOverrides.all();
    for (const { id } of expired) this.stmts.clearOverride.run(id);
    return expired.map((r) => r.id);
  }
}

export default DisplayRepository;
