import { test, expect } from '../fixtures/auth';
import { selectors, timeModeSelectors } from '../selectors';
import { createHorse, createFeed, upsertDiet } from '../helpers/api';

/**
 * E2E Tests for TV Display View and Real-Time Sync
 *
 * Tests the TV board display functionality including:
 * - Grid rendering with seeded data
 * - Read-only behavior (no FeedPad)
 * - Real-time sync between controller and display via SSE
 * - Time mode changes syncing to display
 */
test.describe('TV Display View', () => {

  test('renders grid with seeded data', async ({ ownerPage, ownerBoardId, request }) => {
    // Seed 2 horses, 2 feeds via API
    const horse1 = await createHorse(request, ownerBoardId, { name: 'Thunder' });
    const horse2 = await createHorse(request, ownerBoardId, { name: 'Lightning' });
    const feed1 = await createFeed(request, ownerBoardId, { name: 'Oats', unit: 'scoop' });
    const feed2 = await createFeed(request, ownerBoardId, { name: 'Hay', unit: 'biscuit' });

    // Seed diet entries
    await upsertDiet(request, {
      horse_id: horse1.id,
      feed_id: feed1.id,
      am_amount: 1,
      pm_amount: 1.5
    });

    // Navigate to /board (TV display)
    await ownerPage.goto('/board');

    // Wait for board view to be ready
    await expect(ownerPage.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

    // Verify grid is visible
    const grid = ownerPage.locator(selectors.swimLaneGrid);
    await expect(grid).toBeVisible();

    // Verify horse names appear in header
    await expect(ownerPage.locator(selectors.horseHeader(horse1.id))).toContainText('Thunder');
    await expect(ownerPage.locator(selectors.horseHeader(horse2.id))).toContainText('Lightning');

    // Verify feed names appear in rows
    await expect(ownerPage.locator(selectors.feedName(feed1.id))).toContainText('Oats');
    await expect(ownerPage.locator(selectors.feedName(feed2.id))).toContainText('Hay');

    // Verify quantity badge
    const badge = ownerPage.locator(selectors.badge(horse1.id, feed1.id));
    await expect(badge).toBeVisible();
  });

  test('is read-only - FeedPad does not open on cell click', async ({ ownerPage, ownerBoardId, request }) => {
    // Seed 1 horse, 1 feed
    const horse = await createHorse(request, ownerBoardId, { name: 'Test Horse' });
    const feed = await createFeed(request, ownerBoardId, { name: 'Test Feed', unit: 'scoop' });

    // Seed diet
    await upsertDiet(request, {
      horse_id: horse.id,
      feed_id: feed.id,
      am_amount: 1
    });

    // Navigate to /board
    await ownerPage.goto('/board');
    await expect(ownerPage.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

    // Click on a cell
    const cell = ownerPage.locator(selectors.cell(horse.id, feed.id));
    await expect(cell).toBeVisible();
    await cell.click();

    // Wait briefly
    await ownerPage.waitForTimeout(500);

    // Verify FeedPad does NOT open
    await expect(ownerPage.locator(selectors.feedPad)).not.toBeVisible();
  });
});

test.describe('Real-Time Sync', () => {
  test('diet change in controller syncs to display', async ({ ownerPage, ownerBoardId, request, browser }) => {
    // Seed data
    const horse = await createHorse(request, ownerBoardId, { name: 'Sync Horse' });
    const feed = await createFeed(request, ownerBoardId, { name: 'Sync Feed', unit: 'scoop' });
    await upsertDiet(request, {
      horse_id: horse.id,
      feed_id: feed.id,
      am_amount: 1,
      pm_amount: 1
    });

    // Create a separate context for the Display (TV)
    const displayContext = await browser.newContext();
    const displayPage = await displayContext.newPage();

    try {
      // Set up display (/board) with same boardId
      await displayPage.goto('/');
      await displayPage.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: 'horseboard_board_id', value: ownerBoardId }
      );
      await displayPage.goto('/board');
      await expect(displayPage.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

      // Verify initial value on display
      const displayBadge = displayPage.locator(selectors.badge(horse.id, feed.id));
      await expect(displayBadge).toContainText('1');

      // Use ownerPage (Controller) to change value
      // Reload ownerPage to ensure it has latest data
      await ownerPage.reload();
      await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible();

      // Navigate to detail
      await ownerPage.locator(selectors.horseCard(horse.id)).click();

      // Open FeedPad
      await ownerPage.locator(selectors.feedTileAM(feed.id)).click();
      await expect(ownerPage.locator(selectors.feedPad)).toBeVisible();

      // Change to 2
      await ownerPage.locator(selectors.presetTwo).click();
      await ownerPage.locator(selectors.feedPadConfirm).click();

      // Wait for sync
      await expect(displayBadge).toContainText('2', { timeout: 3000 });

    } finally {
      await displayContext.close();
    }
  });

  test('time mode change in controller syncs to display', async ({ ownerPage, ownerBoardId, request, browser }) => {
    // Seed minimal data for grid to render
    const horse = await createHorse(request, ownerBoardId, { name: 'H' });
    const feed = await createFeed(request, ownerBoardId, { name: 'F', unit: 'scoop' });
    await upsertDiet(request, { horse_id: horse.id, feed_id: feed.id, am_amount: 1 });

    const displayContext = await browser.newContext();
    const displayPage = await displayContext.newPage();

    try {
      // Set up display
      await displayPage.goto('/');
      await displayPage.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: 'horseboard_board_id', value: ownerBoardId }
      );
      await displayPage.goto('/board');
      await expect(displayPage.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

      // Get initial mode
      const timeModeBadge = displayPage.locator(selectors.timeModeBadge);
      await expect(timeModeBadge).toBeVisible();
      const initialMode = await timeModeBadge.textContent();

      // Switch mode in Controller
      await ownerPage.reload();
      await ownerPage.locator(selectors.tabSettings).click();
      await expect(ownerPage.locator(selectors.settingsTab)).toBeVisible();

      // Determine new mode
      const newMode = initialMode?.includes('AM') ? 'PM' : 'AM';
      await ownerPage.locator(timeModeSelectors.timeMode(newMode as 'AM' | 'PM')).click();

      // Wait for sync
      await expect(timeModeBadge).toContainText(newMode, { timeout: 3000 });

    } finally {
      await displayContext.close();
    }
  });
});
