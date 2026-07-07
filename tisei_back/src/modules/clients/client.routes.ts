import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { messageResponseSchema } from '../../common/validation/common.schemas.js';
import {
  clientListQuerySchema,
  createClientBodySchema,
  updateClientBodySchema,
  clientIdParamSchema,
} from './client.schemas.js';
import {
  listClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} from './client.service.js';

const clientResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  isServiced: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export async function clientsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Clients'],
        summary: 'Список клиентов',
        security: [{ bearerAuth: [] }],
        querystring: clientListQuerySchema,
        response: {
          200: z.object({
            items: z.array(clientResponseSchema),
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
    async (request) => listClients(request.query),
  );

  r.get(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Clients'],
        summary: 'Получить клиента',
        security: [{ bearerAuth: [] }],
        params: clientIdParamSchema,
        response: { 200: clientResponseSchema },
      },
    },
    async (request) => getClientById(request.params.id),
  );

  r.post(
    '/',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Clients'],
        summary: 'Создать клиента',
        security: [{ bearerAuth: [] }],
        body: createClientBodySchema,
        response: { 201: clientResponseSchema },
      },
    },
    async (request, reply) => {
      const client = await createClient(request.body, request.authUser!.id);
      return reply.status(201).send(client);
    },
  );

  r.patch(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Clients'],
        summary: 'Обновить клиента',
        security: [{ bearerAuth: [] }],
        params: clientIdParamSchema,
        body: updateClientBodySchema,
        response: { 200: clientResponseSchema },
      },
    },
    async (request) => updateClient(request.params.id, request.body, request.authUser!.id),
  );

  r.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        tags: ['Clients'],
        summary: 'Удалить клиента',
        security: [{ bearerAuth: [] }],
        params: clientIdParamSchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      await deleteClient(request.params.id, request.authUser!.id);
      return { message: 'Клиент удалён' };
    },
  );
}
