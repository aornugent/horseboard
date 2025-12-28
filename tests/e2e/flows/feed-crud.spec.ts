import { test, expect } from '@playwright/test';
import { selectors, unitSelectors } from '../selectors';
import {
  seedTestData,
  cleanupTestData,
  navigateWithBoard,
  waitForControllerReady,
  type TestData,
} from '../helpers/setup';
import { createBoard, createFeed, type Board, type Feed } from '../helpers/api';

/**
 * E2E Tests for Feed CRUD Operations
 *
 * Tests the complete feed management workflow:
 * - View feed list
 * - Add new feed
 * - Edit existing feed
 * - Delete feed
 * - Form validation
 */
test.describe('Feed CRUD Operations', () => {
  test.describe('View feed list', () => {
    let testData: TestData;

    test.beforeEach(async ({ page, request }) => {
      // Seed 2 feeds with different units via API
      testData = await seedTestData(page, request, {
        horseCount: 0,
        feedCount: 0,
        createDietEntries: false,
      });

      // Create feeds with specific units
      const oats = await createFeed(request, testData.board.id, {
        name: 'Oats',
        unit: 'scoop',
      });
      const vitamins = await createFeed(request, testData.board.id, {
        name: 'Vitamins',
        unit: 'sachet',
      });
      testData.feeds = [oats, vitamins];

      // Navigate to controller feeds tab
      await navigateWithBoard(page, '/controller', testData.board.id);
      await waitForControllerReady(page);
      await page.locator('[data-testid="tab-feeds"]').click();
      await expect(page.locator(selectors.feedsTab)).toBeVisible();
    });

    test.afterEach(async ({ request }) => {
      if (testData?.board?.id) {
        await cleanupTestData(request, testData.board.id);
      }
    });

    test('should display both feed cards with correct names and units', async ({
      page,
    }) => {
      // Verify Oats feed is visible with scoop unit
      const oatsFeed = testData.feeds[0];
      const oatsCard = page.locator(selectors.feedCard(oatsFeed.id));
      await expect(oatsCard).toBeVisible();
      await expect(page.locator(selectors.feedCardName(oatsFeed.id))).toHaveText(
        'Oats'
      );
      await expect(page.locator(selectors.feedCardMeta(oatsFeed.id))).toContainText(
        'scoop'
      );

      // Verify Vitamins feed is visible with sachet unit
      const vitaminsFeed = testData.feeds[1];
      const vitaminsCard = page.locator(selectors.feedCard(vitaminsFeed.id));
      await expect(vitaminsCard).toBeVisible();
      await expect(
        page.locator(selectors.feedCardName(vitaminsFeed.id))
      ).toHaveText('Vitamins');
      await expect(
        page.locator(selectors.feedCardMeta(vitaminsFeed.id))
      ).toContainText('sachet');
    });
  });

  test.describe('Add a new feed', () => {
    let board: Board;

    test.beforeEach(async ({ page, request }) => {
      // Create a board with no pre-existing feeds
      board = await createBoard(request);

      // Navigate to controller feeds tab
      await navigateWithBoard(page, '/controller', board.id);
      await waitForControllerReady(page);
      await page.locator('[data-testid="tab-feeds"]').click();
      await expect(page.locator(selectors.feedsTab)).toBeVisible();
    });

    test.afterEach(async ({ request }) => {
      if (board?.id) {
        await cleanupTestData(request, board.id);
      }
    });

    test('should add a new feed with non-default unit', async ({ page }) => {
      // Click Add Feed button
      await page.locator(selectors.addFeedBtn).click();
      await expect(page.locator(selectors.addFeedModal)).toBeVisible();

      // Enter feed name
      const feedName = 'Electrolytes';
      await page.locator(selectors.newFeedName).fill(feedName);

      // Select unit (ml - not the default 'scoop')
      await page.locator(unitSelectors.unitBtn('ml')).click();

      // Confirm
      await page.locator(selectors.confirmAddFeed).click();

      // Verify modal closes
      await expect(page.locator(selectors.addFeedModal)).not.toBeVisible();

      // Verify new feed appears in list with correct name and unit
      const feedCard = page.locator('.feed-card').filter({ hasText: feedName });
      await expect(feedCard).toBeVisible();
      await expect(feedCard).toContainText('ml');
    });
  });

  test.describe('Edit a feed', () => {
    let board: Board;
    let feed: Feed;

    test.beforeEach(async ({ page, request }) => {
      // Create a board and seed 1 feed
      board = await createBoard(request);
      feed = await createFeed(request, board.id, {
        name: 'Hay',
        unit: 'biscuit',
      });

      // Navigate to controller feeds tab
      await navigateWithBoard(page, '/controller', board.id);
      await waitForControllerReady(page);
      await page.locator('[data-testid="tab-feeds"]').click();
      await expect(page.locator(selectors.feedsTab)).toBeVisible();
    });

    test.afterEach(async ({ request }) => {
      if (board?.id) {
        await cleanupTestData(request, board.id);
      }
    });

    test('should edit feed name and unit', async ({ page }) => {
      // Click on feed card to open edit modal
      await page.locator(selectors.feedCard(feed.id)).click();
      await expect(page.locator(selectors.editFeedModal)).toBeVisible();

      // Change name
      const newName = 'Premium Hay';
      await page.locator(selectors.editFeedName).clear();
      await page.locator(selectors.editFeedName).fill(newName);

      // Change unit to scoop
      await page.locator(unitSelectors.editUnitBtn('scoop')).click();

      // Save
      await page.locator(selectors.confirmEditFeed).click();

      // Verify modal closes
      await expect(page.locator(selectors.editFeedModal)).not.toBeVisible();

      // Verify changes reflected in list
      const feedCard = page.locator(selectors.feedCard(feed.id));
      await expect(feedCard).toBeVisible();
      await expect(page.locator(selectors.feedCardName(feed.id))).toHaveText(
        newName
      );
      await expect(page.locator(selectors.feedCardMeta(feed.id))).toContainText(
        'scoop'
      );
    });
  });

  test.describe('Delete a feed', () => {
    let board: Board;
    let feeds: Feed[];

    test.beforeEach(async ({ page, request }) => {
      // Create a board and seed 2 feeds
      board = await createBoard(request);
      const feed1 = await createFeed(request, board.id, {
        name: 'Grain',
        unit: 'scoop',
      });
      const feed2 = await createFeed(request, board.id, {
        name: 'Supplements',
        unit: 'sachet',
      });
      feeds = [feed1, feed2];

      // Navigate to controller feeds tab
      await navigateWithBoard(page, '/controller', board.id);
      await waitForControllerReady(page);
      await page.locator('[data-testid="tab-feeds"]').click();
      await expect(page.locator(selectors.feedsTab)).toBeVisible();
    });

    test.afterEach(async ({ request }) => {
      if (board?.id) {
        await cleanupTestData(request, board.id);
      }
    });

    test('should delete one feed and leave the other', async ({ page }) => {
      // Verify both feeds are initially visible
      await expect(page.locator(selectors.feedCard(feeds[0].id))).toBeVisible();
      await expect(page.locator(selectors.feedCard(feeds[1].id))).toBeVisible();

      // Click delete on the first feed
      await page.locator(selectors.feedCardDelete(feeds[0].id)).click();

      // Confirm deletion in the modal
      await expect(page.locator(selectors.deleteFeedModal)).toBeVisible();
      await page.locator(selectors.confirmDeleteFeed).click();

      // Verify modal closes
      await expect(page.locator(selectors.deleteFeedModal)).not.toBeVisible();

      // Verify only 1 feed remains
      await expect(
        page.locator(selectors.feedCard(feeds[0].id))
      ).not.toBeVisible();
      await expect(page.locator(selectors.feedCard(feeds[1].id))).toBeVisible();
    });
  });

  test.describe('Form validation', () => {
    let board: Board;

    test.beforeEach(async ({ page, request }) => {
      // Create a board
      board = await createBoard(request);

      // Navigate to controller feeds tab
      await navigateWithBoard(page, '/controller', board.id);
      await waitForControllerReady(page);
      await page.locator('[data-testid="tab-feeds"]').click();
      await expect(page.locator(selectors.feedsTab)).toBeVisible();
    });

    test.afterEach(async ({ request }) => {
      if (board?.id) {
        await cleanupTestData(request, board.id);
      }
    });

    test('should not allow adding feed without name', async ({ page }) => {
      // Open add feed modal
      await page.locator(selectors.addFeedBtn).click();
      await expect(page.locator(selectors.addFeedModal)).toBeVisible();

      // Verify confirm button is disabled when name is empty
      const confirmBtn = page.locator(selectors.confirmAddFeed);
      await expect(confirmBtn).toBeDisabled();

      // Enter a name
      await page.locator(selectors.newFeedName).fill('Test Feed');

      // Verify confirm button is now enabled
      await expect(confirmBtn).toBeEnabled();
    });
  });
});
