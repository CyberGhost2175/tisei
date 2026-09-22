import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import {
  locationIdParamSchema,
  partnerIdParamSchema,
  repairActPdfQuerySchema,
  repairActPeriodQuerySchema,
  updateRepairActSettingBodySchema,
} from './repair-act.schemas.js';
import {
  downloadRepairAct,
  getRepairActPartnerDetail,
  listRepairActsOverview,
  updateRepairActSetting,
} from './repair-act.service.js';

export async function repairActRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['RepairActs'],
        summary: 'Обзор АВР ремонта по партнёрам и точкам',
        querystring: repairActPeriodQuerySchema,
      },
    },
    async (request) =>
      listRepairActsOverview(
        { userId: request.authUser!.id, role: request.authUser!.role },
        request.query.period,
      ),
  );

  r.get(
    '/partners/:partnerId',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['RepairActs'],
        summary: 'Точки партнёра для АВР ремонта',
        params: partnerIdParamSchema,
        querystring: repairActPeriodQuerySchema,
      },
    },
    async (request) =>
      getRepairActPartnerDetail(
        request.params.partnerId,
        { userId: request.authUser!.id, role: request.authUser!.role },
        request.query.period,
      ),
  );

  r.patch(
    '/locations/:locationId/period',
    {
      preHandler: [authenticate, requireRole(['admin', 'manager'])],
      schema: {
        tags: ['RepairActs'],
        summary: 'Изменить номер / дату АВР ремонта за период',
        params: locationIdParamSchema,
        querystring: z.object({
          period: z.string().regex(/^\d{4}-\d{2}$/),
        }),
        body: updateRepairActSettingBodySchema,
      },
    },
    async (request) =>
      updateRepairActSetting(
        request.params.locationId,
        request.query.period,
        request.body,
        { userId: request.authUser!.id, role: request.authUser!.role },
      ),
  );

  r.get(
    '/locations/:locationId/act.pdf',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['RepairActs'],
        summary: 'Скачать АВР ремонта по точке (Форма Р-1)',
        params: locationIdParamSchema,
        querystring: repairActPdfQuerySchema,
      },
    },
    async (request, reply) => {
      const { buffer, filename } = await downloadRepairAct(
        request.params.locationId,
        request.query.period,
        { userId: request.authUser!.id, role: request.authUser!.role },
      );
      return reply
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        )
        .send(buffer);
    },
  );
}
