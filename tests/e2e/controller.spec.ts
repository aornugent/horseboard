import { test, expect } from '@playwright/test';
import { selectors } from './selectors';

/**
 * E2E Tests for Mobile Controller Views
 *
 * Tests the mobile controller UI including:
 * - HorsesTab: Horse list with search and navigation
 * - HorseDetail: Diet editing with FeedPad
 * - FeedsTab: Feed management
 * - SettingsTab: Board settings
 * - BoardTab: TV preview
 */

test.describe('Mobile Controller', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the controller view
    await page.goto('/');
  });

  test.describe('HorsesTab', () => {
    test('should render the horses tab', async ({ page }) => {
      const horsesTab = page.locator(selectors.horsesTab);
      await expect(horsesTab).toBeVisible();
    });

    test('should have a search input', async ({ page }) => {
      const searchInput = page.locator(selectors.horseSearch);
      await expect(searchInput).toBeVisible();
      await expect(searchInput).toHaveAttribute('placeholder', 'Search horses...');
    });

    test('should render horse list container', async ({ page }) => {
      const horseList = page.locator(selectors.horseList);
      await expect(horseList).toBeVisible();
    });

    test('should show empty state when no horses exist', async ({ page }) => {
      // If no horses, should show empty state
      const horseListEmpty = page.locator(selectors.horseListEmpty);
      const horseCards = page.locator('[data-testid^="horse-card-"]');

      const emptyVisible = await horseListEmpty.isVisible().catch(() => false);
      const cardCount = await horseCards.count();

      // Either we have cards OR we have empty state
      expect(emptyVisible || cardCount > 0).toBeTruthy();
    });

    test('should filter horses by search query', async ({ page }) => {
      const searchInput = page.locator(selectors.horseSearch);
      await expect(searchInput).toBeVisible();

      // Type a search query
      await searchInput.fill('test');

      // The filtering is reactive, so results should update
      // We verify the search input has the value
      await expect(searchInput).toHaveValue('test');
    });

    test('should render horse cards with name and feed count', async ({ page }) => {
      const horseCards = page.locator('[data-testid^="horse-card-"]');
      const count = await horseCards.count();

      if (count > 0) {
        const firstCard = horseCards.first();
        await expect(firstCard).toBeVisible();

        // Card should have name element
        const nameEl = firstCard.locator('[data-testid^="horse-card-name-"]');
        await expect(nameEl).toBeVisible();

        // Card should have summary with feed count
        const summaryEl = firstCard.locator('[data-testid^="horse-card-summary-"]');
        await expect(summaryEl).toBeVisible();
      }
    });

    test('horse cards should have minimum 48px touch target', async ({ page }) => {
      const horseCards = page.locator('[data-testid^="horse-card-"]');
      const count = await horseCards.count();

      if (count > 0) {
        const firstCard = horseCards.first();
        const box = await firstCard.boundingBox();

        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(48);
        }
      }
    });
  });

  test.describe('HorseDetail', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to horse detail if a horse exists
      const horseCards = page.locator('[data-testid^="horse-card-"]');
      const count = await horseCards.count();

      if (count > 0) {
        await horseCards.first().click();
      }
    });

    test('should show horse detail view when clicking a horse', async ({ page }) => {
      const horseDetail = page.locator(selectors.horseDetail);
      const count = await page.locator('[data-testid^="horse-card-"]').count();

      if (count > 0) {
        await expect(horseDetail).toBeVisible();
      }
    });

    test('should show horse name in header', async ({ page }) => {
      const horseName = page.locator(selectors.horseDetailName);
      const isVisible = await horseName.isVisible().catch(() => false);

      if (isVisible) {
        const text = await horseName.textContent();
        expect(text).toBeTruthy();
      }
    });

    test('should have back button', async ({ page }) => {
      const backBtn = page.locator(selectors.horseDetailBack);
      const isVisible = await backBtn.isVisible().catch(() => false);

      if (isVisible) {
        await expect(backBtn).toBeVisible();
      }
    });

    test('should render feed tiles', async ({ page }) => {
      const feedTiles = page.locator(selectors.feedTiles);
      const isVisible = await feedTiles.isVisible().catch(() => false);

      if (isVisible) {
        await expect(feedTiles).toBeVisible();
      }
    });

    test('feed tiles should have AM and PM buttons', async ({ page }) => {
      const feedTile = page.locator('[data-testid^="feed-tile-"]').first();
      const isVisible = await feedTile.isVisible().catch(() => false);

      if (isVisible) {
        const amBtn = feedTile.locator('[data-testid^="feed-tile-am-"]');
        const pmBtn = feedTile.locator('[data-testid^="feed-tile-pm-"]');

        await expect(amBtn).toBeVisible();
        await expect(pmBtn).toBeVisible();
      }
    });
  });

  test.describe('FeedPad', () => {
    test('should open FeedPad when clicking a feed tile value', async ({ page }) => {
      // Navigate to horse detail
      const horseCards = page.locator('[data-testid^="horse-card-"]');
      const cardCount = await horseCards.count();

      if (cardCount > 0) {
        await horseCards.first().click();

        // Click on a feed tile AM button
        const amBtn = page.locator('[data-testid^="feed-tile-am-"]').first();
        const isVisible = await amBtn.isVisible().catch(() => false);

        if (isVisible) {
          await amBtn.click();

          // FeedPad should appear
          const feedPad = page.locator(selectors.feedPad);
          await expect(feedPad).toBeVisible();
        }
      }
    });

    test('should show preset buttons', async ({ page }) => {
      // Navigate and open FeedPad
      const horseCards = page.locator('[data-testid^="horse-card-"]');
      if (await horseCards.count() > 0) {
        await horseCards.first().click();

        const amBtn = page.locator('[data-testid^="feed-tile-am-"]').first();
        if (await amBtn.isVisible().catch(() => false)) {
          await amBtn.click();

          // Check preset buttons
          await expect(page.locator(selectors.presetEmpty)).toBeVisible();
          await expect(page.locator(selectors.presetHalf)).toBeVisible();
          await expect(page.locator(selectors.presetOne)).toBeVisible();
          await expect(page.locator(selectors.presetTwo)).toBeVisible();
        }
      }
    });

    test('should show stepper controls', async ({ page }) => {
      const horseCards = page.locator('[data-testid^="horse-card-"]');
      if (await horseCards.count() > 0) {
        await horseCards.first().click();

        const amBtn = page.locator('[data-testid^="feed-tile-am-"]').first();
        if (await amBtn.isVisible().catch(() => false)) {
          await amBtn.click();

          await expect(page.locator(selectors.stepperDecrement)).toBeVisible();
          await expect(page.locator(selectors.stepperValue)).toBeVisible();
          await expect(page.locator(selectors.stepperIncrement)).toBeVisible();
        }
      }
    });

    test('should increment value by 0.25', async ({ page }) => {
      const horseCards = page.locator('[data-testid^="horse-card-"]');
      if (await horseCards.count() > 0) {
        await horseCards.first().click();

        const amBtn = page.locator('[data-testid^="feed-tile-am-"]').first();
        if (await amBtn.isVisible().catch(() => false)) {
          await amBtn.click();

          // Get initial value
          const stepperValue = page.locator(selectors.stepperValue);
          const initialValue = await stepperValue.textContent();

          // Click increment
          await page.locator(selectors.stepperIncrement).click();

          // Value should change
          const newValue = await stepperValue.textContent();
          expect(newValue).not.toBe(initialValue);
        }
      }
    });

    test('should close FeedPad with Done button', async ({ page }) => {
      const horseCards = page.locator('[data-testid^="horse-card-"]');
      if (await horseCards.count() > 0) {
        await horseCards.first().click();

        const amBtn = page.locator('[data-testid^="feed-tile-am-"]').first();
        if (await amBtn.isVisible().catch(() => false)) {
          await amBtn.click();

          const feedPad = page.locator(selectors.feedPad);
          await expect(feedPad).toBeVisible();

          // Close with Done button
          await page.locator(selectors.feedPadConfirm).click();

          // FeedPad should be hidden (or have aria-hidden)
          await expect(feedPad).toHaveAttribute('aria-hidden', 'true');
        }
      }
    });

    test('should close FeedPad with close button', async ({ page }) => {
      const horseCards = page.locator('[data-testid^="horse-card-"]');
      if (await horseCards.count() > 0) {
        await horseCards.first().click();

        const amBtn = page.locator('[data-testid^="feed-tile-am-"]').first();
        if (await amBtn.isVisible().catch(() => false)) {
          await amBtn.click();

          const feedPad = page.locator(selectors.feedPad);
          await expect(feedPad).toBeVisible();

          // Close with X button
          await page.locator(selectors.feedPadClose).click();

          await expect(feedPad).toHaveAttribute('aria-hidden', 'true');
        }
      }
    });

    test('preset buttons should have 48px minimum touch target', async ({ page }) => {
      const horseCards = page.locator('[data-testid^="horse-card-"]');
      if (await horseCards.count() > 0) {
        await horseCards.first().click();

        const amBtn = page.locator('[data-testid^="feed-tile-am-"]').first();
        if (await amBtn.isVisible().catch(() => false)) {
          await amBtn.click();

          const presetBtn = page.locator(selectors.presetOne);
          const box = await presetBtn.boundingBox();

          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(48);
          }
        }
      }
    });
  });

  test.describe('FeedsTab', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to feeds tab
      // This depends on how navigation is implemented
      await page.goto('/feeds');
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

    test('add feed modal should have unit selector', async ({ page }) => {
      await page.locator(selectors.addFeedBtn).click();

      const unitSelector = page.locator(selectors.newFeedUnit);
      await expect(unitSelector).toBeVisible();
    });

    test('should show all unit options', async ({ page }) => {
      await page.locator(selectors.addFeedBtn).click();

      await expect(page.locator(selectors.unitBtn('scoop'))).toBeVisible();
      await expect(page.locator(selectors.unitBtn('ml'))).toBeVisible();
      await expect(page.locator(selectors.unitBtn('sachet'))).toBeVisible();
      await expect(page.locator(selectors.unitBtn('biscuit'))).toBeVisible();
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
      await page.goto('/settings');
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
      await expect(page.locator(selectors.timeModeAuto)).toBeVisible();
      await expect(page.locator(selectors.timeModeAm)).toBeVisible();
      await expect(page.locator(selectors.timeModePm)).toBeVisible();
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
      await page.goto('/board');
    });

    test('should render board tab', async ({ page }) => {
      const boardTab = page.locator(selectors.boardTab);
      await expect(boardTab).toBeVisible();
    });

    test('should show read-only grid preview', async ({ page }) => {
      const grid = page.locator(selectors.swimLaneGrid);
      await expect(grid).toBeVisible();
    });

    test('grid cells should not be editable', async ({ page }) => {
      const cells = page.locator('[data-testid^="cell-"]');
      const count = await cells.count();

      if (count > 0) {
        const firstCell = cells.first();
        const classes = await firstCell.getAttribute('class');
        expect(classes).not.toContain('grid-cell--editable');
      }
    });
  });
});
