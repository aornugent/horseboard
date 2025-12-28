import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

interface Migration {
  version: string;
  name: string;
  path: string;
}

interface AppliedMigration {
  version: string;
  applied_at: string;
}

function ensureSchemaMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function getAppliedMigrations(db: Database.Database): Set<string> {
  const rows = db.prepare('SELECT version FROM schema_migrations').all() as AppliedMigration[];
  return new Set(rows.map(r => r.version));
}

function recordMigration(db: Database.Database, version: string): void {
  db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
}

function discoverMigrations(migrationsDir: string): Migration[] {
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(file => {
    const match = file.match(/^(\d{3})_(.+)\.sql$/);
    if (!match) {
      throw new Error(`Invalid migration filename: ${file}. Expected format: 001_name.sql`);
    }
    return {
      version: match[1],
      name: match[2],
      path: join(migrationsDir, file),
    };
  });
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name=?
  `).get(tableName) as { name: string } | undefined;
  return !!row;
}

export function runMigrations(db: Database.Database, migrationsDir: string): void {
  ensureSchemaMigrationsTable(db);

  const isExistingDatabase = tableExists(db, 'boards');
  const applied = getAppliedMigrations(db);
  const migrations = discoverMigrations(migrationsDir);

  if (isExistingDatabase && applied.size === 0) {
    console.log('[Migrations] Existing database detected, recording applied migrations...');
    for (const migration of migrations) {
      recordMigration(db, migration.version);
      console.log(`[Migrations] Recorded ${migration.version}_${migration.name} as applied`);
    }
    return;
  }

  const pending = migrations.filter(m => !applied.has(m.version));

  if (pending.length === 0) {
    console.log('[Migrations] Database is up to date');
    return;
  }

  console.log(`[Migrations] ${pending.length} pending migration(s)`);

  for (const migration of pending) {
    console.log(`[Migrations] Applying ${migration.version}_${migration.name}...`);

    const sql = readFileSync(migration.path, 'utf-8');

    try {
      db.exec(sql);
      recordMigration(db, migration.version);
      console.log(`[Migrations] Applied ${migration.version}_${migration.name}`);
    } catch (error) {
      console.error(`[Migrations] Failed to apply ${migration.version}_${migration.name}`);
      throw error;
    }
  }

  console.log('[Migrations] All migrations applied successfully');
}
