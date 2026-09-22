import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { messageResponseSchema } from '../../common/validation/common.schemas.js';
import {
  requestIdParamSchema,
  requestListQuerySchema,
  createRequestBodySchema,
  updateRequestBodySchema,
  changeStatusBodySchema,
  assignExecutorsBodySchema,
  freezeRequestBodySchema,
  bulkDeleteRequestsBodySchema,
  bulkDeleteRequestsResponseSchema,
} from './request.schemas.js';
import {
  listRequests,
  getRequestById,
  createRequest,
  updateRequest,
  changeRequestStatus,
  assignExecutors,
  claimRequest,
  acceptRequestOffer,
  declineRequest,
  freezeRequest,
  softDeleteRequest,
  softDeleteRequests,
  restoreRequest,
  duplicateRequest,
} from './request.service.js';
import { RequestSource } from '@prisma/client';
import { exportRequestPdf } from './request-export.service.js';

export async function requestRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Requests'],
        summary: 'Список заявок с фильтрами и пагинацией',
        querystring: requestListQuerySchema,
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return listRequests(request.query, { userId: auth.id, role: auth.role });
    },
  );

  r.post(
    '/',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Requests'],
        summary: 'Создать заявку вручную',
        body: createRequestBodySchema,
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return createRequest(request.body, { userId: auth.id, role: auth.role }, RequestSource.manual);
    },
  );

  r.post(
    '/bulk-delete',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Requests'],
        summary: 'Массовое мягкое удаление заявок',
        body: bulkDeleteRequestsBodySchema,
        response: {
          200: bulkDeleteRequestsResponseSchema,
        },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      const result = await softDeleteRequests(request.body.ids, {
        userId: auth.id,
        role: auth.role,
      });
      return { message: `Удалено заявок: ${result.deleted}`, deleted: result.deleted };
    },
  );

  r.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Requests'],
        summary: 'Получить заявку по ID',
        params: requestIdParamSchema,
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return getRequestById(request.params.id, { userId: auth.id, role: auth.role });
    },
  );

  r.patch(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Requests'],
        summary: 'Обновить заявку',
        params: requestIdParamSchema,
        body: updateRequestBodySchema,
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return updateRequest(request.params.id, request.body, { userId: auth.id, role: auth.role });
    },
  );

  r.post(
    '/:id/status',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Requests'],
        summary: 'Изменить статус заявки',
        params: requestIdParamSchema,
        body: changeStatusBodySchema,
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return changeRequestStatus(
        request.params.id,
        request.body.status,
        { userId: auth.id, role: auth.role },
        {
          frozenReason: request.body.frozenReason,
          equipmentCategoryId: request.body.equipmentCategoryId,
        },
      );
    },
  );

  r.post(
    '/:id/assign',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Requests'],
        summary: 'Назначить исполнителей',
        params: requestIdParamSchema,
        body: assignExecutorsBodySchema,
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return assignExecutors(request.params.id, request.body.executorIds, {
        userId: auth.id,
        role: auth.role,
      });
    },
  );

  r.post(
    '/:id/claim',
    {
      preHandler: [authenticate, requireRole(['executor'])],
      schema: {
        tags: ['Requests'],
        summary: 'Штатный мастер берёт заявку в работу',
        params: requestIdParamSchema,
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return claimRequest(request.params.id, { userId: auth.id, role: auth.role });
    },
  );

  r.post(
    '/:id/accept',
    {
      preHandler: [authenticate, requireRole(['executor', 'master'])],
      schema: {
        tags: ['Requests'],
        summary: 'Мастер принимает предложенную заявку',
        params: requestIdParamSchema,
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return acceptRequestOffer(request.params.id, { userId: auth.id, role: auth.role });
    },
  );

  r.post(
    '/:id/decline',
    {
      preHandler: [authenticate, requireRole(['executor', 'master'])],
      schema: {
        tags: ['Requests'],
        summary: 'Мастер отказывается от заявки — статус «Новая»',
        params: requestIdParamSchema,
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return declineRequest(request.params.id, { userId: auth.id, role: auth.role });
    },
  );

  r.post(
    '/:id/freeze',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Requests'],
        summary: 'Заморозить заявку',
        params: requestIdParamSchema,
        body: freezeRequestBodySchema,
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return freezeRequest(request.params.id, request.body.frozenReason, {
        userId: auth.id,
        role: auth.role,
      });
    },
  );

  r.post(
    '/:id/duplicate',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Requests'],
        summary: 'Дублировать заявку',
        params: requestIdParamSchema,
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return duplicateRequest(request.params.id, { userId: auth.id, role: auth.role });
    },
  );

  r.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Requests'],
        summary: 'Мягкое удаление заявки',
        params: requestIdParamSchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      await softDeleteRequest(request.params.id, { userId: auth.id, role: auth.role });
      return { message: 'Заявка удалена' };
    },
  );

  r.post(
    '/:id/restore',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Requests'],
        summary: 'Восстановить удалённую заявку (до 30 дней)',
        params: requestIdParamSchema,
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return restoreRequest(request.params.id, { userId: auth.id, role: auth.role });
    },
  );

  r.get(
    '/:id/export-pdf',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Requests'],
        summary: 'Экспорт заявки в PDF',
        security: [{ bearerAuth: [] }],
        params: requestIdParamSchema,
      },
    },
    async (request, reply) => {
      const pdf = await exportRequestPdf(request.params.id, {
        userId: request.authUser!.id,
        role: request.authUser!.role,
      });
      return reply
        .header('Content-Disposition', `attachment; filename="request-${request.params.id}.pdf"`)
        .type('application/pdf')
        .send(pdf);
    },
  );
}
