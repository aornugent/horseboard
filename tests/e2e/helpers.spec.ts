import { test, expect } from '@playwright/test';
import { selectors } from './selectors';
import {
  seedTestData,
  cleanupTestData,
  waitForControllerReady,
  navigateWithBoard,
  type TestData,
} from './helpers/setup';

/**
 * Verification Tests for E2E Helpers
 *
 * These tests verify that the API and setup helpers work correctly.
 * They serve as both validation and documentation for the helper functions.
 */

test.describe('Test Infrastructure Helpers', () => {
  let testData: TestData;

  test.beforeEach(async ({ page, request }) => {
    // Seed test data via API
    testData = await seedTestData(page, request);
  });

  test.afterEach(async ({ request }) => {
    // Clean up via API (cascade deletes all related data)
    if (testData?.board?.id) {
      await cleanupTestData(request, testData.board.id);
    }
  });

  test('seeded horses appear in controller horse list', async ({ page }) => {
    // Navigate to controller with board ID set
    await navigateWithBoard(page, '/controller', testData.board.id);
    await waitForControllerReady(page);

    // Verify horses tab is visible
    const horsesTab = page.locator(selectors.horsesTab);
    await expect(horsesTab).toBeVisible();

    // Verify seeded horses appear in the list
    for (const horse of testData.horses) {
      const horseCard = page.locator(selectors.horseCard(horse.id));
      await expect(horseCard).toBeVisible();

      // Verify horse name is displayed
      const horseName = page.locator(selectors.horseCardName(horse.id));
      await expect(horseName).toHaveText(horse.name);
    }
  });

  test('seeded feeds appear in controller feed list', async ({ page }) => {
    // Navigate to controller with board ID set
    await navigateWithBoard(page, '/controller', testData.board.id);
    await waitForControllerReady(page);

    // Navigate to feeds tab
    await page.locator('[data-testid="tab-feeds"]').click();
    await expect(page.locator(selectors.feedsTab)).toBeVisible();

    // Verify seeded feeds appear in the list
    for (const feed of testData.feeds) {
      const feedCard = page.locator(selectors.feedCard(feed.id));
      await expect(feedCard).toBeVisible();
    }
  });

  test('cleanup removes test data', async ({ request }) => {
    // Store the board ID before cleanup
    const boardId = testData.board.id;

    // Cleanup should work
    await cleanupTestData(request, boardId);

    // Verify the board is deleted by trying to fetch it
    const response = await request.get(
      `http://localhost:5173/api/boards/${boardId}`
    );
    expect(response.status()).toBe(404);

    // Clear testData so afterEach doesn't try to clean up again
    testData = null as unknown as TestData;
  });
});
