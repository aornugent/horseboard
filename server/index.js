import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DisplayDatabase } from './db/sqlite.js';
import { DisplayService } from './services/display.js';
import { TimeModeService } from './services/timeMode.js';
import { NoteExpiryService } from './services/noteExpiry.js';
import { SSEManager } from './api/sse.js';
import { createRoutes } from './api/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create and configure Express app
 */
export function createApp(options = {}) {
  const app = express();

  // Database setup
  const dbPath = options.dbPath || process.env.DB_PATH || './data/horseboard.db';
  const db = new DisplayDatabase(dbPath);
  db.initialize();

  // Services
  const displayService = new DisplayService(db);
  const sseManager = new SSEManager();
  const timeModeService = new TimeModeService(displayService, sseManager);
  const noteExpiryService = new NoteExpiryService(displayService, sseManager);

  // Store references for testing
  app.set('db', db);
  app.set('displayService', displayService);
  app.set('sseManager', sseManager);
  app.set('timeModeService', timeModeService);
  app.set('noteExpiryService', noteExpiryService);

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', createRoutes(displayService, sseManager, timeModeService));

  // Static files for client apps
  const clientPath = join(__dirname, '..', 'client');
  app.use('/display', express.static(join(clientPath, 'display')));
  app.use('/controller', express.static(join(clientPath, 'controller')));

  // Serve index.html for client routes
  app.get('/display', (req, res) => {
    res.sendFile(join(clientPath, 'display', 'index.html'));
  });

  app.get('/controller', (req, res) => {
    res.sendFile(join(clientPath, 'controller', 'index.html'));
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

/**
 * Start the server
 */
export function startServer(options = {}) {
  const port = options.port || process.env.PORT || 3000;
  const app = createApp(options);

  // Start time mode override expiry check
  const timeModeService = app.get('timeModeService');
  const noteExpiryService = app.get('noteExpiryService');
  const db = app.get('db');

  // Start minute-interval check for override expiry
  const overrideCheckInterval = setInterval(() => {
    // Get all display IDs from SSE clients
    const sseManager = app.get('sseManager');
    const displayIds = Array.from(sseManager.clients.keys());

    for (const displayId of displayIds) {
      timeModeService.checkDisplayForExpiry(displayId);
    }
  }, 60000); // Check every minute

  // Start hourly check for expired notes
  const noteExpiryInterval = setInterval(() => {
    const sseManager = app.get('sseManager');
    const displayIds = Array.from(sseManager.clients.keys());

    for (const displayId of displayIds) {
      noteExpiryService.checkAndClearExpiredNotes(displayId);
    }
  }, 3600000); // Check every hour

  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`  Display: http://localhost:${port}/display`);
    console.log(`  Controller: http://localhost:${port}/controller`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    clearInterval(overrideCheckInterval);
    clearInterval(noteExpiryInterval);
    server.close(() => {
      app.get('db').close();
      process.exit(0);
    });
  });

  return server;
}

// Start server if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}

export default { createApp, startServer };
