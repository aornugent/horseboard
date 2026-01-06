import { test, expect } from './fixtures/auth';
import { createHorse, createFeed, upsertDiet } from './helpers/api';

test.describe('Reference View', () => {

    test('navigates to Reference tab and shows unpaginated grid', async ({ ownerPage: page, request, ownerBoardId }) => {
        // Setup Data: Horse, Feed, and Diet Entry (so sparse filtering shows the row)
        const horse = await createHorse(request, ownerBoardId, { name: 'Thunder' });
        const feed = await createFeed(request, ownerBoardId, { name: 'Hay', rank: 1, unit_type: 'int' });
        await upsertDiet(request, {
            horse_id: horse.id,
            feed_id: feed.id,
            am_amount: 1,
            pm_amount: 1
        });

        await page.reload();
        await expect(page.getByTestId('controller-view')).toBeVisible();

        // Navigate to Reference Tab
        await page.click('[data-testid="tab-reference"]');

        // Verify Reference View is visible
        await expect(page.getByTestId('reference-tab')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Reference View' })).toBeVisible();

        // Verify Grid is present
        await expect(page.getByTestId('swim-lane-grid')).toBeVisible();

        // Verify Thunder is visible
        await expect(page.getByText('Thunder')).toBeVisible();

        // Verify cell is visible but NOT editable
        await expect(page.locator('.grid-cell').first()).toBeVisible();
        await expect(page.locator('.grid-cell--editable')).not.toBeVisible();

        // Verify scoop badge shows value (1)
        await expect(page.getByText('1')).toBeVisible();
    });

    test('shows all horses without pagination (more than TV pageSize)', async ({ ownerPage: page, request, ownerBoardId }) => {
        // Create a feed
        const feed = await createFeed(request, ownerBoardId, { name: 'Oats', rank: 1, unit_type: 'int' });

        // Create 8 horses (more than default TV pageSize of 6)
        const horseNames = ['Apollo', 'Bella', 'Charlie', 'Dusty', 'Echo', 'Frosty', 'Glory', 'Hunter'];
        const horses = await Promise.all(
            horseNames.map(name => createHorse(request, ownerBoardId, { name }))
        );

        // Give each horse a diet entry so sparse filtering includes them
        await Promise.all(
            horses.map(horse =>
                upsertDiet(request, {
                    horse_id: horse.id,
                    feed_id: feed.id,
                    am_amount: 1,
                    pm_amount: 1
                })
            )
        );

        await page.reload();
        await expect(page.getByTestId('controller-view')).toBeVisible();

        // Navigate to Reference Tab
        await page.click('[data-testid="tab-reference"]');
        await expect(page.getByTestId('reference-tab')).toBeVisible();

        // Verify ALL 8 horses are visible (no pagination)
        for (const name of horseNames) {
            await expect(page.getByText(name)).toBeVisible();
        }

        // Verify no "more below" breadcrumb (unpaginated = no overflow)
        await expect(page.locator('[data-testid="breadcrumb-more"]')).not.toBeVisible();
    });
});

