import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ResourceName,
  ResourceType,
  isResourceName,
  getResourceConfig,
} from '@shared/resources';
import type Database from 'better-sqlite3';

/**
 * Database row - maps directly to TypeScript types (snake_case)
 */
type DbRow = Record<string, unknown>;

/**
 * Repository interface with strict typing based on resource schema
 */
export interface Repository<R extends ResourceName> {
  getById(...pkValues: string[]): ResourceType<R> | null;
  getAll(): ResourceType<R>[];
  getByParent?(parentId: string): ResourceType<R>[];
  getByBoardId?(boardId: string): ResourceType<R>[];
  getByPairCode?(pairCode: string): ResourceType<R> | null;
  create(data: unknown, parentId?: string | null): ResourceType<R>;
  upsert?(data: unknown): ResourceType<R>;
  update(data: unknown, ...pkValues: string[]): ResourceType<R> | null;
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
    .prepare('SELECT 1 FROM boards WHERE pair_code = ?')
    .get(code) as unknown;

  if (existing) {
    return generatePairCode(db, config, attempt + 1);
  }

  return code;
}

/**
 * Convert database row to resource type
 * No mapping needed - snake_case matches both TypeScript and DB
 */
function toResourceType<R extends ResourceName>(
  row: DbRow | undefined
): ResourceType<R> | null {
  if (!row) return null;

  // Convert SQLite integer booleans for 'archived' field
  if ('archived' in row) {
    row.archived = Boolean(row.archived);
  }

  return row as ResourceType<R>;
}

// =============================================================================
// REPOSITORY FACTORY
// =============================================================================

/**
 * Get column names from a Zod schema
 */
function getSchemaColumns(schema: z.ZodObject<z.ZodRawShape>): string[] {
  return Object.keys(schema.shape);
}

