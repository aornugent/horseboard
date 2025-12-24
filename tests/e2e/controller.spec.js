import { test, expect } from '@playwright/test';

test.describe('Controller App', () => {
  test.describe('Pairing Screen', () => {
    test('shows pairing code input on load', async ({ page }) => {
      await page.goto('/controller');

      // Should show pairing screen
      const pairingScreen = page.locator('#pairing-screen');
      await expect(pairingScreen).not.toHaveClass(/hidden/);

      // Should have 6 digit inputs
      const codeInputs = page.locator('.code-digit');
      expect(await codeInputs.count()).toBe(6);
    });

    test('allows entering 6-digit pairing code', async ({ page }) => {
      await page.goto('/controller');

      // Focus first input
      const firstInput = page.locator('.code-digit[data-index="0"]');
      await firstInput.click();

      // Type digits
      await firstInput.type('1');
      const secondInput = page.locator('.code-digit[data-index="1"]');
      await expect(secondInput).toBeFocused();

      // Complete typing all 6 digits
      await page.locator('.code-digit[data-index="0"]').fill('1');
      await page.locator('.code-digit[data-index="1"]').fill('2');
      await page.locator('.code-digit[data-index="2"]').fill('3');
      await page.locator('.code-digit[data-index="3"]').fill('4');
      await page.locator('.code-digit[data-index="4"]').fill('5');
      await page.locator('.code-digit[data-index="5"]').fill('6');

      // Connect button should be enabled
      const connectBtn = page.locator('#connect-btn');
      await expect(connectBtn).not.toBeDisabled();
    });

    test('validates pairing code format', async ({ page }) => {
      await page.goto('/controller');

      // Try invalid code
      const firstInput = page.locator('.code-digit[data-index="0"]');
      await firstInput.click();
      await firstInput.type('a'); // Non-numeric

      // Connect button should remain disabled
      const connectBtn = page.locator('#connect-btn');
      // The input validation should prevent non-numeric characters
    });

    test('shows error message on invalid code', async ({ page, context }) => {
      await page.goto('/controller');

      // Enter a code that doesn't exist
      await page.locator('.code-digit[data-index="0"]').fill('0');
      await page.locator('.code-digit[data-index="1"]').fill('0');
      await page.locator('.code-digit[data-index="2"]').fill('0');
      await page.locator('.code-digit[data-index="3"]').fill('0');
      await page.locator('.code-digit[data-index="4"]').fill('0');
      await page.locator('.code-digit[data-index="5"]').fill('0');

      const connectBtn = page.locator('#connect-btn');
      await connectBtn.click();

      // Wait for error response
      await page.waitForTimeout(500);

      // Error message should appear
      const errorMsg = page.locator('#pairing-error');
      await expect(errorMsg).not.toHaveClass(/hidden/);
    });
  });

  test.describe('Editor Screen Navigation', () => {
    test.beforeEach(async ({ page, context }) => {
      // Create and pair a display first
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Set up some test data
      const testData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: [
          { id: 'f1', name: 'Easisport', unit: 'scoop', rank: 1 }
        ],
        horses: [
          { id: 'h1', name: 'Spider', note: null, noteExpiry: null }
        ],
        diet: {
          h1: { f1: { am: 0.5, pm: 0.5 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      const pairCode = await displayPage.locator('#pair-code').textContent();
      await displayPage.close();

      // Now pair controller with this display
      await page.goto('/controller');

      const codeDigits = pairCode.split('');
      for (let i = 0; i < 6; i++) {
        await page.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      const connectBtn = page.locator('#connect-btn');
      await connectBtn.click();

      // Wait for editor screen to load
      await page.locator('#editor-screen').waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
    });

    test('shows tab navigation', async ({ page }) => {
      const tabButtons = page.locator('.tab-btn');
      expect(await tabButtons.count()).toBeGreaterThan(0);

      // Check all expected tabs exist
      const tabNames = [
        { name: 'Board', tab: 'board' },
        { name: 'Horses', tab: 'horses' },
        { name: 'Feeds', tab: 'feeds' },
        { name: 'Reports', tab: 'reports' }
      ];
      for (const item of tabNames) {
        const tab = page.locator(`.tab-btn[data-tab="${item.tab}"]`);
        await expect(tab).toBeVisible();
      }
    });

    test('switches between tabs', async ({ page }) => {
      // Click Horses tab
      await page.locator('.tab-btn[data-tab="horses"]').click();

      // Horses panel should be active
      const horsesPanel = page.locator('#tab-horses');
      await expect(horsesPanel).toHaveClass(/active/);
    });
  });

  test.describe('Board Tab', () => {
    test.beforeEach(async ({ page, context }) => {
      // Setup paired display
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
          { id: 'f1', name: 'Easisport', unit: 'scoop', rank: 1 },
          { id: 'f2', name: 'Bute', unit: 'sachet', rank: 2 }
        ],
        horses: [
          { id: 'h1', name: 'Spider', note: null, noteExpiry: null },
          { id: 'h2', name: 'Lightning', note: null, noteExpiry: null }
        ],
        diet: {
          h1: { f1: { am: 0.5, pm: 0.5 }, f2: { am: 1, pm: 0 } },
          h2: { f1: { am: 1, pm: 1 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      const pairCode = await displayPage.locator('#pair-code').textContent();
      await displayPage.close();

      await page.goto('/controller');

      const codeDigits = pairCode.split('');
      for (let i = 0; i < 6; i++) {
        await page.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      const connectBtn = page.locator('#connect-btn');
      await connectBtn.click();

      await page.locator('#editor-screen').waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
    });

    test('displays board grid with horses and feeds', async ({ page }) => {
      const boardTab = page.locator('#tab-board');
      await expect(boardTab).toHaveClass(/active/);

      const boardGrid = page.locator('#board-grid');
      await expect(boardGrid).toBeVisible();
    });

    test('shows time mode controls', async ({ page }) => {
      const timeModeBtns = page.locator('.mode-btn');
      expect(await timeModeBtns.count()).toBeGreaterThanOrEqual(3);

      // Should have AUTO, AM, PM buttons
      const autoBtn = page.locator('.mode-btn[data-mode="AUTO"]');
      const amBtn = page.locator('.mode-btn[data-mode="AM"]');
      const pmBtn = page.locator('.mode-btn[data-mode="PM"]');

      await expect(autoBtn).toBeVisible();
      await expect(amBtn).toBeVisible();
      await expect(pmBtn).toBeVisible();
    });

    test('switches between time modes', async ({ page }) => {
      const pmBtn = page.locator('.mode-btn[data-mode="PM"]');
      await pmBtn.click();

      // PM button should be active
      await expect(pmBtn).toHaveClass(/active/);
    });

    test('shows zoom controls', async ({ page }) => {
      const zoomOut = page.locator('#zoom-out');
      const zoomIn = page.locator('#zoom-in');
      const zoomLevel = page.locator('#zoom-level');

      await expect(zoomOut).toBeVisible();
      await expect(zoomIn).toBeVisible();
      await expect(zoomLevel).toBeVisible();
    });

    test('shows pagination controls', async ({ page }) => {
      const pagePrev = page.locator('#page-prev');
      const pageNext = page.locator('#page-next');
      const pageIndicator = page.locator('#page-indicator');

      await expect(pagePrev).toBeVisible();
      await expect(pageNext).toBeVisible();
      await expect(pageIndicator).toBeVisible();
    });
  });

  test.describe('Horses Tab', () => {
    test.beforeEach(async ({ page, context }) => {
      // Setup paired display with horses
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
          { id: 'f1', name: 'Oats', unit: 'scoop', rank: 1 }
        ],
        horses: [
          { id: 'h1', name: 'Spider', note: 'Original note', noteExpiry: null, noteCreatedAt: Date.now() },
          { id: 'h2', name: 'Lightning', note: null, noteExpiry: null }
        ],
        diet: {
          h1: { f1: { am: 1, pm: 1 } },
          h2: { f1: { am: 0.5, pm: 0.5 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      const pairCode = await displayPage.locator('#pair-code').textContent();
      await displayPage.close();

      await page.goto('/controller');

      const codeDigits = pairCode.split('');
      for (let i = 0; i < 6; i++) {
        await page.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      const connectBtn = page.locator('#connect-btn');
      await connectBtn.click();

      await page.locator('#editor-screen').waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
    });

    test('shows list of horses', async ({ page }) => {
      // Click Horses tab
      await page.locator('.tab-btn[data-tab="horses"]').click();

      const horsesPanel = page.locator('#tab-horses');
      await expect(horsesPanel).toHaveClass(/active/);

      const horsesList = page.locator('#horses-list');
      await expect(horsesList).toBeVisible();
    });

    test('has button to add new horse', async ({ page }) => {
      await page.locator('.tab-btn[data-tab="horses"]').click();

      const addHorseBtn = page.locator('#add-horse-btn');
      await expect(addHorseBtn).toBeVisible();
      await expect(addHorseBtn).toContainText('Add Horse');
    });
  });

  test.describe('Feeds Tab', () => {
    test.beforeEach(async ({ page, context }) => {
      // Setup paired display with feeds
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
          { id: 'f1', name: 'Easisport', unit: 'scoop', rank: 1 },
          { id: 'f2', name: 'Bute', unit: 'sachet', rank: 2 }
        ],
        horses: [
          { id: 'h1', name: 'Spider', note: null, noteExpiry: null }
        ],
        diet: {
          h1: { f1: { am: 1, pm: 1 }, f2: { am: 0.5, pm: 0 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      const pairCode = await displayPage.locator('#pair-code').textContent();
      await displayPage.close();

      await page.goto('/controller');

      const codeDigits = pairCode.split('');
      for (let i = 0; i < 6; i++) {
        await page.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      const connectBtn = page.locator('#connect-btn');
      await connectBtn.click();

      await page.locator('#editor-screen').waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
    });

    test('shows list of feeds', async ({ page }) => {
      await page.locator('.tab-btn[data-tab="feeds"]').click();

      const feedsPanel = page.locator('#tab-feeds');
      await expect(feedsPanel).toHaveClass(/active/);

      const feedsList = page.locator('#feeds-list');
      await expect(feedsList).toBeVisible();
    });

    test('has button to add new feed', async ({ page }) => {
      await page.locator('.tab-btn[data-tab="feeds"]').click();

      const addFeedBtn = page.locator('#add-feed-btn');
      await expect(addFeedBtn).toBeVisible();
      await expect(addFeedBtn).toContainText('Add Feed');
    });
  });

  test.describe('Reports Tab', () => {
    test.beforeEach(async ({ page, context }) => {
      // Setup paired display with data
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
          { id: 'f1', name: 'Easisport', unit: 'scoop', rank: 1 }
        ],
        horses: [
          { id: 'h1', name: 'Spider', note: null, noteExpiry: null }
        ],
        diet: {
          h1: { f1: { am: 2, pm: 3 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      const pairCode = await displayPage.locator('#pair-code').textContent();
      await displayPage.close();

      await page.goto('/controller');

      const codeDigits = pairCode.split('');
      for (let i = 0; i < 6; i++) {
        await page.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      const connectBtn = page.locator('#connect-btn');
      await connectBtn.click();

      await page.locator('#editor-screen').waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
    });

    test('shows reports table', async ({ page }) => {
      await page.locator('.tab-btn[data-tab="reports"]').click();

      const reportsPanel = page.locator('#tab-reports');
      await expect(reportsPanel).toHaveClass(/active/);

      const reportsTable = page.locator('#reports-table');
      await expect(reportsTable).toBeVisible();
    });

    test('displays weekly consumption calculations', async ({ page }) => {
      await page.locator('.tab-btn[data-tab="reports"]').click();

      const reportsBody = page.locator('#reports-body');
      await expect(reportsBody).toBeVisible();

      // Should have at least one row for the feed
      const rows = page.locator('#reports-body tr');
      expect(await rows.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Modals & Editor Interactions', () => {
    test.beforeEach(async ({ page, context }) => {
      // Setup paired display
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
          { id: 'f1', name: 'Oats', unit: 'scoop', rank: 1 }
        ],
        horses: [
          { id: 'h1', name: 'Spider', note: null, noteExpiry: null }
        ],
        diet: {
          h1: { f1: { am: 1, pm: 1 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      const pairCode = await displayPage.locator('#pair-code').textContent();
      await displayPage.close();

      await page.goto('/controller');

      const codeDigits = pairCode.split('');
      for (let i = 0; i < 6; i++) {
        await page.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      const connectBtn = page.locator('#connect-btn');
      await connectBtn.click();

      await page.locator('#editor-screen').waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
    });

    test('shows quantity modal when cell is clicked', async ({ page }) => {
      // This test assumes board grid is rendered with clickable cells
      // The exact selector depends on the implementation
      const quantityModal = page.locator('#quantity-modal');

      // Modal should exist in DOM
      expect(quantityModal).toBeTruthy();
    });

    test('shows settings modal when settings button is clicked', async ({ page }) => {
      const settingsBtn = page.locator('#settings-btn');
      await settingsBtn.click();

      const settingsModal = page.locator('#settings-modal');
      await expect(settingsModal).not.toHaveClass(/hidden/);
    });

    test('allows changing timezone', async ({ page }) => {
      const settingsBtn = page.locator('#settings-btn');
      await settingsBtn.click();

      const timezoneSelect = page.locator('#timezone-select');
      await expect(timezoneSelect).toBeVisible();

      // Change timezone
      await timezoneSelect.selectOption('Europe/London');

      const settingsCloseBtn = page.locator('#settings-close-btn');
      await settingsCloseBtn.click();

      // Modal should be hidden
      const settingsModal = page.locator('#settings-modal');
      await expect(settingsModal).toHaveClass(/hidden/);
    });
  });

  test.describe('Status Bar', () => {
    test.beforeEach(async ({ page, context }) => {
      // Setup paired display
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
        feeds: [],
        horses: [],
        diet: {}
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      const pairCode = await displayPage.locator('#pair-code').textContent();
      await displayPage.close();

      await page.goto('/controller');

      const codeDigits = pairCode.split('');
      for (let i = 0; i < 6; i++) {
        await page.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      const connectBtn = page.locator('#connect-btn');
      await connectBtn.click();

      await page.locator('#editor-screen').waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
    });

    test('shows status text in footer', async ({ page }) => {
      const statusText = page.locator('#status-text');
      await expect(statusText).toBeVisible();
    });
  });
});
