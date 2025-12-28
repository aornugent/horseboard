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
  // Setup: create a board by visiting /board first
  test.beforeEach(async ({ page }) => {
    // Visit /board to auto-create a board and store it in localStorage
    await page.goto('/board');
    await expect(page.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });
    // Now navigate to controller
    await page.goto('/controller');
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

    test('should show effective time mode', async ({ page }) => {
      const effectiveMode = page.locator(selectors.effectiveTimeMode);
      await expect(effectiveMode).toBeVisible();

      const text = await effectiveMode.textContent();
      expect(['AM', 'PM']).toContain(text?.trim());
    });

    test('should have time mode selector', async ({ page }) => {
      const selector = page.locator(selectors.timeModeSelector);
      await expect(selector).toBeVisible();
    });

    test('should show all time mode options', async ({ page }) => {
      await expect(page.locator(timeModeSelectors.auto)).toBeVisible();
      await expect(page.locator(timeModeSelectors.am)).toBeVisible();
      await expect(page.locator(timeModeSelectors.pm)).toBeVisible();
    });

    test('should have zoom level selector', async ({ page }) => {
      const selector = page.locator(selectors.zoomSelector);
      await expect(selector).toBeVisible();
    });

    test('should show all zoom levels', async ({ page }) => {
      await expect(page.locator(selectors.zoomLevel(1))).toBeVisible();
      await expect(page.locator(selectors.zoomLevel(2))).toBeVisible();
      await expect(page.locator(selectors.zoomLevel(3))).toBeVisible();
    });

    test('should have timezone selector', async ({ page }) => {
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
  });
});
