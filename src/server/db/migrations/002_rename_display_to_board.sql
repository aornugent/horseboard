-- Migration: Rename "display" domain concept to "board"
-- This reflects the domain terminology: we manage stable boards, not displays

PRAGMA foreign_keys = OFF;

-- Step 1: Create the new boards table (identical structure to displays)
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

-- Step 2: Copy data from displays to boards
INSERT OR IGNORE INTO boards (id, pair_code, timezone, time_mode, override_until, zoom_level, current_page, created_at, updated_at)
SELECT id, pair_code, timezone, time_mode, override_until, zoom_level, current_page, created_at, updated_at
FROM displays;

-- Step 3: Create new feeds table with board_id
CREATE TABLE IF NOT EXISTS feeds_new (
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

-- Copy feeds data
INSERT OR IGNORE INTO feeds_new (id, board_id, name, unit, rank, stock_level, low_stock_threshold, created_at, updated_at)
SELECT id, display_id, name, unit, rank, stock_level, low_stock_threshold, created_at, updated_at
FROM feeds;

-- Step 4: Create new horses table with board_id
CREATE TABLE IF NOT EXISTS horses_new (
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

-- Copy horses data
INSERT OR IGNORE INTO horses_new (id, board_id, name, note, note_expiry, archived, created_at, updated_at)
SELECT id, display_id, name, note, note_expiry, archived, created_at, updated_at
FROM horses;

-- Step 5: Drop old tables (order matters for foreign keys)
DROP TABLE IF EXISTS diet_entries;
DROP TABLE IF EXISTS feeds;
DROP TABLE IF EXISTS horses;
DROP TABLE IF EXISTS displays;

-- Step 6: Rename new tables to final names
ALTER TABLE feeds_new RENAME TO feeds;
ALTER TABLE horses_new RENAME TO horses;

-- Step 7: Recreate diet_entries table (unchanged structure)
CREATE TABLE IF NOT EXISTS diet_entries (
  horse_id TEXT NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  am_amount REAL,
  pm_amount REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (horse_id, feed_id)
);

-- Step 8: Create indexes
CREATE INDEX IF NOT EXISTS idx_feeds_board ON feeds(board_id);
CREATE INDEX IF NOT EXISTS idx_horses_board ON horses(board_id);
CREATE INDEX IF NOT EXISTS idx_diet_horse ON diet_entries(horse_id);
CREATE INDEX IF NOT EXISTS idx_diet_feed ON diet_entries(feed_id);

-- Step 9: Create triggers for updated_at
DROP TRIGGER IF EXISTS boards_updated_at;
CREATE TRIGGER boards_updated_at
  AFTER UPDATE ON boards
  FOR EACH ROW
  BEGIN
    UPDATE boards SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

DROP TRIGGER IF EXISTS feeds_updated_at;
CREATE TRIGGER feeds_updated_at
  AFTER UPDATE ON feeds
  FOR EACH ROW
  BEGIN
    UPDATE feeds SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

DROP TRIGGER IF EXISTS horses_updated_at;
CREATE TRIGGER horses_updated_at
  AFTER UPDATE ON horses
  FOR EACH ROW
  BEGIN
    UPDATE horses SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

DROP TRIGGER IF EXISTS diet_entries_updated_at;
CREATE TRIGGER diet_entries_updated_at
  AFTER UPDATE ON diet_entries
  FOR EACH ROW
  BEGIN
    UPDATE diet_entries SET updated_at = datetime('now')
    WHERE horse_id = OLD.horse_id AND feed_id = OLD.feed_id;
  END;

PRAGMA foreign_keys = ON;
