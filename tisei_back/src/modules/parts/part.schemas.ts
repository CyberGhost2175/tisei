import { z } from 'zod';
import { cuidSchema } from '../../common/validation/common.schemas.js';

export const partSectionSchema = z.enum(['SERVICE', 'KFC']);

export const partIdParamSchema = z.object({ id: cuidSchema });

export const createPartBodySchema = z
  .object({
    name: z.string().min(1).max(255),
    section: partSectionSchema.default('SERVICE'),
    quantity: z.number().int().min(0).optional(),
    unitPrice: z.number().min(0),
  })
  .superRefine((data, ctx) => {
    if (data.section !== 'KFC' && data.quantity === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Количество обязательно для раздела СЕРВИС',
        path: ['quantity'],
      });
    }
  });

export const updatePartBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  section: partSectionSchema.optional(),
  quantity: z.number().int().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
});

export const bulkSetQuantityBodySchema = z.object({
  section: z.literal('SERVICE'),
  quantity: z.number().int().min(0),
});

export const partResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  section: partSectionSchema,
  quantity: z.number(),
  unitPrice: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const partsSpendingPeriodSchema = z.enum(['day', 'week', 'month', 'quarter']);

export const partsSpendingResponseSchema = z.object({
  period: partsSpendingPeriodSchema,
  from: z.string(),
  to: z.string(),
  totalSpent: z.number(),
  usageCount: z.number(),
  section: partSectionSchema.nullable().optional(),
});

export type PartSection = z.infer<typeof partSectionSchema>;
export type CreatePartBody = z.infer<typeof createPartBodySchema>;
export type UpdatePartBody = z.infer<typeof updatePartBodySchema>;
export type BulkSetQuantityBody = z.infer<typeof bulkSetQuantityBodySchema>;
export type PartsSpendingPeriod = z.infer<typeof partsSpendingPeriodSchema>;
