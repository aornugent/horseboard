import { test, expect } from './fixtures.js';

test.describe('Fresh Database - No Feeds State', () => {
  test.describe('Horse Modal Controls', () => {
    test('shows helpful message when no feeds exist', async ({ pairedController }) => {
      const { controllerPage } = pairedController;

      // Switch to horses tab
      await controllerPage.locator('.tab-btn[data-tab="horses"]').click();
      await controllerPage.locator('#tab-horses').waitFor({ state: 'visible' });

      // Click add horse button
      await controllerPage.locator('#add-horse-btn').click();
      await controllerPage.locator('#horse-modal').waitFor({ state: 'visible' });

      // Verify active feeds section shows "No feeds in system"
      const activeFeedsMessage = controllerPage.locator('#horse-active-feeds .reports-empty');
      await expect(activeFeedsMessage).toBeVisible();
      await expect(activeFeedsMessage).toContainText('No feeds in system');

      // Verify inactive feeds section shows "Add feeds in the Feeds tab first"
      const inactiveFeedsMessage = controllerPage.locator('#horse-inactive-feeds .reports-empty');
      await expect(inactiveFeedsMessage).toBeVisible();
      await expect(inactiveFeedsMessage).toContainText('Add feeds in the Feeds tab first');
    });

    test('hides clone diet dropdown when no feeds exist', async ({ pairedController }) => {
      const { controllerPage } = pairedController;

      // Switch to horses tab
      await controllerPage.locator('.tab-btn[data-tab="horses"]').click();

      // Click add horse button
      await controllerPage.locator('#add-horse-btn').click();
      await controllerPage.locator('#horse-modal').waitFor({ state: 'visible' });

      // Verify clone diet row is hidden
      const cloneRow = controllerPage.locator('.horse-clone-row');
      await expect(cloneRow).toHaveClass(/hidden/);
    });

    test('clone diet dropdown only shows horses with diet data', async ({ pairedController }) => {
      const { controllerPage, displayId } = pairedController;

      // Setup: Create data with one horse that has diet, one without
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
          { id: 'h1', name: 'Thunder', note: null, noteExpiry: null },
          { id: 'h2', name: 'Lightning', note: null, noteExpiry: null }
        ],
        diet: {
          h1: { f1: { am: 1, pm: 0.5 } }
          // h2 has no diet
        }
      };

      await controllerPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Reload controller to get updated data
      await controllerPage.reload();
      await controllerPage.locator('#editor-screen').waitFor({ state: 'visible' });

      // Switch to horses tab and add new horse
      await controllerPage.locator('.tab-btn[data-tab="horses"]').click();
      await controllerPage.locator('#add-horse-btn').click();
      await controllerPage.locator('#horse-modal').waitFor({ state: 'visible' });

      // Verify clone row is visible (since we have feeds and a horse with diet)
      const cloneRow = controllerPage.locator('.horse-clone-row');
      await expect(cloneRow).not.toHaveClass(/hidden/);

      // Check that only Thunder (which has diet) is in the dropdown
      const cloneSelect = controllerPage.locator('#clone-diet-select');
      const options = await cloneSelect.locator('option').allTextContents();

      expect(options).toContain('Thunder');
      expect(options).not.toContain('Lightning');
    });
  });

  test.describe('Board Tab Empty State', () => {
    test('shows empty message when no horses exist', async ({ pairedController }) => {
      const { controllerPage } = pairedController;

      // Verify board tab shows empty message
      const boardGrid = controllerPage.locator('#board-grid');
      await expect(boardGrid).toContainText('No horses yet');
    });

    test('shows empty message when no feeds have values', async ({ pairedController }) => {
      const { controllerPage, displayId } = pairedController;

      // Setup: Create data with horses but no feed values
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
          { id: 'h1', name: 'Thunder', note: null, noteExpiry: null }
        ],
        diet: {}  // No diet values
      };

      await controllerPage.request.put(`/api/displays/${displayId}`, {
        data: { tableData: testData }
      });

      // Reload to get updated data
      await controllerPage.reload();
      await controllerPage.locator('#editor-screen').waitFor({ state: 'visible' });

      const boardGrid = controllerPage.locator('#board-grid');
      await expect(boardGrid).toContainText('No feeds with values');
    });
  });

  test.describe('Reports Tab Empty State', () => {
    test('shows empty message when no feeds exist', async ({ pairedController }) => {
      const { controllerPage } = pairedController;

      // Switch to reports tab
      await controllerPage.locator('.tab-btn[data-tab="reports"]').click();
      await controllerPage.locator('#tab-reports').waitFor({ state: 'visible' });

      // Verify reports shows empty message
      const reportsBody = controllerPage.locator('#reports-body');
      await expect(reportsBody).toContainText('No feeds to report on');
    });
  });
});

