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
    const feed1 = await createFeed(request, ownerBoardId, { name: 'Oats', unit_label: 'scoop' });
    const feed2 = await createFeed(request, ownerBoardId, { name: 'Hay', unit_label: 'biscuit' });

    // Seed diet entries for BOTH feeds (sparse filtering only shows feeds with diet entries)
    await upsertDiet(request, {
      horse_id: horse1.id,
      feed_id: feed1.id,
      am_amount: 1,
      pm_amount: 1.5
    });
    await upsertDiet(request, {
      horse_id: horse2.id,
      feed_id: feed2.id,
      am_amount: 2,
      pm_amount: 2
    });

    // Navigate to /board (TV display)
    await ownerPage.goto('/board');

    // Wait for board view to be ready
    await expect(ownerPage.locator(selectors.boardView)).toBeVisible();

    // Verify grid is visible
    const grid = ownerPage.locator(selectors.swimLaneGrid);
    await expect(grid).toBeVisible();

    // Verify horse names appear in header (columns in horse-major orientation)
    await expect(ownerPage.locator(selectors.columnHeader(horse1.id))).toContainText('Thunder');
    await expect(ownerPage.locator(selectors.columnHeader(horse2.id))).toContainText('Lightning');

    // Verify feed names appear in rows
    await expect(ownerPage.locator(selectors.rowHeader(feed1.id))).toContainText('Oats');
    await expect(ownerPage.locator(selectors.rowHeader(feed2.id))).toContainText('Hay');

    // Verify quantity badge (cell uses col,row order: horse,feed in horse-major)
    const badge = ownerPage.locator(selectors.badge(horse1.id, feed1.id));
    await expect(badge).toBeVisible();
  });

  test('is read-only - FeedPad does not open on cell click', async ({ ownerPage, ownerBoardId, request }) => {
    // Seed 1 horse, 1 feed
    const horse = await createHorse(request, ownerBoardId, { name: 'Test Horse' });
    const feed = await createFeed(request, ownerBoardId, { name: 'Test Feed', unit_label: 'scoop' });

    // Seed diet (include both AM and PM to ensure visibility regardless of time mode)
    await upsertDiet(request, {
      horse_id: horse.id,
      feed_id: feed.id,
      am_amount: 1,
      pm_amount: 1
    });

    // Set board_id in localStorage and navigate to /board
    await ownerPage.goto('/');
    await ownerPage.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: 'hb_board_id', value: ownerBoardId }
    );
    await ownerPage.goto('/board');
    await expect(ownerPage.locator(selectors.boardView)).toBeVisible();

    // Wait for data to load via SSE - grid should contain the horse name
    await expect(ownerPage.locator(selectors.swimLaneGrid)).toContainText('Test Horse');

    // Click on ANY grid cell (first one found)
    const cell = ownerPage.locator('.grid-cell').first();
    await expect(cell).toBeVisible();
    await cell.click();

    // FeedPad should not open in read-only view - use short timeout
    await expect(ownerPage.locator(selectors.feedPad)).not.toBeVisible({ timeout: 1000 });
  });
});

test.describe('Real-Time Sync', () => {
  test('diet change in controller syncs to display', async ({ ownerPage, ownerBoardId, request, browser }) => {
    // Seed data with initial values we'll change
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
        { key: 'hb_board_id', value: ownerBoardId }
      );
      await displayPage.goto('/board');
      await expect(displayPage.locator(selectors.boardView)).toBeVisible();

      const displayBadge = displayPage.locator(selectors.badge(horse.id, feed.id));

      // --- Update AM slot to 2 ---
      await ownerPage.reload();
      await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible();
      await ownerPage.locator(selectors.horseCard(horse.id)).click();

      await ownerPage.locator(selectors.feedTileAM(feed.id)).click();
      await expect(ownerPage.locator(selectors.feedPad)).toBeVisible();
      await ownerPage.locator(selectors.presetTwo).click();
      await ownerPage.locator(selectors.feedPadConfirm).click();
      await expect(ownerPage.locator(selectors.feedPad)).not.toBeVisible();

      // --- Update PM slot to ½ (using preset, no stepper needed) ---
      await ownerPage.locator(selectors.feedTilePM(feed.id)).click();
      await expect(ownerPage.locator(selectors.feedPad)).toBeVisible();
      await ownerPage.locator(selectors.presetHalf).click();
      await ownerPage.locator(selectors.feedPadConfirm).click();
      await expect(ownerPage.locator(selectors.feedPad)).not.toBeVisible();

      // --- Force AM mode and verify display shows 2 ---
      await ownerPage.locator(selectors.horseDetailBack).click();
      await ownerPage.locator(selectors.tabBoard).click();
      await expect(ownerPage.locator(selectors.boardTab)).toBeVisible();
      await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
      await expect(ownerPage.locator('[data-testid="display-controls-drawer"]')).toBeVisible();
      await ownerPage.locator('[data-testid="overflow-menu-btn"]').click();
      await ownerPage.locator(timeModeSelectors.am).click();

      await expect(displayBadge).toContainText('2');

      // --- Force PM mode and verify display shows ½ ---
      await ownerPage.locator(timeModeSelectors.pm).click();
      await expect(displayBadge).toContainText('½');

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
        { key: 'hb_board_id', value: ownerBoardId }
      );
      await displayPage.goto('/board');
      await expect(displayPage.locator(selectors.boardView)).toBeVisible();

      // Get initial mode
      const timeModeBadge = displayPage.locator(selectors.timeModeBadge);
      await expect(timeModeBadge).toBeVisible();
      const initialMode = await timeModeBadge.textContent();

      // Switch mode in Controller - time mode is now on Board tab
      await ownerPage.reload();
      await ownerPage.locator(selectors.tabBoard).click();
      await expect(ownerPage.locator(selectors.boardTab)).toBeVisible();

      // Expand the display controls drawer
      await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
      await expect(ownerPage.locator('[data-testid="display-controls-drawer"]')).toBeVisible();

      // Time mode is in overflow menu
      await ownerPage.locator('[data-testid="overflow-menu-btn"]').click();

      // Determine new mode and click
      const newMode = initialMode?.includes('AM') ? 'PM' : 'AM';
      await ownerPage.locator(timeModeSelectors.timeMode(newMode as 'AM' | 'PM')).click();

      // Wait for sync
      await expect(timeModeBadge).toContainText(newMode);

    } finally {
      await displayContext.close();
    }
  });
});

