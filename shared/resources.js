import { z } from 'zod';

/**
 * The DNA of HorseBoard - all resources defined in one place.
 *
 * Each resource defines:
 * - table: SQL table name
 * - primaryKey: Column(s) that form the primary key
 * - schema: Zod schema for validation (API format with camelCase)
 * - columns: SQL column definitions (snake_case in DB, mapped to camelCase)
 * - indexes: Optional additional indexes
 * - parentKey: For scoped resources (displayId)
 * - onWrite: Optional hook triggered after writes
 */

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

export const UnitSchema = z.enum(['scoop', 'ml', 'sachet', 'biscuit']);
export const TimeModeSchema = z.enum(['AUTO', 'AM', 'PM']);

// =============================================================================
// RESOURCE DEFINITIONS
// =============================================================================

export const RESOURCES = {
  /**
   * Horses - belong to a display, have notes with optional expiry
   */
  horses: {
    table: 'horses',
    primaryKey: ['id'],
    parentKey: 'displayId',
    schema: z.object({
      id: z.string().min(1),
      displayId: z.string().min(1),
      name: z.string().min(1).max(50),
      note: z.string().max(200).nullable().optional(),
      noteExpiry: z.number().nullable().optional(),
      noteCreatedAt: z.number().nullable().optional(),
    }),
    columns: {
      id: 'TEXT PRIMARY KEY',
      display_id: 'TEXT NOT NULL REFERENCES displays(id) ON DELETE CASCADE',
      name: 'TEXT NOT NULL',
      note: 'TEXT',
      note_expiry: 'INTEGER',
      note_created_at: 'INTEGER',
      created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
    },
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_horses_display ON horses(display_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_horses_name ON horses(display_id, name)',
    ],
    // Map camelCase API fields to snake_case DB columns
    fieldMap: {
      id: 'id',
      displayId: 'display_id',
      name: 'name',
      note: 'note',
      noteExpiry: 'note_expiry',
      noteCreatedAt: 'note_created_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },

  /**
   * Feeds - belong to a display, ranked by usage
   */
  feeds: {
    table: 'feeds',
    primaryKey: ['id'],
    parentKey: 'displayId',
    schema: z.object({
      id: z.string().min(1),
      displayId: z.string().min(1),
      name: z.string().min(1).max(50),
      unit: UnitSchema.default('scoop'),
      rank: z.number().int().min(0).default(0),
    }),
    columns: {
      id: 'TEXT PRIMARY KEY',
      display_id: 'TEXT NOT NULL REFERENCES displays(id) ON DELETE CASCADE',
      name: 'TEXT NOT NULL',
      unit: 'TEXT NOT NULL DEFAULT "scoop"',
      rank: 'INTEGER DEFAULT 0',
      created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
    },
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_feeds_display ON feeds(display_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_feeds_name ON feeds(display_id, name)',
    ],
    fieldMap: {
      id: 'id',
      displayId: 'display_id',
      name: 'name',
      unit: 'unit',
      rank: 'rank',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    // Trigger ranking recalculation after any diet change
    onWrite: 'recalculateFeedRankings',
  },

  /**
   * Diet entries - junction table linking horses to feeds with AM/PM quantities
   * Uses composite primary key (horseId, feedId)
   */
  diet: {
    table: 'diet_entries',
    primaryKey: ['horseId', 'feedId'],
    schema: z.object({
      horseId: z.string().min(1),
      feedId: z.string().min(1),
      am: z.number().min(0).max(100).nullable().optional(),
      pm: z.number().min(0).max(100).nullable().optional(),
    }),
    columns: {
      horse_id: 'TEXT NOT NULL REFERENCES horses(id) ON DELETE CASCADE',
      feed_id: 'TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE',
      am: 'REAL',
      pm: 'REAL',
      created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
    },
    constraints: [
      'PRIMARY KEY (horse_id, feed_id)',
    ],
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_diet_horse ON diet_entries(horse_id)',
      'CREATE INDEX IF NOT EXISTS idx_diet_feed ON diet_entries(feed_id)',
    ],
    fieldMap: {
      horseId: 'horse_id',
      feedId: 'feed_id',
      am: 'am',
      pm: 'pm',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    // Trigger ranking recalculation after diet changes
    onWrite: 'recalculateFeedRankings',
  },
};

// =============================================================================
// DISPLAY RESOURCE (special - not auto-mounted, has custom logic)
// =============================================================================

export const DisplaySchema = z.object({
  id: z.string().min(1),
  pairCode: z.string().length(6),
  timezone: z.string().default('Australia/Sydney'),
  timeMode: TimeModeSchema.default('AUTO'),
  overrideUntil: z.number().nullable().optional(),
  zoomLevel: z.number().int().min(1).max(3).default(2),
  currentPage: z.number().int().min(0).default(0),
});

export const DISPLAY_TABLE = {
  table: 'displays',
  columns: {
    id: 'TEXT PRIMARY KEY',
    pair_code: 'TEXT UNIQUE NOT NULL',
    timezone: 'TEXT DEFAULT "Australia/Sydney"',
    time_mode: 'TEXT DEFAULT "AUTO"',
    override_until: 'INTEGER',
    zoom_level: 'INTEGER DEFAULT 2',
    current_page: 'INTEGER DEFAULT 0',
    created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  },
  fieldMap: {
    id: 'id',
    pairCode: 'pair_code',
    timezone: 'timezone',
    timeMode: 'time_mode',
    overrideUntil: 'override_until',
    zoomLevel: 'zoom_level',
    currentPage: 'current_page',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert API object (camelCase) to DB row (snake_case)
 */
export function toDbRow(data, fieldMap) {
  const row = {};
  for (const [apiKey, dbKey] of Object.entries(fieldMap)) {
    if (data[apiKey] !== undefined) {
      row[dbKey] = data[apiKey];
    }
  }
  return row;
}

/**
 * Convert DB row (snake_case) to API object (camelCase)
 */
export function toApiObject(row, fieldMap) {
  if (!row) return null;
  const obj = {};
  for (const [apiKey, dbKey] of Object.entries(fieldMap)) {
    if (row[dbKey] !== undefined) {
      obj[apiKey] = row[dbKey];
    }
  }
  return obj;
}

/**
 * Get the type inferred from a Zod schema
 * @template {z.ZodTypeAny} T
 * @param {T} schema
 * @returns {z.infer<T>}
 */
export function inferType(schema) {
  return /** @type {z.infer<typeof schema>} */ ({});
}
