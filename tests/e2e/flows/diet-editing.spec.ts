import { test, expect } from '../fixtures/auth';
import { selectors } from '../selectors';
import { createHorse, createFeed, upsertDiet } from '../helpers/api';

/**
 * E2E Tests for Diet Editing via FeedPad
 *
 * Tests the FeedPad interface for editing diet values on the horse detail view.
 */
test.describe('Diet Editing via FeedPad', () => {
  let horseId: string;
  let feedId: string;

  test.beforeEach(async ({ ownerPage, ownerBoardId, request }) => {
    // Seed one horse and one feed
    const horse = await createHorse(request, ownerBoardId, { name: 'Test Horse' });
    const feed = await createFeed(request, ownerBoardId, { name: 'Oats', unit: 'scoop' });
    horseId = horse.id;
    feedId = feed.id;

    // Reload to pick up data
    await ownerPage.reload();
    await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 8000 });
  });

  /**
   * Helper to navigate to horse detail view
   */
  async function goToHorseDetail(page: import('@playwright/test').Page) {
    const horseCard = page.locator(selectors.horseCard(horseId));
    await expect(horseCard).toBeVisible();
    await horseCard.click();
    await expect(page.locator(selectors.horseDetail)).toBeVisible();
  }

  /**
   * Helper to get the value-amount span within a feed tile button
   */
  function getValueAmount(page: import('@playwright/test').Page, fId: string) {
    return page.locator(selectors.feedTileAM(fId)).locator('.value-amount');
  }

  test('should open FeedPad and set value via preset', async ({ ownerPage }) => {
    await goToHorseDetail(ownerPage);

    // Tap AM button for first feed
    const feedTileAM = ownerPage.locator(selectors.feedTileAM(feedId));
    await expect(feedTileAM).toBeVisible();
    await feedTileAM.click();

    // Verify FeedPad opens
    const feedPad = ownerPage.locator(selectors.feedPad);
    await expect(feedPad).toBeVisible();

    // Tap "1" preset
    const presetOne = ownerPage.locator(selectors.presetOne);
    await expect(presetOne).toBeVisible();
    await presetOne.click();

    // Tap Done
    const confirmBtn = ownerPage.locator(selectors.feedPadConfirm);
    await confirmBtn.click();

    // FeedPad should close
    await expect(feedPad).not.toBeVisible();

    // Verify tile shows "1"
    const valueAmount = getValueAmount(ownerPage, feedId);
    await expect(valueAmount).toContainText('1');
  });

  test('should set value via stepper', async ({ ownerPage }) => {
    await goToHorseDetail(ownerPage);

    // Open FeedPad for first feed's AM slot
    const feedTileAM = ownerPage.locator(selectors.feedTileAM(feedId));
    await feedTileAM.click();

    const feedPad = ownerPage.locator(selectors.feedPad);
    await expect(feedPad).toBeVisible();

    // Tap "Empty" preset to start at 0
    const presetEmpty = ownerPage.locator(selectors.presetEmpty);
    await presetEmpty.click();

    // Tap increment (+) 3 times - stepper should update after each click
    const stepperIncrement = ownerPage.locator(selectors.stepperIncrement);
    const stepperValue = ownerPage.locator(selectors.stepperValue);

    await stepperIncrement.click();
    await expect(stepperValue).toHaveText('¼');

    await stepperIncrement.click();
    await expect(stepperValue).toHaveText('½');

    await stepperIncrement.click();
    await expect(stepperValue).toHaveText('¾');

    // Tap Done
    await ownerPage.locator(selectors.feedPadConfirm).click();

    // Verify tile shows ¾
    const valueAmount = getValueAmount(ownerPage, feedId);
    await expect(valueAmount).toHaveText('¾');
  });

  test('should clear a value', async ({ ownerPage, request }) => {
    // Seed a diet entry with AM = 2
    await upsertDiet(request, {
      horse_id: horseId,
      feed_id: feedId,
      am_amount: 2,
    });

    // Reload to pick up data
    await ownerPage.reload();
    await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 8000 });

    await goToHorseDetail(ownerPage);

    // Verify tile shows "2"
    const valueAmount = getValueAmount(ownerPage, feedId);
    await expect(valueAmount).toContainText('2');

    // Open FeedPad
    const feedTileAM = ownerPage.locator(selectors.feedTileAM(feedId));
    await feedTileAM.click();

    const feedPad = ownerPage.locator(selectors.feedPad);
    await expect(feedPad).toBeVisible();

    // Tap "Empty" preset
    const presetEmpty = ownerPage.locator(selectors.presetEmpty);
    await presetEmpty.click();

    // Tap Done
    await ownerPage.locator(selectors.feedPadConfirm).click();

    // Verify tile shows dash (—)
    await expect(valueAmount).toHaveText('—');
  });

  test('should close FeedPad without saving when tapping X', async ({ ownerPage, request }) => {
    // Seed a diet entry with AM = 2
    await upsertDiet(request, {
      horse_id: horseId,
      feed_id: feedId,
      am_amount: 2,
    });

    // Reload
    await ownerPage.reload();
    await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 8000 });

    await goToHorseDetail(ownerPage);

    // Open FeedPad
    const feedTileAM = ownerPage.locator(selectors.feedTileAM(feedId));
    await feedTileAM.click();

    const feedPad = ownerPage.locator(selectors.feedPad);
    await expect(feedPad).toBeVisible();

    // Change value to "1"
    const presetOne = ownerPage.locator(selectors.presetOne);
    await presetOne.click();

    // Tap X (close)
    const closeBtn = ownerPage.locator(selectors.feedPadClose);
    await closeBtn.click();

    // FeedPad should close
    await expect(feedPad).not.toBeVisible();

    // Verify original value is retained
    const valueAmount = getValueAmount(ownerPage, feedId);
    await expect(valueAmount).toContainText('2');
  });

  test('should persist diet value after reload', async ({ ownerPage }) => {
    await goToHorseDetail(ownerPage);

    // Set a value via FeedPad
    const feedTileAM = ownerPage.locator(selectors.feedTileAM(feedId));
    await feedTileAM.click();

    const feedPad = ownerPage.locator(selectors.feedPad);
    await expect(feedPad).toBeVisible();

    // Set value to "2"
    const presetTwo = ownerPage.locator(selectors.presetTwo);
    await presetTwo.click();

    // Tap Done
    await ownerPage.locator(selectors.feedPadConfirm).click();
    await expect(feedPad).not.toBeVisible();

    // Verify the value was set
    const valueAmount = getValueAmount(ownerPage, feedId);
    await expect(valueAmount).toContainText('2');

    // Reload the page
    await ownerPage.reload();
    await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 8000 });

    // Navigate back to horse detail
    await goToHorseDetail(ownerPage);

    // Verify the value persists
    const valueAmountAfterReload = getValueAmount(ownerPage, feedId);
    await expect(valueAmountAfterReload).toContainText('2');
  });
});
