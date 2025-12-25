import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DisplayDatabase } from '../../../server/db/sqlite.js';
import fs from 'fs';

describe('SQLite Database', () => {
  let db;
  const testDbPath = './data/test-db.sqlite';

  before(() => {
    // Ensure data directory exists
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data', { recursive: true });
    }
  });

  beforeEach(() => {
    // Remove old test db if exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new DisplayDatabase(testDbPath);
    db.initialize();
  });

  after(() => {
    if (db) db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('initialize()', () => {
    it('creates all required tables', () => {
      const tables = db.getTables();
      assert.ok(tables.includes('displays'), 'displays table should exist');
      assert.ok(tables.includes('horses'), 'horses table should exist');
      assert.ok(tables.includes('feeds'), 'feeds table should exist');
      assert.ok(tables.includes('diet_entries'), 'diet_entries table should exist');
    });

    it('is idempotent (can run multiple times)', () => {
      assert.doesNotThrow(() => db.initialize());
      assert.doesNotThrow(() => db.initialize());
    });
  });

  describe('createDisplay()', () => {
    it('creates a display with id and pair code', () => {
      const display = db.createDisplay();
      assert.ok(display.id, 'should have id');
      assert.ok(display.pairCode, 'should have pairCode');
      assert.match(display.id, /^d_[a-f0-9]+$/, 'id should match format');
      assert.match(display.pairCode, /^\d{6}$/, 'pairCode should be 6 digits');
    });

    it('generates unique ids for each display', () => {
      const ids = new Set();
      for (let i = 0; i < 10; i++) {
        const display = db.createDisplay();
        ids.add(display.id);
      }
      assert.strictEqual(ids.size, 10, 'all ids should be unique');
    });

    it('generates unique pair codes', () => {
      const codes = new Set();
      for (let i = 0; i < 10; i++) {
        const display = db.createDisplay();
        codes.add(display.pairCode);
      }
      assert.strictEqual(codes.size, 10, 'all pair codes should be unique');
    });
  });

  describe('getDisplayById()', () => {
    it('returns display by id', () => {
      const created = db.createDisplay();
      const found = db.getDisplayById(created.id);

      assert.strictEqual(found.id, created.id);
      assert.strictEqual(found.pairCode, created.pairCode);
      assert.ok(found.tableData, 'should have tableData');
    });

    it('returns null for non-existent id', () => {
      const found = db.getDisplayById('nonexistent');
      assert.strictEqual(found, null);
    });

    it('returns parsed tableData with domain structure', () => {
      const created = db.createDisplay();
      const found = db.getDisplayById(created.id);

      assert.ok(found.tableData.settings, 'should have settings');
      assert.strictEqual(found.tableData.settings.timeMode, 'AUTO', 'should have timeMode');
      assert.ok(Array.isArray(found.tableData.feeds), 'feeds should be array');
      assert.ok(Array.isArray(found.tableData.horses), 'horses should be array');
      assert.ok(typeof found.tableData.diet === 'object', 'diet should be object');
    });
  });

  describe('getDisplayByPairCode()', () => {
    it('returns display by pair code', () => {
      const created = db.createDisplay();
      const found = db.getDisplayByPairCode(created.pairCode);

      assert.strictEqual(found.id, created.id);
    });

    it('returns null for invalid pair code', () => {
      const found = db.getDisplayByPairCode('000000');
      assert.strictEqual(found, null);
    });
  });

  describe('updateDisplayData()', () => {
    it('updates settings', () => {
      const display = db.createDisplay();
      const tableData = {
        settings: {
          timezone: 'America/New_York',
          timeMode: 'AM',
          overrideUntil: Date.now() + 3600000,
          zoomLevel: 1,
          currentPage: 2,
        },
        feeds: [],
        horses: [],
        diet: {},
      };

      const success = db.updateDisplayData(display.id, tableData);
      assert.strictEqual(success, true);

      const updated = db.getDisplayById(display.id);
      assert.strictEqual(updated.tableData.settings.timezone, 'America/New_York');
      assert.strictEqual(updated.tableData.settings.timeMode, 'AM');
      assert.strictEqual(updated.tableData.settings.zoomLevel, 1);
      assert.strictEqual(updated.tableData.settings.currentPage, 2);
    });

    it('syncs horses to relational tables', () => {
      const display = db.createDisplay();
      const tableData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0,
        },
        horses: [
          { id: 'h1', name: 'Thunder', note: 'Fast horse' },
          { id: 'h2', name: 'Lightning', note: null },
        ],
        feeds: [],
        diet: {},
      };

      db.updateDisplayData(display.id, tableData);
      const updated = db.getDisplayById(display.id);

      assert.strictEqual(updated.tableData.horses.length, 2);
      const horseNames = updated.tableData.horses.map(h => h.name).sort();
      assert.deepStrictEqual(horseNames, ['Lightning', 'Thunder']);
    });

    it('syncs feeds with ranking', () => {
      const display = db.createDisplay();
      const tableData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0,
        },
        horses: [{ id: 'h1', name: 'Horse' }],
        feeds: [
          { id: 'f1', name: 'Hay', unit: 'scoop', rank: 0 },
          { id: 'f2', name: 'Grain', unit: 'scoop', rank: 0 },
        ],
        diet: {
          h1: { f1: { am: 2, pm: 1 } },
        },
      };

      db.updateDisplayData(display.id, tableData);
      const updated = db.getDisplayById(display.id);

      // f1 should have rank 1 (used), f2 should have rank 2 (unused)
      const f1 = updated.tableData.feeds.find((f) => f.id === 'f1');
      const f2 = updated.tableData.feeds.find((f) => f.id === 'f2');
      assert.strictEqual(f1.rank, 1);
      assert.strictEqual(f2.rank, 2);
    });

    it('returns false for non-existent display', () => {
      const success = db.updateDisplayData('nonexistent', {
        settings: {
          timezone: 'UTC',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0,
        },
        feeds: [],
        horses: [],
        diet: {},
      });
      assert.strictEqual(success, false);
    });
  });

  describe('deleteDisplay()', () => {
    it('removes display and cascades to related tables', () => {
      const display = db.createDisplay();

      // Add some data
      db.updateDisplayData(display.id, {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0,
        },
        horses: [{ id: 'h1', name: 'Horse' }],
        feeds: [{ id: 'f1', name: 'Hay', unit: 'scoop' }],
        diet: { h1: { f1: { am: 1, pm: 1 } } },
      });

      const deleted = db.deleteDisplay(display.id);

      assert.strictEqual(deleted, true);
      assert.strictEqual(db.getDisplayById(display.id), null);

      // Verify cascade delete
      const horses = db.raw.prepare('SELECT * FROM horses WHERE display_id = ?').all(display.id);
      const feeds = db.raw.prepare('SELECT * FROM feeds WHERE display_id = ?').all(display.id);
      assert.strictEqual(horses.length, 0);
      assert.strictEqual(feeds.length, 0);
    });

    it('returns false for non-existent display', () => {
      const deleted = db.deleteDisplay('nonexistent');
      assert.strictEqual(deleted, false);
    });
  });

  describe('clear()', () => {
    it('removes all displays', () => {
      db.createDisplay();
      db.createDisplay();
      db.createDisplay();

      db.clear();

      // Creating a new one should work
      const display = db.createDisplay();
      assert.ok(display.id, 'should be able to create after clear');
    });
  });

  describe('recalculateFeedRankings()', () => {
    it('ranks feeds by usage count', () => {
      const display = db.createDisplay();

      db.updateDisplayData(display.id, {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0,
        },
        horses: [
          { id: 'h1', name: 'Horse1' },
          { id: 'h2', name: 'Horse2' },
        ],
        feeds: [
          { id: 'f1', name: 'Rarely', unit: 'scoop' },
          { id: 'f2', name: 'Often', unit: 'scoop' },
        ],
        diet: {
          h1: { f2: { am: 1, pm: 0 } },
          h2: { f2: { am: 1, pm: 1 } },
        },
      });

      const updated = db.getDisplayById(display.id);
      const feeds = updated.tableData.feeds;

      // f2 used by 2 horses, f1 used by 0
      const often = feeds.find((f) => f.name === 'Often');
      const rarely = feeds.find((f) => f.name === 'Rarely');

      assert.strictEqual(often.rank, 1); // Most used
      assert.strictEqual(rarely.rank, 2); // Least used
    });
  });
});
