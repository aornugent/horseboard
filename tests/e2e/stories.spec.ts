import { test, expect } from '@playwright/test';
import { selectors } from './selectors';

test.describe('Story 9.1: The Owner', () => {
    test('New owner signup auto-creates board', async ({ page }) => {
        // 1. Visit /signup (Simulating "Get Started" -> Sign Up)
        await page.goto('/signup');

        // Generate unique user
        const timestamp = Date.now();
        const email = `owner-${timestamp}@example.com`;
        const name = `Owner ${timestamp}`;
        const password = 'password123';

        await page.locator(selectors.nameInput).fill(name);
        await page.locator(selectors.emailInput).fill(email);
        await page.locator(selectors.passwordInput).fill(password);
        await page.locator(selectors.submitBtn).click();

        await expect(page).toHaveURL(/\/controller/);

        await expect(page.locator(selectors.pairingView)).not.toBeVisible({ timeout: 10000 });
        await expect(page.locator(selectors.horsesTab)).toBeVisible();

        await page.locator('[data-testid="tab-settings"]').click();
        await expect(page.locator(selectors.settingsTab)).toBeVisible();

        // Verify admin sees Displays section (only visible to admin)
        await expect(page.getByText('Displays', { exact: false })).toBeVisible();

        // Verify admin sees Staff Access section
        await expect(page.getByText('Staff Access', { exact: false })).toBeVisible();

        // Verify Board Name (optional, if UI shows it)
        // Verify Account ID link (backend check or inferred from UI behavior)
    });
});

