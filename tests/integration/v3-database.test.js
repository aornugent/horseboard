import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { initializeDatabase, transaction } from '../../src/server/db/index.js';
import { DisplayRepository } from '../../src/server/db/repositories/displays.js';
import { HorseRepository } from '../../src/server/db/repositories/horses.js';
import { FeedRepository } from '../../src/server/db/repositories/feeds.js';
import { DietEntryRepository } from '../../src/server/db/repositories/dietEntries.js';

describe('V3 Database Integration Tests', () => {
  let db;
  let displayRepo;
  let horseRepo;
  let feedRepo;
  let dietRepo;

  beforeEach(() => {
    // Use in-memory database for tests
    db = initializeDatabase(':memory:');
    displayRepo = new DisplayRepository(db);
    horseRepo = new HorseRepository(db);
    feedRepo = new FeedRepository(db);
    dietRepo = new DietEntryRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('DisplayRepository', () => {
    test('creates a display with unique ID and pair code', () => {
      const display = displayRepo.create();
      assert.ok(display.id.startsWith('d_'));
      assert.ok(/^\d{6}$/.test(display.pairCode));
    });

    test('retrieves display by ID', () => {
      const created = displayRepo.create();
      const display = displayRepo.getById(created.id);
      assert.equal(display.id, created.id);
      assert.equal(display.pairCode, created.pairCode);
      assert.equal(display.timeMode, 'AUTO');
      assert.equal(display.zoomLevel, 2);
    });

    test('retrieves display by pair code', () => {
      const created = displayRepo.create('Europe/London');
      const display = displayRepo.getByPairCode(created.pairCode);
      assert.equal(display.id, created.id);
      assert.equal(display.timezone, 'Europe/London');
    });

    test('updates display settings', () => {
      const created = displayRepo.create();
      displayRepo.update(created.id, { zoomLevel: 3, currentPage: 1 });
      const display = displayRepo.getById(created.id);
      assert.equal(display.zoomLevel, 3);
      assert.equal(display.currentPage, 1);
    });

    test('sets time mode with override', () => {
      const created = displayRepo.create();
      const overrideUntil = new Date(Date.now() + 3600000).toISOString();
      displayRepo.setTimeMode(created.id, 'PM', overrideUntil);
      const display = displayRepo.getById(created.id);
      assert.equal(display.timeMode, 'PM');
      assert.equal(display.overrideUntil, overrideUntil);
    });

    test('deletes display', () => {
      const created = displayRepo.create();
      assert.ok(displayRepo.delete(created.id));
      assert.equal(displayRepo.getById(created.id), null);
    });
  });

  describe('HorseRepository', () => {
    let displayId;

    beforeEach(() => {
      const display = displayRepo.create();
      displayId = display.id;
    });

    test('creates a horse', () => {
      const horse = horseRepo.create(displayId, 'Thunder');
      assert.ok(horse.id.startsWith('h_'));
      assert.equal(horse.name, 'Thunder');
      assert.equal(horse.displayId, displayId);
    });

    test('creates horse with note', () => {
      const noteExpiry = new Date(Date.now() + 86400000).toISOString();
      const horse = horseRepo.create(displayId, 'Storm', 'Needs extra hay', noteExpiry);
      assert.equal(horse.note, 'Needs extra hay');
      assert.equal(horse.noteExpiry, noteExpiry);
    });

    test('prevents duplicate horse names per display', () => {
      horseRepo.create(displayId, 'Thunder');
      assert.throws(() => horseRepo.create(displayId, 'Thunder'), /already exists/);
    });

    test('lists horses for display', () => {
      horseRepo.create(displayId, 'Thunder');
      horseRepo.create(displayId, 'Lightning');
      const horses = horseRepo.getByDisplayId(displayId);
      assert.equal(horses.length, 2);
    });

    test('updates horse', () => {
      const created = horseRepo.create(displayId, 'Thunder');
      horseRepo.update(created.id, { name: 'Thunder II', note: 'Updated' });
      const horse = horseRepo.getById(created.id);
      assert.equal(horse.name, 'Thunder II');
      assert.equal(horse.note, 'Updated');
    });

    test('deletes horse', () => {
      const created = horseRepo.create(displayId, 'Thunder');
      assert.ok(horseRepo.delete(created.id));
      assert.equal(horseRepo.getById(created.id), null);
    });
  });

  describe('FeedRepository', () => {
    let displayId;

    beforeEach(() => {
      const display = displayRepo.create();
      displayId = display.id;
    });

    test('creates a feed', () => {
      const feed = feedRepo.create(displayId, 'Oats', 'scoop');
      assert.ok(feed.id.startsWith('f_'));
      assert.equal(feed.name, 'Oats');
      assert.equal(feed.unit, 'scoop');
    });

    test('creates feed with default unit', () => {
      const feed = feedRepo.create(displayId, 'Hay');
      assert.equal(feed.unit, 'scoop');
    });

    test('prevents duplicate feed names per display', () => {
      feedRepo.create(displayId, 'Oats');
      assert.throws(() => feedRepo.create(displayId, 'Oats'), /already exists/);
    });

    test('lists feeds for display', () => {
      feedRepo.create(displayId, 'Oats');
      feedRepo.create(displayId, 'Barley');
      const feeds = feedRepo.getByDisplayId(displayId);
      assert.equal(feeds.length, 2);
    });

    test('updates feed', () => {
      const created = feedRepo.create(displayId, 'Oats');
      feedRepo.update(created.id, { unit: 'ml', stockLevel: 100 });
      const feed = feedRepo.getById(created.id);
      assert.equal(feed.unit, 'ml');
      assert.equal(feed.stockLevel, 100);
    });

    test('deletes feed', () => {
      const created = feedRepo.create(displayId, 'Oats');
      assert.ok(feedRepo.delete(created.id));
      assert.equal(feedRepo.getById(created.id), null);
    });
  });

  describe('DietEntryRepository', () => {
    let displayId;
    let horseId;
    let feedId;

    beforeEach(() => {
      const display = displayRepo.create();
      displayId = display.id;
      const horse = horseRepo.create(displayId, 'Thunder');
      horseId = horse.id;
      const feed = feedRepo.create(displayId, 'Oats');
      feedId = feed.id;
    });

    test('creates diet entry', () => {
      const entry = dietRepo.upsert(horseId, feedId, 2, 1.5);
      assert.equal(entry.horseId, horseId);
      assert.equal(entry.feedId, feedId);
      assert.equal(entry.amAmount, 2);
      assert.equal(entry.pmAmount, 1.5);
    });

    test('upserts diet entry (update existing)', () => {
      dietRepo.upsert(horseId, feedId, 2, 1.5);
      const entry = dietRepo.upsert(horseId, feedId, 3, 2);
      assert.equal(entry.amAmount, 3);
      assert.equal(entry.pmAmount, 2);
    });

    test('sets only AM amount', () => {
      dietRepo.upsert(horseId, feedId, 1, 2);
      const entry = dietRepo.setAmAmount(horseId, feedId, 5);
      assert.equal(entry.amAmount, 5);
      assert.equal(entry.pmAmount, 2);
    });

    test('sets only PM amount', () => {
      dietRepo.upsert(horseId, feedId, 1, 2);
      const entry = dietRepo.setPmAmount(horseId, feedId, 5);
      assert.equal(entry.amAmount, 1);
      assert.equal(entry.pmAmount, 5);
    });

    test('lists diet entries for horse', () => {
      const feed2 = feedRepo.create(displayId, 'Barley');
      dietRepo.upsert(horseId, feedId, 2, 1);
      dietRepo.upsert(horseId, feed2.id, 1, 0.5);
      const entries = dietRepo.getByHorseId(horseId);
      assert.equal(entries.length, 2);
    });

    test('lists diet entries for display', () => {
      const horse2 = horseRepo.create(displayId, 'Lightning');
      dietRepo.upsert(horseId, feedId, 2, 1);
      dietRepo.upsert(horse2.id, feedId, 1, 0.5);
      const entries = dietRepo.getByDisplayId(displayId);
      assert.equal(entries.length, 2);
    });

    test('bulk upserts diet entries', () => {
      const feed2 = feedRepo.create(displayId, 'Barley');
      dietRepo.bulkUpsert([
        { horseId, feedId, amAmount: 2, pmAmount: 1 },
        { horseId, feedId: feed2.id, amAmount: 1, pmAmount: null },
      ]);
      const entries = dietRepo.getByHorseId(horseId);
      assert.equal(entries.length, 2);
    });

    test('deletes diet entry', () => {
      dietRepo.upsert(horseId, feedId, 2, 1);
      assert.ok(dietRepo.delete(horseId, feedId));
      assert.equal(dietRepo.get(horseId, feedId), null);
    });

    test('cleans up empty entries', () => {
      dietRepo.upsert(horseId, feedId, null, null);
      const removed = dietRepo.cleanup();
      assert.equal(removed, 1);
      assert.equal(dietRepo.get(horseId, feedId), null);
    });
  });

  describe('CASCADE deletes', () => {
    test('deleting display cascades to horses, feeds, and diet', () => {
      const display = displayRepo.create();
      const horse = horseRepo.create(display.id, 'Thunder');
      const feed = feedRepo.create(display.id, 'Oats');
      dietRepo.upsert(horse.id, feed.id, 2, 1);

      displayRepo.delete(display.id);

      assert.equal(horseRepo.getById(horse.id), null);
      assert.equal(feedRepo.getById(feed.id), null);
      assert.equal(dietRepo.get(horse.id, feed.id), null);
    });

    test('deleting horse cascades to diet entries', () => {
      const display = displayRepo.create();
      const horse = horseRepo.create(display.id, 'Thunder');
      const feed = feedRepo.create(display.id, 'Oats');
      dietRepo.upsert(horse.id, feed.id, 2, 1);

      horseRepo.delete(horse.id);

      assert.equal(dietRepo.get(horse.id, feed.id), null);
      // Feed should still exist
      assert.ok(feedRepo.getById(feed.id));
    });

    test('deleting feed cascades to diet entries', () => {
      const display = displayRepo.create();
      const horse = horseRepo.create(display.id, 'Thunder');
      const feed = feedRepo.create(display.id, 'Oats');
      dietRepo.upsert(horse.id, feed.id, 2, 1);

      feedRepo.delete(feed.id);

      assert.equal(dietRepo.get(horse.id, feed.id), null);
      // Horse should still exist
      assert.ok(horseRepo.getById(horse.id));
    });
  });

  describe('Feed Rankings', () => {
    test('calculates feed rankings based on usage', () => {
      const display = displayRepo.create();
      const horse1 = horseRepo.create(display.id, 'Thunder');
      const horse2 = horseRepo.create(display.id, 'Lightning');
      const horse3 = horseRepo.create(display.id, 'Storm');

      const oats = feedRepo.create(display.id, 'Oats');
      const barley = feedRepo.create(display.id, 'Barley');
      const hay = feedRepo.create(display.id, 'Hay');

      // Oats: used by 3 horses
      dietRepo.upsert(horse1.id, oats.id, 2, 1);
      dietRepo.upsert(horse2.id, oats.id, 1, 0.5);
      dietRepo.upsert(horse3.id, oats.id, 1.5, 1);

      // Barley: used by 2 horses
      dietRepo.upsert(horse1.id, barley.id, 1, null);
      dietRepo.upsert(horse2.id, barley.id, 0.5, 0.5);

      // Hay: used by 1 horse
      dietRepo.upsert(horse1.id, hay.id, 1, 1);

      feedRepo.recalculateRankings(display.id);

      const feeds = feedRepo.getByDisplayId(display.id);
      // Should be ordered by rank (highest first)
      assert.equal(feeds[0].name, 'Oats');
      assert.equal(feeds[1].name, 'Barley');
      assert.equal(feeds[2].name, 'Hay');
    });
  });

  describe('Transactions', () => {
    test('transaction rolls back on error', () => {
      const display = displayRepo.create();

      assert.throws(() => {
        transaction(db, () => {
          horseRepo.create(display.id, 'Thunder');
          throw new Error('Simulated failure');
        });
      });

      // Horse should not exist due to rollback
      const horses = horseRepo.getByDisplayId(display.id);
      assert.equal(horses.length, 0);
    });

    test('transaction commits on success', () => {
      const display = displayRepo.create();

      transaction(db, () => {
        horseRepo.create(display.id, 'Thunder');
        horseRepo.create(display.id, 'Lightning');
      });

      const horses = horseRepo.getByDisplayId(display.id);
      assert.equal(horses.length, 2);
    });
  });
});
