import Database from 'better-sqlite3';
import { runMigrations } from '../src/server/db/migrate';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = './data/horseboard.db';
const MIGRATIONS_DIR = join(__dirname, '../src/server/db/migrations');

console.log(`Using database: ${DB_PATH}`);
console.log(`Migrations dir: ${MIGRATIONS_DIR}`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

runMigrations(db, MIGRATIONS_DIR);

console.log('Migrations complete.');
db.close();
