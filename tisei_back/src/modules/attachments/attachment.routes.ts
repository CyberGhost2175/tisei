import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { BadRequestError } from '../../common/errors/AppError.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { messageResponseSchema } from '../../common/validation/common.schemas.js';
import {
  requestIdParamSchema,
  attachmentListQuerySchema,
  attachmentResponseSchema,
} from './attachment.schemas.js';
import { listAttachments, uploadAttachment, deleteAttachment } from './attachment.service.js';

const attachmentIdParamSchema = z.object({
  id: z.string(),
  attachmentId: z.string(),
});

export async function attachmentsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Attachments'],
        summary: 'Список вложений заявки',
        security: [{ bearerAuth: [] }],
        params: requestIdParamSchema,
        querystring: attachmentListQuerySchema,
        response: {
          200: z.object({
            items: z.array(attachmentResponseSchema),
            meta: z.object({
              page: z.number(),
              pageSize: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    async (request) =>
      listAttachments(request.params.id, request.query, {
        userId: request.authUser!.id,
        role: request.authUser!.role,
      }),
  );

  r.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Attachments'],
        summary: 'Загрузить вложение (фото/видео/акт) в S3',
        security: [{ bearerAuth: [] }],
        params: requestIdParamSchema,
        consumes: ['multipart/form-data'],
        response: { 201: attachmentResponseSchema },
      },
    },
    async (request, reply) => {
      const data = await request.file();
      if (!data) {
        throw new BadRequestError('Файл не передан');
      }

      const buffer = await data.toBuffer();
      const attachment = await uploadAttachment(
        request.params.id,
        { buffer, filename: data.filename, mimetype: data.mimetype },
        { userId: request.authUser!.id, role: request.authUser!.role },
      );
      return reply.status(201).send(attachment);
    },
  );

  r.delete(
    '/:attachmentId',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Attachments'],
        summary: 'Удалить вложение',
        security: [{ bearerAuth: [] }],
        params: attachmentIdParamSchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      await deleteAttachment(request.params.id, request.params.attachmentId, {
        userId: request.authUser!.id,
        role: request.authUser!.role,
      });
      return { message: 'Вложение удалено' };
    },
  );
}
