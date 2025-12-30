import { Response } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import {
  HorseSchema,
  CreateHorseSchema,
  FeedSchema,
  CreateFeedSchema,
  DietEntrySchema,
  UpsertDietEntrySchema,
  BoardSchema,
  UpdateBoardSchema,
  type Horse,
  type Feed,
  type DietEntry,
  type Board,
  ControllerTokenSchema,
  CreateControllerTokenSchema,
  type ControllerToken,
} from '@shared/resources';

type DbRow = Record<string, unknown>;

export interface HorsesRepository {
  getById(id: string): Horse | null;
  getAll(): Horse[];
  getByParent(boardId: string): Horse[];
  create(data: unknown, boardId: string): Horse;
  update(data: unknown, id: string): Horse | null;
  delete(id: string): boolean;
}

export interface FeedsRepository {
  getById(id: string): Feed | null;
  getAll(): Feed[];
  getByParent(boardId: string): Feed[];
  create(data: unknown, boardId: string): Feed;
  update(data: unknown, id: string): Feed | null;
  delete(id: string): boolean;
}

export interface DietRepository {
  getById(horseId: string, feedId: string): DietEntry | null;
  getAll(): DietEntry[];
  getByBoardId(boardId: string): DietEntry[];
  upsert(data: unknown): DietEntry;
  delete(horseId: string, feedId: string): boolean;
}

export interface BoardsRepository {
  getById(id: string): Board | null;
  getAll(): Board[];
  getByPairCode(pairCode: string): Board | null;
  create(data: unknown): Board;
  update(data: unknown, id: string): Board | null;
  delete(id: string): boolean;
}

export interface ControllerTokensRepository {
  getById(id: string): ControllerToken | null;
  getByHash(hash: string): ControllerToken | null;
  getByBoard(boardId: string): ControllerToken[];
  create(data: unknown, boardId: string, tokenHash: string): ControllerToken;
  updateLastUsed(id: string): void;
  delete(id: string): boolean;
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

function toHorse(row: DbRow | undefined): Horse | null {
  if (!row) return null;
  row.archived = Boolean(row.archived);
  return row as Horse;
}

function toFeed(row: DbRow | undefined): Feed | null {
  if (!row) return null;
  return row as Feed;
}

function toDietEntry(row: DbRow | undefined): DietEntry | null {
  if (!row) return null;
  return row as DietEntry;
}

function toBoard(row: DbRow | undefined): Board | null {
  if (!row) return null;
  return row as Board;
}

function getSchemaColumns(schema: z.ZodObject<z.ZodRawShape>): string[] {
  return Object.keys(schema.shape);
}

export function createHorsesRepository(db: Database.Database): HorsesRepository {
  const columns = getSchemaColumns(HorseSchema);
  const selectCols = columns.join(', ');
  const updateCols = columns.filter(
    (col) => col !== 'id' && col !== 'created_at' && col !== 'updated_at'
  );
  const updateSetClause = updateCols.map((c) => `${c} = COALESCE(?, ${c})`).join(', ');

  const stmts = {
    getById: db.prepare(`SELECT ${selectCols} FROM horses WHERE id = ?`),
    getAll: db.prepare(
      `SELECT ${selectCols} FROM horses WHERE archived = 0 ORDER BY name`
    ),
    getByParent: db.prepare(
      `SELECT ${selectCols} FROM horses WHERE board_id = ? AND archived = 0 ORDER BY name`
    ),
    delete: db.prepare('DELETE FROM horses WHERE id = ?'),
    update: db.prepare(`UPDATE horses SET ${updateSetClause} WHERE id = ?`),
  };

  return {
    getById(id: string): Horse | null {
      return toHorse(stmts.getById.get(id) as DbRow | undefined);
    },

    getAll(): Horse[] {
      return (stmts.getAll.all() as DbRow[])
        .map(toHorse)
        .filter((h): h is Horse => h !== null);
    },

    getByParent(boardId: string): Horse[] {
      return (stmts.getByParent.all(boardId) as DbRow[])
        .map(toHorse)
        .filter((h): h is Horse => h !== null);
    },

    create(data: unknown, boardId: string): Horse {
      const parsed = CreateHorseSchema.parse(data) as DbRow;
      parsed.id = generateId('h');
      parsed.board_id = boardId;

      const cols = Object.keys(parsed);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => parsed[c]);

      db.prepare(`INSERT INTO horses (${cols.join(', ')}) VALUES (${placeholders})`).run(
        ...values
      );

      return this.getById(parsed.id as string) as Horse;
    },

    update(data: unknown, id: string): Horse | null {
      const dbData = data as DbRow;
      const values = updateCols.map((col) => dbData[col] ?? null);
      stmts.update.run(...values, id);
      return this.getById(id);
    },

    delete(id: string): boolean {
      const result = stmts.delete.run(id);
      return result.changes > 0;
    },
  };
}

