import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';

/**
 * Database wrapper for SQLite operations
 */
export class DisplayDatabase {
  constructor(dbPath = './data/horseboard.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * Initialize database schema
   */
  initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS displays (
        id TEXT PRIMARY KEY,
        pair_code TEXT UNIQUE,
        table_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    return this;
  }

  /**
   * Generate a unique display ID
   */
  generateId() {
    return 'd_' + randomBytes(8).toString('hex');
  }

  /**
   * Generate a unique 6-digit pairing code
   */
  generatePairCode() {
    // Generate random 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Check if already exists
    const existing = this.db.prepare('SELECT 1 FROM displays WHERE pair_code = ?').get(code);
    if (existing) {
      return this.generatePairCode(); // Retry if collision
    }
    return code;
  }

  /**
   * Create a new display
   */
  createDisplay() {
    const id = this.generateId();
    const pairCode = this.generatePairCode();
    const tableData = JSON.stringify({
      headers: [],
      rows: [],
      displaySettings: { startRow: 0, rowCount: 10 }
    });

    this.db.prepare(`
      INSERT INTO displays (id, pair_code, table_data)
      VALUES (?, ?, ?)
    `).run(id, pairCode, tableData);

    return { id, pairCode };
  }

  /**
   * Get display by ID
   */
  getDisplayById(id) {
    const row = this.db.prepare(`
      SELECT id, pair_code, table_data, created_at, updated_at
      FROM displays WHERE id = ?
    `).get(id);

    if (!row) return null;

    return {
      id: row.id,
      pairCode: row.pair_code,
      tableData: JSON.parse(row.table_data || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get display by pairing code
   */
  getDisplayByPairCode(code) {
    const row = this.db.prepare(`
      SELECT id, pair_code, table_data, created_at, updated_at
      FROM displays WHERE pair_code = ?
    `).get(code);

    if (!row) return null;

    return {
      id: row.id,
      pairCode: row.pair_code,
      tableData: JSON.parse(row.table_data || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Update display table data
   */
  updateDisplayData(id, tableData) {
    const result = this.db.prepare(`
      UPDATE displays
      SET table_data = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(tableData), id);

    return result.changes > 0;
  }

  /**
   * Delete a display
   */
  deleteDisplay(id) {
    const result = this.db.prepare('DELETE FROM displays WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Get all table names (for testing)
   */
  getTables() {
    const rows = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all();
    return rows.map(r => r.name);
  }

  /**
   * Clear all displays (for testing)
   */
  clear() {
    this.db.exec('DELETE FROM displays');
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

// Default export for convenience
export default DisplayDatabase;
