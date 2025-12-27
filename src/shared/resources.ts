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
  board_id: z.string().min(1),
  name: z.string().min(1).max(50),
  note: z.string().max(200).nullable(),
  note_expiry: z.string().nullable(),
  archived: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Horse = z.infer<typeof HorseSchema>;

export const CreateHorseSchema = z.object({
  name: z.string().min(1).max(50),
  note: z.string().max(200).optional().nullable(),
  note_expiry: z.string().optional().nullable(),
});

export const UpdateHorseSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  note: z.string().max(200).optional().nullable(),
  note_expiry: z.string().optional().nullable(),
});

// =============================================================================
// FEEDS
// =============================================================================

export const FeedSchema = z.object({
  id: z.string().min(1),
  board_id: z.string().min(1),
  name: z.string().min(1).max(50),
  unit: UnitSchema,
  rank: z.number().int().min(0),
  stock_level: z.number().min(0),
  low_stock_threshold: z.number().min(0),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Feed = z.infer<typeof FeedSchema>;

export const CreateFeedSchema = z.object({
  name: z.string().min(1).max(50),
  unit: UnitSchema.optional().default('scoop'),
});

export const UpdateFeedSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  unit: UnitSchema.optional(),
  stock_level: z.number().min(0).optional(),
  low_stock_threshold: z.number().min(0).optional(),
});

// =============================================================================
// DIET ENTRIES
// =============================================================================

export const DietEntrySchema = z.object({
  horse_id: z.string().min(1),
  feed_id: z.string().min(1),
  am_amount: z.number().min(0).nullable(),
  pm_amount: z.number().min(0).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type DietEntry = z.infer<typeof DietEntrySchema>;

export const UpsertDietEntrySchema = z.object({
  horse_id: z.string().min(1),
  feed_id: z.string().min(1),
  am_amount: z.number().min(0).optional().nullable(),
  pm_amount: z.number().min(0).optional().nullable(),
});

// =============================================================================
// BOARDS
// =============================================================================

export const BoardSchema = z.object({
  id: z.string().min(1),
  pair_code: z.string().length(6),
  timezone: z.string().min(1),
  time_mode: TimeModeSchema,
  override_until: z.string().nullable(),
  zoom_level: z.number().int().min(1).max(3),
  current_page: z.number().int().min(0),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Board = z.infer<typeof BoardSchema>;

export const UpdateBoardSchema = z.object({
  timezone: z.string().min(1).optional(),
  zoom_level: z.number().int().min(1).max(3).optional(),
  current_page: z.number().int().min(0).optional(),
});

export const SetTimeModeSchema = z.object({
  time_mode: TimeModeSchema,
  override_until: z.string().optional().nullable(),
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
    indexes: ['board_id'],
    parent: { resource: 'boards', foreignKey: 'board_id' },
    orderBy: 'name',
    filter: 'archived = 0',
  },

  feeds: {
    table: 'feeds',
    primaryKey: 'id',
    schema: FeedSchema,
    createSchema: CreateFeedSchema,
    updateSchema: UpdateFeedSchema,
    indexes: ['board_id'],
    parent: { resource: 'boards', foreignKey: 'board_id' },
    orderBy: 'rank DESC, name',
    onWrite: 'recalculateFeedRankings',
  },

  diet: {
    table: 'diet_entries',
    primaryKey: ['horse_id', 'feed_id'] as const,
    schema: DietEntrySchema,
    createSchema: UpsertDietEntrySchema,
    updateSchema: UpsertDietEntrySchema,
    indexes: ['horse_id', 'feed_id'],
  },

  boards: {
    table: 'boards',
    primaryKey: 'id',
    schema: BoardSchema,
    createSchema: z.object({ timezone: z.string().optional() }),
    updateSchema: UpdateBoardSchema,
  },
} as const;

export type ResourceName = keyof typeof RESOURCES;

// =============================================================================
// TYPE UTILITIES FOR STRICT TYPE PROPAGATION
// =============================================================================

/**
 * Extract the resource type from a resource's schema
 * Property names match database column names exactly (snake_case)
 */
export type ResourceType<R extends ResourceName> = z.infer<(typeof RESOURCES)[R]['schema']>;

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
