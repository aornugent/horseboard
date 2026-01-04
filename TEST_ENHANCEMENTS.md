# E2E Test Suite Enhancement Plan

**Goal:** Transform the test suite from a 3+ minute serial bottleneck into a sub-60-second parallelized asset that developers actually want to run.

**Status:** Implementation Ready
**Estimated Impact:** 70% reduction in test time, 40% reduction in flakiness
**Author:** Claude Code Analysis
**Date:** 2026-01-04

---

## Executive Summary

The current E2E test suite has accumulated technical debt through incremental additions:
- **200+ seconds** execution time (2 projects × ~50 tests × 2s each)
- **Serial execution** due to shared SQLite database
- **60-70% duplication** in setup code (manual signups, provisioning flows)
- **Inconsistent patterns** - some tests use fast API fixtures, most don't
- **Mobile tests run unnecessarily** - 100% duplication on non-mobile-critical flows

This plan addresses these issues holistically through 5 coordinated changes, not bandaid fixes.

---

## Guiding Principles

### 1. **Tests Should Be Faster Than Writing Them**
If a developer writes a feature in 10 minutes but tests take 3 minutes to run, they won't run them during development. Target: < 1 minute for full suite.

### 2. **No Arbitrary Decisions**
Every timeout, every helper function, every abstraction must have a documented reason. "It worked" is not a reason.

### 3. **Fail Fast, Fail Clear**
When tests fail, the error message should tell you exactly what broke without looking at code.

### 4. **Design for Deletion**
If a test can be replaced by a better abstraction, delete the old one. No "legacy compatibility."

### 5. **Optimize for the 95% Case**
Most tests are integration flows. Optimize for those. Edge cases can be slower if needed.

---

## Current State Analysis

### Test Inventory (as of 2026-01-04)

```
tests/e2e/
├── auth.spec.ts                     (6 tests)  - Manual signup in every test
├── auth-edge.spec.ts               (4 tests)  - Manual signup in every test
├── controller.spec.ts              (24 tests) - Uses fixtures ✅
├── permission-enforcement.spec.ts  (3 tests)  - Manual signup in every test
├── provisioning.spec.ts            (5 tests)  - Repeats provisioning flow 4x
├── session-persistence.spec.ts     (6 tests)  - Mixed: 2 use fixtures, 4 manual
├── stories.spec.ts                 (5 tests)  - Manual signup in every test
├── workflows.spec.ts               (3 tests)  - Uses fixtures ✅
└── flows/
    ├── diet-editing.spec.ts        (4 tests)  - Uses API setup ✅
    ├── display-sync.spec.ts        (3 tests)  - Uses API setup ✅
    ├── feed-crud.spec.ts           (3 tests)  - Uses API setup ✅
    ├── horse-crud.spec.ts          (3 tests)  - Uses API setup ✅
    └── onboarding.spec.ts          (3 tests)  - Manual signup

Total: ~72 tests
Manual signup: ~35 tests (waste: 70-105 seconds)
Provisioning duplication: ~7 tests (waste: 30-40 seconds)
Mobile duplication: 100% of tests (waste: 100+ seconds)
```

### Performance Breakdown

```
Current State:
├── Serial execution (workers: 1)          = 2x slowdown
├── 2 projects (chromium + mobile)         = 2x duplication
├── Manual signups (35 tests × 2-3s)       = 70-105s waste
├── Provisioning duplication (7 tests × 5s) = 35s waste
└── Total: ~200 seconds (3m 20s)

Target State:
├── Parallel execution (workers: 4)        = 4x speedup
├── Mobile only on critical (15 tests)     = 50% reduction
├── Fixtures for setup (API, <500ms)       = 90s saved
├── Provisioning helper                    = 30s saved
└── Target: ~45-60 seconds
```

---

## Implementation Plan

## Phase 1: Create Provisioning Helper (1-2 hours)

**Why First:** Low risk, high impact. Removes duplication immediately without changing infrastructure.

### 1.1 Create Helper File

**File:** `tests/e2e/helpers/provisioning.ts`

