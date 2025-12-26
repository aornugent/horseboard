import { Router } from 'express';
import { RESOURCES } from '../../shared/resources.js';

/**
 * Generate a unique ID with prefix
 */
export function generateId(prefix = 'd') {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${hex}`;
}

/**
 * Generate a unique 6-digit pairing code
 */
export function generatePairCode(db) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const existing = db.prepare('SELECT 1 FROM displays WHERE pair_code = ?').get(code);
  if (existing) {
    return generatePairCode(db);
  }
  return code;
}

/**
 * Convert snake_case to camelCase
 */
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Transform database row to API format using column mapping
 */
function toApiFormat(row, columns) {
  if (!row) return null;
  const result = {};
  for (const [camel, snake] of Object.entries(columns)) {
    if (snake in row) {
      let value = row[snake];
      // Convert SQLite integer booleans
      if (camel === 'archived') value = Boolean(value);
      result[camel] = value;
    }
  }
  return result;
}

/**
 * Transform API format to database format
 */
function toDbFormat(data, columns) {
  const result = {};
  for (const [camel, snake] of Object.entries(columns)) {
    if (camel in data && data[camel] !== undefined) {
      result[snake] = data[camel];
    }
  }
  return result;
}

/**
 * Create a resource repository with prepared statements
 */
export function createRepository(db, resourceName) {
  const config = RESOURCES[resourceName];
  if (!config) throw new Error(`Unknown resource: ${resourceName}`);

  const { table, primaryKey, columns, orderBy, filter } = config;
  const isComposite = Array.isArray(primaryKey);
  const pkColumns = isComposite ? primaryKey : [primaryKey];
  const pkSnake = pkColumns.map((k) => columns[k]);

  // Build SELECT columns
  const selectCols = Object.values(columns).join(', ');

  // Build WHERE clause for primary key
  const pkWhere = pkSnake.map((col) => `${col} = ?`).join(' AND ');

  // Prepared statements
  const stmts = {
    getById: db.prepare(`SELECT ${selectCols} FROM ${table} WHERE ${pkWhere}`),
    getAll: db.prepare(
      `SELECT ${selectCols} FROM ${table}` +
        (filter ? ` WHERE ${filter}` : '') +
        (orderBy ? ` ORDER BY ${orderBy}` : '')
    ),
    delete: db.prepare(`DELETE FROM ${table} WHERE ${pkWhere}`),
  };

  // Build filtered getAll for parent resources
  if (config.parent) {
    const parentCol = columns[config.parent.foreignKey];
    stmts.getByParent = db.prepare(
      `SELECT ${selectCols} FROM ${table} WHERE ${parentCol} = ?` +
        (filter ? ` AND ${filter}` : '') +
        (orderBy ? ` ORDER BY ${orderBy}` : '')
    );
  }

  // For diet entries, add specific queries
  if (resourceName === 'diet') {
    stmts.getByDisplayId = db.prepare(`
      SELECT d.horse_id, d.feed_id, d.am_amount, d.pm_amount, d.created_at, d.updated_at
      FROM diet_entries d
      JOIN horses h ON d.horse_id = h.id
      WHERE h.display_id = ?
    `);
  }

  return {
    getById(...pkValues) {
      const row = stmts.getById.get(...pkValues);
      return toApiFormat(row, columns);
    },

    getAll() {
      return stmts.getAll.all().map((row) => toApiFormat(row, columns));
    },

    getByParent(parentId) {
      if (!stmts.getByParent) {
        throw new Error(`Resource ${resourceName} has no parent`);
      }
      return stmts.getByParent.all(parentId).map((row) => toApiFormat(row, columns));
    },

    getByDisplayId(displayId) {
      if (!stmts.getByDisplayId) {
        throw new Error(`Resource ${resourceName} does not support getByDisplayId`);
      }
      return stmts.getByDisplayId.all(displayId).map((row) => toApiFormat(row, columns));
    },

    create(data, parentId = null) {
      // Parse through createSchema to apply defaults
      const parsed = config.createSchema.parse(data);
      const dbData = toDbFormat(parsed, columns);

      // Generate ID for non-composite primary keys
      if (!isComposite) {
        const prefix = resourceName.charAt(0);
        dbData[columns[primaryKey]] = generateId(prefix);
      }

      // Set parent ID if applicable
      if (parentId && config.parent) {
        dbData[columns[config.parent.foreignKey]] = parentId;
      }

      // Special handling for displays (generate pair code)
      if (resourceName === 'displays') {
        dbData.pair_code = generatePairCode(db);
        if (!dbData.timezone) dbData.timezone = 'Australia/Sydney';
      }

      // Build INSERT
      const cols = Object.keys(dbData);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => dbData[c]);

      db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(
        ...values
      );

      // Return created record
      if (isComposite) {
        const pkValues = pkColumns.map((k) => parsed[k]);
        return this.getById(...pkValues);
      }
      return this.getById(dbData[columns[primaryKey]]);
    },

    upsert(data) {
      // For composite primary keys (diet entries)
      const dbData = toDbFormat(data, columns);
      const pkValues = pkSnake.map((col) => dbData[col]);

      // Build UPSERT
      const cols = Object.keys(dbData);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => dbData[c]);

      const updateCols = cols.filter((c) => !pkSnake.includes(c));
      const updateSet = updateCols.map((c) => `${c} = excluded.${c}`).join(', ');

      db.prepare(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
         ON CONFLICT(${pkSnake.join(', ')}) DO UPDATE SET ${updateSet}`
      ).run(...values);

      return this.getById(...pkValues);
    },

    update(data, ...pkValues) {
      const dbData = toDbFormat(data, columns);
      const updateCols = Object.keys(dbData).filter((c) => !pkSnake.includes(c));

      if (updateCols.length === 0) return this.getById(...pkValues);

      // Use COALESCE for optional updates
      const setClause = updateCols.map((c) => `${c} = COALESCE(?, ${c})`).join(', ');
      const values = updateCols.map((c) => dbData[c]);

      db.prepare(`UPDATE ${table} SET ${setClause} WHERE ${pkWhere}`).run(...values, ...pkValues);

      return this.getById(...pkValues);
    },

    delete(...pkValues) {
      const result = stmts.delete.run(...pkValues);
      return result.changes > 0;
    },
  };
}

