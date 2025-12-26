import { z } from 'zod';

// Unit enum for feeds
export const UnitSchema = z.enum(['scoop', 'ml', 'sachet', 'biscuit']);

// Time mode enum for displays
export const TimeModeSchema = z.enum(['AUTO', 'AM', 'PM']);

// =============================================================================
// HORSES
// =============================================================================

export const HorseSchema = z.object({
  id: z.string().min(1),
  displayId: z.string().min(1),
  name: z.string().min(1).max(50),
  note: z.string().max(200).nullable(),
  noteExpiry: z.string().nullable(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

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
  displayId: z.string().min(1),
  name: z.string().min(1).max(50),
  unit: UnitSchema,
  rank: z.number().int().min(0),
  stockLevel: z.number().min(0),
  lowStockThreshold: z.number().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

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

export const UpsertDietEntrySchema = z.object({
  horseId: z.string().min(1),
  feedId: z.string().min(1),
  amAmount: z.number().min(0).optional().nullable(),
  pmAmount: z.number().min(0).optional().nullable(),
});

// =============================================================================
// DISPLAYS
// =============================================================================

export const DisplaySchema = z.object({
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

export const UpdateDisplaySchema = z.object({
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
      displayId: 'display_id',
      name: 'name',
      note: 'note',
      noteExpiry: 'note_expiry',
      archived: 'archived',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    indexes: ['display_id'],
    parent: { resource: 'displays', foreignKey: 'displayId' },
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
      displayId: 'display_id',
      name: 'name',
      unit: 'unit',
      rank: 'rank',
      stockLevel: 'stock_level',
      lowStockThreshold: 'low_stock_threshold',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    indexes: ['display_id'],
    parent: { resource: 'displays', foreignKey: 'displayId' },
    orderBy: 'rank DESC, name',
    onWrite: 'recalculateFeedRankings',
  },

  diet: {
    table: 'diet_entries',
    primaryKey: ['horseId', 'feedId'],
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

  displays: {
    table: 'displays',
    primaryKey: 'id',
    schema: DisplaySchema,
    createSchema: z.object({ timezone: z.string().optional() }),
    updateSchema: UpdateDisplaySchema,
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
};
