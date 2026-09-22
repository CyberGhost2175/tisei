import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import {
  closeMaintenanceBodySchema,
  maintenanceActPdfQuerySchema,
  maintenancePeriodQuerySchema,
  partnerIdParamSchema,
  requestIdParamSchema,
  transferToRepairBodySchema,
  updateFindingsBodySchema,
  updatePartnerMaintenanceBodySchema,
  updatePeriodSettingBodySchema,
} from './maintenance.schemas.js';
import {
  closeMaintenanceRequest,
  closeAllMaintenanceForPartner,
  downloadMaintenanceAct,
  ensureMaintenancePeriod,
  getPartnerMaintenanceDetail,
  listMaintenanceOverview,
  transferMaintenanceToRepair,
  updateMaintenanceFindings,
  updatePartnerMaintenanceSettings,
  updatePeriodSetting,
  currentPeriod,
} from './maintenance.service.js';

export async function maintenanceRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Maintenance'],
        summary: 'Обзор планового ТО по партнёрам',
        querystring: maintenancePeriodQuerySchema,
      },
    },
    async (request) =>
      listMaintenanceOverview(
        { userId: request.authUser!.id, role: request.authUser!.role },
        request.query.period,
      ),
  );

  r.post(
    '/ensure',
    {
      preHandler: [authenticate, requireRole(['admin', 'manager'])],
      schema: {
        tags: ['Maintenance'],
        summary: 'Создать заявки ТО на период (идемпотентно)',
        body: z.object({
          period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        }),
      },
    },
    async (request) => ensureMaintenancePeriod(request.body.period ?? currentPeriod()),
  );

  r.get(
    '/partners/:partnerId',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Maintenance'],
        summary: 'Точки партнёра по городам + заявки ТО',
        params: partnerIdParamSchema,
        querystring: maintenancePeriodQuerySchema,
      },
    },
    async (request) =>
      getPartnerMaintenanceDetail(
        request.params.partnerId,
        { userId: request.authUser!.id, role: request.authUser!.role },
        request.query.period,
      ),
  );

  r.patch(
    '/partners/:partnerId',
    {
      preHandler: [authenticate, requireRole(['admin', 'manager'])],
      schema: {
        tags: ['Maintenance'],
        summary: 'Настройки ТО партнёра (день закрытия, цена акта, реквизиты)',
        params: partnerIdParamSchema,
        body: updatePartnerMaintenanceBodySchema,
      },
    },
    async (request) =>
      updatePartnerMaintenanceSettings(
        request.params.partnerId,
        request.body,
        { userId: request.authUser!.id, role: request.authUser!.role },
      ),
  );

  r.patch(
    '/partners/:partnerId/period',
    {
      preHandler: [authenticate, requireRole(['admin', 'manager'])],
      schema: {
        tags: ['Maintenance'],
        summary: 'Изменить даты закрытия / акта за период',
        params: partnerIdParamSchema,
        querystring: z.object({
          period: z.string().regex(/^\d{4}-\d{2}$/),
        }),
        body: updatePeriodSettingBodySchema,
      },
    },
    async (request) =>
      updatePeriodSetting(
        request.params.partnerId,
        request.query.period,
        request.body,
        { userId: request.authUser!.id, role: request.authUser!.role },
      ),
  );

  r.patch(
    '/requests/:requestId/findings',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Maintenance'],
        summary: 'Замечания / поломки по ТО',
        params: requestIdParamSchema,
        body: updateFindingsBodySchema,
      },
    },
    async (request) =>
      updateMaintenanceFindings(
        request.params.requestId,
        request.body.findings,
        { userId: request.authUser!.id, role: request.authUser!.role },
      ),
  );

  r.post(
    '/requests/:requestId/close',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Maintenance'],
        summary: 'Закрыть заявку ТО',
        params: requestIdParamSchema,
        body: closeMaintenanceBodySchema,
      },
    },
    async (request) =>
      closeMaintenanceRequest(
        request.params.requestId,
        request.body,
        { userId: request.authUser!.id, role: request.authUser!.role },
      ),
  );

  r.post(
    '/partners/:partnerId/close-all',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Maintenance'],
        summary: 'Закрыть все открытые точки ТО партнёра за период',
        params: partnerIdParamSchema,
        querystring: maintenancePeriodQuerySchema,
      },
    },
    async (request) =>
      closeAllMaintenanceForPartner(
        request.params.partnerId,
        request.query.period,
        { userId: request.authUser!.id, role: request.authUser!.role },
      ),
  );

  r.post(
    '/requests/:requestId/transfer-to-repair',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Maintenance'],
        summary: 'Перевести с ТО на обычный ремонт (пометка «С обслуживания»)',
        params: requestIdParamSchema,
        body: transferToRepairBodySchema,
      },
    },
    async (request) =>
      transferMaintenanceToRepair(
        request.params.requestId,
        request.body,
        { userId: request.authUser!.id, role: request.authUser!.role },
      ),
  );

  r.get(
    '/partners/:partnerId/act.pdf',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Maintenance'],
        summary: 'Скачать акт ТО (когда все точки закрыты)',
        params: partnerIdParamSchema,
        querystring: maintenanceActPdfQuerySchema,
      },
    },
    async (request, reply) => {
      const { buffer, filename } = await downloadMaintenanceAct(
        request.params.partnerId,
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
