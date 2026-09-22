"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { ConfirmModal } from "../components/Modal";
import { MSym } from "../components/symbols";
import {
  bulkSetPartQuantity,
  createPart,
  deletePart,
  fetchParts,
  fetchPartsSpending,
  PART_SECTION_LABELS,
  updatePart,
  type Part,
  type PartSection,
  type PartsSpendingPeriod,
} from "@/lib/parts-api";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { matchesSearch } from "@/lib/search-utils";
import { ApiError } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";

const PERIODS: Array<{ key: PartsSpendingPeriod; label: string }> = [
  { key: "day", label: "День" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
];

const SECTIONS: PartSection[] = ["SERVICE", "KFC"];

const INPUT =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-body-sm";

const QTY_INPUT =
  "w-20 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm font-mono-data text-center";

export default function WarehousePage() {
  useRequireAuth();
  const { user } = useAuth();
  const [section, setSection] = useState<PartSection>("SERVICE");
  const [parts, setParts] = useState<Part[]>([]);
  const [spending, setSpending] = useState<{ totalSpent: number; usageCount: number } | null>(null);
  const [period, setPeriod] = useState<PartsSpendingPeriod>("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editPart, setEditPart] = useState<Part | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: "", quantity: "0", unitPrice: "" });
  const [search, setSearch] = useState("");
  const [bulkQty, setBulkQty] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [savingQtyId, setSavingQtyId] = useState<string | null>(null);

  const canManage = user?.role === "admin" || user?.role === "manager";
  const isKfc = section === "KFC";
  const priceLabel = isKfc ? "Цена с НДС" : "Цена";
  const sumLabel = isKfc ? "Сумма с НДС" : "Сумма";

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const [list, spend] = await Promise.all([
          fetchParts(false, section),
          canManage ? fetchPartsSpending(period, section) : Promise.resolve(null),
        ]);
        setParts(list);
        setQtyDrafts(Object.fromEntries(list.map((p) => [p.id, String(p.quantity)])));
        if (spend) setSpending({ totalSpent: spend.totalSpent, usageCount: spend.usageCount });
      } catch (e) {
        if (!silent) setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [period, canManage, section],
  );

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(() => void load(true), 10000, true);

  const filtered = parts.filter((p) =>
    matchesSearch(search, p.name, String(p.quantity), String(p.unitPrice)),
  );

  const stockValue = filtered.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
  const stockQuantity = filtered.reduce((sum, p) => sum + p.quantity, 0);
  const positionsCount = filtered.length;

  const openCreate = () => {
    setEditPart(null);
    setForm({ name: "", quantity: "0", unitPrice: "" });
    setShowForm(true);
  };

  const openEdit = (part: Part) => {
    setEditPart(part);
    setForm({
      name: part.name,
      quantity: String(part.quantity),
      unitPrice: String(part.unitPrice),
    });
    setShowForm(true);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const unitPrice = Number(form.unitPrice);
    if (!name || Number.isNaN(unitPrice) || unitPrice < 0) {
      setError(isKfc ? "Заполните наименование и цену с НДС" : "Заполните наименование, количество и цену");
      return;
    }
    let quantity = 0;
    if (!isKfc) {
      quantity = Number(form.quantity);
      if (Number.isNaN(quantity) || quantity < 0) {
        setError("Заполните наименование, количество и цену");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      if (editPart) {
        await updatePart(editPart.id, isKfc ? { name, unitPrice, section } : { name, quantity, unitPrice, section });
      } else {
        await createPart(isKfc ? { name, unitPrice, section } : { name, quantity, unitPrice, section });
      }
      setShowForm(false);
      setEditPart(null);
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePart(deleteTarget.id);
      setDeleteTarget(null);
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось удалить");
    } finally {
      setDeleting(false);
    }
  };

  const onBulkQuantity = async () => {
    if (section !== "SERVICE") return;
    const quantity = Number(bulkQty);
    if (Number.isNaN(quantity) || quantity < 0) {
      setError("Укажите корректное количество для всех позиций");
      return;
    }
    setBulkSaving(true);
    setError("");
    try {
      const result = await bulkSetPartQuantity({ section: "SERVICE", quantity });
      setBulkQty("");
      void load();
      setError("");
      if (result.updated === 0) {
        setError("В разделе нет позиций для обновления");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось задать количество");
    } finally {
      setBulkSaving(false);
    }
  };

  const saveRowQuantity = async (part: Part) => {
    const raw = qtyDrafts[part.id] ?? String(part.quantity);
    const quantity = Number(raw);
    if (Number.isNaN(quantity) || quantity < 0) {
      setError("Количество должно быть числом ≥ 0");
      setQtyDrafts((prev) => ({ ...prev, [part.id]: String(part.quantity) }));
      return;
    }
    if (quantity === part.quantity) return;
    setSavingQtyId(part.id);
    setError("");
    try {
      const updated = await updatePart(part.id, { quantity });
      setParts((prev) => prev.map((p) => (p.id === part.id ? { ...p, quantity: updated.quantity } : p)));
      setQtyDrafts((prev) => ({ ...prev, [part.id]: String(updated.quantity) }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить количество");
      setQtyDrafts((prev) => ({ ...prev, [part.id]: String(part.quantity) }));
    } finally {
      setSavingQtyId(null);
    }
  };

  return (
    <AppShell
      active="warehouse"
      mobileActive="profile"
      searchPlaceholder="Поиск по названию запчасти..."
      mainClassName="p-container-margin pb-24 md:pb-8"
    >
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-headline-md text-headline-md text-primary">Склад</h1>
            <p className="text-body-md text-on-surface-variant mt-1">
              СЕРВИС — учёт остатков · KFC — прайс-лист с НДС, кол-во при списании
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md shrink-0"
            >
              <MSym name="add" className="text-[18px]" />
              Добавить в {PART_SECTION_LABELS[section]}
            </button>
          )}
        </div>

        <div className="mb-4 flex gap-2 p-1 rounded-xl bg-surface-container-low border border-outline-variant w-fit">
          {SECTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSection(s);
                setShowForm(false);
                setEditPart(null);
                setSearch("");
                setBulkQty("");
              }}
              className={
                section === s
                  ? "px-4 py-2 rounded-lg bg-primary text-on-primary text-body-sm font-medium"
                  : "px-4 py-2 rounded-lg text-on-surface-variant text-body-sm hover:text-primary"
              }
            >
              {PART_SECTION_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MSym
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline pointer-events-none"
            />
            <input
              className={`${INPUT} pl-10`}
              placeholder={`Поиск в ${PART_SECTION_LABELS[section]}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {canManage && !isKfc && (
            <div className="flex gap-2 items-stretch shrink-0">
              <input
                className={`${INPUT} w-28`}
                type="number"
                min={0}
                step={1}
                placeholder="Кол-во всем"
                value={bulkQty}
                onChange={(e) => setBulkQty(e.target.value)}
              />
              <button
                type="button"
                disabled={bulkSaving || bulkQty === ""}
                onClick={() => void onBulkQuantity()}
                className="px-3 py-2 rounded-lg border border-outline-variant text-body-sm whitespace-nowrap disabled:opacity-50 hover:border-primary hover:text-primary"
              >
                {bulkSaving ? "..." : `Задать всем в ${PART_SECTION_LABELS[section]}`}
              </button>
            </div>
          )}
        </div>

        {canManage && (
          <div className="mb-6 p-4 rounded-xl border border-outline-variant bg-surface-container-low space-y-3">
            <p className="text-label-md text-outline uppercase">
              {isKfc
                ? `Прайс-лист KFC · расход при списании в заявках`
                : `Расход запчастей · только ${PART_SECTION_LABELS[section]}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={
                    period === p.key
                      ? "px-3 py-1.5 rounded-lg bg-primary text-on-primary text-body-sm font-medium"
                      : "px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant text-body-sm hover:text-primary"
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-body-sm text-on-surface-variant">
                  Потрачено · {PART_SECTION_LABELS[section]}
                </p>
                <p className="font-headline-sm text-headline-sm text-primary">
                  {Math.round(spending?.totalSpent ?? 0).toLocaleString("ru-RU")} ₸
                </p>
              </div>
              <div>
                <p className="text-body-sm text-on-surface-variant">
                  Списаний · {PART_SECTION_LABELS[section]}
                </p>
                <p className="font-headline-sm text-headline-sm">{spending?.usageCount ?? 0}</p>
              </div>
              {!isKfc && (
                <div>
                  <p className="text-body-sm text-on-surface-variant">Остаток раздела</p>
                  <p className="font-headline-sm text-headline-sm">
                    {Math.round(stockValue).toLocaleString("ru-RU")} ₸
                  </p>
                </div>
              )}
              <div>
                <p className="text-body-sm text-on-surface-variant">
                  {isKfc ? "Позиций в прайсе" : "Позиций / шт."}
                </p>
                <p className="font-headline-sm text-headline-sm">
                  {isKfc ? positionsCount : `${positionsCount} / ${stockQuantity}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-error text-body-sm mb-4">{error}</p>}

        {showForm && canManage && (
          <form
            onSubmit={(e) => void onSave(e)}
            className={`mb-6 grid gap-3 p-4 border border-outline-variant rounded-xl bg-surface-container-low ${
              isKfc ? "md:grid-cols-2" : "md:grid-cols-3"
            }`}
          >
            <p className={`${isKfc ? "md:col-span-2" : "md:col-span-3"} text-body-sm text-on-surface-variant`}>
              Раздел:{" "}
              <span className="font-medium text-on-surface">{PART_SECTION_LABELS[section]}</span>
              {isKfc ? " · прайс-лист, цена с НДС · кол-во указывается при списании в заявке" : ""}
            </p>
            <input
              className={`${INPUT} ${isKfc ? "md:col-span-2" : "md:col-span-3"}`}
              placeholder="Наименование запчасти *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            {!isKfc && (
              <input
                className={INPUT}
                type="number"
                min={0}
                step={1}
                placeholder="Количество *"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
            )}
            <input
              className={INPUT}
              type="number"
              min={0}
              step={0.01}
              placeholder={`${priceLabel}, ₸ *`}
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
              required
            />
            <div className={`${isKfc ? "md:col-span-2" : "md:col-span-3"} flex justify-end gap-2`}>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditPart(null);
                }}
                className="px-4 py-2 rounded-lg border border-outline-variant"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg disabled:opacity-50"
              >
                {saving ? "Сохранение..." : editPart ? "Сохранить" : "Добавить"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-on-surface-variant">Загрузка...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-on-surface-variant border border-dashed border-outline-variant rounded-xl">
            {search.trim()
              ? "Ничего не найдено"
              : `Раздел ${PART_SECTION_LABELS[section]} пуст — добавьте первую запчасть`}
          </p>
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left min-w-[480px]">
              <thead>
                <tr className="bg-surface-container-low text-label-md border-b border-outline-variant">
                  <th className="px-4 py-3 font-bold">Наименование</th>
                  {!isKfc && <th className="px-4 py-3 font-bold">Кол-во</th>}
                  <th className="px-4 py-3 font-bold">{priceLabel}</th>
                  {!isKfc && <th className="px-4 py-3 font-bold">{sumLabel}</th>}
                  {canManage && <th className="px-4 py-3 font-bold w-28" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filtered.map((part) => {
                  const draft = qtyDrafts[part.id] ?? String(part.quantity);
                  const qtyNum = Number(draft);
                  const lineSum =
                    !Number.isNaN(qtyNum) && qtyNum >= 0
                      ? qtyNum * part.unitPrice
                      : part.quantity * part.unitPrice;
                  return (
                    <tr key={part.id} className="text-body-sm">
                      <td className="px-4 py-3 font-medium">{part.name}</td>
                      {!isKfc && (
                        <td className="px-4 py-3">
                          {canManage ? (
                            <input
                              className={QTY_INPUT}
                              type="number"
                              min={0}
                              step={1}
                              value={draft}
                              disabled={savingQtyId === part.id}
                              onChange={(e) =>
                                setQtyDrafts((prev) => ({ ...prev, [part.id]: e.target.value }))
                              }
                              onBlur={() => void saveRowQuantity(part)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                }
                              }}
                              aria-label={`Количество ${part.name}`}
                            />
                          ) : (
                            <span className="font-mono-data">{part.quantity}</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono-data">
                        {part.unitPrice.toLocaleString("ru-RU")} ₸
                      </td>
                      {!isKfc && (
                        <td className="px-4 py-3 font-mono-data">
                          {lineSum.toLocaleString("ru-RU")} ₸
                        </td>
                      )}
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(part)}
                              className="text-primary hover:underline text-body-sm"
                            >
                              Изменить
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(part)}
                              className="text-error hover:underline text-body-sm"
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void onDelete()}
        title="Удалить запчасть?"
        description={
          deleteTarget
            ? `Запчасть «${deleteTarget.name}» будет удалена со склада. Это действие нельзя отменить.`
            : undefined
        }
        confirmLabel="Удалить"
        loading={deleting}
        destructive
      />
    </AppShell>
  );
}
