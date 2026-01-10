/**
 * E2E Tests for BoardTab Match TV Mode
 *
 * Tests that the BoardTab grid correctly paginates when "Match TV" is enabled,
 * matching the exact view shown on the TV display.
 */
import { test, expect } from '../fixtures/auth';
import { selectors } from '../selectors';
import { createHorse, createFeed, upsertDiet } from '../helpers/api';

// Test data sizes for comprehensive pagination coverage
const HORSE_COUNT = 12; // Enough for 2 pages at all zoom levels (S=8, M=6, L=4)
const FEED_COUNT = 15;  // Enough for row pagination (rowPageSize=10)

test.describe('BoardTab Match TV Mode', () => {
    // Helper to create test data
    async function seedTestData(request: any, boardId: string) {
        const horses = await Promise.all(
            Array.from({ length: HORSE_COUNT }, (_, i) =>
                createHorse(request, boardId, { name: `Horse${String(i + 1).padStart(2, '0')}` })
            )
        );
        const feeds = await Promise.all(
            Array.from({ length: FEED_COUNT }, (_, i) =>
                createFeed(request, boardId, { name: `Feed${String(i + 1).padStart(2, '0')}` })
            )
        );
        // Create diet entries for all combinations
        await Promise.all(
            horses.flatMap(h =>
                feeds.map(f =>
                    upsertDiet(request, { horse_id: h.id, feed_id: f.id, am_amount: 1, pm_amount: 1 })
                )
            )
        );
        return { horses, feeds };
    }

    test('Match TV shows paginated grid matching TV display', async ({ ownerPage: page, request, ownerBoardId }) => {
        await seedTestData(request, ownerBoardId);
        await page.reload();

        // Navigate to Board tab and open controls
        await page.locator(selectors.tabBoard).click();
        await page.locator('[data-testid="toggle-display-controls"]').click();

        // Enable Match TV
        await page.locator('[data-testid="match-tv-toggle"]').click();

        // Default zoom is M (6 columns) - should see only 6 horses
        const gridHeaders = page.locator('.horse-header');
        await expect(gridHeaders).toHaveCount(6);

        // Verify first 6 horses are visible (Horse01-Horse06)
        await expect(page.locator('.horse-header').first()).toContainText('Horse01');
    });

    test('pagination controls change grid content when Match TV is enabled', async ({ ownerPage: page, request, ownerBoardId }) => {
        await seedTestData(request, ownerBoardId);
        await page.reload();

        // Navigate to Board tab and open controls
        await page.locator(selectors.tabBoard).click();
        await page.locator('[data-testid="toggle-display-controls"]').click();

        // Enable Match TV
        await page.locator('[data-testid="match-tv-toggle"]').click();

        // Page 1: Should show Horse01-Horse06 and page indicator "1 / X"
        await expect(page.locator('.horse-header').first()).toContainText('Horse01');
        await expect(page.locator(selectors.boardPageIndicator)).toContainText('1 /');

        // Click next page
        await page.locator(selectors.tvNextPage).click();

        // Page should advance - indicator should show page 2
        await expect(page.locator(selectors.boardPageIndicator)).toContainText('2 /');
    });

    test('zoom level S (8 cols) shows correct pagination', async ({ ownerPage: page, request, ownerBoardId }) => {
        await seedTestData(request, ownerBoardId);
        await page.reload();

        // Navigate to Board tab and open controls
        await page.locator(selectors.tabBoard).click();
        await page.locator('[data-testid="toggle-display-controls"]').click();

        // Enable Match TV
        await page.locator('[data-testid="match-tv-toggle"]').click();

        // Open overflow menu and change zoom to S
        await page.locator('[data-testid="overflow-menu-btn"]').click();
        await page.locator('[data-testid="zoom-level-1"]').click();

        // Should see 8 horses at zoom S
        const gridHeaders = page.locator('.horse-header');
        await expect(gridHeaders).toHaveCount(8);
    });

    test('zoom level L (4 cols) shows correct pagination', async ({ ownerPage: page, request, ownerBoardId }) => {
        await seedTestData(request, ownerBoardId);
        await page.reload();

        // Navigate to Board tab and open controls
        await page.locator(selectors.tabBoard).click();
        await page.locator('[data-testid="toggle-display-controls"]').click();

        // Enable Match TV
        await page.locator('[data-testid="match-tv-toggle"]').click();

        // Open overflow menu and change zoom to L
        await page.locator('[data-testid="overflow-menu-btn"]').click();
        await page.locator('[data-testid="zoom-level-3"]').click();

        // Should see 4 horses at zoom L
        const gridHeaders = page.locator('.horse-header');
        await expect(gridHeaders).toHaveCount(4);
    });

    test('feed-major orientation shows feeds as columns', async ({ ownerPage: page, request, ownerBoardId }) => {
        await seedTestData(request, ownerBoardId);
        await page.reload();

        // Navigate to Board tab and open controls
        await page.locator(selectors.tabBoard).click();
        await page.locator('[data-testid="toggle-display-controls"]').click();

        // Enable Match TV
        await page.locator('[data-testid="match-tv-toggle"]').click();

        // Open overflow menu and switch to feed-major
        await page.locator('[data-testid="overflow-menu-btn"]').click();
        await page.locator(selectors.orientationFeedMajor).click();

        // Headers should now show feed names instead of horse names
        await expect(page.locator('.horse-header').first()).toContainText('Feed');
    });

    test('shows breadcrumb for row overflow when Match TV enabled', async ({ ownerPage: page, request, ownerBoardId }) => {
        await seedTestData(request, ownerBoardId);
        await page.reload();

        // Navigate to Board tab and open controls
        await page.locator(selectors.tabBoard).click();
        await page.locator('[data-testid="toggle-display-controls"]').click();

        // Enable Match TV (with 15 feeds and rowPageSize=10, should have overflow)
        await page.locator('[data-testid="match-tv-toggle"]').click();

        // Should show breadcrumb indicating more rows below
        await expect(page.locator(selectors.breadcrumbMore)).toBeVisible();
        await expect(page.locator(selectors.breadcrumbMore)).toContainText('more');
    });

    test('page indicator shows correct total pages', async ({ ownerPage: page, request, ownerBoardId }) => {
        await seedTestData(request, ownerBoardId);
        await page.reload();

        // Navigate to Board tab and open controls
        await page.locator(selectors.tabBoard).click();
        await page.locator('[data-testid="toggle-display-controls"]').click();

        // Page indicator should show "X / Y" format
        const indicator = page.locator(selectors.boardPageIndicator);
        await expect(indicator).toContainText('/');

        // With 12 horses, 6 per page (zoom M), and 15 feeds with rowPageSize 10 (2 row pages)
        // Total pages = 2 col pages × 2 row pages = 4
        await expect(indicator).toContainText('1 / 4');
    });

    test('disables next button on last page', async ({ ownerPage: page, request, ownerBoardId }) => {
        await seedTestData(request, ownerBoardId);
        await page.reload();

        // Navigate to Board tab and open controls
        await page.locator(selectors.tabBoard).click();
        await page.locator('[data-testid="toggle-display-controls"]').click();

        // Navigate to last page (4 pages total at zoom M)
        for (let i = 0; i < 3; i++) {
            await page.locator(selectors.tvNextPage).click();
        }

        // Next button should be disabled
        await expect(page.locator(selectors.tvNextPage)).toBeDisabled();

        // Page indicator should show last page
        await expect(page.locator(selectors.boardPageIndicator)).toContainText('4 / 4');
    });

    test('infinite scroll when Match TV is disabled', async ({ ownerPage: page, request, ownerBoardId }) => {
        await seedTestData(request, ownerBoardId);
        await page.reload();

        // Navigate to Board tab (Match TV is off by default)
        await page.locator(selectors.tabBoard).click();

        // Should see ALL 12 horses when not matching TV (infinite scroll)
        const gridHeaders = page.locator('.horse-header');
        await expect(gridHeaders).toHaveCount(12);
    });

    test('header controls visible by default, hidden when matched', async ({ ownerPage: page }) => {
        await page.reload();
        await page.click('[data-testid="tab-board"]');

        // Header controls visible by default
        await expect(page.getByTestId('header-time-toggle')).toBeVisible();
        await expect(page.getByTestId('header-flip-btn')).toBeVisible();

        // Open drawer, wait for it to be visible
        await page.click('[data-testid="toggle-display-controls"]');
        await expect(page.locator('[data-testid="display-controls-drawer"]')).toBeVisible();

        // Enable Match TV - use evaluate to click checkbox directly (fixed drawer may be outside viewport)
        await page.evaluate(() => {
            const checkbox = document.querySelector('[data-testid="match-tv-toggle"] input') as HTMLInputElement;
            checkbox.click();
        });

        // Header controls hidden
        await expect(page.getByTestId('header-time-toggle')).not.toBeVisible();
        await expect(page.getByTestId('header-flip-btn')).not.toBeVisible();
    });
});
