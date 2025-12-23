import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../../server/index.js';

describe('NoteExpiryService', () => {
  let app;
  let noteExpiryService;
  let displayService;

  before(() => {
    app = createApp({ dbPath: ':memory:' });
    noteExpiryService = app.get('noteExpiryService');
    displayService = app.get('displayService');
  });

  beforeEach(() => {
    app.get('db').clear();
  });

  after(() => {
    app.get('db').close();
  });

  /**
   * Helper to create a display with horses
   */
  async function createDisplayWithHorses(horses = []) {
    const display = displayService.createDisplay();
    const tableData = {
      ...displayService.getDisplay(display.id).tableData,
      horses
    };
    displayService.db.updateDisplayData(display.id, tableData);
    return display.id;
  }

  describe('checkAndClearExpiredNotes', () => {
    it('clears expired notes from horses', async () => {
      const expiredTime = Date.now() - 1000; // 1 second ago
      const displayId = await createDisplayWithHorses([
        {
          id: 'h1',
          name: 'Spider',
          note: 'Expired note',
          noteExpiry: expiredTime,
          noteCreatedAt: expiredTime - 86400000
        }
      ]);

      const result = noteExpiryService.checkAndClearExpiredNotes(displayId);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.clearedCount, 1);
      assert.strictEqual(result.updated, true);

      // Verify note was cleared
      const display = displayService.getDisplay(displayId);
      const horse = display.tableData.horses.find(h => h.id === 'h1');
      assert.strictEqual(horse.note, null);
      assert.strictEqual(horse.noteExpiry, null);
    });

    it('does not clear non-expired notes', async () => {
      const futureTime = Date.now() + 86400000; // 24 hours from now
      const displayId = await createDisplayWithHorses([
        {
          id: 'h1',
          name: 'Spider',
          note: 'Future note',
          noteExpiry: futureTime,
          noteCreatedAt: Date.now()
        }
      ]);

      const result = noteExpiryService.checkAndClearExpiredNotes(displayId);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.clearedCount, 0);
      assert.strictEqual(result.updated, false);

      // Verify note still exists
      const display = displayService.getDisplay(displayId);
      const horse = display.tableData.horses.find(h => h.id === 'h1');
      assert.strictEqual(horse.note, 'Future note');
      assert.strictEqual(horse.noteExpiry, futureTime);
    });

    it('does not clear notes without expiry', async () => {
      const displayId = await createDisplayWithHorses([
        {
          id: 'h1',
          name: 'Spider',
          note: 'Permanent note',
          noteExpiry: null,
          noteCreatedAt: Date.now() - 86400000
        }
      ]);

      const result = noteExpiryService.checkAndClearExpiredNotes(displayId);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.clearedCount, 0);

      // Verify note still exists
      const display = displayService.getDisplay(displayId);
      const horse = display.tableData.horses.find(h => h.id === 'h1');
      assert.strictEqual(horse.note, 'Permanent note');
    });

    it('clears multiple expired notes', async () => {
      const expiredTime = Date.now() - 1000;
      const futureTime = Date.now() + 86400000;
      const displayId = await createDisplayWithHorses([
        {
          id: 'h1',
          name: 'Spider',
          note: 'Expired 1',
          noteExpiry: expiredTime,
          noteCreatedAt: expiredTime - 86400000
        },
        {
          id: 'h2',
          name: 'Lightning',
          note: 'Not expired',
          noteExpiry: futureTime,
          noteCreatedAt: Date.now()
        },
        {
          id: 'h3',
          name: 'Thunder',
          note: 'Expired 2',
          noteExpiry: expiredTime - 1000,
          noteCreatedAt: expiredTime - 86400000
        }
      ]);

      const result = noteExpiryService.checkAndClearExpiredNotes(displayId);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.clearedCount, 2);

      // Verify correct notes were cleared
      const display = displayService.getDisplay(displayId);
      const h1 = display.tableData.horses.find(h => h.id === 'h1');
      const h2 = display.tableData.horses.find(h => h.id === 'h2');
      const h3 = display.tableData.horses.find(h => h.id === 'h3');

      assert.strictEqual(h1.note, null, 'h1 note should be cleared');
      assert.strictEqual(h2.note, 'Not expired', 'h2 note should remain');
      assert.strictEqual(h3.note, null, 'h3 note should be cleared');
    });

    it('returns error for non-existent display', async () => {
      const result = noteExpiryService.checkAndClearExpiredNotes('nonexistent');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Display not found');
    });
  });

  describe('setNote', () => {
    it('sets a note with 24h expiry', async () => {
      const displayId = await createDisplayWithHorses([
        { id: 'h1', name: 'Spider' }
      ]);

      const result = noteExpiryService.setNote(displayId, 'h1', 'Vet visit tomorrow', 24);

      assert.strictEqual(result.success, true);
      assert.ok(result.noteExpiry, 'should have expiry time');

      // Verify note was set
      const display = displayService.getDisplay(displayId);
      const horse = display.tableData.horses.find(h => h.id === 'h1');
      assert.strictEqual(horse.note, 'Vet visit tomorrow');
      assert.ok(horse.noteExpiry > Date.now(), 'expiry should be in future');
    });

    it('sets a note without expiry', async () => {
      const displayId = await createDisplayWithHorses([
        { id: 'h1', name: 'Spider' }
      ]);

      const result = noteExpiryService.setNote(displayId, 'h1', 'Permanent note', null);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.noteExpiry, null);

      // Verify note was set
      const display = displayService.getDisplay(displayId);
      const horse = display.tableData.horses.find(h => h.id === 'h1');
      assert.strictEqual(horse.note, 'Permanent note');
      assert.strictEqual(horse.noteExpiry, null);
    });

    it('returns error for non-existent horse', async () => {
      const displayId = await createDisplayWithHorses([
        { id: 'h1', name: 'Spider' }
      ]);

      const result = noteExpiryService.setNote(displayId, 'h999', 'Note', 24);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Horse not found');
    });
  });

  describe('clearNote', () => {
    it('clears an existing note', async () => {
      const displayId = await createDisplayWithHorses([
        {
          id: 'h1',
          name: 'Spider',
          note: 'Existing note',
          noteExpiry: Date.now() + 86400000,
          noteCreatedAt: Date.now()
        }
      ]);

      const result = noteExpiryService.clearNote(displayId, 'h1');

      assert.strictEqual(result.success, true);

      // Verify note was cleared
      const display = displayService.getDisplay(displayId);
      const horse = display.tableData.horses.find(h => h.id === 'h1');
      assert.strictEqual(horse.note, null);
      assert.strictEqual(horse.noteExpiry, null);
    });
  });

  describe('getNoteStatus', () => {
    it('returns correct status for active note', async () => {
      const expiry = Date.now() + 86400000;
      const created = Date.now();
      const displayId = await createDisplayWithHorses([
        {
          id: 'h1',
          name: 'Spider',
          note: 'Active note',
          noteExpiry: expiry,
          noteCreatedAt: created
        }
      ]);

      const result = noteExpiryService.getNoteStatus(displayId, 'h1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.note, 'Active note');
      assert.strictEqual(result.noteExpiry, expiry);
      assert.strictEqual(result.isExpired, false);
      assert.strictEqual(result.isStale, false);
      assert.ok(result.expiresIn > 0, 'should have positive expiresIn');
    });

    it('returns expired status for expired note', async () => {
      const expiry = Date.now() - 1000;
      const displayId = await createDisplayWithHorses([
        {
          id: 'h1',
          name: 'Spider',
          note: 'Expired note',
          noteExpiry: expiry,
          noteCreatedAt: expiry - 86400000
        }
      ]);

      const result = noteExpiryService.getNoteStatus(displayId, 'h1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.isExpired, true);
      assert.ok(result.expiresIn < 0, 'should have negative expiresIn');
    });

    it('returns stale status for old note without expiry', async () => {
      const created = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const displayId = await createDisplayWithHorses([
        {
          id: 'h1',
          name: 'Spider',
          note: 'Stale note',
          noteExpiry: null,
          noteCreatedAt: created
        }
      ]);

      const result = noteExpiryService.getNoteStatus(displayId, 'h1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.isStale, true);
      assert.strictEqual(result.isExpired, false);
    });

    it('returns error for non-existent horse', async () => {
      const displayId = await createDisplayWithHorses([
        { id: 'h1', name: 'Spider' }
      ]);

      const result = noteExpiryService.getNoteStatus(displayId, 'h999');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Horse not found');
    });
  });
});
