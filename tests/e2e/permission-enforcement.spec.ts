import { test, expect } from '@playwright/test';
import { selectors } from './selectors';

/**
 * Permission Enforcement Tests
 *
 * These tests verify that permission boundaries are enforced correctly.
 * They test REAL behavior - a user with view permission trying to edit should fail,
 * not just hide the UI button.
 *
 * Test Philosophy:
 * - Test the actual API calls, not just UI visibility
 * - Verify server-side permission enforcement
 * - Break if permissions are bypassed
 */

test.describe('Permission Enforcement', () => {
  test.describe('View-only users cannot edit', () => {
    test('rejects API calls to add horse from view-only token', async ({ browser }) => {
      // Setup: Owner creates board and gets pair code
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

      // Visitor connects with view-only access
      const visitorContext = await browser.newContext();
      const visitorPage = await visitorContext.newPage();

      await visitorPage.goto('/');
      await visitorPage.locator('[data-testid="landing-code-input"]').fill(pairCode);
      await visitorPage.locator('[data-testid="landing-connect-btn"]').click();
      await expect(visitorPage).toHaveURL(/\/controller/);

      // Verify view-only: Add Horse button is hidden
      await expect(visitorPage.locator(selectors.addHorseBtn)).not.toBeVisible();

      // REAL TEST: Try to add horse via API with view-only token
      const response = await visitorPage.request.post('/api/horses', {
        data: { name: 'Hacked Horse', note: 'Should not work' }
      });

      // Should be rejected with 403 Forbidden
      expect(response.status()).toBe(403);

      await ownerContext.close();
      await visitorContext.close();
    });

    test('rejects API calls to delete horse from view-only token', async ({ browser }) => {
      // Setup: Owner creates board with a horse
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();

      const timestamp = Date.now();
      await ownerPage.goto('/signup');
      await ownerPage.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
      await ownerPage.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
      await ownerPage.locator(selectors.passwordInput).fill('password123');
      await ownerPage.locator(selectors.submitBtn).click();
      await expect(ownerPage).toHaveURL(/\/controller/);

      // Add a horse
      await ownerPage.locator(selectors.addHorseBtn).click();
      await ownerPage.locator(selectors.newHorseName).fill('TestHorse');
      await ownerPage.locator(selectors.confirmAddHorse).click();
      await expect(ownerPage.locator('.horse-card').filter({ hasText: 'TestHorse' })).toBeVisible();

      // Get horse ID from the card
      const horseCard = ownerPage.locator('.horse-card').filter({ hasText: 'TestHorse' });
      const horseId = await horseCard.getAttribute('data-testid');
      const extractedId = horseId?.replace('horse-card-', '') || '';

      // Get pair code
      await ownerPage.locator('[data-testid="tab-settings"]').click();
      const pairCodeElement = ownerPage.locator(selectors.boardPairCode);
      await expect(pairCodeElement).toBeVisible();
      const fullText = await pairCodeElement.innerText();
      const pairCode = fullText.replace('Pair Code:', '').trim();

      // Visitor connects with view-only access
      const visitorContext = await browser.newContext();
      const visitorPage = await visitorContext.newPage();

      await visitorPage.goto('/');
      await visitorPage.locator('[data-testid="landing-code-input"]').fill(pairCode);
      await visitorPage.locator('[data-testid="landing-connect-btn"]').click();
      await expect(visitorPage).toHaveURL(/\/controller/);

      // REAL TEST: Try to delete horse via API with view-only token
      const response = await visitorPage.request.delete(`/api/horses/${extractedId}`);

      // Should be rejected with 403 Forbidden
      expect(response.status()).toBe(403);

      // Verify horse still exists (owner can still see it)
      await ownerPage.locator('[data-testid="tab-horses"]').click();
      await expect(ownerPage.locator('.horse-card').filter({ hasText: 'TestHorse' })).toBeVisible();

      await ownerContext.close();
      await visitorContext.close();
    });

    test('rejects API calls to update board settings from view-only token', async ({ browser }) => {
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

      // Get board ID
      const boardId = await ownerPage.evaluate(() => localStorage.getItem('horseboard_board_id'));

      // Get pair code
      await ownerPage.locator('[data-testid="tab-settings"]').click();
      const pairCodeElement = ownerPage.locator(selectors.boardPairCode);
      await expect(pairCodeElement).toBeVisible();
      const fullText = await pairCodeElement.innerText();
      const pairCode = fullText.replace('Pair Code:', '').trim();

      // Visitor connects with view-only access
      const visitorContext = await browser.newContext();
      const visitorPage = await visitorContext.newPage();

      await visitorPage.goto('/');
      await visitorPage.locator('[data-testid="landing-code-input"]').fill(pairCode);
      await visitorPage.locator('[data-testid="landing-connect-btn"]').click();
      await expect(visitorPage).toHaveURL(/\/controller/);

      // REAL TEST: Try to update board settings via API with view-only token
      const response = await visitorPage.request.patch(`/api/boards/${boardId}`, {
        data: { time_mode: 'PM', time_mode_override_until: null }
      });

      // Should be rejected with 403 Forbidden
      expect(response.status()).toBe(403);

      await ownerContext.close();
      await visitorContext.close();
    });
  });

  test.describe('Edit users can edit but not admin', () => {
    test('allows edit user to add horses but not generate invites', async ({ browser }) => {
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

      // Generate invite code
      await ownerPage.locator('[data-testid="generate-invite-btn"]').click();
      const inviteCodeDisplay = ownerPage.locator('[data-testid="invite-code-display"]');
      await expect(inviteCodeDisplay).toBeVisible();
      const inviteCode = await ownerPage.locator('.settings-invite-code').innerText();

      // User connects as view-only then upgrades to edit
      const userContext = await browser.newContext();
      const userPage = await userContext.newPage();

      await userPage.goto('/');
      await userPage.locator('[data-testid="landing-code-input"]').fill(pairCode);
      await userPage.locator('[data-testid="landing-connect-btn"]').click();
      await expect(userPage).toHaveURL(/\/controller/);

      // Redeem invite to get edit access
      await userPage.locator('[data-testid="tab-settings"]').click();
      await userPage.locator(selectors.enterInviteBtn).click();
      await userPage.locator(selectors.inviteInput).fill(inviteCode);
      await userPage.locator(selectors.inviteSubmit).click();

      // Wait for reload
      await expect(userPage.locator(selectors.horsesTab)).toBeVisible({ timeout: 15000 });
      await userPage.locator('[data-testid="tab-horses"]').click();

      // BEHAVIOR: Edit user CAN add horses
      await expect(userPage.locator(selectors.addHorseBtn)).toBeVisible();
      await userPage.locator(selectors.addHorseBtn).click();
      await userPage.locator(selectors.newHorseName).fill('Edit User Horse');
      await userPage.locator(selectors.confirmAddHorse).click();
      await expect(userPage.locator('.horse-card').filter({ hasText: 'Edit User Horse' })).toBeVisible();

      // BEHAVIOR: Edit user CANNOT generate invites (admin only)
      await userPage.locator('[data-testid="tab-settings"]').click();
      await expect(userPage.locator('[data-testid="generate-invite-btn"]')).not.toBeVisible();

      // REAL TEST: Try to generate invite via API should fail
      const response = await userPage.request.post('/api/invites/generate');

      // Should be rejected with 403 Forbidden
      expect(response.status()).toBe(403);

      await ownerContext.close();
      await userContext.close();
    });
  });
});
