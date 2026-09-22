import { z } from 'zod';
import { cuidSchema } from '../../common/validation/common.schemas.js';

export const requestIdParamSchema = z.object({ id: cuidSchema });

export const usageIdParamSchema = z.object({
  id: cuidSchema,
  usageId: cuidSchema,
});

export const createPartUsageBodySchema = z.object({
  partId: cuidSchema,
  quantity: z.number().int().min(1),
});

export const partUsageResponseSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  partId: z.string().nullable(),
  partNameSnapshot: z.string(),
  unitPriceSnapshot: z.number(),
  quantity: z.number(),
  lineTotal: z.number(),
  addedById: z.string().nullable(),
  createdAt: z.string(),
  addedBy: z.object({ id: z.string(), fullName: z.string() }).nullable().optional(),
});

export type CreatePartUsageBody = z.infer<typeof createPartUsageBodySchema>;
