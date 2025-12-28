import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  createRepository,
  SSEManager,
  FeedRankingManager,
  Repository,
} from '@server/lib/engine';
import { ExpiryScheduler } from '@server/scheduler';
import { mountRoutes, RouteContext } from '@server/routes';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './data/horseboard.db';
const SSE_KEEPALIVE_INTERVAL = 30000;

function initializeDatabase(dbPath: string): Database.Database {
  const dataDir = dirname(dbPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const migration1Path = join(__dirname, '../src/server/db/migrations/001_initial_schema.sql');
  const migration1 = readFileSync(migration1Path, 'utf-8');
  db.exec(migration1);

  const migration2Path = join(__dirname, '../src/server/db/migrations/002_rename_display_to_board.sql');
  const migration2 = readFileSync(migration2Path, 'utf-8');
  db.exec(migration2);

  return db;
}

interface ServerContext {
  db: Database.Database;
  app: express.Application;
  sse: SSEManager;
  rankingManager: FeedRankingManager;
  expiryScheduler: ExpiryScheduler;
  repos: {
    boards: Repository<'boards'>;
    horses: Repository<'horses'>;
    feeds: Repository<'feeds'>;
    diet: Repository<'diet'>;
  };
  timers: NodeJS.Timeout[];
}

function createBroadcastHelper(ctx: ServerContext) {
  return function broadcast(boardId: string): void {
    const board = ctx.repos.boards.getById(boardId);
    if (!board) return;

    const horses = ctx.repos.horses.getByParent?.(boardId) ?? [];
    const feeds = ctx.repos.feeds.getByParent?.(boardId) ?? [];
    const diet_entries = ctx.repos.diet.getByBoardId?.(boardId) ?? [];

    ctx.sse.broadcast(boardId, 'full', { board, horses, feeds, diet_entries });
  };
}

function createRepositories(db: Database.Database): ServerContext['repos'] {
  return {
    boards: createRepository(db, 'boards'),
    horses: createRepository(db, 'horses'),
    feeds: createRepository(db, 'feeds'),
    diet: createRepository(db, 'diet'),
  };
}

function startTimers(ctx: ServerContext): void {
  const keepaliveTimer = setInterval(() => {
    ctx.sse.sendKeepalive();
  }, SSE_KEEPALIVE_INTERVAL);

  ctx.timers.push(keepaliveTimer);
}

function setupGracefulShutdown(ctx: ServerContext): void {
  const shutdown = () => {
    console.log('\n[Server] Shutting down gracefully...');

    for (const timer of ctx.timers) {
      clearInterval(timer);
    }

    ctx.expiryScheduler.shutdown();
    ctx.rankingManager.shutdown();
    ctx.db.close();

    console.log('[Server] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function createServer(): ServerContext {
  const db = initializeDatabase(DB_PATH);

  const app = express();
  app.use(cors());
  app.use(express.json());

  const sse = new SSEManager();
  const rankingManager = new FeedRankingManager(db, 500);
  const expiryScheduler = new ExpiryScheduler(db);
  const repos = createRepositories(db);

  const ctx: ServerContext = {
    db,
    app,
    sse,
    rankingManager,
    expiryScheduler,
    repos,
    timers: [],
  };

  const broadcast = createBroadcastHelper(ctx);
  rankingManager.setOnComplete(broadcast);

  const routeContext: RouteContext = {
    db,
    repos,
    broadcast,
    rankingManager,
    expiryScheduler,
  };

  mountRoutes(app, routeContext, sse);

  expiryScheduler.init(repos.boards, repos.horses, broadcast);
  startTimers(ctx);
  setupGracefulShutdown(ctx);

  return ctx;
}

const ctx = createServer();

ctx.app.listen(PORT, () => {
  console.log(`[Server] HorseBoard running on port ${PORT}`);
  console.log(`[Server] Database: ${DB_PATH}`);
  console.log(`[Server] Scheduler stats:`, ctx.expiryScheduler.getStats());
});

export { ctx as serverContext };
export const app = ctx.app;
export const db = ctx.db;
