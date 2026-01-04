import { test, expect, testWithVisitor } from './fixtures/auth';
import { selectors } from './selectors';

/**
 * Session Persistence Tests
 * 
 * These tests verify that session state persists correctly across reloads.
 * Story F from USER_PATHS.md: Returning User (Session Restore)
 */

test.describe('Session Persistence', () => {
  // Refactored to use ownerPage (API setup).
  // Verifies that Admin permissions persist, even if we don't check specific Account Name.
  test('restores owner session after page reload', async ({ ownerPage }) => {
    // Verify owner permissions (can see displays section)
    await ownerPage.locator('[data-testid="tab-settings"]').click();
    await expect(ownerPage.getByRole('heading', { name: 'Displays' })).toBeVisible();

    // Reload page
    await ownerPage.reload();

    // Should still be on controller (auto-redirect from /)
    await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

    // Verify session restored: Still owner with admin permissions
    await ownerPage.locator('[data-testid="tab-settings"]').click();
    await expect(ownerPage.getByRole('heading', { name: 'Displays' })).toBeVisible();

    // Note: We skip checking 'accountName' because API-created board uses an anonymous/test admin context.
  });

  // Optimize visitor test using fixture
  testWithVisitor('restores view-only session after page reload', async ({ visitorPage }) => {
    // Visitor is already connected via fixture

    // Verify view-only access
    await expect(visitorPage.locator(selectors.addHorseBtn)).not.toBeVisible();

    // Reload page
    await visitorPage.reload();

    // Should still be on controller
    await expect(visitorPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

    // Verify session restored: Still view-only (no add button)
    await expect(visitorPage.locator(selectors.addHorseBtn)).not.toBeVisible();

    // Verify settings still show view-only sections
    await visitorPage.locator('[data-testid="tab-settings"]').click();
    await expect(visitorPage.getByRole('heading', { name: 'Upgrade Access' })).toBeVisible();
    await expect(visitorPage.getByRole('heading', { name: 'Displays' })).not.toBeVisible();
  });

  test('restores edit session after page reload', async ({ ownerPage, browser }) => {
    // Setup: Owner creates board (via fixture) and generates invite

    // Get pair code (fixture provides it via ownerBoard.pair_code but checking UI ensures it's visible)
    await ownerPage.locator('[data-testid="tab-settings"]').click();
    const pairCodeElement = ownerPage.locator(selectors.boardPairCode);
    await expect(pairCodeElement).toBeVisible();
    const fullText = await pairCodeElement.innerText();
    const pairCode = fullText.replace('Pair Code:', '').trim();

    // Generate invite (scroll to the button first)
    const generateBtn = ownerPage.locator('[data-testid="generate-invite-btn"]');
    await generateBtn.scrollIntoViewIfNeeded();
    await generateBtn.click();

    const inviteCodeDisplay = ownerPage.locator('[data-testid="invite-code-display"]');
    await expect(inviteCodeDisplay).toBeVisible();
    const inviteCode = await ownerPage.locator('.settings-invite-code').innerText();

    // User upgrades from view to edit
    const userContext = await browser.newContext();
    try {
      const userPage = await userContext.newPage();

      await userPage.goto('/');
      await userPage.locator('[data-testid="landing-code-input"]').fill(pairCode);
      await userPage.locator('[data-testid="landing-connect-btn"]').click();
      await expect(userPage).toHaveURL(/\/controller/);

      // Redeem invite
      await userPage.locator('[data-testid="tab-settings"]').click();
      await userPage.locator(selectors.enterInviteBtn).click();
      await userPage.locator(selectors.inviteInput).fill(inviteCode);
      await userPage.locator(selectors.inviteSubmit).click();

      await expect(userPage.locator(selectors.horsesTab)).toBeVisible({ timeout: 15000 });
      await userPage.locator('[data-testid="tab-horses"]').click();

      // Verify edit access
      await expect(userPage.locator(selectors.addHorseBtn)).toBeVisible();

      // Reload page
      await userPage.reload();

      // Should still be on controller
      await expect(userPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

      // Verify session restored: Still edit (has add button)
      await expect(userPage.locator(selectors.addHorseBtn)).toBeVisible();

      // Verify can actually add horse (real behavior, not just UI)
      await userPage.locator(selectors.addHorseBtn).click();
      await userPage.locator(selectors.newHorseName).fill('Persistence Test Horse');
      await userPage.locator(selectors.confirmAddHorse).click();
      await expect(userPage.locator('.horse-card').filter({ hasText: 'Persistence Test Horse' })).toBeVisible();
    } finally {
      await userContext.close();
    }
  });

  test('board ID persists in localStorage across page refresh', async ({ ownerPage, ownerBoardId }) => {
    // Capture board ID from localStorage
    const pageBoardId = await ownerPage.evaluate(() => localStorage.getItem('horseboard_board_id'));
    expect(pageBoardId).toBe(ownerBoardId);

    // Reload page
    await ownerPage.reload();

    // Board ID should still be in localStorage
    const persistedBoardId = await ownerPage.evaluate(() => localStorage.getItem('horseboard_board_id'));
    expect(persistedBoardId).toBe(ownerBoardId);

    // Should auto-redirect to controller (not show landing page)
    await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });
  });

  test('clears session when signing out', async ({ browser }) => {
    // This test requires a real auth session (not header injection)
    // so we do a full signup flow
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Sign up a new user
      const testEmail = `signout-test-${Date.now()}@example.com`;
      await page.goto('/signup');
      await page.locator('[data-testid="name-input"]').fill('Sign Out Test');
      await page.locator('[data-testid="email-input"]').fill(testEmail);
      await page.locator('[data-testid="password-input"]').fill('password123');
      await page.locator('[data-testid="submit-btn"]').click();

      // Should redirect to controller after signup
      await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 15000 });

      // Capture board ID
      const boardId = await page.evaluate(() => localStorage.getItem('horseboard_board_id'));
      expect(boardId).toBeTruthy();

      // Go to settings and verify sign out button exists
      await page.locator('[data-testid="tab-settings"]').click();
      await expect(page.locator(selectors.signOutBtn)).toBeVisible();

      // Sign out
      await page.locator(selectors.signOutBtn).click();

      // Should stay on controller (board ID persists)
      await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

      // Check settings - should now show sign in option (not account name)
      await page.locator('[data-testid="tab-settings"]').click();
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

      // Board ID should still be in storage (board is separate from user session)
      const persistedBoardId = await page.evaluate(() => localStorage.getItem('horseboard_board_id'));
      expect(persistedBoardId).toBe(boardId);
    } finally {
      await context.close();
    }
  });

  test('navigating to root auto-redirects returning user to controller', async ({ ownerPage }) => {
    // Navigate to root
    await ownerPage.goto('/');

    // Should auto-redirect to controller (not show landing page)
    await expect(ownerPage).toHaveURL(/\/controller/, { timeout: 5000 });
    await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible();
  });
});
