import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { cuidSchema } from '../../common/validation/common.schemas.js';
import {
  createOrGetActShare,
  getPublicActByToken,
  getPublicActPdfByToken,
} from './act-share.service.js';

const publicActResponseSchema = z.object({
  number: z.string(),
  status: z.string(),
  closedAt: z.string().nullable(),
  createdAt: z.string(),
  companyOrFullName: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  partnerName: z.string().nullable(),
  equipmentCategoryName: z.string().nullable(),
  equipmentName: z.string().nullable(),
  problemDescription: z.string().nullable(),
  executors: z.array(z.object({ fullName: z.string() })),
  closing: z
    .object({
      workPerformed: z.string().nullable(),
      executorName: z.string().nullable(),
      confirmedAt: z.string().nullable(),
      addressSnapshot: z.string().nullable(),
      incomeAmount: z.number(),
    })
    .nullable(),
  parts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number(),
      lineTotal: z.number(),
    }),
  ),
  comments: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['comment', 'system_event']),
      text: z.string(),
      createdAt: z.string(),
      authorName: z.string().nullable(),
    }),
  ),
  attachments: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      fileName: z.string().nullable(),
      fileType: z.string().nullable(),
      sizeBytes: z.number().nullable(),
      createdAt: z.string(),
    }),
  ),
});

/** Auth routes: POST /requests/:id/act-share */
export async function actShareRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin', 'executor', 'master'])],
      schema: {
        tags: ['Requests'],
        summary: 'Создать публичную ссылку на акт выполненных работ',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: cuidSchema }),
        response: {
          200: z.object({
            url: z.string(),
            pdfUrl: z.string(),
            token: z.string(),
          }),
        },
      },
    },
    async (request) =>
      createOrGetActShare(request.params.id, {
        userId: request.authUser!.id,
        role: request.authUser!.role,
      }),
  );
}

/** Public route: GET /public/acts/:token */
export async function publicActRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/:token',
    {
      schema: {
        tags: ['Public'],
        summary: 'Публичный просмотр акта выполненных работ',
        params: z.object({ token: z.string().min(16).max(128) }),
        response: { 200: publicActResponseSchema },
      },
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request) => getPublicActByToken(request.params.token),
  );

  r.get(
    '/:token/pdf',
    {
      schema: {
        tags: ['Public'],
        summary: 'Скачать акт выполненных работ (PDF)',
        params: z.object({ token: z.string().min(16).max(128) }),
      },
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const { buffer, filename } = await getPublicActPdfByToken(request.params.token);
      return reply
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        )
        .send(buffer);
    },
  );
}
