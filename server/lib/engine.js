import { Router } from 'express';
import { toDbRow, toApiObject } from '../../shared/resources.js';

/**
 * Server Engine - Generic resource mounting with auto-generated CRUD
 *
 * Features:
 * - Auto-generates SQL from resource config
 * - Mounts GET/PUT/DELETE Express routes
 * - Broadcasts SSE events on changes
 * - Handles composite primary keys
 * - Executes onWrite hooks
 */

/**
 * Create a resource repository with auto-generated SQL
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} config - Resource configuration from RESOURCES
 * @param {object} hooks - Available hook functions
 */
export function createRepository(db, config, hooks = {}) {
  const { table, primaryKey, fieldMap, parentKey } = config;

  // Invert fieldMap for DB -> API conversion
  const reverseMap = {};
  for (const [api, dbCol] of Object.entries(fieldMap)) {
    reverseMap[dbCol] = api;
  }

  // Get all API fields (excluding timestamps which are auto-managed)
  const apiFields = Object.keys(fieldMap).filter(
    (f) => !['createdAt', 'updatedAt'].includes(f)
  );
  const dbFields = apiFields.map((f) => fieldMap[f]);

  // Build SQL statements
  const selectCols = Object.values(fieldMap).join(', ');
  const isCompositePK = primaryKey.length > 1;

  // Prepared statements
  const stmts = {};

  // SELECT by primary key
  if (isCompositePK) {
    const whereClause = primaryKey.map((k) => `${fieldMap[k]} = ?`).join(' AND ');
    stmts.getByPK = db.prepare(`SELECT ${selectCols} FROM ${table} WHERE ${whereClause}`);
  } else {
    stmts.getByPK = db.prepare(`SELECT ${selectCols} FROM ${table} WHERE ${fieldMap[primaryKey[0]]} = ?`);
  }

  // SELECT all (optionally by parent)
  if (parentKey) {
    stmts.getByParent = db.prepare(
      `SELECT ${selectCols} FROM ${table} WHERE ${fieldMap[parentKey]} = ?`
    );
  }
  stmts.getAll = db.prepare(`SELECT ${selectCols} FROM ${table}`);

  // UPSERT (insert or update)
  const insertCols = dbFields.join(', ');
  const insertPlaceholders = dbFields.map(() => '?').join(', ');

  if (isCompositePK) {
    const pkCols = primaryKey.map((k) => fieldMap[k]);
    const updateCols = dbFields
      .filter((c) => !pkCols.includes(c))
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');

    stmts.upsert = db.prepare(`
      INSERT INTO ${table} (${insertCols})
      VALUES (${insertPlaceholders})
      ON CONFLICT(${pkCols.join(', ')}) DO UPDATE SET ${updateCols}, updated_at = CURRENT_TIMESTAMP
    `);
  } else {
    const updateCols = dbFields
      .filter((c) => c !== fieldMap[primaryKey[0]])
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');

    stmts.upsert = db.prepare(`
      INSERT INTO ${table} (${insertCols})
      VALUES (${insertPlaceholders})
      ON CONFLICT(${fieldMap[primaryKey[0]]}) DO UPDATE SET ${updateCols}, updated_at = CURRENT_TIMESTAMP
    `);
  }

  // DELETE by primary key
  if (isCompositePK) {
    const whereClause = primaryKey.map((k) => `${fieldMap[k]} = ?`).join(' AND ');
    stmts.delete = db.prepare(`DELETE FROM ${table} WHERE ${whereClause}`);
  } else {
    stmts.delete = db.prepare(`DELETE FROM ${table} WHERE ${fieldMap[primaryKey[0]]} = ?`);
  }

  // Repository methods
  return {
    /**
     * Get item by primary key
     */
    get(...pkValues) {
      const row = stmts.getByPK.get(...pkValues);
      return toApiObject(row, fieldMap);
    },

    /**
     * Get all items (optionally filtered by parent)
     */
    getAll(parentId = null) {
      const rows = parentId && parentKey
        ? stmts.getByParent.all(parentId)
        : stmts.getAll.all();
      return rows.map((row) => toApiObject(row, fieldMap));
    },

    /**
     * Upsert (create or update) an item
     */
    upsert(data) {
      const values = dbFields.map((col) => {
        const apiKey = reverseMap[col];
        return data[apiKey] ?? null;
      });
      stmts.upsert.run(...values);

      // Execute onWrite hook if configured
      if (config.onWrite && hooks[config.onWrite]) {
        hooks[config.onWrite](db, data);
      }

      // Return the upserted item
      const pkValues = primaryKey.map((k) => data[k]);
      return this.get(...pkValues);
    },

    /**
     * Delete an item by primary key
     */
    delete(...pkValues) {
      const result = stmts.delete.run(...pkValues);
      return result.changes > 0;
    },

    /**
     * Bulk upsert (atomic transaction)
     */
    bulkUpsert(items) {
      const upsertMany = db.transaction((items) => {
        for (const item of items) {
          const values = dbFields.map((col) => {
            const apiKey = reverseMap[col];
            return item[apiKey] ?? null;
          });
          stmts.upsert.run(...values);
        }
      });
      upsertMany(items);

      // Execute onWrite hook once after bulk operation
      if (config.onWrite && hooks[config.onWrite] && items.length > 0) {
        hooks[config.onWrite](db, items[0]);
      }

      return items.length;
    },
  };
}

