import { z } from 'zod';
import { cuidSchema, emailSchema, phoneSchema, sortOrderSchema } from '../../common/validation/common.schemas.js';
import { paginationSchema } from '../../common/utils/pagination.js';

export const requestStatusSchema = z.enum([
  'new',
  'in_progress',
  'awaiting_parts',
  'frozen',
  'in_service',
  'awaiting_approval',
  'repeat',
  'closed',
  'cancelled',
]);

export const requestPrioritySchema = z.enum(['P1', 'P2', 'P3', 'P4']);

export const createRequestBodySchema = z.object({
  companyOrFullName: z.string().min(1).max(255),
  phone: phoneSchema,
  email: emailSchema.optional(),
  address: z.string().max(500).optional(),
  equipmentCategoryId: cuidSchema.optional(),
  equipmentCategoryText: z.string().max(255).optional(),
  equipmentName: z.string().max(255).optional(),
  problemDescription: z.string().max(5000).optional(),
  malfunctionTypeId: cuidSchema.optional(),
  malfunctionCustomText: z.string().max(1000).optional(),
  priority: requestPrioritySchema.nullable().optional(),
  partnerEstablishmentId: cuidSchema.nullable().optional(),
  deadline: z.coerce.date().optional(),
  clientType: z.enum(['serviced', 'new_from_site']).optional(),
  clientId: cuidSchema.optional(),
});

export const publicCreateRequestBodySchema = createRequestBodySchema.extend({
  recaptchaToken: z.string().min(1).optional(),
});

export const updateRequestBodySchema = createRequestBodySchema.partial();

export const requestListQuerySchema = paginationSchema.extend({
  status: requestStatusSchema.optional(),
  priority: requestPrioritySchema.optional(),
  clientType: z.enum(['serviced', 'new_from_site']).optional(),
  /** По умолчанию только repair; maintenance — отдельный раздел */
  kind: z.enum(['repair', 'maintenance', 'all']).default('repair'),
  executorId: cuidSchema.optional(),
  search: z.string().max(100).optional(),
  deadlineFrom: z.coerce.date().optional(),
  deadlineTo: z.coerce.date().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  /** Только активные (не закрытые и не отменённые) */
  active: z.coerce.boolean().optional(),
  /** Исполнитель: только мои назначенные */
  mine: z.coerce.boolean().optional(),
  /** Исполнитель: без назначенного исполнителя */
  available: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'deadline', 'priority', 'number']).default('createdAt'),
  sortOrder: sortOrderSchema,
});

export const changeStatusBodySchema = z.object({
  status: requestStatusSchema,
  frozenReason: z.string().max(500).optional(),
  equipmentCategoryId: cuidSchema.optional(),
});

export const assignExecutorsBodySchema = z.object({
  executorIds: z.array(cuidSchema).min(1),
});

export const freezeRequestBodySchema = z.object({
  frozenReason: z.string().min(1).max(500),
});

export const requestIdParamSchema = z.object({ id: cuidSchema });

export const bulkDeleteRequestsBodySchema = z.object({
  ids: z.array(cuidSchema).min(1).max(100),
});

export const bulkDeleteRequestsResponseSchema = z.object({
  message: z.string(),
  deleted: z.number().int(),
});

export type CreateRequestBody = z.infer<typeof createRequestBodySchema>;
export type UpdateRequestBody = z.infer<typeof updateRequestBodySchema>;
export type RequestListQuery = z.infer<typeof requestListQuerySchema>;
export type BulkDeleteRequestsBody = z.infer<typeof bulkDeleteRequestsBodySchema>;
