import { z } from 'zod';
import { cuidSchema } from '../../common/validation/common.schemas.js';

export const partnerIdParamSchema = z.object({ id: cuidSchema });

export const partnerLocationIdParamSchema = z.object({
  id: cuidSchema,
  locationId: cuidSchema,
});

export const createPartnerBodySchema = z.object({
  name: z.string().min(1).max(255),
  aliases: z.array(z.string().min(1).max(255)).default([]),
});

export const updatePartnerBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  aliases: z.array(z.string().min(1).max(255)).optional(),
  isActive: z.boolean().optional(),
});

export const partnerLocationResponseSchema = z.object({
  id: z.string(),
  partnerEstablishmentId: z.string(),
  name: z.string(),
  city: z.string(),
  address: z.string(),
  equipmentQuantity: z.number().int().nullable(),
  maintenancePrice: z.number().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const partnerResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  isBuiltin: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  locations: z.array(partnerLocationResponseSchema).optional(),
  locationsCount: z.number().int().optional(),
});

export const createPartnerLocationBodySchema = z.object({
  name: z.string().min(1).max(255),
  city: z.string().min(1).max(100).default('Астана'),
  address: z.string().min(1).max(500),
  equipmentQuantity: z.number().int().min(0).nullable().optional(),
  maintenancePrice: z.number().min(0).nullable().optional(),
});

export const updatePartnerLocationBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  city: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(500).optional(),
  equipmentQuantity: z.number().int().min(0).nullable().optional(),
  maintenancePrice: z.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreatePartnerBody = z.infer<typeof createPartnerBodySchema>;
export type UpdatePartnerBody = z.infer<typeof updatePartnerBodySchema>;
export type CreatePartnerLocationBody = z.infer<typeof createPartnerLocationBodySchema>;
export type UpdatePartnerLocationBody = z.infer<typeof updatePartnerLocationBodySchema>;
