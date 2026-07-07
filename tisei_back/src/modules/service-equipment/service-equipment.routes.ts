import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { messageResponseSchema } from '../../common/validation/common.schemas.js';
import {
  createServiceEquipmentBodySchema,
  serviceEquipmentIdParamSchema,
  serviceEquipmentResponseSchema,
  serviceEquipmentStatusSchema,
  updateServiceEquipmentBodySchema,
} from './service-equipment.schemas.js';
import {
  createServiceEquipment,
  deleteServiceEquipment,
  listServiceEquipment,
  updateServiceEquipment,
} from './service-equipment.service.js';

export async function serviceEquipmentRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['ServiceEquipment'],
        summary: 'Оборудование в сервисе',
        querystring: z.object({ status: serviceEquipmentStatusSchema.optional() }),
        response: { 200: z.array(serviceEquipmentResponseSchema) },
      },
    },
    async (request) => listServiceEquipment(request.query.status),
  );

  r.post(
    '/',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['ServiceEquipment'],
        summary: 'Добавить оборудование в сервис',
        body: createServiceEquipmentBodySchema,
        response: { 201: serviceEquipmentResponseSchema },
      },
    },
    async (request, reply) => {
      const created = await createServiceEquipment(request.body);
      return reply.status(201).send(created);
    },
  );

  r.patch(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['ServiceEquipment'],
        summary: 'Обновить запись оборудования в сервисе',
        params: serviceEquipmentIdParamSchema,
        body: updateServiceEquipmentBodySchema,
        response: { 200: serviceEquipmentResponseSchema },
      },
    },
    async (request) => updateServiceEquipment(request.params.id, request.body),
  );

  r.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['ServiceEquipment'],
        summary: 'Удалить запись',
        params: serviceEquipmentIdParamSchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      await deleteServiceEquipment(request.params.id);
      return { message: 'Запись удалена' };
    },
  );
}
