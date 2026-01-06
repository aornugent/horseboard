import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  createResourceStore,
  createDietStore,
  createBoardStore,
  createHorseStore,
  createFeedStore,
} from '../../src/client/lib/engine.js';

function mockHorse(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: `h_${Math.random().toString(36).slice(2)}`,
    board_id: 'b_test',
    name: 'Test Horse',
    note: null,
    note_expiry: null,
    archived: false,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function mockFeed(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: `f_${Math.random().toString(36).slice(2)}`,
    board_id: 'b_test',
    name: 'Test Feed',
    unit: 'scoop',
    rank: 1,
    stock_level: 100,
    low_stock_threshold: 10,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function mockDietEntry(overrides = {}) {
  const now = new Date().toISOString();
  return {
    horse_id: 'h_test',
    feed_id: 'f_test',
    am_amount: null,
    pm_amount: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function mockBoard(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: 'b_test',
    pair_code: '123456',
    timezone: 'Australia/Sydney',
    time_mode: 'AUTO',
    override_until: null,
    zoom_level: 2,
    current_page: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function timestamp(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

describe('createResourceStore', () => {
  describe('basic operations', () => {
    test('initializes with empty items', () => {
      const store = createResourceStore();
      assert.deepEqual(store.items.value, []);
      assert.equal(store.byId.value.size, 0);
      assert.equal(store.version.value, 0);
    });

    test('set() populates the store', () => {
      const store = createResourceStore();
      const horses = [mockHorse({ id: 'h_1' }), mockHorse({ id: 'h_2' })];

      store.set(horses);

      assert.equal(store.items.value.length, 2);
      assert.equal(store.byId.value.size, 2);
      assert.equal(store.version.value, 1);
    });

    test('add() inserts a new item', () => {
      const store = createResourceStore();
      const horse = mockHorse({ id: 'h_1' });

      store.add(horse);

      assert.equal(store.items.value.length, 1);
      assert.equal(store.get('h_1').name, 'Test Horse');
      assert.equal(store.version.value, 1);
    });

    test('update() modifies an existing item', () => {
      const store = createResourceStore();
      store.add(mockHorse({ id: 'h_1', name: 'Original' }));

      store.update('h_1', { name: 'Updated' });

      assert.equal(store.get('h_1').name, 'Updated');
      assert.equal(store.version.value, 2);
    });

    test('update() does nothing for non-existent item', () => {
      const store = createResourceStore();
      const initialVersion = store.version.value;

      store.update('non_existent', { name: 'Test' });

      assert.equal(store.version.value, initialVersion);
    });

    test('remove() deletes an item', () => {
      const store = createResourceStore();
      store.add(mockHorse({ id: 'h_1' }));
      store.add(mockHorse({ id: 'h_2' }));

      store.remove('h_1');

      assert.equal(store.items.value.length, 1);
      assert.equal(store.get('h_1'), undefined);
      assert.equal(store.get('h_2').id, 'h_2');
    });

    test('get() returns item by ID', () => {
      const store = createResourceStore();
      const horse = mockHorse({ id: 'h_1', name: 'Specific Horse' });
      store.add(horse);

      const retrieved = store.get('h_1');

      assert.equal(retrieved.name, 'Specific Horse');
    });

    test('get() returns undefined for non-existent ID', () => {
      const store = createResourceStore();

      assert.equal(store.get('non_existent'), undefined);
    });
  });

  describe('version reactivity', () => {
    test('version increments on each mutation', () => {
      const store = createResourceStore();
      assert.equal(store.version.value, 0);

      store.add(mockHorse({ id: 'h_1' }));
      assert.equal(store.version.value, 1);

      store.update('h_1', { name: 'Updated' });
      assert.equal(store.version.value, 2);

      store.remove('h_1');
      assert.equal(store.version.value, 3);
    });

    test('version does not increment on no-op remove', () => {
      const store = createResourceStore();
      const initialVersion = store.version.value;

      store.remove('non_existent');

      assert.equal(store.version.value, initialVersion);
    });
  });

  describe('reconciliation', () => {
    test('SSE source always replaces existing items', () => {
      const store = createResourceStore();
      const oldHorse = mockHorse({
        id: 'h_1',
        name: 'Old Name',
        updated_at: timestamp(1000),
      });
      store.add(oldHorse);

      const sseHorse = mockHorse({
        id: 'h_1',
        name: 'SSE Name',
        updated_at: timestamp(-1000),
      });
      store.add(sseHorse, 'sse');

      assert.equal(store.get('h_1').name, 'SSE Name');
    });

    test('API source uses timestamp comparison', () => {
      const store = createResourceStore();
      const existingHorse = mockHorse({
        id: 'h_1',
        name: 'Existing',
        updated_at: timestamp(0),
      });
      store.add(existingHorse);

      const olderHorse = mockHorse({
        id: 'h_1',
        name: 'Older Update',
        updated_at: timestamp(-1000),
      });
      store.add(olderHorse, 'api');

      assert.equal(store.get('h_1').name, 'Existing');

      const newerHorse = mockHorse({
        id: 'h_1',
        name: 'Newer Update',
        updated_at: timestamp(1000),
      });
      store.add(newerHorse, 'api');

      assert.equal(store.get('h_1').name, 'Newer Update');
    });

    test('set() with SSE source clears and replaces all items', () => {
      const store = createResourceStore();
      store.add(mockHorse({ id: 'h_1' }));
      store.add(mockHorse({ id: 'h_2' }));
      store.add(mockHorse({ id: 'h_3' }));

      store.set([mockHorse({ id: 'h_1' }), mockHorse({ id: 'h_4' })], 'sse');

      assert.equal(store.items.value.length, 2);
      assert.notEqual(store.get('h_1'), undefined);
      assert.equal(store.get('h_2'), undefined);
      assert.equal(store.get('h_3'), undefined);
      assert.notEqual(store.get('h_4'), undefined);
    });

    test('reconcile() merges items based on timestamps', () => {
      const store = createResourceStore();
      store.add(mockHorse({ id: 'h_1', name: 'Original', updated_at: timestamp(0) }));

      store.reconcile(
        [
          mockHorse({ id: 'h_1', name: 'Updated', updated_at: timestamp(1000) }),
          mockHorse({ id: 'h_2', name: 'New Horse', updated_at: timestamp(0) }),
        ],
        'api'
      );

      assert.equal(store.items.value.length, 2);
      assert.equal(store.get('h_1').name, 'Updated');
      assert.equal(store.get('h_2').name, 'New Horse');
    });

    test('reconcile() with SSE source removes items not in incoming set', () => {
      const store = createResourceStore();
      store.add(mockHorse({ id: 'h_1' }));
      store.add(mockHorse({ id: 'h_2' }));

      store.reconcile([mockHorse({ id: 'h_1' })], 'sse');

      assert.equal(store.items.value.length, 1);
      assert.notEqual(store.get('h_1'), undefined);
      assert.equal(store.get('h_2'), undefined);
    });
  });
});

describe('createDietStore', () => {
  describe('composite key handling', () => {
    test('uses horse_id:feed_id as composite key', () => {
      const store = createDietStore();
      const entry = mockDietEntry({ horse_id: 'h_1', feed_id: 'f_1' });

      store.upsert(entry);

      assert.notEqual(store.get('h_1', 'f_1'), undefined);
      assert.equal(store.get('h_1', 'f_2'), undefined);
    });

    test('byHorse groups entries by horse', () => {
      const store = createDietStore();
      store.upsert(mockDietEntry({ horse_id: 'h_1', feed_id: 'f_1' }));
      store.upsert(mockDietEntry({ horse_id: 'h_1', feed_id: 'f_2' }));
      store.upsert(mockDietEntry({ horse_id: 'h_2', feed_id: 'f_1' }));

      const horse1Entries = store.byHorse.value.get('h_1');
      assert.equal(horse1Entries.length, 2);

      const horse2Entries = store.byHorse.value.get('h_2');
      assert.equal(horse2Entries.length, 1);
    });

    test('byFeed groups entries by feed', () => {
      const store = createDietStore();
      store.upsert(mockDietEntry({ horse_id: 'h_1', feed_id: 'f_1' }));
      store.upsert(mockDietEntry({ horse_id: 'h_2', feed_id: 'f_1' }));
      store.upsert(mockDietEntry({ horse_id: 'h_1', feed_id: 'f_2' }));

      const feed1Entries = store.byFeed.value.get('f_1');
      assert.equal(feed1Entries.length, 2);

      const feed2Entries = store.byFeed.value.get('f_2');
      assert.equal(feed2Entries.length, 1);
    });
  });

  describe('updateAmount', () => {
    test('updates existing entry amount', () => {
      const store = createDietStore();
      store.upsert(mockDietEntry({ horse_id: 'h_1', feed_id: 'f_1', am_amount: 1 }));

      store.updateAmount('h_1', 'f_1', 'am_amount', 2);

      assert.equal(store.get('h_1', 'f_1').am_amount, 2);
    });

    test('creates new entry if not exists', () => {
      const store = createDietStore();

      store.updateAmount('h_1', 'f_1', 'pm_amount', 1.5);

      const entry = store.get('h_1', 'f_1');
      assert.notEqual(entry, undefined);
      assert.equal(entry.pm_amount, 1.5);
      assert.equal(entry.am_amount, null);
    });

    test('handles null values', () => {
      const store = createDietStore();
      store.upsert(mockDietEntry({ horse_id: 'h_1', feed_id: 'f_1', am_amount: 2 }));

      store.updateAmount('h_1', 'f_1', 'am_amount', null);

      assert.equal(store.get('h_1', 'f_1').am_amount, null);
    });

    test('preserves existing variant when updating amount', () => {
      const store = createDietStore();

      // Set up an entry with a variant
      store.upsert(mockDietEntry({
        horse_id: 'h_1',
        feed_id: 'f_1',
        am_amount: 1,
        pm_amount: null,
        am_variant: 'Small',
        pm_variant: null,
      }));

      // Update only the amount
      store.updateAmount('h_1', 'f_1', 'am_amount', 2);

      // Variant should still be preserved
      const entry = store.get('h_1', 'f_1');
      assert.equal(entry.am_amount, 2);
      assert.equal(entry.am_variant, 'Small');
    });
  });

  describe('countActiveFeeds', () => {
    test('counts feeds with non-zero amounts', () => {
      const store = createDietStore();
      store.upsert(mockDietEntry({ horse_id: 'h_1', feed_id: 'f_1', am_amount: 1 }));
      store.upsert(mockDietEntry({ horse_id: 'h_1', feed_id: 'f_2', pm_amount: 2 }));
      store.upsert(
        mockDietEntry({ horse_id: 'h_1', feed_id: 'f_3', am_amount: null, pm_amount: null })
      );
      store.upsert(mockDietEntry({ horse_id: 'h_1', feed_id: 'f_4', am_amount: 0, pm_amount: 0 }));

      assert.equal(store.countActiveFeeds('h_1'), 2);
    });

    test('returns 0 for horse with no entries', () => {
      const store = createDietStore();

      assert.equal(store.countActiveFeeds('h_nonexistent'), 0);
    });
  });

  describe('reconciliation', () => {
    test('SSE source replaces all entries', () => {
      const store = createDietStore();
      store.upsert(mockDietEntry({ horse_id: 'h_1', feed_id: 'f_1' }));
      store.upsert(mockDietEntry({ horse_id: 'h_1', feed_id: 'f_2' }));

      store.set([mockDietEntry({ horse_id: 'h_1', feed_id: 'f_3' })], 'sse');

      assert.equal(store.items.value.length, 1);
      assert.equal(store.get('h_1', 'f_1'), undefined);
      assert.notEqual(store.get('h_1', 'f_3'), undefined);
    });
  });
});

describe('createBoardStore', () => {
  describe('computed properties', () => {
    test('derives configured_mode from board', () => {
      const store = createBoardStore();
      store.set(mockBoard({ time_mode: 'PM' }));

      assert.equal(store.configured_mode.value, 'PM');
    });

    test('derives timezone from board', () => {
      const store = createBoardStore();
      store.set(mockBoard({ timezone: 'America/New_York' }));

      assert.equal(store.timezone.value, 'America/New_York');
    });

    test('defaults to AUTO when board is null', () => {
      const store = createBoardStore();

      assert.equal(store.configured_mode.value, 'AUTO');
    });

    test('defaults timezone to UTC when board is null', () => {
      const store = createBoardStore();

      assert.equal(store.timezone.value, 'UTC');
    });
  });

  describe('mutations', () => {
    test('updateTimeMode changes mode and override', () => {
      const store = createBoardStore();
      store.set(mockBoard());
      const overrideTime = timestamp(3600000);

      store.updateTimeMode('AM', overrideTime);

      assert.equal(store.board.value.time_mode, 'AM');
      assert.equal(store.board.value.override_until, overrideTime);
    });

    test('setZoomLevel updates zoom', () => {
      const store = createBoardStore();
      store.set(mockBoard({ zoom_level: 1 }));

      store.setZoomLevel(3);

      assert.equal(store.board.value.zoom_level, 3);
      assert.equal(store.zoom_level.value, 3);
    });

    test('setCurrentPage updates page', () => {
      const store = createBoardStore();
      store.set(mockBoard({ current_page: 0 }));

      store.setCurrentPage(2);

      assert.equal(store.board.value.current_page, 2);
      assert.equal(store.current_page.value, 2);
    });

    test('setOrientation updates orientation and resets page', () => {
      const store = createBoardStore();
      store.set(mockBoard({ orientation: 'horse-major', current_page: 2 }));

      store.setOrientation('feed-major');

      assert.equal(store.board.value.orientation, 'feed-major');
      assert.equal(store.orientation.value, 'feed-major');
      assert.equal(store.board.value.current_page, 0); // Should reset
    });
  });


  describe('reconciliation', () => {
    test('SSE source always replaces board', () => {
      const store = createBoardStore();
      store.set(
        mockBoard({
          time_mode: 'AM',
          updated_at: timestamp(1000),
        })
      );

      store.set(
        mockBoard({
          time_mode: 'PM',
          updated_at: timestamp(-1000),
        }),
        'sse'
      );

      assert.equal(store.board.value.time_mode, 'PM');
    });

    test('API source respects timestamps', () => {
      const store = createBoardStore();
      store.set(
        mockBoard({
          time_mode: 'AM',
          updated_at: timestamp(0),
        })
      );

      store.set(
        mockBoard({
          time_mode: 'PM',
          updated_at: timestamp(-1000),
        }),
        'api'
      );

      assert.equal(store.board.value.time_mode, 'AM');

      store.set(
        mockBoard({
          time_mode: 'PM',
          updated_at: timestamp(1000),
        }),
        'api'
      );

      assert.equal(store.board.value.time_mode, 'PM');
    });
  });
});

describe('createHorseStore', () => {
  describe('search filtering', () => {
    test('filtered returns all when searchQuery is empty', () => {
      const store = createHorseStore();
      store.add(mockHorse({ id: 'h_1', name: 'Apollo' }));
      store.add(mockHorse({ id: 'h_2', name: 'Zeus' }));

      assert.equal(store.filtered.value.length, 2);
    });

    test('filtered filters by name', () => {
      const store = createHorseStore();
      store.add(mockHorse({ id: 'h_1', name: 'Apollo' }));
      store.add(mockHorse({ id: 'h_2', name: 'Zeus' }));
      store.add(mockHorse({ id: 'h_3', name: 'Apollonia' }));

      store.searchQuery.value = 'apol';

      assert.equal(store.filtered.value.length, 2);
      assert.ok(store.filtered.value.every((h) => h.name.toLowerCase().includes('apol')));
    });

    test('filtered is case-insensitive', () => {
      const store = createHorseStore();
      store.add(mockHorse({ id: 'h_1', name: 'Apollo' }));

      store.searchQuery.value = 'APOLLO';

      assert.equal(store.filtered.value.length, 1);
    });
  });

  describe('active horses', () => {
    test('active excludes archived horses', () => {
      const store = createHorseStore();
      store.add(mockHorse({ id: 'h_1', archived: false }));
      store.add(mockHorse({ id: 'h_2', archived: true }));
      store.add(mockHorse({ id: 'h_3', archived: false }));

      assert.equal(store.active.value.length, 2);
      assert.ok(store.active.value.every((h) => !h.archived));
    });
  });
});

describe('createFeedStore', () => {
  describe('ranking', () => {
    test('byRank sorts feeds by rank descending', () => {
      const store = createFeedStore();
      store.add(mockFeed({ id: 'f_1', name: 'Low Rank', rank: 1 }));
      store.add(mockFeed({ id: 'f_2', name: 'High Rank', rank: 10 }));
      store.add(mockFeed({ id: 'f_3', name: 'Mid Rank', rank: 5 }));

      const ranked = store.byRank.value;

      assert.equal(ranked[0].name, 'High Rank');
      assert.equal(ranked[1].name, 'Mid Rank');
      assert.equal(ranked[2].name, 'Low Rank');
    });

    test('byRank updates when feeds change', () => {
      const store = createFeedStore();
      store.add(mockFeed({ id: 'f_1', rank: 1 }));
      store.add(mockFeed({ id: 'f_2', rank: 2 }));

      assert.equal(store.byRank.value[0].id, 'f_2');

      store.update('f_1', { rank: 10 });

      assert.equal(store.byRank.value[0].id, 'f_1');
    });
  });
});
