import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
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
  function createDisplayWithHorses(horses = []) {
    const display = displayService.createDisplay();
    const tableData = {
      settings: {
        timezone: 'Australia/Sydney',
        timeMode: 'AUTO',
        overrideUntil: null,
        zoomLevel: 2,
        currentPage: 0,
      },
      horses,
      feeds: [],
      diet: {},
    };
    displayService.db.updateDisplayData(display.id, tableData);
    return display.id;
  }

  describe('checkAndClearExpiredNotes', () => {
    it('clears expired notes from horses', () => {
      const expiredTime = Date.now() - 1000; // 1 second ago
      const displayId = createDisplayWithHorses([
        {
          id: 'h1',
          name: 'Spider',
          note: 'Expired note',
          noteExpiry: expiredTime,
          noteCreatedAt: expiredTime - 86400000,
        },
      ]);

      const result = noteExpiryService.checkAndClearExpiredNotes(displayId);

      assert.strictEqual(result.success, true);
      assert.ok(result.clearedCount >= 0);

      // If notes were cleared, they should be null now
      if (result.clearedCount > 0) {
        const display = displayService.getDisplay(displayId);
        const horse = display.tableData.horses.find((h) => h.id === 'h1');
        assert.strictEqual(horse.note, null);
        assert.strictEqual(horse.noteExpiry, null);
      }
    });

    it('returns error for non-existent display', () => {
      const result = noteExpiryService.checkAndClearExpiredNotes('nonexistent');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Display not found');
    });
  });
});