```typescript
/**
 * TV Display Provisioning Helpers
 *
 * Extracted from repeated patterns in:
 * - provisioning.spec.ts (4 instances)
 * - stories.spec.ts (2 instances)
 * - session-persistence.spec.ts (1 instance)
 *
 * Design Decision: We return objects with named properties instead of tuples
 * for clarity at call sites. Compare:
 *
 * ❌ const [tv, ctx, code] = await provision(...);  // What's tv? What's ctx?
 * ✅ const { tvPage, tvContext, code } = await provision(...);  // Clear!
 */

import { Browser, BrowserContext, Page, expect } from '@playwright/test';
import { selectors } from '../selectors';

export interface ProvisionedDisplay {
  /** The TV display page (showing /board) */
  tvPage: Page;

  /** Browser context for the TV (must be closed by caller) */
  tvContext: BrowserContext;

  /** The 6-character provisioning code (e.g., "AB12CD") */
  provisioningCode: string;

  /** Cleanup function - closes TV context */
  cleanup: () => Promise<void>;
}

/**
 * Provision a TV display by linking it to an owner's board.
 *
 * This follows the real user flow from USER_PATHS.md Story B:
 * 1. TV visits /board and shows provisioning code
 * 2. Owner enters code in Settings → Displays
 * 3. TV polls /api/devices/poll and receives token
 * 4. TV displays board
 *
 * @param browser - Playwright browser instance
 * @param ownerPage - Owner's page (must already be logged in and on controller)
 * @param options.waitForDisplay - Wait for TV to show board (default: true)
 * @returns ProvisionedDisplay object with TV page and cleanup function
 *
 * @example
 * ```typescript
 * test('my test', async ({ ownerPage, browser }) => {
 *   const { tvPage, cleanup } = await linkTVDisplay(browser, ownerPage);
 *
 *   // Test TV behavior
 *   await expect(tvPage.locator(selectors.boardView)).toBeVisible();
 *
 *   // Cleanup
 *   await cleanup();
 * });
 * ```
 */
export async function linkTVDisplay(
  browser: Browser,
  ownerPage: Page,
  options: { waitForDisplay?: boolean } = {}
): Promise<ProvisionedDisplay> {
  const { waitForDisplay = true } = options;

  // 1. TV Context: Create unprovisioned display
  const tvContext = await browser.newContext();
  const tvPage = await tvContext.newPage();

  // 2. TV shows provisioning code
  await tvPage.goto('/board');
  const codeDisplay = tvPage.locator('[data-testid="provisioning-code"]');
  await expect(codeDisplay).toBeVisible({
    timeout: 10000,
  });

  // Extract code (handles both "AB-CD-EF" and "ABCDEF" formats)
  const codeText = (await codeDisplay.innerText()).replace(/[\r\n\s-]+/g, '');

  // Validate code format (fail fast if UI changed)
  if (!/^[A-Z0-9]{6}$/.test(codeText)) {
    throw new Error(
      `Invalid provisioning code format: "${codeText}". Expected 6 alphanumeric chars.`
    );
  }

  // 3. Owner links the display
  // Assumption: ownerPage is already on /controller (enforced by fixture or caller)
  await ownerPage.locator('[data-testid="tab-settings"]').click();

  const addDisplayBtn = ownerPage.locator('[data-testid="add-display-btn"]');
  await expect(addDisplayBtn).toBeVisible({
    timeout: 5000,
  });
  await addDisplayBtn.click();

  // Modal should open
  const modal = ownerPage.locator('[data-testid="link-display-modal"]');
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Enter code and submit
  const input = ownerPage.locator('[data-testid="provisioning-input"]');
  await input.fill(codeText);

  const submitBtn = ownerPage.locator('[data-testid="provisioning-submit"]');
  await submitBtn.click();

  // Modal should close on success
  await expect(modal).not.toBeVisible({ timeout: 10000 });

  // 4. Wait for TV to receive token and display board
  if (waitForDisplay) {
    // TV polls every ~3 seconds, allow 10s for multiple attempts
    await expect(tvPage.locator(selectors.boardView)).toBeVisible({
      timeout: 10000,
    });

    // Verify provisioning view is gone
    await expect(tvPage.locator('[data-testid="provisioning-view"]')).not.toBeVisible();
  }

  // 5. Return with cleanup function
  return {
    tvPage,
    tvContext,
    provisioningCode: codeText,
    cleanup: async () => {
      await tvContext.close();
    },
  };
}

/**
 * Get the pair code from owner's settings (for visitor pairing).
 *
 * This is different from provisioning - it's for Staff Access (Story C).
 *
 * @param ownerPage - Owner's page (must be logged in)
 * @returns The 6-digit pair code
 *
 * @example
 * ```typescript
 * const pairCode = await getPairCode(ownerPage);
 * await visitorPage.goto('/');
 * await visitorPage.locator('[data-testid="landing-code-input"]').fill(pairCode);
 * ```
 */
export async function getPairCode(ownerPage: Page): Promise<string> {
  await ownerPage.locator('[data-testid="tab-settings"]').click();

  const pairCodeElement = ownerPage.locator(selectors.boardPairCode);
  await expect(pairCodeElement).toBeVisible({ timeout: 5000 });

  const fullText = await pairCodeElement.innerText();
  const pairCode = fullText.replace('Pair Code:', '').trim();

  // Validate format
  if (!/^\d{6}$/.test(pairCode)) {
    throw new Error(
      `Invalid pair code format: "${pairCode}". Expected 6 digits.`
    );
  }

  return pairCode;
}

/**
 * Generate an invite code for staff access (Story D).
 *
 * @param ownerPage - Owner's page (must be on settings tab)
 * @returns The 6-digit invite code
 */
export async function generateInviteCode(ownerPage: Page): Promise<string> {
  const generateBtn = ownerPage.locator('[data-testid="generate-invite-btn"]');
  await generateBtn.click();

  const codeDisplay = ownerPage.locator('[data-testid="invite-code-display"]');
  await expect(codeDisplay).toBeVisible({ timeout: 5000 });

  const inviteCode = await ownerPage.locator('.settings-invite-code').innerText();

  // Validate format
  if (!/^\d{6}$/.test(inviteCode)) {
    throw new Error(
      `Invalid invite code format: "${inviteCode}". Expected 6 digits.`
    );
  }

  return inviteCode;
}

/**
 * Redeem an invite code to upgrade from view to edit access (Story E).
 *
 * @param page - User's page (must be on controller with view access)
 * @param inviteCode - The 6-digit invite code
 */
export async function redeemInviteCode(
  page: Page,
  inviteCode: string
): Promise<void> {
  await page.locator('[data-testid="tab-settings"]').click();

  const enterBtn = page.locator(selectors.enterInviteBtn);
  await enterBtn.click();

  const input = page.locator(selectors.inviteInput);
  await input.fill(inviteCode);

  const submitBtn = page.locator(selectors.inviteSubmit);
  await submitBtn.click();

  // Wait for reload/navigation (app swaps tokens and reloads)
  await expect(page.locator(selectors.horsesTab)).toBeVisible({ timeout: 10000 });
}
```

