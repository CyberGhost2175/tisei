import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { auditListQuerySchema } from './audit.schemas.js';
import { listAuditLogs } from './audit-list.service.js';

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        tags: ['Audit'],
        summary: 'Журнал аудита (только администратор)',
        security: [{ bearerAuth: [] }],
        querystring: auditListQuerySchema,
        response: {
          200: z.object({
            items: z.array(
              z.object({
                id: z.string(),
                userId: z.string().nullable(),
                user: z
                  .object({ id: z.string(), fullName: z.string(), email: z.string() })
                  .nullable(),
                action: z.string(),
                entityType: z.string(),
                entityId: z.string(),
                before: z.unknown(),
                after: z.unknown(),
                createdAt: z.string(),
              }),
            ),
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
    async (request) => listAuditLogs(request.query),
  );
}
