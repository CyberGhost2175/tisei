import { z } from 'zod';
import { cuidSchema } from '../../common/validation/common.schemas.js';
import { paginationSchema } from '../../common/utils/pagination.js';

export const requestIdParamSchema = z.object({ id: cuidSchema });

export const attachmentListQuerySchema = paginationSchema;

export const attachmentResponseSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  uploadedById: z.string().nullable(),
  url: z.string(),
  fileName: z.string().nullable(),
  fileType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  createdAt: z.string(),
});
