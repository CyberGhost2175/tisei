import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRole } from '../../common/middleware/requireRole.js';
import { messageResponseSchema } from '../../common/validation/common.schemas.js';
import {
  userListQuerySchema,
  createUserBodySchema,
  updateUserBodySchema,
  userIdParamSchema,
  adminResetPasswordBodySchema,
} from './user.schemas.js';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  archiveUser,
  adminResetPassword,
  listExecutors,
} from './user.service.js';
import {
  userSettingsResponseSchema,
  updateUserSettingsBodySchema,
} from '../settings/settings.schemas.js';
import { getUserSettings, updateUserSettings } from '../settings/settings.service.js';

const userResponseSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  role: z.enum(['manager', 'executor', 'master', 'admin']),
  specialization: z.array(z.string()),
  avatarUrl: z.string().nullable(),
  is2faEnabled: z.boolean(),
  isActive: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const paginatedUsersSchema = z.object({
  items: z.array(userResponseSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        tags: ['Users'],
        summary: 'Список пользователей',
        security: [{ bearerAuth: [] }],
        querystring: userListQuerySchema,
        response: { 200: paginatedUsersSchema },
      },
    },
    async (request) => listUsers(request.query),
  );

  r.get(
    '/executors',
    {
      preHandler: [authenticate, requireRole(['manager', 'admin'])],
      schema: {
        tags: ['Users'],
        summary: 'Список активных исполнителей (для назначения заявок)',
        security: [{ bearerAuth: [] }],
        response: {
          200: z.array(z.object({ id: z.string(), fullName: z.string(), email: z.string() })),
        },
      },
    },
    async () => listExecutors(),
  );

  r.get(
    '/me/settings',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Персональные настройки текущего пользователя',
        security: [{ bearerAuth: [] }],
        response: { 200: userSettingsResponseSchema },
      },
    },
    async (request) => getUserSettings(request.authUser!.id),
  );

  r.patch(
    '/me/settings',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Обновить персональные настройки',
        security: [{ bearerAuth: [] }],
        body: updateUserSettingsBodySchema,
        response: { 200: userSettingsResponseSchema },
      },
    },
    async (request) => updateUserSettings(request.authUser!.id, request.body.theme),
  );

  r.get(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        tags: ['Users'],
        summary: 'Получить пользователя',
        security: [{ bearerAuth: [] }],
        params: userIdParamSchema,
        response: { 200: userResponseSchema },
      },
    },
    async (request) => getUserById(request.params.id),
  );

  r.post(
    '/',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        tags: ['Users'],
        summary: 'Создать пользователя',
        security: [{ bearerAuth: [] }],
        body: createUserBodySchema,
        response: { 201: userResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await createUser(request.body, request.authUser!.id);
      return reply.status(201).send(user);
    },
  );

  r.patch(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        tags: ['Users'],
        summary: 'Обновить пользователя',
        security: [{ bearerAuth: [] }],
        params: userIdParamSchema,
        body: updateUserBodySchema,
        response: { 200: userResponseSchema },
      },
    },
    async (request) =>
      updateUser(request.params.id, request.body, request.authUser!.id, request.authUser!.role),
  );

  r.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        tags: ['Users'],
        summary: 'Удалить пользователя',
        security: [{ bearerAuth: [] }],
        params: userIdParamSchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      await deleteUser(request.params.id, request.authUser!.id);
      return { message: 'Пользователь удалён' };
    },
  );

  r.post(
    '/:id/reset-password',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        tags: ['Users'],
        summary: 'Сброс пароля администратором',
        security: [{ bearerAuth: [] }],
        params: userIdParamSchema,
        body: adminResetPasswordBodySchema,
        response: {
          200: z.object({
            message: z.string(),
            temporaryPassword: z.string().optional(),
          }),
        },
      },
    },
    async (request) =>
      adminResetPassword(request.params.id, request.authUser!.id, request.body),
  );

  r.post(
    '/:id/archive',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        tags: ['Users'],
        summary: 'Архивировать пользователя (деактивация)',
        security: [{ bearerAuth: [] }],
        params: userIdParamSchema,
        response: { 200: userResponseSchema },
      },
    },
    async (request) => archiveUser(request.params.id, request.authUser!.id),
  );
}
