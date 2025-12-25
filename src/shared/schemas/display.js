import { z } from 'zod';

export const TimeModeSchema = z.enum(['AUTO', 'AM', 'PM']);

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
