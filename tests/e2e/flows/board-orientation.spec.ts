// tests/e2e/flows/board-orientation.spec.ts
import { test, expect } from '../fixtures/auth';
import { selectors } from '../selectors';
import { createHorse, createFeed, upsertDiet } from '../helpers/api';

test.describe('Orientation Toggle', () => {
    test('displays toggle in display controls', async ({ ownerPage }) => {
        await ownerPage.locator(selectors.tabBoard).click();
        await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
        await expect(ownerPage.locator(selectors.orientationToggle)).toBeVisible();
    });

    test('horse-major is default', async ({ ownerPage }) => {
        await ownerPage.locator(selectors.tabBoard).click();
        await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
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
        await ownerPage.locator(selectors.nextPageBtn).click();
        await expect(ownerPage.locator(selectors.boardPageIndicator)).toContainText('2');

        await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
        await ownerPage.locator(selectors.orientationFeedMajor).click();
        await expect(ownerPage.locator(selectors.boardPageIndicator)).toContainText('1');
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
            await ownerPage.locator(selectors.orientationFeedMajor).click();

            await expect(displayPage.locator(selectors.gridHeader)).toContainText('TestFeed');
        } finally {
            await displayCtx.close();
        }
    });
});

// NOTE: Pagination controls are now always visible (disabled when single page).
// Breadcrumb overflow test coverage is in the breadcrumb-overflow.spec.ts or verified via unit tests.
// Reference view tests are in reference-view.spec.ts.
