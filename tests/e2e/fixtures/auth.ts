/**
 * Auth Fixtures for E2E Tests
 * 
 * Provides pre-authenticated browser contexts to eliminate
 * redundant signup flows in every test.
 * 
 * Uses API-based setup (createBoard) for maximum speed.
 */

import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import { createBoard, Board } from '../helpers/api';
import { navigateWithBoard, waitForControllerReady, cleanupTestData } from '../helpers/setup';

interface OwnerFixture {
    ownerContext: BrowserContext;
    ownerPage: Page;
    ownerBoard: Board;
    ownerBoardId: string;
    ownerPairCode: string;
}

interface VisitorFixture {
    visitorContext: BrowserContext;
    visitorPage: Page;
}

// Extend the base test with our custom fixtures
export const test = base.extend<OwnerFixture>({
    ownerContext: async ({ browser }, use) => {
        const context = await browser.newContext();
        await use(context);
        await context.close();
    },

    ownerBoard: async ({ request }, use) => {
        // Create board via API (FAST)
        const board = await createBoard(request);

        await use(board);

        // Cleanup after test
        await cleanupTestData(request, board.id);
    },

    ownerBoardId: async ({ ownerBoard }, use) => {
        await use(ownerBoard.id);
    },

    ownerPairCode: async ({ ownerBoard }, use) => {
        await use(ownerBoard.pair_code);
    },

    ownerPage: async ({ ownerContext, ownerBoard }, use) => {
        const page = await ownerContext.newPage();

        // Inject state and navigate (FAST)
        await navigateWithBoard(page, '/controller', ownerBoard.id);
        await waitForControllerReady(page);

        await use(page);
    },
});

// Visitor fixture - connects via pair code, gets view-only access
export const testWithVisitor = test.extend<VisitorFixture>({
    visitorContext: async ({ browser }, use) => {
        const context = await browser.newContext();
        await use(context);
        await context.close();
    },

    visitorPage: async ({ visitorContext, ownerPairCode }, use) => {
        const page = await visitorContext.newPage();

        await page.goto('/');
        await page.locator('[data-testid="landing-code-input"]').fill(ownerPairCode);
        await page.locator('[data-testid="landing-connect-btn"]').click();

        await expect(page).toHaveURL(/\/controller/);
        await expect(page.locator('[data-testid="controller-view"]')).toBeVisible({ timeout: 10000 });

        await use(page);
    },
});

export { expect };
