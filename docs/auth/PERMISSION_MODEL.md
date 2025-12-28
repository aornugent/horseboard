# Permission Model

## Permission Levels

| Level | Name | Description |
|-------|------|-------------|
| 0 | `none` | No access (invalid token, wrong board) |
| 1 | `view` | Read-only access to board data |
| 2 | `edit` | Full CRUD on horses, feeds, diet entries |
| 3 | `admin` | Edit + manage tokens + board settings + transfer ownership |

## Access Methods

| Method | Authentication | Identification | Permission |
|--------|---------------|----------------|------------|
| Owner with session | Better Auth cookie | `session.user.id === board.account_id` | `admin` |
| Staff with edit token | `Authorization: Bearer hb_xxx` | Token hash lookup, `permission = 'edit'` | `edit` |
| Device with view token | `Authorization: Bearer hb_xxx` | Token hash lookup, `permission = 'view'` | `view` |
| Paired phone (no auth) | None (board_id in localStorage) | board_id from request | `view` |
| TV board display | None (board_id in URL/localStorage) | board_id from request | `view` |

## Permission Matrix

| Action | `view` | `edit` | `admin` |
|--------|--------|--------|---------|
| GET board data (horses, feeds, diet) | Y | Y | Y |
| SSE connection | Y | Y | Y |
| Create/update/delete horses | - | Y | Y |
| Create/update/delete feeds | - | Y | Y |
| Upsert/delete diet entries | - | Y | Y |
| Update board settings (timezone, zoom) | - | Y | Y |
| Set time mode | - | Y | Y |
| Create controller tokens | - | - | Y |
| Revoke controller tokens | - | - | Y |
| List controller tokens | - | - | Y |
| Transfer board ownership | - | - | Y |
| Delete board | - | - | Y |

## Server Implementation

### Types

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

### Resolution Logic

```typescript
export async function resolveAuth(req: Request, repos: Repos): Promise<AuthContext> {
  const authHeader = req.headers.authorization;

  // 1. Check for controller token
  if (authHeader?.startsWith('Bearer hb_')) {
    const token = authHeader.slice(7);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const controllerToken = repos.controllerTokens.getByHash(tokenHash);

    if (!controllerToken) {
      return { permission: 'none', user_id: null, token_id: null, board_id: null };
    }

    if (controllerToken.expires_at && new Date(controllerToken.expires_at) < new Date()) {
      return { permission: 'none', user_id: null, token_id: null, board_id: null };
    }

    repos.controllerTokens.updateLastUsed(controllerToken.id);

    return {
      permission: controllerToken.permission as Permission,
      user_id: null,
      token_id: controllerToken.id,
      board_id: controllerToken.board_id,
    };
  }

  // 2. Check for Better Auth session
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (session?.user) {
    return {
      permission: 'authenticated',
      user_id: session.user.id,
      token_id: null,
      board_id: null,
    };
  }

  // 3. No authentication - view only
  return {
    permission: 'view',
    user_id: null,
    token_id: null,
    board_id: null,
  };
}

export function resolvePermissionForBoard(
  authCtx: AuthContext,
  board: Board | null
): Permission {
  if (!board) return 'none';

  // Controller token - permission is fixed to the board
  if (authCtx.token_id) {
    return authCtx.board_id === board.id ? authCtx.permission : 'none';
  }

  // Authenticated user - check ownership
  if (authCtx.user_id) {
    return board.account_id === authCtx.user_id ? 'admin' : 'view';
  }

  return 'view';
}
```

### Middleware

```typescript
export function requirePermission(level: 'view' | 'edit' | 'admin') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authCtx = await resolveAuth(req);
    req.authContext = authCtx;

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

## Client Implementation

```typescript
// src/client/stores/auth.ts

import { signal, computed } from '@preact/signals';

export type ClientPermission = 'none' | 'view' | 'edit' | 'admin';

export const currentUser = signal<User | null>(null);
export const boardPermission = signal<ClientPermission>('view');

export const isAuthenticated = computed(() => currentUser.value !== null);
export const canEdit = computed(() =>
  boardPermission.value === 'edit' || boardPermission.value === 'admin'
);
export const canAdmin = computed(() => boardPermission.value === 'admin');
```

## Precedence Rules

1. Controller token (if present and valid) takes precedence
2. Better Auth session (if present) determines ownership
3. No auth defaults to view-only

If a request has both a controller token AND a session cookie, the controller token takes precedence. This allows owners to test tokens without logging out.
