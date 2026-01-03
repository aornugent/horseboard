import { test, expect } from './fixtures/auth';
import { selectors, unitSelectors, timeModeSelectors } from './selectors';

/**
 * E2E Workflow Tests
 * 
 * Tests complete user workflows with REAL behavior assertions.
 * Uses auth fixtures for efficient setup.
 */

test.describe('End-to-End Workflows', () => {
  test.describe('Feed Management Workflow', () => {
    test.beforeEach(async ({ ownerPage }) => {
      // Ensure we are on the feeds tab
      await ownerPage.locator('[data-testid="tab-feeds"]').click();
      await expect(ownerPage.locator(selectors.feedsTab)).toBeVisible();
    });

    test('adds new feed and persists in database', async ({ ownerPage }) => {
      // Add feed
      await ownerPage.locator(selectors.addFeedBtn).click();
      const feedName = 'Oats';
      await ownerPage.locator(selectors.newFeedName).fill(feedName);
      await ownerPage.locator(unitSelectors.unitBtn('scoop')).click();
      await ownerPage.locator(selectors.confirmAddFeed).click();

      // REAL BEHAVIOR: Feed appears in list
      const feedCard = ownerPage.locator('.feed-card').filter({ hasText: feedName });
      await expect(feedCard).toBeVisible();

      // REAL BEHAVIOR: Feed persists after reload
      await ownerPage.reload();
      await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });
      await ownerPage.locator('[data-testid="tab-feeds"]').click();
      await expect(feedCard).toBeVisible();
    });

    test('filters feeds by search query', async ({ ownerPage }) => {
      // Add two feeds with different names
      await ownerPage.locator(selectors.addFeedBtn).click();
      await ownerPage.locator(selectors.newFeedName).fill('Oats');
      await ownerPage.locator(unitSelectors.unitBtn('scoop')).click();
      await ownerPage.locator(selectors.confirmAddFeed).click();

      await ownerPage.locator(selectors.addFeedBtn).click();
      await ownerPage.locator(selectors.newFeedName).fill('Hay');
      await ownerPage.locator(unitSelectors.unitBtn('scoop')).click();
      await ownerPage.locator(selectors.confirmAddFeed).click();

      // Both feeds should be visible initially
      await expect(ownerPage.locator('.feed-card').filter({ hasText: 'Oats' })).toBeVisible();
      await expect(ownerPage.locator('.feed-card').filter({ hasText: 'Hay' })).toBeVisible();

      // REAL BEHAVIOR: Search filters list
      const searchInput = ownerPage.locator(selectors.feedSearch);
      await searchInput.fill('Oats');

      // Only Oats should be visible
      await expect(ownerPage.locator('.feed-card').filter({ hasText: 'Oats' })).toBeVisible();
      await expect(ownerPage.locator('.feed-card').filter({ hasText: 'Hay' })).not.toBeVisible();

      // Clear search - both should be visible again
      await searchInput.fill('');
      await expect(ownerPage.locator('.feed-card').filter({ hasText: 'Oats' })).toBeVisible();
      await expect(ownerPage.locator('.feed-card').filter({ hasText: 'Hay' })).toBeVisible();
    });
  });

  test.describe('Board Display Controls', () => {
    test.beforeEach(async ({ ownerPage }) => {
      // Navigate to Board tab (where display controls are located per USER_PATHS.md)
      await ownerPage.locator('[data-testid="tab-board"]').click();
      await expect(ownerPage.locator(selectors.boardTab)).toBeVisible();
    });

    test('changes time mode and board display reflects it', async ({ ownerPage, ownerBoardId, browser }) => {
      // Open display controls drawer
      await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
      await expect(ownerPage.locator('[data-testid="display-controls-drawer"]')).toBeVisible();

      // Change to PM mode
      await ownerPage.locator(timeModeSelectors.pm).click();

      // REAL BEHAVIOR: Change persists in database (verify by reload)
      await ownerPage.reload();
      await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

      // Navigate back to board tab to access display controls
      await ownerPage.locator('[data-testid="tab-board"]').click();
      await ownerPage.locator('[data-testid="toggle-display-controls"]').click();

      // PM button should still be selected (or effective mode shows PM)
      // Note: We can't easily check button state, but we can verify the mode persisted by checking actual board display
      const boardContext = await browser.newContext();
      const boardPage = await boardContext.newPage();

      // Inject board ID into valid board page
      await boardPage.addInitScript((id) => {
        localStorage.setItem('horseboard_board_id', id);
      }, ownerBoardId);

      await boardPage.goto('/board');
      await expect(boardPage.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

      // Board should display PM schedule (check for PM indicator)
      const timeModeIndicator = boardPage.locator(selectors.timeModeBadge);
      await expect(timeModeIndicator).toContainText('PM');

      await boardContext.close();
    });

    test('changes timezone and persists in database', async ({ ownerPage, ownerBoardId, request }) => {
      // Navigate to Settings tab (timezone is in Displays section per USER_PATHS.md)
      await ownerPage.locator('[data-testid="tab-settings"]').click();
      await expect(ownerPage.locator(selectors.settingsTab)).toBeVisible();

      const timezoneSelect = ownerPage.locator(selectors.timezoneSelector);
      await expect(timezoneSelect).toBeVisible();

      // Change timezone
      await timezoneSelect.selectOption('UTC');
      await expect(timezoneSelect).toHaveValue('UTC');

      // REAL BEHAVIOR: Verify change persisted by checking database via API
      // Use x-test-user-id to ensure we have permission to view board details via API
      const response = await request.get(`/api/boards/${ownerBoardId}`, {
        headers: { 'x-test-user-id': 'e2e-test-user' }
      });
      expect(response.ok()).toBeTruthy();
      const board = await response.json();
      expect(board.data.timezone).toBe('UTC'); // response struct is { success: true, data: { ... } }

      // REAL BEHAVIOR: Verify persists after reload
      await ownerPage.reload();
      await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });
      await ownerPage.locator('[data-testid="tab-settings"]').click();
      await expect(ownerPage.locator(selectors.timezoneSelector)).toHaveValue('UTC');
    });
  });
});
