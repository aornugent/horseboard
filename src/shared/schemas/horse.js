import { z } from 'zod';

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
