import { generateId } from '../index.js';

/**
 * Horse repository for CRUD operations
 */
export class HorseRepository {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      getById: this.db.prepare(`
        SELECT id, display_id, name, note, note_expiry, archived, created_at, updated_at
        FROM horses WHERE id = ?
      `),
      getByDisplayId: this.db.prepare(`
        SELECT id, display_id, name, note, note_expiry, archived, created_at, updated_at
        FROM horses WHERE display_id = ? AND archived = 0
        ORDER BY name
      `),
      getByName: this.db.prepare(`
        SELECT id FROM horses WHERE display_id = ? AND name = ?
      `),
      create: this.db.prepare(`
        INSERT INTO horses (id, display_id, name, note, note_expiry)
        VALUES (?, ?, ?, ?, ?)
      `),
      update: this.db.prepare(`
        UPDATE horses
        SET name = COALESCE(?, name),
            note = ?,
            note_expiry = ?
        WHERE id = ?
      `),
      archive: this.db.prepare(`
        UPDATE horses SET archived = 1 WHERE id = ?
      `),
      delete: this.db.prepare('DELETE FROM horses WHERE id = ?'),
      getExpiredNotes: this.db.prepare(`
        SELECT id FROM horses
        WHERE note IS NOT NULL AND note_expiry < datetime('now')
      `),
      clearNote: this.db.prepare(`
        UPDATE horses SET note = NULL, note_expiry = NULL WHERE id = ?
      `),
    };
  }

  /**
   * Transform database row to API response format
   */
  toApiFormat(row) {
    if (!row) return null;
    return {
      id: row.id,
      displayId: row.display_id,
      name: row.name,
      note: row.note,
      noteExpiry: row.note_expiry,
      archived: Boolean(row.archived),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  getById(id) {
    return this.toApiFormat(this.stmts.getById.get(id));
  }

  getByDisplayId(displayId) {
    return this.stmts.getByDisplayId.all(displayId).map((row) => this.toApiFormat(row));
  }

  exists(displayId, name) {
    return !!this.stmts.getByName.get(displayId, name);
  }

  create(displayId, name, note = null, noteExpiry = null) {
    if (this.exists(displayId, name)) {
      throw new Error(`Horse "${name}" already exists`);
    }
    const id = generateId('h');
    this.stmts.create.run(id, displayId, name, note, noteExpiry);
    return this.getById(id);
  }

  update(id, updates) {
    const result = this.stmts.update.run(
      updates.name ?? null,
      updates.note, // Allow explicit null
      updates.noteExpiry, // Allow explicit null
      id
    );
    return result.changes > 0 ? this.getById(id) : null;
  }

  archive(id) {
    const result = this.stmts.archive.run(id);
    return result.changes > 0;
  }

  delete(id) {
    const result = this.stmts.delete.run(id);
    return result.changes > 0;
  }

  /**
   * Check and clear expired notes
   */
  clearExpiredNotes() {
    const expired = this.stmts.getExpiredNotes.all();
    for (const { id } of expired) {
      this.stmts.clearNote.run(id);
    }
    return expired.map((r) => r.id);
  }
}

export default HorseRepository;
