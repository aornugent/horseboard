# Multi-Tenant Authentication Implementation Plan

This document specifies the complete implementation plan for evolving HorseBoard from a single-user prototype into a multi-tenant SaaS foundation with accounts, authentication, and access control.

---

## 1. Research Summary

### 1.1 Current Codebase Architecture

**Server Architecture:**
- Express.js server with TypeScript (`server/index.ts`)
- SQLite database with better-sqlite3 (`DB_PATH` configurable)
- Migration system in `src/server/db/migrations/`
- Repository pattern for data access (`src/server/lib/engine.ts`)
- Explicit route files per resource (`src/server/routes/`)
- SSE for real-time updates (`SSEManager` class)
- Zod schemas for validation (`src/shared/resources.ts`)

**Client Architecture:**
- Preact with Signals for state management
- Centralized API service (`src/client/services/api.ts`)
- SSE client for real-time sync (`src/client/services/sse.ts`)
- Store factories in `src/client/lib/engine.ts`
- Board ID stored in localStorage (`horseboard_board_id`)

**Current Data Model:**
- `boards` - stable instances with settings (pair_code, timezone, time_mode, etc.)
- `horses` - belong to boards (name, note, archived)
- `feeds` - belong to boards (name, unit, rank, stock_level)
- `diet_entries` - junction table (horse_id, feed_id, am_amount, pm_amount)

**Current Pairing Flow:**
1. TV opens `/board` → creates new board if none stored → displays pair_code
2. Phone opens `/controller` → enters pair_code
3. `GET /api/bootstrap/pair/:code` returns board + all data
4. Phone stores `board_id` in localStorage
5. Both connect via SSE for real-time sync

**Key Observations:**
- No ownership concept - anyone with pair_code has full access
- Board creation happens implicitly (TV creates, phone pairs)
- No authentication layer exists
- All routes are unprotected

### 1.2 Better Auth Integration Requirements

**Package:** `better-auth` (v1.4.9+)

**Key Integration Points:**

1. **ESM Requirement:** Better Auth requires ES modules. The codebase already uses ESM (`"type": "module"` in package.json, TypeScript with ESM output).

2. **Express Mounting:**
   ```typescript
   import { toNodeHandler } from "better-auth/node";
   app.all("/api/auth/*", toNodeHandler(auth));
   // IMPORTANT: Mount before express.json() middleware
   ```

3. **Database Tables Created by Better Auth:**
   - `user` - id, name, email, emailVerified, image, createdAt, updatedAt
   - `session` - id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt
   - `account` - id, userId, accountId, providerId, accessToken, refreshToken, password, etc.
   - `verification` - id, identifier, value, expiresAt, createdAt, updatedAt

4. **Schema Customization:** Better Auth allows renaming tables/columns:
   ```typescript
   export const auth = betterAuth({
     user: {
       modelName: "users",  // Rename table
       fields: {
         name: "full_name",  // Rename columns
       },
     },
   });
   ```

5. **Session Access in Routes:**
   ```typescript
   import { fromNodeHeaders } from "better-auth/node";

   app.get("/api/protected", async (req, res) => {
     const session = await auth.api.getSession({
       headers: fromNodeHeaders(req.headers),
     });
     if (!session) {
       return res.status(401).json({ error: "Unauthorized" });
     }
     // session.user and session.session available
   });
   ```

6. **Client Integration:**
   ```typescript
   import { createAuthClient } from "better-auth/client";

   export const authClient = createAuthClient({
     baseURL: window.location.origin,
   });

   // Sign up
   await authClient.signUp.email({ email, password, name });

   // Sign in
   await authClient.signIn.email({ email, password });

   // Get session (reactive)
   const session = authClient.useSession();

   // Sign out
   await authClient.signOut();
   ```

### 1.3 Tensions and Design Decisions

**Tension 1: Better Auth's user model vs. our "account" concept**

Better Auth uses `user` for the authenticated entity. Our domain uses "account" to mean the billable entity that owns boards.

**Resolution:** Use Better Auth's `user` table as-is. In our domain language, a Better Auth "user" IS an "account owner." We don't need a separate accounts table - the user table serves this purpose. Add `account_id` to boards referencing `user.id`.

**Tension 2: snake_case convention vs. Better Auth's camelCase**

Better Auth uses camelCase for its tables (emailVerified, createdAt). Our codebase uses snake_case everywhere.

**Resolution:** Use Better Auth's schema customization to rename columns:
```typescript
user: {
  fields: {
    emailVerified: "email_verified",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
},
session: {
  fields: {
    userId: "user_id",
    expiresAt: "expires_at",
    ipAddress: "ip_address",
    userAgent: "user_agent",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}
```

**Tension 3: Controller tokens vs. Better Auth sessions**

Controller tokens are application-level access grants (for staff, devices) that we design ourselves. They are NOT Better Auth users/sessions.

**Resolution:** Controller tokens are a separate table we create and manage. They coexist with Better Auth sessions. A request can be authenticated by EITHER:
- A Better Auth session cookie (account owner)
- A controller token in Authorization header (staff/device)
- Just a board_id for read-only access (anyone with pair code)

**Tension 4: Board-first user flow vs. typical auth flows**

Typical auth: User signs up → creates resources.
Our flow: Resource exists first (unclaimed board) → user claims it by signing up.

**Resolution:** The claim flow is:
1. User pairs with unclaimed board via pair_code
2. UI prompts "Claim this board by creating an account"
3. User signs up via Better Auth
4. On successful signup, we set `boards.account_id = user.id`

---

## 2. Data Model Design

### 2.1 Better Auth Managed Tables

Better Auth creates and manages these tables. We customize column names to match our snake_case convention.

