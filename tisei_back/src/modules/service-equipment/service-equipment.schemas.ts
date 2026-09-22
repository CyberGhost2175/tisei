import { z } from 'zod';
import { cuidSchema } from '../../common/validation/common.schemas.js';

export const serviceEquipmentStatusSchema = z.enum(['in_service', 'returned']);

export const createServiceEquipmentBodySchema = z.object({
  companyOrFullName: z.string().min(1).max(255),
  partnerEstablishmentId: cuidSchema.nullable().optional(),
  equipmentCategoryId: cuidSchema.optional(),
  equipmentCategoryText: z.string().max(255).optional(),
  equipmentName: z.string().max(255).optional(),
  problemDescription: z.string().max(5000).optional(),
  requestId: cuidSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const updateServiceEquipmentBodySchema = createServiceEquipmentBodySchema.partial().extend({
  status: serviceEquipmentStatusSchema.optional(),
});

export const serviceEquipmentAttachmentSchema = z.object({
  id: z.string(),
  serviceEquipmentId: z.string(),
  uploadedById: z.string().nullable(),
  url: z.string(),
  fileName: z.string().nullable(),
  fileType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  createdAt: z.string(),
});

export const serviceEquipmentIdParamSchema = z.object({ id: cuidSchema });

export const serviceEquipmentResponseSchema = z.object({
  id: z.string(),
  companyOrFullName: z.string(),
  partnerEstablishmentId: z.string().nullable(),
  partnerEstablishment: z
    .object({ id: z.string(), name: z.string() })
    .nullable()
    .optional(),
  equipmentCategoryId: z.string().nullable(),
  equipmentCategory: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  equipmentCategoryText: z.string().nullable(),
  equipmentName: z.string().nullable(),
  problemDescription: z.string().nullable(),
  requestId: z.string().nullable(),
  request: z.object({ id: z.string(), number: z.string() }).nullable().optional(),
  status: serviceEquipmentStatusSchema,
  receivedAt: z.string(),
  returnedAt: z.string().nullable(),
  notes: z.string().nullable(),
  attachments: z.array(serviceEquipmentAttachmentSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CreateServiceEquipmentBody = z.infer<typeof createServiceEquipmentBodySchema>;
export type UpdateServiceEquipmentBody = z.infer<typeof updateServiceEquipmentBodySchema>;
