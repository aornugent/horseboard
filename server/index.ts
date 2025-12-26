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

// Broadcast helper for resources
const broadcast = (displayId, type) => {
  // Refresh all data for this display
  const displayRepo = createRepository(db, 'displays');
  const horseRepo = createRepository(db, 'horses');
  const feedRepo = createRepository(db, 'feeds');
  const dietRepo = createRepository(db, 'diet');

  const display = displayRepo.getById(displayId);
  if (!display) return;

  const horses = horseRepo.getByParent(displayId);
  const feeds = feedRepo.getByParent(displayId);
  const diet = dietRepo.getByDisplayId(displayId);

  sse.broadcast(displayId, 'full', { display, horses, feeds, diet });
};

// Hooks for business logic
const hooks = {
  recalculateFeedRankings: (database, displayId) => {
    recalculateFeedRankings(database, displayId);
  },
};

// =============================================================================
// MOUNT RESOURCES
// =============================================================================

const displayRepo = mountResource(app, db, 'displays', { broadcast });
const horseRepo = mountResource(app, db, 'horses', { broadcast });
const feedRepo = mountResource(app, db, 'feeds', { broadcast, hooks });
const dietRepo = mountResource(app, db, 'diet', { broadcast, hooks });

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
  const diet = dietRepo.getByDisplayId(req.params.displayId);

  res.json({
    success: true,
    data: { display, horses, feeds, diet },
  });
});

// Pair by code - returns full state
app.get('/api/bootstrap/pair/:code', (req, res) => {
  const display = db
    .prepare(
      `SELECT id, pair_code, timezone, time_mode, override_until,
              zoom_level, current_page, created_at, updated_at
       FROM displays WHERE pair_code = ?`
    )
    .get(req.params.code);

  if (!display) {
    return res.status(404).json({ success: false, error: 'Invalid pairing code' });
  }

  // Transform to API format
  const displayData = {
    id: display.id,
    pairCode: display.pair_code,
    timezone: display.timezone,
    timeMode: display.time_mode,
    overrideUntil: display.override_until,
    zoomLevel: display.zoom_level,
    currentPage: display.current_page,
    createdAt: display.created_at,
    updatedAt: display.updated_at,
  };

  const horses = horseRepo.getByParent(display.id);
  const feeds = feedRepo.getByParent(display.id);
  const diet = dietRepo.getByDisplayId(display.id);

  res.json({
    success: true,
    data: { display: displayData, horses, feeds, diet },
  });
});

// Time mode update with override
app.put('/api/displays/:id/time-mode', (req, res) => {
  const { timeMode, overrideUntil } = req.body;

  const existing = displayRepo.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Display not found' });
  }

  db.prepare(
    `UPDATE displays SET time_mode = ?, override_until = ? WHERE id = ?`
  ).run(timeMode, overrideUntil ?? null, req.params.id);

  const updated = displayRepo.getById(req.params.id);
  broadcast(req.params.id, 'settings');

  res.json({ success: true, data: updated });
});

// Recalculate feed rankings
app.post('/api/displays/:displayId/feeds/recalculate-rankings', (req, res) => {
  const display = displayRepo.getById(req.params.displayId);
  if (!display) {
    return res.status(404).json({ success: false, error: 'Display not found' });
  }

  const count = recalculateFeedRankings(db, req.params.displayId);
  broadcast(req.params.displayId, 'feeds');

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
  const diet = dietRepo.getByDisplayId(req.params.displayId);

  const initialData = JSON.stringify({
    type: 'full',
    data: { display, horses, feeds, diet },
    timestamp: new Date().toISOString(),
  });

  res.write(`data: ${initialData}\n\n`);
});

// =============================================================================
// SCHEDULED TASKS
// =============================================================================

// Check for expired time mode overrides every minute
setInterval(() => {
  const expired = db
    .prepare(
      `SELECT id FROM displays
       WHERE time_mode != 'AUTO' AND override_until < datetime('now')`
    )
    .all();

  for (const { id } of expired) {
    db.prepare(
      `UPDATE displays SET time_mode = 'AUTO', override_until = NULL WHERE id = ?`
    ).run(id);
    broadcast(id, 'settings');
  }
}, 60000);

// Check for expired notes every hour
setInterval(() => {
  const expired = db
    .prepare(
      `SELECT id, display_id FROM horses
       WHERE note IS NOT NULL AND note_expiry < datetime('now')`
    )
    .all();

  for (const { id, display_id } of expired) {
    db.prepare(`UPDATE horses SET note = NULL, note_expiry = NULL WHERE id = ?`).run(id);
    broadcast(display_id, 'horses');
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
