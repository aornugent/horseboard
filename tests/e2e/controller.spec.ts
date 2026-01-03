import { test, expect } from '@playwright/test';
import { selectors, unitSelectors, timeModeSelectors } from './selectors';

/**
 * E2E Tests for Mobile Controller Views
 *
 * Tests the mobile controller UI including:
 * - HorsesTab: Horse list with search and navigation
 * - FeedsTab: Feed management
 * - SettingsTab: Board settings
 * - BoardTab: TV preview
 *
 * Note: The controller requires a board to be created first.
 * We visit /board first to auto-create a board, then test the controller.
 */

test.describe('Mobile Controller', () => {
  test.describe('Navigation', () => {
    test('has correct tabs after signup', async ({ page }) => {
      // Test via REAL signup flow, not API injection
      const timestamp = Date.now();
      await page.goto('/signup');
      await page.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
      await page.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
      await page.locator(selectors.passwordInput).fill('password123');
      await page.locator(selectors.submitBtn).click();

      await expect(page).toHaveURL(/\/controller/);
      await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

      // Verify tabs that SHOULD exist
      await expect(page.locator('[data-testid="tab-horses"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-feeds"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-board"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-settings"]')).toBeVisible();

      // Verify Tokens tab does NOT exist (consolidated into Settings per USER_PATHS.md)
      await expect(page.locator('[data-testid="tab-tokens"]')).not.toBeVisible();
    });
  });

  // Setup: Use REAL signup flow, not API injection
  test.beforeEach(async ({ page }) => {
    const timestamp = Date.now();
    await page.goto('/signup');
    await page.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
    await page.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
    await page.locator(selectors.passwordInput).fill('password123');
    await page.locator(selectors.submitBtn).click();

    await expect(page).toHaveURL(/\/controller/);
    await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });
  });

  test.describe('HorsesTab', () => {
    test('should render the horses tab', async ({ page }) => {
      const horsesTab = page.locator(selectors.horsesTab);
      await expect(horsesTab).toBeVisible();
    });

    test('should have a search input', async ({ page }) => {
      const searchInput = page.locator(selectors.horseSearch);
      await expect(searchInput).toBeVisible();
    });

    test('should render horse list container', async ({ page }) => {
      const horseList = page.locator(selectors.horseList);
      await expect(horseList).toBeVisible();
    });

    test('should show empty state or horse cards', async ({ page }) => {
      const horseListEmpty = page.locator(selectors.horseListEmpty);
      const horseCards = page.locator('[data-testid^="horse-card-"]');

      const emptyVisible = await horseListEmpty.isVisible().catch(() => false);
      const cardCount = await horseCards.count();

      // Either we have cards OR we have empty state
      expect(emptyVisible || cardCount > 0).toBeTruthy();
    });
  });

  test.describe('FeedsTab', () => {
    test.beforeEach(async ({ page }) => {
      // Click on Feeds tab
      await page.locator('[data-testid="tab-feeds"]').click();
      await expect(page.locator(selectors.feedsTab)).toBeVisible();
    });

    test('should render feeds tab', async ({ page }) => {
      const feedsTab = page.locator(selectors.feedsTab);
      await expect(feedsTab).toBeVisible();
    });

    test('should have add feed button', async ({ page }) => {
      const addBtn = page.locator(selectors.addFeedBtn);
      await expect(addBtn).toBeVisible();
    });

    test('should have search input', async ({ page }) => {
      const searchInput = page.locator(selectors.feedSearch);
      await expect(searchInput).toBeVisible();
    });

    test('should open add feed modal', async ({ page }) => {
      const addBtn = page.locator(selectors.addFeedBtn);
      await addBtn.click();

      const modal = page.locator(selectors.addFeedModal);
      await expect(modal).toBeVisible();
    });

    test('add feed modal should have name input', async ({ page }) => {
      await page.locator(selectors.addFeedBtn).click();

      const nameInput = page.locator(selectors.newFeedName);
      await expect(nameInput).toBeVisible();
    });

    test('should show all unit options', async ({ page }) => {
      await page.locator(selectors.addFeedBtn).click();

      await expect(page.locator(unitSelectors.unitBtn('scoop'))).toBeVisible();
      await expect(page.locator(unitSelectors.unitBtn('ml'))).toBeVisible();
      await expect(page.locator(unitSelectors.unitBtn('sachet'))).toBeVisible();
      await expect(page.locator(unitSelectors.unitBtn('biscuit'))).toBeVisible();
    });

    test('should cancel adding feed', async ({ page }) => {
      await page.locator(selectors.addFeedBtn).click();

      const modal = page.locator(selectors.addFeedModal);
      await expect(modal).toBeVisible();

      await page.locator(selectors.cancelAddFeed).click();
      await expect(modal).not.toBeVisible();
    });

    test('add button should be disabled when name is empty', async ({ page }) => {
      await page.locator(selectors.addFeedBtn).click();

      const confirmBtn = page.locator(selectors.confirmAddFeed);
      await expect(confirmBtn).toBeDisabled();
    });

    test('should enable add button when name is provided', async ({ page }) => {
      await page.locator(selectors.addFeedBtn).click();

      const nameInput = page.locator(selectors.newFeedName);
      await nameInput.fill('Test Feed');

      const confirmBtn = page.locator(selectors.confirmAddFeed);
      await expect(confirmBtn).not.toBeDisabled();
    });
  });

  test.describe('SettingsTab', () => {
    test.beforeEach(async ({ page }) => {
      // Click on Settings tab
      await page.locator('[data-testid="tab-settings"]').click();
      await expect(page.locator(selectors.settingsTab)).toBeVisible();
    });

    test('should render settings tab', async ({ page }) => {
      const settingsTab = page.locator(selectors.settingsTab);
      await expect(settingsTab).toBeVisible();
    });

    test('should have timezone selector (moved from Board tab)', async ({ page }) => {
      const selector = page.locator(selectors.timezoneSelector);
      await expect(selector).toBeVisible();
    });

    test('should show board pair code', async ({ page }) => {
      const pairCode = page.locator(selectors.boardPairCode);
      await expect(pairCode).toBeVisible();
    });

    test('should show board ID', async ({ page }) => {
      const boardId = page.locator(selectors.boardId);
      await expect(boardId).toBeVisible();
    });

    test('should NOT show time mode selector (moved to Board tab)', async ({ page }) => {
      const selector = page.locator(selectors.timeModeSelector);
      await expect(selector).not.toBeVisible();
    });

    test('should NOT show zoom selector (moved to Board tab)', async ({ page }) => {
      const selector = page.locator(selectors.zoomSelector);
      await expect(selector).not.toBeVisible();
    });
  });

  test.describe('BoardTab', () => {
    test.beforeEach(async ({ page }) => {
      // Click on Board tab
      await page.locator('[data-testid="tab-board"]').click();
      await expect(page.locator(selectors.boardTab)).toBeVisible();
    });

    test('should render board tab', async ({ page }) => {
      const boardTab = page.locator(selectors.boardTab);
      await expect(boardTab).toBeVisible();
    });

    test('should show read-only grid preview', async ({ page }) => {
      const grid = page.locator(selectors.swimLaneGrid);
      await expect(grid).toBeVisible();
    });

    test('should show pagination controls', async ({ page }) => {
      await expect(page.locator('[data-testid="prev-page-btn"]')).toBeVisible();
      await expect(page.locator('[data-testid="next-page-btn"]')).toBeVisible();
    });

    test('should show display controls toggle for admin users', async ({ page }) => {
      const toggleBtn = page.locator('[data-testid="toggle-display-controls"]');
      await expect(toggleBtn).toBeVisible();
    });

    test('should show/hide display controls drawer when toggled', async ({ page }) => {
      const toggleBtn = page.locator('[data-testid="toggle-display-controls"]');
      const drawer = page.locator('[data-testid="display-controls-drawer"]');

      // Initially hidden
      await expect(drawer).not.toBeVisible();

      // Click to show
      await toggleBtn.click();
      await expect(drawer).toBeVisible();

      // Click to hide
      await toggleBtn.click();
      await expect(drawer).not.toBeVisible();
    });

    test('should have time mode selector in display controls', async ({ page }) => {
      // Open display controls
      await page.locator('[data-testid="toggle-display-controls"]').click();
      await expect(page.locator('[data-testid="display-controls-drawer"]')).toBeVisible();

      // Check for time mode selector
      const selector = page.locator(selectors.timeModeSelector);
      await expect(selector).toBeVisible();

      // Check all time mode options
      await expect(page.locator(timeModeSelectors.auto)).toBeVisible();
      await expect(page.locator(timeModeSelectors.am)).toBeVisible();
      await expect(page.locator(timeModeSelectors.pm)).toBeVisible();
    });

    test('should have zoom level selector in display controls', async ({ page }) => {
      // Open display controls
      await page.locator('[data-testid="toggle-display-controls"]').click();
      await expect(page.locator('[data-testid="display-controls-drawer"]')).toBeVisible();

      // Check for zoom selector
      const selector = page.locator(selectors.zoomSelector);
      await expect(selector).toBeVisible();

      // Check all zoom levels
      await expect(page.locator(selectors.zoomLevel(1))).toBeVisible();
      await expect(page.locator(selectors.zoomLevel(2))).toBeVisible();
      await expect(page.locator(selectors.zoomLevel(3))).toBeVisible();
    });
  });
});
