import { test, expect } from './fixtures/auth';
import { createHorse, createFeed } from './helpers/api';

test.describe('Grid Orientation', () => {

    test('toggles orientation between Horses and Feeds', async ({ ownerPage: page, request, ownerBoardId }) => {
        // Setup Data
        await createHorse(request, ownerBoardId, { name: 'Thunder' });
        await createFeed(request, ownerBoardId, { name: 'Morning Hay', unit_type: 'int', rank: 1 });

        // Reload page to fetch new data
        await page.reload();
        await expect(page.getByTestId('controller-view')).toBeVisible();

        // Go to Board Preview Tab
        await page.click('[data-testid="tab-board"]');
        await expect(page.getByTestId('board-tab')).toBeVisible();

        // Open Display Controls
        await page.click('[data-testid="toggle-display-controls"]');
        await expect(page.getByTestId('display-controls-drawer')).toBeVisible();

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
