# Client Implementation

## New Views

### Login View

`src/client/views/Auth/Login.tsx`

- Email input
- Password input
- "Sign In" button
- Link to signup
- Error display

### Signup View

`src/client/views/Auth/Signup.tsx`

- Name input
- Email input
- Password input
- Password confirmation
- "Create Account" button
- Link to login
- Error display

### Claim Board Prompt

Component shown when board is unclaimed and user is authenticated.

- "Claim This Board" button
- Explanation text

### Token Management View

`src/client/views/Controller/TokensTab.tsx`

- List of active tokens (name, permission, last used, created)
- "Create Token" button
- Token creation modal (name, permission, optional expiry)
- Copy token button (shown only on creation)
- Revoke token button per row
- Confirmation dialog for revocation

### Account Settings

Addition to SettingsTab:

- Current user info
- "Sign Out" button
- Link to token management (if admin)

## Modifications to Existing Views

### App.tsx

- Add auth state initialization
- Add auth-aware routing logic
- Handle claim flow

### PairingView

- After successful pair, check if board is unclaimed
- If unclaimed and user authenticated → show claim option
- If unclaimed and user not authenticated → show signup/login options

### Controller Tabs

- Check `canEdit` before showing edit buttons
- Check `canAdmin` before showing TokensTab, board deletion
- Disable form elements when read-only

### SettingsTab

- Show account section if authenticated
- Show "Sign Out" button
- Show "Manage Tokens" link if admin

## Auth State Management

### Store: `src/client/stores/auth.ts`

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

export const authClient = createAuthClient({
  baseURL: window.location.origin,
});

export const currentUser = signal<User | null>(null);
export const boardPermission = signal<Permission>('view');
export const authLoading = signal(true);

export const isAuthenticated = computed(() => currentUser.value !== null);
export const canEdit = computed(() =>
  boardPermission.value === 'edit' || boardPermission.value === 'admin'
);
export const canAdmin = computed(() => boardPermission.value === 'admin');

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

## API Service Updates

### Modify: `src/client/services/api.ts`

```typescript
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

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (controllerToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${controllerToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // ... error handling
}

export async function claimBoard(boardId: string): Promise<Board> {
  const result = await request<ApiResponse<Board>>(`/api/boards/${boardId}/claim`, {
    method: 'POST',
  });
  if (!result.data) throw new ApiError('Failed to claim board', 500);
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
  if (!result.data) throw new ApiError('Failed to create token', 500);
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

## Permission-Based UI

### Bootstrap Response Handling

```typescript
const data = await bootstrap(boardId);

if (data.ownership) {
  updatePermission(data.ownership.permission);
}
```

### Conditional Rendering

```tsx
// Hide edit buttons for view-only users
{canEdit.value && <EditButton onClick={handleEdit} />}

// Hide admin-only controls
{canAdmin.value && <TokensTab />}

// Show claim prompt for unclaimed boards
{!board.account_id && isAuthenticated.value && <ClaimBoardPrompt />}
```
