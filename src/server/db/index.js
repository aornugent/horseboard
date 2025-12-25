import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Initialize database with V3 schema
 */
export function initializeDatabase(dbPath = './data/horseboard.db') {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  const migrationPath = join(__dirname, 'migrations', '001_v3_schema.sql');
  const migration = readFileSync(migrationPath, 'utf-8');
  db.exec(migration);

  return db;
}

/**
 * Atomic transaction wrapper
 * Ensures all operations succeed or all are rolled back
 */
export function transaction(db, fn) {
  const runTransaction = db.transaction(fn);
  return runTransaction();
}

/**
 * Generate a unique ID with prefix
 */
export function generateId(prefix = 'd') {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${hex}`;
}

/**
 * Generate a unique 6-digit pairing code
 */
export function generatePairCode(db) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const existing = db.prepare('SELECT 1 FROM displays WHERE pair_code = ?').get(code);
  if (existing) {
    return generatePairCode(db);
  }
  return code;
}

export default { initializeDatabase, transaction, generateId, generatePairCode };