/**
 * Mount a resource as Express routes with SSE broadcasting
 *
 * @param {import('express').Application} app
 * @param {import('better-sqlite3').Database} db
 * @param {string} name - Resource name (e.g., 'horses')
 * @param {object} config - Resource configuration
 * @param {object} sseManager - SSE manager for broadcasting
 * @param {object} hooks - Available hook functions
 */
export function mountResource(app, db, name, config, sseManager, hooks = {}) {
  const router = Router();
  const repo = createRepository(db, config, hooks);
  const { primaryKey, parentKey, schema } = config;
  const isCompositePK = primaryKey.length > 1;

  // Validation middleware
  const validate = (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.flatten(),
      });
    }
    req.validatedBody = result.data;
    next();
  };

  // Helper to broadcast changes
  const broadcast = (displayId, eventType) => {
    if (sseManager && displayId) {
      // Get fresh data and broadcast
      const data = buildFullState(db, displayId, hooks);
      sseManager.broadcast(displayId, { type: eventType, ...data });
    }
  };

  // GET all (scoped by display)
  if (parentKey) {
    router.get(`/displays/:displayId/${name}`, (req, res) => {
      const items = repo.getAll(req.params.displayId);
      res.json({ success: true, data: items });
    });
  } else {
    router.get(`/${name}`, (req, res) => {
      const items = repo.getAll();
      res.json({ success: true, data: items });
    });
  }

  // GET by primary key
  if (isCompositePK) {
    // For composite PK like diet: GET /diet/:horseId/:feedId
    const pkParams = primaryKey.map((k) => `:${k}`).join('/');
    router.get(`/${name}/${pkParams}`, (req, res) => {
      const pkValues = primaryKey.map((k) => req.params[k]);
      const item = repo.get(...pkValues);
      if (!item) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      res.json({ success: true, data: item });
    });
  } else {
    router.get(`/${name}/:id`, (req, res) => {
      const item = repo.get(req.params.id);
      if (!item) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      res.json({ success: true, data: item });
    });
  }

  // PUT (upsert)
  router.put(`/${name}`, validate, (req, res) => {
    try {
      const item = repo.upsert(req.validatedBody);

      // Get displayId for broadcasting
      const displayId = req.validatedBody.displayId || getDisplayIdForItem(db, name, req.validatedBody);
      broadcast(displayId, 'data');

      res.json({ success: true, data: item });
    } catch (err) {
      console.error(`Error upserting ${name}:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT bulk (for diet entries)
  router.put(`/${name}/bulk`, (req, res) => {
    const { entries } = req.body;
    if (!Array.isArray(entries)) {
      return res.status(400).json({ success: false, error: 'entries array required' });
    }

    try {
      const count = repo.bulkUpsert(entries);

      // Get displayId for broadcasting
      if (entries.length > 0) {
        const displayId = getDisplayIdForItem(db, name, entries[0]);
        broadcast(displayId, 'data');
      }

      res.json({ success: true, data: { count } });
    } catch (err) {
      console.error(`Error bulk upserting ${name}:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE
  if (isCompositePK) {
    const pkParams = primaryKey.map((k) => `:${k}`).join('/');
    router.delete(`/${name}/${pkParams}`, (req, res) => {
      const pkValues = primaryKey.map((k) => req.params[k]);

      // Get displayId before deleting
      const existing = repo.get(...pkValues);
      const displayId = existing ? getDisplayIdForItem(db, name, existing) : null;

      const deleted = repo.delete(...pkValues);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }

      broadcast(displayId, 'data');
      res.json({ success: true });
    });
  } else {
    router.delete(`/${name}/:id`, (req, res) => {
      // Get displayId before deleting
      const existing = repo.get(req.params.id);
      const displayId = existing ? existing.displayId : null;

      const deleted = repo.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }

      broadcast(displayId, 'data');
      res.json({ success: true });
    });
  }

  app.use('/api', router);

  return repo;
}

/**
 * Helper to get displayId for an item (used for broadcasting)
 */
function getDisplayIdForItem(db, resourceName, item) {
  if (item.displayId) return item.displayId;

  // For diet entries, look up via horse
  if (resourceName === 'diet' && item.horseId) {
    const horse = db.prepare('SELECT display_id FROM horses WHERE id = ?').get(item.horseId);
    return horse?.display_id;
  }

  return null;
}

/**
 * Build the full state object for SSE broadcasting
 */
function buildFullState(db, displayId, hooks) {
  const horses = db.prepare('SELECT * FROM horses WHERE display_id = ?').all(displayId);
  const feeds = db.prepare('SELECT * FROM feeds WHERE display_id = ? ORDER BY rank ASC').all(displayId);

  // Get diet entries for all horses in this display
  const horseIds = horses.map((h) => h.id);
  let diet = [];
  if (horseIds.length > 0) {
    const placeholders = horseIds.map(() => '?').join(',');
    diet = db.prepare(`SELECT * FROM diet_entries WHERE horse_id IN (${placeholders})`).all(...horseIds);
  }

  // Get display settings
  const display = db.prepare('SELECT * FROM displays WHERE id = ?').get(displayId);

  return {
    settings: display ? {
      timezone: display.timezone,
      timeMode: display.time_mode,
      overrideUntil: display.override_until,
      zoomLevel: display.zoom_level,
      currentPage: display.current_page,
    } : null,
    horses: horses.map((h) => ({
      id: h.id,
      name: h.name,
      note: h.note,
      noteExpiry: h.note_expiry,
      noteCreatedAt: h.note_created_at,
    })),
    feeds: feeds.map((f) => ({
      id: f.id,
      name: f.name,
      unit: f.unit,
      rank: f.rank,
    })),
    // Convert diet to the expected format: { [horseId]: { [feedId]: { am, pm } } }
    diet: diet.reduce((acc, d) => {
      if (!acc[d.horse_id]) acc[d.horse_id] = {};
      acc[d.horse_id][d.feed_id] = { am: d.am, pm: d.pm };
      return acc;
    }, {}),
  };
}

/**
 * Standard hooks for the engine
 */
export const HOOKS = {
  /**
   * Recalculate feed rankings based on usage count
   * Feeds used by more horses get lower rank (appear first)
   */
  recalculateFeedRankings(db, item) {
    // Get displayId - either from item directly or via horse lookup
    let displayId = item?.displayId;
    if (!displayId && item?.horseId) {
      const horse = db.prepare('SELECT display_id FROM horses WHERE id = ?').get(item.horseId);
      displayId = horse?.display_id;
    }
    if (!displayId) return;

    // Calculate usage counts
    const rankings = db.prepare(`
      SELECT f.id, COUNT(DISTINCT d.horse_id) as usage_count
      FROM feeds f
      LEFT JOIN diet_entries d ON f.id = d.feed_id
        AND (d.am > 0 OR d.pm > 0)
      WHERE f.display_id = ?
      GROUP BY f.id
      ORDER BY usage_count DESC, f.name ASC
    `).all(displayId);

    // Update ranks (lower rank = higher usage = appears first)
    const updateRank = db.prepare('UPDATE feeds SET rank = ? WHERE id = ?');
    rankings.forEach((r, idx) => {
      updateRank.run(idx + 1, r.id);
    });
  },
};

export default { createRepository, mountResource, HOOKS, buildFullState };