**Table: `users`** (renamed from `user`)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | User/account identifier |
| `name` | TEXT | NOT NULL | Display name |
| `email` | TEXT | UNIQUE NOT NULL | Login email |
| `email_verified` | INTEGER | NOT NULL DEFAULT 0 | Boolean flag |
| `image` | TEXT | nullable | Profile image URL |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `updated_at` | TEXT | NOT NULL | ISO timestamp |

**Table: `sessions`** (renamed from `session`)
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

**Table: `accounts`** (Better Auth's account table for OAuth)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Account identifier |
| `user_id` | TEXT | REFERENCES users(id) | Owner |
| `account_id` | TEXT | NOT NULL | Provider's account ID |
| `provider_id` | TEXT | NOT NULL | Provider name (credential, github, etc.) |
| `access_token` | TEXT | nullable | OAuth access token |
| `refresh_token` | TEXT | nullable | OAuth refresh token |
| `access_token_expires_at` | TEXT | nullable | Token expiration |
| `refresh_token_expires_at` | TEXT | nullable | Refresh expiration |
| `scope` | TEXT | nullable | OAuth scopes |
| `id_token` | TEXT | nullable | OIDC ID token |
| `password` | TEXT | nullable | Hashed password for credential auth |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `updated_at` | TEXT | NOT NULL | ISO timestamp |

**Table: `verifications`** (renamed from `verification`)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Verification ID |
| `identifier` | TEXT | NOT NULL | Email or subject |
| `value` | TEXT | NOT NULL | Verification code |
| `expires_at` | TEXT | NOT NULL | Expiration |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `updated_at` | TEXT | NOT NULL | ISO timestamp |

### 2.2 Modified Application Tables

**Table: `boards`** (modified)

Add `account_id` column for ownership:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Board identifier |
| `account_id` | TEXT | REFERENCES users(id) ON DELETE SET NULL, nullable | Owner account |
| `pair_code` | TEXT | UNIQUE NOT NULL | Six-digit pairing code |
| `timezone` | TEXT | NOT NULL DEFAULT 'UTC' | IANA timezone |
| `time_mode` | TEXT | NOT NULL DEFAULT 'AUTO' | AUTO/AM/PM |
| `override_until` | TEXT | nullable | Override expiration |
| `zoom_level` | INTEGER | NOT NULL DEFAULT 2 | Display zoom |
| `current_page` | INTEGER | NOT NULL DEFAULT 0 | Pagination |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `updated_at` | TEXT | NOT NULL | ISO timestamp |

**Ownership semantics:**
- `account_id = NULL` → unclaimed board (can be claimed)
- `account_id = user.id` → board owned by that user
- `ON DELETE SET NULL` → if user deleted, board becomes unclaimed

### 2.3 New Application Tables

**Table: `controller_tokens`**

Controller tokens grant access to specific boards with specific permissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Token identifier (ct_xxx) |
| `board_id` | TEXT | REFERENCES boards(id) ON DELETE CASCADE, NOT NULL | Target board |
| `token_hash` | TEXT | UNIQUE NOT NULL | SHA-256 hash of token |
| `name` | TEXT | NOT NULL | Human-readable name ("Barn Manager Phone") |
| `permission` | TEXT | NOT NULL DEFAULT 'edit' | Permission level |
| `last_used_at` | TEXT | nullable | Last access timestamp |
| `expires_at` | TEXT | nullable | Optional expiration |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `updated_at` | TEXT | NOT NULL | ISO timestamp |

**Token format:** `hb_<random-32-chars>` (e.g., `hb_a1b2c3d4e5f6...`)

**Permission values:** `'view'` or `'edit'` (simple, extensible later)

**Index:** `CREATE INDEX idx_controller_tokens_board ON controller_tokens(board_id);`

### 2.4 Migration Strategy

**Migration file:** `src/server/db/migrations/002_authentication.sql`

```sql
-- Better Auth tables (with snake_case columns)
-- These will be created by Better Auth CLI, but we document expected structure

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

-- Accounts table (Better Auth managed, for OAuth/credentials)
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

-- Controller tokens table (application managed)
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

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS controller_tokens_updated_at
  AFTER UPDATE ON controller_tokens
  FOR EACH ROW
  BEGIN
    UPDATE controller_tokens SET updated_at = datetime('now') WHERE id = OLD.id;
  END;
```

**Handling Existing Boards:**
- Existing boards get `account_id = NULL` (unclaimed)
- They continue to work with pair code access
- First user to claim gets ownership

---

## 3. Permission Model Design

### 3.1 Permission Levels

| Level | Name | Description |
|-------|------|-------------|
| 0 | `none` | No access (invalid token, wrong board) |
| 1 | `view` | Read-only access to board data |
| 2 | `edit` | Full CRUD on horses, feeds, diet entries |
| 3 | `admin` | Edit + manage tokens + board settings + transfer ownership |

**Simplified implementation:** Start with just `view` and `edit` for controller tokens. Account owners implicitly have `admin`.

### 3.2 Access Methods and Their Permissions

| Access Method | How Identified | Permission Level | Use Case |
|--------------|----------------|------------------|----------|
| Account owner session | Better Auth session cookie, `session.user.id === board.account_id` | `admin` | Owner managing their board |
| Controller token (edit) | `Authorization: Bearer hb_xxx`, token.permission = 'edit' | `edit` | Staff phone, barn device |
| Controller token (view) | `Authorization: Bearer hb_xxx`, token.permission = 'view' | `view` | Display-only device |
| Pair code only | `board_id` in localStorage, no auth | `view` | Anyone viewing the TV board |

### 3.3 Permission Matrix

| Action | `view` | `edit` | `admin` |
|--------|--------|--------|---------|
| GET board data (horses, feeds, diet) | ✓ | ✓ | ✓ |
| SSE connection | ✓ | ✓ | ✓ |
| Create/update/delete horses | ✗ | ✓ | ✓ |
| Create/update/delete feeds | ✗ | ✓ | ✓ |
| Upsert/delete diet entries | ✗ | ✓ | ✓ |
| Update board settings (timezone, zoom) | ✗ | ✓ | ✓ |
| Set time mode | ✗ | ✓ | ✓ |
| Create controller tokens | ✗ | ✗ | ✓ |
| Revoke controller tokens | ✗ | ✗ | ✓ |
| List controller tokens | ✗ | ✗ | ✓ |
| Claim unclaimed board | ✗ | ✗ | (signup flow) |
| Transfer board ownership | ✗ | ✗ | ✓ |
| Delete board | ✗ | ✗ | ✓ |

### 3.4 Permission Representation

**In Database:**
- Controller tokens: `permission` column stores `'view'` or `'edit'`
- Account ownership: Derived from `boards.account_id === session.user.id`

**In Code:**

```typescript
// src/server/lib/auth.ts

export type Permission = 'none' | 'view' | 'edit' | 'admin';

export interface AuthContext {
  permission: Permission;
  user_id: string | null;      // Set if authenticated via Better Auth
  token_id: string | null;     // Set if authenticated via controller token
  board_id: string | null;     // The board being accessed
}

export function canView(ctx: AuthContext): boolean {
  return ctx.permission !== 'none';
}

export function canEdit(ctx: AuthContext): boolean {
  return ctx.permission === 'edit' || ctx.permission === 'admin';
}

export function canAdmin(ctx: AuthContext): boolean {
  return ctx.permission === 'admin';
}
```

### 3.5 Permission Checking on Server

**Middleware approach:**

```typescript
// src/server/routes/middleware.ts

import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth-instance";

export async function resolveAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.authorization;

  // Check for controller token first
  if (authHeader?.startsWith('Bearer hb_')) {
    const token = authHeader.slice(7);
    const tokenHash = hashToken(token);
    const controllerToken = repos.controllerTokens.getByHash(tokenHash);

    if (controllerToken && !isExpired(controllerToken)) {
      // Update last_used_at
      repos.controllerTokens.updateLastUsed(controllerToken.id);

      return {
        permission: controllerToken.permission as Permission,
        user_id: null,
        token_id: controllerToken.id,
        board_id: controllerToken.board_id,
      };
    }

    return { permission: 'none', user_id: null, token_id: null, board_id: null };
  }

  // Check for Better Auth session
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (session?.user) {
    // User is authenticated - permission depends on board ownership
    return {
      permission: 'authenticated', // Resolved to admin/view based on board
      user_id: session.user.id,
      token_id: null,
      board_id: null, // Set by route handler based on request
    };
  }

  // No auth - view only (if they have a valid board_id)
  return {
    permission: 'view',
    user_id: null,
    token_id: null,
    board_id: null,
  };
}

export function requirePermission(level: 'view' | 'edit' | 'admin') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authCtx = await resolveAuth(req);
    req.authContext = authCtx;

    // Determine effective permission for the specific board
    const boardId = req.params.boardId || req.params.board_id || req.body?.board_id;

    if (boardId && authCtx.user_id) {
      const board = repos.boards.getById(boardId);
      if (board?.account_id === authCtx.user_id) {
        authCtx.permission = 'admin';
      }
    }

    const hasPermission =
      (level === 'view' && canView(authCtx)) ||
      (level === 'edit' && canEdit(authCtx)) ||
      (level === 'admin' && canAdmin(authCtx));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
}
```

### 3.6 Permission Reflection in Client UI

The client needs to know what the current user can do:

```typescript
// src/client/stores/auth.ts

import { signal, computed } from '@preact/signals';

export type ClientPermission = 'none' | 'view' | 'edit' | 'admin';

export const currentUser = signal<User | null>(null);
export const isAuthenticated = computed(() => currentUser.value !== null);
export const boardPermission = signal<ClientPermission>('view');

export const canEdit = computed(() =>
  boardPermission.value === 'edit' || boardPermission.value === 'admin'
);

export const canAdmin = computed(() =>
  boardPermission.value === 'admin'
);
```

**UI Adaptations:**
- Hide edit buttons when `!canEdit.value`
- Hide settings/tokens tabs when `!canAdmin.value`
- Show "Claim this board" prompt when board is unclaimed and user is authenticated

---

## 4. Authentication Flow Specification

### 4.1 New User Signup (via Board Claim)

**Trigger:** User pairs with unclaimed board, UI shows "Claim this board"

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │   Express   │     │ Better Auth │     │   SQLite    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ POST /api/auth/sign-up/email          │                   │
       │ {email, password, name}               │                   │
       │──────────────────────────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │ INSERT users      │
       │                   │                   │ INSERT accounts   │
       │                   │                   │ INSERT sessions   │
       │                   │                   │──────────────────>│
       │                   │                   │                   │
       │                   │  Set-Cookie: session_token            │
       │<──────────────────────────────────────│                   │
       │                   │                   │                   │
       │ POST /api/boards/:id/claim            │                   │
       │ Cookie: session_token                 │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ getSession()      │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │ session.user.id   │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │                   │ UPDATE boards SET account_id = ?      │
       │                   │──────────────────────────────────────>│
       │                   │                   │                   │
       │ 200 OK {board}    │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
```

**Steps:**
1. User enters email, password, name in signup form
2. Client calls `authClient.signUp.email({ email, password, name })`
3. Better Auth creates user, account (credential), and session
4. Better Auth sets session cookie in response
5. Client calls `POST /api/boards/:board_id/claim`
6. Server verifies session, checks board is unclaimed
7. Server sets `boards.account_id = session.user.id`
8. Client updates local state to show admin permissions

### 4.2 Returning User Login

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │ Better Auth │     │   SQLite    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ POST /api/auth/sign-in/email          │
       │ {email, password}                     │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ SELECT user       │
       │                   │ VERIFY password   │
       │                   │ INSERT session    │
       │                   │──────────────────>│
       │                   │                   │
       │ Set-Cookie        │                   │
       │ {user, session}   │                   │
       │<──────────────────│                   │
       │                   │                   │
       │ GET /api/user/boards                  │
       │ Cookie: session                       │
       │──────────────────────────────────────>│
       │                   │                   │
       │ [{board1}, {board2}]                  │
       │<──────────────────────────────────────│
       │                   │                   │
```

**Steps:**
1. User enters email and password
2. Client calls `authClient.signIn.email({ email, password })`
3. Better Auth verifies credentials, creates session
4. Client receives session cookie
5. Client fetches user's boards via `GET /api/user/boards`
6. Client shows board selection or redirects to their board

### 4.3 Logout

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │ Better Auth │     │   SQLite    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ POST /api/auth/sign-out               │
       │ Cookie: session                       │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ DELETE session    │
       │                   │──────────────────>│
       │                   │                   │
       │ Clear-Cookie      │                   │
       │ 200 OK            │                   │
       │<──────────────────│                   │
       │                   │                   │
       │ Clear local state │                   │
       │ Redirect to /     │                   │
       │                   │                   │
```

**Steps:**
1. User clicks logout
2. Client calls `authClient.signOut()`
3. Better Auth deletes session from database
4. Better Auth clears session cookie
5. Client clears local auth state
6. Client redirects to landing or pairing view

### 4.4 Session Validation on Protected Routes

```typescript
// In route handler
router.patch('/:id', requirePermission('edit'), async (req, res) => {
  // req.authContext contains resolved permissions
  const { permission, user_id } = req.authContext;

  // Proceed with update...
});
```

**Flow:**
1. Request arrives with session cookie
2. `requirePermission` middleware calls `resolveAuth()`
3. `resolveAuth` calls `auth.api.getSession()` with request headers
4. If session valid, determine permission based on board ownership
5. If sufficient permission, proceed; else return 403

### 4.5 Session Handling on Client

```typescript
// src/client/services/auth.ts

import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
});

