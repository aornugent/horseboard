import { test, expect } from '@playwright/test';
import { selectors } from '../selectors';
import {
  seedTestData,
  navigateWithBoard,
  cleanupTestData,
  type TestData,
} from '../helpers/setup';
import { upsertDiet } from '../helpers/api';

/**
 * E2E Tests for Diet Editing via FeedPad
 *
 * Tests the FeedPad interface for editing diet values on the horse detail view.
 * Each test seeds its own data (1 horse, 2 feeds) and cleans up after.
 */
test.describe('Diet Editing via FeedPad', () => {
  let testData: TestData;

  test.beforeEach(async ({ page, request }) => {
    // Seed a display with 1 horse and 2 feeds
    testData = await seedTestData(page, request, {
      horseCount: 1,
      feedCount: 2,
      createDietEntries: false, // Start with no diet entries
    });

    // Navigate to controller with the board
    await navigateWithBoard(page, '/controller', testData.board.id);

    // Wait for controller to be ready
    await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ request }) => {
    if (testData?.board?.id) {
      await cleanupTestData(request, testData.board.id);
    }
  });

  /**
   * Helper to navigate to horse detail view
   */
  async function goToHorseDetail(page: import('@playwright/test').Page) {
    const horseCard = page.locator(selectors.horseCard(testData.horses[0].id));
    await expect(horseCard).toBeVisible();
    await horseCard.click();
    await expect(page.locator(selectors.horseDetail)).toBeVisible();
  }

  /**
   * Helper to get the value-amount span within a feed tile button
   */
  function getValueAmount(page: import('@playwright/test').Page, feedId: string) {
    return page.locator(selectors.feedTileAM(feedId)).locator('.value-amount');
  }

  test('should open FeedPad and set value via preset', async ({ page }) => {
    await goToHorseDetail(page);

    // Tap AM button for first feed
    const feedTileAM = page.locator(selectors.feedTileAM(testData.feeds[0].id));
    await expect(feedTileAM).toBeVisible();
    await feedTileAM.click();

    // Verify FeedPad opens
    const feedPad = page.locator(selectors.feedPad);
    await expect(feedPad).toBeVisible();

    // Tap "1" preset
    const presetOne = page.locator(selectors.presetOne);
    await expect(presetOne).toBeVisible();
    await presetOne.click();

    // Tap Done
    const confirmBtn = page.locator(selectors.feedPadConfirm);
    await confirmBtn.click();

    // FeedPad should close
    await expect(feedPad).not.toBeVisible();

    // Verify tile shows "1"
    const valueAmount = getValueAmount(page, testData.feeds[0].id);
    await expect(valueAmount).toContainText('1');
  });

  test('should set value via stepper', async ({ page }) => {
    await goToHorseDetail(page);

    // Open FeedPad for first feed's AM slot
    const feedTileAM = page.locator(selectors.feedTileAM(testData.feeds[0].id));
    await feedTileAM.click();

    const feedPad = page.locator(selectors.feedPad);
    await expect(feedPad).toBeVisible();

    // Tap "Empty" preset to start at 0
    const presetEmpty = page.locator(selectors.presetEmpty);
    await presetEmpty.click();

    // Tap increment (+) 3 times - stepper should update after each click
    const stepperIncrement = page.locator(selectors.stepperIncrement);
    const stepperValue = page.locator(selectors.stepperValue);

    await stepperIncrement.click();
    await expect(stepperValue).toHaveText('¼');

    await stepperIncrement.click();
    await expect(stepperValue).toHaveText('½');

    await stepperIncrement.click();
    await expect(stepperValue).toHaveText('¾');

    // Tap Done
    await page.locator(selectors.feedPadConfirm).click();

    // Verify tile shows ¾
    const valueAmount = getValueAmount(page, testData.feeds[0].id);
    await expect(valueAmount).toHaveText('¾');
  });

  test('should clear a value', async ({ page, request }) => {
    // Seed a diet entry with AM = 2
    await upsertDiet(request, {
      horse_id: testData.horses[0].id,
      feed_id: testData.feeds[0].id,
      am_amount: 2,
    });

    // Reload to get the updated data
    await page.reload();
    await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

    await goToHorseDetail(page);

    // Verify tile shows "2" before clearing
    const valueAmount = getValueAmount(page, testData.feeds[0].id);
    await expect(valueAmount).toContainText('2');

    // Open FeedPad for that feed's AM
    const feedTileAM = page.locator(selectors.feedTileAM(testData.feeds[0].id));
    await feedTileAM.click();

    const feedPad = page.locator(selectors.feedPad);
    await expect(feedPad).toBeVisible();

    // Tap "Empty" preset
    const presetEmpty = page.locator(selectors.presetEmpty);
    await presetEmpty.click();

    // Tap Done
    await page.locator(selectors.feedPadConfirm).click();

    // FeedPad should close
    await expect(feedPad).not.toBeVisible();

    // Verify tile shows dash (—)
    await expect(valueAmount).toHaveText('—');
  });

  test('should close FeedPad without saving when tapping X', async ({ page, request }) => {
    // Seed a diet entry with AM = 2
    await upsertDiet(request, {
      horse_id: testData.horses[0].id,
      feed_id: testData.feeds[0].id,
      am_amount: 2,
    });

    // Reload to get the updated data
    await page.reload();
    await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

    await goToHorseDetail(page);

    // Verify original value
    const valueAmount = getValueAmount(page, testData.feeds[0].id);
    await expect(valueAmount).toContainText('2');

    // Open FeedPad
    const feedTileAM = page.locator(selectors.feedTileAM(testData.feeds[0].id));
    await feedTileAM.click();

    const feedPad = page.locator(selectors.feedPad);
    await expect(feedPad).toBeVisible();

    // Change value to "1"
    const presetOne = page.locator(selectors.presetOne);
    await presetOne.click();

    // Tap X (close) instead of Done
    const closeBtn = page.locator(selectors.feedPadClose);
    await closeBtn.click();

    // FeedPad should close
    await expect(feedPad).not.toBeVisible();

    // Verify original value is retained (change was NOT saved)
    await expect(valueAmount).toContainText('2');
  });

  test('should persist diet value after reload', async ({ page }) => {
    await goToHorseDetail(page);

    // Set a value via FeedPad
    const feedTileAM = page.locator(selectors.feedTileAM(testData.feeds[0].id));
    await feedTileAM.click();

    const feedPad = page.locator(selectors.feedPad);
    await expect(feedPad).toBeVisible();

    // Set value to "2"
    const presetTwo = page.locator(selectors.presetTwo);
    await presetTwo.click();

    // Tap Done
    await page.locator(selectors.feedPadConfirm).click();
    await expect(feedPad).not.toBeVisible();

    // Verify the value was set
    const valueAmount = getValueAmount(page, testData.feeds[0].id);
    await expect(valueAmount).toContainText('2');

    // Reload the page
    await page.reload();

    // Wait for controller to be ready
    await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

    // Navigate back to horse detail
    await goToHorseDetail(page);

    // Verify the value persists after reload
    const valueAmountAfterReload = getValueAmount(page, testData.feeds[0].id);
    await expect(valueAmountAfterReload).toContainText('2');
  });
});
