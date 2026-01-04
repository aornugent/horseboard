/**
 * E2E Tests for TV Display View and Real-Time Sync
 *
 * Tests the TV board display functionality including:
 * - Grid rendering with seeded data
 * - Read-only behavior (no FeedPad)
 * - Real-time sync between controller and display via SSE
 * - Time mode changes syncing to display
 */

import { test, expect, Browser, Page, BrowserContext } from '@playwright/test';
import { selectors, timeModeSelectors } from '../selectors';
import {
  seedTestData,
  navigateWithBoard,
  cleanupTestData,
  type TestData,
} from '../helpers/setup';
import { upsertDiet } from '../helpers/api';

test.describe('TV Display View', () => {
  let testData: TestData;

  test.afterEach(async ({ request }) => {
    if (testData?.board?.id) {
      await cleanupTestData(request, testData.board.id);
    }
  });

  test('renders grid with seeded data', async ({ page, request }) => {
    // Seed 2 horses, 2 feeds, and diet entries
    testData = await seedTestData(page, request, {
      horseCount: 2,
      feedCount: 2,
      createDietEntries: true,
    });

    // Navigate to /board (TV display)
    await navigateWithBoard(page, '/board', testData.board.id);

    // Wait for board view to be ready
    await expect(page.locator(selectors.boardView)).toBeVisible({ timeout: 10000 });

    // Verify grid is visible
    const grid = page.locator(selectors.swimLaneGrid);
    await expect(grid).toBeVisible();

    // Verify horse names appear in header
    for (const horse of testData.horses) {
      const horseHeader = page.locator(selectors.horseHeader(horse.id));
      await expect(horseHeader).toBeVisible();
      await expect(horseHeader).toContainText(horse.name);
    }

    // Verify feed names appear in rows
    for (const feed of testData.feeds) {
      const feedName = page.locator(selectors.feedName(feed.id));
      await expect(feedName).toBeVisible();
      await expect(feedName).toContainText(feed.name);
    }

    // Verify at least one quantity badge is visible
    // Diet entries were created with am_amount: 1, pm_amount: 1.5
    const firstBadge = page.locator(
      selectors.badge(testData.horses[0].id, testData.feeds[0].id)
    );
    await expect(firstBadge).toBeVisible();
  });

  test('is read-only - FeedPad does not open on cell click', async ({ page, request }) => {
    // Seed data for the test
    testData = await seedTestData(page, request, {
      horseCount: 1,
      feedCount: 1,
      createDietEntries: true,
    });

    // Navigate to /board (TV display)
    await navigateWithBoard(page, '/board', testData.board.id);

    // Wait for board view to be ready
    await expect(page.locator(selectors.boardView)).toBeVisible({ timeout: 10000 });

    // Verify grid is visible
    await expect(page.locator(selectors.swimLaneGrid)).toBeVisible();

    // Click on a cell
    const cell = page.locator(
      selectors.cell(testData.horses[0].id, testData.feeds[0].id)
    );
    await expect(cell).toBeVisible();
    await cell.click();

    // Verify FeedPad does NOT open (check with a short timeout to ensure it doesn't appear)
    const feedPad = page.locator(selectors.feedPad);
    await expect(feedPad).not.toBeVisible({ timeout: 1000 });
  });
});

