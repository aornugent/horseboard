
import test, { describe, it, before } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createBoardsRouter } from '../../src/server/routes/boards';
import { createBoardsRepository, createHorsesRepository, createFeedsRepository, createDietRepository, createControllerTokensRepository, SSEManager } from '../../src/server/lib/engine';
import { FeedRankingManager } from '../../src/server/lib/rankings';
import { ExpiryScheduler } from '../../src/server/scheduler';
import { resolveAuth } from '../../src/server/lib/auth'; // We'll mock this or middleware

const db = new Database(':memory:');
// Initialize schema
db.exec(`
  CREATE TABLE boards (
    id TEXT PRIMARY KEY,
    pair_code TEXT UNIQUE,
    timezone TEXT DEFAULT 'Australia/Sydney',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    time_mode TEXT DEFAULT 'AUTO',
    override_until DATETIME,
    zoom_level INTEGER DEFAULT 1,
    current_page INTEGER DEFAULT 0,
    account_id TEXT
  );
  CREATE TABLE horses (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    name TEXT NOT NULL,
    note TEXT,
    note_expiry DATETIME,
    archived BOOLEAN DEFAULT 0,
    order_idx INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(board_id) REFERENCES boards(id)
  );
  CREATE TABLE feeds (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT,
    rank INTEGER DEFAULT 0,
    stock_level REAL DEFAULT 0,
    low_stock_threshold REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(board_id) REFERENCES boards(id)
  );

  CREATE TABLE diet_entries (
    horse_id TEXT NOT NULL,
    feed_id TEXT NOT NULL,
    am_amount REAL,
    pm_amount REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (horse_id, feed_id),
    FOREIGN KEY(horse_id) REFERENCES horses(id),
    FOREIGN KEY(feed_id) REFERENCES feeds(id)
  );

  CREATE TABLE controller_tokens (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    permission TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    last_used_at DATETIME,
    FOREIGN KEY(board_id) REFERENCES boards(id)
  );
  -- Minimal schema for what we need
`);

const repos = {
    boards: createBoardsRepository(db),
    horses: createHorsesRepository(db),
    feeds: createFeedsRepository(db),
    diet: createDietRepository(db),
    controllerTokens: createControllerTokensRepository(db),
};

const app = express();
app.use(express.json());

// Mock middleware to inject context
app.use((req, res, next) => {
    (req as any).context = {
        db,
        repos,
        broadcast: () => { },
        expiryScheduler: { schedule: () => { }, cancel: () => { } }
    };
    next();
});

const router = createBoardsRouter({
    db,
    repos,
    broadcast: () => { },
    expiryScheduler: { schedule: () => { }, cancel: () => { } } as any,
    rankingManager: {} as any
});
app.use('/api/boards', router);

describe('Board Claiming Flow', () => {
    let boardId: string;

    it('should create a board', async () => {
        const res = await request(app)
            .post('/api/boards')
            .send({ timezone: 'UTC' });

        assert.strictEqual(res.status, 201);
        boardId = res.body.data.id;
        assert.ok(boardId);
        assert.strictEqual(res.body.data.account_id, null);
    });

    it('should fail to claim without authentication', async () => {
        const res = await request(app)
            .post(`/api/boards/${boardId}/claim`);

        assert.strictEqual(res.status, 401);
    });

    it('should claim an unclaimed board when authenticated', async () => {
        const res = await request(app)
            .post(`/api/boards/${boardId}/claim`)
            .set('x-test-user-id', 'user_123');

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.data.account_id, 'user_123');
        assert.strictEqual(res.body.data.id, boardId);

        // Verify in DB
        const board = repos.boards.getById(boardId);
        assert.strictEqual(board?.account_id, 'user_123');
    });

    it('should fail to claim an already claimed board', async () => {
        const res = await request(app)
            .post(`/api/boards/${boardId}/claim`)
            .set('x-test-user-id', 'user_456');

        assert.strictEqual(res.status, 409);
    });
});
