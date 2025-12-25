/**
 * Horse Repository
 */

import { BaseRepository } from './base.js';

export class HorseRepository extends BaseRepository {
  constructor(db) {
    super(db, {
      table: 'horses',
      idPrefix: 'h',
      fields: ['name', 'note', 'noteExpiry', 'archived'],
      parentField: 'displayId',
      uniqueField: 'name',
      orderBy: 'ORDER BY name',
      booleanFields: ['archived'],
    });

    this.stmts.getByParent = db.prepare(`
      SELECT ${this.sqlColumns} FROM ${this.table} WHERE display_id = ? AND archived = 0 ORDER BY name
    `);
    this.stmts.archive = db.prepare(`UPDATE ${this.table} SET archived = 1 WHERE id = ?`);
    this.stmts.getExpiredNotes = db.prepare(`
      SELECT id FROM ${this.table} WHERE note IS NOT NULL AND note_expiry < datetime('now')
    `);
    this.stmts.clearNote = db.prepare(`UPDATE ${this.table} SET note = NULL, note_expiry = NULL WHERE id = ?`);
    this.stmts.create = db.prepare(`INSERT INTO ${this.table} (id, display_id, name, note, note_expiry) VALUES (?, ?, ?, ?, ?)`);
    this.stmts.update = db.prepare(`UPDATE ${this.table} SET name = COALESCE(?, name), note = ?, note_expiry = ? WHERE id = ?`);
  }

  create(displayId, name, note = null, noteExpiry = null) {
    if (this.exists(displayId, name)) throw new Error(`Horse "${name}" already exists`);
    const id = this.generateId();
    this.stmts.create.run(id, displayId, name, note, noteExpiry);
    return this.getById(id);
  }

  update(id, updates) {
    const result = this.stmts.update.run(updates.name ?? null, updates.note, updates.noteExpiry, id);
    return result.changes > 0 ? this.getById(id) : null;
  }

  archive(id) { return this.stmts.archive.run(id).changes > 0; }

  clearExpiredNotes() {
    const expired = this.stmts.getExpiredNotes.all();
    for (const { id } of expired) this.stmts.clearNote.run(id);
    return expired.map((r) => r.id);
  }
}

export default HorseRepository;
