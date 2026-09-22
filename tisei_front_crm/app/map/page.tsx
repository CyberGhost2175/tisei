"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { MSym } from "../components/symbols";
import { ManagerMapView } from "./ManagerMapView";
import { YandexRouteMap } from "./YandexRouteMap";
import { fetchTodayRoute, optimizeRoute } from "@/lib/requests-api";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { useGlobalSearch } from "@/lib/global-search";
import { matchesSearch } from "@/lib/search-utils";
import { usePolling } from "@/lib/usePolling";
import { getYandexMapsApiKey } from "@/lib/yandex-maps";
import type { OptimizedRoute } from "@/lib/types";
import { ApiError } from "@/lib/api";

function ExecutorRouteMap() {
  const { user } = useAuth();
  const { debouncedQuery } = useGlobalSearch();
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const executorId =
          user?.role === "executor" || user?.role === "master" ? user.id : undefined;
        const data = await fetchTodayRoute(executorId);
        if (data.points.length > 1) {
          const optimized = await optimizeRoute(
            data.points.map((p) => p.requestId),
            data.executorId,
          );
          setRoute(optimized);
        } else {
          setRoute(data);
        }
        if (!silent) setError("");
      } catch (e) {
        if (!silent) setError(e instanceof ApiError ? e.message : "Ошибка загрузки маршрута");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user?.id, user?.role],
  );

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(() => void load(true), 10000, !!user);

  const points = route?.points ?? [];
  const displayPoints = debouncedQuery
    ? points.filter((p) => matchesSearch(debouncedQuery, p.number, p.companyOrFullName, p.address))
    : points;

  const rebuild = async () => {
    if (!route || points.length === 0) return;
    try {
      const optimized = await optimizeRoute(
        points.map((p) => p.requestId),
        route.executorId,
      );
      setRoute(optimized);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось построить маршрут");
    }
  };

  const mapKeyMissing = !getYandexMapsApiKey();

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
      <aside className="w-full md:w-[340px] lg:w-[380px] shrink-0 bg-surface border-r border-outline-variant flex flex-col z-20 max-h-[42vh] md:max-h-none md:h-[calc(100vh-4rem)]">
        <div className="p-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-primary">Маршрут</h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Старт: {route?.depot?.address ?? "Жанкент 180/1"} · партнёры впереди
            </p>
          </div>
          <span className="text-label-md font-bold text-primary bg-primary-container/20 px-3 py-1 rounded-full">
            {points.length} {points.length === 1 ? "точка" : points.length < 5 ? "точки" : "точек"}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {loading && <p className="text-on-surface-variant text-body-sm px-1">Загрузка...</p>}
          {error && <p className="text-error text-body-sm px-1">{error}</p>}
          {mapKeyMissing && (
            <p className="text-error text-body-sm px-1">
              Задайте NEXT_PUBLIC_YANDEX_MAPS_API_KEY в .env.local
            </p>
          )}
          {(user?.role === "executor" || user?.role === "master") && points.length === 0 && !loading && (
            <p className="text-body-sm text-on-surface-variant px-1">
              Возьмите заявки в разделе «Заявки» — адреса появятся здесь автоматически.
            </p>
          )}
          <div className="mb-2 px-1 py-2 rounded-lg bg-secondary-container/15 border border-secondary-container/30 flex gap-2 items-center">
            <MSym name="home" className="text-secondary text-[18px]" />
            <div className="text-body-sm">
              <p className="font-bold">0 · База</p>
              <p className="text-on-surface-variant text-[11px] line-clamp-1">
                {route?.depot?.address ?? "Жанкент 180/1, Астана"}
              </p>
            </div>
          </div>
          {displayPoints.length === 0 && debouncedQuery && !loading && (
            <p className="text-body-sm text-on-surface-variant px-1">Ничего не найдено</p>
          )}
          {displayPoints.map((p, idx) => (
            <button
              key={p.requestId}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={
                activeIdx === idx
                  ? "w-full text-left bg-primary-container/15 border-2 border-primary rounded-xl p-3 flex gap-3 transition-colors"
                  : "w-full text-left bg-surface-container-lowest border border-outline-variant rounded-xl p-3 flex gap-3 hover:border-primary/50 transition-colors"
              }
            >
              <div
                className={
                  p.isPartner
                    ? "w-8 h-8 rounded-full bg-sky-400 text-white flex items-center justify-center font-bold text-sm shrink-0"
                    : "w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm shrink-0"
                }
              >
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2 items-start">
                  <p className="font-bold text-body-md truncate">{p.companyOrFullName}</p>
                  <span className="text-[10px] uppercase font-bold text-primary shrink-0">
                    {p.isPartner ? "Партнёр" : p.priority}
                  </span>
                </div>
                <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">
                  {p.address || "—"}
                </p>
                <p className="text-[11px] text-outline mt-1.5 font-mono">{p.number}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-outline-variant bg-surface-container-lowest space-y-2">
          <button
            type="button"
            onClick={() => void rebuild()}
            disabled={points.length < 2}
            className="w-full bg-surface-container-high text-on-surface py-2.5 rounded-xl font-label-md flex items-center justify-center gap-2 hover:bg-surface-container disabled:opacity-40 border border-outline-variant"
          >
            <MSym name="route" className="text-[18px]" />
            Пересчитать маршрут
          </button>
          {route?.routeUrl ? (
            <a
              href={route.routeUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3.5 rounded-xl font-bold text-label-md hover:opacity-90 transition-all shadow-md"
            >
              <MSym name="navigation" className="text-[22px]" />
              В путь · 2ГИС
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="w-full py-3.5 rounded-xl bg-outline-variant/30 text-outline font-label-md"
            >
              В путь · 2ГИС
            </button>
          )}
          {route && points.length > 0 && (
            <p className="text-center text-body-sm text-on-surface-variant">
              ~{route.totalDistanceKm} км · {points.length} заявок
            </p>
          )}
        </div>
      </aside>

      <div className="flex-1 p-3 md:p-4 min-h-[50vh] md:min-h-0 md:h-[calc(100vh-4rem)]">
        <YandexRouteMap
          points={displayPoints}
          depot={route?.depot}
          activeIndex={activeIdx}
          onSelectPoint={setActiveIdx}
        />
      </div>
    </div>
  );
}

export default function MapPage() {
  useRequireAuth();
  const { user } = useAuth();
  const isManager = user?.role === "manager" || user?.role === "admin";

  return (
    <AppShell
      active="map"
      mobileActive="map"
      searchPlaceholder="Поиск по адресу, клиенту, номеру..."
      mainClassName="p-0 pb-24 md:pb-0"
    >
      {isManager ? <ManagerMapView /> : <ExecutorRouteMap />}
    </AppShell>
  );
}
