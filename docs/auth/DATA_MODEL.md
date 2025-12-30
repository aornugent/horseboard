# Data Model: Multi-Tenant Authentication

## Better Auth Managed Tables

Better Auth creates and manages these tables. Column names customized to match snake_case convention.

### Table: `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | User/account identifier |
| `name` | TEXT | NOT NULL | Display name |
| `email` | TEXT | UNIQUE NOT NULL | Login email |
| `email_verified` | INTEGER | NOT NULL DEFAULT 0 | Boolean flag |
| `image` | TEXT | nullable | Profile image URL |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `updated_at` | TEXT | NOT NULL | ISO timestamp |

### Table: `sessions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Session identifier |
| `user_id` | TEXT | REFERENCES users(id) | Owner |
| `token` | TEXT | UNIQUE NOT NULL | Session token |
| `expires_at` | TEXT | NOT NULL | Expiration timestamp |
| `ip_address` | TEXT | nullable | Client IP |
| `user_agent` | TEXT | nullable | Client user agent |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `updated_at` | TEXT | NOT NULL | ISO timestamp |

### Table: `accounts`

OAuth/credential storage (Better Auth managed).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Account identifier |
| `user_id` | TEXT | REFERENCES users(id) | Owner |
| `account_id` | TEXT | NOT NULL | Provider's account ID |
| `provider_id` | TEXT | NOT NULL | Provider name |
| `access_token` | TEXT | nullable | OAuth access token |
| `refresh_token` | TEXT | nullable | OAuth refresh token |
| `password` | TEXT | nullable | Hashed password |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `updated_at` | TEXT | NOT NULL | ISO timestamp |

### Table: `verifications`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Verification ID |
| `identifier` | TEXT | NOT NULL | Email or subject |
| `value` | TEXT | NOT NULL | Verification code |
| `expires_at` | TEXT | NOT NULL | Expiration |
| `created_at` | TEXT | NOT NULL | ISO timestamp |

## Application Tables

### Table: `boards` (modified)

Add `account_id` column for ownership:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `account_id` | TEXT | REFERENCES users(id) ON DELETE SET NULL, nullable | Owner account |

**Ownership semantics:**
- `account_id = NULL` → unclaimed board (can be claimed)
- `account_id = user.id` → board owned by that user
- `ON DELETE SET NULL` → if user deleted, board becomes unclaimed

### Table: `controller_tokens`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Token identifier (ct_xxx) |
| `board_id` | TEXT | REFERENCES boards(id) ON DELETE CASCADE, NOT NULL | Target board |
| `token_hash` | TEXT | UNIQUE NOT NULL | SHA-256 hash of token |
| `name` | TEXT | NOT NULL | Human-readable name |
| `type` | TEXT | NOT NULL DEFAULT 'controller' | 'controller' or 'display' |
| `permission` | TEXT | NOT NULL DEFAULT 'edit' | 'view' or 'edit' |
| `last_used_at` | TEXT | nullable | Last access timestamp |
| `expires_at` | TEXT | nullable | Optional expiration |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `updated_at` | TEXT | NOT NULL | ISO timestamp |

**Token format:** `hb_<random-32-chars>`

**Indexes:**
- `idx_controller_tokens_board` on `board_id`
- `idx_controller_tokens_hash` on `token_hash`

## Migration: 002_authentication.sql

```sql
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

-- Migration: 003_add_token_type.sql (Pending)

-- SQLite requires table recreation to modify constraints or add columns with check constraints efficiently/safely in all versions.
-- We adding 'type' and updating the schema.

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
```

## Better Auth Schema Customization

```typescript
export const auth = betterAuth({
  user: {
    modelName: "users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    modelName: "sessions",
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
});
```