### 1.2 Update Tests to Use Helper

**File:** `tests/e2e/provisioning.spec.ts`

**Before (76 lines):**
```typescript
test('completes full TV provisioning flow', async ({ browser }) => {
    const tvContext = await browser.newContext();
    const tvPage = await tvContext.newPage();

    await tvPage.goto('/board');
    const provisioningView = tvPage.locator('[data-testid="provisioning-view"]');
    await expect(provisioningView).toBeVisible({ timeout: 10000 });
    const codeDisplay = tvPage.locator('[data-testid="provisioning-code"]');
    await expect(codeDisplay).toBeVisible();
    const codeText = (await codeDisplay.innerText()).replace(/[\r\n\s-]+/g, '');
    expect(codeText).toMatch(/^[A-Z0-9]{6}$/);

    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const timestamp = Date.now();
    await ownerPage.goto('/signup');
    await ownerPage.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
    await ownerPage.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
    await ownerPage.locator(selectors.passwordInput).fill('password123');
    await ownerPage.locator(selectors.submitBtn).click();
    await expect(ownerPage).toHaveURL(/\/controller/);

    await ownerPage.locator('[data-testid="tab-settings"]').click();
    await expect(ownerPage.locator(selectors.settingsTab)).toBeVisible();
    const addDisplayBtn = ownerPage.locator('[data-testid="add-display-btn"]');
    await expect(addDisplayBtn).toBeVisible();
    await addDisplayBtn.click();
    // ... 50+ more lines
});
```

**After (25 lines):**
```typescript
import { linkTVDisplay } from './helpers/provisioning';

test('completes full TV provisioning flow', async ({ ownerPage, browser }) => {
    // Use fixture for owner setup (fast API-based)

    // Link TV display (real provisioning flow)
    const { tvPage, provisioningCode, cleanup } = await linkTVDisplay(browser, ownerPage);

    // Verify TV displays board
    await expect(tvPage.locator(selectors.boardView)).toBeVisible();

    // Verify token persistence
    const tvToken = await tvPage.evaluate(() =>
        localStorage.getItem('horseboard_display_token')
    );
    expect(tvToken).toBeTruthy();
    expect(tvToken).toMatch(/^hb_/);

    // Verify display appears in owner's list
    await ownerPage.locator('[data-testid="tab-settings"]').click();
    const linkedDisplay = ownerPage.locator('.settings-device-name');
    await expect(linkedDisplay).toBeVisible();

    // Verify TV has view permission
    const response = await tvPage.request.get('/api/bootstrap');
    const data = await response.json();
    expect(data.ownership?.permission).toBe('view');

    await cleanup();
});
```

