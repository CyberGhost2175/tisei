"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { MSym } from "../components/symbols";
import { PeriodSelector, type Period } from "./PeriodSelector";
import { fetchDashboard, fetchReport } from "@/lib/requests-api";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { useGlobalSearch } from "@/lib/global-search";
import { matchesSearch } from "@/lib/search-utils";
import type { AnalyticsReport, DashboardKpi } from "@/lib/types";
import { priorityLabel, statusLabel } from "@/lib/labels";
import { ApiError } from "@/lib/api";

import { useRouter } from "next/navigation";

function getRange(period: Period) {
  const now = new Date();
  const dateTo = now.toISOString();
  const from = new Date(now);
  if (period === "day") from.setDate(now.getDate() - 1);
  if (period === "week") from.setDate(now.getDate() - 7);
  if (period === "month") from.setMonth(now.getMonth() - 1);
  if (period === "quarter") from.setMonth(now.getMonth() - 3);
  if (period === "year") from.setFullYear(now.getFullYear() - 1);
  return { dateFrom: from.toISOString(), dateTo };
}

export default function AnalyticsPage() {
  useRequireAuth();
  const { user } = useAuth();
  const router = useRouter();
  const { debouncedQuery } = useGlobalSearch();

  useEffect(() => {
    if (user?.role === "executor" || user?.role === "master") router.replace("/");
  }, [user, router]);

  const [period, setPeriod] = useState<Period>("month");
  const [dashboard, setDashboard] = useState<DashboardKpi | null>(null);
  const [statusReport, setStatusReport] = useState<AnalyticsReport | null>(null);
  const [executorReport, setExecutorReport] = useState<AnalyticsReport | null>(null);
  const [overdueReport, setOverdueReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const { dateFrom, dateTo } = getRange(period);
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [dash, statuses, executors, overdue] = await Promise.all([
          fetchDashboard(dateFrom, dateTo),
          fetchReport("requests_by_status", dateFrom, dateTo),
          fetchReport("requests_by_executor", dateFrom, dateTo),
          fetchReport("overdue_requests", dateFrom, dateTo),
        ]);
        setDashboard(dash);
        setStatusReport(statuses);
        setExecutorReport(executors);
        setOverdueReport(overdue);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Ошибка загрузки аналитики");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [period]);

  const statusRows = useMemo(() => {
    const rows = (statusReport?.rows ?? []) as Array<{ status: string; count: number }>;
    return rows.filter((r) =>
      matchesSearch(debouncedQuery, r.status, statusLabel(r.status), String(r.count)),
    );
  }, [statusReport, debouncedQuery]);
  const executorRows = useMemo(() => {
    const rows = (executorReport?.rows ?? []) as Array<{ executorName: string; count: number }>;
    return rows.filter((r) => matchesSearch(debouncedQuery, r.executorName, String(r.count)));
  }, [executorReport, debouncedQuery]);
  const overdueRows = useMemo(() => {
    const rows = (overdueReport?.rows ?? []) as Array<{
      number: string;
      companyOrFullName: string;
      deadline: string | null;
      priority: string;
      status: string;
    }>;
    return rows.filter((r) =>
      matchesSearch(
        debouncedQuery,
        r.number,
        r.companyOrFullName,
        r.priority,
        priorityLabel(r.priority),
        r.status,
        statusLabel(r.status),
      ),
    );
  }, [overdueReport, debouncedQuery]);
  const maxStatus = Math.max(...statusRows.map((r) => Number(r.count || 0)), 1);

  return (
    <AppShell active="analytics" mobileActive="alerts" searchPlaceholder="Поиск отчетов, метрик...">
      <div className="flex flex-col gap-gutter">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Операционная аналитика</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Отчеты по статусам, исполнителям и просроченным заявкам</p>
          </div>
          <PeriodSelector active={period} onChange={setPeriod} />
        </div>

        {error && <p className="text-error">{error}</p>}

        <div className="grid grid-cols-12 gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant shadow-sm col-span-12 lg:col-span-8 p-stack-md rounded-xl flex flex-col gap-4 min-h-[320px]">
            <div className="flex items-center gap-2">
              <MSym name="analytics" className="text-primary" />
              <h3 className="font-headline-sm text-headline-sm">Динамика статусов</h3>
            </div>
            <div className="flex-1 relative flex items-end justify-between gap-3 px-4 pb-4 bg-surface-container-lowest rounded-lg min-h-[220px]">
              {statusRows.map((b) => (
                <div key={b.status} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div className="w-12 bg-primary rounded-t-sm relative" style={{ height: `${Math.max(18, (Number(b.count) / maxStatus) * 100)}%` }}>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] py-1 px-2 rounded whitespace-nowrap">
                      {b.count}
                    </div>
                  </div>
                  <span className="text-[10px] text-on-surface-variant font-mono-data text-center leading-tight">
                    {statusLabel(b.status)}
                  </span>
                </div>
              ))}
              {!loading && statusRows.length === 0 && <p className="text-on-surface-variant">Нет данных</p>}
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant shadow-sm col-span-12 lg:col-span-4 p-stack-md rounded-xl flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <MSym name="timer" className="text-primary" />
              <h3 className="font-headline-sm text-headline-sm">KPI</h3>
            </div>
            <Metric label="Всего заявок" value={dashboard?.kpi.totalRequests ?? "—"} />
            <Metric label="Просрочено" value={dashboard?.kpi.overdueRequests ?? "—"} />
            <Metric label="Закрыто" value={dashboard?.kpi.closedRequests ?? "—"} />
            <Metric label="Исполнителей" value={dashboard?.kpi.activeExecutors ?? "—"} />
            <Metric label="Доход" value={dashboard ? `${Math.round(dashboard.kpi.financials.totalIncome).toLocaleString("ru-RU")} ₸` : "—"} />
            <Metric label="Прибыль" value={dashboard ? `${Math.round(dashboard.kpi.financials.totalProfit).toLocaleString("ru-RU")} ₸` : "—"} />
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant shadow-sm col-span-12 lg:col-span-6 p-stack-md rounded-xl flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <MSym name="engineering" className="text-primary" />
              <h3 className="font-headline-sm text-headline-sm">Эффективность исполнителей</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low text-label-md border-b border-outline-variant">
                    <th className="px-4 py-3 font-bold">Исполнитель</th>
                    <th className="px-4 py-3 font-bold">Заявок</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {executorRows.map((row) => (
                    <tr key={String(row.executorName)} className="text-body-sm">
                      <td className="px-4 py-3">{row.executorName}</td>
                      <td className="px-4 py-3 font-mono-data">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant shadow-sm col-span-12 lg:col-span-6 p-stack-md rounded-xl flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <MSym name="warning" className="text-error" />
              <h3 className="font-headline-sm text-headline-sm">Просроченные задачи</h3>
            </div>
            <div className="space-y-3">
              {overdueRows.slice(0, 5).map((row) => (
                <div key={String(row.number)} className="p-3 border border-error-container bg-error-container/10 rounded-lg">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-bold">{row.number}</p>
                      <p className="text-body-sm text-on-surface-variant">{row.companyOrFullName}</p>
                    </div>
                    <div className="text-right text-body-sm">
                      <p>{priorityLabel(row.priority)}</p>
                      <p className="text-on-surface-variant text-[11px]">{statusLabel(row.status)}</p>
                      <p className="text-on-surface-variant">{row.deadline ? new Date(row.deadline).toLocaleDateString("ru-RU") : "—"}</p>
                    </div>
                  </div>
                </div>
              ))}
              {!loading && overdueRows.length === 0 && <p className="text-on-surface-variant">Просроченных заявок нет</p>}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-outline-variant pb-2">
      <span className="text-on-surface-variant">{label}</span>
      <span className="font-mono-data font-bold">{value}</span>
    </div>
  );
}
