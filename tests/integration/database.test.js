import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  createBoardsRepository,
  createHorsesRepository,
  createFeedsRepository,
  createDietRepository,
  recalculateFeedRankings,
} from '../../src/server/lib/engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function initializeTestDatabase() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = join(__dirname, '../../src/server/db/migrations/001_initial_schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  return db;
}

describe('Database Integration Tests', () => {
  let db;
  let boardRepo;
  let horseRepo;
  let feedRepo;
  let dietRepo;

  beforeEach(() => {
    db = initializeTestDatabase();
    boardRepo = createBoardsRepository(db);
    horseRepo = createHorsesRepository(db);
    feedRepo = createFeedsRepository(db);
    dietRepo = createDietRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('BoardRepository', () => {
    test('creates a board with unique ID and pair code', () => {
      const board = boardRepo.create({});
      assert.ok(board.id.startsWith('b_'));
      assert.ok(/^\d{6}$/.test(board.pair_code));
    });

    test('retrieves board by ID', () => {
      const created = boardRepo.create({});
      const board = boardRepo.getById(created.id);
      assert.equal(board.id, created.id);
      assert.equal(board.pair_code, created.pair_code);
      assert.equal(board.time_mode, 'AUTO');
      assert.equal(board.zoom_level, 2);
    });

    test('updates board settings', () => {
      const created = boardRepo.create({});
      boardRepo.update({ zoom_level: 3, current_page: 1 }, created.id);
      const board = boardRepo.getById(created.id);
      assert.equal(board.zoom_level, 3);
      assert.equal(board.current_page, 1);
    });

    test('deletes board', () => {
      const created = boardRepo.create({});
      assert.ok(boardRepo.delete(created.id));
      assert.equal(boardRepo.getById(created.id), null);
    });
  });

  describe('HorseRepository', () => {
    let boardId;

    beforeEach(() => {
      const board = boardRepo.create({});
      boardId = board.id;
    });

    test('creates a horse', () => {
      const horse = horseRepo.create({ name: 'Thunder' }, boardId);
      assert.ok(horse.id.startsWith('h_'));
      assert.equal(horse.name, 'Thunder');
      assert.equal(horse.board_id, boardId);
    });

    test('creates horse with note', () => {
      const note_expiry = new Date(Date.now() + 86400000).toISOString();
      const horse = horseRepo.create(
        { name: 'Storm', note: 'Needs extra hay', note_expiry },
        boardId
      );
      assert.equal(horse.note, 'Needs extra hay');
      assert.equal(horse.note_expiry, note_expiry);
    });

    test('lists horses for board', () => {
      horseRepo.create({ name: 'Thunder' }, boardId);
      horseRepo.create({ name: 'Lightning' }, boardId);
      const horses = horseRepo.getByParent(boardId);
      assert.equal(horses.length, 2);
    });

    test('updates horse', () => {
      const created = horseRepo.create({ name: 'Thunder' }, boardId);
      horseRepo.update({ name: 'Thunder II', note: 'Updated' }, created.id);
      const horse = horseRepo.getById(created.id);
      assert.equal(horse.name, 'Thunder II');
      assert.equal(horse.note, 'Updated');
    });

    test('deletes horse', () => {
      const created = horseRepo.create({ name: 'Thunder' }, boardId);
      assert.ok(horseRepo.delete(created.id));
      assert.equal(horseRepo.getById(created.id), null);
    });
  });

  describe('FeedRepository', () => {
    let boardId;

    beforeEach(() => {
      const board = boardRepo.create({});
      boardId = board.id;
    });

    test('creates a feed', () => {
      const feed = feedRepo.create({ name: 'Oats', unit: 'scoop' }, boardId);
      assert.ok(feed.id.startsWith('f_'));
      assert.equal(feed.name, 'Oats');
      assert.equal(feed.unit, 'scoop');
    });

    test('lists feeds for board', () => {
      feedRepo.create({ name: 'Oats' }, boardId);
      feedRepo.create({ name: 'Barley' }, boardId);
      const feeds = feedRepo.getByParent(boardId);
      assert.equal(feeds.length, 2);
    });

    test('updates feed', () => {
      const created = feedRepo.create({ name: 'Oats' }, boardId);
      feedRepo.update({ unit: 'ml', stock_level: 100 }, created.id);
      const feed = feedRepo.getById(created.id);
      assert.equal(feed.unit, 'ml');
      assert.equal(feed.stock_level, 100);
    });

    test('deletes feed', () => {
      const created = feedRepo.create({ name: 'Oats' }, boardId);
      assert.ok(feedRepo.delete(created.id));
      assert.equal(feedRepo.getById(created.id), null);
    });
  });

  describe('DietEntryRepository', () => {
    let boardId;
    let horseId;
    let feedId;

    beforeEach(() => {
      const board = boardRepo.create({});
      boardId = board.id;
      const horse = horseRepo.create({ name: 'Thunder' }, boardId);
      horseId = horse.id;
      const feed = feedRepo.create({ name: 'Oats' }, boardId);
      feedId = feed.id;
    });

    test('creates diet entry', () => {
      const entry = dietRepo.upsert({ horse_id: horseId, feed_id: feedId, am_amount: 2, pm_amount: 1.5 });
      assert.equal(entry.horse_id, horseId);
      assert.equal(entry.feed_id, feedId);
      assert.equal(entry.am_amount, 2);
      assert.equal(entry.pm_amount, 1.5);
    });

    test('upserts diet entry (update existing)', () => {
      dietRepo.upsert({ horse_id: horseId, feed_id: feedId, am_amount: 2, pm_amount: 1.5 });
      const entry = dietRepo.upsert({ horse_id: horseId, feed_id: feedId, am_amount: 3, pm_amount: 2 });
      assert.equal(entry.am_amount, 3);
      assert.equal(entry.pm_amount, 2);
    });

    test('lists diet entries for board', () => {
      const horse2 = horseRepo.create({ name: 'Lightning' }, boardId);
      dietRepo.upsert({ horse_id: horseId, feed_id: feedId, am_amount: 2, pm_amount: 1 });
      dietRepo.upsert({ horse_id: horse2.id, feed_id: feedId, am_amount: 1, pm_amount: 0.5 });
      const entries = dietRepo.getByBoardId(boardId);
      assert.equal(entries.length, 2);
    });

    test('deletes diet entry', () => {
      dietRepo.upsert({ horse_id: horseId, feed_id: feedId, am_amount: 2, pm_amount: 1 });
      assert.ok(dietRepo.delete(horseId, feedId));
      assert.equal(dietRepo.getById(horseId, feedId), null);
    });
  });

  describe('CASCADE deletes', () => {
    test('deleting board cascades to horses, feeds, and diet', () => {
      const board = boardRepo.create({});
      const horse = horseRepo.create({ name: 'Thunder' }, board.id);
      const feed = feedRepo.create({ name: 'Oats' }, board.id);
      dietRepo.upsert({ horse_id: horse.id, feed_id: feed.id, am_amount: 2, pm_amount: 1 });

      boardRepo.delete(board.id);

      assert.equal(horseRepo.getById(horse.id), null);
      assert.equal(feedRepo.getById(feed.id), null);
      assert.equal(dietRepo.getById(horse.id, feed.id), null);
    });

    test('deleting horse cascades to diet entries', () => {
      const board = boardRepo.create({});
      const horse = horseRepo.create({ name: 'Thunder' }, board.id);
      const feed = feedRepo.create({ name: 'Oats' }, board.id);
      dietRepo.upsert({ horse_id: horse.id, feed_id: feed.id, am_amount: 2, pm_amount: 1 });

      horseRepo.delete(horse.id);

      assert.equal(dietRepo.getById(horse.id, feed.id), null);
      // Feed should still exist
      assert.ok(feedRepo.getById(feed.id));
    });

    test('deleting feed cascades to diet entries', () => {
      const board = boardRepo.create({});
      const horse = horseRepo.create({ name: 'Thunder' }, board.id);
      const feed = feedRepo.create({ name: 'Oats' }, board.id);
      dietRepo.upsert({ horse_id: horse.id, feed_id: feed.id, am_amount: 2, pm_amount: 1 });

      feedRepo.delete(feed.id);

      assert.equal(dietRepo.getById(horse.id, feed.id), null);
      // Horse should still exist
      assert.ok(horseRepo.getById(horse.id));
    });
  });

  describe('Feed Rankings', () => {
    test('calculates feed rankings based on usage', () => {
      const board = boardRepo.create({});
      const horse1 = horseRepo.create({ name: 'Thunder' }, board.id);
      const horse2 = horseRepo.create({ name: 'Lightning' }, board.id);
      const horse3 = horseRepo.create({ name: 'Storm' }, board.id);

      const oats = feedRepo.create({ name: 'Oats' }, board.id);
      const barley = feedRepo.create({ name: 'Barley' }, board.id);
      const hay = feedRepo.create({ name: 'Hay' }, board.id);

      // Oats: used by 3 horses
      dietRepo.upsert({ horse_id: horse1.id, feed_id: oats.id, am_amount: 2, pm_amount: 1 });
      dietRepo.upsert({ horse_id: horse2.id, feed_id: oats.id, am_amount: 1, pm_amount: 0.5 });
      dietRepo.upsert({ horse_id: horse3.id, feed_id: oats.id, am_amount: 1.5, pm_amount: 1 });

      // Barley: used by 2 horses
      dietRepo.upsert({ horse_id: horse1.id, feed_id: barley.id, am_amount: 1, pm_amount: null });
      dietRepo.upsert({ horse_id: horse2.id, feed_id: barley.id, am_amount: 0.5, pm_amount: 0.5 });

      // Hay: used by 1 horse
      dietRepo.upsert({ horse_id: horse1.id, feed_id: hay.id, am_amount: 1, pm_amount: 1 });

      recalculateFeedRankings(db, board.id);

      const feeds = feedRepo.getByParent(board.id);
      // Should be ordered by rank DESC
      assert.equal(feeds[0].name, 'Oats');
      assert.equal(feeds[1].name, 'Barley');
      assert.equal(feeds[2].name, 'Hay');
    });
  });
});
