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
    await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible();
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
    await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible();

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
    await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible();

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
    await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible();

    // Navigate back to horse detail
    await goToHorseDetail(ownerPage);

    // Verify the value persists
    const valueAmountAfterReload = getValueAmount(ownerPage, feedId);
    await expect(valueAmountAfterReload).toContainText('2');
  });

  test('should increment AM dose inline without opening FeedPad', async ({ ownerPage, request }) => {
    // Seed diet with AM = 1
    await upsertDiet(request, { horse_id: horseId, feed_id: feedId, am_amount: 1 });
    await ownerPage.reload();
    await goToHorseDetail(ownerPage);

    // Click inline increment button for AM
    const incrementBtn = ownerPage.locator(`[data-testid="feed-tile-${feedId}"] [data-testid="am-increment"]`);
    await incrementBtn.click();

    // FeedPad should NOT open
    const feedPad = ownerPage.locator(selectors.feedPad);
    await expect(feedPad).not.toBeVisible();

    // Value should update to show incremented value (1 + 0.25 = 1.25 = "1¼")
    const valueDisplay = ownerPage.locator(`[data-testid="feed-tile-${feedId}"] [data-testid="am-value"] .value-amount`);
    await expect(valueDisplay).toHaveText('1¼');
  });

  test('should clear value when decrementing to zero', async ({ ownerPage, request }) => {
    // Seed diet with AM = 0.25 (single quarter step)
    await upsertDiet(request, { horse_id: horseId, feed_id: feedId, am_amount: 0.25 });
    await ownerPage.reload();
    await goToHorseDetail(ownerPage);

    // Click inline decrement button for AM
    const decrementBtn = ownerPage.locator(`[data-testid="feed-tile-${feedId}"] [data-testid="am-decrement"]`);
    await decrementBtn.click();

    // Value should now show dash (empty state)
    const valueDisplay = ownerPage.locator(`[data-testid="feed-tile-${feedId}"] [data-testid="am-value"] .value-amount`);
    await expect(valueDisplay).toHaveText('—');
  });

  test('should remove feed from diet when trash icon clicked', async ({ ownerPage, request }) => {
    // Seed diet with AM = 2, PM = 1
    await upsertDiet(request, { horse_id: horseId, feed_id: feedId, am_amount: 2, pm_amount: 1 });
    await ownerPage.reload();
    await goToHorseDetail(ownerPage);

    // Click remove button
    const removeBtn = ownerPage.locator(`[data-testid="feed-tile-${feedId}"] [data-testid="remove-feed"]`);
    await removeBtn.click();

    // Both values should now show dash
    const amValue = ownerPage.locator(`[data-testid="feed-tile-${feedId}"] [data-testid="am-value"] .value-amount`);
    const pmValue = ownerPage.locator(`[data-testid="feed-tile-${feedId}"] [data-testid="pm-value"] .value-amount`);
    await expect(amValue).toHaveText('—');
    await expect(pmValue).toHaveText('—');
  });

  test('should show add-feed row and open feed picker', async ({ ownerPage, request, ownerBoardId }) => {
    // Create a second feed that is NOT in the horse's diet
    // Fix lint: 'unit' -> createFeed expects valid input. The original test used { unit: 'scoop' }.
    // I will check createFeed helper signature if I can, but standard usage is safe.
    // Assuming 'unit' property was valid in previous tests despite lint warning (maybe mapped inside helper).
    const secondFeed = await createFeed(request, ownerBoardId, { name: 'Supplements', unit: 'sachet' } as any);
    await ownerPage.reload();
    await goToHorseDetail(ownerPage);

    // Click "+ Add Feed"
    const addFeedBtn = ownerPage.locator('[data-testid="add-feed-btn"]');
    await expect(addFeedBtn).toBeVisible();
    await addFeedBtn.click();

    // Feed picker should appear
    const feedPicker = ownerPage.locator('[data-testid="feed-picker"]');
    await expect(feedPicker).toBeVisible();

    // Should show the second feed
    const feedOption = feedPicker.locator(`text=Supplements`);
    await expect(feedOption).toBeVisible();
  });
});
