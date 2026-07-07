import type { UserRole } from "./types";

export type NavKey =
  | "dashboard"
  | "requests"
  | "map"
  | "kpi"
  | "analytics"
  | "users"
  | "refs"
  | "settings";

export const NAV_ITEMS: {
  key: NavKey;
  label: string;
  icon: string;
  href: string;
  roles?: UserRole[];
}[] = [
  { key: "dashboard", label: "Дашборд", icon: "dashboard", href: "/" },
  { key: "requests", label: "Заявки", icon: "assignment", href: "/requests" },
  { key: "map", label: "Карта", icon: "map", href: "/map" },
  { key: "kpi", label: "КПД", icon: "leaderboard", href: "/kpi", roles: ["admin", "manager"] },
  { key: "analytics", label: "Аналитика", icon: "analytics", href: "/analytics", roles: ["admin", "manager"] },
  { key: "users", label: "Пользователи", icon: "group", href: "/users", roles: ["admin"] },
  { key: "refs", label: "Справочники", icon: "folder_shared", href: "/dictionaries", roles: ["admin", "manager"] },
  { key: "settings", label: "Настройки", icon: "settings", href: "/settings" },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  executor: "Исполнитель",
};
