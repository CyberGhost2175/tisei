"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "../components/AppShell";
import { MSym } from "../components/symbols";
import { fetchExecutorKpi, type ExecutorKpi, type ExecutorKpiPeriod } from "@/lib/requests-api";
import { useGlobalSearch } from "@/lib/global-search";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { usePolling } from "@/lib/usePolling";
import { ApiError } from "@/lib/api";

const PERIOD_TABS: { key: ExecutorKpiPeriod; label: string }[] = [
  { key: "day", label: "Сегодня" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
];

function formatPeriodRange(from: string, to: string) {
  const f = new Date(from);
  const t = new Date(to);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${f.toLocaleDateString("ru-RU", opts)} — ${t.toLocaleDateString("ru-RU", opts)}`;
}

export function KpiContent() {
  useRequireAuth();
  const { user } = useAuth();
  const router = useRouter();
  const { debouncedQuery } = useGlobalSearch();
  const [period, setPeriod] = useState<ExecutorKpiPeriod>("day");
  const [data, setData] = useState<ExecutorKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "executor" || user?.role === "master") router.replace("/");
  }, [user, router]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const result = await fetchExecutorKpi(period, debouncedQuery || undefined);
        setData(result);
      } catch (e) {
        if (!silent) setError(e instanceof ApiError ? e.message : "Ошибка загрузки КПД");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [period, debouncedQuery],
  );

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "manager") void load();
  }, [load, user?.role]);

  usePolling(() => void load(true), 30000, user?.role === "admin" || user?.role === "manager");

  const maxClaimed = Math.max(...(data?.rows.map((r) => r.claimed) ?? [0]), 1);

  return (
    <AppShell active="kpi" mobileActive="alerts" searchPlaceholder="Поиск мастера по имени или email...">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-headline-md text-headline-md">КПД мастеров</h1>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Сколько заявок взял, закрыл и заработал каждый мастер за период
            </p>
          </div>
          <div className="flex gap-2">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPeriod(tab.key)}
                className={
                  period === tab.key
                    ? "px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-label-md"
                    : "px-4 py-2 rounded-lg bg-surface-container-low text-on-surface-variant text-sm hover:text-primary"
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {data && (
          <p className="text-body-sm text-on-surface-variant">
            Период: {formatPeriodRange(data.from, data.to)}
            {debouncedQuery && ` · фильтр: «${debouncedQuery}»`}
          </p>
        )}

        {error && <p className="text-error text-body-sm">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
            <p className="text-label-md text-outline uppercase mb-1">Взято в работу</p>
            <p className="font-display-lg text-display-lg text-primary">{data?.totalClaimed ?? "—"}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
            <p className="text-label-md text-outline uppercase mb-1">Закрыто</p>
            <p className="font-display-lg text-display-lg text-on-surface">{data?.totalClosed ?? "—"}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
            <p className="text-label-md text-outline uppercase mb-1">Заработано</p>
            <p className="font-display-lg text-display-lg text-primary">
              {Math.round((data?.rows.reduce((s, r) => s + r.earned, 0) ?? 0)).toLocaleString("ru-RU")} ₸
            </p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="px-gutter py-4 border-b border-outline-variant flex items-center gap-2">
            <MSym name="leaderboard" className="text-primary" />
            <h2 className="font-headline-sm text-headline-sm">Рейтинг мастеров</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead className="bg-surface-container-low">
                <tr>
                  {["#", "Мастер", "Email", "Взято", "Закрыто", "Заработано", "Доля"].map((h) => (
                    <th key={h} className="px-4 py-3 text-label-md text-on-surface-variant uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">
                      Загрузка...
                    </td>
                  </tr>
                )}
                {!loading &&
                  data?.rows.map((row, idx) => (
                    <tr key={row.executorId} className="hover:bg-surface-container-low group">
                      <td className="px-4 py-3 font-bold text-primary">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/kpi/${row.executorId}?period=${period}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                          {row.executorName}
                          <MSym
                            name="chevron_right"
                            className="text-[18px] opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-body-sm text-on-surface-variant">{row.email}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/kpi/${row.executorId}?period=${period}`}
                          className="flex items-center gap-2 hover:opacity-80"
                        >
                          <span className="font-mono-data font-bold w-8 text-primary">{row.claimed}</span>
                          <div className="flex-1 h-2 bg-surface-container-high rounded-full max-w-[120px] overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${(row.claimed / maxClaimed) * 100}%` }}
                            />
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/kpi/${row.executorId}?period=${period}`}
                          className="font-mono-data text-primary hover:underline"
                        >
                          {row.closed}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono-data text-primary">
                        {Math.round(row.earned).toLocaleString("ru-RU")} ₸
                      </td>
                      <td className="px-4 py-3 text-body-sm text-on-surface-variant">
                        {data.totalClaimed > 0
                          ? `${Math.round((row.claimed / data.totalClaimed) * 100)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                {!loading && data?.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">
                      {debouncedQuery ? "Мастера не найдены" : "Нет данных за период"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-body-sm text-on-surface-variant">
          Нажмите на мастера или число «Закрыто», чтобы увидеть список заявок. «Взято» — назначения,
          «Закрыто» — подтверждённые анкеты.
        </p>
      </div>
    </AppShell>
  );
}
