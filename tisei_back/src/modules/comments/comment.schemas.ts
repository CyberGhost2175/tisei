import { z } from 'zod';
import { cuidSchema } from '../../common/validation/common.schemas.js';
import { paginationSchema } from '../../common/utils/pagination.js';

export const requestIdParamSchema = z.object({ id: cuidSchema });

export const commentListQuerySchema = paginationSchema.extend({
  type: z.enum(['comment', 'system_event']).optional(),
});

export const createCommentBodySchema = z.object({
  text: z.string().min(1).max(10000),
});

export type CommentListQuery = z.infer<typeof commentListQuerySchema>;
