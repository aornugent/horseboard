-- Users table (Better Auth managed)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions table (Better Auth managed)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Accounts table (Better Auth managed)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at TEXT,
  refresh_token_expires_at TEXT,
  scope TEXT,
  id_token TEXT,
  password TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Verifications table (Better Auth managed)
CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add account_id to boards for ownership
-- Note: SQLite does not support adding a column with a foreign key constraint in a single ALTER TABLE statement in older versions, 
-- but modern SQLite (which better-sqlite3 uses) generally handles it or we might need a PRAGMA foreign_keys=OFF dance if strictly enforcing.
-- However, for simplicity and since we are using migrations, we'll try the direct add.
ALTER TABLE boards ADD COLUMN account_id TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Controller tokens table
CREATE TABLE IF NOT EXISTS controller_tokens (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'edit' CHECK (permission IN ('view', 'edit')),
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_controller_tokens_board ON controller_tokens(board_id);
CREATE INDEX IF NOT EXISTS idx_controller_tokens_hash ON controller_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

-- Trigger for updated_at
CREATE TRIGGER IF NOT EXISTS controller_tokens_updated_at
  AFTER UPDATE ON controller_tokens
  FOR EACH ROW
  BEGIN
    UPDATE controller_tokens SET updated_at = datetime('now') WHERE id = OLD.id;
  END;
