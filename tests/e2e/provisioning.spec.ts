import { test, expect } from '@playwright/test';

test.describe('Device Provisioning', () => {
    test('Complete provisioning flow', async ({ page, request }) => {
        // 1. Simulate TV requesting code polling
        // We just poll once to "register" the code if needed, or just let controller link
        const tvCode = 'TEST01';
        const pollRes1 = await request.get(`/api/devices/poll?code=${tvCode}`);
        const pollData1 = await pollRes1.json();
        expect(pollData1.pending).toBe(true);

        // 2. Login as Controller
        // Assuming simple auth setup or using existing setup helpers
        // We'll use the signup flow quickly
        await page.goto('/signup');
        await page.fill('[data-testid=name-input]', 'Test User');
        await page.fill('[data-testid=email-input]', `test-${Date.now()}@example.com`);
        await page.fill('[data-testid=password-input]', 'password123');
        await page.click('[data-testid=submit-btn]');

        // Wait for redirect to controller
        await expect(page).toHaveURL(/\/controller/);

        // Create a board first (if needed, but signup usually auto-creates or prompts)
        // Check if we are on controller main page
        await expect(page.getByTestId('controller-view')).toBeVisible();

        // If we need to create a board, the UI prompt might be there, or we might need to click "Create Board"
        // "ClaimBoardPrompt" is shown if no board? No, signup usually pairs or creates.
        // Let's assume user has a board. Wait, signup makes user but no board by default?
        // User needs to create board.

        // Check if we need to create board
        // The previous flow had "ClaimBoardPrompt", but now we removed "Claim"?
        // "ClaimBoardPrompt" (component) still exists in `App.tsx` imports?
        // `ClaimBoardPrompt` is for "Claim THIS board".

        // Let's ensure we have a board.
        // We can use API to create board for user to be sure.
        // Or simpler: Use UI "Create New Board" if we are in pairing view? 
        // No, we are logged in.

        // Let's go to Settings directly
        await page.getByTestId('tab-settings').click();

        // 3. Link Display
        // Check if "Link New Display" button is visible
        // If not visible, we might not be owner (we just signed up, so we have no board yet?)
        // If we have no board, `SettingsTab` shows "Sign Out" but maybe not "Link Display".
        // "Displays" section is conditional on `ownership.value.is_owner`.

        // If we have no board, we should create one.
        // `SettingsTab` logic doesn't show "Create Board".
        // `App.tsx`: "Board shows provisioning view if no board exists" (for /board path).

        // How does a new user create a board now? 
        // Previously: "Phase 4: Board Claiming".
        // If I sign up, do I have a board? No.
        // I need to create one.
        // `App.tsx`: `handleCreateBoard` is in `PairingView`.
        // But if I am on `/controller`, and I am logged in, and `board` is null?
        // `App.tsx`: `needsPairing = !board.value && !isInitialized.value`.
        // If `needsPairing`, it shows `PairingView`.

        // So if I am logged in but no board, I see `PairingView`? 
        // `App.tsx` redirects logged in users from `/login`.
        // But `Controller` component needs `board`.
        // Logic in `Controller` component: `if (!board.value) return Loading...` within SettingsTab?
        // Wait, `Controller` component renders children. `SettingsTab` checks `!board.value`.

        // If `board.value` is null, `SettingsTab` shows "Loading settings...".
        // This seems like a gap. If I have no board, I'm stuck loading?
        // `initializeApp` tries to load board from storage.
        // If storage empty, `needsPairing` is true -> `PairingView`.

        // Okay, so after signup, if I don't have a board in local storage, `App` shows `PairingView`.
        // So I should see `PairingView` even after login?
        // `App.tsx` line 534: redirects from /login to /controller.
        // `path === '/controller' && needsPairing` -> `PairingView`.
        // `PairingView` has "Create New Board".

        // So flow:
        await expect(page.getByTestId('create-board-btn')).toBeVisible();
        await page.getByTestId('create-board-btn').click();

        // Now we should be in Controller view with a board.
        await expect(page.getByTestId('controller-tabs')).toBeVisible();
        await page.getByTestId('tab-settings').click();

        await expect(page.getByTestId('add-display-btn')).toBeVisible();
        await page.getByTestId('add-display-btn').click();

        // 4. Enter Code
        await page.fill('input[placeholder="ABCDEF"]', tvCode);
        await page.click('button:has-text("Link Display")');

        // 5. Verify Success
        await expect(page.locator('.settings-device-name')).toContainText(`Display ${tvCode}`);

        // 6. Verify Token polling
        const pollRes2 = await request.get(`/api/devices/poll?code=${tvCode}`);
        const pollData2 = await pollRes2.json();
        expect(pollData2.token).toBeTruthy();

        // 7. Unlink
        page.on('dialog', dialog => dialog.accept());
        await page.click('button:has-text("Unlink")');
        await expect(page.locator('.settings-device-name')).not.toBeVisible();
    });
});
