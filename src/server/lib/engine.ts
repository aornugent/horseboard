import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ResourceName,
  ApiType,
  isResourceName,
  getResourceConfig,
} from '@shared/resources';
import type Database from 'better-sqlite3';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Column mapping from camelCase to snake_case
 */
type ColumnMap = Record<string, string>;

/**
 * Database row - unknown structure from SQLite
 */
type DbRow = Record<string, unknown>;

/**
 * Repository interface with strict typing based on resource schema
 */
export interface Repository<R extends ResourceName> {
  getById(...pkValues: string[]): ApiType<R> | null;
  getAll(): ApiType<R>[];
  getByParent?(parentId: string): ApiType<R>[];
  getByDisplayId?(displayId: string): ApiType<R>[];
  getByPairCode?(pairCode: string): ApiType<R> | null;
  create(data: unknown, parentId?: string | null): ApiType<R>;
  upsert?(data: unknown): ApiType<R>;
  update(data: unknown, ...pkValues: string[]): ApiType<R> | null;
  delete(...pkValues: string[]): boolean;
}

/**
 * Configuration for recursion-safe code generation
 */
interface PairCodeConfig {
  maxAttempts: number;
  codeLength: number;
  minCode: number;
  maxCode: number;
}

const DEFAULT_PAIR_CODE_CONFIG: PairCodeConfig = {
  maxAttempts: 100,
  codeLength: 6,
  minCode: 100000,
  maxCode: 999999,
};

// =============================================================================
// ID GENERATION
// =============================================================================

/**
 * Generate a unique ID with prefix
 */
