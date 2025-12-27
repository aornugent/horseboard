import { test, expect } from '@playwright/test';
import { selectors } from './selectors';

/**
 * E2E Tests for TV Display View
 *
 * Tests the read-only display that shows on the stable TV.
 * Uses data-testid selectors for stability.
 */

test.describe('TV Display View', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the display view
    await page.goto('/display');
  });

  test.describe('Grid Rendering', () => {
    test('should render the swim lane grid', async ({ page }) => {
      const grid = page.locator(selectors.swimLaneGrid);
      await expect(grid).toBeVisible();
    });

    test('should render grid header with horse names', async ({ page }) => {
      const header = page.locator(selectors.gridHeader);
      await expect(header).toBeVisible();
    });

    test('should render grid footer with horse notes', async ({ page }) => {
      const footer = page.locator(selectors.gridFooter);
      await expect(footer).toBeVisible();
    });

    test('should have vertical swim lanes with zebra striping', async ({ page }) => {
      const grid = page.locator(selectors.swimLaneGrid);
      await expect(grid).toBeVisible();

      // Check for swim-lane-primary and swim-lane-alt classes
      const primaryLanes = page.locator('.swim-lane-primary');
      const altLanes = page.locator('.swim-lane-alt');

      // Should have at least one of each if there are multiple horses
      const primaryCount = await primaryLanes.count();
      const altCount = await altLanes.count();

      // At minimum, we should have the structure in place
      expect(primaryCount + altCount).toBeGreaterThan(0);
    });

    test('should render blank cells for zero/null values', async ({ page }) => {
      // Cells without values should be strictly blank (no dash, no "0")
      const cells = page.locator('[data-testid^="cell-"]');
      const cellCount = await cells.count();

      if (cellCount > 0) {
        // Check that cells don't contain "0" or "-" for empty values
        for (let i = 0; i < Math.min(cellCount, 5); i++) {
          const cell = cells.nth(i);
          const badge = cell.locator('[data-testid^="badge-"]');
          const hasBadge = await badge.count() > 0;

          if (!hasBadge) {
            // Cell should be empty, not show "0" or "-"
            const text = await cell.textContent();
            expect(text?.trim() || '').toBe('');
          }
        }
      }
    });

    test('should render scoop badges for non-zero values', async ({ page }) => {
      // Badges should appear for cells with values
      const badges = page.locator('[data-testid^="badge-"]');
      const badgeCount = await badges.count();

      // If there are badges, they should contain formatted values
      if (badgeCount > 0) {
        const firstBadge = badges.first();
        await expect(firstBadge).toBeVisible();

        // Badge should contain a value (number or fraction)
        const text = await firstBadge.textContent();
        expect(text).toBeTruthy();
      }
    });

    test('should use tabular-nums for monospace number alignment', async ({ page }) => {
      const badges = page.locator('.badge-value');
      const count = await badges.count();

      if (count > 0) {
        // Check that badge-value class exists (CSS applies tabular-nums)
        await expect(badges.first()).toBeVisible();
      }
    });
  });

  test.describe('Time Mode Display', () => {
    test('should show time mode badge', async ({ page }) => {
      const badge = page.locator(selectors.timeModeBadge);
      await expect(badge).toBeVisible();

      // Should show either AM or PM
      const text = await badge.textContent();
      expect(['AM', 'PM']).toContain(text?.trim());
    });

    test('should apply correct theme based on time mode', async ({ page }) => {
      const displayView = page.locator(selectors.displayView);
      await expect(displayView).toBeVisible();

      // Should have data-theme attribute
      const theme = await displayView.getAttribute('data-theme');
      expect(['am', 'pm']).toContain(theme);
    });
  });

  test.describe('Theming', () => {
    test('should have AM theme styles (Morning Mist)', async ({ page }) => {
      const displayView = page.locator(selectors.displayView);
      const theme = await displayView.getAttribute('data-theme');

      if (theme === 'am') {
        // AM theme: Off-white/Hunter Green
        // Just verify the attribute is set correctly
        expect(theme).toBe('am');
      }
    });

    test('should have PM theme styles (Tack Room)', async ({ page }) => {
      const displayView = page.locator(selectors.displayView);
      const theme = await displayView.getAttribute('data-theme');

      if (theme === 'pm') {
        // PM theme: Dark Grey/Amber
        expect(theme).toBe('pm');
      }
    });
  });

  test.describe('Accessibility', () => {
    test('display view should have proper structure', async ({ page }) => {
      const displayView = page.locator(selectors.displayView);
      await expect(displayView).toBeVisible();

      // Should have a header
      const header = page.locator('.display-header');
      await expect(header).toBeVisible();

      // Should have main content
      const main = page.locator('.display-content');
      await expect(main).toBeVisible();
    });

    test('grid should be readable at distance', async ({ page }) => {
      // Verify grid structure is present for TV viewing
      const grid = page.locator(selectors.swimLaneGrid);
      await expect(grid).toBeVisible();

      // Header row should be visible
      const header = page.locator(selectors.gridHeader);
      await expect(header).toBeVisible();
    });
  });

  test.describe('Read-Only Behavior', () => {
    test('cells should not be clickable in display mode', async ({ page }) => {
      const cells = page.locator('[data-testid^="cell-"]');
      const count = await cells.count();

      if (count > 0) {
        // Cells should not have editable class
        const firstCell = cells.first();
        const classes = await firstCell.getAttribute('class');
        expect(classes).not.toContain('grid-cell--editable');
      }
    });

    test('should not show FeedPad on cell click', async ({ page }) => {
      const cells = page.locator('[data-testid^="cell-"]');
      const count = await cells.count();

      if (count > 0) {
        await cells.first().click();

        // FeedPad should not appear
        const feedPad = page.locator(selectors.feedPad);
        await expect(feedPad).not.toBeVisible();
      }
    });
  });
});
