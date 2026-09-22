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
import {
  deleteServiceEquipmentAttachment,
  listServiceEquipmentAttachments,
  uploadServiceEquipmentAttachment,
} from './service-equipment-attachment.service.js';
import { BadRequestError } from '../../common/errors/AppError.js';
import { serviceEquipmentAttachmentSchema } from './service-equipment.schemas.js';

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

  r.get(
    '/:id/attachments',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['ServiceEquipment'],
        summary: 'Фото оборудования в сервисе',
        params: serviceEquipmentIdParamSchema,
        response: { 200: z.array(serviceEquipmentAttachmentSchema) },
      },
    },
    async (request) => listServiceEquipmentAttachments(request.params.id),
  );

  r.post(
    '/:id/attachments',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['ServiceEquipment'],
        summary: 'Загрузить фото оборудования',
        params: serviceEquipmentIdParamSchema,
        consumes: ['multipart/form-data'],
        response: { 201: serviceEquipmentAttachmentSchema },
      },
    },
    async (request, reply) => {
      const data = await request.file();
      if (!data) throw new BadRequestError('Файл не передан');
      const buffer = await data.toBuffer();
      const attachment = await uploadServiceEquipmentAttachment(
        request.params.id,
        { buffer, filename: data.filename, mimetype: data.mimetype },
        { userId: request.authUser!.id, role: request.authUser!.role },
      );
      return reply.status(201).send(attachment);
    },
  );

  r.delete(
    '/:id/attachments/:attachmentId',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['ServiceEquipment'],
        summary: 'Удалить фото оборудования',
        params: z.object({ id: z.string(), attachmentId: z.string() }),
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      await deleteServiceEquipmentAttachment(
        request.params.id,
        request.params.attachmentId,
        { userId: request.authUser!.id, role: request.authUser!.role },
      );
      return { message: 'Фото удалено' };
    },
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
