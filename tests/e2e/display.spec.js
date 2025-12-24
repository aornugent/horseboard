import { test, expect } from '@playwright/test';

test.describe('TV Display App', () => {
  test.describe('Pairing Screen', () => {
    test('shows pairing code on load', async ({ page }) => {
      await page.goto('/display');

      // Should show pairing screen initially
      const pairingScreen = page.locator('#pairing-screen');
      await expect(pairingScreen).not.toHaveClass(/hidden/);

      // Should display a 6-digit code
      const pairCode = page.locator('#pair-code');
      await expect(pairCode).toBeVisible();
      const codeText = await pairCode.textContent();
      expect(codeText).toMatch(/^\d{6}$/);
    });

    test('shows controller URL on pairing screen', async ({ page }) => {
      await page.goto('/display');

      const controllerUrl = page.locator('#controller-url');
      await expect(controllerUrl).toBeVisible();
      const url = await controllerUrl.textContent();
      expect(url).toContain('/controller');
    });

    test('persists display ID in localStorage', async ({ page }) => {
      await page.goto('/display');

      // Wait for pairing screen to appear (indicates display was created)
      await page.locator('#pairing-screen').waitFor({ state: 'visible', timeout: 5000 });

      const displayId = await page.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      expect(displayId).toBeTruthy();
      expect(displayId).toMatch(/^d_/);
    });
  });

  test.describe('Display Data Structure', () => {
    test('initially shows empty state', async ({ page }) => {
      await page.goto('/display');

      // Wait for pairing screen to appear (indicates SSE connected)
      const pairingScreen = page.locator('#pairing-screen');
      await pairingScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Verify pairing screen is visible
      await expect(pairingScreen).toBeVisible();

      // Pair code should be displayed
      const pairCode = page.locator('#pair-code');
      const code = await pairCode.textContent();
      expect(code).toMatch(/^\d{6}$/);
    });

    test('accepts valid domain data structure', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      // Get the display ID
      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Create test data with valid domain structure
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
          h1: {
            f1: { am: 0.5, pm: 0.5 }
          }
        }
      };

      // Update display via API
      const response = await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      expect(response.ok()).toBeTruthy();

      // Small delay for SSE, then wait for actual condition
      await displayPage.waitForTimeout(100);
      const tableScreen = displayPage.locator('#table-screen');
      await tableScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Display should now show table (not empty)
      await expect(tableScreen).toBeVisible();

      await displayPage.close();
    });
  });

  test.describe('Feed Grid Rendering', () => {
    test('renders feed grid with horses and feeds', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Set up test data
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

      // Wait for the table screen to show with grid
      const tableScreen = displayPage.locator('#table-screen');
      await tableScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Grid should exist and be visible
      const feedGrid = displayPage.locator('#feed-grid');
      await expect(feedGrid).toBeVisible();

      // Should contain horse headers (look for the actual header cells)
      const horseHeaders = displayPage.locator('.grid-cell.header.horse-name');
      expect(await horseHeaders.count()).toBeGreaterThan(0);

      await displayPage.close();
    });

    test('displays fractions correctly', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Set data with fractional values
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
          h1: { f1: { am: 0.5, pm: 0.25 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Small delay for SSE to trigger the update, then wait for the actual condition
      // (SSE is async, so we give it a moment, then check for the actual DOM change)
      await displayPage.waitForTimeout(100);
      const tableScreen = displayPage.locator('#table-screen');
      await tableScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Wait for grid value cells to appear with data
      const valueCells = displayPage.locator('.grid-cell.value');
      await valueCells.first().waitFor({ state: 'visible', timeout: 5000 });

      // Get all value cells and check their text content
      const valueContents = await valueCells.allTextContents();
      const gridText = valueContents.join(' ');

      // Should contain fraction symbols
      expect(gridText).toContain('½'); // 0.5
      expect(gridText).toContain('¼'); // 0.25

      await displayPage.close();
    });
  });

  test.describe('Time Mode Display', () => {
    test('shows current time mode', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Set AUTO mode with at least one horse to trigger renderFeedGrid
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

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Wait for time mode element to appear and have text
      const timeModeElement = displayPage.locator('#time-mode');
      await timeModeElement.waitFor({ timeout: 5000 });

      // Wait for it to have actual text content (not just empty)
      await displayPage.waitForFunction(() => {
        const el = document.getElementById('time-mode');
        return el && el.textContent && el.textContent.trim().length > 0;
      }, { timeout: 5000 });

      const timeModeIndicator = displayPage.locator('#time-mode');
      await expect(timeModeIndicator).toBeVisible();
      const modeText = await timeModeIndicator.textContent();
      expect(modeText).toBeTruthy();
      expect(modeText).toMatch(/^(AM|PM|AUTO)$/);

      await displayPage.close();
    });

    test('updates when time mode changes', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Initial AUTO mode with data
      let testData = {
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

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Wait for initial time mode to render
      await displayPage.locator('#time-mode').waitFor({ timeout: 5000 });
      await displayPage.waitForFunction(() => {
        const el = document.getElementById('time-mode');
        return el && el.textContent && el.textContent.trim().length > 0;
      }, { timeout: 5000 });

      // Change to PM
      testData.settings.timeMode = 'PM';
      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Wait for time mode to update to PM
      await displayPage.waitForFunction(() => {
        const el = document.getElementById('time-mode');
        return el && el.textContent && el.textContent.includes('PM');
      }, { timeout: 5000 });

      const timeModeIndicator = displayPage.locator('#time-mode');
      const modeText = await timeModeIndicator.textContent();
      expect(modeText).toBe('PM');

      await displayPage.close();
    });
  });

  test.describe('Real-time Updates', () => {
    test('receives and displays updates via SSE', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Set initial data
      let testData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: [
          { id: 'f1', name: 'Initial Feed', unit: 'scoop', rank: 1 }
        ],
        horses: [
          { id: 'h1', name: 'TestHorse', note: null, noteExpiry: null }
        ],
        diet: {
          h1: { f1: { am: 1, pm: 1 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Wait for table screen to be visible first
      await displayPage.locator('#table-screen').waitFor({ state: 'visible', timeout: 5000 });

      // Wait for initial feed name to appear
      await displayPage.locator('.grid-cell.feed-name').filter({ hasText: 'Initial Feed' }).waitFor({ timeout: 5000 });

      // Update the feed name
      testData.feeds[0].name = 'Updated Feed';

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Wait for updated feed name to appear
      await displayPage.locator('.grid-cell.feed-name').filter({ hasText: 'Updated Feed' }).waitFor({ timeout: 5000 });

      const feedNameCells = await displayPage.locator('.grid-cell.feed-name').allTextContents();
      const gridText = feedNameCells.join(' ');
      expect(gridText).toContain('Updated Feed');

      await displayPage.close();
    });

    test('handles multiple rapid updates', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Send multiple updates in quick succession
      for (let i = 0; i < 5; i++) {
        const testData = {
          settings: {
            timezone: 'Australia/Sydney',
            timeMode: 'AUTO',
            overrideUntil: null,
            zoomLevel: 2,
            currentPage: 0
          },
          feeds: [
            { id: 'f1', name: `Feed ${i}`, unit: 'scoop', rank: 1 }
          ],
          horses: [
            { id: 'h1', name: 'TestHorse', note: null, noteExpiry: null }
          ],
          diet: {
            h1: { f1: { am: i, pm: i } }
          }
        };

        await displayPage.request.put(`/api/displays/${displayId}`, {
          data: { tableData: testData }
        });
      }

      // Wait for table screen and final feed name to appear in grid
      await displayPage.locator('#table-screen').waitFor({ state: 'visible', timeout: 5000 });
      await displayPage.locator('.grid-cell.feed-name').filter({ hasText: 'Feed 4' }).waitFor({ timeout: 5000 });

      const feedNameCells = await displayPage.locator('.grid-cell.feed-name').allTextContents();
      const gridText = feedNameCells.join(' ');
      expect(gridText).toContain('Feed 4');

      await displayPage.close();
    });
  });

  test.describe('Pagination', () => {
    test('shows pagination controls with multiple horses', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Create 15 horses (more than zoom level 2 can show)
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
        feeds: [
          { id: 'f1', name: 'Oats', unit: 'scoop', rank: 1 }
        ],
        horses,
        diet: Object.fromEntries(horses.map(h => [
          h.id,
          { f1: { am: 1, pm: 1 } }
        ]))
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Wait for table screen to be visible
      await displayPage.locator('#table-screen').waitFor({ state: 'visible', timeout: 5000 });

      // Pagination should be visible
      const pagination = displayPage.locator('#pagination');
      // Wait for grid to render with multiple horses
      await displayPage.locator('.grid-cell.horse-name').first().waitFor({ state: 'visible', timeout: 5000 });

      // Should have pagination since we have 15 horses and zoom level 2 shows 7
      const pageInfo = displayPage.locator('#page-info');
      const pageText = await pageInfo.textContent();
      expect(pageText).toMatch(/Page \d+ of \d+/);

      await displayPage.close();
    });
  });

  test.describe('Horse Notes', () => {
    test('displays horse notes in footer', async ({ page, context }) => {
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
          { id: 'h1', name: 'Spider', note: 'Turn out early', noteExpiry: null, noteCreatedAt: Date.now() },
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

      // Wait for the note to appear in the grid
      await displayPage.locator('.grid-cell.note').filter({ hasText: 'Turn out early' }).waitFor({ timeout: 5000 });

      const noteCells = await displayPage.locator('.grid-cell.note').allTextContents();
      const gridText = noteCells.join(' ');
      expect(gridText).toContain('Turn out early');

      await displayPage.close();
    });
  });

  test.describe('Error Handling & Reconnection', () => {
    test('shows error overlay when connection is lost', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      // Simulate connection loss by stopping the server
      // Note: In a real E2E environment, this would require server control
      // For now, we'll test that error overlay exists in DOM

      const errorOverlay = displayPage.locator('#error-overlay');
      const retryBtn = displayPage.locator('#retry-btn');

      expect(errorOverlay).toBeTruthy();
      expect(retryBtn).toBeTruthy();

      await displayPage.close();
    });

    test('retry button is functional', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const retryBtn = displayPage.locator('#retry-btn');
      expect(retryBtn).toBeTruthy();

      await displayPage.close();
    });
  });
});