test.describe('Real-Time Sync', () => {
  let testData: TestData;

  test.afterEach(async ({ request }) => {
    if (testData?.board?.id) {
      await cleanupTestData(request, testData.board.id);
    }
  });

  test('diet change in controller syncs to display', async ({ page, request, browser }) => {
    // Seed data
    testData = await seedTestData(page, request, {
      horseCount: 1,
      feedCount: 1,
      createDietEntries: true, // Creates with am_amount: 1, pm_amount: 1.5
    });

    // Create two separate browser contexts for display and controller
    const displayContext = await browser.newContext();
    const controllerContext = await browser.newContext();

    try {
      const displayPage = await displayContext.newPage();
      const controllerPage = await controllerContext.newPage();

      // Set up display (/board)
      await displayPage.goto('/');
      await displayPage.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: 'horseboard_board_id', value: testData.board.id }
      );
      await displayPage.goto('/board');
      await expect(displayPage.locator(selectors.boardView)).toBeVisible({ timeout: 10000 });

      // Verify initial badge value on display
      const displayBadge = displayPage.locator(
        selectors.badge(testData.horses[0].id, testData.feeds[0].id)
      );
      await expect(displayBadge).toBeVisible();

      // Set up controller
      await controllerPage.goto('/');
      await controllerPage.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: 'horseboard_board_id', value: testData.board.id }
      );
      await controllerPage.goto('/controller');
      await expect(controllerPage.locator('[data-testid="controller-view"]')).toBeVisible({
        timeout: 10000,
      });

      // Navigate to horse detail in controller
      const horseCard = controllerPage.locator(selectors.horseCard(testData.horses[0].id));
      await expect(horseCard).toBeVisible();
      await horseCard.click();
      await expect(controllerPage.locator(selectors.horseDetail)).toBeVisible();

      // Open FeedPad and change the AM value to 2
      const feedTileAM = controllerPage.locator(selectors.feedTileAM(testData.feeds[0].id));
      await expect(feedTileAM).toBeVisible();
      await feedTileAM.click();

      const feedPad = controllerPage.locator(selectors.feedPad);
      await expect(feedPad).toBeVisible();

      // Set value to 2
      const presetTwo = controllerPage.locator(selectors.presetTwo);
      await presetTwo.click();

      // Confirm
      await controllerPage.locator(selectors.feedPadConfirm).click();
      await expect(feedPad).not.toBeVisible();

      // Wait up to 3 seconds for the change to sync to display
      await expect(displayBadge).toContainText('2', { timeout: 3000 });
    } finally {
      await displayContext.close();
      await controllerContext.close();
    }
  });

  test('time mode change in controller syncs to display', async ({ page, request, browser }) => {
    // Seed minimal data
    testData = await seedTestData(page, request, {
      horseCount: 1,
      feedCount: 1,
      createDietEntries: true,
    });

    // Create two separate browser contexts for display and controller
    const displayContext = await browser.newContext();
    const controllerContext = await browser.newContext();

    try {
      const displayPage = await displayContext.newPage();
      const controllerPage = await controllerContext.newPage();

      // Set up display (/board)
      await displayPage.goto('/');
      await displayPage.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: 'horseboard_board_id', value: testData.board.id }
      );
      await displayPage.goto('/board');
      await expect(displayPage.locator(selectors.boardView)).toBeVisible({ timeout: 10000 });

      // Note the current time mode badge on display
      const timeModeBadge = displayPage.locator(selectors.timeModeBadge);
      await expect(timeModeBadge).toBeVisible();
      const initialMode = await timeModeBadge.textContent();

      // Set up controller
      await controllerPage.goto('/');
      await controllerPage.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: 'horseboard_board_id', value: testData.board.id }
      );
      await controllerPage.goto('/controller');
      await expect(controllerPage.locator('[data-testid="controller-view"]')).toBeVisible({
        timeout: 10000,
      });

      // Navigate to Settings tab using the tab navigation button
      const settingsNavTab = controllerPage.locator('[data-testid="tab-settings"]');
      await expect(settingsNavTab).toBeVisible();
      await settingsNavTab.click();

      // Wait for settings content to be visible
      await expect(controllerPage.locator(selectors.settingsTab)).toBeVisible();

      // Verify time mode selector is visible
      const timeModeSelector = controllerPage.locator(selectors.timeModeSelector);
      await expect(timeModeSelector).toBeVisible();

      // Change time mode - toggle to the opposite of current
      // If current is AM, switch to PM; if PM or AUTO, switch to AM
      const newMode = initialMode?.includes('AM') ? 'PM' : 'AM';
      const newModeBtn = controllerPage.locator(
        timeModeSelectors.timeMode(newMode as 'AM' | 'PM')
      );
      await newModeBtn.click();

      // Wait up to 3 seconds for the change to sync to display
      await expect(timeModeBadge).toContainText(newMode, { timeout: 3000 });
    } finally {
      await displayContext.close();
      await controllerContext.close();
    }
  });
});
