import { test, expect } from '@playwright/test';
import { selectors } from './selectors';

/**
 * E2E Tests for TV Board View
 *
 * Tests the read-only board that shows on the stable TV.
 * The /board route auto-creates a board if none exists.
 */

test.describe('TV Board View', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the board view - this auto-creates a board if needed
    await page.goto('/board');
    // Wait for board view to be ready (setup completes automatically)
    await expect(page.locator(selectors.boardView)).toBeVisible({ timeout: 15000 });
  });

  test('should render the board view', async ({ page }) => {
    const boardView = page.locator(selectors.boardView);
    await expect(boardView).toBeVisible();
  });

  test('should show grid or empty state', async ({ page }) => {
    // New boards show empty state, boards with horses show the grid
    const grid = page.locator(selectors.swimLaneGrid);
    const empty = page.locator('[data-testid="board-empty"]');

    const gridVisible = await grid.isVisible().catch(() => false);
    const emptyVisible = await empty.isVisible().catch(() => false);

    // Either we have a grid OR we have empty state
    expect(gridVisible || emptyVisible).toBeTruthy();
  });

  test('should show time mode badge', async ({ page }) => {
    const badge = page.locator(selectors.timeModeBadge);
    await expect(badge).toBeVisible();

    // Should show either AM or PM
    const text = await badge.textContent();
    expect(['AM', 'PM']).toContain(text?.trim());
  });

  test('should apply correct theme based on time mode', async ({ page }) => {
    const boardView = page.locator(selectors.boardView);
    await expect(boardView).toBeVisible();

    // Should have data-theme attribute
    const theme = await boardView.getAttribute('data-theme');
    expect(['am', 'pm']).toContain(theme);
  });
});
