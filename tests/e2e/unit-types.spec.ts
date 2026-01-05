import { test, expect } from './fixtures/auth';

test.describe('Unit Types & Formatting', () => {
    test('supports different unit types (Scoop, ML)', async ({ ownerPage }) => {
        // 1. Create feeds with different units
        await ownerPage.locator('[data-testid="tab-feeds"]').click();

        // Add Scoop feed (default)
        await ownerPage.click('[data-testid="add-feed-btn"]');
        await ownerPage.fill('[data-testid="new-feed-name"]', 'Oats');
        // Default unit is Scoop, leave as is
        await ownerPage.click('[data-testid="confirm-add-feed"]');
        await expect(ownerPage.locator('[data-testid="feed-list"]')).toContainText('Oats');

        // Add ML feed (Oil)
        await ownerPage.click('[data-testid="add-feed-btn"]');
        await ownerPage.fill('[data-testid="new-feed-name"]', 'Oil');
        await ownerPage.click('[data-testid="unit-btn-ml"]');
        await ownerPage.click('[data-testid="confirm-add-feed"]');
        await expect(ownerPage.locator('[data-testid="feed-list"]')).toContainText('Oil');

        // 2. Create horse
        await ownerPage.locator('[data-testid="tab-horses"]').click();
        await ownerPage.click('[data-testid="add-horse-btn"]');
        await ownerPage.fill('[data-testid="new-horse-name"]', 'Thunder');
        await ownerPage.click('[data-testid="confirm-add-horse"]');
        await expect(ownerPage.locator('[data-testid="horse-list"]')).toContainText('Thunder');

        // 3. Set diet
        const horseCard = ownerPage.locator('.horse-card').first();
        await horseCard.click();
        await expect(ownerPage.locator('[data-testid="horse-detail-name"]')).toHaveText('Thunder');

        // Set Oats (Scoop) -> AM
        const oatsTile = ownerPage.locator('.feed-tile').filter({ hasText: 'Oats' });
        const oatsAmBtn = oatsTile.locator('.value-button').first();
        await oatsAmBtn.click();

        // FeedPad for Scoop - verify presets (fractional)
        await expect(ownerPage.locator('[data-testid="preset-0.5"]')).toBeVisible();
        await ownerPage.click('[data-testid="preset-0.5"]');
        // Check stepper value updates to ½
        await expect(ownerPage.locator('[data-testid="feed-pad-current"]')).toContainText('½');
        await ownerPage.click('[data-testid="feed-pad-confirm"]');

        // Verify display on tile: "½" (no unit for scoop/fraction)
        await expect(oatsAmBtn.locator('.value-amount')).toHaveText('½');

        // Set Oil (ML) -> PM
        const oilTile = ownerPage.locator('.feed-tile').filter({ hasText: 'Oil' });
        const oilPmBtn = oilTile.locator('.value-button').nth(1);
        await oilPmBtn.click();

        // FeedPad for ML - verify input field
        await expect(ownerPage.locator('[data-testid="feed-pad-input"]')).toBeVisible();
        await expect(ownerPage.locator('[data-testid="feed-pad-input"] input')).toBeVisible();

        await ownerPage.fill('[data-testid="feed-pad-input"] input', '15.5');
        // Wait for state update - display should show "15.5 ml"
        // (Note: FeedPad current display appends unit for non-choice types except fraction default? 
        // Wait, FeedPad.tsx: {unitType !== 'choice' && <span class="feed-pad-current-unit">{unitLabel}</span>}
        // So "15.5" in value, "ml" in unit span.
        await expect(ownerPage.locator('[data-testid="feed-pad-current"] .feed-pad-current-value')).toHaveText('15.5');
        await expect(ownerPage.locator('[data-testid="feed-pad-current"] .feed-pad-current-unit')).toHaveText('ml');

        await ownerPage.click('[data-testid="feed-pad-confirm"]');

        // Verify display on tile: "15.5 ml" 
        // HorseDetail uses strategy.formatDisplay.
        // decimalStrategy.formatDisplay returns "15.5 ml" (appends label).
        await expect(oilPmBtn.locator('.value-amount')).toHaveText('15.5 ml');
    });
});
