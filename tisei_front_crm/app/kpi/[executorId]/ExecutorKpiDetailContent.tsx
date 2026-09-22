"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { MSym } from "../../components/symbols";
import {
  fetchExecutorKpiDetail,
  type ExecutorKpiDetail,
  type ExecutorKpiPeriod,
} from "@/lib/requests-api";
import { useGlobalSearch } from "@/lib/global-search";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { PRIORITY_LABELS, STATUS_LABELS, formatDate } from "@/lib/labels";
import { matchesSearch } from "@/lib/search-utils";
import { ApiError } from "@/lib/api";

const PERIOD_TABS: { key: ExecutorKpiPeriod; label: string }[] = [
  { key: "day", label: "Сегодня" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
];

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;

function formatPeriodRange(from: string, to: string) {
  const f = new Date(from);
  const t = new Date(to);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${f.toLocaleDateString("ru-RU", opts)} — ${t.toLocaleDateString("ru-RU", opts)}`;
}

export function ExecutorKpiDetailContent({ executorId }: { executorId: string }) {
  useRequireAuth();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { debouncedQuery } = useGlobalSearch();

  const initialPeriod = (searchParams.get("period") as ExecutorKpiPeriod) || "day";
  const [period, setPeriod] = useState<ExecutorKpiPeriod>(
    PERIOD_TABS.some((t) => t.key === initialPeriod) ? initialPeriod : "day",
  );
  const [data, setData] = useState<ExecutorKpiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"closed" | "claimed">("closed");

  useEffect(() => {
    if (user?.role === "executor" || user?.role === "master") router.replace("/");
  }, [user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchExecutorKpiDetail(executorId, period);
      setData(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [executorId, period]);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "manager") void load();
  }, [load, user?.role]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("period", period);
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [period]);

  const closed = useMemo(
    () =>
      (data?.closed ?? []).filter((r) =>
        matchesSearch(debouncedQuery, r.number, r.companyOrFullName, r.address, r.workPerformed),
      ),
    [data?.closed, debouncedQuery],
  );

  const claimed = useMemo(
    () =>
      (data?.claimed ?? []).filter((r) =>
        matchesSearch(debouncedQuery, r.number, r.companyOrFullName, r.address),
      ),
    [data?.claimed, debouncedQuery],
  );

  const totalIncome = closed.reduce((s, r) => s + r.incomeAmount, 0);

  return (
    <AppShell active="kpi" mobileActive="alerts" searchPlaceholder="Поиск по номеру, клиенту, адресу...">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          href={`/kpi?period=${period}`}
          className="inline-flex items-center gap-2 text-primary text-body-sm hover:underline"
        >
          <MSym name="arrow_back" className="text-[18px]" />
          Назад к рейтингу
        </Link>

        {data && (
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="font-headline-md text-headline-md">{data.executor.fullName}</h1>
              <p className="text-body-sm text-on-surface-variant mt-1">{data.executor.email}</p>
              <p className="text-body-sm text-on-surface-variant mt-2">
                Период: {formatPeriodRange(data.from, data.to)}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {PERIOD_TABS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={
                    period === p.key
                      ? "px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-label-md"
                      : "px-4 py-2 rounded-lg bg-surface-container-low text-on-surface-variant text-sm"
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-error text-body-sm">{error}</p>}

        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Взято" value={data.claimed.length} />
            <StatCard label="Закрыто" value={data.closed.length} />
            <StatCard label="Приход" value={fmtMoney(totalIncome)} />
            <StatCard
              label="Прибыль"
              value={fmtMoney(closed.reduce((s, r) => s + r.profit, 0))}
            />
          </div>
        )}

        <div className="flex gap-2 border-b border-outline-variant">
          <button
            type="button"
            onClick={() => setTab("closed")}
            className={
              tab === "closed"
                ? "px-4 py-2 border-b-2 border-primary text-primary font-label-md text-sm -mb-px"
                : "px-4 py-2 text-on-surface-variant text-sm"
            }
          >
            Закрытые ({data?.closed.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setTab("claimed")}
            className={
              tab === "claimed"
                ? "px-4 py-2 border-b-2 border-primary text-primary font-label-md text-sm -mb-px"
                : "px-4 py-2 text-on-surface-variant text-sm"
            }
          >
            Взятые ({data?.claimed.length ?? 0})
          </button>
        </div>

        {loading ? (
          <p className="text-on-surface-variant text-body-sm">Загрузка...</p>
        ) : tab === "closed" ? (
          <RequestList
            emptyText={debouncedQuery ? "Ничего не найдено" : "Нет закрытых заявок за период"}
            items={closed}
            mode="closed"
          />
        ) : (
          <RequestList
            emptyText={debouncedQuery ? "Ничего не найдено" : "Нет взятых заявок за период"}
            items={claimed}
            mode="claimed"
          />
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
      <p className="text-[10px] uppercase text-outline font-label-md mb-1">{label}</p>
      <p className="font-headline-sm text-headline-sm">{value}</p>
    </div>
  );
}

function RequestList({
  items,
  mode,
  emptyText,
}: {
  items: ExecutorKpiDetail["closed"] | ExecutorKpiDetail["claimed"];
  mode: "closed" | "claimed";
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-center py-12 text-on-surface-variant text-body-sm border border-dashed border-outline-variant rounded-xl">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={item.requestId}
          href={`/requests/${item.requestId}`}
          className="block bg-surface-container-lowest border border-outline-variant rounded-xl p-4 hover:border-primary/50 transition-colors"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono-data font-bold text-primary">{item.number}</p>
              <p className="font-medium mt-1">{item.companyOrFullName}</p>
              {item.address && (
                <p className="text-body-sm text-on-surface-variant mt-0.5 line-clamp-2">
                  {item.address}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                {PRIORITY_LABELS[item.priority as keyof typeof PRIORITY_LABELS] ?? item.priority}
              </span>
              <p className="text-body-sm text-on-surface-variant mt-2">
                {STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] ?? item.status}
              </p>
            </div>
          </div>

          {mode === "closed" && "workPerformed" in item && (
            <div className="mt-3 pt-3 border-t border-outline-variant grid sm:grid-cols-2 gap-3 text-body-sm">
              <div>
                <p className="text-on-surface-variant text-[11px] uppercase mb-0.5">Работы</p>
                <p className="line-clamp-2">{item.workPerformed || "—"}</p>
              </div>
              <div className="flex flex-wrap gap-4 sm:justify-end">
                <div>
                  <p className="text-on-surface-variant text-[11px] uppercase">Приход</p>
                  <p className="font-mono-data font-bold">{fmtMoney(item.incomeAmount)}</p>
                </div>
                <div>
                  <p className="text-on-surface-variant text-[11px] uppercase">Прибыль</p>
                  <p className="font-mono-data font-bold text-primary">{fmtMoney(item.profit)}</p>
                </div>
                <div>
                  <p className="text-on-surface-variant text-[11px] uppercase">Закрыта</p>
                  <p>{item.confirmedAt ? formatDate(item.confirmedAt) : "—"}</p>
                </div>
              </div>
            </div>
          )}

          {mode === "claimed" && "assignedAt" in item && (
            <p className="mt-2 text-body-sm text-on-surface-variant">
              Взята в работу: {formatDate(item.assignedAt)}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
