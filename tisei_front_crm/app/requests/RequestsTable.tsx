"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar, MobileDrawer } from "../components/Sidebar";
import { MobileNav } from "../components/MobileNav";
import { MSym } from "../components/symbols";
import { ConfirmModal } from "../components/Modal";
import { bulkDeleteRequests, claimRequest, fetchRequests } from "@/lib/requests-api";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { usePolling } from "@/lib/usePolling";
import { PRIORITY_LABELS, STATUS_LABELS, formatDate } from "@/lib/labels";
import type { RequestStatus, ServiceRequest } from "@/lib/types";
import { ApiError } from "@/lib/api";

type ExecutorFilter = "all" | "available" | "mine";
type StatusFilter = "all" | "active" | RequestStatus;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "active", label: "Текущие" },
  { key: "new", label: "Новые" },
  { key: "in_progress", label: "В работе" },
  { key: "awaiting_parts", label: "Запчасти" },
  { key: "in_service", label: "В сервисе" },
  { key: "awaiting_approval", label: "Согласование" },
  { key: "repeat", label: "Повтор" },
  { key: "closed", label: "Закрытые" },
];

export function RequestsTable() {
  useRequireAuth();
  const { user } = useAuth();
  const isExecutor = user?.role === "executor";
  const isMaster = user?.role === "master";
  const isField = isExecutor || isMaster;
  const canCreate = user?.role === "admin" || user?.role === "manager";
  const canDelete = canCreate;
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ExecutorFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (
      page = 1,
      q = search,
      silent = false,
      f = filter,
      status = statusFilter,
    ) => {
      if (!silent) setLoading(true);
      if (!silent) setError("");
      try {
        const params: Record<string, string | number | boolean | undefined> = {
          page,
          pageSize: 20,
          search: q || undefined,
          sortBy: "createdAt",
          sortOrder: "desc",
        };
        if (status === "active") params.active = true;
        else if (status !== "all") params.status = status;
        if (isExecutor) {
          if (f === "mine") params.mine = true;
          if (f === "available") params.available = true;
          // Закрытые — свои (история и реактивация).
          if (status === "closed") params.mine = true;
        } else if (isMaster) {
          params.mine = true;
        }
        const data = await fetchRequests(params);
        setItems(data.items);
        setMeta(data.meta);
        if (!silent) setSelectedIds(new Set());
      } catch (e) {
        if (!silent) setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [search, filter, statusFilter, isExecutor, isMaster],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => void load(1, search), 350);
    return () => clearTimeout(t);
  }, [search]);

  usePolling(() => void load(meta.page, search, true), 5000);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void load(1, search);
  };

  const onClaim = async (req: ServiceRequest) => {
    setClaimingId(req.id);
    try {
      await claimRequest(req.id);
      void load(meta.page, search, true);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Не удалось взять заявку");
    } finally {
      setClaimingId(null);
    }
  };

  const isMine = (req: ServiceRequest) =>
    !!user && req.assignments?.some((a) => a.executorId === user.id);

  const canClaim = (req: ServiceRequest) =>
    isExecutor &&
    !isMine(req) &&
    !["closed", "cancelled"].includes(req.status);

  const allPageSelected = items.length > 0 && items.every((r) => selectedIds.has(r.id));
  const someSelected = selectedIds.size > 0;

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of items) next.delete(r.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of items) next.add(r.id);
        return next;
      });
    }
  };

  const onBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setDeleting(true);
    setError("");
    try {
      await bulkDeleteRequests(ids);
      setConfirmDelete(false);
      setSelectedIds(new Set());
      void load(meta.page, search);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось удалить заявки");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const cols = [
    ...(canDelete ? [""] : []),
    "Номер",
    "Клиент",
    "Проблема",
    "Статус",
    "Приоритет",
    "Исполнитель",
    "Создана",
    ...(isField ? [""] : []),
  ];

  return (
    <div className="bg-background text-on-surface md:h-screen md:overflow-hidden flex">
      <Sidebar active="requests" />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} active="requests" />

      <div className="flex-1 flex flex-col md:ml-[240px] md:h-screen relative">
        <header className="flex justify-between items-center w-full px-container-margin h-16 bg-surface border-b border-outline-variant sticky top-0 z-30">
          <form onSubmit={handleSearch} className="flex items-center gap-4 flex-1">
            <button
              type="button"
              className="md:hidden text-primary w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container-low shrink-0"
              onClick={() => setMenuOpen(true)}
              aria-label="Открыть меню"
            >
              <MSym name="menu" />
            </button>
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
              <input
                className="w-full bg-surface-container-low border-none rounded-lg pl-10 pr-4 py-2 text-body-md focus:ring-2 focus:ring-primary-container"
                placeholder="Поиск заявок, клиентов..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </form>
        </header>

        <main className="flex-1 md:overflow-hidden flex flex-col p-container-margin gap-stack-md pb-28 md:pb-container-margin">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-gutter">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Сервисные заявки</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {loading ? "Загрузка..." : `Всего: ${meta.total}`}
                {" · "}
                <Link href="/maintenance" className="text-primary hover:underline">
                  Обслуживание (ТО)
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canDelete && someSelected && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-error/40 text-error font-label-md rounded-lg hover:bg-error-container/20"
                >
                  <MSym name="delete" className="text-[18px]" />
                  Удалить ({selectedIds.size})
                </button>
              )}
              {canCreate && (
                <Link
                  href="/requests/new"
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-label-md rounded-lg"
                >
                  <MSym name="add" className="text-[18px]" /> Новая заявка
                </Link>
              )}
              <button
                type="button"
                onClick={() => void load(meta.page)}
                className="flex items-center gap-2 px-4 py-2 border border-outline-variant font-label-md rounded-lg"
              >
                <MSym name="refresh" className="text-[18px]" /> Обновить
              </button>
            </div>
          </div>

          {isExecutor && (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "all", label: "Все заявки" },
                  { key: "available", label: "Свободные" },
                  { key: "mine", label: "Мои" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setFilter(tab.key);
                    void load(1, search, false, tab.key, statusFilter);
                  }}
                  className={
                    filter === tab.key
                      ? "px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-label-md"
                      : "px-4 py-2 rounded-lg bg-surface-container-low text-on-surface-variant text-sm"
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.key);
                  void load(1, search, false, filter, tab.key);
                }}
                className={
                  statusFilter === tab.key
                    ? "shrink-0 px-4 py-2 rounded-lg bg-secondary text-on-secondary text-sm font-label-md"
                    : "shrink-0 px-4 py-2 rounded-lg bg-surface-container-low text-on-surface-variant text-sm hover:bg-surface-container"
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error && <p className="text-error text-body-sm">{error}</p>}

          <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col shadow-sm">
            <div className="overflow-x-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low sticky top-0 z-10">
                  <tr className="border-b border-outline-variant">
                    {canDelete && (
                      <th className="px-3 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          onChange={toggleAllPage}
                          disabled={items.length === 0}
                          aria-label="Выбрать все на странице"
                          className="size-4 accent-primary cursor-pointer"
                        />
                      </th>
                    )}
                    {cols
                      .filter((h) => h !== "")
                      .map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 font-label-md text-outline uppercase whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    {isField && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {items.map((req) => {
                    const selected = selectedIds.has(req.id);
                    return (
                      <tr
                        key={req.id}
                        className={
                          selected
                            ? "bg-error-container/15 hover:bg-error-container/25 transition-colors"
                            : req.partnerEstablishmentId
                              ? "bg-sky-100/80 hover:bg-sky-100 transition-colors"
                              : "hover:bg-surface-container-low transition-colors"
                        }
                      >
                        {canDelete && (
                          <td className="px-3 py-4">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleOne(req.id)}
                              aria-label={`Выбрать ${req.number}`}
                              className="size-4 accent-primary cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-4 py-4 font-mono-data">
                          <Link
                            href={`/requests/${req.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {req.number}
                          </Link>
                          {req.fromMaintenanceRequest && (
                            <span className="ml-2 text-[10px] font-bold uppercase text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              С обслуживания
                            </span>
                          )}
                          {req.partnerEstablishmentId && !req.fromMaintenanceRequest && (
                            <span className="ml-2 text-[10px] font-bold uppercase text-sky-700">
                              Партнёр
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold">{req.companyOrFullName}</span>
                            <span className="text-body-sm text-on-surface-variant">{req.phone}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-body-md max-w-xs truncate">
                          {req.problemDescription || "—"}
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-1 rounded bg-primary-container/10 text-primary text-[11px] font-bold uppercase">
                            {STATUS_LABELS[req.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={
                              req.priority === "P1"
                                ? "px-2 py-1 rounded bg-error-container/20 text-error text-[11px] font-bold uppercase"
                                : "text-body-sm font-bold"
                            }
                          >
                            {req.priority ? PRIORITY_LABELS[req.priority] : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-body-sm">
                          {req.assignments?.[0]?.executor.fullName ?? (
                            <span className="italic text-outline">Не назначен</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-body-sm text-on-surface-variant">
                          {formatDate(req.createdAt)}
                        </td>
                        {isField && (
                          <td className="px-4 py-4">
                            {canClaim(req) ? (
                              <button
                                type="button"
                                disabled={claimingId === req.id}
                                onClick={() => void onClaim(req)}
                                className="text-primary text-body-sm font-label-md hover:underline disabled:opacity-50"
                              >
                                {claimingId === req.id ? "..." : "Взять"}
                              </button>
                            ) : isMine(req) ? (
                              <span className="text-primary text-body-sm">
                                {req.assignments?.find((a) => a.executorId === user?.id)?.status ===
                                "proposed"
                                  ? "Предложена"
                                  : "Моя"}
                              </span>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {!loading && items.length === 0 && (
                    <tr>
                      <td
                        colSpan={cols.length}
                        className="px-4 py-12 text-center text-on-surface-variant"
                      >
                        Заявок пока нет.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-surface-container px-4 py-3 border-t border-outline-variant flex items-center justify-between gap-3 flex-wrap">
              <span className="text-body-sm text-on-surface-variant">
                Стр. {meta.page} из {meta.totalPages}
                {canDelete && someSelected ? ` · выбрано: ${selectedIds.size}` : ""}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() => void load(meta.page - 1)}
                  className="px-3 py-1 rounded border border-outline-variant disabled:opacity-40"
                >
                  Назад
                </button>
                <button
                  type="button"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => void load(meta.page + 1)}
                  className="px-3 py-1 rounded border border-outline-variant disabled:opacity-40"
                >
                  Далее
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <MobileNav active="tasks" />

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void onBulkDelete()}
        title="Удалить выбранные заявки?"
        description={`Точно удалить ${selectedIds.size} заявк${
          selectedIds.size === 1 ? "у" : selectedIds.size < 5 ? "и" : "ок"
        }? Их можно будет восстановить в течение 30 дней.`}
        confirmLabel="Да, удалить"
        loading={deleting}
        destructive
      />
    </div>
  );
}
