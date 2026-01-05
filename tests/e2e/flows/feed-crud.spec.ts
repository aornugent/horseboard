import { test, expect } from '../fixtures/auth';
import { selectors, unitSelectors } from '../selectors';
import { createFeed } from '../helpers/api';

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
  // Common setup: Navigate to Feeds tab
  test.beforeEach(async ({ ownerPage }) => {
    // Wait for controller to be ready (handled by fixture), then click feeds tab
    await ownerPage.locator(selectors.tabFeeds).click();
    await expect(ownerPage.locator(selectors.feedsTab)).toBeVisible();
  });

  test.describe('View feed list', () => {
    test('should display seeded feeds with correct names and units', async ({ ownerPage, ownerBoardId, request }) => {
      // Seed 2 feeds via API
      const oats = await createFeed(request, ownerBoardId, {
        name: 'Oats',
        unit: 'scoop',
      });
      const vitamins = await createFeed(request, ownerBoardId, {
        name: 'Vitamins',
        unit: 'sachet',
      });

      // Reload to pick up new data
      await ownerPage.reload();
      await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 8000 });
      // Navigate back to feeds tab after reload
      await ownerPage.locator(selectors.tabFeeds).click();
      await expect(ownerPage.locator(selectors.feedsTab)).toBeVisible();

      // Verify Oats feed
      const oatsCard = ownerPage.locator(selectors.feedCard(oats.id));
      await expect(oatsCard).toBeVisible();
      await expect(ownerPage.locator(selectors.feedCardName(oats.id))).toHaveText('Oats');
      await expect(ownerPage.locator(selectors.feedCardMeta(oats.id))).toContainText('scoop');

      // Verify Vitamins feed
      const vitaminsCard = ownerPage.locator(selectors.feedCard(vitamins.id));
      await expect(vitaminsCard).toBeVisible();
      await expect(ownerPage.locator(selectors.feedCardName(vitamins.id))).toHaveText('Vitamins');
      await expect(ownerPage.locator(selectors.feedCardMeta(vitamins.id))).toContainText('sachet');
    });
  });

  test.describe('Add a new feed', () => {
    test('should add a new feed with non-default unit', async ({ ownerPage }) => {
      // Click Add Feed button
      await ownerPage.locator(selectors.addFeedBtn).click();
      await expect(ownerPage.locator(selectors.addFeedModal)).toBeVisible();

      // Enter feed name
      const feedName = 'Electrolytes';
      await ownerPage.locator(selectors.newFeedName).fill(feedName);

      // Select unit (ml - not the default 'scoop')
      await ownerPage.locator(unitSelectors.unitBtn('ml')).click();

      // Confirm
      await ownerPage.locator(selectors.confirmAddFeed).click();

      // Verify modal closes
      await expect(ownerPage.locator(selectors.addFeedModal)).not.toBeVisible();

      // Verify new feed appears in list with correct name and unit
      const feedCard = ownerPage.locator('.feed-card').filter({ hasText: feedName });
      await expect(feedCard).toBeVisible();
      await expect(feedCard).toContainText('ml');
    });
  });

  test.describe('Edit a feed', () => {
    test('should edit feed name and unit', async ({ ownerPage, ownerBoardId, request }) => {
      // Seed a feed
      const feed = await createFeed(request, ownerBoardId, {
        name: 'Hay',
        unit: 'biscuit',
      });

      // Reload data
      await ownerPage.reload();
      await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 8000 });
      await ownerPage.locator(selectors.tabFeeds).click();

      // Click on feed card to open edit modal
      await ownerPage.locator(selectors.feedCard(feed.id)).click();
      await expect(ownerPage.locator(selectors.editFeedModal)).toBeVisible();

      // Change name
      const newName = 'Premium Hay';
      await ownerPage.locator(selectors.editFeedName).clear();
      await ownerPage.locator(selectors.editFeedName).fill(newName);

      // Change unit to scoop
      await ownerPage.locator(unitSelectors.editUnitBtn('scoop')).click();

      // Save
      await ownerPage.locator(selectors.confirmEditFeed).click();

      // Verify modal closes
      await expect(ownerPage.locator(selectors.editFeedModal)).not.toBeVisible();

      // Verify changes reflected in list
      const feedCard = ownerPage.locator(selectors.feedCard(feed.id));
      await expect(feedCard).toBeVisible();
      await expect(ownerPage.locator(selectors.feedCardName(feed.id))).toHaveText(newName);
      await expect(ownerPage.locator(selectors.feedCardMeta(feed.id))).toContainText('scoop');
    });
  });

  test.describe('Delete a feed', () => {
    test('should delete one feed and leave the other', async ({ ownerPage, ownerBoardId, request }) => {
      const feed1 = await createFeed(request, ownerBoardId, { name: 'Grain', unit: 'scoop' });
      const feed2 = await createFeed(request, ownerBoardId, { name: 'Supplements', unit: 'sachet' });

      // Reload
      await ownerPage.reload();
      await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 8000 });
      await ownerPage.locator(selectors.tabFeeds).click();

      // Verify both feeds are visible
      await expect(ownerPage.locator(selectors.feedCard(feed1.id))).toBeVisible();
      await expect(ownerPage.locator(selectors.feedCard(feed2.id))).toBeVisible();

      // Click delete on the first feed
      await ownerPage.locator(selectors.feedCardDelete(feed1.id)).click();

      // Confirm deletion in the modal
      await expect(ownerPage.locator(selectors.deleteFeedModal)).toBeVisible();
      await ownerPage.locator(selectors.confirmDeleteFeed).click();

      // Verify modal closes
      await expect(ownerPage.locator(selectors.deleteFeedModal)).not.toBeVisible();

      // Verify only 1 feed remains
      await expect(ownerPage.locator(selectors.feedCard(feed1.id))).not.toBeVisible();
      await expect(ownerPage.locator(selectors.feedCard(feed2.id))).toBeVisible();
    });
  });

  test.describe('Form validation', () => {
    test('should not allow adding feed without name', async ({ ownerPage }) => {
      // Open add feed modal
      await ownerPage.locator(selectors.addFeedBtn).click();
      await expect(ownerPage.locator(selectors.addFeedModal)).toBeVisible();

      // Verify confirm button is disabled when name is empty
      const confirmBtn = ownerPage.locator(selectors.confirmAddFeed);
      await expect(confirmBtn).toBeDisabled();

      // Enter a name
      await ownerPage.locator(selectors.newFeedName).fill('Test Feed');

      // Verify confirm button is now enabled
      await expect(confirmBtn).toBeEnabled();
    });
  });
});
