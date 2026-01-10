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
        const horseCard = ownerPage.locator('.list-card').first();
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
    test('int type shows integer stepper with step=1', async ({ ownerPage }) => {
        // Create int-type feed
        await ownerPage.locator('[data-testid="tab-feeds"]').click();
        await ownerPage.click('[data-testid="add-feed-btn"]');
        await ownerPage.fill('[data-testid="new-feed-name"]', 'Biscuits');
        await ownerPage.click('[data-testid="unit-btn-biscuit"]');
        await ownerPage.click('[data-testid="confirm-add-feed"]');
        await expect(ownerPage.locator('[data-testid="feed-list"]')).toContainText('Biscuits');

        // Create horse
        await ownerPage.locator('[data-testid="tab-horses"]').click();
        await ownerPage.click('[data-testid="add-horse-btn"]');
        await ownerPage.fill('[data-testid="new-horse-name"]', 'Blaze');
        await ownerPage.click('[data-testid="confirm-add-horse"]');

        // Navigate to horse detail
        const horseCard = ownerPage.locator('.list-card').first();
        await horseCard.click();
        await expect(ownerPage.locator('[data-testid="horse-detail-name"]')).toHaveText('Blaze');

        // Open FeedPad for Biscuits
        const biscuitTile = ownerPage.locator('.feed-tile').filter({ hasText: 'Biscuits' });
        const biscuitAmBtn = biscuitTile.locator('.value-button').first();
        await biscuitAmBtn.click();

        // Verify stepper is visible (int type has stepper)
        await expect(ownerPage.locator('[data-testid="feed-pad-stepper"]')).toBeVisible();
        // Verify NO decimal input (that's for decimal type only)
        await expect(ownerPage.locator('[data-testid="feed-pad-input"]')).not.toBeVisible();

        // Verify presets are integer values (1, 2, 3)
        await expect(ownerPage.locator('[data-testid="preset-1"]')).toBeVisible();
        await expect(ownerPage.locator('[data-testid="preset-2"]')).toBeVisible();
        await expect(ownerPage.locator('[data-testid="preset-3"]')).toBeVisible();
        // No fractional presets
        await expect(ownerPage.locator('[data-testid="preset-0.5"]')).not.toBeVisible();

        // Click increment - should go from 0 to 1 (step=1)
        await ownerPage.click('[data-testid="stepper-increment"]');
        await expect(ownerPage.locator('[data-testid="feed-pad-current"] .feed-pad-current-value')).toHaveText('1');

        // Click increment again - should go to 2
        await ownerPage.click('[data-testid="stepper-increment"]');
        await expect(ownerPage.locator('[data-testid="feed-pad-current"] .feed-pad-current-value')).toHaveText('2');

        await ownerPage.click('[data-testid="feed-pad-confirm"]');

        // Verify display shows "2" (no fraction)
        await expect(biscuitAmBtn.locator('.value-amount')).toHaveText('2');
    });

    test('supports custom unit creation', async ({ ownerPage }) => {
        await ownerPage.locator('[data-testid="tab-feeds"]').click();
        await ownerPage.click('[data-testid="add-feed-btn"]');
        await ownerPage.fill('[data-testid="new-feed-name"]', 'Supplements');

        // Click Custom toggle
        await ownerPage.click('[data-testid="unit-btn-custom"]');

        // Select Integer type and enter label
        await ownerPage.click('[data-testid="custom-type-int"]');
        await ownerPage.fill('[data-testid="custom-label-input"]', 'tablets');

        await ownerPage.click('[data-testid="confirm-add-feed"]');
        await expect(ownerPage.locator('[data-testid="feed-list"]')).toContainText('Supplements');

        // Verify feed card shows custom label
        const feedCard = ownerPage.locator('.list-card').filter({ hasText: 'Supplements' });
        await expect(feedCard.locator('.list-card-badge')).toHaveText('tablets');

        // Create horse to test FeedPad uses correct type
        await ownerPage.locator('[data-testid="tab-horses"]').click();
        await ownerPage.click('[data-testid="add-horse-btn"]');
        await ownerPage.fill('[data-testid="new-horse-name"]', 'Star');
        await ownerPage.click('[data-testid="confirm-add-horse"]');

        const horseCard = ownerPage.locator('.list-card').first();
        await horseCard.click();

        // Open FeedPad for Supplements - should be integer type
        const suppTile = ownerPage.locator('.feed-tile').filter({ hasText: 'Supplements' });
        const suppAmBtn = suppTile.locator('.value-button').first();
        await suppAmBtn.click();

        // Verify integer stepper (not decimal input)
        await expect(ownerPage.locator('[data-testid="feed-pad-stepper"]')).toBeVisible();
        await expect(ownerPage.locator('[data-testid="feed-pad-input"]')).not.toBeVisible();

        await ownerPage.click('[data-testid="feed-pad-confirm"]');
    });

    test('can edit a feed with custom unit', async ({ ownerPage }) => {
        // Create custom feed first
        await ownerPage.locator('[data-testid="tab-feeds"]').click();
        await ownerPage.click('[data-testid="add-feed-btn"]');
        await ownerPage.fill('[data-testid="new-feed-name"]', 'Electrolytes');
        await ownerPage.click('[data-testid="unit-btn-custom"]');
        await ownerPage.click('[data-testid="custom-type-decimal"]');
        await ownerPage.fill('[data-testid="custom-label-input"]', 'grams');
        await ownerPage.click('[data-testid="confirm-add-feed"]');

        // Edit the feed - click on the card content area
        const feedCard = ownerPage.locator('.list-card').filter({ hasText: 'Electrolytes' });
        await feedCard.locator('.list-card-content').click();

        // Verify edit modal shows custom state correctly
        await expect(ownerPage.locator('[data-testid="unit-btn-custom"]')).toHaveClass(/active/);
        await expect(ownerPage.locator('[data-testid="custom-type-decimal"]')).toHaveClass(/active/);
        await expect(ownerPage.locator('[data-testid="custom-label-input"]')).toHaveValue('grams');

        // Change label
        await ownerPage.fill('[data-testid="custom-label-input"]', 'g');
        await ownerPage.click('[data-testid="confirm-edit-feed"]');

        // Verify updated
        await expect(feedCard.locator('.list-card-badge')).toHaveText('g');
    });
});