/**
 * Validation middleware factory
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Mount resource routes on Express app
 *
 * Generates standard REST endpoints:
 * - GET /api/{resource} - list all (or by parent)
 * - GET /api/{resource}/:id - get by id
 * - POST /api/{resource} - create
 * - PUT /api/{resource}/:id - upsert (for composite keys)
 * - PATCH /api/{resource}/:id - update
 * - DELETE /api/{resource}/:id - delete
 */
export function mountResource(app, db, resourceName, options = {}) {
  const config = RESOURCES[resourceName];
  if (!config) throw new Error(`Unknown resource: ${resourceName}`);

  const repo = createRepository(db, resourceName);
  const router = Router();
  const { broadcast, hooks = {} } = options;

  const isComposite = Array.isArray(config.primaryKey);

  // Helper to broadcast SSE events
  const notify = (displayId, type) => {
    if (broadcast && displayId) {
      broadcast(displayId, type);
    }
  };

  // GET all (or by parent)
  if (config.parent) {
    // Scoped under parent: GET /api/displays/:displayId/{resource}
    app.get(`/api/displays/:displayId/${resourceName}`, (req, res) => {
      const items = repo.getByParent(req.params.displayId);
      res.json({ success: true, data: items });
    });
  } else if (resourceName !== 'diet') {
    // Top-level resource
    router.get('/', (req, res) => {
      const items = repo.getAll();
      res.json({ success: true, data: items });
    });
  }

  // For diet, special handling
  if (resourceName === 'diet') {
    // GET /api/diet?displayId=xxx
    router.get('/', (req, res) => {
      if (req.query.displayId) {
        const items = repo.getByDisplayId(req.query.displayId);
        res.json({ success: true, data: items });
      } else {
        const items = repo.getAll();
        res.json({ success: true, data: items });
      }
    });

    // PUT /api/diet - upsert single entry
    router.put('/', validate(config.createSchema), (req, res) => {
      const entry = repo.upsert(req.body);

      // Trigger onWrite hook (recalculate feed rankings)
      if (hooks.recalculateFeedRankings) {
        // Need to get the displayId from the horse
        const horseRepo = createRepository(db, 'horses');
        const horse = horseRepo.getById(req.body.horseId);
        if (horse) {
          hooks.recalculateFeedRankings(db, horse.displayId);
          notify(horse.displayId, 'feeds');
        }
      }

      res.json({ success: true, data: entry });
    });

    // DELETE /api/diet/:horseId/:feedId
    router.delete('/:horseId/:feedId', (req, res) => {
      const deleted = repo.delete(req.params.horseId, req.params.feedId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Diet entry not found' });
      }
      res.json({ success: true });
    });

    app.use('/api/diet', router);
    return repo;
  }

  // GET by ID
  if (!isComposite) {
    router.get('/:id', (req, res) => {
      const item = repo.getById(req.params.id);
      if (!item) {
        return res.status(404).json({ success: false, error: `${resourceName} not found` });
      }
      res.json({ success: true, data: item });
    });
  }

  // POST - create
  if (config.parent) {
    // Create under parent: POST /api/displays/:displayId/{resource}
    app.post(
      `/api/displays/:displayId/${resourceName}`,
      validate(config.createSchema),
      (req, res) => {
        try {
          const item = repo.create(req.body, req.params.displayId);
          notify(req.params.displayId, resourceName);
          res.status(201).json({ success: true, data: item });
        } catch (error) {
          if (error.message.includes('UNIQUE constraint')) {
            return res.status(409).json({ success: false, error: 'Already exists' });
          }
          res.status(500).json({ success: false, error: error.message });
        }
      }
    );
  } else {
    router.post('/', validate(config.createSchema), (req, res) => {
      try {
        const item = repo.create(req.body);
        res.status(201).json({ success: true, data: item });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  // PATCH - update
  if (!isComposite) {
    router.patch('/:id', validate(config.updateSchema), (req, res) => {
      const existing = repo.getById(req.params.id);
      if (!existing) {
        return res.status(404).json({ success: false, error: `${resourceName} not found` });
      }

      const updated = repo.update(req.body, req.params.id);
      if (existing.displayId) {
        notify(existing.displayId, resourceName);
      }
      res.json({ success: true, data: updated });
    });
  }

  // DELETE
  if (!isComposite) {
    router.delete('/:id', (req, res) => {
      const existing = repo.getById(req.params.id);
      const deleted = repo.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: `${resourceName} not found` });
      }
      if (existing?.displayId) {
        notify(existing.displayId, resourceName);
      }
      res.json({ success: true });
    });
  }

  app.use(`/api/${resourceName}`, router);
  return repo;
}

/**
 * Recalculate feed rankings based on usage
 */
export function recalculateFeedRankings(db, displayId) {
  const rankings = db
    .prepare(
      `
    SELECT f.id, COUNT(DISTINCT d.horse_id) as usage_count
    FROM feeds f
    LEFT JOIN diet_entries d ON f.id = d.feed_id
      AND (d.am_amount > 0 OR d.pm_amount > 0)
    WHERE f.display_id = ?
    GROUP BY f.id
    ORDER BY usage_count DESC
  `
    )
    .all(displayId);

  const updateRank = db.prepare('UPDATE feeds SET rank = ? WHERE id = ?');

  for (let i = 0; i < rankings.length; i++) {
    updateRank.run(rankings.length - i, rankings[i].id);
  }

  return rankings.length;
}

/**
 * SSE connection manager
 */
export class SSEManager {
  constructor() {
    this.clients = new Map(); // displayId -> Set<res>
  }

  addClient(displayId, res) {
    if (!this.clients.has(displayId)) {
      this.clients.set(displayId, new Set());
    }
    this.clients.get(displayId).add(res);

    res.on('close', () => {
      this.clients.get(displayId)?.delete(res);
    });
  }

  broadcast(displayId, type, data = null) {
    const clients = this.clients.get(displayId);
    if (!clients) return;

    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

    for (const client of clients) {
      client.write(`data: ${message}\n\n`);
    }
  }

  sendKeepalive() {
    for (const [, clients] of this.clients) {
      for (const client of clients) {
        client.write(': keepalive\n\n');
      }
    }
  }
}
