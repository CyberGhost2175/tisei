import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requestIdParamSchema } from '../requests/request.schemas.js';
import {
  upsertClosingFormBodySchema,
  closingFormResponseSchema,
} from './closing-form.schemas.js';
import { getClosingForm, upsertClosingForm, confirmClosingForm } from './closing-form.service.js';

export async function closingFormRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Closing Form'],
        summary: 'Получить анкету закрытия',
        params: requestIdParamSchema,
        response: { 200: closingFormResponseSchema },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return getClosingForm(request.params.id, { userId: auth.id, role: auth.role });
    },
  );

  r.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Closing Form'],
        summary: 'Создать или обновить анкету закрытия',
        params: requestIdParamSchema,
        body: upsertClosingFormBodySchema,
        response: { 200: closingFormResponseSchema },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return upsertClosingForm(request.params.id, request.body, {
        userId: auth.id,
        role: auth.role,
      });
    },
  );

  r.patch(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Closing Form'],
        summary: 'Частичное обновление анкеты закрытия',
        params: requestIdParamSchema,
        body: upsertClosingFormBodySchema.partial(),
        response: { 200: closingFormResponseSchema },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      const existing = await getClosingForm(request.params.id, { userId: auth.id, role: auth.role });
      const merged = {
        incomeAmount: request.body.incomeAmount ?? existing.incomeAmount,
        expenseAmount: request.body.expenseAmount ?? existing.expenseAmount,
        workPerformed: request.body.workPerformed ?? existing.workPerformed ?? undefined,
      };
      return upsertClosingForm(request.params.id, merged, { userId: auth.id, role: auth.role });
    },
  );

  r.post(
    '/confirm',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Closing Form'],
        summary: 'Подтвердить закрытие заявки',
        params: requestIdParamSchema,
        body: upsertClosingFormBodySchema,
        response: { 200: closingFormResponseSchema },
      },
    },
    async (request) => {
      const auth = request.authUser!;
      return confirmClosingForm(request.params.id, { userId: auth.id, role: auth.role }, request.body);
    },
  );
}
