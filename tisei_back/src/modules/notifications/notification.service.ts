import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { buildPaginated, toSkipTake } from '../../common/utils/pagination.js';
import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_EVENT_LABELS,
  type NotificationEventType,
} from './notification-events.js';
import { statusLabelRu } from '../../common/utils/labels.ru.js';
import type { NotificationListQuery } from './notification.schemas.js';
import { sendPushToUsers } from './fcm.service.js';

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

function eventTitle(event: string): string {
  return (
    NOTIFICATION_EVENT_LABELS[event as NotificationEventType] ?? 'Уведомление Береке ТехСервис'
  );
}

/** Build human-readable body + string data map for FCM. */
function buildPushContent(
  event: string,
  payload?: Record<string, unknown> | null,
): { title: string; body: string; data: Record<string, string> } {
  const title = eventTitle(event);
  const number = payload?.number != null ? String(payload.number) : null;
  const company =
    payload?.companyOrFullName != null ? String(payload.companyOrFullName) : null;
  const status = payload?.status != null ? String(payload.status) : null;

  const statusRu = status ? statusLabelRu(status) : null;
  const equipment =
    payload?.equipment != null ? String(payload.equipment) : null;
  const fromStatus =
    payload?.fromStatus != null ? statusLabelRu(String(payload.fromStatus)) : null;
  const toStatus =
    payload?.toStatus != null ? statusLabelRu(String(payload.toStatus)) : null;
  const address = payload?.address != null ? String(payload.address) : null;

  let body = title;
  if (event === 'request.created' && number) {
    const parts = [
      company ? `${number}: ${company}` : `Новая заявка ${number}`,
      'исполнитель не назначен',
    ];
    if (equipment) parts.push(equipment);
    if (address) parts.push(address);
    body = parts.join(' • ');
  } else if (event === 'request.assigned' && number) {
    if (payload?.proposed) {
      body = company
        ? `Вам предложена заявка ${number}: ${company}`
        : `Вам предложена заявка ${number}`;
    } else {
      body = company
        ? `Вам назначена заявка ${number}: ${company}`
        : `Вам назначена заявка ${number}`;
    }
  } else if (event === 'request.status_changed' && number) {
    if (fromStatus && toStatus) {
      body = `Заявка ${number}: ${fromStatus} → ${toStatus}`;
    } else if (statusRu) {
      body = `Заявка ${number}: статус — ${statusRu}`;
    } else {
      body = `Изменён статус заявки ${number}`;
    }
  } else if (event === 'request.closed' && number) {
    body = company ? `Заявка ${number} закрыта (${company})` : `Заявка ${number} закрыта`;
  } else if (event === 'comment.added' && number) {
    const excerpt = payload?.excerpt != null ? String(payload.excerpt) : null;
    body = excerpt
      ? `Комментарий к ${number}: ${excerpt}`
      : `Новый комментарий к заявке ${number}`;
  } else if (number) {
    body = `${title}: ${number}`;
  }

  const data: Record<string, string> = { event };
  if (payload) {
    for (const [key, value] of Object.entries(payload)) {
      if (value === null || value === undefined) continue;
      data[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
  }

  return { title, body, data };
}

async function deliverPush(
  userIds: string[],
  event: string,
  payload?: Record<string, unknown> | null,
): Promise<void> {
  if (userIds.length === 0) return;
  const content = buildPushContent(event, payload);
  await sendPushToUsers(userIds, content).catch(() => {
    /* FCM failures must not break the request lifecycle */
  });
}

async function filterByPreference(
  userIds: string[],
  eventType: string,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds }, eventType },
  });
  const prefMap = new Map(prefs.map((p) => [p.userId, p.isEnabled]));
  return userIds.filter((id) => prefMap.get(id) ?? true);
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

/** Internal helper for workers/services to create notifications (+ FCM when channel=push). */
export async function createNotification(data: {
  userId: string;
  event: string;
  payload?: Record<string, unknown>;
  channel: 'email' | 'push';
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      event: data.event,
      payload: data.payload as Prisma.InputJsonValue | undefined,
      channel: data.channel,
      sentAt: new Date(),
    },
  });

  if (data.channel === 'push') {
    void deliverPush([data.userId], data.event, data.payload);
  }

  return notification;
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

