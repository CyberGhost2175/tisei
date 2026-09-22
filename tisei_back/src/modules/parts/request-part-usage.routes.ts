import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { messageResponseSchema } from '../../common/validation/common.schemas.js';
import {
  createPartUsageBodySchema,
  partUsageResponseSchema,
  requestIdParamSchema,
  usageIdParamSchema,
} from './request-part-usage.schemas.js';
import {
  addRequestPartUsage,
  deleteRequestPartUsage,
  listRequestPartUsages,
} from './request-part-usage.service.js';

export async function requestPartUsagesRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Parts'],
        summary: 'Запчасти, списанные по заявке',
        params: requestIdParamSchema,
        response: { 200: z.array(partUsageResponseSchema) },
      },
    },
    async (request) =>
      listRequestPartUsages(request.params.id, {
        userId: request.authUser!.id,
        role: request.authUser!.role,
      }),
  );

  r.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Parts'],
        summary: 'Списать запчасть со склада в заявку',
        params: requestIdParamSchema,
        body: createPartUsageBodySchema,
        response: { 201: partUsageResponseSchema },
      },
    },
    async (request, reply) => {
      const usage = await addRequestPartUsage(request.params.id, request.body, {
        userId: request.authUser!.id,
        role: request.authUser!.role,
      });
      return reply.status(201).send(usage);
    },
  );

  r.delete(
    '/:usageId',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Parts'],
        summary: 'Отменить списание запчасти',
        params: usageIdParamSchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      await deleteRequestPartUsage(request.params.id, request.params.usageId, {
        userId: request.authUser!.id,
        role: request.authUser!.role,
      });
      return { message: 'Списание отменено' };
    },
  );
}