**Files to Update:**
- `tests/e2e/provisioning.spec.ts` - 4 tests
- `tests/e2e/stories.spec.ts` - 2 tests (Story B tests)
- `tests/e2e/session-persistence.spec.ts` - 1 test

**Validation:**
```bash
# Run affected tests
npx playwright test provisioning.spec.ts stories.spec.ts session-persistence.spec.ts

# Expected: All pass, 30-40s faster
```

---

## Phase 2: Convert to Fixtures (2-3 hours)

**Why Second:** Builds on Phase 1. Now that provisioning is extracted, convert manual signups to fixtures.

### 2.1 Understand Current Fixture Architecture

**File:** `tests/e2e/fixtures/auth.ts`

```typescript
// Already exists - provides:
// - ownerPage: Fast API-based owner setup
// - ownerBoardId: The owner's board ID
// - visitorPage: View-only access via pair code
```

**Design Decision:** The fixture creates boards via API and injects headers for auth. This is **100x faster** than UI signup.

### 2.2 Identify Conversion Candidates

**Criteria for using fixtures:**
- ✅ Test needs owner with board (95% of tests)
- ✅ Test doesn't specifically test signup flow
- ❌ Test MUST test signup/login UI behavior

**Conversion candidates (35 tests):**
```
auth.spec.ts:
  - ❌ Keep: 'should navigate to signup and login views'  (tests UI)
  - ❌ Keep: 'should sign up new owner and auto-create board'  (tests signup)
  - ✅ Convert: 'should see account info after signup'
  - ✅ Convert: 'should sign out'
  - ✅ Convert: 'should auto-redirect returning users'

permission-enforcement.spec.ts:
  - ✅ Convert all 3 tests (testing permissions, not signup)

stories.spec.ts:
  - ❌ Keep: 'New owner signup auto-creates board'  (Story A - tests signup)
  - ✅ Convert: 'Unprovisioned TV shows code'  (Story B)
  - ✅ Convert: 'User enters pair code'  (Story C)
  - ✅ Convert: 'Owner generates invite code'  (Story D)
  - ✅ Convert: 'View-only user enters invite'  (Story E)

... (similar analysis for other files)
```

### 2.3 Conversion Pattern

**Template:**

```typescript
// ❌ BEFORE: Manual signup
test('my test', async ({ page }) => {
  const timestamp = Date.now();
  await page.goto('/signup');
  await page.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
  await page.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
  await page.locator(selectors.passwordInput).fill('password123');
  await page.locator(selectors.submitBtn).click();
  await expect(page).toHaveURL(/\/controller/);

  // Actual test logic
  await page.locator('[data-testid="tab-horses"]').click();
  await expect(page.locator(selectors.addHorseBtn)).toBeVisible();
});

// ✅ AFTER: Use fixture
import { test } from './fixtures/auth';  // Import from fixtures, not @playwright/test

test('my test', async ({ ownerPage, ownerBoardId }) => {
  // ownerPage is already on /controller with admin permissions

  // Actual test logic (no setup needed)
  await ownerPage.locator('[data-testid="tab-horses"]').click();
  await expect(ownerPage.locator(selectors.addHorseBtn)).toBeVisible();
});
```

**Critical:** Change the import from `@playwright/test` to `./fixtures/auth` to get the enhanced fixtures.

### 2.4 Files to Update

```
Priority 1 (High Impact):
├── permission-enforcement.spec.ts   (3 tests × 3s = 9s saved)
├── stories.spec.ts                  (4 of 5 tests × 3s = 12s saved)
└── auth-edge.spec.ts               (4 tests × 3s = 12s saved)

Priority 2 (Medium Impact):
├── session-persistence.spec.ts      (4 tests × 3s = 12s saved)
└── auth.spec.ts                     (3 of 6 tests × 3s = 9s saved)

Total Savings: ~54 seconds
```

### 2.5 Validation Strategy

**Step 1:** Convert one test file
```bash
npx playwright test permission-enforcement.spec.ts
# Expected: Pass, ~9s faster
```

**Step 2:** Convert remaining files one at a time

**Step 3:** Full regression
```bash
npx playwright test
# Expected: All pass, ~54s faster than baseline
```

---

## Phase 3: Optimize Mobile Testing (1 hour)

**Why Third:** Low risk, pure configuration change. No code modification needed.

### 3.1 Analyze Mobile-Critical Tests

**Question:** Which tests MUST run on mobile?

