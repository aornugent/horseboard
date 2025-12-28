/**
 * E2E Tests for Onboarding and Pairing Flows
 *
 * Tests the initial setup experience including:
 * - Display showing 6-digit pair code
 * - Controller creating new board
 * - Controller pairing with existing display
 * - Invalid pair code error handling
 */

import { test, expect } from '@playwright/test';
import { selectors } from '../selectors';
import { createBoard, deleteBoard } from '../helpers/api';
import { clearBoardFromStorage } from '../helpers/setup';

test.describe('Onboarding and Pairing', () => {
  test.describe('Display', () => {
    test('shows 6-digit pair code on first load', async ({ page }) => {
      // Clear localStorage to ensure clean state
      await page.goto('/');
      await clearBoardFromStorage(page);

      // Navigate to /board - this auto-creates a board
      await page.goto('/board');

      // Wait for board view to be ready (auto-creates board)
      await expect(page.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });

      // Verify pair code is visible - check both possible locations
      const pairCodeHeader = page.locator(selectors.boardPairCode);
      const pairCodeEmpty = page.locator('[data-testid="board-empty-pair-code"]');

      // Either the header pair code or the empty state pair code should be visible
      const headerVisible = await pairCodeHeader.isVisible();
      const emptyVisible = await pairCodeEmpty.isVisible();

      expect(headerVisible || emptyVisible).toBeTruthy();

      // Get the pair code text from whichever element is visible
      let pairCodeText: string;
      if (headerVisible) {
        pairCodeText = (await pairCodeHeader.textContent()) || '';
      } else {
        pairCodeText = (await pairCodeEmpty.textContent()) || '';
      }

      // Verify it's a 6-digit numeric code
      const codeMatch = pairCodeText.match(/\d{6}/);
      expect(codeMatch).toBeTruthy();
      expect(codeMatch![0]).toHaveLength(6);
    });
  });

  test.describe('Controller', () => {
    test('can create new board', async ({ page }) => {
      // Clear localStorage to ensure clean state
      await page.goto('/');
      await clearBoardFromStorage(page);

      // Navigate to /controller - should show pairing view
      await page.goto('/controller');

      // Verify pairing view is shown
      const pairingView = page.locator('[data-testid="pairing-view"]');
      await expect(pairingView).toBeVisible({ timeout: 10000 });

      // Click "Create New Board" button
      const createBoardBtn = page.locator('[data-testid="create-board-btn"]');
      await expect(createBoardBtn).toBeVisible();
      await createBoardBtn.click();

      // Wait for controller view to load (indicates successful board creation)
      const controllerView = page.locator('[data-testid="controller-view"]');
      await expect(controllerView).toBeVisible({ timeout: 15000 });

      // Verify navigation to Horses tab (default tab)
      const horsesTab = page.locator(selectors.horsesTab);
      await expect(horsesTab).toBeVisible();

      // Verify localStorage contains a board ID
      const boardId = await page.evaluate(() => {
        return localStorage.getItem('horseboard_board_id');
      });
      expect(boardId).toBeTruthy();
      expect(boardId).toMatch(/^[a-zA-Z0-9_-]+$/);
    });

    test('can pair with existing display', async ({ page, request }) => {
      // Create a board via API to get a pair code
      const board = await createBoard(request);

      try {
        // Clear localStorage to ensure clean state
        await page.goto('/');
        await clearBoardFromStorage(page);

        // Navigate to /controller - should show pairing view
        await page.goto('/controller');

        // Verify pairing view is shown
        const pairingView = page.locator('[data-testid="pairing-view"]');
        await expect(pairingView).toBeVisible({ timeout: 10000 });

        // Enter the pair code
        const pairCodeInput = page.locator('[data-testid="pair-code-input"]');
        await expect(pairCodeInput).toBeVisible();
        await pairCodeInput.fill(board.pair_code);

        // Click Connect button
        const connectBtn = page.locator('[data-testid="pair-btn"]');
        await expect(connectBtn).toBeEnabled();
        await connectBtn.click();

        // Wait for controller view to load (indicates successful pairing)
        const controllerView = page.locator('[data-testid="controller-view"]');
        await expect(controllerView).toBeVisible({ timeout: 15000 });

        // Verify navigation to Horses tab (default tab)
        const horsesTab = page.locator(selectors.horsesTab);
        await expect(horsesTab).toBeVisible();

        // Verify localStorage contains the correct board ID
        const storedBoardId = await page.evaluate(() => {
          return localStorage.getItem('horseboard_board_id');
        });
        expect(storedBoardId).toBe(board.id);
      } finally {
        // Clean up the test board
        await deleteBoard(request, board.id);
      }
    });

    test('invalid pair code shows error', async ({ page }) => {
      // Clear localStorage to ensure clean state
      await page.goto('/');
      await clearBoardFromStorage(page);

      // Navigate to /controller - should show pairing view
      await page.goto('/controller');

      // Verify pairing view is shown
      const pairingView = page.locator('[data-testid="pairing-view"]');
      await expect(pairingView).toBeVisible({ timeout: 10000 });

      // Enter an invalid pair code
      const pairCodeInput = page.locator('[data-testid="pair-code-input"]');
      await expect(pairCodeInput).toBeVisible();
      await pairCodeInput.fill('000000');

      // Click Connect button
      const connectBtn = page.locator('[data-testid="pair-btn"]');
      await expect(connectBtn).toBeEnabled();
      await connectBtn.click();

      // Verify error message appears
      const errorMessage = page.locator('[data-testid="pair-error"]');
      await expect(errorMessage).toBeVisible({ timeout: 10000 });

      // Verify we're still on the pairing view (not navigated away)
      await expect(pairingView).toBeVisible();
    });
  });
});
