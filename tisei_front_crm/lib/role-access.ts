import type { UserRole } from "./types";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  executor: "Исполнитель",
};

export const ROLE_ACCESS: Record<UserRole, string[]> = {
  admin: [
    "Полный доступ ко всем разделам",
    "Управление пользователями (создание, роли, удаление)",
    "Справочники и партнёры",
    "Аналитика и отчёты",
    "Создание и назначение заявок",
  ],
  manager: [
    "Дашборд и заявки",
    "Создание заявок вручную",
    "Назначение исполнителей",
    "Аналитика и справочники",
    "Карта маршрутов",
  ],
  executor: [
    "Свои и свободные заявки",
    "Взятие заявок в работу",
    "Карта маршрута",
    "Закрытие заявок (анкета)",
    "Комментарии и вложения",
  ],
};

/** Маршруты CRM, доступные только указанным ролям */
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  "/users": ["admin"],
  "/dictionaries": ["admin", "manager"],
  "/analytics": ["admin", "manager"],
  "/kpi": ["admin", "manager"],
  "/requests/new": ["admin", "manager"],
};

export function canAccessRoute(path: string, role: UserRole | undefined): boolean {
  if (!role) return false;
  const rule = Object.entries(ROUTE_ROLES).find(([prefix]) => path.startsWith(prefix));
  if (!rule) return true;
  return rule[1].includes(role);
}
