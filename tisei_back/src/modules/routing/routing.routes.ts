import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { routingTodayQuerySchema, optimizeRouteBodySchema, mapOverviewQuerySchema } from './routing.schemas.js';
import { getTodayRoute, optimizeRoute, getMapOverview } from './routing.service.js';

const routePointSchema = z.object({
  requestId: z.string(),
  number: z.string(),
  companyOrFullName: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  status: z.string(),
  priority: z.string().nullable(),
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

const mapPointSchema = z.object({
  requestId: z.string(),
  number: z.string(),
  companyOrFullName: z.string(),
  phone: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  status: z.string(),
  priority: z.string().nullable(),
  isPartner: z.boolean(),
  equipmentName: z.string().nullable(),
  executors: z.array(z.object({ id: z.string(), fullName: z.string() })),
});

const mapOverviewResponseSchema = z.object({
  total: z.number(),
  totalWithoutCoords: z.number(),
  byStatus: z.record(z.string(), z.number()),
  points: z.array(mapPointSchema),
  depot: depotSchema,
});

export async function routingRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/today',
    {
      preHandler: [authenticate, requireRole(['executor', 'master', 'manager', 'admin'])],
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

  r.get(
    '/map',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Routing'],
        summary: 'Обзор заявок на карте (менеджер)',
        security: [{ bearerAuth: [] }],
        querystring: mapOverviewQuerySchema,
        response: { 200: mapOverviewResponseSchema },
      },
    },
    async (request) =>
      getMapOverview(request.query, {
        userId: request.authUser!.id,
        role: request.authUser!.role,
      }),
  );

  r.post(
    '/optimize',
    {
      preHandler: [authenticate, requireRole(['executor', 'master', 'manager', 'admin'])],
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
