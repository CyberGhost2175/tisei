import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { routingTodayQuerySchema, optimizeRouteBodySchema } from './routing.schemas.js';
import { getTodayRoute, optimizeRoute } from './routing.service.js';

const routePointSchema = z.object({
  requestId: z.string(),
  number: z.string(),
  companyOrFullName: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  status: z.string(),
  priority: z.string(),
  isPartner: z.boolean(),
  order: z.number(),
});

const depotSchema = z.object({
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

const routeResponseSchema = z.object({
  executorId: z.string(),
  depot: depotSchema,
  points: z.array(routePointSchema),
  routeUrl: z.string(),
  totalDistanceKm: z.number(),
  date: z.string().optional(),
});

export async function routingRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/today',
    {
      preHandler: [authenticate, requireRole(['executor', 'manager', 'admin'])],
      schema: {
        tags: ['Routing'],
        summary: 'Маршрут исполнителя на день (ближайший сосед + ссылка 2ГИС)',
        security: [{ bearerAuth: [] }],
        querystring: routingTodayQuerySchema,
        response: {
          200: routeResponseSchema,
        },
      },
    },
    async (request) =>
      getTodayRoute(request.query, {
        userId: request.authUser!.id,
        role: request.authUser!.role,
      }),
  );

  r.post(
    '/optimize',
    {
      preHandler: [authenticate, requireRole(['executor', 'manager', 'admin'])],
      schema: {
        tags: ['Routing'],
        summary: 'Оптимизировать порядок точек маршрута',
        security: [{ bearerAuth: [] }],
        body: optimizeRouteBodySchema,
        response: { 200: routeResponseSchema },
      },
    },
    async (request) =>
      optimizeRoute(request.body, {
        userId: request.authUser!.id,
        role: request.authUser!.role,
      }),
  );
}