export function createFeedsRepository(db: Database.Database): FeedsRepository {
  const columns = getSchemaColumns(FeedSchema);
  const selectCols = columns.join(', ');
  const updateCols = columns.filter(
    (col) => col !== 'id' && col !== 'created_at' && col !== 'updated_at'
  );
  const updateSetClause = updateCols.map((c) => `${c} = COALESCE(?, ${c})`).join(', ');

  const stmts = {
    getById: db.prepare(`SELECT ${selectCols} FROM feeds WHERE id = ?`),
    getAll: db.prepare(`SELECT ${selectCols} FROM feeds ORDER BY rank DESC, name`),
    getByParent: db.prepare(
      `SELECT ${selectCols} FROM feeds WHERE board_id = ? ORDER BY rank DESC, name`
    ),
    delete: db.prepare('DELETE FROM feeds WHERE id = ?'),
    update: db.prepare(`UPDATE feeds SET ${updateSetClause} WHERE id = ?`),
  };

  return {
    getById(id: string): Feed | null {
      return toFeed(stmts.getById.get(id) as DbRow | undefined);
    },

    getAll(): Feed[] {
      return (stmts.getAll.all() as DbRow[])
        .map(toFeed)
        .filter((f): f is Feed => f !== null);
    },

    getByParent(boardId: string): Feed[] {
      return (stmts.getByParent.all(boardId) as DbRow[])
        .map(toFeed)
        .filter((f): f is Feed => f !== null);
    },

    create(data: unknown, boardId: string): Feed {
      const parsed = CreateFeedSchema.parse(data) as DbRow;
      parsed.id = generateId('f');
      parsed.board_id = boardId;

      const cols = Object.keys(parsed);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => parsed[c]);

      db.prepare(`INSERT INTO feeds (${cols.join(', ')}) VALUES (${placeholders})`).run(
        ...values
      );

      return this.getById(parsed.id as string) as Feed;
    },

    update(data: unknown, id: string): Feed | null {
      const dbData = data as DbRow;
      const values = updateCols.map((col) => dbData[col] ?? null);
      stmts.update.run(...values, id);
      return this.getById(id);
    },

    delete(id: string): boolean {
      const result = stmts.delete.run(id);
      return result.changes > 0;
    },
  };
}

export function createDietRepository(db: Database.Database): DietRepository {
  const columns = getSchemaColumns(DietEntrySchema);
  const selectCols = columns.join(', ');
  const insertCols = columns.filter((c) => c !== 'created_at' && c !== 'updated_at');
  const updateCols = insertCols.filter((c) => c !== 'horse_id' && c !== 'feed_id');

  const stmts = {
    getById: db.prepare(
      `SELECT ${selectCols} FROM diet_entries WHERE horse_id = ? AND feed_id = ?`
    ),
    getAll: db.prepare(`SELECT ${selectCols} FROM diet_entries`),
    getByBoardId: db.prepare(`
      SELECT d.horse_id, d.feed_id, d.am_amount, d.pm_amount, d.created_at, d.updated_at
      FROM diet_entries d
      JOIN horses h ON d.horse_id = h.id
      WHERE h.board_id = ?
    `),
    delete: db.prepare('DELETE FROM diet_entries WHERE horse_id = ? AND feed_id = ?'),
    upsert: db.prepare(
      `INSERT INTO diet_entries (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')})
       ON CONFLICT(horse_id, feed_id) DO UPDATE SET ${updateCols.map((c) => `${c} = excluded.${c}`).join(', ')}`
    ),
  };

  return {
    getById(horseId: string, feedId: string): DietEntry | null {
      return toDietEntry(stmts.getById.get(horseId, feedId) as DbRow | undefined);
    },

    getAll(): DietEntry[] {
      return (stmts.getAll.all() as DbRow[])
        .map(toDietEntry)
        .filter((d): d is DietEntry => d !== null);
    },

    getByBoardId(boardId: string): DietEntry[] {
      return (stmts.getByBoardId.all(boardId) as DbRow[])
        .map(toDietEntry)
        .filter((d): d is DietEntry => d !== null);
    },

    upsert(data: unknown): DietEntry {
      const parsed = UpsertDietEntrySchema.parse(data) as DbRow;
      const values = insertCols.map((col) => parsed[col] ?? null);
      stmts.upsert.run(...values);
      return this.getById(parsed.horse_id as string, parsed.feed_id as string) as DietEntry;
    },

    delete(horseId: string, feedId: string): boolean {
      const result = stmts.delete.run(horseId, feedId);
      return result.changes > 0;
    },
  };
}

