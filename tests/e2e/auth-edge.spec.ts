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

    test('revoked controller token denies access immediately', async ({ page, browser, request }) => {
        // Setup: Owner creates board and controller token
        const timestamp = Date.now();
        await page.goto('/signup');
        await page.getByTestId('name-input').fill(`Owner ${timestamp}`);
        await page.getByTestId('email-input').fill(`owner${timestamp}@example.com`);
        await page.getByTestId('password-input').fill('password123');
        await page.getByTestId('submit-btn').click();

        await expect(page).toHaveURL(/\/controller/);

        // Navigate to Settings → Permissions (tokens consolidated here per USER_PATHS.md)
        await page.getByTestId('tab-settings').click();
        await expect(page.locator(selectors.settingsTab)).toBeVisible();

        // Scroll to Permissions section and expand API Tokens (Advanced)
        const permissionsSection = page.locator('text=Permissions').first();
        await permissionsSection.scrollIntoViewIfNeeded();

        // Find and click Create Token in Permissions section
        const createTokenBtn = page.getByTestId('create-token-btn');
        await expect(createTokenBtn).toBeVisible();
        await createTokenBtn.click();

        // Fill in token details
        await page.fill('input[placeholder*="name"]', 'Test Token');

        // Select permission level (view or edit)
        await page.selectOption('select[name="permission"]', 'view');

        await page.click('button:has-text("Create Token")');

        // Get token value from modal
        const tokenValue = await page.locator('.token-value').innerText();
        expect(tokenValue).toContain('hb_');

        // Close modal
        await page.click('button:has-text("Done")');

        // Verify token appears in list
        await expect(page.locator('.token-item').filter({ hasText: 'Test Token' })).toBeVisible();

        // 2. Simulate another device using the token
        const context2 = await browser.newContext();
        const page2 = await context2.newPage();

        // Use token to connect via pairing flow
        await page2.goto('/');

        // Look for "I have a token" option in landing page or pairing view
        const tokenOption = page2.locator('text=I have a token');
        if (await tokenOption.isVisible()) {
            await tokenOption.click();
        } else {
            // If on pairing view directly, look for token input
            await page2.goto('/controller');
        }

        await page2.getByTestId('token-input').fill(tokenValue);
        await page2.getByTestId('token-connect-btn').click();

        // Should connect successfully
        await expect(page2).toHaveURL(/\/controller/);
        await expect(page2.getByTestId('tab-horses')).toBeVisible();

        // 3. REAL BEHAVIOR TEST: Revoke token on owner page
        const revokeBtn = page.locator('.token-item')
            .filter({ hasText: 'Test Token' })
            .getByRole('button', { name: /Revoke|Delete/i });

        // Handle confirm dialog
        page.on('dialog', dialog => dialog.accept());
        await revokeBtn.click();

        // Token should be removed from list
        await expect(page.locator('.token-item').filter({ hasText: 'Test Token' })).not.toBeVisible();

        // 4. CRITICAL TEST: Verify revoked token is immediately rejected by API
        const bootstrapResponse = await request.get('/api/bootstrap', {
            headers: {
                'X-Controller-Token': tokenValue
            }
        });

        // Should be rejected with 403 Forbidden
        expect(bootstrapResponse.status()).toBe(403);

        // 5. Verify user with revoked token loses access on reload
        await page2.reload();

        // Should redirect to login or landing (session cleared due to 403)
        await expect(page2).toHaveURL(/\/(login|$)/, { timeout: 10000 });

        await context2.close();
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
