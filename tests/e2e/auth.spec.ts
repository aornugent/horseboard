import { test, expect } from '@playwright/test';
import { selectors } from './selectors';

test.describe('Authentication', () => {
    test.describe('Landing Page', () => {
        test('should show landing page with code entry as primary action', async ({ page }) => {
            await page.goto('/');

            // Should show landing view
            await expect(page.locator('[data-testid="landing-view"]')).toBeVisible();

            // Should have code input as primary action
            await expect(page.locator('[data-testid="landing-code-input"]')).toBeVisible();
            await expect(page.locator('[data-testid="landing-connect-btn"]')).toBeVisible();

            // Should have secondary actions
            await expect(page.locator('[data-testid="landing-signup-link"]')).toBeVisible();
            await expect(page.locator('[data-testid="landing-login-link"]')).toBeVisible();
        });

        test('should connect with valid 6-digit pair code', async ({ browser }) => {
            // Setup: Create owner and get pair code
            const ownerContext = await browser.newContext();
            const ownerPage = await ownerContext.newPage();

            await ownerPage.goto('/signup');
            const timestamp = Date.now();
            await ownerPage.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
            await ownerPage.locator(selectors.emailInput).fill(`owner-${timestamp}@example.com`);
            await ownerPage.locator(selectors.passwordInput).fill('password123');
            await ownerPage.locator(selectors.submitBtn).click();
            await expect(ownerPage).toHaveURL(/\/controller/);

            // Get pair code
            await ownerPage.locator('[data-testid="tab-settings"]').click();
            const pairCodeElement = ownerPage.locator(selectors.boardPairCode);
            await expect(pairCodeElement).toBeVisible();
            const fullText = await pairCodeElement.innerText();
            const pairCode = fullText.replace('Pair Code:', '').trim();

            // New visitor uses landing page
            const visitorContext = await browser.newContext();
            const visitorPage = await visitorContext.newPage();

            await visitorPage.goto('/');
            await expect(visitorPage.locator('[data-testid="landing-view"]')).toBeVisible();

            // Enter code
            await visitorPage.locator('[data-testid="landing-code-input"]').fill(pairCode);
            await visitorPage.locator('[data-testid="landing-connect-btn"]').click();

            // Should redirect to controller
            await expect(visitorPage).toHaveURL(/\/controller/);
            await expect(visitorPage.locator('[data-testid="controller-view"]')).toBeVisible();

            await ownerContext.close();
            await visitorContext.close();
        });

        test('should show error for invalid code', async ({ page }) => {
            await page.goto('/');

            await page.locator('[data-testid="landing-code-input"]').fill('999999');
            await page.locator('[data-testid="landing-connect-btn"]').click();

            // Should show error
            await expect(page.locator('[data-testid="landing-error"]')).toBeVisible();
        });

        test('should auto-redirect returning users to controller', async ({ page }) => {
            // Setup: Create user and connect
            const timestamp = Date.now();
            await page.goto('/signup');
            await page.locator(selectors.nameInput).fill(`User ${timestamp}`);
            await page.locator(selectors.emailInput).fill(`user-${timestamp}@example.com`);
            await page.locator(selectors.passwordInput).fill('password123');
            await page.locator(selectors.submitBtn).click();
            await expect(page).toHaveURL(/\/controller/);

            // Verify board ID is stored
            const storedBoardId = await page.evaluate(() => localStorage.getItem('horseboard_board_id'));
            expect(storedBoardId).toBeTruthy();

            // Now visit landing page - should auto-redirect
            await page.goto('/');

            // Should redirect to controller (not show landing page)
            await expect(page).toHaveURL(/\/controller/, { timeout: 5000 });
        });
    });

    test('should navigate to signup and login views', async ({ page }) => {
        // Start from landing page
        await page.goto('/');

        // Click signup link
        await page.locator('[data-testid="landing-signup-link"]').click();
        await expect(page.locator(selectors.signupView)).toBeVisible();

        // Navigate to Login from Signup link
        await page.getByText('Log In').click();
        await expect(page.locator(selectors.loginView)).toBeVisible();
    });

    test.describe('Owner Signup', () => {
        test('should sign up new owner and auto-create board', async ({ page }) => {
            const timestamp = Date.now();
            const email = `owner-${timestamp}@example.com`;
            const name = `Owner ${timestamp}`;
            const password = 'password123';

            // Go directly to signup
            await page.goto('/signup');

            await page.locator(selectors.nameInput).fill(name);
            await page.locator(selectors.emailInput).fill(email);
            await page.locator(selectors.passwordInput).fill(password);
            await page.locator(selectors.submitBtn).click();

            // Should redirect to controller (not pairing view)
            await expect(page).toHaveURL(/\/controller/, { timeout: 10000 });
            await expect(page.locator('[data-testid="controller-view"]')).toBeVisible();

            // Should NOT show pairing view (board was auto-created)
            await expect(page.locator(selectors.pairingView)).not.toBeVisible();

            // Should show horses tab (default)
            await expect(page.locator(selectors.horsesTab)).toBeVisible();

            // Verify board ID is stored
            const storedBoardId = await page.evaluate(() => localStorage.getItem('horseboard_board_id'));
            expect(storedBoardId).toBeTruthy();

            // Check settings for account info and admin permission indicators
            await page.locator('[data-testid="tab-settings"]').click();
            await expect(page.locator(selectors.accountName)).toHaveText(name);

            // Admin should see displays section (only visible to admin)
            await expect(page.getByRole('heading', { name: 'Displays' })).toBeVisible();

            // Admin should see staff access section
            await expect(page.getByText('Staff Access', { exact: false })).toBeVisible();
        });

        test('should see account info after signup', async ({ page }) => {
            const timestamp = Date.now();
            const email = `test-${timestamp}@example.com`;
            const name = `User ${timestamp}`;
            const password = 'password123';

            await page.goto('/signup');

            await page.locator(selectors.nameInput).fill(name);
            await page.locator(selectors.emailInput).fill(email);
            await page.locator(selectors.passwordInput).fill(password);
            await page.locator(selectors.submitBtn).click();

            // Should redirect to controller
            await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

            // Check settings for account info
            await page.locator('[data-testid="tab-settings"]').click();
            await expect(page.locator(selectors.accountName)).toHaveText(name);
        });
    });

    test('should sign out', async ({ page }) => {
        const timestamp = Date.now();
        const email = `logout-${timestamp}@example.com`;
        const name = 'Logout User';
        const password = 'password123';

        // Signup first
        await page.goto('/signup');
        await page.locator(selectors.nameInput).fill(name);
        await page.locator(selectors.emailInput).fill(email);
        await page.locator(selectors.passwordInput).fill(password);
        await page.locator(selectors.submitBtn).click();

        await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

        // Sign out
        await page.locator('[data-testid="tab-settings"]').click();
        await page.locator(selectors.signOutBtn).click();

        // Should reload and stay on controller (board ID persists in localStorage)
        await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

        // Check we are logged out - should see sign in option
        await page.locator('[data-testid="tab-settings"]').click();
        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });
});
