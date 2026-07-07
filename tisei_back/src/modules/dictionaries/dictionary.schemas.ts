import { z } from 'zod';

export const dictionaryNameSchema = z.enum([
  'equipment-categories',
  'malfunction-types',
  'freeze-reasons',
]);

export const dictionaryParamSchema = z.object({
  type: dictionaryNameSchema,
});

export const dictionaryIdParamSchema = z.object({
  type: dictionaryNameSchema,
  id: z.string(),
});

export const createDictionaryBodySchema = z.object({
  name: z.string().min(1).max(255),
});

export const updateDictionaryBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
});

export type DictionaryType = z.infer<typeof dictionaryNameSchema>;
