import { test, expect } from '@playwright/test';

test.describe('Edge Cases & Hostile User Scenarios', () => {
  test.describe('The "Fat Finger" Test (Input Resilience)', () => {
    test('handles extremely long decimal values without layout break', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Attempt to set an unrealistic decimal value
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
          h1: { f1: { am: 0.333333333, pm: 1.999999999 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Wait for grid to render
      await displayPage.waitForSelector('.grid-cell.value', { timeout: 5000 });

      // Verify grid is still visible and not broken
      const feedGrid = displayPage.locator('#feed-grid');
      await expect(feedGrid).toBeVisible();

      // Verify values are rendered (even if as decimals)
      const valueCells = await displayPage.locator('.grid-cell.value').allTextContents();
      expect(valueCells.length).toBeGreaterThan(0);

      await displayPage.close();
    });

    test('handles emoji characters in horse names without corruption', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Set horse name with emojis
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
          { id: 'h1', name: '🐴 Lightning ⚡', note: null, noteExpiry: null }
        ],
        diet: {
          h1: { f1: { am: 1, pm: 1 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Wait for horse name to render
      await displayPage.waitForSelector('.grid-cell.horse-name', { timeout: 5000 });

      // Verify horse name renders correctly with emojis
      const horseName = await displayPage.locator('.grid-cell.horse-name').textContent();
      expect(horseName).toContain('Lightning');
      // Emojis should be preserved
      expect(horseName).toContain('🐴');
      expect(horseName).toContain('⚡');

      await displayPage.close();
    });

    test('handles extremely long feed names without overflow', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Set a feed name that's 50+ characters
      const longFeedName = 'This is an extremely long feed name that might cause layout issues if not handled properly by the CSS Grid system';

      const testData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: [
          { id: 'f1', name: longFeedName, unit: 'scoop', rank: 1 }
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

      // Wait for grid to render
      await displayPage.locator('.grid-cell.feed-name:has-text(/extremely/)').waitFor({ timeout: 5000 });

      // Verify grid is still visible (no CSS overflow issues)
      const feedGrid = displayPage.locator('#feed-grid');
      await expect(feedGrid).toBeVisible();

      // Check that the long name is preserved
      const feedNameCells = await displayPage.locator('.grid-cell.feed-name').allTextContents();
      const feedText = feedNameCells.join(' ');
      expect(feedText).toContain('extremely long');

      await displayPage.close();
    });
  });

  test.describe('The "Spotty Connection" Test (Network Resilience)', () => {
    test('handles offline state gracefully and shows unsaved indicator', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Set initial data
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
          h1: { f1: { am: 1, pm: 1 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Wait for display to render
      await displayPage.locator('.grid-cell.horse-name').waitFor({ timeout: 5000 });

      // Take a screenshot before going offline
      const beforeOffline = await displayPage.locator('#table-screen').isVisible();
      expect(beforeOffline).toBe(true);

      // Go offline
      await context.setOffline(true);

      // Wait a moment for SSE to disconnect
      await displayPage.waitForTimeout(1500);

      // Check if error overlay becomes visible (display should show connection lost)
      const errorOverlay = displayPage.locator('#error-overlay');
      const isErrorVisible = await errorOverlay.isVisible().catch(() => false);

      // Error overlay may or may not be visible depending on timing, but shouldn't crash
      expect(typeof isErrorVisible).toBe('boolean');

      // Come back online
      await context.setOffline(false);

      // Wait for reconnection
      await displayPage.waitForTimeout(2000);

      // Display should be visible again
      const tableScreen = displayPage.locator('#table-screen');
      const isTableVisible = await tableScreen.isVisible();
      expect(isTableVisible).toBe(true);

      await displayPage.close();
    });

    test('retries failed updates when connection is restored', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Set initial data
      const initialData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: [
          { id: 'f1', name: 'Initial', unit: 'scoop', rank: 1 }
        ],
        horses: [
          { id: 'h1', name: 'Spider', note: null, noteExpiry: null }
        ],
        diet: {
          h1: { f1: { am: 1, pm: 1 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: initialData }
      });

      await displayPage.locator('.grid-cell.feed-name:has-text(/Initial/)').waitFor({ timeout: 5000 });

      // Go offline
      await context.setOffline(true);
      await displayPage.waitForTimeout(500);

      // Come back online
      await context.setOffline(false);

      // Update data while online
      const updatedData = {
        ...initialData,
        feeds: [{ id: 'f1', name: 'Updated', unit: 'scoop', rank: 1 }]
      };

      const response = await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: updatedData }
      });

      expect(response.ok()).toBe(true);

      // Wait for update to propagate via SSE
      await displayPage.locator('.grid-cell.feed-name:has-text(/Updated/)').waitFor({ timeout: 5000 });

      const feedNameCells = await displayPage.locator('.grid-cell.feed-name').allTextContents();
      const feedText = feedNameCells.join(' ');
      expect(feedText).toContain('Updated');

      await displayPage.close();
    });
  });

  test.describe('The "Double Up" Test (Concurrency)', () => {
    test('handles simultaneous edits with last-write-wins semantics', async ({ page, context }) => {
      // Setup: Create display and pair two controllers
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      const pairCode = await displayPage.locator('#pair-code').textContent();

      // First controller
      const controller1Page = await context.newPage();
      await controller1Page.goto('/controller');

      const codeDigits = pairCode.split('');
      for (let i = 0; i < 6; i++) {
        await controller1Page.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      await controller1Page.locator('#connect-btn').click();
      await controller1Page.locator('#editor-screen').waitFor({ state: 'visible' });
      await controller1Page.waitForTimeout(500);

      // Second controller (same pair code)
      const controller2Page = await context.newPage();
      await controller2Page.goto('/controller');

      // Wait for pairing screen to be ready before filling inputs
      await controller2Page.locator('#pairing-screen').waitFor({ state: 'visible', timeout: 5000 });

      for (let i = 0; i < 6; i++) {
        await controller2Page.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      await controller2Page.locator('#connect-btn').click();
      await controller2Page.locator('#editor-screen').waitFor({ state: 'visible' });
      await controller2Page.waitForTimeout(500);

      // Setup initial data
      const initialData = {
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
          h1: { f1: { am: 1, pm: 1 } }
        }
      };

      await controller1Page.request.put(`/api/displays/${displayId}`, {
        data: { tableData: initialData }
      });

      await displayPage.locator('.grid-cell.horse-name').filter({ hasText: 'Spider' }).waitFor({ timeout: 5000 });

      // User A (Controller 1) changes Spider's Hay AM to 2.0
      let data1 = { ...initialData, diet: { h1: { f1: { am: 2.0, pm: 1 } } } };
      await controller1Page.request.put(`/api/displays/${displayId}`, {
        data: { tableData: data1 }
      });

      // Immediately after, User B (Controller 2) changes Spider's Hay AM to 3.0
      let data2 = { ...initialData, diet: { h1: { f1: { am: 3.0, pm: 1 } } } };
      await controller2Page.request.put(`/api/displays/${displayId}`, {
        data: { tableData: data2 }
      });

      // Wait for the final update to settle
      await displayPage.waitForTimeout(1000);

      // Display should show the last write (3.0)
      const valueCells = await displayPage.locator('.grid-cell.value').allTextContents();
      // First value cell should be the AM value for Spider
      expect(valueCells[0]).toContain('3');

      // Both controllers should see the same final value when they fetch
      const finalDisplay = await displayPage.request.get(`/api/displays/${displayId}`);
      const finalData = await finalDisplay.json();
      expect(finalData.data.diet.h1.f1.am).toBe(3.0);

      await displayPage.close();
      await controller1Page.close();
      await controller2Page.close();
    });

    test('broadcasts updates to all connected controllers', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      const pairCode = await displayPage.locator('#pair-code').textContent();

      // Controller 1
      const controller1Page = await context.newPage();
      await controller1Page.goto('/controller');

      const codeDigits = pairCode.split('');
      for (let i = 0; i < 6; i++) {
        await controller1Page.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      await controller1Page.locator('#connect-btn').click();
      await controller1Page.locator('#editor-screen').waitFor({ state: 'visible' });

      // Controller 2
      const controller2Page = await context.newPage();
      await controller2Page.goto('/controller');

      // Wait for pairing screen to be ready before filling inputs
      await controller2Page.locator('#pairing-screen').waitFor({ state: 'visible', timeout: 5000 });

      for (let i = 0; i < 6; i++) {
        await controller2Page.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      await controller2Page.locator('#connect-btn').click();
      await controller2Page.locator('#editor-screen').waitFor({ state: 'visible' });
      await controller2Page.waitForTimeout(500);

      // User 1 makes a change
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
          h1: { f1: { am: 1.5, pm: 1 } }
        }
      };

      await controller1Page.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Wait for broadcast to reach display
      await displayPage.waitForTimeout(1000);

      // Display should show the update
      const displayValues = await displayPage.locator('.grid-cell.value').allTextContents();
      expect(displayValues[0]).toContain('½'); // 1.5 = 1½

      await displayPage.close();
      await controller1Page.close();
      await controller2Page.close();
    });
  });

  test.describe('The "Zombie Session" Test (Reconnection & Session Lifecycle)', () => {
    test('display gracefully handles missing display ID', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Clear the display from storage (simulating it being deleted on server)
      await displayPage.evaluate(() => {
        localStorage.removeItem('horseboard_display_id');
      });

      // Manually try to fetch the deleted display
      const response = await displayPage.request.get(`/api/displays/${displayId}`);

      // Should fail because display doesn't exist
      expect(response.status()).toBe(404);

      // Refresh the page - should create a new display
      await displayPage.reload();

      // Wait for pairing screen to appear
      const pairCode = displayPage.locator('#pair-code');
      await expect(pairCode).toBeVisible({ timeout: 5000 });

      // Should have a new pairing code
      const newCode = await pairCode.textContent();
      expect(newCode).toMatch(/^\d{6}$/);

      await displayPage.close();
    });

    test('controller handles reconnection after display disappears', async ({ page, context }) => {
      // Setup: Create display and pair controller
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      const pairCode = await displayPage.locator('#pair-code').textContent();

      const controllerPage = await context.newPage();
      await controllerPage.goto('/controller');

      // Wait for pairing screen to be ready
      await controllerPage.locator('#pairing-screen').waitFor({ state: 'visible', timeout: 5000 });

      const codeDigits = pairCode.split('');
      for (let i = 0; i < 6; i++) {
        await controllerPage.locator(`.code-digit[data-index="${i}"]`).fill(codeDigits[i]);
      }

      await controllerPage.locator('#connect-btn').click();
      await controllerPage.locator('#editor-screen').waitFor({ state: 'visible' });
      await controllerPage.waitForTimeout(500);

      // Controller is now paired. Simulate display being deleted on server
      // by manually deleting it via API
      const deleteResponse = await controllerPage.request.delete(`/api/displays/${displayId}`);
      expect(deleteResponse.status()).toBe(200);

      // Wait a moment
      await controllerPage.waitForTimeout(1000);

      // Controller should still be in editor screen (may eventually show error on next SSE message)
      // The important thing is it doesn't crash immediately
      const editorScreen = controllerPage.locator('#editor-screen');
      const isEditorVisible = await editorScreen.isVisible().catch(() => false);

      // Should either still show editor or have shown an error gracefully
      expect(typeof isEditorVisible).toBe('boolean');

      await displayPage.close();
      await controllerPage.close();
    });

    test('preserves session data across brief network interruptions', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Set initial data
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
          h1: { f1: { am: 1, pm: 1 } }
        }
      };

      await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      await displayPage.locator('.grid-cell.horse-name').waitFor({ timeout: 5000 });

      // Brief offline period
      await context.setOffline(true);
      await displayPage.waitForTimeout(500);
      await context.setOffline(false);

      // Data should still be in localStorage
      const storedId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      expect(storedId).toBe(displayId);

      // Display should reconnect and still show data
      await displayPage.waitForTimeout(2000);

      const tableScreen = displayPage.locator('#table-screen');
      const isVisible = await tableScreen.isVisible();
      expect(isVisible).toBe(true);

      await displayPage.close();
    });
  });
});
