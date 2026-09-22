"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "./components/AppShell";
import { MSym } from "./components/symbols";
import { fetchDashboard, fetchRequests } from "@/lib/requests-api";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { useGlobalSearch } from "@/lib/global-search";
import { usePolling } from "@/lib/usePolling";
import { PRIORITY_LABELS, STATUS_LABELS, formatDate } from "@/lib/labels";
import type { DashboardKpi, ServiceRequest } from "@/lib/types";
import { ApiError } from "@/lib/api";

function isRecent(iso: string, minutes = 60) {
  return Date.now() - new Date(iso).getTime() < minutes * 60 * 1000;
}

export function DashboardContent() {
  useRequireAuth();
  const { user } = useAuth();
  const isExecutor = user?.role === "executor";
  const isMaster = user?.role === "master";
  const isField = isExecutor || isMaster;
  const { debouncedQuery } = useGlobalSearch();
  const [kpi, setKpi] = useState<DashboardKpi["kpi"] | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [availableRequests, setAvailableRequests] = useState<ServiceRequest[]>([]);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      const listParams: Record<string, string | number | boolean> = {
        page: 1,
        pageSize: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
        active: true,
      };
      if (isField) listParams.mine = true;
      if (debouncedQuery) listParams.search = debouncedQuery;

      const availableParams: Record<string, string | number | boolean> = {
        page: 1,
        pageSize: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
        available: true,
      };
      if (debouncedQuery) availableParams.search = debouncedQuery;

      const fetches: [
        ReturnType<typeof fetchDashboard>,
        ReturnType<typeof fetchRequests>,
        ReturnType<typeof fetchRequests> | Promise<{ items: ServiceRequest[] }>,
      ] = [
        fetchDashboard(),
        fetchRequests(listParams),
        isExecutor ? fetchRequests(availableParams) : Promise.resolve({ items: [] as ServiceRequest[] }),
      ];

      const [dash, list, available] = await Promise.all(fetches);
      setKpi(dash.kpi);

      const mine = list.items.filter((r) => !["closed", "cancelled"].includes(r.status));
      const free = available.items.filter((r) => r.status === "new" || r.status === "in_progress");

      if (silent && knownIdsRef.current.size > 0) {
        const newIds = new Set<string>();
        for (const r of [...free, ...mine]) {
          if (!knownIdsRef.current.has(r.id)) newIds.add(r.id);
        }
        if (newIds.size > 0) {
          setHighlightIds(newIds);
          setTimeout(() => setHighlightIds(new Set()), 8000);
        }
      }

      const allIds = new Set([...mine, ...free].map((r) => r.id));
      knownIdsRef.current = allIds;

      setRequests(mine);
      setAvailableRequests(free);
      if (!silent) setError("");
    } catch (e) {
      if (!silent) setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
    }
  }, [isExecutor, isField, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(() => void load(true), 5000, !!user);

  const dashActions = (
    <Link
      href="/requests"
      className="bg-primary-container text-on-primary-container hover:opacity-90 transition-all font-bold px-4 py-2 rounded-lg flex items-center gap-2 text-label-md"
    >
      <MSym name="assignment" className="text-[18px]" />
      {isExecutor ? "Все заявки" : "Все заявки"}
    </Link>
  );

  return (
    <AppShell
      active="dashboard"
      mobileActive="tasks"
      searchPlaceholder="Поиск заявок..."
      actions={dashActions}
    >
      {error && <p className="text-error mb-4">{error}</p>}

      <div className="grid grid-cols-12 gap-gutter max-w-[1600px] mx-auto">
        <section className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter mb-stack-lg">
          {isField ? (
            <>
              <KpiCard title="Мои активные" value={kpi?.totalRequests ?? "—"} icon="assignment" />
              <KpiCard title="Сегодня новых" value={kpi?.todayRequests ?? 0} icon="today" />
              {isExecutor && (
                <KpiCard title="Свободные" value={availableRequests.length} icon="fiber_new" />
              )}
              <KpiCard title="В работе" value={kpi?.inProgress ?? 0} icon="engineering" />
              <KpiCard title="Закрыто сегодня" value={kpi?.closedRequests ?? 0} icon="task_alt" />
              <KpiCard title="Партнёры в очереди" value={kpi?.partnerActive ?? 0} icon="store" />
              <KpiCard title="Просроченные" value={kpi?.overdueRequests ?? 0} icon="warning" error />
            </>
          ) : (
            <>
              <KpiCard title="Всего заявок" value={kpi?.totalRequests ?? "—"} icon="analytics" />
              <KpiCard title="В работе" value={kpi?.byStatus?.in_progress ?? 0} icon="engineering" />
              <KpiCard title="Новые" value={kpi?.byStatus?.new ?? 0} icon="fiber_new" />
              <KpiCard title="В сервисе" value={kpi?.byStatus?.in_service ?? 0} icon="build" />
              <KpiCard title="Закрыты" value={kpi?.closedRequests ?? 0} icon="task_alt" />
              <KpiCard title="Просроченные" value={kpi?.overdueRequests ?? 0} icon="warning" error />
              <KpiCard
                title="Доход (подтвержд.)"
                value={kpi ? `${Math.round(kpi.financials.totalIncome).toLocaleString("ru")} ₸` : "—"}
                icon="payments"
              />
              <KpiCard title="Исполнители" value={kpi?.activeExecutors ?? "—"} icon="group" />
            </>
          )}
        </section>

        {isExecutor && availableRequests.length > 0 && (
          <div className="col-span-12">
            <RequestTable
              title="Новые свободные заявки"
              subtitle="Можно взять в работу без назначения менеджера"
              requests={availableRequests}
              highlightIds={highlightIds}
              showClaimHint
            />
          </div>
        )}

        <div className="col-span-12 lg:col-span-8">
          <RequestTable
            title={isField ? "Мои текущие заявки" : "Последние заявки"}
            requests={requests}
            highlightIds={highlightIds}
          />
        </div>

        {isField && (
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-primary-container/10 border border-primary-container/30 rounded-xl p-gutter">
              <h3 className="font-headline-sm text-headline-sm mb-3">Быстрые действия</h3>
              <div className="flex flex-col gap-2">
                <Link href="/map" className="px-4 py-3 bg-primary text-on-primary rounded-lg text-center font-label-md">
                  Маршрут на сегодня
                </Link>
                {isExecutor && (
                <Link
                  href="/requests?available=true"
                  className="px-4 py-3 border border-outline-variant rounded-lg text-center font-label-md"
                >
                  Свободные заявки
                </Link>
                )}
                <Link
                  href="/settings"
                  className="px-4 py-3 border border-outline-variant rounded-lg text-center font-label-md"
                >
                  Уведомления и тема
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function RequestTable({
  title,
  subtitle,
  requests,
  highlightIds,
  showClaimHint,
}: {
  title: string;
  subtitle?: string;
  requests: ServiceRequest[];
  highlightIds: Set<string>;
  showClaimHint?: boolean;
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
      <div className="px-gutter py-4 border-b border-outline-variant">
        <h2 className="font-headline-sm text-headline-sm">{title}</h2>
        {subtitle && <p className="text-body-sm text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-surface-container-low">
            <tr>
              {["Номер", "Статус", "Приоритет", "Клиент", "Источник", "Создана"].map((h) => (
                <th key={h} className="px-4 py-3 text-label-md text-on-surface-variant uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {requests.map((r) => (
              <tr
                key={r.id}
                className={[
                  r.partnerEstablishmentId ? "bg-sky-100/80 hover:bg-sky-100" : "hover:bg-surface-container-lowest",
                  highlightIds.has(r.id) ? "row-new-highlight" : "",
                ].join(" ")}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/requests/${r.id}`} className="font-mono-data font-bold hover:text-primary">
                      {r.number}
                    </Link>
                    {r.partnerEstablishmentId && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-200 text-sky-800">
                        партнёр
                      </span>
                    )}
                    {(highlightIds.has(r.id) || isRecent(r.createdAt)) && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary-container/20 text-primary">
                        new
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-body-sm">{STATUS_LABELS[r.status]}</td>
                <td className="px-4 py-3 text-body-sm">
                  {r.priority ? PRIORITY_LABELS[r.priority] : "—"}
                </td>
                <td className="px-4 py-3">{r.companyOrFullName}</td>
                <td className="px-4 py-3 text-body-sm">{r.source === "site" ? "Сайт" : "CRM"}</td>
                <td className="px-4 py-3 text-body-sm">{formatDate(r.createdAt)}</td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant">
                  {showClaimHint ? "Нет свободных заявок" : "Нет активных заявок"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  error,
}: {
  title: string;
  value: string | number;
  icon: string;
  error?: boolean;
}) {
  return (
    <div
      className={`border rounded-xl p-4 shadow-sm ${
        error
          ? "bg-error-container border-error/20"
          : "bg-surface-container-lowest border-outline-variant hover:border-primary"
      } transition-colors`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">{title}</span>
        <MSym name={icon} className={error ? "text-error" : "text-primary"} />
      </div>
      <div className={`font-display-lg text-display-lg ${error ? "text-error" : "text-on-surface"}`}>
        {value}
      </div>
    </div>
  );
}