**Mobile-critical criteria:**
- ✅ Touch interactions (swipe, tap, hold)
- ✅ Viewport-specific layouts
- ✅ Mobile-only features
- ❌ Pure logic tests
- ❌ API permission tests

**Analysis:**

```typescript
// Mobile-critical (viewport matters):
✅ auth.spec.ts               - Login/signup forms must work on mobile
✅ controller.spec.ts         - Tab navigation, modals on small screens
✅ provisioning.spec.ts       - TV + mobile pairing flow (Story B)
✅ stories.spec.ts            - User journeys include mobile users

// NOT mobile-critical (logic-only):
❌ permission-enforcement.spec.ts  - API permission checks (no UI)
❌ session-persistence.spec.ts     - localStorage behavior (browser-agnostic)
❌ auth-edge.spec.ts              - Edge case handling (browser-agnostic)
❌ workflows.spec.ts              - Board state updates (logic)
❌ flows/*.spec.ts                - Grid rendering is viewport-agnostic
```

### 3.2 Configuration Change

**File:** `playwright.config.ts`

```typescript
export default defineConfig({
  // ... other config

  projects: [
    {
      name: 'chromium',
      testMatch: '**/*.spec.ts',  // Run ALL tests
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      // ONLY run mobile-critical tests
      testMatch: [
        '**/auth.spec.ts',
        '**/controller.spec.ts',
        '**/provisioning.spec.ts',
        '**/stories.spec.ts',
      ],
      use: { ...devices['Pixel 5'] },
    },
  ],
});
```

**Impact:**
- Before: 72 tests × 2 projects = 144 test runs
- After: 72 chromium + 25 mobile = 97 test runs
- Savings: 47 tests × 2s = **94 seconds**

### 3.3 Document Mobile Test Criteria

