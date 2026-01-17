// Import browser mocks before any client code
import '../setup.js';

import { test, describe, beforeEach, before } from 'node:test';
import assert from 'node:assert';

let stores;

// Load module dynamically to ensure globals are set
before(async () => {
  stores = await import('../../src/client/stores/index.ts');
});

// Reset stores before each test
beforeEach(() => {
  if (stores) {
    stores.board.value = null;
    stores.horses.value = [];
    stores.feeds.value = [];
    stores.diet.value = [];
    stores.searchQuery.value = '';
  }
});

// Helpers to create mock data
const mockBoard = (overrides = {}) => ({
  id: 'b_1',
  pair_code: '123',
  timezone: 'UTC',
  time_mode: 'AUTO',
  orientation: 'horse-major',
  zoom_level: 2,
  current_page: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

const mockHorse = (overrides = {}) => ({
  id: 'h_1',
  board_id: 'b_1',
  name: 'Horse 1',
  archived: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

const mockFeed = (overrides = {}) => ({
  id: 'f_1',
  board_id: 'b_1',
  name: 'Feed 1',
  unit_type: 'fraction',
  unit_label: 'scoop',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

const mockDietEntry = (overrides = {}) => ({
  horse_id: 'h_1',
  feed_id: 'f_1',
  am_amount: 1,
  pm_amount: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

describe('Stores API', () => {

  describe('Board Helper', () => {
    test('updateBoard updates board signal', () => {
      stores.board.value = mockBoard();
      stores.updateBoard({ timezone: 'Europe/London' });
      assert.strictEqual(stores.board.value.timezone, 'Europe/London');
    });

    test('setZoomLevel updates zoom', () => {
      stores.board.value = mockBoard({ zoom_level: 1 });
      stores.setZoomLevel(3);
      assert.strictEqual(stores.board.value.zoom_level, 3);
    });

    test('setOrientation updates orientation', () => {
      stores.board.value = mockBoard({ orientation: 'horse-major' });
      stores.setOrientation('feed-major');
      assert.strictEqual(stores.board.value.orientation, 'feed-major');
    });

    test('setCurrentPage updates page', () => {
      stores.board.value = mockBoard({ current_page: 0 });
      stores.setCurrentPage(2);
      assert.strictEqual(stores.board.value.current_page, 2);
    });

    test('setOrientation resets current_page to 0', () => {
      stores.board.value = mockBoard({ orientation: 'horse-major', current_page: 5 });
      stores.setOrientation('feed-major');
      assert.strictEqual(stores.board.value.orientation, 'feed-major');
      assert.strictEqual(stores.board.value.current_page, 0);
    });
  });

  describe('Horse Helpers', () => {
    test('addHorse adds to list', () => {
      stores.addHorse(mockHorse({ id: 'h_1' }));
      assert.strictEqual(stores.horses.value.length, 1);
      assert.strictEqual(stores.horses.value[0].id, 'h_1');
    });

    test('updateHorse updates existing', () => {
      stores.addHorse(mockHorse({ id: 'h_1', name: 'Old' }));
      stores.updateHorse('h_1', { name: 'New' });
      assert.strictEqual(stores.horses.value[0].name, 'New');
    });

    test('removeHorse removes from list', () => {
      stores.addHorse(mockHorse({ id: 'h_1' }));
      stores.removeHorse('h_1');
      assert.strictEqual(stores.horses.value.length, 0);
    });

    test('getHorse finds item', () => {
      stores.addHorse(mockHorse({ id: 'h_1' }));
      const found = stores.getHorse('h_1');
      assert.strictEqual(found.id, 'h_1');
    });

    test('filteredHorses respects searchQuery', () => {
      stores.addHorse(mockHorse({ id: 'h_1', name: 'Alpha' }));
      stores.addHorse(mockHorse({ id: 'h_2', name: 'Beta' }));
      stores.searchQuery.value = 'al';
      assert.strictEqual(stores.filteredHorses.value.length, 1);
      assert.strictEqual(stores.filteredHorses.value[0].name, 'Alpha');
    });

    test('activeHorses excludes archived', () => {
      stores.addHorse(mockHorse({ id: 'h_1', archived: false }));
      stores.addHorse(mockHorse({ id: 'h_2', archived: true }));
      assert.strictEqual(stores.activeHorses.value.length, 1);
      assert.strictEqual(stores.activeHorses.value[0].id, 'h_1');
    });
  });

  describe('Feed Helpers', () => {
    test('add/update/remove feed works', () => {
      stores.addFeed(mockFeed({ id: 'f_1' }));
      assert.strictEqual(stores.feeds.value.length, 1);

      stores.updateFeed('f_1', { name: 'Updated' });
      assert.strictEqual(stores.feeds.value[0].name, 'Updated');

      stores.removeFeed('f_1');
      assert.strictEqual(stores.feeds.value.length, 0);
    });
  });

  describe('Diet Helpers', () => {
    test('getDiet finds entry by composite key', () => {
      stores.diet.value = [mockDietEntry({ horse_id: 'h_1', feed_id: 'f_1' })];
      const entry = stores.getDiet('h_1', 'f_1');
      assert.ok(entry);
      assert.strictEqual(entry.horse_id, 'h_1');
    });

    test('updateDietAmount updates local state (optimistic)', () => {
      stores.diet.value = [mockDietEntry({ horse_id: 'h_1', feed_id: 'f_1', am_amount: 1 })];
      stores.updateDietAmount('h_1', 'f_1', 'am_amount', 5);
      const entry = stores.getDiet('h_1', 'f_1');
      assert.strictEqual(entry.am_amount, 5);
    });

    test('updateDietAmount creates entry if missing', () => {
      stores.updateDietAmount('h_new', 'f_new', 'am_amount', 3);
      const entry = stores.getDiet('h_new', 'f_new');
      assert.ok(entry);
      assert.strictEqual(entry.am_amount, 3);
    });

    test('getDietByHorse returns entries for specific horse', () => {
      stores.diet.value = [
        mockDietEntry({ horse_id: 'h_1', feed_id: 'f_1' }),
        mockDietEntry({ horse_id: 'h_1', feed_id: 'f_2' }),
        mockDietEntry({ horse_id: 'h_2', feed_id: 'f_1' })
      ];
      const items = stores.getDietByHorse('h_1');
      assert.strictEqual(items.length, 2);
    });

    test('countActiveFeeds counts feeds with amounts', () => {
      stores.diet.value = [
        mockDietEntry({ horse_id: 'h_1', feed_id: 'f_1', am_amount: 1 }),
        mockDietEntry({ horse_id: 'h_1', feed_id: 'f_2', am_amount: 0, pm_amount: 0 }), // not active
        mockDietEntry({ horse_id: 'h_1', feed_id: 'f_3', pm_amount: 1 })
      ];
      assert.strictEqual(stores.countActiveFeeds('h_1'), 2);
    });
  });

  describe('SSE Bulk Update', () => {
    test('setFromSSE replaces all state', () => {
      stores.horses.value = [mockHorse({ id: 'old' })];

      const newData = {
        board: mockBoard({ id: 'new_board' }),
        horses: [mockHorse({ id: 'new_horse' })],
        feeds: [mockFeed({ id: 'new_feed' })],
        diet_entries: [mockDietEntry({ horse_id: 'new_horse', feed_id: 'new_feed' })]
      };

      stores.setFromSSE(newData);

      assert.strictEqual(stores.board.value.id, 'new_board');
      assert.strictEqual(stores.horses.value.length, 1);
      assert.strictEqual(stores.horses.value[0].id, 'new_horse');
      assert.strictEqual(stores.feeds.value.length, 1);
      assert.strictEqual(stores.diet.value.length, 1);
    });
  });
});
