import { Response } from 'express';
import { z } from 'zod';
import {
  ResourceName,
  ResourceType,
  isResourceName,
  getResourceConfig,
} from '@shared/resources';
import type Database from 'better-sqlite3';

type DbRow = Record<string, unknown>;

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

export function generateId(prefix = 'd'): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${hex}`;
}

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

function toResourceType<R extends ResourceName>(
  row: DbRow | undefined
): ResourceType<R> | null {
  if (!row) return null;

  if ('archived' in row) {
    row.archived = Boolean(row.archived);
  }

  return row as ResourceType<R>;
}

function getSchemaColumns(schema: z.ZodObject<z.ZodRawShape>): string[] {
  return Object.keys(schema.shape);
}

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

  const allColumns = getSchemaColumns(schema);
  const selectCols = allColumns.join(', ');
  const pkWhere = pkColumns.map((col) => `${col} = ?`).join(' AND ');

  const updateCols = allColumns.filter(
    (col) => !pkColumns.includes(col) && col !== 'created_at' && col !== 'updated_at'
  );
  const updateSetClause = updateCols.map((c) => `${c} = COALESCE(?, ${c})`).join(', ');

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

  const parent = 'parent' in config ? config.parent : undefined;
  if (parent) {
    stmts.getByParent = db.prepare(
      `SELECT ${selectCols} FROM ${table} WHERE ${parent.foreignKey} = ?` +
        (filter ? ` AND ${filter}` : '') +
        (orderBy ? ` ORDER BY ${orderBy}` : '')
    );
  }

  if (resourceName === 'diet') {
    stmts.getByBoardId = db.prepare(`
      SELECT d.horse_id, d.feed_id, d.am_amount, d.pm_amount, d.created_at, d.updated_at
      FROM diet_entries d
      JOIN horses h ON d.horse_id = h.id
      WHERE h.board_id = ?
    `);
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

  if (resourceName === 'boards') {
    stmts.getByPairCode = db.prepare(
      `SELECT ${selectCols} FROM ${table} WHERE pair_code = ?`
    );
  }

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
      const parsed = config.createSchema.parse(data) as DbRow;

      if (!isComposite) {
        const prefix = resourceName.charAt(0);
        parsed[primaryKey as string] = generateId(prefix);
      }

      if (parentId && parent) {
        parsed[parent.foreignKey] = parentId;
      }

      if (resourceName === 'boards') {
        parsed.pair_code = generatePairCode(db);
        if (!parsed.timezone) parsed.timezone = 'Australia/Sydney';
      }

      const cols = Object.keys(parsed);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => parsed[c]);

      db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(
        ...values
      );

      if (isComposite) {
        const pkValues = pkColumns.map((k) => parsed[k] as string);
        return this.getById(...pkValues) as ResourceType<R>;
      }
      return this.getById(parsed[primaryKey as string] as string) as ResourceType<R>;
    },

    update(data: unknown, ...pkValues: string[]): ResourceType<R> | null {
      if (!stmts.update) return this.getById(...pkValues);

      const dbData = data as DbRow;
      const values = updateCols.map((col) => dbData[col] ?? null);
      (stmts.update as Database.Statement).run(...values, ...pkValues);

      return this.getById(...pkValues);
    },

    delete(...pkValues: string[]): boolean {
      const result = (stmts.delete as Database.Statement).run(...pkValues);
      return result.changes > 0;
    },
  };

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
      const values = (stmts.upsertCols as string[]).map((col) => dbData[col] ?? null);
      (stmts.upsert as Database.Statement).run(...values);

      return repo.getById(...pkValues) as ResourceType<R>;
    };
  }

  return repo;
}

export { recalculateFeedRankings, FeedRankingManager } from './rankings';

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
          clients.delete(client);
        }
      }
    }
  }
}
