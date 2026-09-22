/** All notification event types used in TiSei CRM. */
export const NOTIFICATION_EVENT_TYPES = [
  'request.created',
  'request.assigned',
  'request.status_changed',
  'request.deadline_reminder',
  'request.overdue',
  'request.frozen',
  'request.closed',
  'comment.added',
  'closing_form.confirmed',
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventType, string> = {
  'request.created': 'Новая заявка',
  'request.assigned': 'Назначение / предложение заявки',
  'request.status_changed': 'Изменение статуса',
  'request.deadline_reminder': 'Напоминание за 24ч до дедлайна',
  'request.overdue': 'Просроченная заявка',
  'request.frozen': 'Заявка заморожена',
  'request.closed': 'Заявка закрыта',
  'comment.added': 'Новый комментарий',
  'closing_form.confirmed': 'Анкета закрытия подтверждена',
};