// Reactive session state
export function useAuthSession() {
  const session = authClient.useSession();

  return {
    user: session.data?.user ?? null,
    isLoading: session.isPending,
    error: session.error,
    isAuthenticated: !!session.data?.user,
  };
}

// Initialize on app load
export async function initAuth() {
  const session = await authClient.getSession();
  if (session.data?.user) {
    currentUser.value = session.data.user;
  }
}
```

---

## 5. Authorization Flow Specification

### 5.1 How the Server Identifies the Requester

```typescript
// src/server/lib/auth.ts

export async function resolveAuth(req: Request, repos: Repos): Promise<AuthContext> {
  // 1. Check Authorization header for controller token
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer hb_')) {
    const token = authHeader.slice(7); // Remove "Bearer "
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const controllerToken = repos.controllerTokens.getByHash(tokenHash);

    if (!controllerToken) {
      return { permission: 'none', user_id: null, token_id: null, board_id: null };
    }

    if (controllerToken.expires_at && new Date(controllerToken.expires_at) < new Date()) {
      return { permission: 'none', user_id: null, token_id: null, board_id: null };
    }

    // Update last_used_at asynchronously
    repos.controllerTokens.updateLastUsed(controllerToken.id);

    return {
      permission: controllerToken.permission as Permission,
      user_id: null,
      token_id: controllerToken.id,
      board_id: controllerToken.board_id,
    };
  }

  // 2. Check for Better Auth session cookie
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (session?.user) {
    return {
      permission: 'authenticated', // Will be resolved to admin/view based on board
      user_id: session.user.id,
      token_id: null,
      board_id: null,
    };
  }

  // 3. No authentication - view-only access
  return {
    permission: 'view',
    user_id: null,
    token_id: null,
    board_id: null,
  };
}
```

### 5.2 How the Server Determines What They Can Do

```typescript
// Resolve permission for a specific board
export function resolvePermissionForBoard(
  authCtx: AuthContext,
  board: Board | null
): Permission {
  if (!board) {
    return 'none';
  }

  // Controller token - permission is fixed to the board
  if (authCtx.token_id) {
    if (authCtx.board_id === board.id) {
      return authCtx.permission;
    }
    return 'none'; // Token for different board
  }

  // Authenticated user
  if (authCtx.user_id) {
    if (board.account_id === authCtx.user_id) {
      return 'admin'; // Owner
    }
    return 'view'; // Authenticated but not owner
  }

  // Unauthenticated - view only
  return 'view';
}
```

### 5.3 All Access Methods to a Board

| Method | Authentication | Identification | Permission |
|--------|---------------|----------------|------------|
| Owner with session | Better Auth cookie | `session.user.id === board.account_id` | `admin` |
| Staff with edit token | `Authorization: Bearer hb_xxx` | Token hash lookup, `permission = 'edit'` | `edit` |
| Device with view token | `Authorization: Bearer hb_xxx` | Token hash lookup, `permission = 'view'` | `view` |
| Paired phone (no auth) | None (board_id in localStorage) | board_id from request | `view` |
| TV board display | None (board_id in URL/localStorage) | board_id from request | `view` |

### 5.4 Interaction Between Access Methods

**Precedence:**
1. Controller token (if present and valid) → Use token's permission
2. Better Auth session (if present) → Check ownership for admin, else view
3. No auth → View only

**Token + Session:**
If a request has both a controller token AND a session cookie, the controller token takes precedence. This allows an owner to test tokens without logging out.

**SSE Connections:**
SSE connections are view-only by default. The board_id in the URL determines which board to subscribe to. No write operations occur over SSE.

---

## 6. API Changes

### 6.1 New Endpoints

**Better Auth Endpoints (auto-mounted):**
| Method | Path | Description |
|--------|------|-------------|
| ALL | `/api/auth/*` | Better Auth handles signup, signin, signout, session |

**User Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/user/boards` | List boards owned by authenticated user |
| GET | `/api/user/profile` | Get current user profile |

**Board Claim Endpoint:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/boards/:id/claim` | Claim unclaimed board (requires auth) |

**Controller Token Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/boards/:id/tokens` | List tokens for board (admin only) |
| POST | `/api/boards/:id/tokens` | Create new token (admin only) |
| DELETE | `/api/tokens/:id` | Revoke token (admin only) |

### 6.2 Endpoint Specifications

**GET /api/user/boards**

Requires: Authenticated session

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "b_xxx",
      "pair_code": "123456",
      "timezone": "Australia/Sydney",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**POST /api/boards/:id/claim**

Requires: Authenticated session

Request: (empty body)

Response (success):
```json
{
  "success": true,
  "data": {
    "id": "b_xxx",
    "account_id": "user_xxx",
    "pair_code": "123456",
    ...
  }
}
```

Response (already claimed):
```json
{
  "success": false,
  "error": "Board already has an owner"
}
```
Status: 409 Conflict

**POST /api/boards/:id/tokens**

Requires: Admin permission on board

Request:
```json
{
  "name": "Barn Manager Phone",
  "permission": "edit",
  "expires_at": "2025-12-31T23:59:59.000Z"  // optional
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "ct_xxx",
    "name": "Barn Manager Phone",
    "permission": "edit",
    "token": "hb_a1b2c3d4e5f6..."  // Only returned on creation!
  }
}
```

**GET /api/boards/:id/tokens**

Requires: Admin permission on board

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "ct_xxx",
      "name": "Barn Manager Phone",
      "permission": "edit",
      "last_used_at": "2024-01-20T08:30:00.000Z",
      "expires_at": null,
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

Note: Token value is never returned after creation.

**DELETE /api/tokens/:id**

Requires: Admin permission on token's board

Response:
```json
{
  "success": true
}
```

### 6.3 Modified Endpoints

**All write endpoints** now require permission check:

| Endpoint | Required Permission |
|----------|-------------------|
| POST /api/boards/:boardId/horses | edit |
| PATCH /api/horses/:id | edit |
| DELETE /api/horses/:id | edit |
| POST /api/boards/:boardId/feeds | edit |
| PATCH /api/feeds/:id | edit |
| DELETE /api/feeds/:id | edit |
| PUT /api/diet | edit |
| DELETE /api/diet/:horse_id/:feed_id | edit |
| PATCH /api/boards/:id | edit |
| PUT /api/boards/:id/time-mode | edit |
| DELETE /api/boards/:id | admin |

**Read endpoints** require at least view permission:

| Endpoint | Required Permission |
|----------|-------------------|
| GET /api/boards/:id | view |
| GET /api/boards/:boardId/horses | view |
| GET /api/horses/:id | view |
| GET /api/boards/:boardId/feeds | view |
| GET /api/feeds/:id | view |
| GET /api/diet | view |
| GET /api/bootstrap/:boardId | view |
| GET /api/boards/:boardId/events (SSE) | view |

**Bootstrap endpoint change:**

`GET /api/bootstrap/:boardId` now also returns ownership info:

```json
{
  "success": true,
  "data": {
    "board": { ... },
    "horses": [ ... ],
    "feeds": [ ... ],
    "diet_entries": [ ... ],
    "ownership": {
      "is_claimed": true,
      "is_owner": false,  // Based on session
      "permission": "view"
    }
  }
}
```

### 6.4 Error Responses for Unauthorized Access

**401 Unauthorized** (no valid auth when required):
```json
{
  "success": false,
  "error": "Authentication required"
}
```

**403 Forbidden** (authenticated but insufficient permission):
```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```

**409 Conflict** (claim already-claimed board):
```json
{
  "success": false,
  "error": "Board already has an owner"
}
```

---

## 7. Client Changes

### 7.1 New Views/Screens

**Login View** (`src/client/views/Auth/Login.tsx`)
- Email input
- Password input
- "Sign In" button
- Link to signup
- Error display

**Signup View** (`src/client/views/Auth/Signup.tsx`)
- Name input
- Email input
- Password input
- Password confirmation
- "Create Account" button
- Link to login
- Error display

**Claim Board Prompt** (component in Controller)
- Shown when board is unclaimed and user is authenticated
- "Claim This Board" button
- Explanation text

**Token Management View** (`src/client/views/Controller/TokensTab.tsx`)
- List of active tokens (name, permission, last used, created)
- "Create Token" button
- Token creation modal (name, permission, optional expiry)
- Copy token button (shown only on creation)
- Revoke token button per row
- Confirmation dialog for revocation

**Account Settings** (addition to SettingsTab)
- Current user info
- "Sign Out" button
- Link to token management (if admin)

### 7.2 Modifications to Existing Views

**App.tsx**
- Add auth state initialization
- Add auth-aware routing logic
- Handle claim flow

**PairingView**
- After successful pair, check if board is unclaimed
- If unclaimed and user authenticated → show claim option
- If unclaimed and user not authenticated → show signup/login options

**Controller tabs**
- Check `canEdit` before showing edit buttons
- Check `canAdmin` before showing TokensTab, board deletion
- Disable form elements when read-only

**SettingsTab**
- Show account section if authenticated
- Show "Sign Out" button
- Show "Manage Tokens" link if admin

### 7.3 Auth State Management

**New file:** `src/client/stores/auth.ts`

```typescript
import { signal, computed } from '@preact/signals';
import { createAuthClient } from 'better-auth/client';

export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export type Permission = 'none' | 'view' | 'edit' | 'admin';

// Auth client instance
export const authClient = createAuthClient({
  baseURL: window.location.origin,
});

// Reactive state
export const currentUser = signal<User | null>(null);
export const boardPermission = signal<Permission>('view');
export const authLoading = signal(true);

// Computed values
export const isAuthenticated = computed(() => currentUser.value !== null);
export const canEdit = computed(() =>
  boardPermission.value === 'edit' || boardPermission.value === 'admin'
);
export const canAdmin = computed(() => boardPermission.value === 'admin');

// Actions
export async function initializeAuth(): Promise<void> {
  authLoading.value = true;
  try {
    const session = await authClient.getSession();
    if (session.data?.user) {
      currentUser.value = session.data.user as User;
    }
  } finally {
    authLoading.value = false;
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const result = await authClient.signIn.email({ email, password });
  if (result.error) {
    throw new Error(result.error.message);
  }
  currentUser.value = result.data.user as User;
}

export async function signUp(name: string, email: string, password: string): Promise<void> {
  const result = await authClient.signUp.email({ name, email, password });
  if (result.error) {
    throw new Error(result.error.message);
  }
  currentUser.value = result.data.user as User;
}

export async function signOut(): Promise<void> {
  await authClient.signOut();
  currentUser.value = null;
  boardPermission.value = 'view';
}

export function updatePermission(permission: Permission): void {
  boardPermission.value = permission;
}
```

### 7.4 API Service Updates

**Modify:** `src/client/services/api.ts`

```typescript
// Add token storage for controller tokens
let controllerToken: string | null = null;

export function setControllerToken(token: string | null): void {
  controllerToken = token;
  if (token) {
    localStorage.setItem('horseboard_controller_token', token);
  } else {
    localStorage.removeItem('horseboard_controller_token');
  }
}

export function loadControllerToken(): void {
  controllerToken = localStorage.getItem('horseboard_controller_token');
}

// Modify request function to include auth
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add controller token if present
  if (controllerToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${controllerToken}`;
  }

  // Cookies are sent automatically for Better Auth sessions
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Important for cookies
  });

  // ... rest of error handling
}

// New API methods
export async function claimBoard(boardId: string): Promise<Board> {
  const result = await request<ApiResponse<Board>>(`/api/boards/${boardId}/claim`, {
    method: 'POST',
  });
  if (!result.data) {
    throw new ApiError('Failed to claim board', 500);
  }
  return result.data;
}

export async function getUserBoards(): Promise<Board[]> {
  const result = await request<ApiResponse<Board[]>>('/api/user/boards');
  return result.data ?? [];
}

export async function createControllerToken(
  boardId: string,
  name: string,
  permission: 'view' | 'edit',
  expiresAt?: string
): Promise<{ id: string; name: string; token: string }> {
  const result = await request<ApiResponse<{ id: string; name: string; token: string }>>(
    `/api/boards/${boardId}/tokens`,
    {
      method: 'POST',
      body: JSON.stringify({ name, permission, expires_at: expiresAt }),
    }
  );
  if (!result.data) {
    throw new ApiError('Failed to create token', 500);
  }
  return result.data;
}

export async function listControllerTokens(boardId: string): Promise<ControllerToken[]> {
  const result = await request<ApiResponse<ControllerToken[]>>(`/api/boards/${boardId}/tokens`);
  return result.data ?? [];
}

export async function revokeControllerToken(tokenId: string): Promise<void> {
  await request(`/api/tokens/${tokenId}`, { method: 'DELETE' });
}
```

### 7.5 How Client Knows Current Permissions

**On bootstrap response:**

```typescript
// In initializeApp()
const data = await bootstrap(boardId);

// Bootstrap now includes ownership info
if (data.ownership) {
  updatePermission(data.ownership.permission);
}
```

**On auth state change:**

```typescript
// After login/signup, re-bootstrap to get updated permissions
await initializeApp(boardId);
```

---

## 8. Implementation Phases

### Phase 1: Database Schema & Better Auth Setup

**Deliverable:** Better Auth integrated, tables created, basic auth working

**Tasks:**
1. Install dependencies: `npm install better-auth`
2. Create `src/server/lib/auth-instance.ts` with Better Auth configuration
3. Create migration `002_authentication.sql`
4. Run Better Auth CLI to generate/verify schema
5. Mount Better Auth handler in `server/index.ts`
6. Create basic auth store on client
7. Test signup/signin/signout flows manually

**Tests:**
- Unit: Auth instance configuration exports correctly
- Integration: `POST /api/auth/sign-up/email` creates user
- Integration: `POST /api/auth/sign-in/email` returns session
- Integration: Session cookie is set and validated

**After this phase:**
- Users can sign up and sign in
- Sessions are created and stored
- No routes are protected yet

### Phase 2: Permission Resolution & Middleware

**Deliverable:** Auth middleware resolves permissions correctly

**Tasks:**
1. Create `src/server/lib/auth.ts` with `resolveAuth()` and permission types
2. Create `requirePermission()` middleware
3. Add `account_id` column to boards table
4. Create controller tokens table
5. Create controller tokens repository in engine.ts
6. Implement token hashing and validation
7. Update `RouteContext` type to include auth

**Tests:**
- Unit: `resolveAuth` correctly identifies session, token, or unauthenticated
- Unit: `resolvePermissionForBoard` returns correct permission levels
- Unit: Token hashing is consistent
- Integration: Expired tokens are rejected
- Integration: Valid tokens grant correct permission

**After this phase:**
- Permission resolution works for all access methods
- Tokens can be created and validated
- Middleware can protect routes (not yet applied)

### Phase 3: Protect Existing Routes

**Deliverable:** All existing endpoints have appropriate permission checks

**Tasks:**
1. Apply `requirePermission('view')` to all GET routes
2. Apply `requirePermission('edit')` to all POST/PATCH/PUT/DELETE routes
3. Apply `requirePermission('admin')` to DELETE /api/boards/:id
4. Update bootstrap endpoint to include ownership info
5. Add permission context to SSE handler
6. Test all routes with various auth states

**Tests:**
- Integration: Unauthenticated user can read but not write
- Integration: Controller token with 'edit' can write
- Integration: Controller token with 'view' cannot write
- Integration: Owner gets 'admin' permission
- E2E: Protected routes return 403 when unauthorized

**After this phase:**
- All API routes enforce permissions
- Existing functionality works with permissions
- Breaking change: writes require at least 'edit' permission

### Phase 4: Board Claiming Flow

**Deliverable:** Users can claim unclaimed boards

**Tasks:**
1. Add `POST /api/boards/:id/claim` endpoint
2. Add `GET /api/user/boards` endpoint
3. Create ClaimBoardPrompt component on client
4. Update PairingView to show claim option
5. Update bootstrap response with ownership info
6. Update client permission store on claim

**Tests:**
- Integration: Claim endpoint sets account_id
- Integration: Cannot claim already-claimed board
- Integration: User boards endpoint returns owned boards
- E2E: Pair → signup → claim flow works

**After this phase:**
- New users can claim boards on signup
- Returning users see their owned boards
- Unclaimed boards can still be accessed view-only

### Phase 5: Client Auth UI

**Deliverable:** Complete auth UI on client

**Tasks:**
1. Create LoginView component
2. Create SignupView component
3. Integrate auth client from better-auth/client
4. Add auth state to App.tsx routing
5. Add SignOut button to SettingsTab
6. Show/hide edit controls based on permission
7. Add account info display in settings

**Tests:**
- E2E: Signup flow creates account and logs in
- E2E: Login flow authenticates existing user
- E2E: Logout clears session
- E2E: Edit buttons hidden for view-only users

**After this phase:**
- Full auth UI experience
- Users can signup, login, logout
- UI reflects permission level

### Phase 6: Controller Token Management

**Deliverable:** Owners can create and manage controller tokens

**Tasks:**
1. Add TokensTab to Controller
2. Create token creation modal
3. Implement token list display
4. Implement token revocation
5. Show token value only on creation (copy to clipboard)
6. Add token input flow for staff connecting with token

**Tests:**
- Integration: Create token returns token value
- Integration: List tokens does not include token value
- Integration: Revoke token deletes from database
- E2E: Owner can create, list, revoke tokens
- E2E: Staff can connect with token and has correct permissions

**After this phase:**
- Complete token management UI
- Staff can use tokens to access boards
- Multi-device access pattern works

### Phase 7: Polish & Edge Cases

**Deliverable:** Production-ready auth system

**Tasks:**
1. Handle session expiry gracefully
2. Handle token revocation during active use
3. Add loading states for auth operations
4. Add error messages for auth failures
5. Token expiry checking and cleanup
6. Rate limiting on auth endpoints (via Better Auth config)
7. Audit all error responses

**Tests:**
- E2E: Expired session redirects to login
- E2E: Revoked token shows error, prompts re-auth
- E2E: Network failures show retry option

**After this phase:**
- Production-ready auth system
- All edge cases handled gracefully
- Ready for deployment

---

## 9. Edge Cases and Error Handling

### 9.1 Claiming Already-Claimed Board

**Scenario:** User pairs with board, goes to claim, but another user claims it first.

**Handling:**
1. `POST /api/boards/:id/claim` checks `account_id IS NULL` before update
2. If already claimed, return 409 Conflict with message
3. Client shows: "This board already has an owner. You can view but not edit."
4. Client updates local permission to 'view'

### 9.2 Token Revocation During Active Use

**Scenario:** Owner revokes a token while staff member is actively using it.

**Handling:**
1. Token validated on every request (no caching)
2. Next API call with revoked token returns 401
3. Client detects 401, clears stored token
4. Client shows: "Your access has been revoked. Please contact the board owner."
5. Client falls back to view-only mode

### 9.3 Session Expiry

**Scenario:** User's session expires while they have the app open.

**Handling:**
1. Better Auth sessions have configurable TTL (default: 7 days)
2. API calls with expired session return 401
3. Client detects 401, clears user state
4. Client shows login prompt with message: "Session expired. Please sign in again."
5. SSE connection will close; reconnect shows current (anonymous) state

### 9.4 Invalid or Malformed Tokens

**Scenario:** Request has Authorization header with invalid format or nonexistent token.

**Handling:**
1. Token doesn't start with `hb_` → Ignore, try session auth
2. Token hash not in database → Return 401 "Invalid token"
3. Token expired → Return 401 "Token expired"
4. Malformed header → Return 400 "Invalid Authorization header"

### 9.5 Permission Denied Scenarios

**Scenario:** User/token attempts action beyond their permission level.

**Handling:**
1. Return 403 Forbidden with message: "Insufficient permissions"
2. Include required permission in response: `{ "required": "edit", "current": "view" }`
3. Client can use this to show appropriate message
4. Log the attempt for security monitoring

### 9.6 Network Failures During Auth Flows

**Signup/Login failure:**
1. Show error message with retry option
2. Don't clear partial state
3. Allow user to try again

**Claim failure after signup:**
1. User is logged in, claim failed
2. Show error, allow retry
3. Offer to continue without claiming (view-only)

**Token creation failure:**
1. Show error, allow retry
2. Token not created, nothing to clean up

### 9.7 Concurrent Sessions/Tokens

**Multiple sessions for same user:**
- Better Auth supports this by default
- Each device has its own session
- All sessions valid until individually expired/revoked

**Multiple tokens for same board:**
- Fully supported
- Each token tracked independently
- Revocation affects only that token

---

## 10. Testing Strategy

### 10.1 Unit Tests

**File:** `tests/unit/auth.test.ts`

Test coverage:
- `resolveAuth()` with various header combinations
- `resolvePermissionForBoard()` with all ownership scenarios
- Token hashing consistency
- Permission helper functions (`canEdit`, `canAdmin`)
- Token expiry checking

**Mocking:**
- Mock Better Auth's `getSession()` to return controlled session objects
- Mock database repos for token lookups

### 10.2 Integration Tests

**File:** `tests/integration/auth.test.ts`

Test coverage:
- Better Auth endpoints work (signup, signin, signout)
- Protected route access with session
- Protected route access with controller token
- Protected route rejection without auth
- Token creation and validation
- Token revocation
- Board claiming
- User boards listing

**Setup:**
- Use test database
- Create test users directly in database for some tests
- Use Better Auth API for auth flow tests

### 10.3 E2E Tests

**File:** `tests/e2e/auth.spec.ts`

Critical user journeys:
1. **New user claiming board:**
   - Open TV → see pair code
   - Open controller → enter code
   - Click "Create Account"
   - Fill signup form
   - Claim board
   - Verify admin access

2. **Returning user login:**
   - Open controller
   - Click "Sign In"
   - Enter credentials
   - See owned boards
   - Select board
   - Verify admin access

3. **Staff using controller token:**
   - Owner creates token
   - Staff enters token
   - Staff can edit (or view only, based on token)
   - Owner revokes token
   - Staff loses access

4. **Permission-based UI:**
   - View-only user sees no edit buttons
   - Edit user sees edit buttons, no token management
   - Admin sees all controls

### 10.4 Auth Mocking in Tests

```typescript
// tests/helpers/auth.ts

export function mockSession(user: Partial<User> = {}): void {
  // Set up test session in database
  // Or mock the getSession function
}

export function mockControllerToken(
  boardId: string,
  permission: 'view' | 'edit'
): string {
  // Create test token, return the raw token value
}

export function clearAuth(): void {
  // Clear all test sessions and tokens
}
```

---

## 11. Open Questions

### 11.1 Decisions Needed

**Q1: Email verification requirement?**
- Options:
  - A) Require email verification before allowing board claims
  - B) Allow immediate claims, verify email later
  - C) Skip email verification entirely for MVP
- Recommendation: C for MVP, add B in future
- Trade-off: Security vs. onboarding friction

**Q2: Password requirements?**
- Options:
  - A) Minimum 8 chars, no other requirements
  - B) Minimum 8 chars + complexity (upper, lower, number)
  - C) Use Better Auth defaults (minimum 8)
- Recommendation: A or C
- Better Auth handles hashing with bcrypt

**Q3: Session duration?**
- Options:
  - A) 24 hours (more secure)
  - B) 7 days (default, good balance)
  - C) 30 days (more convenient)
- Recommendation: B (7 days)
- Can be configured in Better Auth

**Q4: What happens to boards when owner account is deleted?**
- Current design: `ON DELETE SET NULL` makes board unclaimed
- Options:
  - A) Keep as unclaimed (current)
  - B) Delete board and all data
  - C) Transfer to another user first (require selection)
- Recommendation: A for safety, add explicit board deletion option

**Q5: Controller token prefix?**
- Options:
  - A) `hb_` (horseboard)
  - B) `ct_` (controller token)
  - C) `tok_` (generic)
- Recommendation: A - distinctive and short
- Note: Prefix is checked but not stored; token is hashed

**Q6: Should view-only users see the pair code?**
- Currently: pair_code is in bootstrap response
- Options:
  - A) Always include (anyone can share access)
  - B) Only include for edit+ permission
  - C) Only include for admin permission
- Recommendation: A for now (matches current behavior)
- Future: Consider regenerating pair codes or hiding them

### 11.2 Future Considerations

**Multi-board accounts:**
- Current design supports one user owning multiple boards
- UI doesn't yet have board switching
- Consider: Board selector in header/settings

**Team/organization accounts:**
- Current: One owner per board, tokens for others
- Future: Multiple owners, roles (owner, manager, staff)
- Would require new tables: `board_members` with role column

**OAuth providers:**
- Better Auth supports GitHub, Google, etc.
- Low priority for horse barn users
- Easy to add later with Better Auth plugins

**API key plugin:**
- Better Auth has an API key plugin for server-to-server auth
- Could be useful for integrations (e.g., feed inventory systems)
- Separate from controller tokens (which are for human users)

### 11.3 Risks Identified

**Risk 1: Better Auth breaking changes**
- Mitigation: Pin version, monitor releases
- Better Auth is actively maintained but young

**Risk 2: Session cookie issues in Safari/iOS**
- Safari has strict cookie policies
- Mitigation: Test thoroughly on iOS devices
- Better Auth handles SameSite correctly

**Risk 3: Migration on existing production data**
- Existing boards will have no owner
- Mitigation: Clear communication, easy claim flow
- All existing functionality continues working

**Risk 4: Token leakage**
- If token is exposed (logs, screenshots), access compromised
- Mitigation: Only show token once on creation
- Tokens can be revoked anytime
- Consider: Token rotation feature later

---

## Summary

This plan provides a complete specification for adding multi-tenant authentication to HorseBoard. The implementation:

1. **Uses Better Auth** for user authentication with customized snake_case schema
2. **Adds board ownership** via `account_id` foreign key
3. **Implements controller tokens** for staff/device access
4. **Defines three permission levels**: view, edit, admin
5. **Preserves board-first UX** with claim-on-signup flow
6. **Phases implementation** for incremental, testable progress

The system allows:
- Anyone to view a board (with pair code)
- Authenticated owners to manage their boards
- Staff to access boards via configurable tokens
- Progressive enhancement from single-user to multi-tenant

All seven phases can be completed independently with working application state after each phase.
