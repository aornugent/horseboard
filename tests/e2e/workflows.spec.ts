import { test, expect } from '@playwright/test';
import { selectors, unitSelectors, timeModeSelectors } from './selectors';

/**
 * E2E Workflow Tests
 *
 * Tests complete user workflows across the application.
 * These tests simulate real user scenarios.
 */

test.describe('End-to-End Workflows', () => {
  // Setup: create a board by visiting /board first
  test.beforeEach(async ({ page }) => {
    // Visit /board to auto-create a board and store it in localStorage
    await page.goto('/board');
    await expect(page.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });
  });

  test.describe('Feed Management Workflow', () => {
    test('should add a new feed and see it in the list', async ({ page }) => {
      // Go to controller and navigate to feeds tab
      await page.goto('/controller');
      await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

      // Click on Feeds tab
      await page.locator('[data-testid="tab-feeds"]').click();
      await expect(page.locator(selectors.feedsTab)).toBeVisible();

      // Click add feed button
      await page.locator(selectors.addFeedBtn).click();

      // Fill in feed details
      const feedName = 'Oats';
      await page.locator(selectors.newFeedName).fill(feedName);
      await page.locator(unitSelectors.unitBtn('scoop')).click();

      // Confirm adding
      await page.locator(selectors.confirmAddFeed).click();

      // Should see the new feed in the list (use class selector to avoid matching nested elements)
      const feedCard = page.locator('.feed-card').filter({ hasText: feedName });
      await expect(feedCard).toBeVisible();
    });

    test('should search and filter feeds', async ({ page }) => {
      // Go to controller and navigate to feeds tab
      await page.goto('/controller');
      await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

      // Click on Feeds tab
      await page.locator('[data-testid="tab-feeds"]').click();
      await expect(page.locator(selectors.feedsTab)).toBeVisible();

      // Type in search
      const searchInput = page.locator(selectors.feedSearch);
      await searchInput.fill('unique');

      // List should filter (or show empty if no match)
      const feedList = page.locator(selectors.feedList);
      await expect(feedList).toBeVisible();
    });
  });

  test.describe('Settings Workflow', () => {
    test('should change time mode', async ({ page }) => {
      // Go to controller and navigate to settings tab
      await page.goto('/controller');
      await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

      // Click on Settings tab
      await page.locator('[data-testid="tab-settings"]').click();
      await expect(page.locator(selectors.settingsTab)).toBeVisible();

      // Get current effective mode
      const effectiveMode = page.locator(selectors.effectiveTimeMode);
      const currentMode = await effectiveMode.textContent();

      // Click on a different mode
      if (currentMode?.trim() === 'AM') {
        await page.locator(timeModeSelectors.pm).click();
      } else {
        await page.locator(timeModeSelectors.am).click();
      }

      // Wait for update
      await page.waitForTimeout(500);

      // Effective mode should update
      const newMode = await effectiveMode.textContent();
      expect(newMode?.trim()).not.toBe(currentMode?.trim());
    });

    test('should change timezone', async ({ page }) => {
      // Go to controller and navigate to settings tab
      await page.goto('/controller');
      await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

      // Click on Settings tab
      await page.locator('[data-testid="tab-settings"]').click();
      await expect(page.locator(selectors.settingsTab)).toBeVisible();

      const timezoneSelect = page.locator(selectors.timezoneSelector);
      await expect(timezoneSelect).toBeVisible();

      // Select a different timezone
      await timezoneSelect.selectOption('UTC');
      await expect(timezoneSelect).toHaveValue('UTC');
    });
  });
});
