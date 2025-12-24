import { test as base } from '@playwright/test';

/**
 * Custom Playwright fixtures for HorseBoard E2E tests
 * Provides reusable test helpers to reduce code duplication
 */

/**
 * Fixture that creates a display and automatically cleans it up
 * Returns: { displayPage, displayId, pairCode }
 */
export const test = base.extend({
  display: async ({ context }, use) => {
    const displayPage = await context.newPage();
    await displayPage.goto('/display');

    // Wait for display creation
    await displayPage.locator('#pairing-screen').waitFor({ state: 'visible', timeout: 5000 });

    const displayId = await displayPage.evaluate(() => {
      return localStorage.getItem('horseboard_display_id');
    });

    const pairCode = await displayPage.locator('#pair-code').textContent();

    // Provide display info to the test
    await use({ displayPage, displayId, pairCode });

    // Cleanup: Delete the display after test completes
    try {
      await displayPage.request.delete(`/api/displays/${displayId}`);
    } catch (error) {
      // Ignore cleanup errors
      console.warn(`Failed to cleanup display ${displayId}:`, error.message);
    }

    await displayPage.close();
  },

  /**
   * Fixture that creates a paired controller
   * Requires: display fixture
   * Returns: { controllerPage, displayPage, displayId }
   */
  pairedController: async ({ context, display }, use) => {
    const { displayPage, displayId, pairCode } = display;

    const controllerPage = await context.newPage();
    await controllerPage.goto('/controller');

    // Wait for pairing screen
    await controllerPage.locator('#pairing-screen').waitFor({ state: 'visible', timeout: 5000 });

    // Enter pairing code
    const codeDigits = pairCode.split('');
    for (let i = 0; i < 6; i++) {
      await controllerPage.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
    }

    // Click connect button
    await controllerPage.locator('#connect-btn').click();

    // Wait for editor screen to load
    await controllerPage.locator('#editor-screen').waitFor({ state: 'visible', timeout: 5000 });
    await controllerPage.locator('#board-grid').waitFor({ state: 'attached', timeout: 5000 });

    // Provide controller and display info to the test
    await use({ controllerPage, displayPage, displayId });

    // Cleanup: Close controller page
    await controllerPage.close();
  },
});

export { expect } from '@playwright/test';
