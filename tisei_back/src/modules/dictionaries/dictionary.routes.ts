import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { optionalAuthenticate } from '../../common/middleware/optionalAuthenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { messageResponseSchema } from '../../common/validation/common.schemas.js';
import {
  createDictionaryBodySchema,
  updateDictionaryBodySchema,
  type DictionaryType,
} from './dictionary.schemas.js';
import {
  listDictionary,
  createDictionaryEntry,
  updateDictionaryEntry,
  deleteDictionaryEntry,
} from './dictionary.service.js';

const dictItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

const listQuerySchema = z.object({
  includeInactive: z.coerce.boolean().default(false),
});

function registerCrud(app: FastifyInstance, path: DictionaryType) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    `/${path}`,
    {
      preHandler: [optionalAuthenticate],
      schema: {
        tags: ['Dictionaries'],
        summary: `Список: ${path}`,
        querystring: listQuerySchema,
        response: { 200: z.array(dictItemSchema) },
      },
    },
    async (request) => {
      const role = request.authUser?.role;
      const canSeeInactive = role === 'admin' || role === 'manager';
      const includeInactive = request.query.includeInactive && canSeeInactive;
      return listDictionary(path, !includeInactive);
    },
  );

  r.post(
    `/${path}`,
    {
      preHandler: [authenticate, requireRole(['admin', 'manager'])],
      schema: {
        tags: ['Dictionaries'],
        summary: `Создать запись: ${path}`,
        security: [{ bearerAuth: [] }],
        body: createDictionaryBodySchema,
        response: { 201: dictItemSchema },
      },
    },
    async (request, reply) => {
      const item = await createDictionaryEntry(path, request.body.name, request.authUser!.id);
      return reply.status(201).send(item);
    },
  );

  r.patch(
    `/${path}/:id`,
    {
      preHandler: [authenticate, requireRole(['admin', 'manager'])],
      schema: {
        tags: ['Dictionaries'],
        summary: `Обновить запись: ${path}`,
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        body: updateDictionaryBodySchema,
        response: { 200: dictItemSchema },
      },
    },
    async (request) =>
      updateDictionaryEntry(path, request.params.id, request.body, request.authUser!.id),
  );

  r.delete(
    `/${path}/:id`,
    {
      preHandler: [authenticate, requireRole(['admin', 'manager'])],
      schema: {
        tags: ['Dictionaries'],
        summary: `Удалить запись: ${path}`,
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      await deleteDictionaryEntry(path, request.params.id, request.authUser!.id);
      return { message: 'Запись удалена' };
    },
  );
}

export async function dictionariesRoutes(app: FastifyInstance): Promise<void> {
  registerCrud(app, 'equipment-categories');
  registerCrud(app, 'malfunction-types');
  registerCrud(app, 'freeze-reasons');
}
