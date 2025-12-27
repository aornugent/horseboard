import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  mountResource,
  SSEManager,
  FeedRankingManager,
  Repository,
} from '@server/lib/engine';
import { ExpiryScheduler } from '@server/scheduler';

// =============================================================================
// CONFIGURATION
// =============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './data/horseboard.db';
const SSE_KEEPALIVE_INTERVAL = 30000; // 30 seconds

// =============================================================================
// DATABASE INITIALIZATION
// =============================================================================

function initializeDatabase(dbPath: string): Database.Database {
  // Ensure data directory exists
  const dataDir = dirname(dbPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  const migrationPath = join(__dirname, '../src/server/db/migrations/001_initial_schema.sql');
  const migration = readFileSync(migrationPath, 'utf-8');
  db.exec(migration);

  return db;
}

// =============================================================================
// SERVER CONTEXT (dependency injection container)
// =============================================================================

interface ServerContext {
  db: Database.Database;
  app: express.Application;
  sse: SSEManager;
  rankingManager: FeedRankingManager;
  expiryScheduler: ExpiryScheduler;
  repos: {
    displays: Repository<'displays'>;
    horses: Repository<'horses'>;
    feeds: Repository<'feeds'>;
    diet: Repository<'diet'>;
  };
  timers: NodeJS.Timeout[];
}

// =============================================================================
// BROADCAST HELPER FACTORY
// =============================================================================

function createBroadcastHelper(ctx: ServerContext) {
  return function broadcast(displayId: string): void {
    const display = ctx.repos.displays.getById(displayId);
    if (!display) return;

    const horses = ctx.repos.horses.getByParent?.(displayId) ?? [];
    const feeds = ctx.repos.feeds.getByParent?.(displayId) ?? [];
    const dietEntries = ctx.repos.diet.getByDisplayId?.(displayId) ?? [];

    ctx.sse.broadcast(displayId, 'full', { display, horses, feeds, dietEntries });
  };
}

// =============================================================================
// ROUTE MOUNTING
// =============================================================================

function mountResources(ctx: ServerContext, broadcast: (displayId: string) => void): void {
  // Create hooks that use the async ranking manager
  const hooks = {
    scheduleRankingRecalculation: (displayId: string) => {
      ctx.rankingManager.scheduleRecalculation(displayId);
    },
  };

  // Mount resources and store references
  ctx.repos.displays = mountResource(ctx.app, ctx.db, 'displays', { broadcast });
  ctx.repos.horses = mountResource(ctx.app, ctx.db, 'horses', { broadcast });
  ctx.repos.feeds = mountResource(ctx.app, ctx.db, 'feeds', { broadcast, hooks });
  ctx.repos.diet = mountResource(ctx.app, ctx.db, 'diet', {
    broadcast,
    hooks,
    repos: { horses: ctx.repos.horses },
  });
}

function mountSpecialEndpoints(ctx: ServerContext, broadcast: (displayId: string) => void): void {
  const { app, repos } = ctx;

  // Bootstrap - full state for UI hydration
  app.get('/api/bootstrap/:displayId', (req, res) => {
    const display = repos.displays.getById(req.params.displayId);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }

    const horses = repos.horses.getByParent?.(req.params.displayId) ?? [];
    const feeds = repos.feeds.getByParent?.(req.params.displayId) ?? [];
    const dietEntries = repos.diet.getByDisplayId?.(req.params.displayId) ?? [];

    res.json({
      success: true,
      data: { display, horses, feeds, dietEntries },
    });
  });

  // Pair by code - returns full state
  app.get('/api/bootstrap/pair/:code', (req, res) => {
    const display = repos.displays.getByPairCode?.(req.params.code);

    if (!display) {
      return res.status(404).json({ success: false, error: 'Invalid pairing code' });
    }

    const horses = repos.horses.getByParent?.(display.id) ?? [];
    const feeds = repos.feeds.getByParent?.(display.id) ?? [];
    const dietEntries = repos.diet.getByDisplayId?.(display.id) ?? [];

    res.json({
      success: true,
      data: { display, horses, feeds, dietEntries },
    });
  });

  // Time mode update with override
  app.put('/api/displays/:id/time-mode', (req, res) => {
    const { timeMode, overrideUntil } = req.body;

    const existing = repos.displays.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }

    const updated = repos.displays.update(
      { timeMode, overrideUntil: overrideUntil ?? null },
      req.params.id
    );

    // Schedule expiry if override is set
    if (overrideUntil) {
      ctx.expiryScheduler.schedule({
        id: req.params.id,
        displayId: req.params.id,
        expiresAt: new Date(overrideUntil),
        type: 'override',
      });
    } else if (timeMode === 'AUTO') {
      // Cancel any pending override expiry
      ctx.expiryScheduler.cancel(req.params.id, 'override');
    }

    broadcast(req.params.id);
    res.json({ success: true, data: updated });
  });

  // Recalculate feed rankings (explicit, synchronous for immediate feedback)
  app.post('/api/displays/:displayId/feeds/recalculate-rankings', (req, res) => {
    const display = repos.displays.getById(req.params.displayId);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }

    const count = ctx.rankingManager.recalculateNow(req.params.displayId);
    broadcast(req.params.displayId);

    res.json({ success: true, data: { feedsRanked: count } });
  });

  // Health/stats endpoint for monitoring
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        uptime: process.uptime(),
        scheduler: ctx.expiryScheduler.getStats(),
        rankings: ctx.rankingManager.getStats(),
      },
    });
  });
}

