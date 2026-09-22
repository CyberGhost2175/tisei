import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { messageResponseSchema } from '../../common/validation/common.schemas.js';
import {
  createPartnerBodySchema,
  createPartnerLocationBodySchema,
  partnerIdParamSchema,
  partnerLocationIdParamSchema,
  partnerLocationResponseSchema,
  partnerResponseSchema,
  updatePartnerBodySchema,
  updatePartnerLocationBodySchema,
} from './partner.schemas.js';
import {
  createPartner,
  createPartnerLocation,
  deletePartner,
  deletePartnerLocation,
  listPartnerLocations,
  listPartners,
  updatePartner,
  updatePartnerLocation,
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
        querystring: z.object({
          all: z.coerce.boolean().optional(),
          locations: z.coerce.boolean().optional(),
        }),
        response: { 200: z.array(partnerResponseSchema) },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      const all = request.query.all && (auth.role === 'admin' || auth.role === 'manager');
      const includeLocations =
        !!request.query.locations && (auth.role === 'admin' || auth.role === 'manager');
      return listPartners(!all, includeLocations);
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

  r.get(
    '/:id/locations',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Partners'],
        summary: 'Список точек партнёра',
        params: partnerIdParamSchema,
        querystring: z.object({ all: z.coerce.boolean().optional() }),
        response: { 200: z.array(partnerLocationResponseSchema) },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      const all = request.query.all && (auth.role === 'admin' || auth.role === 'manager');
      return listPartnerLocations(request.params.id, !all);
    },
  );

  r.post(
    '/:id/locations',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Partners'],
        summary: 'Добавить точку партнёра',
        params: partnerIdParamSchema,
        body: createPartnerLocationBodySchema,
        response: { 201: partnerLocationResponseSchema },
      },
    },
    async (request, reply) => {
      const auth = request.authUser!;
      const created = await createPartnerLocation(request.params.id, request.body, auth.id);
      return reply.status(201).send(created);
    },
  );

  r.patch(
    '/:id/locations/:locationId',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Partners'],
        summary: 'Обновить точку партнёра',
        params: partnerLocationIdParamSchema,
        body: updatePartnerLocationBodySchema,
        response: { 200: partnerLocationResponseSchema },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return updatePartnerLocation(
        request.params.id,
        request.params.locationId,
        request.body,
        auth.id,
      );
    },
  );

  r.delete(
    '/:id/locations/:locationId',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Partners'],
        summary: 'Удалить точку партнёра',
        params: partnerLocationIdParamSchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      await deletePartnerLocation(request.params.id, request.params.locationId, auth.id);
      return { message: 'Точка удалена' };
    },
  );
}
