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
    it('creates displays table if not exists', () => {
      const tables = db.getTables();
      assert.ok(tables.includes('displays'), 'displays table should exist');
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

    it('returns parsed tableData', () => {
      const created = db.createDisplay();
      const found = db.getDisplayById(created.id);

      assert.ok(Array.isArray(found.tableData.headers), 'headers should be array');
      assert.ok(Array.isArray(found.tableData.rows), 'rows should be array');
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
    it('updates table data', () => {
      const display = db.createDisplay();
      const tableData = {
        headers: ['Task', 'Status'],
        rows: [['Buy milk', 'Done']]
      };

      const success = db.updateDisplayData(display.id, tableData);
      assert.strictEqual(success, true);

      const updated = db.getDisplayById(display.id);
      assert.deepStrictEqual(updated.tableData.headers, tableData.headers);
      assert.deepStrictEqual(updated.tableData.rows, tableData.rows);
    });

    it('returns false for non-existent display', () => {
      const success = db.updateDisplayData('nonexistent', { headers: [], rows: [] });
      assert.strictEqual(success, false);
    });
  });

  describe('deleteDisplay()', () => {
    it('removes display from database', () => {
      const display = db.createDisplay();
      const deleted = db.deleteDisplay(display.id);

      assert.strictEqual(deleted, true);
      assert.strictEqual(db.getDisplayById(display.id), null);
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
});