export function createControllerTokensRepository(
  db: Database.Database
): ControllerTokensRepository {
  const columns = getSchemaColumns(ControllerTokenSchema);
  const selectCols = columns.join(', ');

  const stmts = {
    getById: db.prepare(`SELECT ${selectCols} FROM controller_tokens WHERE id = ?`),
    getByHash: db.prepare(`SELECT ${selectCols} FROM controller_tokens WHERE token_hash = ?`),
    getByBoard: db.prepare(
      `SELECT ${selectCols} FROM controller_tokens WHERE board_id = ? ORDER BY created_at DESC`
    ),
    delete: db.prepare('DELETE FROM controller_tokens WHERE id = ?'),
    create: db.prepare(
      `INSERT INTO controller_tokens (id, board_id, token_hash, name, permission, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ),
    updateLastUsed: db.prepare(
      `UPDATE controller_tokens SET last_used_at = datetime('now') WHERE id = ?`
    ),
  };

  function toControllerToken(row: DbRow | undefined): ControllerToken | null {
    if (!row) return null;
    return row as ControllerToken;
  }

  return {
    getById(id: string): ControllerToken | null {
      return toControllerToken(stmts.getById.get(id) as DbRow | undefined);
    },

    getByHash(hash: string): ControllerToken | null {
      return toControllerToken(stmts.getByHash.get(hash) as DbRow | undefined);
    },

    getByBoard(boardId: string): ControllerToken[] {
      return (stmts.getByBoard.all(boardId) as DbRow[])
        .map(toControllerToken)
        .filter((t): t is ControllerToken => t !== null);
    },

    create(data: unknown, boardId: string, tokenHash: string): ControllerToken {
      const parsed = CreateControllerTokenSchema.parse(data);
      const id = generateId('ct');

      stmts.create.run(
        id,
        boardId,
        tokenHash,
        parsed.name,
        parsed.permission,
        parsed.expires_at || null
      );

      return this.getById(id) as ControllerToken;
    },

    updateLastUsed(id: string): void {
      stmts.updateLastUsed.run(id);
    },

    delete(id: string): boolean {
      const result = stmts.delete.run(id);
      return result.changes > 0;
    },
  };
}

export function createBoardsRepository(db: Database.Database): BoardsRepository {
  const columns = getSchemaColumns(BoardSchema);
  const selectCols = columns.join(', ');
  const updateCols = columns.filter(
    (col) => col !== 'id' && col !== 'created_at' && col !== 'updated_at'
  );
  const updateSetClause = updateCols.map((c) => `${c} = COALESCE(?, ${c})`).join(', ');

  const stmts = {
    getById: db.prepare(`SELECT ${selectCols} FROM boards WHERE id = ?`),
    getAll: db.prepare(`SELECT ${selectCols} FROM boards`),
    getByPairCode: db.prepare(`SELECT ${selectCols} FROM boards WHERE pair_code = ?`),
    delete: db.prepare('DELETE FROM boards WHERE id = ?'),
    update: db.prepare(`UPDATE boards SET ${updateSetClause} WHERE id = ?`),
  };

  const CreateBoardSchema = UpdateBoardSchema.extend({
    timezone: UpdateBoardSchema.shape.timezone.default('Australia/Sydney'),
    account_id: z.string().optional().nullable(),
  });

  return {
    getById(id: string): Board | null {
      return toBoard(stmts.getById.get(id) as DbRow | undefined);
    },

    getAll(): Board[] {
      return (stmts.getAll.all() as DbRow[])
        .map(toBoard)
        .filter((b): b is Board => b !== null);
    },

    getByPairCode(pairCode: string): Board | null {
      return toBoard(stmts.getByPairCode.get(pairCode) as DbRow | undefined);
    },

    create(data: unknown): Board {
      const parsed = CreateBoardSchema.parse(data) as DbRow;
      parsed.id = generateId('b');
      parsed.pair_code = generatePairCode(db);

      const cols = Object.keys(parsed);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => parsed[c]);

      db.prepare(`INSERT INTO boards (${cols.join(', ')}) VALUES (${placeholders})`).run(
        ...values
      );

      return this.getById(parsed.id as string) as Board;
    },

    update(data: unknown, id: string): Board | null {
      const dbData = data as DbRow;
      const values = updateCols.map((col) => dbData[col] ?? null);
      stmts.update.run(...values, id);
      return this.getById(id);
    },

    delete(id: string): boolean {
      const result = stmts.delete.run(id);
      return result.changes > 0;
    },
  };
}

export { FeedRankingManager } from './rankings';

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

  broadcast(boardId: string, data: unknown = null): void {
    const clients = this.clients.get(boardId);
    if (!clients) return;

    const message = JSON.stringify({ data, timestamp: new Date().toISOString() });

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