/**
 * Create a resource repository with prepared statements and strict typing
 *
 * Property names in TypeScript match column names in SQL exactly (snake_case).
 * No conversion layer needed.
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
  const { table, primaryKey, schema } = config;
  const orderBy = 'orderBy' in config ? config.orderBy : undefined;
  const filter = 'filter' in config ? config.filter : undefined;
  const isComposite = Array.isArray(primaryKey);
  const pkColumns = isComposite ? (primaryKey as string[]) : [primaryKey as string];

  // Get all column names from schema - they match DB columns directly
  const allColumns = getSchemaColumns(schema);
  const selectCols = allColumns.join(', ');

  // Build WHERE clause for primary key
  const pkWhere = pkColumns.map((col) => `${col} = ?`).join(' AND ');

  // Build update clause for all non-PK columns (excluding timestamps)
  const updateCols = allColumns.filter(
    (col) => !pkColumns.includes(col) && col !== 'created_at' && col !== 'updated_at'
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
    stmts.getByParent = db.prepare(
      `SELECT ${selectCols} FROM ${table} WHERE ${parent.foreignKey} = ?` +
        (filter ? ` AND ${filter}` : '') +
        (orderBy ? ` ORDER BY ${orderBy}` : '')
    );
  }

  // For diet entries, add specific queries and upsert statement
  if (resourceName === 'diet') {
    stmts.getByBoardId = db.prepare(`
      SELECT d.horse_id, d.feed_id, d.am_amount, d.pm_amount, d.created_at, d.updated_at
      FROM diet_entries d
      JOIN horses h ON d.horse_id = h.id
      WHERE h.board_id = ?
    `);
    // Upsert for diet entries (composite PK) - exclude auto-generated timestamps
    const dietInsertCols = allColumns.filter(
      (c) => c !== 'created_at' && c !== 'updated_at'
    );
    const dietPlaceholders = dietInsertCols.map(() => '?').join(', ');
    const dietUpdateCols = dietInsertCols.filter((c) => !pkColumns.includes(c));
    const dietUpdateSet = dietUpdateCols.map((c) => `${c} = excluded.${c}`).join(', ');
    stmts.upsert = db.prepare(
      `INSERT INTO ${table} (${dietInsertCols.join(', ')}) VALUES (${dietPlaceholders})
       ON CONFLICT(${pkColumns.join(', ')}) DO UPDATE SET ${dietUpdateSet}`
    );
    stmts.upsertCols = dietInsertCols;
  }

  // For boards, add getByPairCode query
  if (resourceName === 'boards') {
    stmts.getByPairCode = db.prepare(
      `SELECT ${selectCols} FROM ${table} WHERE pair_code = ?`
    );
  }

  // Helper to convert rows - no transformation, just type assertion
  const convertRow = (row: DbRow | undefined): ResourceType<R> | null =>
    toResourceType<R>(row);

  const convertRows = (rows: DbRow[]): ResourceType<R>[] =>
    rows.map((row) => convertRow(row)).filter((r): r is ResourceType<R> => r !== null);

  const repo: Repository<R> = {
    getById(...pkValues: string[]): ResourceType<R> | null {
      const row = (stmts.getById as Database.Statement).get(...pkValues) as DbRow | undefined;
      return convertRow(row);
    },

    getAll(): ResourceType<R>[] {
      const rows = (stmts.getAll as Database.Statement).all() as DbRow[];
      return convertRows(rows);
    },

    create(data: unknown, parentId: string | null = null): ResourceType<R> {
      // Parse through createSchema to apply defaults - result is already snake_case
      const parsed = config.createSchema.parse(data) as DbRow;

      // Generate ID for non-composite primary keys
      if (!isComposite) {
        const prefix = resourceName.charAt(0);
        parsed[primaryKey as string] = generateId(prefix);
      }

      // Set parent ID if applicable
      if (parentId && parent) {
        parsed[parent.foreignKey] = parentId;
      }

      // Special handling for boards (generate pair code)
      if (resourceName === 'boards') {
        parsed.pair_code = generatePairCode(db);
        if (!parsed.timezone) parsed.timezone = 'Australia/Sydney';
      }

      // Dynamic INSERT to allow database defaults for unprovided columns
      const cols = Object.keys(parsed);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => parsed[c]);

      db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(
        ...values
      );

      // Return created record
      if (isComposite) {
        const pkValues = pkColumns.map((k) => parsed[k] as string);
        return this.getById(...pkValues) as ResourceType<R>;
      }
      return this.getById(parsed[primaryKey as string] as string) as ResourceType<R>;
    },

    update(data: unknown, ...pkValues: string[]): ResourceType<R> | null {
      if (!stmts.update) return this.getById(...pkValues);

      const dbData = data as DbRow;

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
    repo.getByParent = function (parentId: string): ResourceType<R>[] {
      const rows = (stmts.getByParent as Database.Statement).all(parentId) as DbRow[];
      return convertRows(rows);
    };
  }

  if (stmts.getByBoardId) {
    repo.getByBoardId = function (boardId: string): ResourceType<R>[] {
      const rows = (stmts.getByBoardId as Database.Statement).all(boardId) as DbRow[];
      return convertRows(rows);
    };
  }

  if (stmts.getByPairCode) {
    repo.getByPairCode = function (pairCode: string): ResourceType<R> | null {
      const row = (stmts.getByPairCode as Database.Statement).get(pairCode) as
        | DbRow
        | undefined;
      return convertRow(row);
    };
  }

  if (stmts.upsert && stmts.upsertCols) {
    repo.upsert = function (data: unknown): ResourceType<R> {
      const dbData = data as DbRow;
      const pkValues = pkColumns.map((col) => dbData[col] as string);

      // Use cached upsert statement - map values in column order (excludes timestamps)
      const values = (stmts.upsertCols as string[]).map((col) => dbData[col] ?? null);
      (stmts.upsert as Database.Statement).run(...values);

      return repo.getById(...pkValues) as ResourceType<R>;
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
  broadcast?: (boardId: string, type: string) => void;
  hooks?: {
    /** @deprecated Use scheduleRankingRecalculation instead */
    recalculateFeedRankings?: (db: Database.Database, boardId: string) => void;
    /** Async ranking manager for non-blocking recalculation */
    scheduleRankingRecalculation?: (boardId: string) => void;
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
  const notify = (boardId: string | undefined, type: string): void => {
    if (broadcast && boardId) {
      broadcast(boardId, type);
    }
  };

  // GET all (or by parent)
  const parent = 'parent' in config ? config.parent : undefined;
  if (parent) {
    // Scoped under parent: GET /api/boards/:boardId/{resource}
    app.get(`/api/boards/:boardId/${resourceName}`, (req: Request, res: Response) => {
      const items = repo.getByParent?.(req.params.boardId) ?? [];
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
    // GET /api/diet?boardId=xxx
    router.get('/', (req: Request, res: Response) => {
      if (req.query.boardId) {
        const items = repo.getByBoardId?.(req.query.boardId as string) ?? [];
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
        const horse = repos.horses.getById(req.body.horse_id);
        if (horse) {
          if (hooks.scheduleRankingRecalculation) {
            // Non-blocking: schedule async recalculation, respond immediately
            hooks.scheduleRankingRecalculation(horse.board_id);
          } else if (hooks.recalculateFeedRankings) {
            // Legacy blocking path (deprecated)
            hooks.recalculateFeedRankings(db, horse.board_id);
            notify(horse.board_id, 'feeds');
          }
        }
      }

      res.json({ success: true, data: entry });
    });

    // DELETE /api/diet/:horse_id/:feed_id
    router.delete('/:horse_id/:feed_id', (req: Request, res: Response) => {
      const deleted = repo.delete(req.params.horse_id, req.params.feed_id);
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
    // Create under parent: POST /api/boards/:boardId/{resource}
    app.post(
      `/api/boards/:boardId/${resourceName}`,
      validate(config.createSchema),
      (req: Request, res: Response) => {
        try {
          const item = repo.create(req.body, req.params.boardId);
          notify(req.params.boardId, resourceName);
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
      const board_id = (existing as Record<string, unknown>).board_id as string | undefined;
      if (board_id) {
        notify(board_id, resourceName);
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
      const board_id = (existing as Record<string, unknown>)?.board_id as string | undefined;
      if (board_id) {
        notify(board_id, resourceName);
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

  addClient(boardId: string, res: Response): void {
    if (!this.clients.has(boardId)) {
      this.clients.set(boardId, new Set());
    }
    this.clients.get(boardId)!.add(res);

    res.on('close', () => {
      this.clients.get(boardId)?.delete(res);
    });
  }

  broadcast(boardId: string, type: string, data: unknown = null): void {
    const clients = this.clients.get(boardId);
    if (!clients) return;

    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

    for (const client of clients) {
      client.write(`data: ${message}\n\n`);
    }
  }

  sendKeepalive(): void {
    for (const [_boardId, clients] of this.clients) {
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
