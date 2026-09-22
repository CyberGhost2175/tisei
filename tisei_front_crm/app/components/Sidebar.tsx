"use client";

import Link from "next/link";
import { MSym, filled } from "./symbols";
import { useAuth } from "@/lib/AuthProvider";
import { initials } from "@/lib/labels";
import { NAV_ITEMS, ROLE_LABELS } from "@/lib/nav";
import type { NavKey } from "@/lib/nav";

export function Sidebar({ active }: { active: NavKey }) {
  const { user, logout } = useAuth();
  const navItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] bg-surface-container-lowest border-r border-outline-variant hidden md:flex flex-col py-stack-md z-40">
      <SidebarContent active={active} navItems={navItems} user={user} onLogout={() => void logout()} />
    </aside>
  );
}

export function MobileDrawer({
  open,
  onClose,
  active,
}: {
  open: boolean;
  onClose: () => void;
  active: NavKey;
}) {
  const { user, logout } = useAuth();
  const navItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-inverse-surface/40"
        aria-label="Закрыть меню"
        onClick={onClose}
      />
      <aside className="absolute left-0 top-0 h-full w-[280px] max-w-[85vw] bg-surface-container-lowest border-r border-outline-variant flex flex-col py-stack-md shadow-2xl">
        <div className="px-gutter flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center"
            aria-label="Закрыть"
          >
            <MSym name="close" />
          </button>
        </div>
        <SidebarContent
          active={active}
          navItems={navItems}
          user={user}
          onLogout={() => void logout()}
          onNavigate={onClose}
        />
      </aside>
    </div>
  );
}

function SidebarContent({
  active,
  navItems,
  user,
  onLogout,
  onNavigate,
}: {
  active: NavKey;
  navItems: typeof NAV_ITEMS;
  user: ReturnType<typeof useAuth>["user"];
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="px-gutter mb-stack-lg">
        <div className="flex items-center gap-3">
          <img
            src="/bereke-mark.png"
            alt="Береке ТехСервис"
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
          <div className="min-w-0">
            <h1 className="font-display-lg text-[15px] font-bold text-primary leading-tight tracking-tight">
              Береке
            </h1>
            <p className="text-[11px] font-semibold text-primary/80 leading-tight">
              ТехСервис CRM
            </p>
            <p className="text-[10px] text-on-surface-variant tracking-wider uppercase mt-0.5">
              Сервисное управление
            </p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              className={
                isActive
                  ? "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 text-primary font-bold bg-surface-container-high"
                  : "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
              }
            >
              <span className="material-symbols-outlined" style={isActive ? filled : undefined}>
                {item.icon}
              </span>
              <span className="font-body-md">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-gutter mt-auto pt-stack-md border-t border-outline-variant space-y-2">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-surface-container">
          <div className="w-10 h-10 rounded-full bg-primary-container border-2 border-primary flex items-center justify-center text-on-primary-container font-bold text-xs">
            {user ? initials(user.fullName) : "?"}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="font-label-md text-on-surface truncate">{user?.fullName ?? "—"}</p>
            <p className="text-[10px] text-on-surface-variant truncate">
              {user ? ROLE_LABELS[user.role] : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full text-left px-4 py-2 text-body-sm text-on-surface-variant hover:text-error transition-colors"
        >
          Выйти
        </button>
      </div>
    </>
  );
}