function equipmentLabel(request: {
  equipmentName?: string | null;
  equipmentCategoryText?: string | null;
  equipmentCategory?: { name: string } | null;
}): string | null {
  const name = request.equipmentName?.trim() || null;
  const category =
    request.equipmentCategory?.name?.trim() ||
    request.equipmentCategoryText?.trim() ||
    null;
  if (name && category) return `${name} (${category})`;
  return name ?? category;
}

async function persistAndPush(
  recipients: string[],
  event: string,
  payload: Record<string, unknown>,
) {
  if (recipients.length === 0) return;
  const jsonPayload = payload as Prisma.InputJsonValue;
  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      event,
      channel: 'push' as const,
      payload: jsonPayload,
      sentAt: new Date(),
    })),
  });
  await deliverPush(recipients, event, payload);
}

/** Уведомить команду о новой заявке без исполнителя (push сразу, в т.ч. в фоне). */
export async function notifyNewRequest(request: {
  id: string;
  number: string;
  companyOrFullName: string;
  address: string | null;
  priority: string | null;
  partnerEstablishmentId: string | null;
  equipmentName?: string | null;
  equipmentCategoryText?: string | null;
  equipmentCategory?: { name: string } | null;
}) {
  // Партнёрским мастерам свободные заявки не рассылаем — только менеджер предлагает.
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['executor', 'manager', 'admin'] },
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  const recipients = await filterByPreference(
    users.map((u) => u.id),
    'request.created',
  );
  if (recipients.length === 0) return;

  const equipment = equipmentLabel(request);
  const payload = {
    requestId: request.id,
    number: request.number,
    companyOrFullName: request.companyOrFullName,
    address: request.address,
    priority: request.priority,
    isPartner: !!request.partnerEstablishmentId,
    unassigned: true,
    ...(equipment ? { equipment } : {}),
  };

  await persistAndPush(recipients, 'request.created', payload);
}

/** Уведомить назначенных / предложенных мастеров. */
export async function notifyRequestAssigned(
  request: {
    id: string;
    number: string;
    companyOrFullName: string;
    address: string | null;
  },
  executorIds: string[],
  options?: { proposed?: boolean },
) {
  if (executorIds.length === 0) return;

  const recipients = await filterByPreference(executorIds, 'request.assigned');
  const payload = {
    requestId: request.id,
    number: request.number,
    companyOrFullName: request.companyOrFullName,
    address: request.address,
    ...(options?.proposed ? { proposed: true } : {}),
  };
  await persistAndPush(recipients, 'request.assigned', payload);
}

/** Уведомить заинтересованных о смене статуса. */
export async function notifyRequestStatusChanged(
  request: {
    id: string;
    number: string;
    companyOrFullName: string;
  },
  fromStatus: string,
  toStatus: string,
  options?: { excludeUserId?: string },
) {
  const assigned = await prisma.requestAssignment.findMany({
    where: { requestId: request.id },
    select: { executorId: true },
  });

  const staff = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['manager', 'admin'] } },
    select: { id: true },
  });

  const candidateIds = [
    ...new Set([
      ...assigned.map((a) => a.executorId),
      ...staff.map((u) => u.id),
    ]),
  ].filter((id) => id !== options?.excludeUserId);

  const event =
    toStatus === 'closed'
      ? 'request.closed'
      : toStatus === 'frozen'
        ? 'request.frozen'
        : 'request.status_changed';

  const recipients = await filterByPreference(candidateIds, event);
  const payload = {
    requestId: request.id,
    number: request.number,
    companyOrFullName: request.companyOrFullName,
    fromStatus,
    toStatus,
    status: toStatus,
  };
  await persistAndPush(recipients, event, payload);
}

/** Уведомить о новом комментарии (исполнители + менеджеры, кроме автора). */
export async function notifyCommentAdded(
  request: {
    id: string;
    number: string;
    companyOrFullName: string;
  },
  authorId: string,
  text: string,
) {
  const assigned = await prisma.requestAssignment.findMany({
    where: { requestId: request.id },
    select: { executorId: true },
  });
  const staff = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['manager', 'admin'] } },
    select: { id: true },
  });

  const candidateIds = [
    ...new Set([
      ...assigned.map((a) => a.executorId),
      ...staff.map((u) => u.id),
    ]),
  ].filter((id) => id !== authorId);

  const recipients = await filterByPreference(candidateIds, 'comment.added');
  const excerpt = text.trim().slice(0, 120);
  const payload = {
    requestId: request.id,
    number: request.number,
    companyOrFullName: request.companyOrFullName,
    excerpt,
  };
  await persistAndPush(recipients, 'comment.added', payload);
}
