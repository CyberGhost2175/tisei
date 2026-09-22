"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MSym } from "../../components/symbols";
import { ConfirmModal } from "../../components/Modal";
import {
  addRequestPartUsage,
  deleteRequestPartUsage,
  fetchParts,
  fetchRequestPartUsages,
  PART_SECTION_LABELS,
  type Part,
  type PartSection,
  type RequestPartUsage,
} from "@/lib/parts-api";
import { formatDate } from "@/lib/labels";
import { matchesSearch } from "@/lib/search-utils";
import { ApiError } from "@/lib/api";
import type { RequestStatus } from "@/lib/types";

const USAGE_STATUSES: RequestStatus[] = [
  "in_progress",
  "awaiting_parts",
  "in_service",
  "awaiting_approval",
  "repeat",
];

const SECTIONS: PartSection[] = ["SERVICE", "KFC"];

function tracksStock(p: Part) {
  return p.section !== "KFC";
}

function partMeta(p: Part) {
  const price = `${p.unitPrice.toLocaleString("ru-RU")} ₸/шт`;
  if (tracksStock(p)) return `остаток ${p.quantity} · ${price}`;
  return `цена с НДС ${price}`;
}

export function RequestPartUsage({
  requestId,
  requestStatus,
  canWrite,
  onChanged,
}: {
  requestId: string;
  requestStatus: RequestStatus;
  canWrite: boolean;
  onChanged?: () => void;
}) {
  const [usages, setUsages] = useState<RequestPartUsage[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [partId, setPartId] = useState("");
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RequestPartUsage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const canAdd = canWrite && USAGE_STATUSES.includes(requestStatus);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usageList, partList] = await Promise.all([
        fetchRequestPartUsages(requestId),
        canAdd ? fetchParts(true) : Promise.resolve([]),
      ]);
      setUsages(usageList);
      setParts(partList);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [requestId, canAdd]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pickerOpen]);

  const selectedPart = parts.find((p) => p.id === partId);
  const totalSpent = usages.reduce((sum, u) => sum + u.lineTotal, 0);
  const writeOffQty = Number(quantity);
  const previewTotal =
    selectedPart && !Number.isNaN(writeOffQty) && writeOffQty >= 1
      ? Math.round(selectedPart.unitPrice * writeOffQty)
      : null;

  const filteredParts = parts.filter((p) =>
    matchesSearch(
      search,
      p.name,
      PART_SECTION_LABELS[p.section],
      tracksStock(p) ? String(p.quantity) : undefined,
      String(p.unitPrice),
    ),
  );

  const selectPart = (p: Part) => {
    setPartId(p.id);
    setSearch(p.name);
    setPickerOpen(false);
  };

  const clearSelection = () => {
    setPartId("");
    setSearch("");
    setPickerOpen(true);
  };

  const onAdd = async () => {
    if (!partId || !quantity) return;
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty < 1) return;
    setSaving(true);
    setError("");
    try {
      await addRequestPartUsage(requestId, { partId, quantity: qty });
      setPartId("");
      setSearch("");
      setQuantity("1");
      void load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось списать");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRequestPartUsage(requestId, deleteTarget.id);
      setDeleteTarget(null);
      void load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось отменить");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-label-md text-outline uppercase">Запчасти со склада</h3>
        {usages.length > 0 && (
          <span className="text-body-sm text-primary font-medium">
            Итого: {Math.round(totalSpent).toLocaleString("ru-RU")} ₸
          </span>
        )}
      </div>

      {error && <p className="text-error text-body-sm mb-3">{error}</p>}

      {canAdd && (
        <div className="mb-4 p-3 rounded-xl bg-surface-container-low border border-outline-variant space-y-2">
          <div className="relative min-w-0" ref={pickerRef}>
            <MSym
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline pointer-events-none"
            />
            <input
              type="search"
              className="w-full min-w-0 bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-9 py-2 text-body-sm"
              placeholder="Поиск запчасти по названию..."
              value={search}
              disabled={saving || parts.length === 0}
              onChange={(e) => {
                setSearch(e.target.value);
                setPartId("");
                setPickerOpen(true);
              }}
              onFocus={() => setPickerOpen(true)}
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-outline hover:text-on-surface"
                onClick={clearSelection}
                tabIndex={-1}
                aria-label="Очистить"
              >
                <MSym name="close" className="text-[16px]" />
              </button>
            )}
            {pickerOpen && parts.length > 0 && (
              <ul className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest shadow-md">
                {filteredParts.length === 0 ? (
                  <li className="px-3 py-2.5 text-body-sm text-on-surface-variant">Ничего не найдено</li>
                ) : (
                  SECTIONS.map((sec) => {
                    const group = filteredParts.filter((p) => p.section === sec);
                    if (group.length === 0) return null;
                    return (
                      <li key={sec}>
                        <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-outline bg-surface-container-low sticky top-0">
                          {PART_SECTION_LABELS[sec]}
                        </div>
                        <ul>
                          {group.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                className={`w-full text-left px-3 py-2 text-body-sm hover:bg-primary/10 ${
                                  partId === p.id ? "bg-primary/10 text-primary" : ""
                                }`}
                                onClick={() => selectPart(p)}
                              >
                                <span className="block truncate font-medium">{p.name}</span>
                                <span className="block text-[11px] text-on-surface-variant mt-0.5">
                                  {partMeta(p)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedPart && (
              <p
                className="flex-1 min-w-0 text-body-sm text-on-surface-variant truncate"
                title={`${selectedPart.name} · ${partMeta(selectedPart)}`}
              >
                Выбрано: <span className="text-on-surface font-medium">{selectedPart.name}</span>
                {tracksStock(selectedPart)
                  ? ` · остаток ${selectedPart.quantity}`
                  : ` · ${selectedPart.unitPrice.toLocaleString("ru-RU")} ₸/шт с НДС`}
                {previewTotal != null && (
                  <>
                    {" · "}
                    <span className="text-primary font-medium">
                      = {previewTotal.toLocaleString("ru-RU")} ₸
                    </span>
                  </>
                )}
              </p>
            )}
            <input
              type="number"
              min={1}
              max={
                selectedPart && tracksStock(selectedPart) ? selectedPart.quantity : undefined
              }
              className="w-24 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-body-sm shrink-0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={saving || !partId}
              placeholder="Кол-во"
            />
            <button
              type="button"
              disabled={!partId || saving || parts.length === 0}
              onClick={() => void onAdd()}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md disabled:opacity-50 shrink-0"
            >
              {saving ? "..." : "Списать"}
            </button>
          </div>
        </div>
      )}

      {!canAdd && canWrite && (
        <p className="text-body-sm text-on-surface-variant mb-4">
          Списание запчастей доступно, когда заявка в работе, ожидает запчасти или в сервисе.
        </p>
      )}

      {loading ? (
        <p className="text-on-surface-variant text-body-sm">Загрузка...</p>
      ) : usages.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">Запчасти не списывались</p>
      ) : (
        <ul className="divide-y divide-outline-variant">
          {usages.map((u) => (
            <li key={u.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{u.partNameSnapshot}</p>
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  {u.quantity} шт. × {u.unitPriceSnapshot.toLocaleString("ru-RU")} ₸ ={" "}
                  <span className="font-mono-data">{u.lineTotal.toLocaleString("ru-RU")} ₸</span>
                </p>
                <p className="text-[11px] text-outline mt-1">
                  {formatDate(u.createdAt)}
                  {u.addedBy ? ` · ${u.addedBy.fullName}` : ""}
                </p>
              </div>
              {canAdd && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(u)}
                  className="text-error hover:bg-error-container/20 p-2 rounded-lg shrink-0"
                  title="Отменить списание"
                >
                  <MSym name="undo" className="text-[18px]" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void onDelete()}
        title="Отменить списание?"
        description={
          deleteTarget
            ? `Списание «${deleteTarget.partNameSnapshot}» (${deleteTarget.quantity} шт.) будет отменено.`
            : undefined
        }
        confirmLabel="Отменить списание"
        loading={deleting}
        destructive
      />
    </section>
  );
}
