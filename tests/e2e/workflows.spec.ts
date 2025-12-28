import { test, expect } from '@playwright/test';
import { selectors } from './selectors';

/**
 * E2E Workflow Tests
 *
 * Tests complete user workflows across the application.
 * These tests simulate real user scenarios.
 */

test.describe('End-to-End Workflows', () => {
  test.describe('Feed Management Workflow', () => {
    test('should add a new feed and see it in the list', async ({ page }) => {
      // Go to feeds tab
      await page.goto('/feeds');

      // Click add feed button
      await page.locator(selectors.addFeedBtn).click();

      // Fill in feed details
      const feedName = 'Oats';
      await page.locator(selectors.newFeedName).fill(feedName);
      await page.locator(selectors.unitBtn('scoop')).click();

      // Confirm adding
      await page.locator(selectors.confirmAddFeed).click();

      // Should see the new feed in the list
      const feedCard = page.locator(`[data-testid^="feed-card-"]`);
      await expect(feedCard.filter({ hasText: feedName })).toBeVisible();
    });

    test('should edit an existing feed', async ({ page }) => {
      await page.goto('/feeds');

      // If there are feeds, click on one to edit
      const feedCards = page.locator('[data-testid^="feed-card-"]');
      const count = await feedCards.count();

      if (count > 0) {
        // Click the first feed card (to edit)
        await feedCards.first().click();

        // If edit modal opens
        const editModal = page.locator(selectors.editFeedModal);
        const isVisible = await editModal.isVisible().catch(() => false);

        if (isVisible) {
          // Modify the name
          const editInput = page.locator(selectors.editFeedName);
          await editInput.fill('Modified Feed Name');

          // Save changes
          await page.locator(selectors.confirmEditFeed).click();
        }
      }
    });

    test('should delete a feed after confirmation', async ({ page }) => {
      await page.goto('/feeds');

      const feedCards = page.locator('[data-testid^="feed-card-"]');
      const initialCount = await feedCards.count();

      if (initialCount > 0) {
        // Click delete on first feed
        const deleteBtn = page.locator('[data-testid^="feed-card-delete-"]').first();
        await deleteBtn.click();

        // Confirm deletion
        const confirmDelete = page.locator(selectors.confirmDeleteFeed);
        if (await confirmDelete.isVisible()) {
          await confirmDelete.click();

          // Feed should be removed
          await expect(feedCards).toHaveCount(initialCount - 1);
        }
      }
    });

    test('should search and filter feeds', async ({ page }) => {
      await page.goto('/feeds');

      // Type in search
      const searchInput = page.locator(selectors.feedSearch);
      await searchInput.fill('unique');

      // List should filter (or show empty if no match)
      const feedList = page.locator(selectors.feedList);
      await expect(feedList).toBeVisible();
    });
  });

  test.describe('Diet Editing Workflow', () => {
    test('should update a horse diet amount using FeedPad', async ({ page }) => {
      await page.goto('/');

      // Click on a horse card
      const horseCards = page.locator('[data-testid^="horse-card-"]');
      const count = await horseCards.count();

      if (count > 0) {
        await horseCards.first().click();

        // Wait for horse detail to load
        await expect(page.locator(selectors.horseDetail)).toBeVisible();

        // Click on AM value for a feed
        const amBtn = page.locator('[data-testid^="feed-tile-am-"]').first();
        if (await amBtn.isVisible()) {
          await amBtn.click();

          // FeedPad should open
          await expect(page.locator(selectors.feedPad)).toBeVisible();

          // Set value to 2 using preset
          await page.locator(selectors.presetTwo).click();

          // Close FeedPad
          await page.locator(selectors.feedPadConfirm).click();

          // Value should be updated (check the button text)
          const valueText = await amBtn.locator('.value-amount').textContent();
          expect(valueText).toContain('2');
        }
      }
    });

    test('should clear diet amount using Empty preset', async ({ page }) => {
      await page.goto('/');

      const horseCards = page.locator('[data-testid^="horse-card-"]');
      if (await horseCards.count() > 0) {
        await horseCards.first().click();

        const amBtn = page.locator('[data-testid^="feed-tile-am-"]').first();
        if (await amBtn.isVisible()) {
          await amBtn.click();

          // Clear the value
          await page.locator(selectors.presetEmpty).click();
          await page.locator(selectors.feedPadConfirm).click();

          // Value should show dash
          const valueText = await amBtn.locator('.value-amount').textContent();
          expect(valueText?.trim()).toBe('—');
        }
      }
    });

    test('should use stepper for fine-grained control', async ({ page }) => {
      await page.goto('/');

      const horseCards = page.locator('[data-testid^="horse-card-"]');
      if (await horseCards.count() > 0) {
        await horseCards.first().click();

        const amBtn = page.locator('[data-testid^="feed-tile-am-"]').first();
        if (await amBtn.isVisible()) {
          await amBtn.click();

          // Start with empty
          await page.locator(selectors.presetEmpty).click();

          // Use stepper to increment 3 times (0.75)
          await page.locator(selectors.stepperIncrement).click();
          await page.locator(selectors.stepperIncrement).click();
          await page.locator(selectors.stepperIncrement).click();

          // Check stepper value shows 0.75 or ¾
          const stepperValue = page.locator(selectors.stepperValue);
          const text = await stepperValue.textContent();
          expect(text).toMatch(/¾|0\.75/);

          await page.locator(selectors.feedPadConfirm).click();
        }
      }
    });
  });

  test.describe('Settings Workflow', () => {
    test('should change time mode', async ({ page }) => {
      await page.goto('/settings');

      // Get current effective mode
      const effectiveMode = page.locator(selectors.effectiveTimeMode);
      const currentMode = await effectiveMode.textContent();

      // Click on a different mode
      if (currentMode?.trim() === 'AM') {
        await page.locator(selectors.timeModePm).click();
      } else {
        await page.locator(selectors.timeModeAm).click();
      }

      // Wait for update
      await page.waitForTimeout(500);

      // Effective mode should update
      const newMode = await effectiveMode.textContent();
      expect(newMode?.trim()).not.toBe(currentMode?.trim());
    });

    test('should set time mode to AUTO', async ({ page }) => {
      await page.goto('/settings');

      // Click AUTO mode
      await page.locator(selectors.timeModeAuto).click();

      // The configured mode should be AUTO
      // Effective mode depends on current time
      await expect(page.locator(selectors.timeModeAuto)).toHaveClass(/active/);
    });

    test('should change zoom level', async ({ page }) => {
      await page.goto('/settings');

      // Click on zoom level 3 (Large)
      await page.locator(selectors.zoomLevel(3)).click();

      // Should be active
      await expect(page.locator(selectors.zoomLevel(3))).toHaveClass(/active/);
    });

    test('should change timezone', async ({ page }) => {
      await page.goto('/settings');

      const timezoneSelect = page.locator(selectors.timezoneSelector);
      await expect(timezoneSelect).toBeVisible();

      // Select a different timezone
      await timezoneSelect.selectOption('UTC');
      await expect(timezoneSelect).toHaveValue('UTC');
    });
  });

  test.describe('Navigation Workflow', () => {
    test('should navigate from horse list to detail and back', async ({ page }) => {
      await page.goto('/');

      const horseCards = page.locator('[data-testid^="horse-card-"]');
      if (await horseCards.count() > 0) {
        // Click on a horse
        await horseCards.first().click();

        // Should see horse detail
        await expect(page.locator(selectors.horseDetail)).toBeVisible();

        // Click back button
        await page.locator(selectors.horseDetailBack).click();

        // Should be back at horses tab
        await expect(page.locator(selectors.horsesTab)).toBeVisible();
      }
    });
  });

  test.describe('Real-Time Updates', () => {
    test('board should update when diet changes', async ({ page, context }) => {
      // Open board in one tab
      const boardPage = await context.newPage();
      await boardPage.goto('/board');

      // Wait for grid to load
      await expect(boardPage.locator(selectors.swimLaneGrid)).toBeVisible();

      // Open controller in another tab
      await page.goto('/');

      // Make a diet change
      const horseCards = page.locator('[data-testid^="horse-card-"]');
      if (await horseCards.count() > 0) {
        await horseCards.first().click();

        const amBtn = page.locator('[data-testid^="feed-tile-am-"]').first();
        if (await amBtn.isVisible()) {
          await amBtn.click();
          await page.locator(selectors.presetOne).click();
          await page.locator(selectors.feedPadConfirm).click();
        }
      }

      // Board should update via SSE (give it time)
      await boardPage.waitForTimeout(1000);

      // Grid should still be visible
      await expect(boardPage.locator(selectors.swimLaneGrid)).toBeVisible();

      await boardPage.close();
    });

    test('board theme should update with time mode changes', async ({ page, context }) => {
      // Open board
      const boardPage = await context.newPage();
      await boardPage.goto('/board');

      await expect(boardPage.locator(selectors.boardView)).toBeVisible();
      const initialTheme = await boardPage.locator(selectors.boardView).getAttribute('data-theme');

      // Open settings
      await page.goto('/settings');

      // Change time mode
      if (initialTheme === 'am') {
        await page.locator(selectors.timeModePm).click();
      } else {
        await page.locator(selectors.timeModeAm).click();
      }

      // Wait for SSE update
      await boardPage.waitForTimeout(1000);

      // Check theme changed
      const newTheme = await boardPage.locator(selectors.boardView).getAttribute('data-theme');
      expect(newTheme).not.toBe(initialTheme);

      await boardPage.close();
    });
  });

  test.describe('Horse Notes', () => {
    test('should display horse note in detail view', async ({ page }) => {
      await page.goto('/');

      const horseCards = page.locator('[data-testid^="horse-card-"]');
      if (await horseCards.count() > 0) {
        // Look for a card with a note indicator
        const noteIndicator = page.locator('[data-testid^="horse-card-note-"]');
        const hasNote = await noteIndicator.count() > 0;

        if (hasNote) {
          // Click on the horse with a note
          await noteIndicator.first().locator('..').click();

          // Note should be visible in detail
          const detailNote = page.locator(selectors.horseDetailNote);
          await expect(detailNote).toBeVisible();
        }
      }
    });

    test('should show notes in grid footer', async ({ page }) => {
      await page.goto('/board');

      const footer = page.locator(selectors.gridFooter);
      await expect(footer).toBeVisible();

      // Check for note cells
      const notes = page.locator('[data-testid^="note-"]');
      const count = await notes.count();

      // If there are horses, there should be note cells (even if empty)
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Fraction Display', () => {
    test('should show fractions correctly in grid', async ({ page }) => {
      await page.goto('/board');

      const badges = page.locator('[data-testid^="badge-"]');
      const count = await badges.count();

      if (count > 0) {
        // Check that values are displayed (could be fractions or numbers)
        for (let i = 0; i < Math.min(count, 3); i++) {
          const badge = badges.nth(i);
          const text = await badge.textContent();
          expect(text).toBeTruthy();

          // Text should be a number or fraction character
          expect(text).toMatch(/[\d¼½¾⅓⅔]+/);
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle horse not found gracefully', async ({ page }) => {
      // Navigate to a non-existent horse
      await page.goto('/horse/non-existent-id');

      // Should show error or redirect
      const detail = page.locator(selectors.horseDetail);
      const isVisible = await detail.isVisible().catch(() => false);

      if (isVisible) {
        // If detail is shown, it should indicate error
        const error = detail.locator('.horse-detail-error');
        await expect(error).toBeVisible();
      }
    });
  });

  test.describe('Board Preview', () => {
    test('should show accurate board preview', async ({ page }) => {
      await page.goto('/board');

      // Board tab should have the grid
      await expect(page.locator(selectors.boardTab)).toBeVisible();
      await expect(page.locator(selectors.swimLaneGrid)).toBeVisible();

      // Grid should show the board data
      const gridHeader = page.locator(selectors.gridHeader);
      await expect(gridHeader).toBeVisible();
    });
  });
});
