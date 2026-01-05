import { testWithVisitor as test, expect } from './fixtures/auth';
import { selectors } from './selectors';

/**
 * Auth Edge Cases
 *
 * Tests authentication edge cases and error handling.
 */
test.describe('Auth Edge Cases', () => {
    test('rejects invalid login credentials with error message', async ({ page }) => {
        await page.goto('/login');
        await page.getByTestId('email-input').fill('invalid@example.com');
        await page.getByTestId('password-input').fill('wrongpassword');
        await page.getByTestId('submit-btn').click();

        // REAL BEHAVIOR: Server returns error
        await expect(page.locator('.auth-error')).toBeVisible();
        await expect(page.locator('.auth-error')).toContainText('Invalid email or password');
    });

    test('includes rate limit headers on auth endpoints', async ({ request }) => {
        const response = await request.post('/api/auth/sign-in/email', {
            data: { email: 'test@example.com', password: 'password' }
        });

        const headers = response.headers();
        expect(headers['ratelimit-limit']).toBeDefined();
        expect(headers['ratelimit-remaining']).toBeDefined();
    });

    test('expired invite code returns error', async ({ visitorPage }) => {
        // Since visitorPage is already connected (View Only), try to redeem logic
        await visitorPage.locator('[data-testid="tab-settings"]').click();
        await visitorPage.locator(selectors.enterInviteBtn).click();

        // Use obviously invalid/expired code
        await visitorPage.locator(selectors.inviteInput).fill('000000');
        await visitorPage.locator(selectors.inviteSubmit).click();

        // REAL BEHAVIOR: Should show error message
        const errorMessage = visitorPage.locator('[data-testid="invite-error"]');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(/invalid|expired/i);
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
