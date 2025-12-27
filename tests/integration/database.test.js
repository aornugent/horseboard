import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRepository, recalculateFeedRankings } from '../../src/server/lib/engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function initializeTestDatabase() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const migrationPath = join(__dirname, '../../src/server/db/migrations/001_initial_schema.sql');
  const migration = readFileSync(migrationPath, 'utf-8');
  db.exec(migration);

  return db;
}

describe('Database Integration Tests', () => {
  let db;
  let displayRepo;
  let horseRepo;
  let feedRepo;
  let dietRepo;

  beforeEach(() => {
    db = initializeTestDatabase();
    displayRepo = createRepository(db, 'displays');
    horseRepo = createRepository(db, 'horses');
    feedRepo = createRepository(db, 'feeds');
    dietRepo = createRepository(db, 'diet');
  });

  afterEach(() => {
    db.close();
  });

  describe('DisplayRepository', () => {
    test('creates a display with unique ID and pair code', () => {
      const display = displayRepo.create({});
      assert.ok(display.id.startsWith('d_'));
      assert.ok(/^\d{6}$/.test(display.pairCode));
    });

    test('retrieves display by ID', () => {
      const created = displayRepo.create({});
      const display = displayRepo.getById(created.id);
      assert.equal(display.id, created.id);
      assert.equal(display.pairCode, created.pairCode);
      assert.equal(display.timeMode, 'AUTO');
      assert.equal(display.zoomLevel, 2);
    });

    test('updates display settings', () => {
      const created = displayRepo.create({});
      displayRepo.update({ zoomLevel: 3, currentPage: 1 }, created.id);
      const display = displayRepo.getById(created.id);
      assert.equal(display.zoomLevel, 3);
      assert.equal(display.currentPage, 1);
    });

    test('deletes display', () => {
      const created = displayRepo.create({});
      assert.ok(displayRepo.delete(created.id));
      assert.equal(displayRepo.getById(created.id), null);
    });
  });

  describe('HorseRepository', () => {
    let displayId;

    beforeEach(() => {
      const display = displayRepo.create({});
      displayId = display.id;
    });

    test('creates a horse', () => {
      const horse = horseRepo.create({ name: 'Thunder' }, displayId);
      assert.ok(horse.id.startsWith('h_'));
      assert.equal(horse.name, 'Thunder');
      assert.equal(horse.displayId, displayId);
    });

    test('creates horse with note', () => {
      const noteExpiry = new Date(Date.now() + 86400000).toISOString();
      const horse = horseRepo.create(
        { name: 'Storm', note: 'Needs extra hay', noteExpiry },
        displayId
      );
      assert.equal(horse.note, 'Needs extra hay');
      assert.equal(horse.noteExpiry, noteExpiry);
    });

    test('lists horses for display', () => {
      horseRepo.create({ name: 'Thunder' }, displayId);
      horseRepo.create({ name: 'Lightning' }, displayId);
      const horses = horseRepo.getByParent(displayId);
      assert.equal(horses.length, 2);
    });

    test('updates horse', () => {
      const created = horseRepo.create({ name: 'Thunder' }, displayId);
      horseRepo.update({ name: 'Thunder II', note: 'Updated' }, created.id);
      const horse = horseRepo.getById(created.id);
      assert.equal(horse.name, 'Thunder II');
      assert.equal(horse.note, 'Updated');
    });

    test('deletes horse', () => {
      const created = horseRepo.create({ name: 'Thunder' }, displayId);
      assert.ok(horseRepo.delete(created.id));
      assert.equal(horseRepo.getById(created.id), null);
    });
  });

  describe('FeedRepository', () => {
    let displayId;

    beforeEach(() => {
      const display = displayRepo.create({});
      displayId = display.id;
    });

    test('creates a feed', () => {
      const feed = feedRepo.create({ name: 'Oats', unit: 'scoop' }, displayId);
      assert.ok(feed.id.startsWith('f_'));
      assert.equal(feed.name, 'Oats');
      assert.equal(feed.unit, 'scoop');
    });

    test('lists feeds for display', () => {
      feedRepo.create({ name: 'Oats' }, displayId);
      feedRepo.create({ name: 'Barley' }, displayId);
      const feeds = feedRepo.getByParent(displayId);
      assert.equal(feeds.length, 2);
    });

    test('updates feed', () => {
      const created = feedRepo.create({ name: 'Oats' }, displayId);
      feedRepo.update({ unit: 'ml', stockLevel: 100 }, created.id);
      const feed = feedRepo.getById(created.id);
      assert.equal(feed.unit, 'ml');
      assert.equal(feed.stockLevel, 100);
    });

    test('deletes feed', () => {
      const created = feedRepo.create({ name: 'Oats' }, displayId);
      assert.ok(feedRepo.delete(created.id));
      assert.equal(feedRepo.getById(created.id), null);
    });
  });

  describe('DietEntryRepository', () => {
    let displayId;
    let horseId;
    let feedId;

    beforeEach(() => {
      const display = displayRepo.create({});
      displayId = display.id;
      const horse = horseRepo.create({ name: 'Thunder' }, displayId);
      horseId = horse.id;
      const feed = feedRepo.create({ name: 'Oats' }, displayId);
      feedId = feed.id;
    });

    test('creates diet entry', () => {
      const entry = dietRepo.upsert({ horseId, feedId, amAmount: 2, pmAmount: 1.5 });
      assert.equal(entry.horseId, horseId);
      assert.equal(entry.feedId, feedId);
      assert.equal(entry.amAmount, 2);
      assert.equal(entry.pmAmount, 1.5);
    });

    test('upserts diet entry (update existing)', () => {
      dietRepo.upsert({ horseId, feedId, amAmount: 2, pmAmount: 1.5 });
      const entry = dietRepo.upsert({ horseId, feedId, amAmount: 3, pmAmount: 2 });
      assert.equal(entry.amAmount, 3);
      assert.equal(entry.pmAmount, 2);
    });

    test('lists diet entries for display', () => {
      const horse2 = horseRepo.create({ name: 'Lightning' }, displayId);
      dietRepo.upsert({ horseId, feedId, amAmount: 2, pmAmount: 1 });
      dietRepo.upsert({ horseId: horse2.id, feedId, amAmount: 1, pmAmount: 0.5 });
      const entries = dietRepo.getByDisplayId(displayId);
      assert.equal(entries.length, 2);
    });

    test('deletes diet entry', () => {
      dietRepo.upsert({ horseId, feedId, amAmount: 2, pmAmount: 1 });
      assert.ok(dietRepo.delete(horseId, feedId));
      assert.equal(dietRepo.getById(horseId, feedId), null);
    });
  });

  describe('CASCADE deletes', () => {
    test('deleting display cascades to horses, feeds, and diet', () => {
      const display = displayRepo.create({});
      const horse = horseRepo.create({ name: 'Thunder' }, display.id);
      const feed = feedRepo.create({ name: 'Oats' }, display.id);
      dietRepo.upsert({ horseId: horse.id, feedId: feed.id, amAmount: 2, pmAmount: 1 });

      displayRepo.delete(display.id);

      assert.equal(horseRepo.getById(horse.id), null);
      assert.equal(feedRepo.getById(feed.id), null);
      assert.equal(dietRepo.getById(horse.id, feed.id), null);
    });

    test('deleting horse cascades to diet entries', () => {
      const display = displayRepo.create({});
      const horse = horseRepo.create({ name: 'Thunder' }, display.id);
      const feed = feedRepo.create({ name: 'Oats' }, display.id);
      dietRepo.upsert({ horseId: horse.id, feedId: feed.id, amAmount: 2, pmAmount: 1 });

      horseRepo.delete(horse.id);

      assert.equal(dietRepo.getById(horse.id, feed.id), null);
      // Feed should still exist
      assert.ok(feedRepo.getById(feed.id));
    });

    test('deleting feed cascades to diet entries', () => {
      const display = displayRepo.create({});
      const horse = horseRepo.create({ name: 'Thunder' }, display.id);
      const feed = feedRepo.create({ name: 'Oats' }, display.id);
      dietRepo.upsert({ horseId: horse.id, feedId: feed.id, amAmount: 2, pmAmount: 1 });

      feedRepo.delete(feed.id);

      assert.equal(dietRepo.getById(horse.id, feed.id), null);
      // Horse should still exist
      assert.ok(horseRepo.getById(horse.id));
    });
  });

  describe('Feed Rankings', () => {
    test('calculates feed rankings based on usage', () => {
      const display = displayRepo.create({});
      const horse1 = horseRepo.create({ name: 'Thunder' }, display.id);
      const horse2 = horseRepo.create({ name: 'Lightning' }, display.id);
      const horse3 = horseRepo.create({ name: 'Storm' }, display.id);

      const oats = feedRepo.create({ name: 'Oats' }, display.id);
      const barley = feedRepo.create({ name: 'Barley' }, display.id);
      const hay = feedRepo.create({ name: 'Hay' }, display.id);

      // Oats: used by 3 horses
      dietRepo.upsert({ horseId: horse1.id, feedId: oats.id, amAmount: 2, pmAmount: 1 });
      dietRepo.upsert({ horseId: horse2.id, feedId: oats.id, amAmount: 1, pmAmount: 0.5 });
      dietRepo.upsert({ horseId: horse3.id, feedId: oats.id, amAmount: 1.5, pmAmount: 1 });

      // Barley: used by 2 horses
      dietRepo.upsert({ horseId: horse1.id, feedId: barley.id, amAmount: 1, pmAmount: null });
      dietRepo.upsert({ horseId: horse2.id, feedId: barley.id, amAmount: 0.5, pmAmount: 0.5 });

      // Hay: used by 1 horse
      dietRepo.upsert({ horseId: horse1.id, feedId: hay.id, amAmount: 1, pmAmount: 1 });

      recalculateFeedRankings(db, display.id);

      const feeds = feedRepo.getByParent(display.id);
      // Should be ordered by rank DESC
      assert.equal(feeds[0].name, 'Oats');
      assert.equal(feeds[1].name, 'Barley');
      assert.equal(feeds[2].name, 'Hay');
    });
  });
});
