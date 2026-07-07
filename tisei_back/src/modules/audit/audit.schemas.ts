import { z } from 'zod';
import { cuidSchema } from '../../common/validation/common.schemas.js';
import { paginationSchema } from '../../common/utils/pagination.js';

export const auditListQuerySchema = paginationSchema.extend({
  userId: cuidSchema.optional(),
  entityType: z.string().max(100).optional(),
  entityId: z.string().max(100).optional(),
  action: z.string().max(100).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
