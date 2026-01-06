import { z } from 'zod';
import { UnitTypeSchema } from './unit-strategies';



// Re-export UnitType for convenience
export { UnitTypeSchema };
export type UnitType = z.infer<typeof UnitTypeSchema>;

export const DEFAULT_UNIT_TYPE = 'fraction' as const;
export const DEFAULT_UNIT_LABEL = 'scoop' as const;

// Keep UNIT_LABELS for display (now tied to unit_label, not enum)
export const UNIT_TYPE_DEFAULT_LABELS: Record<z.infer<typeof UnitTypeSchema>, string> = {
  fraction: 'scoop',
  int: 'biscuit',
  decimal: 'ml',
  choice: '',
};

export const TimeModeSchema = z.enum(['AUTO', 'AM', 'PM']);
export type TimeMode = z.infer<typeof TimeModeSchema>;

export type EffectiveTimeMode = 'AM' | 'PM';

export const TIME_MODES = TimeModeSchema.options;

export const TIME_MODE = {
  AUTO: 'AUTO',
  AM: 'AM',
  PM: 'PM',
} as const satisfies Record<string, TimeMode>;

export const TIME_MODE_CONFIG: Record<TimeMode, { label: string; description: string }> = {
  AUTO: { label: 'Auto', description: 'AM 4:00-11:59, PM 12:00-3:59' },
  AM: { label: 'AM', description: 'Force morning feed board' },
  PM: { label: 'PM', description: 'Force evening feed board' },
};

export const DEFAULT_TIME_MODE: TimeMode = 'AUTO';

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

export const FeedSchema = z.object({
  id: z.string().min(1),
  board_id: z.string().min(1),
  name: z.string().min(1).max(50),
  unit_type: UnitTypeSchema,
  unit_label: z.string().min(1).max(20),
  entry_options: z.string().nullable(), // JSON string
  rank: z.number().int().min(0),
  stock_level: z.number().min(0),
  low_stock_threshold: z.number().min(0),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Feed = z.infer<typeof FeedSchema>;

export const CreateFeedSchema = z.object({
  name: z.string().min(1).max(50),
  unit_type: UnitTypeSchema.optional().default('fraction'),
  unit_label: z.string().min(1).max(20).optional(),
  entry_options: z.string().nullable().optional(),
});

export const UpdateFeedSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  unit_type: UnitTypeSchema.optional(),
  unit_label: z.string().min(1).max(20).optional(),
  entry_options: z.string().nullable().optional(),
  stock_level: z.number().min(0).optional(),
  low_stock_threshold: z.number().min(0).optional(),
});

export const DietEntrySchema = z.object({
  horse_id: z.string().min(1),
  feed_id: z.string().min(1),
  am_amount: z.number().min(0).nullable(),
  pm_amount: z.number().min(0).nullable(),
  am_variant: z.string().nullable(),
  pm_variant: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type DietEntry = z.infer<typeof DietEntrySchema>;

export const UpsertDietEntrySchema = z.object({
  horse_id: z.string().min(1),
  feed_id: z.string().min(1),
  am_amount: z.number().min(0).optional().nullable(),
  pm_amount: z.number().min(0).optional().nullable(),
  am_variant: z.string().optional().nullable(),
  pm_variant: z.string().optional().nullable(),
});


export const BoardOrientationSchema = z.enum(['horse-major', 'feed-major']);
export type BoardOrientation = z.infer<typeof BoardOrientationSchema>;

export const BoardSchema = z.object({
  id: z.string().min(1),
  pair_code: z.string().length(6),
  timezone: z.string().min(1),
  time_mode: TimeModeSchema,
  override_until: z.string().nullable(),
  zoom_level: z.number().int().min(1).max(3),
  current_page: z.number().int().min(0),
  orientation: BoardOrientationSchema.default('horse-major'),
  account_id: z.string().nullable(), // Added for ownership
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

export const SetOrientationSchema = z.object({
  orientation: BoardOrientationSchema,
});


export const ControllerTokenSchema = z.object({
  id: z.string(),
  board_id: z.string(),
  // token_hash is internal, strict schema for API might exclude it or include it.
  // For shared resources, it's often better to match DB row.
  token_hash: z.string(),
  name: z.string().min(1).max(50),
  type: z.enum(['controller', 'display']).default('controller'),
  permission: z.enum(['view', 'edit']),
  last_used_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ControllerToken = z.infer<typeof ControllerTokenSchema>;

export const CreateControllerTokenSchema = z.object({
  name: z.string().min(1).max(50),
  permission: z.enum(['view', 'edit']).default('edit'),
  expires_at: z.string().optional().nullable(),
  type: z.enum(['controller', 'display']).default('controller'),
});
