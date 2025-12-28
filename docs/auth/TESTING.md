# Testing Strategy

## Unit Tests

**File:** `tests/unit/auth.test.ts`

### Coverage

- `resolveAuth()` with various header combinations
- `resolvePermissionForBoard()` with all ownership scenarios
- Token hashing consistency
- Permission helper functions (`canEdit`, `canAdmin`)
- Token expiry checking

### Mocking

```typescript
// Mock Better Auth's getSession()
jest.mock('../lib/auth-instance', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

// Mock database repos
const mockRepos = {
  controllerTokens: {
    getByHash: jest.fn(),
    updateLastUsed: jest.fn(),
  },
  boards: {
    getById: jest.fn(),
  },
};
```

## Integration Tests

**File:** `tests/integration/auth.test.ts`

### Coverage

- Better Auth endpoints work (signup, signin, signout)
- Protected route access with session
- Protected route access with controller token
- Protected route rejection without auth
- Token creation and validation
- Token revocation
- Board claiming
- User boards listing

### Setup

```typescript
import { createTestApp } from './helpers';

let app: Express;
let db: Database;

beforeEach(async () => {
  db = createTestDatabase();
  app = createTestApp(db);
});

afterEach(() => {
  db.close();
});
```

## E2E Tests

**File:** `tests/e2e/auth.spec.ts`

### Critical User Journeys

#### 1. New User Claiming Board

```typescript
test('new user can claim board', async ({ page }) => {
  // Open TV → see pair code
  await page.goto('/board');
  const pairCode = await page.locator('[data-testid="pair-code"]').textContent();

  // Open controller → enter code
  const controllerPage = await context.newPage();
  await controllerPage.goto('/controller');
  await controllerPage.fill('[data-testid="pair-code-input"]', pairCode);
  await controllerPage.click('[data-testid="pair-button"]');

  // Click "Create Account"
  await controllerPage.click('[data-testid="create-account-link"]');

  // Fill signup form
  await controllerPage.fill('[data-testid="name-input"]', 'Test User');
  await controllerPage.fill('[data-testid="email-input"]', 'test@example.com');
  await controllerPage.fill('[data-testid="password-input"]', 'password123');
  await controllerPage.click('[data-testid="signup-button"]');

  // Claim board
  await controllerPage.click('[data-testid="claim-board-button"]');

  // Verify admin access
  await expect(controllerPage.locator('[data-testid="tokens-tab"]')).toBeVisible();
});
```

#### 2. Returning User Login

```typescript
test('returning user can login and see boards', async ({ page }) => {
  // Setup: Create user with board
  await createUserWithBoard('test@example.com', 'password123');

  // Open controller
  await page.goto('/controller');

  // Click "Sign In"
  await page.click('[data-testid="sign-in-link"]');

  // Enter credentials
  await page.fill('[data-testid="email-input"]', 'test@example.com');
  await page.fill('[data-testid="password-input"]', 'password123');
  await page.click('[data-testid="login-button"]');

  // See owned boards
  await expect(page.locator('[data-testid="board-list"]')).toBeVisible();

  // Select board and verify admin access
  await page.click('[data-testid="board-item"]');
  await expect(page.locator('[data-testid="tokens-tab"]')).toBeVisible();
});
```

#### 3. Staff Using Controller Token

```typescript
test('staff can use controller token', async ({ page, context }) => {
  // Owner creates token
  const ownerPage = await context.newPage();
  await loginAsOwner(ownerPage);
  await ownerPage.goto('/controller');
  await ownerPage.click('[data-testid="tokens-tab"]');
  await ownerPage.click('[data-testid="create-token-button"]');
  await ownerPage.fill('[data-testid="token-name"]', 'Staff Token');
  await ownerPage.selectOption('[data-testid="token-permission"]', 'edit');
  await ownerPage.click('[data-testid="create-token-submit"]');
  const token = await ownerPage.locator('[data-testid="token-value"]').textContent();

  // Staff enters token
  await page.goto('/controller');
  await page.click('[data-testid="use-token-link"]');
  await page.fill('[data-testid="token-input"]', token);
  await page.click('[data-testid="submit-token-button"]');

  // Staff can edit
  await expect(page.locator('[data-testid="add-horse-button"]')).toBeVisible();

  // But no token management
  await expect(page.locator('[data-testid="tokens-tab"]')).not.toBeVisible();

  // Owner revokes token
  await ownerPage.click('[data-testid="revoke-token-button"]');
  await ownerPage.click('[data-testid="confirm-revoke"]');

  // Staff loses access on next action
  await page.click('[data-testid="add-horse-button"]');
  await expect(page.locator('[data-testid="access-revoked-message"]')).toBeVisible();
});
```

#### 4. Permission-Based UI

```typescript
test('UI reflects permission level', async ({ page }) => {
  // View-only user
  await pairWithBoard(page);
  await expect(page.locator('[data-testid="add-horse-button"]')).not.toBeVisible();

  // Edit user (with token)
  await enterControllerToken(page, editToken);
  await expect(page.locator('[data-testid="add-horse-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="tokens-tab"]')).not.toBeVisible();

  // Admin user
  await loginAsOwner(page);
  await expect(page.locator('[data-testid="add-horse-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="tokens-tab"]')).toBeVisible();
});
```

## Test Helpers

```typescript
// tests/helpers/auth.ts

export async function createUser(email: string, password: string): Promise<User> {
  // Insert user directly into database
}

export async function createUserWithBoard(email: string, password: string): Promise<{ user: User; board: Board }> {
  const user = await createUser(email, password);
  const board = await createBoard({ account_id: user.id });
  return { user, board };
}

export function mockSession(user: Partial<User> = {}): void {
  // Set up test session in database
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

## Edge Case Tests

### Session Expiry

```typescript
test('expired session redirects to login', async ({ page }) => {
  await loginAsOwner(page);
  await expireSession();
  await page.click('[data-testid="add-horse-button"]');
  await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
```

### Token Revocation During Use

```typescript
test('revoked token shows error', async ({ page }) => {
  await enterControllerToken(page, token);
  await revokeToken(token);
  await page.click('[data-testid="add-horse-button"]');
  await expect(page.locator('[data-testid="access-revoked-message"]')).toBeVisible();
});
```

### Concurrent Claims

```typescript
test('second claim attempt fails', async ({ context }) => {
  const page1 = await context.newPage();
  const page2 = await context.newPage();

  await pairWithBoard(page1);
  await pairWithBoard(page2);

  await signUpAndClaim(page1);

  // Second user tries to claim
  await signUp(page2);
  await page2.click('[data-testid="claim-board-button"]');

  await expect(page2.locator('[data-testid="already-claimed-message"]')).toBeVisible();
});
```