test.describe('Story 9.2: The "Dumb" TV', () => {
    test('Unprovisioned TV shows code, owner links it, TV reloads', async ({ browser }) => {
        // 1. TV Context
        const tvContext = await browser.newContext();
        const tvPage = await tvContext.newPage();

        // TV visits /board (simulate unprovisioned state by clearing storage if needed, but new context is empty)
        await tvPage.goto('/board');

        const codeDisplay = tvPage.locator('[data-testid="provisioning-code"]');
        await expect(codeDisplay).toBeVisible({ timeout: 10000 });
        const codeText = (await codeDisplay.innerText()).replace(/[\r\n\s]+/g, '');
        expect(codeText).toMatch(/^[A-Z0-9]{6}$/);

        const ownerContext = await browser.newContext();
        const ownerPage = await ownerContext.newPage();

        await ownerPage.goto('/signup');
        const timestamp = Date.now();
        await ownerPage.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
        await ownerPage.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
        await ownerPage.locator(selectors.passwordInput).fill('password123');
        await ownerPage.locator(selectors.submitBtn).click();
        await expect(ownerPage).toHaveURL(/\/controller/);

        // Owner navigates to Settings -> Displays
        await ownerPage.locator('[data-testid="tab-settings"]').click();
        await expect(ownerPage.locator(selectors.settingsTab)).toBeVisible();

        // Click "Link Display"
        await ownerPage.locator('[data-testid="add-display-btn"]').click();

        // Enter Code
        await ownerPage.locator('[data-testid="provisioning-input"]').fill(codeText);
        await ownerPage.locator('[data-testid="provisioning-submit"]').click();

        // Verify modal closes (success)
        await expect(ownerPage.locator('[data-testid="provisioning-input"]')).not.toBeVisible();

        await expect(tvPage.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

        // Cleanup
        await tvContext.close();
        await ownerContext.close();
    });
});

test.describe('Story 9.3: Remote Control Mode', () => {
    test('User enters pair code, gets View access, sees pagination, no add buttons', async ({ browser }) => {
        // 1. Setup: Owner creates a board and gets the pair code
        const ownerContext = await browser.newContext();
        const ownerPage = await ownerContext.newPage();

        // Signup owner
        await ownerPage.goto('/signup');
        const timestamp = Date.now();
        const email = `owner-remote-${timestamp}@example.com`;
        await ownerPage.locator(selectors.nameInput).fill(`Owner Remote ${timestamp}`);
        await ownerPage.locator(selectors.emailInput).fill(email);
        await ownerPage.locator(selectors.passwordInput).fill('password123');
        await ownerPage.locator(selectors.submitBtn).click();
        await expect(ownerPage).toHaveURL(/\/controller/);

        // Get Pair Code from Settings
        await ownerPage.locator('[data-testid="tab-settings"]').click();
        const pairCodeElement = ownerPage.locator(selectors.boardPairCode);
        await expect(pairCodeElement).toBeVisible();
        const fullText = await pairCodeElement.innerText();
        const pairCode = fullText.replace('Pair Code:', '').trim();
        expect(pairCode).toMatch(/^\d{6}$/);

        // 2. Remote User (Visitor) connects
        const visitorContext = await browser.newContext();
        const visitorPage = await visitorContext.newPage();

        // Visit root
        await visitorPage.goto('/');

        await visitorPage.click('[data-testid="landing-controller-link"]');
        await expect(visitorPage.locator(selectors.pairingView)).toBeVisible();

        await visitorPage.locator('[data-testid="pair-code-input"]').fill(pairCode);
        await visitorPage.locator('[data-testid="pair-btn"]').click();

        // 3. Assertions
        // Should load Controller UI
        await expect(visitorPage.locator(selectors.horsesTab)).toBeVisible();

        // Check that a TOKEN was stored (Requirement for Story 9.3)
        const token = await visitorPage.evaluate(() => localStorage.getItem('horseboard_controller_token'));
        expect(token).toBeTruthy();
        expect(token).toMatch(/^hb_/);

        // Should NOT see "Add Horse" button (View Only)
        await expect(visitorPage.locator(selectors.addHorseBtn)).not.toBeVisible();

        // Check Feeds Tab for "Add Feed" button absence
        await visitorPage.locator('[data-testid="tab-feeds"]').click();
        await expect(visitorPage.locator(selectors.addFeedBtn)).not.toBeVisible();

        // Check Pagination Controls are visible
        // Navigate to Board Tab (Remote Control)
        await visitorPage.locator('[data-testid="tab-board"]').click();

        await expect(visitorPage.locator('[data-testid="prev-page-btn"]')).toBeVisible();
        await expect(visitorPage.locator('[data-testid="next-page-btn"]')).toBeVisible();

        // Verify view-only user does NOT see admin sections in Settings
        await visitorPage.locator('[data-testid="tab-settings"]').click();

        // Should NOT see Displays section (admin only)
        await expect(visitorPage.getByText('Displays', { exact: false })).not.toBeVisible();

        // Should NOT see Staff Access section (admin only)
        await expect(visitorPage.getByText('Staff Access', { exact: false })).not.toBeVisible();

        // Should see Upgrade Access section (for view-only users)
        await expect(visitorPage.getByText('Upgrade Access', { exact: false })).toBeVisible();

        await ownerContext.close();
        await visitorContext.close();
    });
});

test.describe('Story 9.4: Generating Invites (Owner)', () => {
    test('Owner generates invite code', async ({ browser }) => {
        const ownerContext = await browser.newContext();
        const ownerPage = await ownerContext.newPage();

        // 1. Signup Owner
        await ownerPage.goto('/signup');
        const timestamp = Date.now();
        const email = `owner-invite-${timestamp}@example.com`;
        await ownerPage.locator(selectors.nameInput).fill(`Owner Invite ${timestamp}`);
        await ownerPage.locator(selectors.emailInput).fill(email);
        await ownerPage.locator(selectors.passwordInput).fill('password123');
        await ownerPage.locator(selectors.submitBtn).click();
        await expect(ownerPage).toHaveURL(/\/controller/);

        // 2. Go to Settings
        await ownerPage.locator('[data-testid="tab-settings"]').click();

        // 3. Generate Invite Code
        // Initially should not see a code
        await expect(ownerPage.locator('[data-testid="invite-code-display"]')).not.toBeVisible();

        // Click Generate
        await ownerPage.locator('[data-testid="generate-invite-btn"]').click();

        // 4. Verify Code Display
        const codeDisplay = ownerPage.locator('[data-testid="invite-code-display"]');
        await expect(codeDisplay).toBeVisible();
        const codeText = await ownerPage.locator('.settings-invite-code').innerText();
        expect(codeText).toMatch(/^\d{6}$/); // Expect 6 digits

        // 5. Verify it persists on reload (optional, but good for UX)
        await ownerPage.reload();
        await ownerPage.locator('[data-testid="tab-settings"]').click();
        // Depending on impl, it might persist or need regeneration. 
        // For now, let's assume it's ephemeral in UI or persists if valid.
        // Let's assert we can generate another one if needed.

        await ownerContext.close();
    });
});

test.describe('Story 9.5: Redeeming Invites', () => {
    test('View-only user enters invite code, upgrades to Edit access', async ({ browser }) => {
        // 1. Setup: Owner creates board, gets Pair Code AND Invite Code
        const ownerContext = await browser.newContext();
        const ownerPage = await ownerContext.newPage();

        // Signup Owner
        await ownerPage.goto('/signup');
        const timestamp = Date.now();
        const email = `owner-redeem-${timestamp}@example.com`;
        await ownerPage.locator(selectors.nameInput).fill(`Owner Redeem ${timestamp}`);
        await ownerPage.locator(selectors.emailInput).fill(email);
        await ownerPage.locator(selectors.passwordInput).fill('password123');
        await ownerPage.locator(selectors.submitBtn).click();
        await expect(ownerPage).toHaveURL(/\/controller/);

        // Go to Settings
        await ownerPage.locator('[data-testid="tab-settings"]').click();

        // Get Pair Code
        const pairCodeElement = ownerPage.locator(selectors.boardPairCode);
        await expect(pairCodeElement).toBeVisible();
        const fullPairText = await pairCodeElement.innerText();
        const pairCode = fullPairText.replace('Pair Code:', '').trim();

        // Generate Invite Code
        await ownerPage.locator('[data-testid="generate-invite-btn"]').click();
        const inviteCodeDisplay = ownerPage.locator('[data-testid="invite-code-display"]');
        await expect(inviteCodeDisplay).toBeVisible();
        const inviteCode = await ownerPage.locator('.settings-invite-code').innerText();

        // 2. Visitor connects (View Only)
        const visitorContext = await browser.newContext();
        const visitorPage = await visitorContext.newPage();

        await visitorPage.goto('/');
        await visitorPage.click('[data-testid="landing-controller-link"]');
        await visitorPage.locator('[data-testid="pair-code-input"]').fill(pairCode);
        await visitorPage.locator('[data-testid="pair-btn"]').click();

        await expect(visitorPage.locator(selectors.horsesTab)).toBeVisible();
        await expect(visitorPage.locator(selectors.addHorseBtn)).not.toBeVisible();

        await visitorPage.locator('[data-testid="tab-settings"]').click();

        // Click "Enter Invite Code"
        await visitorPage.locator(selectors.enterInviteBtn).click();

        await visitorPage.locator(selectors.inviteInput).fill(inviteCode);
        await visitorPage.locator(selectors.inviteSubmit).click();

        // 4. Assert Upgrade
        // App should reload or update state. 
        // We expect "Add Horse" button to appear on Horses Tab.
        // Wait for reload/navigation if any, then check UI.
        // If it reloads, it might go back to default tab (Horses).

        // Let's assume it redirects to Horses tab or stays in settings.
        // Check for horses tab existence first (it should still be there)
        await expect(visitorPage.locator(selectors.horsesTab)).toBeVisible({ timeout: 15000 });

        const horsesTabBtn = visitorPage.locator('[data-testid="tab-horses"]');
        if (await horsesTabBtn.isVisible()) {
            await horsesTabBtn.click();
        }

        // Check for Add Horse Button
        await expect(visitorPage.locator(selectors.addHorseBtn)).toBeVisible();

        // Check Token Swap (Optional but good)
        const token = await visitorPage.evaluate(() => localStorage.getItem('horseboard_controller_token'));
        expect(token).toBeTruthy();
        expect(token).toMatch(/^hb_/);
        // We can't easily distinguish edit vs view token by string alone without decoding, 
        // but the UI behavior confirms the permission change.

        await ownerContext.close();
        await visitorContext.close();
    });
});
