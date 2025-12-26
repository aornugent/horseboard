import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  mountResource,
  createRepository,
  SSEManager,
  recalculateFeedRankings,
} from '@server/lib/engine';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './data/horseboard.db';

// Ensure data directory exists
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migrations
const migrationPath = join(__dirname, '../src/server/db/migrations/001_initial_schema.sql');
const migration = readFileSync(migrationPath, 'utf-8');
db.exec(migration);

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// SSE Manager for real-time updates
const sse = new SSEManager();

// Hooks for business logic
const hooks = {
  recalculateFeedRankings: (database, displayId) => {
    recalculateFeedRankings(database, displayId);
  },
};

// =============================================================================
// MOUNT RESOURCES (creates repositories once at startup)
// =============================================================================

// Forward declaration for broadcast - repos defined below
let displayRepo, horseRepo, feedRepo, dietRepo;

// Broadcast helper for resources - reuses module-scoped repositories
const broadcast = (displayId) => {
  const display = displayRepo.getById(displayId);
  if (!display) return;

  const horses = horseRepo.getByParent(displayId);
  const feeds = feedRepo.getByParent(displayId);
  const dietEntries = dietRepo.getByDisplayId(displayId);

  sse.broadcast(displayId, 'full', { display, horses, feeds, dietEntries });
};

// Mount resources and assign to module-scoped variables
displayRepo = mountResource(app, db, 'displays', { broadcast });
horseRepo = mountResource(app, db, 'horses', { broadcast });
feedRepo = mountResource(app, db, 'feeds', { broadcast, hooks });
dietRepo = mountResource(app, db, 'diet', { broadcast, hooks, repos: { horses: horseRepo } });

// =============================================================================
// SPECIAL ENDPOINTS
// =============================================================================

// Bootstrap - full state for UI hydration
app.get('/api/bootstrap/:displayId', (req, res) => {
  const display = displayRepo.getById(req.params.displayId);
  if (!display) {
    return res.status(404).json({ success: false, error: 'Display not found' });
  }

  const horses = horseRepo.getByParent(req.params.displayId);
  const feeds = feedRepo.getByParent(req.params.displayId);
  const dietEntries = dietRepo.getByDisplayId(req.params.displayId);

  res.json({
    success: true,
    data: { display, horses, feeds, dietEntries },
  });
});

// Pair by code - returns full state
app.get('/api/bootstrap/pair/:code', (req, res) => {
  const display = displayRepo.getByPairCode(req.params.code);

  if (!display) {
    return res.status(404).json({ success: false, error: 'Invalid pairing code' });
  }

  const horses = horseRepo.getByParent(display.id);
  const feeds = feedRepo.getByParent(display.id);
  const dietEntries = dietRepo.getByDisplayId(display.id);

  res.json({
    success: true,
    data: { display, horses, feeds, dietEntries },
  });
});

// Time mode update with override
app.put('/api/displays/:id/time-mode', (req, res) => {
  const { timeMode, overrideUntil } = req.body;

  const existing = displayRepo.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Display not found' });
  }

  const updated = displayRepo.update(
    { timeMode, overrideUntil: overrideUntil ?? null },
    req.params.id
  );
  broadcast(req.params.id);

  res.json({ success: true, data: updated });
});

// Recalculate feed rankings
app.post('/api/displays/:displayId/feeds/recalculate-rankings', (req, res) => {
  const display = displayRepo.getById(req.params.displayId);
  if (!display) {
    return res.status(404).json({ success: false, error: 'Display not found' });
  }

  const count = recalculateFeedRankings(db, req.params.displayId);
  broadcast(req.params.displayId);

  res.json({ success: true, data: { feedsRanked: count } });
});

// =============================================================================
// SSE ENDPOINT
// =============================================================================

app.get('/api/displays/:displayId/events', (req, res) => {
  const display = displayRepo.getById(req.params.displayId);
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
  const horses = horseRepo.getByParent(req.params.displayId);
  const feeds = feedRepo.getByParent(req.params.displayId);
  const dietEntries = dietRepo.getByDisplayId(req.params.displayId);

  const initialData = JSON.stringify({
    type: 'full',
    data: { display, horses, feeds, dietEntries },
    timestamp: new Date().toISOString(),
  });

  res.write(`data: ${initialData}\n\n`);
});

// =============================================================================
// SCHEDULED TASKS
// =============================================================================

// Check for expired time mode overrides every minute
setInterval(() => {
  // Query for expired overrides (internal task, raw SQL acceptable)
  const expired = db
    .prepare(
      `SELECT id FROM displays
       WHERE time_mode != 'AUTO' AND override_until < datetime('now')`
    )
    .all();

  for (const { id } of expired) {
    displayRepo.update({ timeMode: 'AUTO', overrideUntil: null }, id);
    broadcast(id);
  }
}, 60000);

// Check for expired notes every hour
setInterval(() => {
  // Query for expired notes (internal task, raw SQL acceptable)
  const expired = db
    .prepare(
      `SELECT id, display_id FROM horses
       WHERE note IS NOT NULL AND note_expiry < datetime('now')`
    )
    .all();

  for (const { id, display_id } of expired) {
    horseRepo.update({ note: null, noteExpiry: null }, id);
    broadcast(display_id);
  }
}, 3600000);

// SSE keepalive every 30 seconds
setInterval(() => {
  sse.sendKeepalive();
}, 30000);

// =============================================================================
// START SERVER
// =============================================================================

app.listen(PORT, () => {
  console.log(`HorseBoard server running on port ${PORT}`);
});

export { app, db };
