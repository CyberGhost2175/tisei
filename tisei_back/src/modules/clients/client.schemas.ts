import { z } from 'zod';
import { cuidSchema, emailSchema, phoneSchema } from '../../common/validation/common.schemas.js';
import { paginationSchema } from '../../common/utils/pagination.js';

export const clientListQuerySchema = paginationSchema.extend({
  isServiced: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
});

export const createClientBodySchema = z.object({
  name: z.string().min(1).max(255),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  address: z.string().max(500).optional(),
  isServiced: z.boolean().default(false),
});

export const updateClientBodySchema = createClientBodySchema.partial();

export const clientIdParamSchema = z.object({ id: cuidSchema });

export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
export type CreateClientBody = z.infer<typeof createClientBodySchema>;
export type UpdateClientBody = z.infer<typeof updateClientBodySchema>;
