import { apiFetch } from "./api";
import type { Paginated } from "./types";

export type AppNotification = {
  id: string;
  event: string;
  payload: unknown;
  channel: "email" | "push";
  isRead: boolean;
  sentAt: string | null;
  createdAt: string;
};

export type NewRequestPayload = {
  requestId: string;
  number: string;
  companyOrFullName: string;
  address: string | null;
  priority: string;
  isPartner?: boolean;
};

export function fetchNotifications(params: {
  isRead?: boolean;
  event?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const qs = new URLSearchParams();
  if (params.isRead !== undefined) qs.set("isRead", String(params.isRead));
  if (params.event) qs.set("event", params.event);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  const q = qs.toString();
  return apiFetch<Paginated<AppNotification>>(`/notifications${q ? `?${q}` : ""}`);
}

export function markNotificationRead(id: string) {
  return apiFetch<AppNotification>(`/notifications/${id}/read`, { method: "PATCH" });
}

export type NotificationPreference = {
  eventType: string;
  label: string;
  isEnabled: boolean;
};

export function fetchNotificationPreferences() {
  return apiFetch<{ preferences: NotificationPreference[] }>("/notifications/preferences");
}

export function updateNotificationPreferences(preferences: { eventType: string; isEnabled: boolean }[]) {
  return apiFetch<{ preferences: NotificationPreference[] }>("/notifications/preferences", {
    method: "PATCH",
    body: JSON.stringify({ preferences }),
  });
}
