import { test, expect } from './fixtures/auth';
import { selectors, unitSelectors, timeModeSelectors } from './selectors';

/**
 * E2E Tests for Mobile Controller Views
 * 
 * Uses auth fixtures for efficient setup - board creation happens via API,
 * bypassing UI signup. Header injection grants Admin permissions.
 */

test.describe('Mobile Controller', () => {
  test.describe('Navigation', () => {
    test('has correct tabs for owner', async ({ ownerPage }) => {
      // Verify tabs that SHOULD exist
      await expect(ownerPage.locator('[data-testid="tab-horses"]')).toBeVisible();
      await expect(ownerPage.locator('[data-testid="tab-feeds"]')).toBeVisible();
      await expect(ownerPage.locator('[data-testid="tab-board"]')).toBeVisible();
      await expect(ownerPage.locator('[data-testid="tab-settings"]')).toBeVisible();

      // Verify Tokens tab does NOT exist
      await expect(ownerPage.locator('[data-testid="tab-tokens"]')).not.toBeVisible();
    });
  });

  // No beforeEach needed - Horses tab is the default view after fixture setup
  test.describe('HorsesTab', () => {
    test('should render the horses tab', async ({ ownerPage }) => {
      const horsesTab = ownerPage.locator(selectors.horsesTab);
      await expect(horsesTab).toBeVisible();
    });

    test('should have a search input', async ({ ownerPage }) => {
      const searchInput = ownerPage.locator(selectors.horseSearch);
      await expect(searchInput).toBeVisible();
    });

    test('should render horse list container', async ({ ownerPage }) => {
      const horseList = ownerPage.locator(selectors.horseList);
      await expect(horseList).toBeVisible();
    });

    test('should show empty state or horse cards', async ({ ownerPage }) => {
      const horseListEmpty = ownerPage.locator(selectors.horseListEmpty);
      const horseCards = ownerPage.locator('[data-testid^="horse-card-"]');

      const emptyVisible = await horseListEmpty.isVisible().catch(() => false);
      const cardCount = await horseCards.count();

      expect(emptyVisible || cardCount > 0).toBeTruthy();
    });
  });

  test.describe('FeedsTab', () => {
    test.beforeEach(async ({ ownerPage }) => {
      await ownerPage.locator('[data-testid="tab-feeds"]').click();
      await expect(ownerPage.locator(selectors.feedsTab)).toBeVisible();
    });

    test('should render feeds tab', async ({ ownerPage }) => {
      // Already checked in beforeEach, but explicit check doesn't hurt
      const feedsTab = ownerPage.locator(selectors.feedsTab);
      await expect(feedsTab).toBeVisible();
    });

    test('should have add feed button', async ({ ownerPage }) => {
      const addBtn = ownerPage.locator(selectors.addFeedBtn);
      await expect(addBtn).toBeVisible();
    });

    test('should have search input', async ({ ownerPage }) => {
      const searchInput = ownerPage.locator(selectors.feedSearch);
      await expect(searchInput).toBeVisible();
    });

    test('should open add feed modal', async ({ ownerPage }) => {
      const addBtn = ownerPage.locator(selectors.addFeedBtn);
      await addBtn.click();

      const modal = ownerPage.locator(selectors.addFeedModal);
      await expect(modal).toBeVisible();
    });

    test('add feed modal should have name input', async ({ ownerPage }) => {
      await ownerPage.locator(selectors.addFeedBtn).click();

      const nameInput = ownerPage.locator(selectors.newFeedName);
      await expect(nameInput).toBeVisible();
    });

    test('should show all unit options', async ({ ownerPage }) => {
      await ownerPage.locator(selectors.addFeedBtn).click();

      await expect(ownerPage.locator(unitSelectors.unitBtn('scoop'))).toBeVisible();
      await expect(ownerPage.locator(unitSelectors.unitBtn('ml'))).toBeVisible();
      await expect(ownerPage.locator(unitSelectors.unitBtn('sachet'))).toBeVisible();
      await expect(ownerPage.locator(unitSelectors.unitBtn('biscuit'))).toBeVisible();
    });

    test('should cancel adding feed', async ({ ownerPage }) => {
      await ownerPage.locator(selectors.addFeedBtn).click();

      const modal = ownerPage.locator(selectors.addFeedModal);
      await expect(modal).toBeVisible();

      await ownerPage.locator(selectors.cancelAddFeed).click();
      await expect(modal).not.toBeVisible();
    });

    test('add button should be disabled when name is empty', async ({ ownerPage }) => {
      await ownerPage.locator(selectors.addFeedBtn).click();

      const confirmBtn = ownerPage.locator(selectors.confirmAddFeed);
      await expect(confirmBtn).toBeDisabled();
    });

    test('should enable add button when name is provided', async ({ ownerPage }) => {
      await ownerPage.locator(selectors.addFeedBtn).click();

      const nameInput = ownerPage.locator(selectors.newFeedName);
      await nameInput.fill('Test Feed');

      const confirmBtn = ownerPage.locator(selectors.confirmAddFeed);
      await expect(confirmBtn).not.toBeDisabled();
    });
  });

  test.describe('SettingsTab', () => {
    test.beforeEach(async ({ ownerPage }) => {
      await ownerPage.locator('[data-testid="tab-settings"]').click();
      await expect(ownerPage.locator(selectors.settingsTab)).toBeVisible();
    });

    test('should render settings tab', async ({ ownerPage }) => {
      const settingsTab = ownerPage.locator(selectors.settingsTab);
      await expect(settingsTab).toBeVisible();
    });

    test('should have timezone selector', async ({ ownerPage }) => {
      const selector = ownerPage.locator(selectors.timezoneSelector);
      await expect(selector).toBeVisible();
    });

    test('should show board pair code', async ({ ownerPage }) => {
      const pairCode = ownerPage.locator(selectors.boardPairCode);
      await expect(pairCode).toBeVisible();
    });

    test('should show board ID', async ({ ownerPage }) => {
      const boardId = ownerPage.locator(selectors.boardId);
      await expect(boardId).toBeVisible();
    });

    test('should NOT show time mode selector (moved to Board tab)', async ({ ownerPage }) => {
      const selector = ownerPage.locator(selectors.timeModeSelector);
      await expect(selector).not.toBeVisible();
    });

    test('should NOT show zoom selector (moved to Board tab)', async ({ ownerPage }) => {
      const selector = ownerPage.locator(selectors.zoomSelector);
      await expect(selector).not.toBeVisible();
    });
  });

  test.describe('BoardTab', () => {
    test.beforeEach(async ({ ownerPage }) => {
      await ownerPage.locator('[data-testid="tab-board"]').click();
      await expect(ownerPage.locator(selectors.boardTab)).toBeVisible();
    });

    test('should render board tab', async ({ ownerPage }) => {
      const boardTab = ownerPage.locator(selectors.boardTab);
      await expect(boardTab).toBeVisible();
    });

    test('should show read-only grid preview', async ({ ownerPage }) => {
      const grid = ownerPage.locator(selectors.swimLaneGrid);
      await expect(grid).toBeVisible();
    });

    test('should show pagination controls', async ({ ownerPage }) => {
      await expect(ownerPage.locator('[data-testid="prev-page-btn"]')).toBeVisible();
      await expect(ownerPage.locator('[data-testid="next-page-btn"]')).toBeVisible();
    });

    test('should show display controls toggle for admin users', async ({ ownerPage }) => {
      const toggleBtn = ownerPage.locator('[data-testid="toggle-display-controls"]');
      await expect(toggleBtn).toBeVisible();
    });

    test('should show/hide display controls drawer when toggled', async ({ ownerPage }) => {
      const toggleBtn = ownerPage.locator('[data-testid="toggle-display-controls"]');
      const drawer = ownerPage.locator('[data-testid="display-controls-drawer"]');

      await expect(drawer).not.toBeVisible();
      await toggleBtn.click();
      await expect(drawer).toBeVisible();
      await toggleBtn.click();
      await expect(drawer).not.toBeVisible();
    });

    test('should have time mode selector in display controls', async ({ ownerPage }) => {
      await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
      await expect(ownerPage.locator('[data-testid="display-controls-drawer"]')).toBeVisible();

      const selector = ownerPage.locator(selectors.timeModeSelector);
      await expect(selector).toBeVisible();

      await expect(ownerPage.locator(timeModeSelectors.auto)).toBeVisible();
      await expect(ownerPage.locator(timeModeSelectors.am)).toBeVisible();
      await expect(ownerPage.locator(timeModeSelectors.pm)).toBeVisible();
    });

    test('should have zoom level selector in display controls', async ({ ownerPage }) => {
      await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
      await expect(ownerPage.locator('[data-testid="display-controls-drawer"]')).toBeVisible();

      const selector = ownerPage.locator(selectors.zoomSelector);
      await expect(selector).toBeVisible();

      await expect(ownerPage.locator(selectors.zoomLevel(1))).toBeVisible();
      await expect(ownerPage.locator(selectors.zoomLevel(2))).toBeVisible();
      await expect(ownerPage.locator(selectors.zoomLevel(3))).toBeVisible();
    });
  });
});
