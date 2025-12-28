# Authentication Flows

## New User Signup (via Board Claim)

**Trigger:** User pairs with unclaimed board, UI shows "Claim this board"

```
Client                Express             Better Auth          SQLite
  │                      │                      │                 │
  │ POST /api/auth/sign-up/email               │                 │
  │ {email, password, name}                    │                 │
  │─────────────────────────────────────────────>                 │
  │                      │                      │                 │
  │                      │                      │ INSERT users    │
  │                      │                      │ INSERT accounts │
  │                      │                      │ INSERT sessions │
  │                      │                      │────────────────>│
  │                      │                      │                 │
  │                      │  Set-Cookie: session_token             │
  │<─────────────────────────────────────────────                 │
  │                      │                      │                 │
  │ POST /api/boards/:id/claim                 │                 │
  │ Cookie: session_token                      │                 │
  │─────────────────────>│                      │                 │
  │                      │                      │                 │
  │                      │ getSession()         │                 │
  │                      │─────────────────────>│                 │
  │                      │                      │                 │
  │                      │ UPDATE boards SET account_id = ?       │
  │                      │────────────────────────────────────────>
  │                      │                      │                 │
  │ 200 OK {board}       │                      │                 │
  │<─────────────────────│                      │                 │
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

## Returning User Login

```
Client                Better Auth          SQLite
  │                      │                   │
  │ POST /api/auth/sign-in/email             │
  │ {email, password}                        │
  │─────────────────────>│                   │
  │                      │                   │
  │                      │ SELECT user       │
  │                      │ VERIFY password   │
  │                      │ INSERT session    │
  │                      │──────────────────>│
  │                      │                   │
  │ Set-Cookie           │                   │
  │ {user, session}      │                   │
  │<─────────────────────│                   │
  │                      │                   │
  │ GET /api/user/boards │                   │
  │ Cookie: session      │                   │
  │──────────────────────────────────────────>
  │                      │                   │
  │ [{board1}, {board2}] │                   │
  │<──────────────────────────────────────────
```

**Steps:**
1. User enters email and password
2. Client calls `authClient.signIn.email({ email, password })`
3. Better Auth verifies credentials, creates session
4. Client receives session cookie
5. Client fetches user's boards via `GET /api/user/boards`
6. Client shows board selection or redirects to their board

## Logout

```
Client                Better Auth          SQLite
  │                      │                   │
  │ POST /api/auth/sign-out                  │
  │ Cookie: session      │                   │
  │─────────────────────>│                   │
  │                      │                   │
  │                      │ DELETE session    │
  │                      │──────────────────>│
  │                      │                   │
  │ Clear-Cookie         │                   │
  │ 200 OK               │                   │
  │<─────────────────────│                   │
  │                      │                   │
  │ Clear local state    │                   │
  │ Redirect to /        │                   │
```

**Steps:**
1. User clicks logout
2. Client calls `authClient.signOut()`
3. Better Auth deletes session from database
4. Better Auth clears session cookie
5. Client clears local auth state
6. Client redirects to landing or pairing view

## Session Validation on Protected Routes

```typescript
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

## Controller Token Authentication

```
Client                    Server                    SQLite
  │                          │                         │
  │ GET /api/boards/:id/horses                         │
  │ Authorization: Bearer hb_xxx                       │
  │─────────────────────────>│                         │
  │                          │                         │
  │                          │ Hash token (SHA-256)    │
  │                          │ SELECT * FROM           │
  │                          │   controller_tokens     │
  │                          │   WHERE token_hash = ?  │
  │                          │────────────────────────>│
  │                          │                         │
  │                          │ Check expiry            │
  │                          │ Update last_used_at     │
  │                          │────────────────────────>│
  │                          │                         │
  │                          │ Check permission level  │
  │                          │                         │
  │ 200 OK {horses}          │                         │
  │<─────────────────────────│                         │
```

## Client Auth Initialization

```typescript
// src/client/services/auth.ts

import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
});

export function useAuthSession() {
  const session = authClient.useSession();

  return {
    user: session.data?.user ?? null,
    isLoading: session.isPending,
    error: session.error,
    isAuthenticated: !!session.data?.user,
  };
}

export async function initAuth() {
  const session = await authClient.getSession();
  if (session.data?.user) {
    currentUser.value = session.data.user;
  }
}
```