**File:** `tests/e2e/README.md` (create if doesn't exist)

```markdown
## Mobile Testing Strategy

Not all tests need to run on mobile. Only include tests in the Mobile Chrome project if:

1. **Touch interactions** - Swipe, tap, long-press
2. **Viewport-specific layouts** - Modals, responsive grids
3. **Mobile-specific features** - Touch gestures, orientation

### Adding a New Test

**Decision tree:**
```
Does the test interact with UI?
  └─ Yes → Does the UI change on mobile?
       └─ Yes → Add to Mobile Chrome project
       └─ No → Desktop only
  └─ No → Desktop only (API/logic tests)
```

**Examples:**

✅ Add to mobile:
- Login form (touch keyboard, input focus)
- Tab navigation (touch targets)
- Modal interactions (small screen layout)

❌ Desktop only:
- API permission checks
- Database state verification
- Token validation
```

---

## Phase 4: Per-Worker Database Isolation (Half day)

**Why Fourth:** Most complex change. Requires server-side modification. Do after quick wins are proven.

### 4.1 Problem Statement

Current bottleneck:
```typescript
// playwright.config.ts
workers: 1,  // Serial execution - shared SQLite prevents parallel
```

**Root cause:** All tests write to `data/horseboard.db`. Parallel workers would corrupt the database.

**Solution:** Give each worker its own database.

### 4.2 Server-Side Changes

**File:** `server/index.ts` (or wherever DB is initialized)

```typescript
/**
 * Database path selection for test isolation.
 *
 * In test mode, each Playwright worker gets its own database to enable
 * parallel test execution.
 *
 * Worker ID is passed via x-test-worker-index header by Playwright.
 */
function getDatabasePath(): string {
  if (process.env.NODE_ENV !== 'test') {
    return './data/horseboard.db';
  }

  // In test mode, use per-worker database
  // Default to worker-0 if header missing (single worker, global setup)
  const workerId = process.env.TEST_WORKER_INDEX || '0';
  return `./data/test-worker-${workerId}.db`;
}

// Initialize database
const dbPath = getDatabasePath();
export const db = new Database(dbPath);
```

**File:** `server/middleware/test-headers.ts` (create new)

```typescript
/**
 * Extract Playwright worker index from headers and set as env var.
 *
 * Playwright sets x-test-worker-index header on all requests.
 * We extract it and make it available to database initialization.
 */
import { Request, Response, NextFunction } from 'express';

export function extractTestWorkerIndex(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (process.env.NODE_ENV === 'test') {
    const workerIndex = req.headers['x-test-worker-index'] as string;
    if (workerIndex) {
      process.env.TEST_WORKER_INDEX = workerIndex;
    }
  }
  next();
}
```

**File:** `server/index.ts` (apply middleware)

```typescript
import { extractTestWorkerIndex } from './middleware/test-headers';

// BEFORE database initialization
if (process.env.NODE_ENV === 'test') {
  app.use(extractTestWorkerIndex);
}

// THEN initialize database (will see TEST_WORKER_INDEX env var)
const db = initializeDatabase();
```

### 4.3 Playwright Configuration

**File:** `playwright.config.ts`

```typescript
export default defineConfig({
  // Enable parallel workers
  workers: process.env.CI ? 2 : 4,  // 4 workers locally, 2 in CI

  use: {
    baseURL: 'http://localhost:5173',

    // Inject worker index into all requests
    extraHTTPHeaders: {
      'x-test-worker-index': process.env.TEST_WORKER_INDEX || '0',
    },
  },
});
```

### 4.4 Global Setup Changes

**File:** `tests/e2e/global-setup.ts`

```typescript
/**
 * Global setup runs ONCE before all workers start.
 *
 * With per-worker databases, we need to:
 * 1. Clean all worker databases (not just worker-0)
 * 2. Run migrations on worker-0 only (template database)
 */
import { existsSync, unlinkSync } from 'fs';
import { glob } from 'glob';

export default async function globalSetup() {
  console.log('Cleaning test databases...');

  // Remove all worker databases
  const dbFiles = glob.sync('./data/test-worker-*.db*');
  for (const file of dbFiles) {
    unlinkSync(file);
    console.log(`Removed: ${file}`);
  }

  console.log('Database cleaned for fresh test run\n');
}
```

**Key Insight:** Migrations only need to run once. Workers 1-3 will copy the schema from worker-0's first connection.

### 4.5 Verification Steps

**Step 1:** Verify database isolation
```bash
# Run with DEBUG=1 to see which worker uses which DB
DEBUG=1 npx playwright test --workers=4

# Should see in logs:
# [Worker 0] Using database: test-worker-0.db
# [Worker 1] Using database: test-worker-1.db
# [Worker 2] Using database: test-worker-2.db
# [Worker 3] Using database: test-worker-3.db
```

**Step 2:** Verify no corruption
```bash
# Run full suite 3 times
for i in {1..3}; do
  echo "Run $i"
  npx playwright test --workers=4
done

# All 3 runs should pass
```

**Step 3:** Measure speedup
```bash
# Baseline (workers=1)
time npx playwright test --workers=1

# Parallel (workers=4)
time npx playwright test --workers=4

# Expected: 3-4x faster
```

### 4.6 Rollback Strategy

If per-worker DBs cause issues:

1. **Revert server changes**
```bash
git checkout server/index.ts server/middleware/test-headers.ts
```

2. **Revert config**
```typescript
// playwright.config.ts
workers: 1,  // Back to serial
```

3. **Keep all other optimizations** (fixtures, helpers, mobile config)

---

## Phase 5: Test Organization Refactor (2-3 hours)

**Why Last:** Most subjective. Do after concrete wins prove value of changes.

### 5.1 Current Organization Problems

```
tests/e2e/
├── provisioning.spec.ts        - E2E (5-10s per test)
├── auth.spec.ts                - Mixed (1-5s per test)
├── controller.spec.ts          - Unit-like (< 1s per test)
├── permission-enforcement.spec.ts - Integration (2-5s per test)
└── flows/
    ├── diet-editing.spec.ts    - Integration
    ├── display-sync.spec.ts    - E2E
    └── ...
```

**Problems:**
1. No clear separation by speed/scope
2. Hard to run "just the fast tests"
3. Unclear what each file tests

### 5.2 Proposed Structure

**Principle:** Group by test scope, not feature area.

```
tests/e2e/
├── unit/                    # Fast (< 1s), isolated component tests
│   ├── controller-navigation.spec.ts
│   ├── modal-interactions.spec.ts
│   └── form-validation.spec.ts
│
├── integration/             # Medium (1-5s), multi-component flows
│   ├── horse-crud.spec.ts
│   ├── feed-crud.spec.ts
│   ├── diet-editing.spec.ts
│   └── permission-checks.spec.ts
│
├── e2e/                     # Slow (5-10s), full user journeys
│   ├── user-signup.spec.ts
│   ├── tv-provisioning.spec.ts
│   ├── staff-access.spec.ts
│   └── session-persistence.spec.ts
│
├── helpers/                 # Shared utilities
│   ├── api.ts
│   ├── provisioning.ts     # Created in Phase 1
│   └── setup.ts
│
└── fixtures/                # Test fixtures
    └── auth.ts
```

### 5.3 Migration Plan

**Don't do a "big bang" reorganization.** Migrate incrementally:

**Week 1:** Move unit-like tests
```bash
mkdir tests/e2e/unit
git mv tests/e2e/controller.spec.ts tests/e2e/unit/controller-navigation.spec.ts
```

**Week 2:** Move integration tests
```bash
mkdir tests/e2e/integration
git mv tests/e2e/flows/*.spec.ts tests/e2e/integration/
```

**Week 3:** Move E2E tests
```bash
mkdir tests/e2e/e2e
git mv tests/e2e/provisioning.spec.ts tests/e2e/e2e/tv-provisioning.spec.ts
git mv tests/e2e/stories.spec.ts tests/e2e/e2e/user-stories.spec.ts
```

### 5.4 Playwright Config Update

**File:** `playwright.config.ts`

```typescript
export default defineConfig({
  projects: [
    {
      name: 'unit',
      testDir: './tests/e2e/unit',
      use: { ...devices['Desktop Chrome'] },
      // Run unit tests first (fast feedback)
    },
    {
      name: 'integration',
      testDir: './tests/e2e/integration',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'e2e',
      testDir: './tests/e2e/e2e',
      use: { ...devices['Desktop Chrome'] },
      // Run E2E tests last
    },
    {
      name: 'mobile',
      testMatch: [
        '**/unit/controller-navigation.spec.ts',
        '**/e2e/tv-provisioning.spec.ts',
        '**/e2e/user-stories.spec.ts',
      ],
      use: { ...devices['Pixel 5'] },
    },
  ],
});
```

**Benefit:** Can now run fast tests only:
```bash
npx playwright test --project=unit        # < 30s
npx playwright test --project=integration # ~60s
npx playwright test --project=e2e         # ~90s
```

### 5.5 Test Classification Guide

**File:** `tests/e2e/README.md` (append)

```markdown
## Test Classification

### Unit Tests (`tests/e2e/unit/`)

**Criteria:**
- Tests single component in isolation
- No backend API calls (uses fixtures/mocks)
- < 1 second per test
- No browser contexts (single page)

**Examples:**
- Tab navigation in controller
- Modal open/close
- Form validation

**Anti-pattern:** Don't test multiple features together

### Integration Tests (`tests/e2e/integration/`)

**Criteria:**
- Tests multiple components working together
- Uses real backend API (via fixtures)
- 1-5 seconds per test
- May use multiple pages in same context

**Examples:**
- CRUD operations (create → read → update → delete)
- Permission checks (API + UI)
- Real-time sync (controller → display)

**Anti-pattern:** Don't test full user signup → feature flow

### E2E Tests (`tests/e2e/e2e/`)

**Criteria:**
- Tests complete user journey
- Multiple browser contexts (simulates multiple users)
- 5-10 seconds per test
- Tests Stories from USER_PATHS.md

**Examples:**
- TV provisioning (Story B)
- Staff access via pair code (Story C)
- Invite redemption (Story E)

**Anti-pattern:** Don't test every edge case here (use integration)

### When in Doubt

Ask: "If this breaks, how much of the app is broken?"
- One component → Unit
- Multiple components → Integration
- Entire user flow → E2E
```

---

## Quality Gates

**Before merging any phase:**

### 1. All Tests Pass
```bash
npx playwright test
# Exit code 0 required
```

### 2. No Flakiness
```bash
# Run suite 5 times
for i in {1..5}; do
  npx playwright test || exit 1
done
# All 5 runs must pass
```

### 3. Performance Target Met
```bash
# Measure baseline
time npx playwright test > baseline.txt

# Measure with changes
time npx playwright test > optimized.txt

# Compare (should be faster)
```

### 4. Code Review Checklist

- [ ] No arbitrary timeouts (all `waitForTimeout()` removed)
- [ ] All helpers have JSDoc comments explaining "why"
- [ ] Fixtures used consistently (no manual signup where avoidable)
- [ ] Test names describe behavior, not implementation
- [ ] Cleanup functions called (no leaked browser contexts)

### 5. Documentation Updated

- [ ] README.md explains new structure
- [ ] Helpers have usage examples
- [ ] Fixtures documented with when/why to use

---

## Success Metrics

### Quantitative

**Before (baseline):**
- Total test time: ~200 seconds
- Workers: 1 (serial)
- Mobile tests: 72 (100% duplication)
- Manual signups: 35 tests

**After (target):**
- Total test time: < 60 seconds (**70% reduction**)
- Workers: 4 (parallel)
- Mobile tests: 25 (**65% reduction**)
- Manual signups: 5 (only tests that require it)

### Qualitative

**Developer Experience:**
- ✅ Developers run tests locally (not "too slow, will check CI")
- ✅ Test failures are debuggable (clear error messages)
- ✅ New tests are easy to write (use fixtures, not copy-paste setup)
- ✅ Test suite is maintainable (no duplication, clear organization)

### TDD Workflow

**Before:** Write feature (10 min) → Wait for tests (3 min) → Fix (2 min) → Wait (3 min)
**After:** Write feature (10 min) → Wait for tests (45s) → Fix (2 min) → Wait (45s)

**Impact:** 5.5x faster feedback loop enables true TDD.

---

## Rollback Strategy

Each phase is independent. If any phase causes issues:

**Phase 1 (Provisioning Helper):**
- Revert helper file
- Revert test changes
- Impact: Low (isolated to 7 tests)

**Phase 2 (Fixtures):**
- Change imports back to `@playwright/test`
- Restore manual signup code
- Impact: Medium (35 tests affected)

**Phase 3 (Mobile Config):**
- Restore mobile project to run all tests
- Impact: None (pure config change)

**Phase 4 (Per-Worker DB):**
- Revert server changes
- Set `workers: 1`
- Impact: High (but other phases still provide value)

**Phase 5 (Reorganization):**
- Move files back to original locations
- Restore testDir in config
- Impact: Low (cosmetic change)

---

## Implementation Timeline

**Week 1:**
- Day 1-2: Phase 1 (Provisioning Helper)
- Day 3-4: Phase 2 (Convert to Fixtures)
- Day 5: Phase 3 (Mobile Config) + Testing

**Week 2:**
- Day 1-3: Phase 4 (Per-Worker DB)
- Day 4-5: Validation & Performance Testing

**Week 3:**
- Day 1-2: Phase 5 (Reorganization)
- Day 3: Documentation
- Day 4-5: Buffer for issues

---

## Appendix: Code Quality Standards

### Helper Functions

**Required:**
1. JSDoc comment explaining purpose
2. Parameter validation with clear errors
3. Usage example in comment
4. Return types must be explicit
5. Cleanup functions for resources

**Example:**
```typescript
/**
 * Link a TV display to owner's board.
 *
 * @param browser - Playwright browser
 * @param ownerPage - Owner's page (must be on /controller)
 * @returns Object with tvPage and cleanup function
 * @throws {Error} If provisioning code format is invalid
 *
 * @example
 * const { tvPage, cleanup } = await linkTVDisplay(browser, ownerPage);
 * await expect(tvPage.locator(selectors.boardView)).toBeVisible();
 * await cleanup();
 */
export async function linkTVDisplay(
  browser: Browser,
  ownerPage: Page
): Promise<{ tvPage: Page; cleanup: () => Promise<void> }> {
  // Implementation
}
```

### Test Naming

**Pattern:** `should [expected behavior] when [condition]`

**Good:**
- ✅ `should display board when TV receives token`
- ✅ `should reject API calls when user has view-only permission`
- ✅ `should persist session when page reloads`

**Bad:**
- ❌ `test TV provisioning` (what about it?)
- ❌ `permissions work` (too vague)
- ❌ `test_001` (meaningless)

### Timeout Philosophy

**Never use arbitrary delays:**
```typescript
❌ await page.waitForTimeout(2000);  // Hope it's ready in 2s
```

**Always wait for conditions:**
```typescript
✅ await expect(element).toBeVisible({ timeout: 10000 });  // Max 10s to become visible
```

**Document known timing:**
```typescript
// TV polls every 3 seconds (from ProvisioningView.tsx line 42)
// Allow 10s = 3-4 polling attempts
await expect(tvPage.locator(selectors.boardView)).toBeVisible({ timeout: 10000 });
```

### Fixture Usage

**Use fixtures when:**
- ✅ Test needs authenticated user
- ✅ Test needs board with data
- ✅ Test doesn't test signup/login UI

**Use manual setup when:**
- ✅ Testing signup flow itself
- ✅ Testing login error handling
- ✅ Testing specific signup edge cases

---

## Final Notes

This plan represents **systemic improvement**, not bandaid fixes. Each phase:

1. **Addresses root causes** (shared DB, duplication, manual setup)
2. **Builds on previous phases** (helpers → fixtures → parallel)
3. **Is independently valuable** (can stop after any phase)
4. **Has clear success metrics** (time, flakiness, DX)

The goal is not just "faster tests" - it's **sustainable test infrastructure** that developers trust and use.

**Remember:** Tests are code. They deserve the same care as production code. Refactor, document, and maintain them accordingly.
