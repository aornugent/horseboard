import { z } from 'zod';

// =============================================================================
// UNIT ENUM - Single source of truth for feed units
// =============================================================================

export const UnitSchema = z.enum(['scoop', 'ml', 'sachet', 'biscuit']);
export type Unit = z.infer<typeof UnitSchema>;

/** All valid unit values as an array */
export const UNITS = UnitSchema.options;

/** Unit value constants for type-safe usage */
export const UNIT = {
  SCOOP: 'scoop',
  ML: 'ml',
  SACHET: 'sachet',
  BISCUIT: 'biscuit',
} as const satisfies Record<string, Unit>;

/** Unit display labels for UI */
export const UNIT_LABELS: Record<Unit, string> = {
  scoop: 'Scoop',
  ml: 'ml',
  sachet: 'Sachet',
  biscuit: 'Biscuit',
};

/** Default unit for new feeds */
export const DEFAULT_UNIT: Unit = 'scoop';

// =============================================================================
// TIME MODE ENUM - Single source of truth for board time modes
// =============================================================================

export const TimeModeSchema = z.enum(['AUTO', 'AM', 'PM']);
export type TimeMode = z.infer<typeof TimeModeSchema>;

/** Effective time mode (excludes AUTO) */
export type EffectiveTimeMode = 'AM' | 'PM';

/** All valid time mode values as an array */
export const TIME_MODES = TimeModeSchema.options;

/** Time mode value constants for type-safe usage */
export const TIME_MODE = {
  AUTO: 'AUTO',
  AM: 'AM',
  PM: 'PM',
} as const satisfies Record<string, TimeMode>;

/** Time mode configuration for UI */
export const TIME_MODE_CONFIG: Record<TimeMode, { label: string; description: string }> = {
  AUTO: { label: 'Auto', description: 'AM 4:00-11:59, PM 12:00-3:59' },
  AM: { label: 'AM', description: 'Force morning feed board' },
  PM: { label: 'PM', description: 'Force evening feed board' },
};

/** Default time mode for new boards */
export const DEFAULT_TIME_MODE: TimeMode = 'AUTO';

/**
 * Resource configuration type
 */
export interface ResourceConfig<T extends z.ZodObject<z.ZodRawShape>> {
  table: string;
  primaryKey: string | string[];
  schema: T;
  createSchema: z.ZodObject<z.ZodRawShape>;
  updateSchema: z.ZodObject<z.ZodRawShape>;
  // Column mapping: camelCase -> snake_case
  columns: Record<string, string>;
  // Indexes for the table
  indexes?: string[];
  // Hook triggered after write operations
  onWrite?: string;
  // Parent resource for scoped routes (e.g., horses belong to boards)
  parent?: { resource: string; foreignKey: string };
  // Order by clause
  orderBy?: string;
  // Filter clause (e.g., archived = 0)
  filter?: string;
}

// =============================================================================
// HORSES
// =============================================================================

