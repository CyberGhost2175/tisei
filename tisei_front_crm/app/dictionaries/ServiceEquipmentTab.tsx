"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ConfirmModal } from "../components/Modal";
import { fetchDictionary } from "@/lib/dictionaries-api";
import { fetchPartners } from "@/lib/partners-api";
import {
  createServiceEquipment,
  deleteServiceEquipment,
  fetchServiceEquipment,
  updateServiceEquipment,
  type ServiceEquipmentItem,
} from "@/lib/service-equipment-api";
import { ServiceEquipmentPhotos } from "./ServiceEquipmentPhotos";
import { formatDate } from "@/lib/labels";
import { matchesSearch } from "@/lib/search-utils";
import { ApiError } from "@/lib/api";
import type { DictionaryItem } from "@/lib/types";

const INPUT =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-body-sm";

export function ServiceEquipmentTab({
  isAdmin,
  canManage = isAdmin,
  searchQuery = "",
}: {
  isAdmin: boolean;
  canManage?: boolean;
  searchQuery?: string;
}) {
  const [items, setItems] = useState<ServiceEquipmentItem[]>([]);
  const [categories, setCategories] = useState<DictionaryItem[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [returnItem, setReturnItem] = useState<ServiceEquipmentItem | null>(null);
  const [returning, setReturning] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    companyOrFullName: "",
    partnerEstablishmentId: "",
    equipmentCategoryId: "",
    equipmentCategoryText: "",
    equipmentName: "",
    problemDescription: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, cats, partnerList] = await Promise.all([
        fetchServiceEquipment("in_service"),
        fetchDictionary("equipment-categories", isAdmin),
        fetchPartners(isAdmin),
      ]);
      setItems(list);
      setCategories(cats.filter((c) => c.isActive));
      setPartners(partnerList.map((p) => ({ id: p.id, name: p.name })));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = items.filter((item) =>
    matchesSearch(
      searchQuery,
      item.companyOrFullName,
      item.equipmentName,
      item.equipmentCategory?.name,
      item.equipmentCategoryText,
      item.problemDescription,
      item.request?.number,
    ),
  );

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyOrFullName.trim()) return;
    if (!form.equipmentCategoryId && !form.equipmentCategoryText.trim()) {
      setError("Укажите категорию оборудования");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createServiceEquipment({
        companyOrFullName: form.companyOrFullName.trim(),
        partnerEstablishmentId: form.partnerEstablishmentId || null,
        equipmentCategoryId: form.equipmentCategoryId || undefined,
        equipmentCategoryText: form.equipmentCategoryText.trim() || undefined,
        equipmentName: form.equipmentName.trim() || undefined,
        problemDescription: form.problemDescription.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setShowForm(false);
      setForm({
        companyOrFullName: "",
        partnerEstablishmentId: "",
        equipmentCategoryId: "",
        equipmentCategoryText: "",
        equipmentName: "",
        problemDescription: "",
        notes: "",
      });
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось добавить");
    } finally {
      setSaving(false);
    }
  };

  const onReturn = async () => {
    if (!returnItem) return;
    setReturning(true);
    setError("");
    try {
      await updateServiceEquipment(returnItem.id, { status: "returned" });
      setReturnItem(null);
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка обновления");
    } finally {
      setReturning(false);
    }
  };

  const onDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteServiceEquipment(deleteId);
      setDeleteId(null);
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось удалить");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-body-sm text-on-surface-variant">
        Оборудование, которое сейчас находится на ремонте в сервисе Береке ТехСервис. При переводе заявки в статус
        «В сервисе» карточка создаётся автоматически.
      </p>

      {error && <p className="text-error text-body-sm">{error}</p>}

      {canManage && (
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm"
        >
          {showForm ? "Скрыть форму" : "Добавить оборудование"}
        </button>
      )}

      {showForm && canManage && (
        <form onSubmit={(e) => void onAdd(e)} className="grid md:grid-cols-2 gap-3 p-4 border border-outline-variant rounded-xl bg-surface-container-low">
          <input className={INPUT} placeholder="Заведение / клиент *" value={form.companyOrFullName} onChange={(e) => setForm({ ...form, companyOrFullName: e.target.value })} required />
          <select className={INPUT} value={form.partnerEstablishmentId} onChange={(e) => setForm({ ...form, partnerEstablishmentId: e.target.value })}>
            <option value="">Партнёр (необязательно)</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select className={INPUT} value={form.equipmentCategoryId} onChange={(e) => setForm({ ...form, equipmentCategoryId: e.target.value })}>
            <option value="">Категория из справочника</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input className={INPUT} placeholder="Или категория текстом *" value={form.equipmentCategoryText} onChange={(e) => setForm({ ...form, equipmentCategoryText: e.target.value })} />
          <input className={INPUT} placeholder="Модель / название" value={form.equipmentName} onChange={(e) => setForm({ ...form, equipmentName: e.target.value })} />
          <textarea className={`${INPUT} md:col-span-2`} placeholder="Проблема" rows={2} value={form.problemDescription} onChange={(e) => setForm({ ...form, problemDescription: e.target.value })} />
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-on-primary rounded-lg disabled:opacity-50">
              Сохранить
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-on-surface-variant text-body-sm">Загрузка...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-on-surface-variant border border-dashed border-outline-variant rounded-xl">
          {searchQuery ? "Ничего не найдено" : "Нет оборудования в сервисе"}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-medium">{item.companyOrFullName}</p>
                  {item.partnerEstablishment && (
                    <p className="text-body-sm text-primary">{item.partnerEstablishment.name}</p>
                  )}
                  <p className="text-body-sm text-on-surface-variant mt-1">
                    {item.equipmentCategory?.name || item.equipmentCategoryText || "—"}
                    {item.equipmentName ? ` · ${item.equipmentName}` : ""}
                  </p>
                  {item.problemDescription && (
                    <p className="text-body-sm mt-2">{item.problemDescription}</p>
                  )}
                  {item.request && (
                    <Link href={`/requests/${item.request.id}`} className="text-primary text-body-sm hover:underline mt-2 inline-block">
                      Заявка {item.request.number}
                    </Link>
                  )}
                  <p className="text-[11px] text-outline mt-2">Принято: {formatDate(item.receivedAt)}</p>
                  <ServiceEquipmentPhotos
                    serviceEquipmentId={item.id}
                    attachments={item.attachments ?? []}
                    canManage={canManage}
                    onChanged={() => void load()}
                  />
                </div>
                {(canManage || isAdmin) && (
                  <div className="flex flex-col gap-2 shrink-0">
                    {canManage && (
                      <button type="button" onClick={() => setReturnItem(item)} className="text-primary text-body-sm hover:underline">
                        Вернули клиенту
                      </button>
                    )}
                    {isAdmin && (
                      <button type="button" onClick={() => setDeleteId(item.id)} className="text-error text-body-sm hover:underline">
                        Удалить
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!returnItem}
        onClose={() => setReturnItem(null)}
        onConfirm={() => void onReturn()}
        title="Убрать оборудование из сервиса?"
        description={
          returnItem
            ? `Оборудование «${returnItem.equipmentName || returnItem.equipmentCategory?.name || returnItem.equipmentCategoryText || "без названия"}» (${returnItem.companyOrFullName}) будет убрано из раздела «В сервисе».`
            : undefined
        }
        confirmLabel="Да, вернули клиенту"
        loading={returning}
      />

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => void onDelete()}
        title="Удалить запись?"
        description="Карточка оборудования будет удалена из раздела «В сервисе»."
        confirmLabel="Удалить"
        loading={deleting}
        destructive
      />
    </div>
  );
}
