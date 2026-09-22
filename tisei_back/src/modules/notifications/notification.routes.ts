import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import {
  notificationListQuerySchema,
  notificationIdParamSchema,
  updatePreferencesBodySchema,
  markReadBodySchema,
  registerDeviceTokenBodySchema,
  unregisterDeviceTokenBodySchema,
} from './notification.schemas.js';
import {
  listNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  markNotificationsRead,
  markSingleRead,
  getUnreadCount,
} from './notification.service.js';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  listDeviceTokens,
} from './device-token.service.js';

const notificationResponseSchema = z.object({
  id: z.string(),
  event: z.string(),
  payload: z.unknown(),
  channel: z.enum(['email', 'push']),
  isRead: z.boolean(),
  sentAt: z.string().nullable(),
  createdAt: z.string(),
});

const deviceTokenResponseSchema = z.object({
  id: z.string(),
  token: z.string(),
  platform: z.enum(['ios', 'android', 'web']),
  deviceId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Notifications'],
        summary: 'Список уведомлений текущего пользователя',
        security: [{ bearerAuth: [] }],
        querystring: notificationListQuerySchema,
        response: {
          200: z.object({
            items: z.array(notificationResponseSchema),
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
    async (request) => listNotifications(request.authUser!.id, request.query),
  );

  r.get(
    '/unread-count',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Notifications'],
        summary: 'Количество непрочитанных уведомлений',
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ count: z.number() }) },
      },
    },
    async (request) => ({ count: await getUnreadCount(request.authUser!.id) }),
  );

  r.post(
    '/mark-read',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Notifications'],
        summary: 'Отметить уведомления прочитанными',
        security: [{ bearerAuth: [] }],
        body: markReadBodySchema,
        response: { 200: z.object({ updated: z.number() }) },
      },
    },
    async (request) => markNotificationsRead(request.authUser!.id, request.body),
  );

  r.get(
    '/preferences',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Notifications'],
        summary: 'Настройки уведомлений по типам событий',
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            preferences: z.array(
              z.object({
                eventType: z.string(),
                label: z.string(),
                isEnabled: z.boolean(),
              }),
            ),
          }),
        },
      },
    },
    async (request) => ({
      preferences: await getNotificationPreferences(request.authUser!.id),
    }),
  );

  r.patch(
    '/preferences',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Notifications'],
        summary: 'Обновить настройки уведомлений',
        security: [{ bearerAuth: [] }],
        body: updatePreferencesBodySchema,
        response: {
          200: z.object({
            preferences: z.array(
              z.object({
                eventType: z.string(),
                label: z.string(),
                isEnabled: z.boolean(),
              }),
            ),
          }),
        },
      },
    },
    async (request) => ({
      preferences: await updateNotificationPreferences(
        request.authUser!.id,
        request.body.preferences,
      ),
    }),
  );

  r.get(
    '/device-tokens',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Notifications'],
        summary: 'Список FCM device tokens текущего пользователя',
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ items: z.array(deviceTokenResponseSchema) }),
        },
      },
    },
    async (request) => listDeviceTokens(request.authUser!.id),
  );

  r.post(
    '/device-tokens',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Notifications'],
        summary: 'Зарегистрировать FCM device token (mobile / web)',
        security: [{ bearerAuth: [] }],
        body: registerDeviceTokenBodySchema,
        response: { 200: deviceTokenResponseSchema },
      },
    },
    async (request) => registerDeviceToken(request.authUser!.id, request.body),
  );

  r.delete(
    '/device-tokens',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Notifications'],
        summary: 'Удалить FCM device token (logout / отписка)',
        security: [{ bearerAuth: [] }],
        body: unregisterDeviceTokenBodySchema,
        response: { 200: z.object({ deleted: z.number() }) },
      },
    },
    async (request) =>
      unregisterDeviceToken(request.authUser!.id, request.body.token),
  );

  r.patch(
    '/:id/read',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Notifications'],
        summary: 'Отметить одно уведомление прочитанным',
        security: [{ bearerAuth: [] }],
        params: notificationIdParamSchema,
        response: { 200: notificationResponseSchema },
      },
    },
    async (request) => markSingleRead(request.authUser!.id, request.params.id),
  );
}
