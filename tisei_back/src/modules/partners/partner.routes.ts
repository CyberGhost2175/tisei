import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { messageResponseSchema } from '../../common/validation/common.schemas.js';
import {
  createPartnerBodySchema,
  partnerIdParamSchema,
  partnerResponseSchema,
  updatePartnerBodySchema,
} from './partner.schemas.js';
import {
  createPartner,
  deletePartner,
  listPartners,
  updatePartner,
} from './partner.service.js';

export async function partnersRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Partners'],
        summary: 'Список партнёров-заведений',
        querystring: z.object({ all: z.coerce.boolean().optional() }),
        response: { 200: z.array(partnerResponseSchema) },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      const all = request.query.all && (auth.role === 'admin' || auth.role === 'manager');
      return listPartners(!all);
    },
  );

  r.post(
    '/',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Partners'],
        summary: 'Добавить партнёра-заведение',
        body: createPartnerBodySchema,
        response: { 201: partnerResponseSchema },
      },
    },
    async (request, reply) => {
      const auth = request.authUser!;
      const created = await createPartner(request.body, auth.id);
      return reply.status(201).send(created);
    },
  );

  r.patch(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Partners'],
        summary: 'Обновить партнёра',
        params: partnerIdParamSchema,
        body: updatePartnerBodySchema,
        response: { 200: partnerResponseSchema },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return updatePartner(request.params.id, request.body, auth.id);
    },
  );

  r.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Partners'],
        summary: 'Удалить партнёра (не встроенного)',
        params: partnerIdParamSchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      await deletePartner(request.params.id, auth.id);
      return { message: 'Партнёр удалён' };
    },
  );
}
