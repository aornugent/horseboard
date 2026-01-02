import { test, expect } from '@playwright/test';
import { selectors } from './selectors';

/**
 * Session Persistence Tests
 *
 * These tests verify that session state persists correctly across reloads.
 * They test REAL behavior - actual localStorage persistence, SSE reconnection, etc.
 *
 * Story F from USER_PATHS.md: Returning User (Session Restore)
 */

test.describe('Session Persistence', () => {
  test('restores owner session after page reload', async ({ page }) => {
    // User signs up
    const timestamp = Date.now();
    const email = `owner-${timestamp}@example.com`;
    const name = `Owner ${timestamp}`;

    await page.goto('/signup');
    await page.locator(selectors.nameInput).fill(name);
    await page.locator(selectors.emailInput).fill(email);
    await page.locator(selectors.passwordInput).fill('password123');
    await page.locator(selectors.submitBtn).click();

    await expect(page).toHaveURL(/\/controller/);
    await expect(page.locator('[data-testid="controller-view"]')).toBeVisible();

    // Verify owner permissions (can see displays section)
    await page.locator('[data-testid="tab-settings"]').click();
    await expect(page.getByRole('heading', { name: 'Displays' })).toBeVisible();

    // Reload page
    await page.reload();

    // Should still be on controller (auto-redirect from /)
    await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

    // Verify session restored: Still owner with admin permissions
    await page.locator('[data-testid="tab-settings"]').click();
    await expect(page.getByRole('heading', { name: 'Displays' })).toBeVisible();
    await expect(page.locator(selectors.accountName)).toHaveText(name);
  });

  test('restores view-only session after page reload', async ({ browser }) => {
    // Setup: Owner creates board
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();

    const timestamp = Date.now();
    await ownerPage.goto('/signup');
    await ownerPage.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
    await ownerPage.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
    await ownerPage.locator(selectors.passwordInput).fill('password123');
    await ownerPage.locator(selectors.submitBtn).click();
    await expect(ownerPage).toHaveURL(/\/controller/);

    // Get pair code
    await ownerPage.locator('[data-testid="tab-settings"]').click();
    const pairCodeElement = ownerPage.locator(selectors.boardPairCode);
    await expect(pairCodeElement).toBeVisible();
    const fullText = await pairCodeElement.innerText();
    const pairCode = fullText.replace('Pair Code:', '').trim();

    // Visitor connects
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();

    await visitorPage.goto('/');
    await visitorPage.locator('[data-testid="landing-code-input"]').fill(pairCode);
    await visitorPage.locator('[data-testid="landing-connect-btn"]').click();
    await expect(visitorPage).toHaveURL(/\/controller/);

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

    await ownerContext.close();
    await visitorContext.close();
  });

  test('restores edit session after page reload', async ({ browser }) => {
    // Setup: Owner creates board and generates invite
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();

    const timestamp = Date.now();
    await ownerPage.goto('/signup');
    await ownerPage.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
    await ownerPage.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
    await ownerPage.locator(selectors.passwordInput).fill('password123');
    await ownerPage.locator(selectors.submitBtn).click();
    await expect(ownerPage).toHaveURL(/\/controller/);

    // Get pair code and invite code
    await ownerPage.locator('[data-testid="tab-settings"]').click();
    const pairCodeElement = ownerPage.locator(selectors.boardPairCode);
    await expect(pairCodeElement).toBeVisible();
    const fullText = await pairCodeElement.innerText();
    const pairCode = fullText.replace('Pair Code:', '').trim();

    await ownerPage.locator('[data-testid="generate-invite-btn"]').click();
    const inviteCodeDisplay = ownerPage.locator('[data-testid="invite-code-display"]');
    await expect(inviteCodeDisplay).toBeVisible();
    const inviteCode = await ownerPage.locator('.settings-invite-code').innerText();

    // User upgrades from view to edit
    const userContext = await browser.newContext();
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

    await ownerContext.close();
    await userContext.close();
  });

  test('board ID persists in localStorage across page refresh', async ({ page }) => {
    // User signs up (auto-creates board)
    const timestamp = Date.now();
    await page.goto('/signup');
    await page.locator(selectors.nameInput).fill(`User ${timestamp}`);
    await page.locator(selectors.emailInput).fill(`user-${timestamp}@example.com`);
    await page.locator(selectors.passwordInput).fill('password123');
    await page.locator(selectors.submitBtn).click();

    await expect(page).toHaveURL(/\/controller/);

    // Capture board ID from localStorage
    const originalBoardId = await page.evaluate(() => localStorage.getItem('horseboard_board_id'));
    expect(originalBoardId).toBeTruthy();

    // Reload page
    await page.reload();

    // Board ID should still be in localStorage
    const persistedBoardId = await page.evaluate(() => localStorage.getItem('horseboard_board_id'));
    expect(persistedBoardId).toBe(originalBoardId);

    // Should auto-redirect to controller (not show landing page)
    await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });
  });

  test('clears session when signing out', async ({ page }) => {
    // User signs up
    const timestamp = Date.now();
    await page.goto('/signup');
    await page.locator(selectors.nameInput).fill(`User ${timestamp}`);
    await page.locator(selectors.emailInput).fill(`user-${timestamp}@example.com`);
    await page.locator(selectors.passwordInput).fill('password123');
    await page.locator(selectors.submitBtn).click();

    await expect(page).toHaveURL(/\/controller/);

    // Sign out
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator(selectors.signOutBtn).click();

    // Should stay on controller (board ID persists)
    await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

    // Check settings - should now show sign in option (not account name)
    await page.locator('[data-testid="tab-settings"]').click();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    // Board ID should still be in storage (board is separate from user session)
    const boardId = await page.evaluate(() => localStorage.getItem('horseboard_board_id'));
    expect(boardId).toBeTruthy();
  });

  test('navigating to root auto-redirects returning user to controller', async ({ page }) => {
    // User signs up
    const timestamp = Date.now();
    await page.goto('/signup');
    await page.locator(selectors.nameInput).fill(`User ${timestamp}`);
    await page.locator(selectors.emailInput).fill(`user-${timestamp}@example.com`);
    await page.locator(selectors.passwordInput).fill('password123');
    await page.locator(selectors.submitBtn).click();

    await expect(page).toHaveURL(/\/controller/);

    // Navigate to root
    await page.goto('/');

    // Should auto-redirect to controller (not show landing page)
    await expect(page).toHaveURL(/\/controller/, { timeout: 5000 });
    await expect(page.locator('[data-testid="controller-view"]')).toBeVisible();
  });
});
