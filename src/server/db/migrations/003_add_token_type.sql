-- Migration: 003_add_token_type.sql

CREATE TABLE controller_tokens_new (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'controller' CHECK (type IN ('controller', 'display')), -- NEW
  permission TEXT NOT NULL DEFAULT 'edit' CHECK (permission IN ('view', 'edit')),
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO controller_tokens_new (id, board_id, token_hash, name, permission, last_used_at, expires_at, created_at, updated_at)
SELECT id, board_id, token_hash, name, permission, last_used_at, expires_at, created_at, updated_at FROM controller_tokens;

DROP TABLE controller_tokens;
ALTER TABLE controller_tokens_new RENAME TO controller_tokens;

CREATE INDEX idx_controller_tokens_board ON controller_tokens(board_id);
CREATE INDEX idx_controller_tokens_hash ON controller_tokens(token_hash);

CREATE TRIGGER controller_tokens_updated_at
  AFTER UPDATE ON controller_tokens
  FOR EACH ROW
  BEGIN
    UPDATE controller_tokens SET updated_at = datetime('now') WHERE id = OLD.id;
  END;
