import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { buildPaginated, toSkipTake } from '../../common/utils/pagination.js';
import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_EVENT_LABELS,
  type NotificationEventType,
} from './notification-events.js';
import type { NotificationListQuery } from './notification.schemas.js';

function toDto(n: {
  id: string;
  event: string;
  payload: unknown;
  channel: 'email' | 'push';
  isRead: boolean;
  sentAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: n.id,
    event: n.event,
    payload: n.payload,
    channel: n.channel,
    isRead: n.isRead,
    sentAt: n.sentAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function listNotifications(userId: string, query: NotificationListQuery) {
  const where = {
    userId,
    ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
    ...(query.event ? { event: query.event } : {}),
  };

  const { skip, take } = toSkipTake(query);
  const [items, total] = await Promise.all([
    prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.notification.count({ where }),
  ]);

  return buildPaginated(items.map(toDto), total, query);
}

export async function markNotificationsRead(
  userId: string,
  options: { ids?: string[]; markAll?: boolean },
) {
  const where = {
    userId,
    isRead: false,
    ...(options.markAll ? {} : { id: { in: options.ids ?? [] } }),
  };

  const result = await prisma.notification.updateMany({
    where,
    data: { isRead: true },
  });

  return { updated: result.count };
}

export async function getNotificationPreferences(userId: string) {
  const existing = await prisma.notificationPreference.findMany({ where: { userId } });
  const map = new Map(existing.map((p) => [p.eventType, p.isEnabled]));

  return NOTIFICATION_EVENT_TYPES.map((eventType) => ({
    eventType,
    label: NOTIFICATION_EVENT_LABELS[eventType as NotificationEventType],
    isEnabled: map.get(eventType) ?? true,
  }));
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: Array<{ eventType: string; isEnabled: boolean }>,
) {
  await prisma.$transaction(
    preferences.map((p) =>
      prisma.notificationPreference.upsert({
        where: { userId_eventType: { userId, eventType: p.eventType } },
        create: { userId, eventType: p.eventType, isEnabled: p.isEnabled },
        update: { isEnabled: p.isEnabled },
      }),
    ),
  );

  return getNotificationPreferences(userId);
}

/** Internal helper for workers/services to create notifications. */
export async function createNotification(data: {
  userId: string;
  event: string;
  payload?: Record<string, unknown>;
  channel: 'email' | 'push';
}) {
  return prisma.notification.create({
    data: {
      userId: data.userId,
      event: data.event,
      payload: data.payload as Prisma.InputJsonValue | undefined,
      channel: data.channel,
      sentAt: new Date(),
    },
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markSingleRead(userId: string, notificationId: string) {
  const n = await prisma.notification.findFirst({ where: { id: notificationId, userId } });
  if (!n) throw new NotFoundError('Уведомление не найдено');

  await prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
  return toDto({ ...n, isRead: true });
}

/** Уведомить команду о новой заявке (CRM + исполнители). */
export async function notifyNewRequest(request: {
  id: string;
  number: string;
  companyOrFullName: string;
  address: string | null;
  priority: string;
  partnerEstablishmentId: string | null;
}) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['executor', 'manager', 'admin'] },
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  const prefs = await prisma.notificationPreference.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      eventType: 'request.created',
    },
  });
  const prefMap = new Map(prefs.map((p) => [p.userId, p.isEnabled]));

  const recipients = users.filter((u) => prefMap.get(u.id) ?? true);
  if (recipients.length === 0) return;

  const payload = {
    requestId: request.id,
    number: request.number,
    companyOrFullName: request.companyOrFullName,
    address: request.address,
    priority: request.priority,
    isPartner: !!request.partnerEstablishmentId,
  };

  await prisma.notification.createMany({
    data: recipients.map((u) => ({
      userId: u.id,
      event: 'request.created',
      channel: 'push' as const,
      payload,
      sentAt: new Date(),
    })),
  });
}
