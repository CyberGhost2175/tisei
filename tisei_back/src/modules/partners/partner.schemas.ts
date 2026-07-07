import { z } from 'zod';
import { cuidSchema } from '../../common/validation/common.schemas.js';

export const partnerIdParamSchema = z.object({ id: cuidSchema });

export const createPartnerBodySchema = z.object({
  name: z.string().min(1).max(255),
  aliases: z.array(z.string().min(1).max(255)).default([]),
});

export const updatePartnerBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  aliases: z.array(z.string().min(1).max(255)).optional(),
  isActive: z.boolean().optional(),
});

export const partnerResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  isBuiltin: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CreatePartnerBody = z.infer<typeof createPartnerBodySchema>;
export type UpdatePartnerBody = z.infer<typeof updatePartnerBodySchema>;
