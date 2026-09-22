import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { messageResponseSchema } from '../../common/validation/common.schemas.js';
import {
  bulkSetQuantityBodySchema,
  createPartBodySchema,
  partIdParamSchema,
  partResponseSchema,
  partsSpendingPeriodSchema,
  partsSpendingResponseSchema,
  updatePartBodySchema,
} from './part.schemas.js';
import {
  bulkSetQuantity,
  createPart,
  deletePart,
  getPartsSpending,
  listParts,
  updatePart,
} from './part.service.js';

export async function partsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Parts'],
        summary: 'Склад запчастей',
        querystring: z.object({
          activeOnly: z.coerce.boolean().optional(),
          section: z.enum(['SERVICE', 'KFC']).optional(),
        }),
        response: { 200: z.array(partResponseSchema) },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      const isMaster = auth.role === 'executor' || auth.role === 'master';
      const activeOnly = isMaster ? true : (request.query.activeOnly ?? false);
      const parts = await listParts(activeOnly, request.query.section);
      if (isMaster) {
        // KFC — каталог без остатков: показываем все активные; SERVICE — только с остатком
        return parts.filter((p) => p.section === 'KFC' || p.quantity > 0);
      }
      return parts;
    },
  );

  r.get(
    '/spending',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Parts'],
        summary: 'Расход на запчасти за период (по разделу склада)',
        querystring: z.object({
          period: partsSpendingPeriodSchema,
          section: z.enum(['SERVICE', 'KFC']).optional(),
        }),
        response: { 200: partsSpendingResponseSchema },
      },
    },
    async (request) => getPartsSpending(request.query.period, request.query.section),
  );

  r.post(
    '/',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Parts'],
        summary: 'Добавить запчасть на склад',
        body: createPartBodySchema,
        response: { 201: partResponseSchema },
      },
    },
    async (request, reply) => {
      const created = await createPart(request.body, request.authUser!.id);
      return reply.status(201).send(created);
    },
  );

  r.post(
    '/bulk-quantity',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Parts'],
        summary: 'Задать количество всем запчастям раздела',
        body: bulkSetQuantityBodySchema,
        response: {
          200: z.object({
            updated: z.number().int(),
            section: z.literal('SERVICE'),
            quantity: z.number().int(),
          }),
        },
      },
    },
    async (request) => bulkSetQuantity(request.body, request.authUser!.id),
  );

  r.patch(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Parts'],
        summary: 'Изменить запчасть',
        params: partIdParamSchema,
        body: updatePartBodySchema,
        response: { 200: partResponseSchema },
      },
    },
    async (request) => updatePart(request.params.id, request.body, request.authUser!.id),
  );

  r.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Parts'],
        summary: 'Удалить запчасть',
        params: partIdParamSchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      await deletePart(request.params.id, request.authUser!.id);
      return { message: 'Запчасть удалена' };
    },
  );
}
