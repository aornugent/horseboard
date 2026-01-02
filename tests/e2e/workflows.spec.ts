import { test, expect } from '@playwright/test';
import { selectors, unitSelectors, timeModeSelectors } from './selectors';

/**
 * E2E Workflow Tests
 *
 * Tests complete user workflows with REAL behavior assertions.
 * Each test follows TDD principles: tests the feature, not implementation details.
 */

test.describe('End-to-End Workflows', () => {
  test.describe('Feed Management Workflow', () => {
    test('adds new feed and persists in database', async ({ page }) => {
      // Setup: Real user signup (creates board automatically)
      const timestamp = Date.now();
      await page.goto('/signup');
      await page.locator(selectors.nameInput).fill(`User ${timestamp}`);
      await page.locator(selectors.emailInput).fill(`user-${timestamp}@example.com`);
      await page.locator(selectors.passwordInput).fill('password123');
      await page.locator(selectors.submitBtn).click();

      await expect(page).toHaveURL(/\/controller/);

      // Navigate to feeds tab
      await page.locator('[data-testid="tab-feeds"]').click();
      await expect(page.locator(selectors.feedsTab)).toBeVisible();

      // Add feed
      await page.locator(selectors.addFeedBtn).click();
      const feedName = 'Oats';
      await page.locator(selectors.newFeedName).fill(feedName);
      await page.locator(unitSelectors.unitBtn('scoop')).click();
      await page.locator(selectors.confirmAddFeed).click();

      // REAL BEHAVIOR: Feed appears in list
      const feedCard = page.locator('.feed-card').filter({ hasText: feedName });
      await expect(feedCard).toBeVisible();

      // REAL BEHAVIOR: Feed persists after reload
      await page.reload();
      await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });
      await page.locator('[data-testid="tab-feeds"]').click();
      await expect(feedCard).toBeVisible();
    });

    test('filters feeds by search query', async ({ page }) => {
      // Setup: User with two feeds
      const timestamp = Date.now();
      await page.goto('/signup');
      await page.locator(selectors.nameInput).fill(`User ${timestamp}`);
      await page.locator(selectors.emailInput).fill(`user-${timestamp}@example.com`);
      await page.locator(selectors.passwordInput).fill('password123');
      await page.locator(selectors.submitBtn).click();
      await expect(page).toHaveURL(/\/controller/);

      await page.locator('[data-testid="tab-feeds"]').click();

      // Add two feeds with different names
      await page.locator(selectors.addFeedBtn).click();
      await page.locator(selectors.newFeedName).fill('Oats');
      await page.locator(unitSelectors.unitBtn('scoop')).click();
      await page.locator(selectors.confirmAddFeed).click();

      await page.locator(selectors.addFeedBtn).click();
      await page.locator(selectors.newFeedName).fill('Hay');
      await page.locator(unitSelectors.unitBtn('scoop')).click();
      await page.locator(selectors.confirmAddFeed).click();

      // Both feeds should be visible initially
      await expect(page.locator('.feed-card').filter({ hasText: 'Oats' })).toBeVisible();
      await expect(page.locator('.feed-card').filter({ hasText: 'Hay' })).toBeVisible();

      // REAL BEHAVIOR: Search filters list
      const searchInput = page.locator(selectors.feedSearch);
      await searchInput.fill('Oats');

      // Only Oats should be visible
      await expect(page.locator('.feed-card').filter({ hasText: 'Oats' })).toBeVisible();
      await expect(page.locator('.feed-card').filter({ hasText: 'Hay' })).not.toBeVisible();

      // Clear search - both should be visible again
      await searchInput.fill('');
      await expect(page.locator('.feed-card').filter({ hasText: 'Oats' })).toBeVisible();
      await expect(page.locator('.feed-card').filter({ hasText: 'Hay' })).toBeVisible();
    });
  });

  test.describe('Board Display Controls', () => {
    test('changes time mode and board display reflects it', async ({ page, browser }) => {
      // Setup: Owner with board
      const timestamp = Date.now();
      await page.goto('/signup');
      await page.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
      await page.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
      await page.locator(selectors.passwordInput).fill('password123');
      await page.locator(selectors.submitBtn).click();
      await expect(page).toHaveURL(/\/controller/);

      // Navigate to Board tab (where display controls are located per USER_PATHS.md)
      await page.locator('[data-testid="tab-board"]').click();
      await expect(page.locator(selectors.boardTab)).toBeVisible();

      // Open display controls drawer
      await page.locator('[data-testid="toggle-display-controls"]').click();
      await expect(page.locator('[data-testid="display-controls-drawer"]')).toBeVisible();

      // Change to PM mode
      await page.locator(timeModeSelectors.pm).click();

      // REAL BEHAVIOR: Change persists in database (verify by reload)
      await page.reload();
      await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });
      await page.locator('[data-testid="tab-board"]').click();
      await page.locator('[data-testid="toggle-display-controls"]').click();

      // PM button should still be selected (or effective mode shows PM)
      // Note: We can't easily check button state, but we can verify the mode persisted by checking actual board display
      const boardContext = await browser.newContext();
      const boardPage = await boardContext.newPage();

      const boardId = await page.evaluate(() => localStorage.getItem('horseboard_board_id'));
      await boardPage.addInitScript((id) => {
        localStorage.setItem('horseboard_board_id', id);
      }, boardId);

      await boardPage.goto('/board');
      await expect(boardPage.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

      // Board should display PM schedule (check for PM indicator)
      const timeModeIndicator = boardPage.locator('[data-testid="board-time-mode"]');
      await expect(timeModeIndicator).toContainText('PM');

      await boardContext.close();
    });

    test('changes timezone and persists in database', async ({ page, request }) => {
      // Setup: Owner with board
      const timestamp = Date.now();
      await page.goto('/signup');
      await page.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
      await page.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
      await page.locator(selectors.passwordInput).fill('password123');
      await page.locator(selectors.submitBtn).click();
      await expect(page).toHaveURL(/\/controller/);

      // Get board ID for API verification
      const boardId = await page.evaluate(() => localStorage.getItem('horseboard_board_id'));

      // Navigate to Settings tab (timezone is in Displays section per USER_PATHS.md)
      await page.locator('[data-testid="tab-settings"]').click();
      await expect(page.locator(selectors.settingsTab)).toBeVisible();

      const timezoneSelect = page.locator(selectors.timezoneSelector);
      await expect(timezoneSelect).toBeVisible();

      // Change timezone
      await timezoneSelect.selectOption('UTC');
      await expect(timezoneSelect).toHaveValue('UTC');

      // REAL BEHAVIOR: Verify change persisted by checking database via API
      const response = await request.get(`/api/boards/${boardId}`);
      expect(response.ok()).toBeTruthy();
      const board = await response.json();
      expect(board.timezone).toBe('UTC');

      // REAL BEHAVIOR: Verify persists after reload
      await page.reload();
      await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });
      await page.locator('[data-testid="tab-settings"]').click();
      await expect(page.locator(selectors.timezoneSelector)).toHaveValue('UTC');
    });
  });
});
