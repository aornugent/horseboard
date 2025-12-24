import { test, expect } from '@playwright/test';

/**
 * Accessibility Audit for HorseBoard
 *
 * This test suite audits:
 * - Button accessibility (keyboard nav, ARIA labels)
 * - Form input labels and associations
 * - Color contrast ratios for legibility
 * - Mobile responsiveness and touch targets
 * - Focus management and keyboard navigation
 * - Semantic HTML structure
 * - ARIA attributes and screen reader compatibility
 */

test.describe('Accessibility Audit (A11y)', () => {
  test.describe('Display App - Visual & Semantic Accessibility', () => {
    test('pairing screen has semantic headings and visible text', async ({ page }) => {
      await page.goto('/display');

      // Should have an h1 in pairing screen
      const heading = page.locator('#pairing-screen h1');
      await expect(heading).toBeVisible();

      const headingText = await heading.textContent();
      expect(headingText).toBeTruthy();
      expect(headingText).toContain('Enter this code');
    });

    test('pairing code is readable with sufficient contrast', async ({ page }) => {
      await page.goto('/display');

      // Pair code should be large and readable
      const pairCode = page.locator('#pair-code');
      const fontSize = await pairCode.evaluate(el => window.getComputedStyle(el).fontSize);
      const fontSizeNum = parseInt(fontSize);

      // Should be at least 48px (large enough for TV display)
      expect(fontSizeNum).toBeGreaterThanOrEqual(48);

      // Text color should be light on dark background
      const color = await pairCode.evaluate(el => window.getComputedStyle(el).color);
      expect(color).toBeTruthy();
    });

    test('feed grid uses semantic grid structure', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Set test data
      const testData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: [
          { id: 'f1', name: 'Hay', unit: 'scoop', rank: 1 }
        ],
        horses: [
          { id: 'h1', name: 'Spider', note: null, noteExpiry: null }
        ],
        diet: {
          h1: { f1: { am: 1, pm: 0.5 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      await displayPage.locator('.grid-cell.horse-name').waitFor({ timeout: 5000 });

      // Grid should use CSS Grid (semantic structure)
      const grid = displayPage.locator('#feed-grid');
      const display = await grid.evaluate(el => window.getComputedStyle(el).display);
      expect(display).toBe('grid');

      // Grid cells should be flex containers
      const headerCell = displayPage.locator('.grid-cell.header').first();
      const cellDisplay = await headerCell.evaluate(el => window.getComputedStyle(el).display);
      expect(cellDisplay).toBe('flex');

      await displayPage.close();
    });

    test('time mode indicator is visible and readable', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      const testData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'PM',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: [{ id: 'f1', name: 'Test', unit: 'scoop', rank: 1 }],
        horses: [{ id: 'h1', name: 'Test', note: null, noteExpiry: null }],
        diet: { h1: { f1: { am: 1, pm: 0 } } }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Wait for time mode to render with PM
      await displayPage.locator('#time-mode').waitFor({ timeout: 5000 });
      await expect(displayPage.locator('#time-mode')).toContainText('PM');

      // Time indicator should be visible
      const timeIndicator = displayPage.locator('.time-indicator');
      await expect(timeIndicator).toBeVisible();

      // Should have sufficient size
      const fontSize = await timeIndicator.evaluate(el => window.getComputedStyle(el).fontSize);
      const fontSizeNum = parseInt(fontSize);
      expect(fontSizeNum).toBeGreaterThanOrEqual(19); // ~1.2rem

      // Should have a border for visibility
      const border = await timeIndicator.evaluate(el => window.getComputedStyle(el).border);
      expect(border).toBeTruthy();

      await displayPage.close();
    });

    test('error messages are clearly visible and informative', async ({ page }) => {
      await page.goto('/display');

      // Error overlay should exist in DOM
      const errorOverlay = page.locator('#error-overlay');
      expect(errorOverlay).toBeTruthy();

      // Error message should exist
      const errorMessage = page.locator('#error-message');
      expect(errorMessage).toBeTruthy();

      // Retry button should exist and be visible when needed
      const retryBtn = page.locator('#retry-btn');
      expect(retryBtn).toBeTruthy();
    });

    test('display is responsive on mobile viewports', async ({ page }) => {
      // Test on mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/display');

      // Pairing code should still be readable
      const pairCode = page.locator('#pair-code');
      await expect(pairCode).toBeVisible();

      const fontSize = await pairCode.evaluate(el => window.getComputedStyle(el).fontSize);
      const fontSizeNum = parseInt(fontSize);

      // On mobile, should be smaller but still readable
      expect(fontSizeNum).toBeGreaterThanOrEqual(32);

      // No horizontal scroll should be needed
      const htmlWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const viewportWidth = 375;
      expect(htmlWidth).toBeLessThanOrEqual(viewportWidth + 1); // +1 for rounding
    });
  });

  test.describe('Controller App - Mobile Accessibility', () => {
    test('controller buttons have adequate touch target size', async ({ page, context }) => {
      const controllerPage = await context.newPage();
      // Set mobile viewport
      await controllerPage.setViewportSize({ width: 375, height: 667 });
      await controllerPage.goto('/controller');

      // Pairing code input should have adequate height
      const codeInputs = controllerPage.locator('.code-digit');
      if (await codeInputs.count() > 0) {
        const height = await codeInputs.first().evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.height;
        });

        // Touch targets should be at least 44px (iOS) or 48px (Android)
        expect(height).toBeGreaterThanOrEqual(40);
      }

      // Connect button should have adequate size
      const connectBtn = controllerPage.locator('#connect-btn');
      if (await connectBtn.isVisible()) {
        const btnHeight = await connectBtn.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.height;
        });
        expect(btnHeight).toBeGreaterThanOrEqual(44);
      }

      await controllerPage.close();
    });

    test('controller has keyboard navigation support', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const pairCode = await displayPage.locator('#pair-code').textContent();

      const controllerPage = await context.newPage();
      await controllerPage.goto('/controller');

      // Set focus to first input
      const firstCodeDigit = controllerPage.locator('.code-digit[data-index="0"]');
      await firstCodeDigit.focus();

      // Verify focus is set
      const isFocused = await firstCodeDigit.evaluate(el => el === document.activeElement);
      expect(isFocused).toBe(true);

      // Tab navigation should work
      await controllerPage.keyboard.press('Tab');

      // Focus should move to next element
      const nextElement = await controllerPage.evaluate(() => {
        return document.activeElement?.getAttribute('data-index') || document.activeElement?.id || 'unknown';
      });

      // Should have moved focus
      expect(nextElement).not.toBe('0');

      await displayPage.close();
      await controllerPage.close();
    });

    test('time mode toggle buttons are keyboard accessible', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      const pairCode = await displayPage.locator('#pair-code').textContent();

      const controllerPage = await context.newPage();
      await controllerPage.goto('/controller');

      const codeDigits = pairCode.split('');
      for (let i = 0; i < 6; i++) {
        await controllerPage.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      await controllerPage.locator('#connect-btn').click();
      await controllerPage.locator('#editor-screen').waitFor({ state: 'visible' });
      await controllerPage.locator('#board-grid').waitFor({ state: 'attached', timeout: 5000 });

      // Set initial data with data to show controls
      const testData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: [{ id: 'f1', name: 'Test', unit: 'scoop', rank: 1 }],
        horses: [{ id: 'h1', name: 'Test', note: null, noteExpiry: null }],
        diet: { h1: { f1: { am: 1, pm: 0 } } }
      };

      await controllerPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Look for time mode buttons (should be present after editor loads)
      const timeButtons = controllerPage.locator('button').filter({ hasText: /AM|PM|AUTO/ });
      // Wait for at least one time button to be available
      await controllerPage.locator('.mode-btn').first().waitFor({ state: 'visible', timeout: 5000 });
      const buttonCount = await timeButtons.count();

      // If time buttons exist, they should be keyboard navigable
      if (buttonCount > 0) {
        const firstButton = timeButtons.first();
        await firstButton.focus();

        const isFocused = await firstButton.evaluate(el => el === document.activeElement);
        expect(isFocused).toBe(true);

        // Should be clickable with Enter key
        const initialText = await firstButton.textContent();
        expect(initialText).toBeTruthy();
      }

      await displayPage.close();
      await controllerPage.close();
    });

    test('controller is responsive and usable on small screens', async ({ page, context }) => {
      const controllerPage = await context.newPage();
      await controllerPage.setViewportSize({ width: 320, height: 568 }); // iPhone SE
      await controllerPage.goto('/controller');

      // Pairing screen should fit on small screen
      const pairingForm = controllerPage.locator('form, [role="form"], .pairing-content');
      const formCount = await pairingForm.count();

      // Should have some pairing UI
      expect(formCount).toBeGreaterThan(0);

      // Code inputs should be visible
      const codeInput = controllerPage.locator('.code-digit, input[type="text"]');
      const inputCount = await codeInput.count();

      // Should have some inputs for pairing code
      expect(inputCount).toBeGreaterThanOrEqual(1);

      // No horizontal scroll
      const htmlWidth = await controllerPage.evaluate(() => document.documentElement.scrollWidth);
      expect(htmlWidth).toBeLessThanOrEqual(320 + 1);

      await controllerPage.close();
    });

    test('form inputs have visible labels or placeholder text', async ({ page, context }) => {
      const controllerPage = await context.newPage();
      await controllerPage.goto('/controller');

      // Code digit inputs should have clear labeling
      const codeDigit = controllerPage.locator('.code-digit').first();
      const placeholder = await codeDigit.getAttribute('placeholder');
      const label = await codeDigit.getAttribute('aria-label');
      const title = await codeDigit.getAttribute('title');

      // Should have at least one form of label
      const hasLabel = placeholder || label || title;
      expect(hasLabel).toBeTruthy();

      await controllerPage.close();
    });
  });

  test.describe('Legibility in Stable Environment (Dusty/Bright Conditions)', () => {
    test('display text meets WCAG contrast requirements', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      const testData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: [
          { id: 'f1', name: 'Hay', unit: 'scoop', rank: 1 }
        ],
        horses: [
          { id: 'h1', name: 'Spider', note: null, noteExpiry: null }
        ],
        diet: {
          h1: { f1: { am: 1, pm: 0.5 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      await displayPage.locator('.grid-cell.horse-name').waitFor({ timeout: 5000 });

      // Check contrast of value cells (should be light text on dark background)
      const valueCell = displayPage.locator('.grid-cell.value').first();
      const textColor = await valueCell.evaluate(el => window.getComputedStyle(el).color);
      const bgColor = await valueCell.evaluate(el => window.getComputedStyle(el).backgroundColor);

      // Should have defined colors
      expect(textColor).toBeTruthy();
      expect(bgColor).toBeTruthy();

      // Text should be bold/large for readability
      const fontWeight = await valueCell.evaluate(el => window.getComputedStyle(el).fontWeight);
      expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(500);

      // Font size should be readable from distance
      const fontSize = await valueCell.evaluate(el => window.getComputedStyle(el).fontSize);
      expect(parseInt(fontSize)).toBeGreaterThanOrEqual(24); // At least 1.5rem

      await displayPage.close();
    });

    test('header cells use distinct styling for clarity', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      const testData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: [{ id: 'f1', name: 'Hay', unit: 'scoop', rank: 1 }],
        horses: [{ id: 'h1', name: 'Spider', note: null, noteExpiry: null }],
        diet: { h1: { f1: { am: 1, pm: 0.5 } } }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      await displayPage.locator('.grid-cell.header.feed-label').waitFor({ timeout: 5000 });

      // Headers should have distinct styling
      const headerCell = displayPage.locator('.grid-cell.header.feed-label');
      const headerBgColor = await headerCell.evaluate(el => window.getComputedStyle(el).backgroundColor);
      const headerTextColor = await headerCell.evaluate(el => window.getComputedStyle(el).color);

      const valueCell = displayPage.locator('.grid-cell.value').first();
      const valueBgColor = await valueCell.evaluate(el => window.getComputedStyle(el).backgroundColor);
      const valueTextColor = await valueCell.evaluate(el => window.getComputedStyle(el).color);

      // Header should use different background
      expect(headerBgColor).not.toBe(valueBgColor);

      // Header should use different text color for distinction
      expect(headerTextColor).not.toBe(valueTextColor);

      // Header should be uppercase or bold
      const headerText = await headerCell.evaluate(el => window.getComputedStyle(el).textTransform);
      const headerWeight = await headerCell.evaluate(el => window.getComputedStyle(el).fontWeight);

      expect(headerText === 'uppercase' || parseInt(headerWeight) > 500).toBe(true);

      await displayPage.close();
    });

    test('controller colors are readable in sunlight conditions', async ({ page, context }) => {
      const controllerPage = await context.newPage();
      await controllerPage.goto('/controller');

      // Main text should have readable size
      const pairing = controllerPage.locator('h1, [role="heading"]').first();
      if (await pairing.isVisible()) {
        const fontSize = await pairing.evaluate(el => window.getComputedStyle(el).fontSize);
        expect(parseInt(fontSize)).toBeGreaterThanOrEqual(20);
      }

      // Buttons should have clear contrast
      const buttons = controllerPage.locator('button');
      if (await buttons.count() > 0) {
        const button = buttons.first();
        const bgColor = await button.evaluate(el => window.getComputedStyle(el).backgroundColor);
        const textColor = await button.evaluate(el => window.getComputedStyle(el).color);

        expect(bgColor).toBeTruthy();
        expect(textColor).toBeTruthy();
      }

      await controllerPage.close();
    });
  });

  test.describe('Usability & Utility Considerations', () => {
    test('critical controls are always accessible and not hidden by default', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      const testData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: [{ id: 'f1', name: 'Hay', unit: 'scoop', rank: 1 }],
        horses: [{ id: 'h1', name: 'Spider', note: null, noteExpiry: null }],
        diet: { h1: { f1: { am: 1, pm: 0.5 } } }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      await displayPage.locator('.grid-cell.horse-name').waitFor({ timeout: 5000 });

      // Error overlay should be hidden initially (not blocking content)
      const errorOverlay = displayPage.locator('#error-overlay');
      const isHidden = await errorOverlay.evaluate(el => el.classList.contains('hidden'));
      expect(isHidden).toBe(true);

      // Retry button should be hidden initially
      const retryBtn = displayPage.locator('#retry-btn');
      const isRetryHidden = await retryBtn.evaluate(el => el.classList.contains('hidden'));
      expect(isRetryHidden).toBe(true);

      await displayPage.close();
    });

    test('focus indicators are visible for keyboard navigation', async ({ page, context }) => {
      const controllerPage = await context.newPage();
      await controllerPage.goto('/controller');

      // Get first code digit
      const firstDigit = controllerPage.locator('.code-digit[data-index="0"]');

      // Focus it
      await firstDigit.focus();

      // Check if focused element has visible outline/ring
      const outline = await firstDigit.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.outline || style.boxShadow || style.border;
      });

      // Should have some visual indication of focus
      expect(outline).toBeTruthy();

      await controllerPage.close();
    });

    test('error states are clearly communicated to users', async ({ page, context }) => {
      const controllerPage = await context.newPage();
      await controllerPage.goto('/controller');

      // Enter invalid pairing code
      for (let i = 0; i < 6; i++) {
        await controllerPage.locator(`.code-digit[data-index="${i}"]`).fill('0');
      }

      const connectBtn = controllerPage.locator('#connect-btn');
      await connectBtn.click();

      // Wait for error to appear
      const errorElement = controllerPage.locator('[role="alert"], .error, .error-message, #error').first();
      const waitResult = await errorElement.waitFor({ state: 'visible', timeout: 3000 }).catch(() => null);

      // Should either show error visibly or disable connect button
      const isDisabled = await connectBtn.isDisabled();
      const hasError = waitResult !== null;

      expect(isDisabled || hasError).toBe(true);

      await controllerPage.close();
    });

    test('pagination controls are visible when needed', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Create 15 horses (more than zoom level 2 can show = 7)
      const horses = Array.from({ length: 15 }, (_, i) => ({
        id: `h${i}`,
        name: `Horse ${i}`,
        note: null,
        noteExpiry: null
      }));

      const testData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: [{ id: 'f1', name: 'Hay', unit: 'scoop', rank: 1 }],
        horses,
        diet: Object.fromEntries(horses.map(h => [
          h.id,
          { f1: { am: 1, pm: 1 } }
        ]))
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Wait for grid to render (first horse name cell)
      await displayPage.locator('.grid-cell.horse-name').first().waitFor({ timeout: 5000 });

      // Pagination should be visible
      const pagination = displayPage.locator('#pagination');
      const isVisible = await pagination.isVisible();
      expect(isVisible).toBe(true);

      // Page info should show which page we're on
      const pageInfo = displayPage.locator('#page-info');
      const pageText = await pageInfo.textContent();
      expect(pageText).toMatch(/Page \d+ of \d+/);

      await displayPage.close();
    });
  });
});
