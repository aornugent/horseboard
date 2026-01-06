-- HorseBoard Unified Schema
-- Consolidated from initial migrations for greenfield deployment

-- Boards: stable instances with settings
CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  pair_code TEXT UNIQUE NOT NULL,
  account_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  time_mode TEXT NOT NULL DEFAULT 'AUTO' CHECK (time_mode IN ('AUTO', 'AM', 'PM')),
  override_until TEXT,
  zoom_level INTEGER NOT NULL DEFAULT 2 CHECK (zoom_level BETWEEN 1 AND 3),
  current_page INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feeds with inventory columns
CREATE TABLE IF NOT EXISTS feeds (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'scoop' CHECK (unit IN ('scoop', 'ml', 'sachet', 'biscuit')),
  rank INTEGER NOT NULL DEFAULT 0,
  stock_level REAL NOT NULL DEFAULT 0,
  low_stock_threshold REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(board_id, name)
);

-- Horses with archive support
CREATE TABLE IF NOT EXISTS horses (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT,
  note_expiry TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(board_id, name)
);

-- Diet entries with composite primary key
CREATE TABLE IF NOT EXISTS diet_entries (
  horse_id TEXT NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  am_amount REAL,
  pm_amount REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (horse_id, feed_id)
);

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

-- Controller tokens table
CREATE TABLE IF NOT EXISTS controller_tokens (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'controller' CHECK (type IN ('controller', 'display')),
  permission TEXT NOT NULL DEFAULT 'edit' CHECK (permission IN ('view', 'edit')),
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Invite codes table for temporary staff access codes
CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feeds_board ON feeds(board_id);
CREATE INDEX IF NOT EXISTS idx_horses_board ON horses(board_id);
CREATE INDEX IF NOT EXISTS idx_diet_horse ON diet_entries(horse_id);
CREATE INDEX IF NOT EXISTS idx_diet_feed ON diet_entries(feed_id);
CREATE INDEX IF NOT EXISTS idx_controller_tokens_board ON controller_tokens(board_id);
CREATE INDEX IF NOT EXISTS idx_controller_tokens_hash ON controller_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_board_id ON invite_codes(board_id);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS boards_updated_at
  AFTER UPDATE ON boards
  FOR EACH ROW
  BEGIN
    UPDATE boards SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS feeds_updated_at
  AFTER UPDATE ON feeds
  FOR EACH ROW
  BEGIN
    UPDATE feeds SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS horses_updated_at
  AFTER UPDATE ON horses
  FOR EACH ROW
  BEGIN
    UPDATE horses SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS diet_entries_updated_at
  AFTER UPDATE ON diet_entries
  FOR EACH ROW
  BEGIN
    UPDATE diet_entries SET updated_at = datetime('now')
    WHERE horse_id = OLD.horse_id AND feed_id = OLD.feed_id;
  END;

CREATE TRIGGER IF NOT EXISTS controller_tokens_updated_at
  AFTER UPDATE ON controller_tokens
  FOR EACH ROW
  BEGIN
    UPDATE controller_tokens SET updated_at = datetime('now') WHERE id = OLD.id;
  END;
