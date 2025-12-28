-- Schema Definition: Normalized relational tables
-- Foreign key relationships between boards, horses, feeds, and diet entries

-- Boards: stable instances with settings
CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  pair_code TEXT UNIQUE NOT NULL,
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
  unit TEXT NOT NULL CHECK (unit IN ('scoop', 'ml', 'sachet', 'biscuit')),
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feeds_board ON feeds(board_id);
CREATE INDEX IF NOT EXISTS idx_horses_board ON horses(board_id);
CREATE INDEX IF NOT EXISTS idx_diet_horse ON diet_entries(horse_id);
CREATE INDEX IF NOT EXISTS idx_diet_feed ON diet_entries(feed_id);

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
