import { z } from 'zod';
import { cuidSchema } from '../../common/validation/common.schemas.js';

export const repairActPeriodQuerySchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Формат периода: YYYY-MM')
    .optional(),
});

export const repairActPdfQuerySchema = repairActPeriodQuerySchema.extend({
  access_token: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
});

export const partnerIdParamSchema = z.object({
  partnerId: cuidSchema,
});

export const locationIdParamSchema = z.object({
  locationId: cuidSchema,
});

export const updateRepairActSettingBodySchema = z.object({
  actDate: z.coerce.date().nullable().optional(),
  actNumber: z.number().int().min(1).nullable().optional(),
});

export type UpdateRepairActSettingBody = z.infer<typeof updateRepairActSettingBodySchema>;
