import { test, expect } from './fixtures/auth';
import { selectors } from './selectors';
import { deleteBoard } from './helpers/api';

/**
 * Device Provisioning Tests
 *
 * Tests REAL TV display provisioning flow per USER_PATHS.md Story B.
 * These tests verify the complete flow of linking a TV display to a board.
 */
test.describe('Device Provisioning', () => {
    test('completes full TV provisioning flow', async ({ browser, ownerPage, ownerBoardId }) => {
        // 1. TV Context: Unprovisioned display visits /board
        const tvContext = await browser.newContext();
        const tvPage = await tvContext.newPage();

        await tvPage.goto('/board');

        // TV should show provisioning view with 6-character code
        const provisioningView = tvPage.locator('[data-testid="provisioning-view"]');
        await expect(provisioningView).toBeVisible({ timeout: 10000 });

        const codeDisplay = tvPage.locator('[data-testid="provisioning-code"]');
        await expect(codeDisplay).toBeVisible();

        const codeText = (await codeDisplay.innerText()).replace(/[\r\n\s-]+/g, '');
        expect(codeText).toMatch(/^[A-Z0-9]{6}$/);

        // 2. Owner links the display via Settings
        await ownerPage.locator('[data-testid="tab-settings"]').click();
        await expect(ownerPage.locator(selectors.settingsTab)).toBeVisible();

        // Click "Link Display" button
        const addDisplayBtn = ownerPage.locator('[data-testid="add-display-btn"]');
        await expect(addDisplayBtn).toBeVisible();
        await addDisplayBtn.click();

        // Modal should appear
        const provisioningModal = ownerPage.locator('[data-testid="link-display-modal"]');
        await expect(provisioningModal).toBeVisible();

        // Enter code
        const provisioningInput = ownerPage.locator('[data-testid="provisioning-input"]');
        await provisioningInput.fill(codeText);
        await ownerPage.locator('[data-testid="provisioning-submit"]').click();

        // Modal should close
        await expect(provisioningModal).not.toBeVisible({ timeout: 10000 });

        // 3. TV should automatically receive token and display board
        await expect(tvPage.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });
        await expect(provisioningView).not.toBeVisible();

        // 4. Verify TV token persists
        const tvToken = await tvPage.evaluate(() => localStorage.getItem('hb_token'));
        expect(tvToken).toBeTruthy();

        // 5. Verify display appears in owner's linked displays list
        const linkedDisplay = ownerPage.locator('.settings-device-name').filter({ hasText: 'Display' });
        await expect(linkedDisplay).toBeVisible();

        // Cleanup
        await tvContext.close();
    });

    test('unlinks display and TV returns to provisioning', async ({ browser, ownerPage, ownerBoardId }) => {
        // Setup: Link a TV display first
        const tvContext = await browser.newContext();
        const tvPage = await tvContext.newPage();

        await tvPage.goto('/board');
        const codeDisplay = tvPage.locator('[data-testid="provisioning-code"]');
        await expect(codeDisplay).toBeVisible({ timeout: 10000 });
        const codeText = (await codeDisplay.innerText()).replace(/[\r\n\s-]+/g, '');

        // Link it
        await ownerPage.locator('[data-testid="tab-settings"]').click();
        await ownerPage.locator('[data-testid="add-display-btn"]').click();
        await ownerPage.locator('[data-testid="provisioning-input"]').fill(codeText);
        await ownerPage.locator('[data-testid="provisioning-submit"]').click();

        // Wait for connection
        await expect(tvPage.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

        // Owner unlinks
        const unlinkBtn = ownerPage.locator('button:has-text("Unlink")').first();
        await expect(unlinkBtn).toBeVisible();

        // Handle dialog
        ownerPage.on('dialog', dialog => dialog.accept());
        await unlinkBtn.click();

        // Display removed from list
        await expect(ownerPage.locator('.settings-device-name')).not.toBeVisible({ timeout: 5000 });

        // TV should revert to provisioning
        // Token revoked -> API fails -> revert
        await tvPage.reload();
        await expect(tvPage.locator('[data-testid="provisioning-view"]')).toBeVisible({ timeout: 15000 });

        await tvContext.close();
    });

    test('rejects invalid provisioning code with error', async ({ ownerPage }) => {
        // Go to settings
        await ownerPage.locator('[data-testid="tab-settings"]').click();
        await ownerPage.locator('[data-testid="add-display-btn"]').click();

        // Enter invalid code
        await ownerPage.locator('[data-testid="provisioning-input"]').fill('INVALID');
        await ownerPage.locator('[data-testid="provisioning-submit"]').click();

        // Verify error
        const errorMessage = ownerPage.locator('[data-testid="provisioning-error"]');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(/invalid|not found|expired/i);
    });

    test('TV display persists across page reloads', async ({ browser, ownerPage }) => {
        // Setup: Link TV
        const tvContext = await browser.newContext();
        const tvPage = await tvContext.newPage();

        await tvPage.goto('/board');
        const codeDisplay = tvPage.locator('[data-testid="provisioning-code"]');
        await expect(codeDisplay).toBeVisible({ timeout: 10000 });
        const codeText = (await codeDisplay.innerText()).replace(/[\r\n\s-]+/g, '');

        // Link
        await ownerPage.locator('[data-testid="tab-settings"]').click();
        await ownerPage.locator('[data-testid="add-display-btn"]').click();
        await ownerPage.locator('[data-testid="provisioning-input"]').fill(codeText);
        await ownerPage.locator('[data-testid="provisioning-submit"]').click();

        // Wait for connection
        await expect(tvPage.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

        // Reload TV
        await tvPage.reload();

        // Should still show board
        await expect(tvPage.locator(selectors.boardView)).toBeVisible({ timeout: 10000 });
        await expect(tvPage.locator('[data-testid="provisioning-view"]')).not.toBeVisible();

        await tvContext.close();
    });

    // The logic of "TV reverts to provisioning mode after token is revoked" is covered by "unlinks display..." test above.
    // The original file had a specific test for manual token revocation via API (steps 244+).
    // I can adapt that if needed or consider it covered. 
    // The "unlinks display" test covers the UI flow which triggers the same API.
    // I will include the "TV reverts..." test logic in the "unlinks display" test (already done).
});
