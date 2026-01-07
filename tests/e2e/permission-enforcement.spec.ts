import { testWithVisitor as test, expect } from './fixtures/auth';
import { selectors } from './selectors';
import { createHorse } from './helpers/api';

/**
 * Permission Enforcement Tests
 *
 * Verifies server-side permission enforcement.
 * Users with 'view' permission should get 403 on mutative actions.
 */
test.describe('Permission Enforcement', () => {

  test.describe('View-only users cannot edit', () => {
    test('rejects API calls to add horse from view-only token', async ({ visitorPage, ownerBoardId, request }) => {
      // Get visitor token from localStorage
      const token = await visitorPage.evaluate(() => localStorage.getItem('hb_token'));
      expect(token).toBeTruthy();

      const response = await request.post(`/api/boards/${ownerBoardId}/horses`, {
        data: { name: 'Hacked Horse' },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response.status()).toBe(403);
    });

    test('rejects API calls to delete horse from view-only token', async ({ ownerPage, visitorPage, request }) => {
      // Owner adds a horse via API (since ownerPage needs reload to see it) 
      // Actually ownerPage fixture helps us get authenticated, but doesn't necessarily auto-refresh.
      // We can use helpers.
      const ownerBoardId = await ownerPage.evaluate(() => localStorage.getItem('hb_board_id'));

      const horse = await createHorse(request, ownerBoardId!, { name: 'Test Horse' });
      await ownerPage.reload();
      await expect(ownerPage.locator(selectors.horseCard(horse.id))).toBeVisible();

      // Get visitor token
      const token = await visitorPage.evaluate(() => localStorage.getItem('hb_token'));

      // Visitor tries to delete it
      const response = await request.delete(`/api/horses/${horse.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response.status()).toBe(403);
      await expect(ownerPage.locator(selectors.horseCard(horse.id))).toBeVisible();
    });

    test('rejects API calls to update board settings from view-only token', async ({ visitorPage, ownerBoardId, request }) => {
      const token = await visitorPage.evaluate(() => localStorage.getItem('hb_token'));

      const response = await request.patch(`/api/boards/${ownerBoardId}`, {
        data: { time_mode: 'PM' },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response.status()).toBe(403);
    });
  });

  test.describe('Edit users can edit but not admin', () => {
    test('allows edit user to add horses but not generate invites', async ({ ownerPage, visitorPage, ownerBoardId, request }) => {
      // 1. Owner generates invite
      await ownerPage.locator(selectors.tabSettings).click();
      await ownerPage.locator(selectors.generateInviteBtn).click();
      await expect(ownerPage.locator('[data-testid="invite-code-display"]')).toBeVisible();
      const inviteCode = await ownerPage.locator('.settings-invite-code').innerText();

      // 2. Visitor redeems invite to upgrade
      await visitorPage.locator(selectors.tabSettings).click();
      await visitorPage.locator(selectors.enterInviteBtn).click();
      await visitorPage.locator(selectors.inviteInput).fill(inviteCode);
      await visitorPage.locator(selectors.inviteSubmit).click();

      // Wait for reload/upgrade
      await expect(visitorPage.locator(selectors.horsesTab)).toBeVisible();
      await visitorPage.locator(selectors.tabHorses).click();

      // 3. Edit User CAN add horse via UI
      await visitorPage.locator(selectors.addHorseBtn).click();
      await visitorPage.locator(selectors.newHorseName).fill('Edit User Horse');
      await visitorPage.locator(selectors.confirmAddHorse).click();
      await expect(visitorPage.locator('.list-card').filter({ hasText: 'Edit User Horse' })).toBeVisible();

      // 4. Edit User CANNOT generate invite (Admin only)
      await visitorPage.locator(selectors.tabSettings).click();
      await expect(visitorPage.locator(selectors.generateInviteBtn)).not.toBeVisible();

      // 5. API Check: Generate invite should fail
      const token = await visitorPage.evaluate(() => localStorage.getItem('hb_token'));
      const response = await request.post(`/api/boards/${ownerBoardId}/invites`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      expect(response.status()).toBe(403);
    });
  });
  test.describe('UI visibility based on permission', () => {
    test('view-only user does not see add buttons', async ({ visitorPage }) => {
      // Verify Add Horse button is NOT visible (Horses tab is default)
      await expect(visitorPage.locator(selectors.addHorseBtn)).not.toBeVisible();

      // Navigate to Feeds tab and verify Add Feed is also hidden
      await visitorPage.locator('[data-testid="tab-feeds"]').click();
      await expect(visitorPage.locator(selectors.feedsTab)).toBeVisible();
      await expect(visitorPage.locator(selectors.addFeedBtn)).not.toBeVisible();
    });

    test('view-only user does not see admin-only settings sections', async ({ visitorPage }) => {
      await visitorPage.locator(selectors.tabSettings).click();
      await expect(visitorPage.locator(selectors.settingsTab)).toBeVisible();

      // Displays section should be hidden (admin only)
      await expect(visitorPage.getByRole('heading', { name: 'Displays' })).not.toBeVisible();

      // Staff Access section should be hidden (admin only)  
      await expect(visitorPage.getByRole('heading', { name: 'Staff Access' })).not.toBeVisible();

      // Upgrade Access section SHOULD be visible (for view-only users to upgrade)
      await expect(visitorPage.getByRole('heading', { name: 'Upgrade Access' })).toBeVisible();
    });

    test('view-only user sees pagination controls on Board tab', async ({ ownerBoardId, request, visitorPage }) => {
      // Need some data for pagination to make sense
      const { createHorse, createFeed, upsertDiet } = await import('./helpers/api');
      await createHorse(request, ownerBoardId, { name: 'Test' });
      const feed = await createFeed(request, ownerBoardId, { name: 'Oats', unit_type: 'fraction', unit_label: 'scoop' });

      // Reload visitor to get the data
      await visitorPage.reload();
      await expect(visitorPage.locator('[data-testid="controller-view"]')).toBeVisible();

      // Navigate to Board tab (remote control)
      await visitorPage.locator('[data-testid="tab-board"]').click();

      // Pagination controls should be visible
      await expect(visitorPage.locator('[data-testid="prev-page-btn"]')).toBeVisible();
      await expect(visitorPage.locator('[data-testid="next-page-btn"]')).toBeVisible();
    });
  });
});
