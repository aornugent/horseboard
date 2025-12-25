import { z } from 'zod';

export const UnitSchema = z.enum(['scoop', 'ml', 'sachet', 'biscuit']);

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