function mountSSEEndpoint(ctx: ServerContext): void {
  const { app, repos, sse } = ctx;

  app.get('/api/displays/:displayId/events', (req, res) => {
    const display = repos.displays.getById(req.params.displayId);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Add client to SSE manager
    sse.addClient(req.params.displayId, res);

    // Send initial full state
    const horses = repos.horses.getByParent?.(req.params.displayId) ?? [];
    const feeds = repos.feeds.getByParent?.(req.params.displayId) ?? [];
    const dietEntries = repos.diet.getByDisplayId?.(req.params.displayId) ?? [];

    const initialData = JSON.stringify({
      type: 'full',
      data: { display, horses, feeds, dietEntries },
      timestamp: new Date().toISOString(),
    });

    res.write(`data: ${initialData}\n\n`);
  });
}

// =============================================================================
// TIMER MANAGEMENT
// =============================================================================

function startTimers(ctx: ServerContext): void {
  // SSE keepalive - only timer we still need
  const keepaliveTimer = setInterval(() => {
    ctx.sse.sendKeepalive();
  }, SSE_KEEPALIVE_INTERVAL);

  ctx.timers.push(keepaliveTimer);
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

function setupGracefulShutdown(ctx: ServerContext): void {
  const shutdown = () => {
    console.log('\n[Server] Shutting down gracefully...');

    // Stop all timers
    for (const timer of ctx.timers) {
      clearInterval(timer);
    }

    // Shutdown async managers
    ctx.expiryScheduler.shutdown();
    ctx.rankingManager.shutdown();

    // Close database
    ctx.db.close();

    console.log('[Server] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// =============================================================================
// SERVER FACTORY
// =============================================================================

function createServer(): ServerContext {
  const db = initializeDatabase(DB_PATH);

  const app = express();
  app.use(cors());
  app.use(express.json());

  const sse = new SSEManager();
  const rankingManager = new FeedRankingManager(db, 500); // 500ms debounce
  const expiryScheduler = new ExpiryScheduler(db);

  const ctx: ServerContext = {
    db,
    app,
    sse,
    rankingManager,
    expiryScheduler,
    repos: {} as ServerContext['repos'], // Populated by mountResources
    timers: [],
  };

  // Create broadcast helper with access to context
  const broadcast = createBroadcastHelper(ctx);

  // Set up ranking manager callback to broadcast after async recalculation
  rankingManager.setOnComplete(broadcast);

  // Mount all resources and endpoints
  mountResources(ctx, broadcast);
  mountSpecialEndpoints(ctx, broadcast);
  mountSSEEndpoint(ctx);

  // Initialize scheduler with repositories
  expiryScheduler.init(ctx.repos.displays, ctx.repos.horses, broadcast);

  // Start background timers
  startTimers(ctx);

  // Set up graceful shutdown
  setupGracefulShutdown(ctx);

  return ctx;
}

// =============================================================================
// START SERVER
// =============================================================================

const ctx = createServer();

ctx.app.listen(PORT, () => {
  console.log(`[Server] HorseBoard running on port ${PORT}`);
  console.log(`[Server] Database: ${DB_PATH}`);
  console.log(`[Server] Scheduler stats:`, ctx.expiryScheduler.getStats());
});

export { ctx as serverContext };
export const app = ctx.app;
export const db = ctx.db;
