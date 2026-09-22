"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MSym } from "../components/symbols";
import { YandexRequestsMap } from "./YandexRequestsMap";
import { assignExecutors, fetchMapOverview } from "@/lib/requests-api";
import { fetchExecutors } from "@/lib/users-api";
import { useGlobalSearch } from "@/lib/global-search";
import { matchesSearch } from "@/lib/search-utils";
import { usePolling } from "@/lib/usePolling";
import { getYandexMapsApiKey } from "@/lib/yandex-maps";
import { masterMapColor, UNASSIGNED_MAP_COLOR } from "@/lib/map-master-colors";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { MapOverview, MapRequestPoint, RequestPriority, RequestStatus } from "@/lib/types";
import { ApiError } from "@/lib/api";

const STATUS_OPTIONS: Array<{ value: "" | RequestStatus; label: string }> = [
  { value: "", label: "Все активные" },
  { value: "new", label: STATUS_LABELS.new },
  { value: "in_progress", label: STATUS_LABELS.in_progress },
  { value: "awaiting_parts", label: STATUS_LABELS.awaiting_parts },
  { value: "frozen", label: STATUS_LABELS.frozen },
  { value: "in_service", label: STATUS_LABELS.in_service },
  { value: "awaiting_approval", label: STATUS_LABELS.awaiting_approval },
  { value: "repeat", label: STATUS_LABELS.repeat },
];

const PRIORITY_OPTIONS: Array<{ value: "" | RequestPriority; label: string }> = [
  { value: "", label: "Любой приоритет" },
  { value: "P1", label: PRIORITY_LABELS.P1 },
  { value: "P2", label: PRIORITY_LABELS.P2 },
  { value: "P3", label: PRIORITY_LABELS.P3 },
  { value: "P4", label: PRIORITY_LABELS.P4 },
];

type MasterGroup = {
  id: string;
  name: string;
  color: string;
  points: MapRequestPoint[];
};

function toggleInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function ManagerMapView() {
  const { debouncedQuery } = useGlobalSearch();
  const [overview, setOverview] = useState<MapOverview | null>(null);
  const [executors, setExecutors] = useState<Array<{ id: string; fullName: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [assignExecutorId, setAssignExecutorId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<"" | RequestStatus>("");
  const [priorityFilter, setPriorityFilter] = useState<"" | RequestPriority>("");
  const [executorFilter, setExecutorFilter] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [colorByExecutor, setColorByExecutor] = useState(true);
  const [groupByMaster, setGroupByMaster] = useState(true);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params: Record<string, string | boolean> = { active: true };
        if (statusFilter) params.status = statusFilter;
        if (priorityFilter) params.priority = priorityFilter;
        if (unassignedOnly) {
          params.unassigned = true;
        } else if (executorFilter) {
          params.executorId = executorFilter;
        }
        const data = await fetchMapOverview(params);
        setOverview(data);
        if (!silent) setError("");
      } catch (e) {
        if (!silent) setError(e instanceof ApiError ? e.message : "Ошибка загрузки карты");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [statusFilter, priorityFilter, executorFilter, unassignedOnly],
  );

  useEffect(() => {
    void fetchExecutors()
      .then(setExecutors)
      .catch(() => setExecutors([]));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(() => void load(true), 15000, true);

  const points = overview?.points ?? [];
  const displayPoints = useMemo(
    () =>
      debouncedQuery
        ? points.filter((p) =>
            matchesSearch(
              debouncedQuery,
              p.number,
              p.companyOrFullName,
              p.address,
              p.executors.map((e) => e.fullName).join(" "),
            ),
          )
        : points,
    [points, debouncedQuery],
  );

  /** Индекс цвета: сначала мастера с точками на карте, затем остальные из справочника. */
  const executorIndex = useMemo(() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const p of displayPoints) {
      const id = p.executors[0]?.id;
      if (id && !map.has(id)) map.set(id, i++);
    }
    for (const e of executors) {
      if (!map.has(e.id)) map.set(e.id, i++);
    }
    return map;
  }, [displayPoints, executors]);

  const masterGroups = useMemo((): MasterGroup[] => {
    const groups = new Map<string, MasterGroup>();
    for (const p of displayPoints) {
      const master = p.executors[0];
      const id = master?.id ?? "__unassigned";
      const name = master?.fullName ?? "Без мастера";
      const color = masterMapColor(master?.id, executorIndex);
      const existing = groups.get(id);
      if (existing) existing.points.push(p);
      else groups.set(id, { id, name, color, points: [p] });
    }
    return [...groups.values()].sort((a, b) => {
      if (a.id === "__unassigned") return 1;
      if (b.id === "__unassigned") return -1;
      return b.points.length - a.points.length || a.name.localeCompare(b.name, "ru");
    });
  }, [displayPoints, executorIndex]);

  const selectedPoints = useMemo(
    () => displayPoints.filter((p) => selectedIds.has(p.requestId)),
    [displayPoints, selectedIds],
  );

  const focusedPoint: MapRequestPoint | undefined = displayPoints.find((p) => p.requestId === focusedId);

  const togglePoint = (requestId: string) => {
    setSelectedIds((prev) => toggleInSet(prev, requestId));
    setFocusedId(requestId);
  };

  const selectGroup = (group: MasterGroup) => {
    setSelectedIds(new Set(group.points.map((p) => p.requestId)));
    if (group.points[0]) setFocusedId(group.points[0].requestId);
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(displayPoints.map((p) => p.requestId)));
    if (displayPoints[0]) setFocusedId(displayPoints[0].requestId);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setFocusedId(null);
  };

  const assignableSelected = selectedPoints.filter((p) => !["closed", "cancelled"].includes(p.status));

  const onBulkAssign = async () => {
    if (!assignExecutorId || assignableSelected.length === 0) return;
    setAssigning(true);
    setError("");
    try {
      await Promise.all(
        assignableSelected.map((p) => assignExecutors(p.requestId, [assignExecutorId])),
      );
      clearSelection();
      await load(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось назначить");
    } finally {
      setAssigning(false);
    }
  };

  const mapKeyMissing = !getYandexMapsApiKey();
  const byStatus = overview?.byStatus ?? {};
  const selectedIdsArray = useMemo(() => [...selectedIds], [selectedIds]);

  const renderPointCard = (p: MapRequestPoint, color: string) => {
    const executorName = p.executors.map((e) => e.fullName).join(", ") || "Не назначен";
    const isSelected = selectedIds.has(p.requestId);
    const isFocused = focusedId === p.requestId;
    return (
      <div
        key={p.requestId}
        className={
          isFocused
            ? "flex gap-2 bg-primary-container/15 border-2 border-primary rounded-xl p-3 transition-colors"
            : isSelected
              ? "flex gap-2 bg-secondary-container/10 border-2 border-secondary rounded-xl p-3 transition-colors"
              : "flex gap-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-3 hover:border-primary/50 transition-colors"
        }
      >
        <span
          className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white shadow-sm"
          style={{ backgroundColor: color }}
          title={executorName}
        />
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => togglePoint(p.requestId)}
          className="mt-1 shrink-0 rounded"
          aria-label={`Выбрать ${p.number}`}
        />
        <button
          type="button"
          onClick={() => togglePoint(p.requestId)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex justify-between gap-2 items-start">
            <p className="font-bold text-body-md truncate">{p.companyOrFullName}</p>
            <span className="text-[10px] uppercase font-bold text-primary shrink-0">
              {STATUS_LABELS[p.status as RequestStatus] ?? p.status}
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">{p.address || "—"}</p>
          {!groupByMaster && (
            <p className="text-[11px] text-outline mt-1.5 flex items-center gap-1">
              <MSym name="engineering" className="text-[14px]" />
              {executorName}
            </p>
          )}
          <p className="text-[11px] text-outline font-mono mt-1">{p.number}</p>
          {p.isPartner && (
            <span className="inline-block mt-1 text-[10px] font-bold uppercase text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
              Партнёр
            </span>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
      <aside className="w-full md:w-[360px] lg:w-[400px] shrink-0 bg-surface border-r border-outline-variant flex flex-col z-20 max-h-[48vh] md:max-h-none md:h-[calc(100vh-4rem)]">
        <div className="p-4 border-b border-outline-variant bg-surface-container-low space-y-3">
          <div className="flex justify-between items-start gap-2">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-primary">Карта заявок</h2>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Всего на карте: <strong>{displayPoints.length}</strong>
                {masterGroups.length > 0 && (
                  <>
                    {" "}
                    · мастеров:{" "}
                    <strong>{masterGroups.filter((g) => g.id !== "__unassigned").length}</strong>
                  </>
                )}
                {selectedIds.size > 0 && (
                  <>
                    {" "}
                    · выбрано: <strong>{selectedIds.size}</strong>
                  </>
                )}
                {overview && overview.totalWithoutCoords > 0 && (
                  <> · без координат: {overview.totalWithoutCoords}</>
                )}
              </p>
            </div>
            <span className="text-label-md font-bold text-primary bg-primary-container/20 px-3 py-1 rounded-full shrink-0">
              {displayPoints.length}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAllVisible}
              disabled={displayPoints.length === 0}
              className="flex-1 text-body-sm px-2 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low hover:bg-surface-container disabled:opacity-40"
            >
              Выбрать все
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedIds.size === 0}
              className="flex-1 text-body-sm px-2 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low hover:bg-surface-container disabled:opacity-40"
            >
              Снять выбор
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {Object.entries(byStatus).map(([status, count]) => (
              <span
                key={status}
                className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant"
              >
                {STATUS_LABELS[status as RequestStatus] ?? status}: {count}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              className="col-span-2 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | RequestStatus)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as "" | RequestPriority)}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm"
              value={unassignedOnly ? "__unassigned" : executorFilter}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__unassigned") {
                  setUnassignedOnly(true);
                  setExecutorFilter("");
                } else {
                  setUnassignedOnly(false);
                  setExecutorFilter(v);
                }
              }}
            >
              <option value="">Все мастера</option>
              <option value="__unassigned">Без мастера</option>
              {executors.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-body-sm text-on-surface-variant cursor-pointer">
              <input
                type="checkbox"
                checked={colorByExecutor}
                onChange={(e) => setColorByExecutor(e.target.checked)}
                className="rounded"
              />
              Цвет точек по мастеру
            </label>
            <label className="flex items-center gap-2 text-body-sm text-on-surface-variant cursor-pointer">
              <input
                type="checkbox"
                checked={groupByMaster}
                onChange={(e) => setGroupByMaster(e.target.checked)}
                className="rounded"
              />
              Группировать список по мастерам
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {loading && <p className="text-on-surface-variant text-body-sm px-1">Загрузка...</p>}
          {error && <p className="text-error text-body-sm px-1">{error}</p>}
          {mapKeyMissing && (
            <p className="text-error text-body-sm px-1">Задайте NEXT_PUBLIC_YANDEX_MAPS_API_KEY в .env.local</p>
          )}
          {displayPoints.length === 0 && !loading && (
            <p className="text-body-sm text-on-surface-variant px-1">Нет заявок по фильтрам</p>
          )}

          {groupByMaster
            ? masterGroups.map((group) => (
                <section key={group.id} className="space-y-2">
                  <div className="sticky top-0 z-[1] flex items-center gap-2 bg-surface/95 backdrop-blur-sm py-1.5 px-1 border-b border-outline-variant/60">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white shadow"
                      style={{ backgroundColor: group.color }}
                    />
                    <button
                      type="button"
                      onClick={() => selectGroup(group)}
                      className="flex-1 min-w-0 text-left font-label-md text-on-surface truncate hover:text-primary"
                      title="Выбрать все точки мастера"
                    >
                      {group.name}
                    </button>
                    <span className="text-[11px] font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full shrink-0">
                      {group.points.length}
                    </span>
                  </div>
                  {group.points.map((p) => renderPointCard(p, group.color))}
                </section>
              ))
            : displayPoints.map((p) =>
                renderPointCard(p, masterMapColor(p.executors[0]?.id, executorIndex)),
              )}
        </div>

        {(selectedIds.size > 0 || focusedPoint) && (
          <div className="p-4 border-t border-outline-variant bg-surface-container-lowest space-y-3">
            {selectedIds.size > 0 && (
              <div className="rounded-xl bg-primary-container/10 border border-primary/20 p-3 space-y-3">
                <p className="font-label-md text-primary">
                  Выбрано: {selectedIds.size}{" "}
                  {selectedIds.size === 1 ? "заявка" : selectedIds.size < 5 ? "заявки" : "заявок"}
                </p>
                {selectedIds.size > 1 && (
                  <ul className="text-body-sm text-on-surface-variant max-h-24 overflow-y-auto space-y-0.5">
                    {selectedPoints.map((p) => (
                      <li key={p.requestId} className="truncate">
                        {p.number} · {p.companyOrFullName}
                      </li>
                    ))}
                  </ul>
                )}
                {assignableSelected.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <select
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-body-sm"
                      value={assignExecutorId}
                      onChange={(e) => setAssignExecutorId(e.target.value)}
                      disabled={assigning}
                    >
                      <option value="">Выберите мастера</option>
                      {executors.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.fullName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!assignExecutorId || assigning}
                      onClick={() => void onBulkAssign()}
                      className="w-full bg-primary text-on-primary py-2.5 rounded-xl font-label-md disabled:opacity-50"
                    >
                      {assigning
                        ? "Назначение..."
                        : `Назначить мастера (${assignableSelected.length})`}
                    </button>
                  </div>
                ) : (
                  <p className="text-body-sm text-on-surface-variant">
                    Среди выбранных нет заявок, которые можно назначить
                  </p>
                )}
              </div>
            )}

            {focusedPoint && (
              <div>
                <p className="font-bold text-body-md">{focusedPoint.companyOrFullName}</p>
                <p className="text-body-sm text-on-surface-variant mt-1">{focusedPoint.address || "—"}</p>
                {focusedPoint.equipmentName && (
                  <p className="text-body-sm mt-1">{focusedPoint.equipmentName}</p>
                )}
                <p className="text-[11px] text-outline mt-2 font-mono">{focusedPoint.number}</p>
                <p className="text-body-sm mt-2 flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: masterMapColor(focusedPoint.executors[0]?.id, executorIndex),
                    }}
                  />
                  Мастер:{" "}
                  <span className="font-medium">
                    {focusedPoint.executors.map((e) => e.fullName).join(", ") || "не назначен"}
                  </span>
                </p>
                <Link
                  href={`/requests/${focusedPoint.requestId}`}
                  className="block text-center text-primary text-body-sm hover:underline mt-3"
                >
                  Открыть заявку →
                </Link>
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="flex-1 p-3 md:p-4 min-h-[50vh] md:min-h-0 md:h-[calc(100vh-4rem)] relative">
        {selectedIds.size > 0 && (
          <div className="absolute top-5 left-5 z-10 bg-surface-container-lowest/95 border border-outline-variant rounded-xl px-3 py-2 text-body-sm shadow-md">
            Выбрано на карте: <strong>{selectedIds.size}</strong> · клик по точке переключает выбор
          </div>
        )}

        {colorByExecutor && masterGroups.length > 0 && (
          <div className="absolute top-5 right-5 z-10 max-w-[220px] bg-surface-container-lowest/95 border border-outline-variant rounded-xl px-3 py-2.5 shadow-md">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-2">
              Мастера на карте
            </p>
            <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto custom-scrollbar">
              {masterGroups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => selectGroup(g)}
                    className="w-full flex items-center gap-2 text-left text-body-sm hover:bg-surface-container-low rounded-lg px-1 py-0.5"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: g.color || UNASSIGNED_MAP_COLOR }}
                    />
                    <span className="truncate flex-1">{g.name}</span>
                    <span className="text-[11px] text-on-surface-variant font-mono shrink-0">
                      {g.points.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <YandexRequestsMap
          points={displayPoints}
          depot={overview?.depot}
          selectedIds={selectedIdsArray}
          focusedId={focusedId}
          onTogglePoint={togglePoint}
          colorByExecutor={colorByExecutor}
          executorIndex={executorIndex}
        />
      </div>
    </div>
  );
}
