"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "../components/AppShell";
import { MSym } from "../components/symbols";
import { useRequireAuth } from "@/lib/AuthProvider";
import { ApiError } from "@/lib/api";
import {
  fetchMaintenanceOverview,
  type MaintenanceOverview,
} from "@/lib/maintenance-api";
import { formatDate } from "@/lib/labels";

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MaintenancePage() {
  useRequireAuth();
  const [period, setPeriod] = useState(currentPeriod);
  const [data, setData] = useState<MaintenanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchMaintenanceOverview(period));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell
      active="maintenance"
      mobileActive="tasks"
      searchPlaceholder="Поиск..."
      searchEnabled={false}
      mainClassName="p-container-margin pb-24 md:pb-8"
    >
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-headline-md text-headline-md text-primary">Обслуживание</h1>
            <p className="text-body-md text-on-surface-variant mt-1">
              Ежемесячное плановое ТО · KFC, Golpas, Hardee&apos;s, Costa
            </p>
          </div>
          <label className="text-body-sm text-on-surface-variant">
            Период
            <input
              type="month"
              className="ml-2 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-body-sm"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
        </div>

        <div className="mb-6 p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
          <p className="font-label-md text-primary uppercase flex items-center gap-2">
            <MSym name="info" className="text-[18px]" />
            Сроки закрытия
          </p>
          <ul className="text-body-sm text-on-surface space-y-1 list-disc pl-5">
            {(data?.rules ?? []).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {data && (
            <p className="text-body-sm text-on-surface-variant pt-1">
              Текущий период: <span className="font-medium text-on-surface">{data.periodLabel}</span>
            </p>
          )}
        </div>

        {error && <p className="text-error text-body-sm mb-4">{error}</p>}

        {loading ? (
          <p className="text-on-surface-variant">Загрузка...</p>
        ) : !data || data.partners.length === 0 ? (
          <p className="text-center py-12 text-on-surface-variant border border-dashed border-outline-variant rounded-xl">
            Нет партнёров с включённым обслуживанием
          </p>
        ) : (
          <div className="grid gap-3">
            {data.partners.map((p) => {
              const overdue = new Date(p.closeByDate) < new Date() && p.openCount > 0;
              return (
                <Link
                  key={p.id}
                  href={`/maintenance/${p.id}?period=${period}`}
                  className="block p-4 rounded-xl border border-outline-variant bg-surface-container-lowest hover:border-primary transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-headline-sm text-on-surface">{p.name}</h2>
                      <p className="text-body-sm text-on-surface-variant mt-1">{p.deadlineHint}</p>
                      <p className="text-body-sm text-on-surface-variant">
                        Закрыть до:{" "}
                        <span className={overdue ? "text-error font-medium" : "font-medium text-on-surface"}>
                          {formatDate(p.closeByDate)}
                        </span>
                        {overdue && " · просрочено"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-body-sm text-on-surface-variant">Точки</p>
                      <p className="font-headline-sm">
                        <span className="text-primary">{p.closedCount}</span>
                        <span className="text-outline"> / {p.locationsTotal}</span>
                      </p>
                      {p.actReady ? (
                        <span className="inline-block mt-2 text-[11px] uppercase tracking-wide px-2 py-1 rounded bg-primary/15 text-primary">
                          Акт готов
                        </span>
                      ) : p.openCount > 0 ? (
                        <span className="inline-block mt-2 text-[11px] uppercase tracking-wide px-2 py-1 rounded bg-error-container/40 text-error">
                          Открыто {p.openCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