test.describe('Board Tab', () => {
  test('shows scrollable unpaginated grid', async ({ ownerPage: page, request, ownerBoardId }) => {
    // Create 8 horses (more than TV pageSize of 6)
    const feed = await createFeed(request, ownerBoardId, { name: 'Oats', rank: 1 });
    const names = ['Apollo', 'Bella', 'Charlie', 'Dusty', 'Echo', 'Frosty', 'Glory', 'Hunter'];
    const horses = await Promise.all(names.map(n => createHorse(request, ownerBoardId, { name: n })));
    await Promise.all(horses.map(h => upsertDiet(request, {
      horse_id: h.id, feed_id: feed.id, am_amount: 1, pm_amount: 1
    })));

    await page.reload();
    await page.click('[data-testid="tab-board"]');
    await expect(page.getByTestId('board-tab')).toBeVisible();

    // All 8 horses visible (unpaginated)
    for (const name of names) {
      await expect(page.getByText(name)).toBeVisible();
    }

    // No breadcrumb (unpaginated = no overflow)
    await expect(page.locator('[data-testid="breadcrumb-more"]')).not.toBeVisible();
  });

  test('header controls visible by default, hidden when matched', async ({ ownerPage: page }) => {
    await page.reload();
    await page.click('[data-testid="tab-board"]');

    // Header controls visible by default
    await expect(page.getByTestId('header-time-toggle')).toBeVisible();
    await expect(page.getByTestId('header-flip-btn')).toBeVisible();

    // Open drawer, enable Match (checkbox is hidden behind styled slider)
    await page.click('[data-testid="toggle-display-controls"]');
    await page.click('[data-testid="match-tv-toggle"]', { force: true });

    // Header controls hidden
    await expect(page.getByTestId('header-time-toggle')).not.toBeVisible();
    await expect(page.getByTestId('header-flip-btn')).not.toBeVisible();
  });

  test('Match mode syncs controller grid to TV page', async ({ ownerPage: page, request, ownerBoardId, browser }) => {
    // Create enough data to require pagination
    const feed = await createFeed(request, ownerBoardId, { name: 'Oats' });
    const names = Array.from({ length: 10 }, (_, i) => `Horse${i}`);
    const horses = await Promise.all(names.map(n => createHorse(request, ownerBoardId, { name: n })));
    // Must create diet entries for sparse filtering to populate the grid
    await Promise.all(horses.map(h => upsertDiet(request, { horse_id: h.id, feed_id: feed.id, am_amount: 1 })));

    // Open TV display in separate context
    const displayCtx = await browser.newContext();
    const displayPage = await displayCtx.newPage();
    try {
      await displayPage.goto('/');
      await displayPage.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: 'hb_board_id', v: ownerBoardId });
      await displayPage.goto('/board');
      await expect(displayPage.locator('[data-testid="board-view"]')).toBeVisible();

      // Controller: enable Match, navigate to page 2 via drawer
      await page.reload();
      await page.click('[data-testid="tab-board"]');
      await page.click('[data-testid="toggle-display-controls"]');
      await page.click('[data-testid="match-tv-toggle"]', { force: true });
      await page.click('[data-testid="next-page-btn"]');

      // Both TV and controller should show page 2
      await expect(displayPage.getByTestId('page-badge')).toContainText('2 /');
      // Controller grid scrolls to show same content as TV
    } finally {
      await displayCtx.close();
    }
  });
});

