import { z } from 'zod';

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

export const BulkUpsertDietSchema = z.object({
  entries: z.array(UpsertDietEntrySchema).min(1),
});
