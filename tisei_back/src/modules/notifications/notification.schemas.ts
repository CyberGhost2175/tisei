import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';
import { NOTIFICATION_EVENT_TYPES } from './notification-events.js';

const optionalBooleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

export const notificationListQuerySchema = paginationSchema.extend({
  isRead: optionalBooleanQuery,
  event: z.string().optional(),
});

export const notificationIdParamSchema = z.object({ id: z.string() });

export const updatePreferencesBodySchema = z.object({
  preferences: z.array(
    z.object({
      eventType: z.enum(NOTIFICATION_EVENT_TYPES as unknown as [string, ...string[]]),
      isEnabled: z.boolean(),
    }),
  ),
});

export const markReadBodySchema = z.object({
  ids: z.array(z.string()).optional(),
  markAll: z.boolean().default(false),
});

export const devicePlatformSchema = z.enum(['ios', 'android', 'web']);

export const registerDeviceTokenBodySchema = z.object({
  token: z.string().min(32).max(4096),
  platform: devicePlatformSchema,
  /** Stable device id so a new FCM token replaces the old one on reinstall */
  deviceId: z.string().min(1).max(256).optional(),
});

export const unregisterDeviceTokenBodySchema = z.object({
  token: z.string().min(32).max(4096),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type RegisterDeviceTokenBody = z.infer<typeof registerDeviceTokenBodySchema>;
