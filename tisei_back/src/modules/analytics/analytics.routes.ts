import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import {
  reportTypeSchema,
  analyticsDateRangeSchema,
  analyticsExportQuerySchema,
  executorKpiQuerySchema,
  executorKpiDetailParamsSchema,
  executorKpiDetailQuerySchema,
} from './analytics.schemas.js';
import {
  getDashboard,
  getExecutorDashboard,
  getExecutorKpi,
  getExecutorKpiDetail,
  getReport,
  reportToCsv,
} from './analytics.service.js';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/dashboard',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Analytics'],
        summary: 'KPI dashboard (менеджер/админ — общий, исполнитель — свои заявки)',
        security: [{ bearerAuth: [] }],
        querystring: analyticsDateRangeSchema,
        response: {
          200: z.object({
            kpi: z.object({
              totalRequests: z.number(),
              todayRequests: z.number().optional(),
              overdueRequests: z.number(),
              closedRequests: z.number(),
              activeExecutors: z.number(),
              inProgress: z.number().optional(),
              partnerActive: z.number().optional(),
              byStatus: z.record(z.number()),
              financials: z.object({
                totalIncome: z.number(),
                totalExpense: z.number(),
                totalProfit: z.number(),
                companyCommission: z.number(),
              }),
            }),
            generatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      if (auth.role === 'executor') {
        return getExecutorDashboard(auth.id);
      }
      return getDashboard(request.query);
    },
  );

  r.get(
    '/reports/:type',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Analytics'],
        summary: 'Отчёт по типу',
        security: [{ bearerAuth: [] }],
        params: z.object({ type: reportTypeSchema }),
        querystring: analyticsDateRangeSchema,
        response: {
          200: z.object({
            type: z.string(),
            rows: z.array(z.record(z.unknown())),
          }),
        },
      },
    },
    async (request) => getReport(request.params.type, request.query),
  );

  r.get(
    '/executor-kpi',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Analytics'],
        summary: 'КПД мастеров — взятые и закрытые заявки за период',
        security: [{ bearerAuth: [] }],
        querystring: executorKpiQuerySchema,
        response: {
          200: z.object({
            period: z.enum(['day', 'week', 'month']),
            from: z.string(),
            to: z.string(),
            totalClaimed: z.number(),
            totalClosed: z.number(),
            rows: z.array(
              z.object({
                executorId: z.string(),
                executorName: z.string(),
                email: z.string(),
                claimed: z.number(),
                closed: z.number(),
                earned: z.number(),
              }),
            ),
          }),
        },
      },
    },
    async (request) => getExecutorKpi(request.query.period, request.query.search),
  );

  r.get(
    '/executor-kpi/:executorId',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Analytics'],
        summary: 'Детализация КПД мастера — список взятых и закрытых заявок',
        security: [{ bearerAuth: [] }],
        params: executorKpiDetailParamsSchema,
        querystring: executorKpiDetailQuerySchema,
        response: {
          200: z.object({
            executor: z.object({ id: z.string(), fullName: z.string(), email: z.string() }),
            period: z.enum(['day', 'week', 'month']),
            from: z.string(),
            to: z.string(),
            claimed: z.array(
              z.object({
                requestId: z.string(),
                number: z.string(),
                companyOrFullName: z.string(),
                address: z.string().nullable(),
                status: z.string(),
                priority: z.string(),
                assignedAt: z.string(),
              }),
            ),
            closed: z.array(
              z.object({
                requestId: z.string(),
                number: z.string(),
                companyOrFullName: z.string(),
                address: z.string().nullable(),
                status: z.string(),
                priority: z.string(),
                workPerformed: z.string().nullable(),
                incomeAmount: z.number(),
                expenseAmount: z.number(),
                profit: z.number(),
                confirmedAt: z.string().nullable(),
              }),
            ),
          }),
        },
      },
    },
    async (request) =>
      getExecutorKpiDetail(request.params.executorId, request.query.period),
  );

  r.get(
    '/export',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Analytics'],
        summary: 'Экспорт отчёта (CSV/JSON)',
        security: [{ bearerAuth: [] }],
        querystring: analyticsExportQuerySchema,
      },
    },
    async (request, reply) => {
      const report = await getReport(request.query.type, {
        dateFrom: request.query.dateFrom,
        dateTo: request.query.dateTo,
      });

      if (request.query.format === 'json') {
        return reply
          .header('Content-Disposition', `attachment; filename="tisei-${request.query.type}.json"`)
          .type('application/json')
          .send(report);
      }

      const csv = reportToCsv(request.query.type, report as { rows: Record<string, unknown>[] });
      return reply
        .header('Content-Disposition', `attachment; filename="tisei-${request.query.type}.csv"`)
        .type('text/csv; charset=utf-8')
        .send(csv);
    },
  );
}
