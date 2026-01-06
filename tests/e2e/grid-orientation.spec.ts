import { test, expect } from './fixtures/auth';
import { createHorse, createFeed, upsertDiet } from './helpers/api';

test.describe('Grid Orientation', () => {

    test('toggles orientation between Horses and Feeds', async ({ ownerPage: page, request, ownerBoardId }) => {
        // Setup Data
        const horse = await createHorse(request, ownerBoardId, { name: 'Thunder' });
        const feed = await createFeed(request, ownerBoardId, { name: 'Morning Hay', unit_type: 'int', rank: 1 });
        // Must create diet entry for sparse filtering to show feed in grid
        await upsertDiet(request, { horse_id: horse.id, feed_id: feed.id, am_amount: 1 });

        // Reload page to fetch new data
        await page.reload();
        await expect(page.getByTestId('controller-view')).toBeVisible();

        // Go to Board Preview Tab
        await page.click('[data-testid="tab-board"]');
        await expect(page.getByTestId('board-tab')).toBeVisible();

        // Open Display Controls
        await page.click('[data-testid="toggle-display-controls"]');
        await expect(page.getByTestId('display-controls-drawer')).toBeVisible();

        // Enable Match TV so preview follows board changes
        await page.click('[data-testid="match-tv-toggle"]');

        // Default: Horses
        await expect(page.getByTestId('orientation-horse-major')).toHaveClass(/active/);

        // Verify headers are horses
        // In horse-major, column headers are horses.
        // "Thunder" should be visible in a header.
        // Wait, createHorse returns ID. I don't know ID.
        // But text content should be 'Thunder'.
        await expect(page.locator('.horse-header', { hasText: 'Thunder' })).toBeVisible();

        // Switch to Feeds
        await page.click('[data-testid="orientation-feed-major"]');

        // Verify active class
        await expect(page.getByTestId('orientation-feed-major')).toHaveClass(/active/);
        await expect(page.getByTestId('orientation-horse-major')).not.toHaveClass(/active/);

        // Verify headers are feeds
        await expect(page.locator('.horse-header', { hasText: 'Morning Hay' })).toBeVisible();
        // In feed-major, column headers are feeds. Class name might still be 'horse-header' if I didn't change it in SwimLaneGrid.
        // SwimLaneGrid: className="horse-header ..."
        // Yes, class name is static 'horse-header'.
    });
});

test.describe('TV Display Pagination', () => {
    test('shows page badge with current and total', async ({ ownerPage: page, request, ownerBoardId }) => {
        // Setup: Create enough horses for 2+ pages
        const feed = await createFeed(request, ownerBoardId, { name: 'Oats' });
        const names = Array.from({ length: 10 }, (_, i) => `Horse${i}`);
        const horses = await Promise.all(names.map(n => createHorse(request, ownerBoardId, { name: n })));
        await Promise.all(horses.map(h => createFeed(request, ownerBoardId, { name: `F_${h.id}` }))); // Ensure diet isn't empty?
        // Wait, failing test from plan uses upsertDiet
        await Promise.all(horses.map(h => upsertDiet(request, {
            horse_id: h.id, feed_id: feed.id, am_amount: 1
        })));

        await page.goto('/');
        await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: 'hb_board_id', v: ownerBoardId });
        await page.goto('/board');
        await expect(page.getByTestId('page-badge')).toContainText(/1 \/ \d+/);
    });

    test('shows breadcrumb when rows overflow', async ({ ownerPage: page, request, ownerBoardId }) => {
        // Create 1 horse with many feeds (to trigger row overflow)
        const horse = await createHorse(request, ownerBoardId, { name: 'TestHorse' });
        const feeds = await Promise.all(
            Array.from({ length: 15 }, (_, i) =>
                createFeed(request, ownerBoardId, { name: `Feed${i}`, rank: i })
            )
        );
        await Promise.all(feeds.map(f => upsertDiet(request, {
            horse_id: horse.id, feed_id: f.id, am_amount: 1, pm_amount: 1
        })));

        await page.goto('/');
        await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: 'hb_board_id', v: ownerBoardId });
        await page.goto('/board');
        await expect(page.getByTestId('breadcrumb-more')).toContainText(/\d+ more/);
    });

    test('2D pagination advances rows first then columns (down-then-across)', async ({ ownerPage: page, request, ownerBoardId, browser }) => {
        // Create enough horses and feeds to require both column and row pagination
        // 8 horses (2 column pages at pageSize 6), 12 feeds (2 row pages at rowPageSize 10)
        const horses = await Promise.all(
            Array.from({ length: 8 }, (_, i) => createHorse(request, ownerBoardId, { name: `H${i}` }))
        );
        const feeds = await Promise.all(
            Array.from({ length: 12 }, (_, i) => createFeed(request, ownerBoardId, { name: `F${i}`, rank: i }))
        );
        await Promise.all(
            horses.flatMap(h => feeds.map(f =>
                upsertDiet(request, { horse_id: h.id, feed_id: f.id, am_amount: 1, pm_amount: 1 })
            ))
        );

        const displayCtx = await browser.newContext();
        const displayPage = await displayCtx.newPage();
        try {
            await displayPage.goto('/');
            await displayPage.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: 'hb_board_id', v: ownerBoardId });
            await displayPage.goto('/board');
            await expect(displayPage.locator('[data-testid="board-view"]')).toBeVisible();

            // Page 1: Col 0, Row 0 - should see breadcrumb for row overflow
            await expect(displayPage.getByTestId('breadcrumb-more')).toBeVisible();

            // After first page advance: should still be on column 0, row 1 (down first)
            // Controller advances page
            await page.reload();
            await page.click('[data-testid="tab-board"]');
            await page.click('[data-testid="toggle-display-controls"]');

            // Need to match TV first to ensure controller next button advances TV page?
            // "Match mode syncs controller to TV page" - actually calling next-page-btn ALWAYS updates boardStore.current_page
            // So we don't strictly need to match, but we need to click next.
            await page.click('[data-testid="next-page-btn"]');

            // Breadcrumb should be gone (last row page for this column)
            await expect(displayPage.getByTestId('breadcrumb-more')).not.toBeVisible();
        } finally {
            await displayCtx.close();
        }
    });
});
