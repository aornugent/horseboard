/**
 * E2E Tests for Display Pagination & Orientation
 *
 * Tests the grid orientation toggle and 2D pagination system for TV displays.
 * Consolidated from grid-orientation.spec.ts and board-orientation.spec.ts.
 */
import { test, expect } from '../fixtures/auth';
import { selectors } from '../selectors';
import { createHorse, createFeed, upsertDiet } from '../helpers/api';

test.describe('Orientation Toggle', () => {
    test('displays toggle in display controls', async ({ ownerPage }) => {
        await ownerPage.locator(selectors.tabBoard).click();
        await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
        await ownerPage.locator('[data-testid="overflow-menu-btn"]').click();
        await expect(ownerPage.locator(selectors.orientationToggle)).toBeVisible();
    });

    test('horse-major is default', async ({ ownerPage }) => {
        await ownerPage.locator(selectors.tabBoard).click();
        await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
        await ownerPage.locator('[data-testid="overflow-menu-btn"]').click();
        await expect(ownerPage.locator(selectors.orientationHorseMajor)).toHaveClass(/active/);
    });

    test('switching resets page to 0', async ({ ownerPage, ownerBoardId, request }) => {
        for (let i = 0; i < 8; i++) {
            const h = await createHorse(request, ownerBoardId, { name: `H${i}` });
            const f = await createFeed(request, ownerBoardId, { name: `F${i}`, unit_label: 'scoop' });
            await upsertDiet(request, { horse_id: h.id, feed_id: f.id, am_amount: 1 });
        }
        await ownerPage.reload();
        await ownerPage.locator(selectors.tabBoard).click();
        await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
        await ownerPage.locator('[data-testid="tv-next-page"]').click();
        await expect(ownerPage.locator(selectors.boardPageIndicator)).toContainText('2');

        await ownerPage.locator('[data-testid="overflow-menu-btn"]').click();
        await ownerPage.locator(selectors.orientationFeedMajor).click();
        await expect(ownerPage.locator(selectors.boardPageIndicator)).toContainText('1');
    });

    test('toggles orientation and updates grid headers', async ({ ownerPage: page, request, ownerBoardId }) => {
        // Setup Data
        const horse = await createHorse(request, ownerBoardId, { name: 'Thunder' });
        const feed = await createFeed(request, ownerBoardId, { name: 'Morning Hay', unit_type: 'int', rank: 1 });
        await upsertDiet(request, { horse_id: horse.id, feed_id: feed.id, am_amount: 1 });

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

        // Open overflow menu to access orientation controls
        await page.click('[data-testid="overflow-menu-btn"]');

        // Default: Horses (verify active class and header)
        await expect(page.getByTestId('orientation-horse-major')).toHaveClass(/active/);
        await expect(page.locator('.horse-header', { hasText: 'Thunder' })).toBeVisible();

        // Switch to Feeds
        await page.click('[data-testid="orientation-feed-major"]');

        // Verify active class switches
        await expect(page.getByTestId('orientation-feed-major')).toHaveClass(/active/);
        await expect(page.getByTestId('orientation-horse-major')).not.toHaveClass(/active/);

        // Verify headers now show feeds
        await expect(page.locator('.horse-header', { hasText: 'Morning Hay' })).toBeVisible();
    });
});

test.describe('TV Display Pagination', () => {
    test('shows page badge with current and total', async ({ ownerPage: page, request, ownerBoardId }) => {
        const feed = await createFeed(request, ownerBoardId, { name: 'Oats' });
        const names = Array.from({ length: 10 }, (_, i) => `Horse${i}`);
        const horses = await Promise.all(names.map(n => createHorse(request, ownerBoardId, { name: n })));
        await Promise.all(horses.map(h => upsertDiet(request, {
            horse_id: h.id, feed_id: feed.id, am_amount: 1
        })));

        await page.goto('/');
        await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: 'hb_board_id', v: ownerBoardId });
        await page.goto('/board');
        await expect(page.getByTestId('page-badge')).toContainText(/1 \/ \d+/);
    });

    test('shows breadcrumb when rows overflow', async ({ ownerPage: page, request, ownerBoardId }) => {
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

            // Controller advances page
            await page.reload();
            await page.click('[data-testid="tab-board"]');
            await page.click('[data-testid="toggle-display-controls"]');
            await page.click('[data-testid="tv-next-page"]');

            // Breadcrumb should be gone (last row page for this column)
            await expect(displayPage.getByTestId('breadcrumb-more')).not.toBeVisible();
        } finally {
            await displayCtx.close();
        }
    });

    test('feed-major shows feeds as columns on TV', async ({ ownerPage, ownerBoardId, request, browser }) => {
        const h = await createHorse(request, ownerBoardId, { name: 'TestHorse' });
        const f = await createFeed(request, ownerBoardId, { name: 'TestFeed', unit_label: 'scoop' });
        await upsertDiet(request, { horse_id: h.id, feed_id: f.id, am_amount: 1 });

        const displayCtx = await browser.newContext();
        const displayPage = await displayCtx.newPage();
        try {
            await displayPage.goto('/');
            await displayPage.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: 'hb_board_id', v: ownerBoardId });
            await displayPage.goto('/board');
            await expect(displayPage.locator(selectors.boardView)).toBeVisible();

            await ownerPage.locator(selectors.tabBoard).click();
            await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
            await ownerPage.locator('[data-testid="overflow-menu-btn"]').click();
            await ownerPage.locator(selectors.orientationFeedMajor).click();

            await expect(displayPage.locator(selectors.gridHeader)).toContainText('TestFeed');
        } finally {
            await displayCtx.close();
        }
    });
});
