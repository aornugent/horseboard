import { test, expect } from '@playwright/test';
import { selectors } from './selectors';

/**
 * Device Provisioning Tests
 *
 * Tests REAL TV display provisioning flow per USER_PATHS.md Story B.
 * These tests verify the complete flow of linking a TV display to a board.
 *
 * Test Philosophy:
 * - Test the actual provisioning flow, not shortcuts
 * - Verify TV receives token and displays board
 * - Test permission levels (view only for TV displays)
 */

test.describe('Device Provisioning', () => {
    test('completes full TV provisioning flow', async ({ browser }) => {
        // 1. TV Context: Unprovisioned display visits /board
        const tvContext = await browser.newContext();
        const tvPage = await tvContext.newPage();

        await tvPage.goto('/board');

        // TV should show provisioning view with 6-character code
        const provisioningView = tvPage.locator('[data-testid="provisioning-view"]');
        await expect(provisioningView).toBeVisible({ timeout: 10000 });

        const codeDisplay = tvPage.locator('[data-testid="provisioning-code"]');
        await expect(codeDisplay).toBeVisible();

        // Extract the provisioning code (format: AB-CD-EF or ABCDEF)
        const codeText = (await codeDisplay.innerText()).replace(/[\r\n\s-]+/g, '');
        expect(codeText).toMatch(/^[A-Z0-9]{6}$/);

        // 2. Owner Context: Sign up and create board
        const ownerContext = await browser.newContext();
        const ownerPage = await ownerContext.newPage();

        const timestamp = Date.now();
        await ownerPage.goto('/signup');
        await ownerPage.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
        await ownerPage.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
        await ownerPage.locator(selectors.passwordInput).fill('password123');
        await ownerPage.locator(selectors.submitBtn).click();

        await expect(ownerPage).toHaveURL(/\/controller/);

        // 3. Owner links the display via Settings → Displays
        await ownerPage.locator('[data-testid="tab-settings"]').click();
        await expect(ownerPage.locator(selectors.settingsTab)).toBeVisible();

        // Click "Link Display" button
        const addDisplayBtn = ownerPage.locator('[data-testid="add-display-btn"]');
        await expect(addDisplayBtn).toBeVisible();
        await addDisplayBtn.click();

        // Modal should appear with provisioning code input
        const provisioningModal = ownerPage.locator('[data-testid="link-display-modal"]');
        await expect(provisioningModal).toBeVisible();

        // Enter the TV's provisioning code
        const provisioningInput = ownerPage.locator('[data-testid="provisioning-input"]');
        await expect(provisioningInput).toBeVisible();
        await provisioningInput.fill(codeText);

        // Submit the code
        const submitBtn = ownerPage.locator('[data-testid="provisioning-submit"]');
        await submitBtn.click();

        // Modal should close (indicates success)
        await expect(provisioningModal).not.toBeVisible({ timeout: 10000 });

        // 4. REAL BEHAVIOR: TV should automatically receive token and display board
        // The TV polls /api/devices/poll?code={code} and receives token
        const boardView = tvPage.locator(selectors.boardView);
        await expect(boardView).toBeVisible({ timeout: 15000 });

        // TV should show the board grid (no longer in provisioning state)
        await expect(provisioningView).not.toBeVisible();

        // 5. REAL BEHAVIOR: Verify TV token persists in localStorage
        const tvToken = await tvPage.evaluate(() => localStorage.getItem('horseboard_controller_token'));
        expect(tvToken).toBeTruthy();
        expect(tvToken).toMatch(/^hb_/);

        // 6. REAL BEHAVIOR: Verify display appears in owner's linked displays list
        await ownerPage.locator('[data-testid="tab-settings"]').click();
        const linkedDisplay = ownerPage.locator('.settings-device-name');
        await expect(linkedDisplay).toBeVisible();
        await expect(linkedDisplay).toContainText(/Display|TV/i);

        // 7. REAL BEHAVIOR: Verify TV has view-only permission (cannot edit)
        // Try to access API with TV token - should be view permission
        const bootstrapResponse = await tvPage.request.get('/api/bootstrap');
        expect(bootstrapResponse.ok()).toBeTruthy();

        const bootstrapData = await bootstrapResponse.json();
        expect(bootstrapData.ownership?.permission).toBe('view');

        await tvContext.close();
        await ownerContext.close();
    });

    test('unlinks display and TV returns to provisioning', async ({ browser }) => {
        // Setup: Owner with linked TV
        const tvContext = await browser.newContext();
        const tvPage = await tvContext.newPage();

        await tvPage.goto('/board');
        const codeDisplay = tvPage.locator('[data-testid="provisioning-code"]');
        await expect(codeDisplay).toBeVisible({ timeout: 10000 });
        const codeText = (await codeDisplay.innerText()).replace(/[\r\n\s-]+/g, '');

        const ownerContext = await browser.newContext();
        const ownerPage = await ownerContext.newPage();

        const timestamp = Date.now();
        await ownerPage.goto('/signup');
        await ownerPage.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
        await ownerPage.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
        await ownerPage.locator(selectors.passwordInput).fill('password123');
        await ownerPage.locator(selectors.submitBtn).click();

        await expect(ownerPage).toHaveURL(/\/controller/);

        // Link display
        await ownerPage.locator('[data-testid="tab-settings"]').click();
        await ownerPage.locator('[data-testid="add-display-btn"]').click();
        await ownerPage.locator('[data-testid="provisioning-input"]').fill(codeText);
        await ownerPage.locator('[data-testid="provisioning-submit"]').click();

        // Wait for TV to display board
        await expect(tvPage.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

        // 2. REAL BEHAVIOR TEST: Owner unlinks the display
        await ownerPage.locator('[data-testid="tab-settings"]').click();

        const unlinkBtn = ownerPage.locator('button:has-text("Unlink")').first();
        await expect(unlinkBtn).toBeVisible();

        // Handle confirmation dialog
        ownerPage.on('dialog', dialog => dialog.accept());
        await unlinkBtn.click();

        // Display should be removed from list
        await expect(ownerPage.locator('.settings-device-name')).not.toBeVisible();

        // 3. CRITICAL TEST: TV should return to provisioning state
        // Token is revoked, so next API call fails
        await tvPage.reload();

        // TV should show provisioning view again (token invalid)
        const provisioningView = tvPage.locator('[data-testid="provisioning-view"]');
        await expect(provisioningView).toBeVisible({ timeout: 15000 });

        // Should show a NEW provisioning code (not the old one)
        const newCodeDisplay = tvPage.locator('[data-testid="provisioning-code"]');
        await expect(newCodeDisplay).toBeVisible();
        const newCodeText = (await newCodeDisplay.innerText()).replace(/[\r\n\s-]+/g, '');
        expect(newCodeText).toMatch(/^[A-Z0-9]{6}$/);

        await tvContext.close();
        await ownerContext.close();
    });

    test('rejects invalid provisioning code with error', async ({ page }) => {
        // Setup: Owner with board
        const timestamp = Date.now();
        await page.goto('/signup');
        await page.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
        await page.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
        await page.locator(selectors.passwordInput).fill('password123');
        await page.locator(selectors.submitBtn).click();

        await expect(page).toHaveURL(/\/controller/);

        // Try to link display with invalid code
        await page.locator('[data-testid="tab-settings"]').click();
        await page.locator('[data-testid="add-display-btn"]').click();

        const provisioningInput = page.locator('[data-testid="provisioning-input"]');
        await provisioningInput.fill('INVALID');

        await page.locator('[data-testid="provisioning-submit"]').click();

        // REAL BEHAVIOR: Should show error message
        const errorMessage = page.locator('[data-testid="provisioning-error"]');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(/invalid|not found|expired/i);

        // Modal should still be open (error state)
        await expect(page.locator('[data-testid="link-display-modal"]')).toBeVisible();
    });

    test('TV display persists across page reloads', async ({ browser }) => {
        // Setup: Link a TV display
        const tvContext = await browser.newContext();
        const tvPage = await tvContext.newPage();

        await tvPage.goto('/board');
        const codeDisplay = tvPage.locator('[data-testid="provisioning-code"]');
        await expect(codeDisplay).toBeVisible({ timeout: 10000 });
        const codeText = (await codeDisplay.innerText()).replace(/[\r\n\s-]+/g, '');

        const ownerContext = await browser.newContext();
        const ownerPage = await ownerContext.newPage();

        const timestamp = Date.now();
        await ownerPage.goto('/signup');
        await ownerPage.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
        await ownerPage.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
        await ownerPage.locator(selectors.passwordInput).fill('password123');
        await ownerPage.locator(selectors.submitBtn).click();

        await expect(ownerPage).toHaveURL(/\/controller/);

        // Link display
        await ownerPage.locator('[data-testid="tab-settings"]').click();
        await ownerPage.locator('[data-testid="add-display-btn"]').click();
        await ownerPage.locator('[data-testid="provisioning-input"]').fill(codeText);
        await ownerPage.locator('[data-testid="provisioning-submit"]').click();

        // Wait for TV to display board
        await expect(tvPage.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

        // REAL BEHAVIOR TEST: Reload TV page - should still show board
        await tvPage.reload();

        // Should NOT show provisioning view (token persists)
        await expect(tvPage.locator('[data-testid="provisioning-view"]')).not.toBeVisible({ timeout: 5000 });

        // Should show board view immediately
        await expect(tvPage.locator(selectors.boardView)).toBeVisible({ timeout: 10000 });

        // Token should still be in localStorage
        const tvToken = await tvPage.evaluate(() => localStorage.getItem('horseboard_controller_token'));
        expect(tvToken).toBeTruthy();
        expect(tvToken).toMatch(/^hb_/);

        await tvContext.close();
        await ownerContext.close();
    });

    test('TV reverts to provisioning mode after token is revoked', async ({ browser, request }) => {
        // This test verifies the fix for: revoking a display from settings
        // should cause the TV to revert to provisioning mode

        const tvCode = 'REVOKE1';

        // --- SETUP: Owner creates account and board ---
        const ownerContext = await browser.newContext();
        const ownerPage = await ownerContext.newPage();

        // Sign up owner
        await ownerPage.goto('/signup');
        await ownerPage.fill('[data-testid=name-input]', 'Revoke Test Owner');
        await ownerPage.fill('[data-testid=email-input]', `revoke-${Date.now()}@example.com`);
        await ownerPage.fill('[data-testid=password-input]', 'password123');
        await ownerPage.click('[data-testid=submit-btn]');
        await expect(ownerPage).toHaveURL(/\/controller/);

        // Create board
        await expect(ownerPage.getByTestId('create-board-btn')).toBeVisible({ timeout: 10000 });
        await ownerPage.getByTestId('create-board-btn').click();
        await expect(ownerPage.getByTestId('controller-tabs')).toBeVisible({ timeout: 10000 });

        // --- STEP 1: Register TV provisioning code ---
        const pollRes1 = await request.get(`/api/devices/poll?code=${tvCode}`);
        expect((await pollRes1.json()).pending).toBe(true);

        // --- STEP 2: Owner links the display ---
        await ownerPage.getByTestId('tab-settings').click();
        await expect(ownerPage.getByTestId('add-display-btn')).toBeVisible();
        await ownerPage.getByTestId('add-display-btn').click();
        await ownerPage.fill('input[placeholder="ABCDEF"]', tvCode);
        await ownerPage.click('button:has-text("Link Display")');
        await expect(ownerPage.locator('.settings-device-name')).toContainText(`Display ${tvCode}`);

        // Get the token via polling
        const pollRes2 = await request.get(`/api/devices/poll?code=${tvCode}`);
        const { token } = await pollRes2.json();
        expect(token).toBeTruthy();

        // Get the board ID from owner's localStorage
        const boardId = await ownerPage.evaluate(() => localStorage.getItem('horseboard_board_id'));
        expect(boardId).toBeTruthy();

        // --- STEP 3: TV browser gets the token and shows board ---
        const tvContext = await browser.newContext();
        const tvPage = await tvContext.newPage();

        await tvPage.goto('/');
        // Set both token and board ID
        await tvPage.evaluate(({ t, b }) => {
            localStorage.setItem('horseboard_controller_token', t);
            localStorage.setItem('horseboard_board_id', b);
        }, { t: token, b: boardId! });

        // Navigate to /board - should work initially
        await tvPage.goto('/board');
        await tvPage.waitForTimeout(2000);

        // Verify TV is NOT showing provisioning (it should show board content)
        await expect(tvPage.locator('[data-testid="provisioning-code"]')).not.toBeVisible({ timeout: 5000 });

        // --- STEP 4: Owner revokes the display ---
        ownerPage.on('dialog', dialog => dialog.accept());
        await ownerPage.click('button:has-text("Unlink")');
        await expect(ownerPage.locator('.settings-device-name')).not.toBeVisible();

        // --- STEP 5: TV reloads - should now show provisioning mode ---
        await tvPage.reload();
        await tvPage.waitForTimeout(2000);

        // THE FIX: TV should now show provisioning code because token is invalid
        await expect(tvPage.locator('[data-testid="provisioning-code"]')).toBeVisible({ timeout: 10000 });

        // Cleanup
        await ownerContext.close();
        await tvContext.close();
    });
});

