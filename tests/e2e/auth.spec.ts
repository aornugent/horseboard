import { test, expect } from '@playwright/test';
import { selectors } from './selectors';

test.describe('Authentication', () => {
    test('should navigate to signup and login views', async ({ page }) => {
        // Start at settings which links to auth
        await page.goto('/controller');
        // We might need to handle pairing if no board exists, but usually local dev env has one or we can bypass.
        // If we visit /board it sets one up.
        await page.goto('/board');
        await expect(page.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

        await page.goto('/controller');
        await page.locator('[data-testid="tab-settings"]').click();

        // Should see Sign Up button
        const signUpBtn = page.locator(selectors.settingsTab).getByRole('button', { name: 'Sign Up', exact: true });
        await expect(signUpBtn).toBeVisible();
        await signUpBtn.click();

        await expect(page.locator(selectors.signupView)).toBeVisible();

        // Navigate to Login from Signup link
        await page.getByText('Log In').click();
        await expect(page.locator(selectors.loginView)).toBeVisible();
    });

    test('should sign up a new user and see account info', async ({ page }) => {
        const timestamp = Date.now();
        const email = `test-${timestamp}@example.com`;
        const name = `User ${timestamp}`;
        const password = 'password123';

        // Ensure board exists so we land on controller after auth
        await page.goto('/board');
        await expect(page.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

        // Go directly to signup
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

    test('should sign out', async ({ page }) => {
        const timestamp = Date.now();
        const email = `logout-${timestamp}@example.com`;
        const name = 'Logout User';
        const password = 'password123';

        // Ensure board
        await page.goto('/board');
        await expect(page.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

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

        // Should reload. Wait for controller again (might be default tab)
        await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

        // Check we are logged out
        await page.locator('[data-testid="tab-settings"]').click();
        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });
});
