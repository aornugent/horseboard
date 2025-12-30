# Authentication Flows

## TV Device Provisioning (New)

**Trigger:** TV loads without token, displays Provisioning Code (e.g. "8X2-9P"). User adds display in Controller settings.

```
TV (Display)           Controller (Phone)        Server                SQLite
  │                          │                      │                     │
  │ Generates Code           │                      │                     │
  │ "8X2-9P" (local)         │                      │                     │
  │ Polling for Token...     │                      │                     │
  │─────────────────────────>│                      │                     │
  │                          │ POST /api/devices/link                     │
  │                          │ { code: "8X2-9P", name: "Living Room" }    │
  │                          │─────────────────────>│                     │
  │                          │                      │                     │
  │                          │                      │ Verify Code (if valid)
  │                          │                      │ Create Token (display)
  │                          │                      │ INSERT controller_tokens
  │                          │                      │────────────────────>│
  │                          │                      │                     │
  │                          │ 200 OK (Success)     │                     │
  │                          │<─────────────────────│                     │
  │                          │                      │                     │
  │ <Pool Response with Token]                      │                     │
  │<────────────────────────────────────────────────│                     │
  │                          │                      │                     │
  │ Save Token to storage    │                      │                     │
  │ Reload / Fetch Content   │                      │                     │
```

**Steps:**
1. TV generates a temporary linking code (or fetches one) and displays it.
2. User logs into Controller (Phone), goes to Settings > Displays > Add Display.
3. User enters the code from the TV and gives it a name (e.g., "Living Room").
4. Controller sends code and name to `POST /api/devices/link`.
5. Server validates the code (mechanism depends on implementation, e.g., temporary DB entry or signed stateless code).
6. Server creates a new `controller_token` with `type: 'display'`.
7. Server responds to Controller with success.
8. Server responds to TV's long-poll/socket with the new `token`.
9. TV saves `token` in persistent storage (localStorage) and reloads to behave as a registered display.

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
