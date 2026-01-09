import { test, expect } from './fixtures/auth';
import { selectors, timeModeSelectors } from './selectors';

/**
 * Controller Smoke Tests
 * 
 * Minimal sanity checks for controller layout. Real behavior is tested in flows/.
 * Only tests unique structure, not element visibility covered by usage in other tests.
 */

test.describe('Controller Smoke Tests', () => {
  test('has all four navigation tabs for owner', async ({ ownerPage }) => {
    // Verify tabs that SHOULD exist
    await expect(ownerPage.locator('[data-testid="tab-horses"]')).toBeVisible();
    await expect(ownerPage.locator('[data-testid="tab-feeds"]')).toBeVisible();
    await expect(ownerPage.locator('[data-testid="tab-board"]')).toBeVisible();
    await expect(ownerPage.locator('[data-testid="tab-settings"]')).toBeVisible();

    // Verify Tokens tab does NOT exist (regression check)
    await expect(ownerPage.locator('[data-testid="tab-tokens"]')).not.toBeVisible();
  });

  test('display controls drawer toggles on Board tab', async ({ ownerPage }) => {
    await ownerPage.locator('[data-testid="tab-board"]').click();
    await expect(ownerPage.locator(selectors.boardTab)).toBeVisible();

    const toggleBtn = ownerPage.locator('[data-testid="toggle-display-controls"]');
    const drawer = ownerPage.locator('[data-testid="display-controls-drawer"]');

    await expect(drawer).not.toBeVisible();
    await toggleBtn.click();
    await expect(drawer).toBeVisible();

    // Time mode now visible by default; Orientation/Zoom in overflow
    await expect(ownerPage.locator(selectors.timeModeSelector)).toBeVisible();
    await expect(ownerPage.locator('[data-testid="orientation-toggle"]')).not.toBeVisible();
    await ownerPage.click('[data-testid="overflow-menu-btn"]');
    await expect(ownerPage.locator('[data-testid="orientation-toggle"]')).toBeVisible();
    await expect(ownerPage.locator(selectors.zoomSelector)).toBeVisible();

    await toggleBtn.click();
    await expect(drawer).not.toBeVisible();
  });

  test('settings tab shows display defaults for owner', async ({ ownerPage }) => {
    await ownerPage.locator('[data-testid="tab-settings"]').click();
    await expect(ownerPage.locator(selectors.settingsTab)).toBeVisible();

    // Owner sees display defaults section
    await expect(ownerPage.getByTestId('display-defaults-section')).toBeVisible();
    await expect(ownerPage.getByTestId('default-orientation-selector')).toBeVisible();
    await expect(ownerPage.getByTestId('default-zoom-selector')).toBeVisible();
  });

  test('settings tab shows board pair code and timezone selector', async ({ ownerPage }) => {
    await ownerPage.locator('[data-testid="tab-settings"]').click();
    await expect(ownerPage.locator(selectors.settingsTab)).toBeVisible();

    // Essential settings elements
    await expect(ownerPage.locator(selectors.boardPairCode)).toBeVisible();
    await expect(ownerPage.locator(selectors.timezoneSelector)).toBeVisible();

    // Verify time mode selector NOT on settings (moved to Board tab)
    await expect(ownerPage.locator(selectors.timeModeSelector)).not.toBeVisible();
  });

  test('tapping grid closes drawer', async ({ ownerPage }) => {
    await ownerPage.locator('[data-testid="tab-board"]').click();
    await ownerPage.locator('[data-testid="toggle-display-controls"]').click();
    await expect(ownerPage.locator('[data-testid="display-controls-drawer"]')).toBeVisible();

    // Tap on grid area
    await ownerPage.locator('[data-testid="board-preview"]').click();

    // Drawer should close
    await expect(ownerPage.locator('[data-testid="display-controls-drawer"]')).not.toBeVisible();
  });
});
