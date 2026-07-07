import type { RequestPriority, RequestStatus } from "./types";

export const STATUS_LABELS: Record<RequestStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  awaiting_parts: "Ожидание запчастей",
  frozen: "Заморожена",
  in_service: "В сервисе",
  closed: "Закрыта",
  cancelled: "Отменена",
};

export const PRIORITY_LABELS: Record<RequestPriority, string> = {
  critical: "Критический",
  high: "Высокий",
  normal: "Средний",
  low: "Низкий",
};

export const SOURCE_LABELS = {
  site: "Сайт",
  manual: "Вручную",
} as const;

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