export const HorseSchema = z.object({
  id: z.string().min(1),
  boardId: z.string().min(1),
  name: z.string().min(1).max(50),
  note: z.string().max(200).nullable(),
  noteExpiry: z.string().nullable(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Horse = z.infer<typeof HorseSchema>;

export const CreateHorseSchema = z.object({
  name: z.string().min(1).max(50),
  note: z.string().max(200).optional().nullable(),
  noteExpiry: z.string().optional().nullable(),
});

export const UpdateHorseSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  note: z.string().max(200).optional().nullable(),
  noteExpiry: z.string().optional().nullable(),
});

// =============================================================================
// FEEDS
// =============================================================================

export const FeedSchema = z.object({
  id: z.string().min(1),
  boardId: z.string().min(1),
  name: z.string().min(1).max(50),
  unit: UnitSchema,
  rank: z.number().int().min(0),
  stockLevel: z.number().min(0),
  lowStockThreshold: z.number().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Feed = z.infer<typeof FeedSchema>;

export const CreateFeedSchema = z.object({
  name: z.string().min(1).max(50),
  unit: UnitSchema.optional().default('scoop'),
});

export const UpdateFeedSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  unit: UnitSchema.optional(),
  stockLevel: z.number().min(0).optional(),
  lowStockThreshold: z.number().min(0).optional(),
});

// =============================================================================
// DIET ENTRIES
// =============================================================================

export const DietEntrySchema = z.object({
  horseId: z.string().min(1),
  feedId: z.string().min(1),
  amAmount: z.number().min(0).nullable(),
  pmAmount: z.number().min(0).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DietEntry = z.infer<typeof DietEntrySchema>;

export const UpsertDietEntrySchema = z.object({
  horseId: z.string().min(1),
  feedId: z.string().min(1),
  amAmount: z.number().min(0).optional().nullable(),
  pmAmount: z.number().min(0).optional().nullable(),
});

// =============================================================================
// BOARDS
// =============================================================================

export const BoardSchema = z.object({
  id: z.string().min(1),
  pairCode: z.string().length(6),
  timezone: z.string().min(1),
  timeMode: TimeModeSchema,
  overrideUntil: z.string().nullable(),
  zoomLevel: z.number().int().min(1).max(3),
  currentPage: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Board = z.infer<typeof BoardSchema>;

export const UpdateBoardSchema = z.object({
  timezone: z.string().min(1).optional(),
  zoomLevel: z.number().int().min(1).max(3).optional(),
  currentPage: z.number().int().min(0).optional(),
});

export const SetTimeModeSchema = z.object({
  timeMode: TimeModeSchema,
  overrideUntil: z.string().optional().nullable(),
});

// =============================================================================
// RESOURCES CONFIGURATION - THE DNA
// =============================================================================

export const RESOURCES = {
  horses: {
    table: 'horses',
    primaryKey: 'id',
    schema: HorseSchema,
    createSchema: CreateHorseSchema,
    updateSchema: UpdateHorseSchema,
    columns: {
      id: 'id',
      boardId: 'board_id',
      name: 'name',
      note: 'note',
      noteExpiry: 'note_expiry',
      archived: 'archived',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    indexes: ['board_id'],
    parent: { resource: 'boards', foreignKey: 'boardId' },
    orderBy: 'name',
    filter: 'archived = 0',
  },

  feeds: {
    table: 'feeds',
    primaryKey: 'id',
    schema: FeedSchema,
    createSchema: CreateFeedSchema,
    updateSchema: UpdateFeedSchema,
    columns: {
      id: 'id',
      boardId: 'board_id',
      name: 'name',
      unit: 'unit',
      rank: 'rank',
      stockLevel: 'stock_level',
      lowStockThreshold: 'low_stock_threshold',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    indexes: ['board_id'],
    parent: { resource: 'boards', foreignKey: 'boardId' },
    orderBy: 'rank DESC, name',
    // Trigger feed ranking recalculation after diet changes
    onWrite: 'recalculateFeedRankings',
  },

  diet: {
    table: 'diet_entries',
    primaryKey: ['horseId', 'feedId'] as const,
    schema: DietEntrySchema,
    createSchema: UpsertDietEntrySchema,
    updateSchema: UpsertDietEntrySchema,
    columns: {
      horseId: 'horse_id',
      feedId: 'feed_id',
      amAmount: 'am_amount',
      pmAmount: 'pm_amount',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    indexes: ['horse_id', 'feed_id'],
  },

  boards: {
    table: 'boards',
    primaryKey: 'id',
    schema: BoardSchema,
    createSchema: z.object({ timezone: z.string().optional() }),
    updateSchema: UpdateBoardSchema,
    columns: {
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
  },
} as const;

export type ResourceName = keyof typeof RESOURCES;

// =============================================================================
// TYPE UTILITIES FOR STRICT TYPE PROPAGATION
// =============================================================================

/**
 * Extract the API type (camelCase) from a resource's schema
 */
export type ApiType<R extends ResourceName> = z.infer<(typeof RESOURCES)[R]['schema']>;

/**
 * Extract the column mapping type for a resource
 */
export type ColumnMapping<R extends ResourceName> = (typeof RESOURCES)[R]['columns'];

/**
 * Database row type - generic record returned by SQLite
 * The actual structure maps snake_case column names to values
 */
export type DbRow = Record<string, unknown>;

/**
 * Type guard to check if a string is a valid resource name
 */
export function isResourceName(name: string): name is ResourceName {
  return name in RESOURCES;
}

/**
 * Get resource configuration with proper typing
 */
export function getResourceConfig<R extends ResourceName>(name: R): (typeof RESOURCES)[R] {
  return RESOURCES[name];
}
