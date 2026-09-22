/** Human-readable Russian labels for request enums (system comments & push). */

export const REQUEST_STATUS_LABELS_RU: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  awaiting_parts: 'Ожидание запчастей',
  frozen: 'Заморожена',
  in_service: 'В сервисе',
  awaiting_approval: 'Ждёт согласование',
  repeat: 'Повтор',
  closed: 'Закрыта',
  cancelled: 'Отменена',
};

export const REQUEST_PRIORITY_LABELS_RU: Record<string, string> = {
  P1: 'P1 — критический',
  P2: 'P2 — высокий',
  P3: 'P3 — средний',
  P4: 'P4 — низкий',
};

export const REQUEST_PRIORITY_SHORT: Record<string, string> = {
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4',
};

export function statusLabelRu(status: string): string {
  return REQUEST_STATUS_LABELS_RU[status] ?? status;
}

export function priorityLabelRu(priority: string | null | undefined): string {
  if (!priority) return 'Не задан';
  return REQUEST_PRIORITY_LABELS_RU[priority] ?? priority;
}

export function priorityShort(priority: string | null | undefined): string {
  if (!priority) return '—';
  return REQUEST_PRIORITY_SHORT[priority] ?? priority;
}