export function generateId(prefix = 'd'): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${hex}`;
}

/**
 * Generate a unique 6-digit pairing code with recursion safety
 *
 * @throws Error if max attempts exceeded (ID space exhausted or DB issues)
 */
export function generatePairCode(
  db: Database.Database,
  config: PairCodeConfig = DEFAULT_PAIR_CODE_CONFIG,
  attempt = 0
): string {
  if (attempt >= config.maxAttempts) {
    throw new Error(
      `Failed to generate unique pair code after ${config.maxAttempts} attempts. ` +
        `ID space may be exhausted or database may be experiencing issues.`
    );
  }

  const code = String(
    Math.floor(config.minCode + Math.random() * (config.maxCode - config.minCode + 1))
  );

  const existing = db
    .prepare('SELECT 1 FROM displays WHERE pair_code = ?')
    .get(code) as unknown;

  if (existing) {
    return generatePairCode(db, config, attempt + 1);
  }

  return code;
}

// =============================================================================
// FORMAT CONVERSION WITH TYPE SAFETY
// =============================================================================

/**
 * Transform database row to API format using column mapping
 *
 * Uses the resource's column mapping to convert snake_case DB columns
 * to camelCase API properties with proper type inference.
 *
 * @template R - Resource name for type inference
 */
function toApiFormat<R extends ResourceName>(
  row: DbRow | undefined,
  columns: ColumnMap
): ApiType<R> | null {
  if (!row) return null;

  const result: Record<string, unknown> = {};

  for (const [camel, snake] of Object.entries(columns)) {
    if (snake in row) {
      let value = row[snake];
      // Convert SQLite integer booleans
      if (camel === 'archived') value = Boolean(value);
      result[camel] = value;
    }
  }

  // The result matches the schema shape due to column mapping
  // Type assertion is safe because we're building from the known column map
  return result as ApiType<R>;
}

/**
 * Transform API format to database format
 *
 * @template R - Resource name for type inference
 */
function toDbFormat<R extends ResourceName>(
  data: Partial<ApiType<R>>,
  columns: ColumnMap
): DbRow {
  const result: DbRow = {};

  for (const [camel, snake] of Object.entries(columns)) {
    if (camel in data && (data as Record<string, unknown>)[camel] !== undefined) {
      result[snake] = (data as Record<string, unknown>)[camel];
    }
  }

  return result;
}

// =============================================================================
// REPOSITORY FACTORY
// =============================================================================

/**
 * Create a resource repository with prepared statements and strict typing
 *
 * Returns a repository object with methods typed according to the resource's
 * Zod schema, ensuring compile-time type safety for all database operations.
 *
 * @template R - Resource name (must be a key of RESOURCES)
 */
export function createRepository<R extends ResourceName>(
  db: Database.Database,
  resourceName: R
): Repository<R> {
  if (!isResourceName(resourceName)) {
    throw new Error(`Unknown resource: ${resourceName}`);
  }

  const config = getResourceConfig(resourceName);
  const { table, primaryKey, columns } = config;
  // These properties are optional on some resources
  const orderBy = 'orderBy' in config ? config.orderBy : undefined;
  const filter = 'filter' in config ? config.filter : undefined;
  const isComposite = Array.isArray(primaryKey);
  const pkColumns = isComposite ? primaryKey : [primaryKey];
  const pkSnake = pkColumns.map((k) => columns[k as keyof typeof columns] as string);

  // Build SELECT columns
  const selectCols = Object.values(columns).join(', ');

  // Build WHERE clause for primary key
  const pkWhere = pkSnake.map((col) => `${col} = ?`).join(' AND ');

  // Build update clause for all non-PK columns (for cached update statement)
  const updateCols = (Object.values(columns) as string[]).filter(
    (col) => !pkSnake.includes(col) && col !== 'created_at' && col !== 'updated_at'
  );
  const updateSetClause = updateCols.map((c) => `${c} = COALESCE(?, ${c})`).join(', ');

  // Prepared statements (cached once per repository)
  const stmts: Record<string, Database.Statement | string[] | null> = {
    getById: db.prepare(`SELECT ${selectCols} FROM ${table} WHERE ${pkWhere}`),
    getAll: db.prepare(
      `SELECT ${selectCols} FROM ${table}` +
        (filter ? ` WHERE ${filter}` : '') +
        (orderBy ? ` ORDER BY ${orderBy}` : '')
    ),
    delete: db.prepare(`DELETE FROM ${table} WHERE ${pkWhere}`),
    update:
      updateCols.length > 0
        ? db.prepare(`UPDATE ${table} SET ${updateSetClause} WHERE ${pkWhere}`)
        : null,
  };

  // Build filtered getAll for parent resources
  const parent = 'parent' in config ? config.parent : undefined;
  if (parent) {
    const parentCol = columns[parent.foreignKey as keyof typeof columns] as string;
    stmts.getByParent = db.prepare(
      `SELECT ${selectCols} FROM ${table} WHERE ${parentCol} = ?` +
        (filter ? ` AND ${filter}` : '') +
        (orderBy ? ` ORDER BY ${orderBy}` : '')
    );
  }

  // For diet entries, add specific queries and upsert statement
  if (resourceName === 'diet') {
    stmts.getByDisplayId = db.prepare(`
      SELECT d.horse_id, d.feed_id, d.am_amount, d.pm_amount, d.created_at, d.updated_at
      FROM diet_entries d
      JOIN horses h ON d.horse_id = h.id
      WHERE h.display_id = ?
    `);
    // Upsert for diet entries (composite PK) - exclude auto-generated timestamps
    const dietInsertCols = (Object.values(columns) as string[]).filter(
      (c) => c !== 'created_at' && c !== 'updated_at'
    );
    const dietPlaceholders = dietInsertCols.map(() => '?').join(', ');
    const dietUpdateCols = dietInsertCols.filter((c) => !pkSnake.includes(c));
    const dietUpdateSet = dietUpdateCols.map((c) => `${c} = excluded.${c}`).join(', ');
    stmts.upsert = db.prepare(
      `INSERT INTO ${table} (${dietInsertCols.join(', ')}) VALUES (${dietPlaceholders})
       ON CONFLICT(${pkSnake.join(', ')}) DO UPDATE SET ${dietUpdateSet}`
    );
    // Store the insert cols for use in upsert method
    stmts.upsertCols = dietInsertCols;
  }

  // For displays, add getByPairCode query
  if (resourceName === 'displays') {
    stmts.getByPairCode = db.prepare(
      `SELECT ${selectCols} FROM ${table} WHERE pair_code = ?`
    );
  }

  // Helper to convert row with proper typing
  const convertRow = (row: DbRow | undefined): ApiType<R> | null =>
    toApiFormat<R>(row, columns);

  const convertRows = (rows: DbRow[]): ApiType<R>[] =>
    rows.map((row) => convertRow(row)).filter((r): r is ApiType<R> => r !== null);

  const repo: Repository<R> = {
    getById(...pkValues: string[]): ApiType<R> | null {
      const row = (stmts.getById as Database.Statement).get(...pkValues) as DbRow | undefined;
      return convertRow(row);
    },

    getAll(): ApiType<R>[] {
      const rows = (stmts.getAll as Database.Statement).all() as DbRow[];
      return convertRows(rows);
    },

    create(data: unknown, parentId: string | null = null): ApiType<R> {
      // Parse through createSchema to apply defaults
      const parsed = config.createSchema.parse(data) as Partial<ApiType<R>>;
      const dbData = toDbFormat(parsed, columns);

      // Generate ID for non-composite primary keys
      if (!isComposite) {
        const prefix = resourceName.charAt(0);
        dbData[columns[primaryKey as keyof typeof columns] as string] = generateId(prefix);
      }

      // Set parent ID if applicable
      if (parentId && parent) {
        dbData[columns[parent.foreignKey as keyof typeof columns] as string] = parentId;
      }

      // Special handling for displays (generate pair code)
      if (resourceName === 'displays') {
        dbData.pair_code = generatePairCode(db);
        if (!dbData.timezone) dbData.timezone = 'Australia/Sydney';
      }

      // Dynamic INSERT to allow database defaults for unprovided columns
      const cols = Object.keys(dbData);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => dbData[c]);

      db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(
        ...values
      );

      // Return created record
      if (isComposite) {
        const pkValues = pkColumns.map((k) => (parsed as Record<string, string>)[k]);
        return this.getById(...pkValues) as ApiType<R>;
      }
      return this.getById(
        dbData[columns[primaryKey as keyof typeof columns] as string] as string
      ) as ApiType<R>;
    },

    update(data: unknown, ...pkValues: string[]): ApiType<R> | null {
      if (!stmts.update) return this.getById(...pkValues);

      const dbData = toDbFormat(data as Partial<ApiType<R>>, columns);

      // Use cached update statement - pass values in updateCols order, then PK values
      const values = updateCols.map((col) => dbData[col] ?? null);
      (stmts.update as Database.Statement).run(...values, ...pkValues);

      return this.getById(...pkValues);
    },

    delete(...pkValues: string[]): boolean {
      const result = (stmts.delete as Database.Statement).run(...pkValues);
      return result.changes > 0;
    },
  };

  // Add optional methods based on resource type
  if (stmts.getByParent) {
    repo.getByParent = function (parentId: string): ApiType<R>[] {
      const rows = (stmts.getByParent as Database.Statement).all(parentId) as DbRow[];
      return convertRows(rows);
    };
  }

  if (stmts.getByDisplayId) {
    repo.getByDisplayId = function (displayId: string): ApiType<R>[] {
      const rows = (stmts.getByDisplayId as Database.Statement).all(displayId) as DbRow[];
      return convertRows(rows);
    };
  }

  if (stmts.getByPairCode) {
    repo.getByPairCode = function (pairCode: string): ApiType<R> | null {
      const row = (stmts.getByPairCode as Database.Statement).get(pairCode) as
        | DbRow
        | undefined;
      return convertRow(row);
    };
  }

  if (stmts.upsert && stmts.upsertCols) {
    repo.upsert = function (data: unknown): ApiType<R> {
      const dbData = toDbFormat(data as Partial<ApiType<R>>, columns);
      const pkValues = pkSnake.map((col) => dbData[col] as string);

      // Use cached upsert statement - map values in column order (excludes timestamps)
      const values = (stmts.upsertCols as string[]).map((col) => dbData[col] ?? null);
      (stmts.upsert as Database.Statement).run(...values);

      return repo.getById(...pkValues) as ApiType<R>;
    };
  }

  return repo;
}

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

/**
 * Validation middleware factory with proper Express types
 */
function validate(
  schema: z.ZodSchema
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// =============================================================================
// ROUTE MOUNTING
// =============================================================================

/**
 * Options for mounting a resource
 */
interface MountOptions {
  broadcast?: (displayId: string, type: string) => void;
  hooks?: {
    /** @deprecated Use scheduleRankingRecalculation instead */
    recalculateFeedRankings?: (db: Database.Database, displayId: string) => void;
    /** Async ranking manager for non-blocking recalculation */
    scheduleRankingRecalculation?: (displayId: string) => void;
  };
  repos?: {
    horses?: Repository<'horses'>;
  };
}

/**
 * Mount resource routes on Express app
 *
 * Generates standard REST endpoints:
 * - GET /api/{resource} - list all (or by parent)
 * - GET /api/{resource}/:id - get by id
 * - POST /api/{resource} - create
 * - PUT /api/{resource} - upsert (for composite keys)
 * - PATCH /api/{resource}/:id - update
 * - DELETE /api/{resource}/:id - delete
 */
export function mountResource<R extends ResourceName>(
  app: { get: Function; post: Function; use: Function },
  db: Database.Database,
  resourceName: R,
  options: MountOptions = {}
): Repository<R> {
  if (!isResourceName(resourceName)) {
    throw new Error(`Unknown resource: ${resourceName}`);
  }

  const config = getResourceConfig(resourceName);
  const { broadcast, hooks = {}, repos = {} } = options;

  const repo = createRepository(db, resourceName);
  const router = Router();

  const isComposite = Array.isArray(config.primaryKey);

  // Helper to broadcast SSE events
  const notify = (displayId: string | undefined, type: string): void => {
    if (broadcast && displayId) {
      broadcast(displayId, type);
    }
  };

  // GET all (or by parent)
  const parent = 'parent' in config ? config.parent : undefined;
  if (parent) {
    // Scoped under parent: GET /api/displays/:displayId/{resource}
    app.get(`/api/displays/:displayId/${resourceName}`, (req: Request, res: Response) => {
      const items = repo.getByParent?.(req.params.displayId) ?? [];
      res.json({ success: true, data: items });
    });
  } else if (resourceName !== 'diet') {
    // Top-level resource
    router.get('/', (_req: Request, res: Response) => {
      const items = repo.getAll();
      res.json({ success: true, data: items });
    });
  }

  // For diet, special handling
  if (resourceName === 'diet') {
    // GET /api/diet?displayId=xxx
    router.get('/', (req: Request, res: Response) => {
      if (req.query.displayId) {
        const items = repo.getByDisplayId?.(req.query.displayId as string) ?? [];
        res.json({ success: true, data: items });
      } else {
        const items = repo.getAll();
        res.json({ success: true, data: items });
      }
    });

    // PUT /api/diet - upsert single entry
    router.put('/', validate(config.createSchema), (req: Request, res: Response) => {
      if (!repo.upsert) {
        res.status(500).json({ success: false, error: 'Upsert not supported' });
        return;
      }
      const entry = repo.upsert(req.body);

      // Trigger ranking recalculation (prefer async, fallback to sync for backwards compat)
      if (repos.horses) {
        const horse = repos.horses.getById(req.body.horseId);
        if (horse) {
          if (hooks.scheduleRankingRecalculation) {
            // Non-blocking: schedule async recalculation, respond immediately
            hooks.scheduleRankingRecalculation(horse.displayId);
          } else if (hooks.recalculateFeedRankings) {
            // Legacy blocking path (deprecated)
            hooks.recalculateFeedRankings(db, horse.displayId);
            notify(horse.displayId, 'feeds');
          }
        }
      }

      res.json({ success: true, data: entry });
    });

    // DELETE /api/diet/:horseId/:feedId
    router.delete('/:horseId/:feedId', (req: Request, res: Response) => {
      const deleted = repo.delete(req.params.horseId, req.params.feedId);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Diet entry not found' });
        return;
      }
      res.json({ success: true });
    });

    app.use('/api/diet', router);
    return repo;
  }

  // GET by ID
  if (!isComposite) {
    router.get('/:id', (req: Request, res: Response) => {
      const item = repo.getById(req.params.id);
      if (!item) {
        res.status(404).json({ success: false, error: `${resourceName} not found` });
        return;
      }
      res.json({ success: true, data: item });
    });
  }

  // POST - create
  if (parent) {
    // Create under parent: POST /api/displays/:displayId/{resource}
    app.post(
      `/api/displays/:displayId/${resourceName}`,
      validate(config.createSchema),
      (req: Request, res: Response) => {
        try {
          const item = repo.create(req.body, req.params.displayId);
          notify(req.params.displayId, resourceName);
          res.status(201).json({ success: true, data: item });
        } catch (error) {
          const err = error as Error;
          if (err.message.includes('UNIQUE constraint')) {
            res.status(409).json({ success: false, error: 'Already exists' });
            return;
          }
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
  } else {
    router.post('/', validate(config.createSchema), (req: Request, res: Response) => {
      try {
        const item = repo.create(req.body);
        res.status(201).json({ success: true, data: item });
      } catch (error) {
        const err = error as Error;
        res.status(500).json({ success: false, error: err.message });
      }
    });
  }

  // PATCH - update
  if (!isComposite) {
    router.patch('/:id', validate(config.updateSchema), (req: Request, res: Response) => {
      const existing = repo.getById(req.params.id);
      if (!existing) {
        res.status(404).json({ success: false, error: `${resourceName} not found` });
        return;
      }

      const updated = repo.update(req.body, req.params.id);
      const displayId = (existing as Record<string, unknown>).displayId as string | undefined;
      if (displayId) {
        notify(displayId, resourceName);
      }
      res.json({ success: true, data: updated });
    });
  }

  // DELETE
  if (!isComposite) {
    router.delete('/:id', (req: Request, res: Response) => {
      const existing = repo.getById(req.params.id);
      const deleted = repo.delete(req.params.id);
      if (!deleted) {
        res.status(404).json({ success: false, error: `${resourceName} not found` });
        return;
      }
      const displayId = (existing as Record<string, unknown>)?.displayId as string | undefined;
      if (displayId) {
        notify(displayId, resourceName);
      }
      res.json({ success: true });
    });
  }

  app.use(`/api/${resourceName}`, router);
  return repo;
}

// =============================================================================
// FEED RANKING CALCULATION (re-exported from rankings module)
// =============================================================================

// Re-export for backwards compatibility and new async manager
export { recalculateFeedRankings, FeedRankingManager } from './rankings';

// =============================================================================
// SSE CONNECTION MANAGER
// =============================================================================

/**
 * SSE connection manager
 */
export class SSEManager {
  private clients: Map<string, Set<Response>>;

  constructor() {
    this.clients = new Map();
  }

  addClient(displayId: string, res: Response): void {
    if (!this.clients.has(displayId)) {
      this.clients.set(displayId, new Set());
    }
    this.clients.get(displayId)!.add(res);

    res.on('close', () => {
      this.clients.get(displayId)?.delete(res);
    });
  }

  broadcast(displayId: string, type: string, data: unknown = null): void {
    const clients = this.clients.get(displayId);
    if (!clients) return;

    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

    for (const client of clients) {
      client.write(`data: ${message}\n\n`);
    }
  }

  sendKeepalive(): void {
    for (const [_displayId, clients] of this.clients) {
      for (const client of clients) {
        try {
          client.write(': keepalive\n\n');
        } catch {
          // Client connection failed, remove it
          clients.delete(client);
        }
      }
    }
  }
}
