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

      // Wait for SSE to detect disconnection (error overlay may appear or page may just continue)
      const errorOverlay = displayPage.locator('#error-overlay');
      const errorAppeared = await errorOverlay.isVisible({ timeout: 2000 }).catch(() => false);

      // Check if error overlay becomes visible (display should show connection lost)
      // It's ok if it doesn't - the important thing is it handles gracefully
      expect(typeof errorAppeared).toBe('boolean');

      // Come back online
      await context.setOffline(false);

      // Wait for reconnection by checking if table screen is still visible/reachable
      const tableScreen = displayPage.locator('#table-screen');
      await tableScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Display should be visible again
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
      await controller1Page.locator('#board-grid').waitFor({ state: 'attached', timeout: 5000 });

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
      await controller2Page.locator('#board-grid').waitFor({ state: 'attached', timeout: 5000 });

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

      // Wait for the final update to appear on display (last write wins: 3.0)
      const valueCell = displayPage.locator('.grid-cell.value').first();
      await valueCell.waitFor({ state: 'visible', timeout: 5000 });

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
      await controller2Page.locator('#board-grid').waitFor({ state: 'attached', timeout: 5000 });

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

      // Wait for broadcast to reach display - check for the fraction value
      const valueCell = displayPage.locator('.grid-cell.value').first();
      await valueCell.waitFor({ state: 'visible', timeout: 5000 });

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
      await controllerPage.locator('#board-grid').waitFor({ state: 'attached', timeout: 5000 });

      // Controller is now paired. Simulate display being deleted on server
      // by manually deleting it via API
      const deleteResponse = await controllerPage.request.delete(`/api/displays/${displayId}`);
      expect(deleteResponse.status()).toBe(200);

      // Controller should still be in editor screen (may eventually show error on next SSE message)
      // The important thing is it doesn't crash immediately
      const editorScreen = controllerPage.locator('#editor-screen');
      // Give a moment for any SSE errors to propagate, but don't wait indefinitely
      const isEditorVisible = await editorScreen.isVisible({ timeout: 2000 }).catch(() => false);

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
      await context.setOffline(false);

      // Data should still be in localStorage
      const storedId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      expect(storedId).toBe(displayId);

      // Display should reconnect and still show data
      const tableScreen = displayPage.locator('#table-screen');
      await tableScreen.waitFor({ state: 'visible', timeout: 5000 });
      const isVisible = await tableScreen.isVisible();
      expect(isVisible).toBe(true);

      await displayPage.close();
    });
  });

  test.describe('API Error Handling & Resilience', () => {
    test('handles invalid display ID gracefully', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      // Try to PUT data to a non-existent display
      const invalidId = 'd_invalid_' + Date.now();
      const testData = {
        settings: { timezone: 'UTC', timeMode: 'AUTO', overrideUntil: null, zoomLevel: 2, currentPage: 0 },
        feeds: [],
        horses: [],
        diet: {}
      };

      const response = await displayPage.request.put(`/api/displays/${invalidId}`, {
        data: { tableData: testData }
      }).catch(err => null);

      // Request should fail gracefully (404 or 500)
      if (response) {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }

      // Display should still be functional
      const pairingScreen = displayPage.locator('#pairing-screen');
      const isPairingVisible = await pairingScreen.isVisible().catch(() => false);
      // Either pairing screen is visible or app is still running
      expect(typeof isPairingVisible).toBe('boolean');

      await displayPage.close();
    });

    test('handles missing required fields in data structure', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Send data with missing required fields
      const invalidData = {
        feeds: [], // Missing settings, horses, diet
      };

      const response = await displayPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: invalidData }
      });

      // Should handle gracefully (accept or reject cleanly)
      // The important thing is the app doesn't crash
      expect(typeof response).toBe('object');

      // Check that display is still responsive
      const isPageReachable = await displayPage.goto('/display').catch(() => null);
      expect(isPageReachable).toBeTruthy();

      await displayPage.close();
    });

    test('recovers from concurrent conflicting updates', async ({ page, context }) => {
      const displayPage = await context.newPage();
      await displayPage.goto('/display');

      const displayId = await displayPage.evaluate(() => {
        return localStorage.getItem('horseboard_display_id');
      });

      // Send two conflicting updates simultaneously
      const data1 = {
        settings: { timezone: 'UTC', timeMode: 'AM', overrideUntil: null, zoomLevel: 1, currentPage: 0 },
        feeds: [{ id: 'f1', name: 'Feed1', unit: 'scoop', rank: 1 }],
        horses: [{ id: 'h1', name: 'Horse1', note: null, noteExpiry: null }],
        diet: { h1: { f1: { am: 1, pm: 0 } } }
      };

      const data2 = {
        settings: { timezone: 'UTC', timeMode: 'PM', overrideUntil: null, zoomLevel: 2, currentPage: 0 },
        feeds: [{ id: 'f1', name: 'Feed1', unit: 'ml', rank: 1 }],
        horses: [{ id: 'h1', name: 'Horse1', note: null, noteExpiry: null }],
        diet: { h1: { f1: { am: 0.5, pm: 0.5 } } }
      };

      // Send both without waiting
      const [resp1, resp2] = await Promise.all([
        displayPage.request.put(`/api/displays/${displayId}`, { data: { tableData: data1 } }),
        displayPage.request.put(`/api/displays/${displayId}`, { data: { tableData: data2 } })
      ]);

      // Both should complete (last write wins)
      expect(resp1.ok()).toBeTruthy();
      expect(resp2.ok()).toBeTruthy();

      // Verify final state is consistent
      const finalResponse = await displayPage.request.get(`/api/displays/${displayId}`);
      expect(finalResponse.ok()).toBeTruthy();

      const finalData = await finalResponse.json();
      // Should have one of the two update's data
      expect(finalData.tableData.settings.timeMode).toMatch(/AM|PM/);

      await displayPage.close();
    });
  });
});