test.describe('Adding Diet to New Horses', () => {
  test('can add feeds when creating a new horse', async ({ pairedController }) => {
    const { controllerPage, displayId } = pairedController;

    // Setup: Create data with feeds but no horses
    const testData = {
      settings: {
        timezone: 'Australia/Sydney',
        timeMode: 'AUTO',
        overrideUntil: null,
        zoomLevel: 2,
        currentPage: 0
      },
      feeds: [
        { id: 'f1', name: 'Oats', unit: 'scoop', rank: 1 },
        { id: 'f2', name: 'Bute', unit: 'sachet', rank: 2 }
      ],
      horses: [],
      diet: {}
    };

    await controllerPage.request.put(`/api/displays/${displayId}`, {
      data: { tableData: testData }
    });

    // Reload controller
    await controllerPage.reload();
    await controllerPage.locator('#editor-screen').waitFor({ state: 'visible' });

    // Switch to horses tab
    await controllerPage.locator('.tab-btn[data-tab="horses"]').click();

    // Click add horse button
    await controllerPage.locator('#add-horse-btn').click();
    await controllerPage.locator('#horse-modal').waitFor({ state: 'visible' });

    // Verify we see inactive feeds
    const inactiveFeeds = controllerPage.locator('#horse-inactive-feeds');
    await expect(inactiveFeeds.locator('.horse-feed-row')).toHaveCount(2);

    // Click on "Oats" to add it
    await inactiveFeeds.locator('.horse-feed-row', { hasText: 'Oats' }).click();

    // Verify Oats moved to active feeds
    const activeFeeds = controllerPage.locator('#horse-active-feeds');
    await expect(activeFeeds.locator('.horse-feed-row')).toHaveCount(1);
    await expect(activeFeeds).toContainText('Oats');

    // Verify Bute is still in inactive
    await expect(inactiveFeeds.locator('.horse-feed-row')).toHaveCount(1);
    await expect(inactiveFeeds).toContainText('Bute');
  });

  test('feed values are saved when creating new horse', async ({ pairedController }) => {
    const { controllerPage, displayId } = pairedController;

    // Setup: Create data with feeds but no horses
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
      horses: [],
      diet: {}
    };

    await controllerPage.request.put(`/api/displays/${displayId}`, {
      data: { tableData: testData }
    });

    await controllerPage.reload();
    await controllerPage.locator('#editor-screen').waitFor({ state: 'visible' });

    // Switch to horses tab and add new horse
    await controllerPage.locator('.tab-btn[data-tab="horses"]').click();
    await controllerPage.locator('#add-horse-btn').click();
    await controllerPage.locator('#horse-modal').waitFor({ state: 'visible' });

    // Enter horse name
    await controllerPage.locator('#horse-name-input').fill('Thunder');

    // Add Oats feed
    await controllerPage.locator('#horse-inactive-feeds .horse-feed-row').click();

    // Fill in AM/PM values - need to trigger blur to register the values
    const activeRow = controllerPage.locator('#horse-active-feeds .horse-feed-row');
    const amInput = activeRow.locator('input[data-period="am"]');
    const pmInput = activeRow.locator('input[data-period="pm"]');

    await amInput.fill('1.5');
    await amInput.blur();
    await pmInput.fill('0.5');
    await pmInput.blur();

    // Save the horse
    await controllerPage.locator('.save-horse-btn').click();

    // Wait for modal to close
    await controllerPage.locator('#horse-modal').waitFor({ state: 'hidden' });

    // Wait for save to complete (debounce is 500ms)
    await controllerPage.waitForTimeout(1000);

    // Verify data was saved correctly via API
    const response = await controllerPage.request.get(`/api/displays/${displayId}`);
    const data = await response.json();

    expect(data.tableData.horses).toHaveLength(1);
    expect(data.tableData.horses[0].name).toBe('Thunder');

    // Find the horse's diet
    const horseId = data.tableData.horses[0].id;
    expect(data.tableData.diet[horseId]).toBeDefined();
    expect(data.tableData.diet[horseId].f1.am).toBe(1.5);
    expect(data.tableData.diet[horseId].f1.pm).toBe(0.5);
  });

  test('can add multiple feeds to new horse', async ({ pairedController }) => {
    const { controllerPage, displayId } = pairedController;

    // Setup: Create data with multiple feeds
    const testData = {
      settings: {
        timezone: 'Australia/Sydney',
        timeMode: 'AUTO',
        overrideUntil: null,
        zoomLevel: 2,
        currentPage: 0
      },
      feeds: [
        { id: 'f1', name: 'Oats', unit: 'scoop', rank: 1 },
        { id: 'f2', name: 'Bute', unit: 'sachet', rank: 2 },
        { id: 'f3', name: 'Chaff', unit: 'scoop', rank: 3 }
      ],
      horses: [],
      diet: {}
    };

    await controllerPage.request.put(`/api/displays/${displayId}`, {
      data: { tableData: testData }
    });

    await controllerPage.reload();
    await controllerPage.locator('#editor-screen').waitFor({ state: 'visible' });

    // Add new horse
    await controllerPage.locator('.tab-btn[data-tab="horses"]').click();
    await controllerPage.locator('#add-horse-btn').click();
    await controllerPage.locator('#horse-modal').waitFor({ state: 'visible' });

    // Enter name
    await controllerPage.locator('#horse-name-input').fill('Lightning');

    // Add first feed
    await controllerPage.locator('#horse-inactive-feeds .horse-feed-row', { hasText: 'Oats' }).click();

    // Add second feed
    await controllerPage.locator('#horse-inactive-feeds .horse-feed-row', { hasText: 'Chaff' }).click();

    // Verify two feeds are active
    const activeFeeds = controllerPage.locator('#horse-active-feeds .horse-feed-row');
    await expect(activeFeeds).toHaveCount(2);

    // Fill in values for first feed (Oats) - trigger blur to register changes
    const oatsRow = controllerPage.locator('#horse-active-feeds .horse-feed-row', { hasText: 'Oats' });
    const oatsAm = oatsRow.locator('input[data-period="am"]');
    const oatsPm = oatsRow.locator('input[data-period="pm"]');
    await oatsAm.fill('1');
    await oatsAm.blur();
    await oatsPm.fill('1');
    await oatsPm.blur();

    // Fill in values for second feed (Chaff)
    const chaffRow = controllerPage.locator('#horse-active-feeds .horse-feed-row', { hasText: 'Chaff' });
    const chaffAm = chaffRow.locator('input[data-period="am"]');
    const chaffPm = chaffRow.locator('input[data-period="pm"]');
    await chaffAm.fill('2');
    await chaffAm.blur();
    await chaffPm.fill('2');
    await chaffPm.blur();

    // Save
    await controllerPage.locator('.save-horse-btn').click();
    await controllerPage.locator('#horse-modal').waitFor({ state: 'hidden' });

    // Wait for save to complete (debounce is 500ms)
    await controllerPage.waitForTimeout(1000);

    // Verify via API
    const response = await controllerPage.request.get(`/api/displays/${displayId}`);
    const data = await response.json();

    expect(data.tableData.horses).toHaveLength(1);
    const horseId = data.tableData.horses[0].id;
    const diet = data.tableData.diet[horseId];

    expect(diet.f1).toEqual({ am: 1, pm: 1 });  // Oats
    expect(diet.f3).toEqual({ am: 2, pm: 2 });  // Chaff
    expect(diet.f2).toBeUndefined();  // Bute was not added
  });

  test('diet values persist when reopening horse modal', async ({ pairedController }) => {
    const { controllerPage, displayId } = pairedController;

    // Setup: Create horse with diet
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
        { id: 'h1', name: 'Thunder', note: null, noteExpiry: null }
      ],
      diet: {
        h1: { f1: { am: 1.5, pm: 0.75 } }
      }
    };

    await controllerPage.request.put(`/api/displays/${displayId}`, {
      data: { tableData: testData }
    });

    await controllerPage.reload();
    await controllerPage.locator('#editor-screen').waitFor({ state: 'visible' });

    // Open horse modal for editing
    await controllerPage.locator('.tab-btn[data-tab="horses"]').click();
    await controllerPage.locator('.horse-card').click();
    await controllerPage.locator('#horse-modal').waitFor({ state: 'visible' });

    // Verify values are correct
    const activeRow = controllerPage.locator('#horse-active-feeds .horse-feed-row');
    const amInput = activeRow.locator('input[data-period="am"]');
    const pmInput = activeRow.locator('input[data-period="pm"]');

    await expect(amInput).toHaveValue('1.5');
    await expect(pmInput).toHaveValue('0.75');
  });
});
