"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Sidebar, MobileDrawer } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { useGlobalSearch } from "@/lib/global-search";
import type { NavKey } from "@/lib/nav";

type MobileKey = "tasks" | "map" | "alerts" | "profile";

export function Topbar({
  searchPlaceholder,
  actions,
  onMenuOpen,
  searchEnabled = true,
}: {
  searchPlaceholder: string;
  actions?: ReactNode;
  onMenuOpen: () => void;
  searchEnabled?: boolean;
}) {
  const { query, setQuery } = useGlobalSearch();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-surface border-b border-outline-variant flex items-center justify-between px-container-margin gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          type="button"
          className="md:hidden text-primary w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container-low shrink-0"
          onClick={onMenuOpen}
          aria-label="Открыть меню"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        {searchEnabled && (
          <form onSubmit={onSubmit} className="relative flex-1 max-w-md min-w-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              className="w-full bg-surface-container-low border-none rounded-full pl-10 pr-4 py-2 text-body-sm focus:ring-2 focus:ring-primary/20"
              placeholder={searchPlaceholder}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Поиск"
            />
          </form>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    </header>
  );
}

export function AppShell({
  active,
  mobileActive,
  searchPlaceholder,
  searchEnabled = true,
  actions,
  children,
  mainClassName = "p-container-margin pb-28 md:pb-8",
}: {
  active: NavKey;
  mobileActive: MobileKey;
  searchPlaceholder: string;
  searchEnabled?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  mainClassName?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Sidebar active={active} />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} active={active} />
      <div className="md:ml-[240px] min-h-screen flex flex-col">
        <Topbar
          searchPlaceholder={searchPlaceholder}
          searchEnabled={searchEnabled}
          actions={actions}
          onMenuOpen={() => setMenuOpen(true)}
        />
        <main className={mainClassName}>{children}</main>
      </div>
      <MobileNav active={mobileActive} />
    </>
  );
}
