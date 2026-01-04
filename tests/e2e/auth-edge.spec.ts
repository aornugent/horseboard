import { test, expect } from '@playwright/test';
import { selectors } from './selectors';

/**
 * Auth Edge Cases
 *
 * Tests authentication edge cases and error handling.
 * These tests verify REAL behavior - actual API responses, error states, etc.
 */

test.describe('Auth Edge Cases', () => {
    test('rejects invalid login credentials with error message', async ({ page }) => {
        await page.goto('/login');
        await page.getByTestId('email-input').fill('invalid@example.com');
        await page.getByTestId('password-input').fill('wrongpassword');
        await page.getByTestId('submit-btn').click();

        // REAL BEHAVIOR: Server returns error, UI displays it
        await expect(page.locator('.auth-error')).toBeVisible();
        await expect(page.locator('.auth-error')).toContainText('Invalid email or password');
    });

    test('includes rate limit headers on auth endpoints', async ({ request }) => {
        // REAL BEHAVIOR: Verify rate limiting is configured
        // Testing headers instead of actual blocking (blocking requires 100+ requests)

        const response = await request.post('/api/auth/sign-in/email', {
            data: { email: 'test@example.com', password: 'password' }
        });

        // express-rate-limit adds headers indicating limits are active
        const headers = response.headers();
        expect(headers['ratelimit-limit']).toBeDefined();
        expect(headers['ratelimit-remaining']).toBeDefined();
    });



    test('expired invite code returns error', async ({ page, browser }) => {
        // Setup: Owner creates board and invite
        const timestamp = Date.now();
        const ownerContext = await browser.newContext();
        const ownerPage = await ownerContext.newPage();

        await ownerPage.goto('/signup');
        await ownerPage.locator(selectors.nameInput).fill(`Owner ${timestamp}`);
        await ownerPage.locator(selectors.emailInput).fill(`owner${timestamp}@example.com`);
        await ownerPage.locator(selectors.passwordInput).fill('password123');
        await ownerPage.locator(selectors.submitBtn).click();

        await expect(ownerPage).toHaveURL(/\/controller/);

        // Get pair code for view access
        await ownerPage.locator('[data-testid="tab-settings"]').click();
        const pairCodeElement = ownerPage.locator(selectors.boardPairCode);
        await expect(pairCodeElement).toBeVisible();
        const fullText = await pairCodeElement.innerText();
        const pairCode = fullText.replace('Pair Code:', '').trim();

        // User connects with view access
        const userContext = await browser.newContext();
        const userPage = await userContext.newPage();

        await userPage.goto('/');
        await userPage.locator('[data-testid="landing-code-input"]').fill(pairCode);
        await userPage.locator('[data-testid="landing-connect-btn"]').click();

        await expect(userPage).toHaveURL(/\/controller/);

        // Try to redeem with fake/expired invite code
        await userPage.locator('[data-testid="tab-settings"]').click();
        await userPage.locator(selectors.enterInviteBtn).click();

        // Use obviously invalid code
        await userPage.locator(selectors.inviteInput).fill('000000');
        await userPage.locator(selectors.inviteSubmit).click();

        // REAL BEHAVIOR: Should show error message
        const errorMessage = userPage.locator('[data-testid="invite-error"]');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(/invalid|expired/i);

        await ownerContext.close();
        await userContext.close();
    });

    test('duplicate signup with same email returns error', async ({ page }) => {
        // Create first user
        const timestamp = Date.now();
        const email = `duplicate${timestamp}@example.com`;

        await page.goto('/signup');
        await page.getByTestId('name-input').fill('First User');
        await page.getByTestId('email-input').fill(email);
        await page.getByTestId('password-input').fill('password123');
        await page.getByTestId('submit-btn').click();

        await expect(page).toHaveURL(/\/controller/);

        // Sign out
        await page.locator('[data-testid="tab-settings"]').click();
        await page.locator(selectors.signOutBtn).click();

        // Try to sign up again with same email
        await page.goto('/signup');
        await page.getByTestId('name-input').fill('Second User');
        await page.getByTestId('email-input').fill(email);
        await page.getByTestId('password-input').fill('password456');
        await page.getByTestId('submit-btn').click();

        // REAL BEHAVIOR: Should show error that email is already registered
        const errorMessage = page.locator('.auth-error');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(/already|exists|registered/i);
    });
});
