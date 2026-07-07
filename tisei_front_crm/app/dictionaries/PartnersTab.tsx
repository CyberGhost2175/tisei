"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmModal, Modal, ModalActions } from "../components/Modal";
import {
  createPartner,
  deletePartner,
  fetchPartners,
  updatePartner,
  type PartnerEstablishment,
} from "@/lib/partners-api";
import { ApiError } from "@/lib/api";
import { matchesSearch } from "@/lib/search-utils";

export function PartnersTab({ isAdmin, searchQuery = "" }: { isAdmin: boolean; searchQuery?: string }) {
  const [items, setItems] = useState<PartnerEstablishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newAliases, setNewAliases] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<PartnerEstablishment | null>(null);
  const [editName, setEditName] = useState("");
  const [editAliases, setEditAliases] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await fetchPartners(isAdmin));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const aliases = newAliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      await createPartner({ name, aliases });
      setNewName("");
      setNewAliases("");
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось добавить");
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (item: PartnerEstablishment) => {
    try {
      await updatePartner(item.id, { isActive: !item.isActive });
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка обновления");
    }
  };

  const onDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deletePartner(deleteId);
      setDeleteId(null);
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось удалить");
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (item: PartnerEstablishment) => {
    setEditItem(item);
    setEditName(item.name);
    setEditAliases(item.aliases.join(", "));
  };

  const onSaveEdit = async () => {
    if (!editItem) return;
    const name = editName.trim();
    if (!name) return;
    const aliases = editAliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      await updatePartner(editItem.id, { name, aliases });
      setEditItem(null);
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-body-sm text-on-surface-variant">
        Партнёры-заведения для учёта и привязки оборудования в сервисе. Приоритет заявок
        выставляет менеджер вручную.
      </p>

      {error && <p className="text-error text-body-sm">{error}</p>}

      <form onSubmit={(e) => void onAdd(e)} className="flex flex-col md:flex-row gap-2">
        <input
          className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
          placeholder="Название заведения"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          className="flex-[2] bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
          placeholder="Варианты через запятую: kfc, кфс, kentucky"
          value={newAliases}
          onChange={(e) => setNewAliases(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg disabled:opacity-50"
        >
          Добавить
        </button>
      </form>

      <div className="border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="px-4 py-3 text-label-md text-outline uppercase">Название</th>
              <th className="px-4 py-3 text-label-md text-outline uppercase">Варианты</th>
              <th className="px-4 py-3 text-label-md text-outline uppercase">Статус</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-on-surface-variant">
                  Загрузка...
                </td>
              </tr>
            ) : (
              items
                .filter((item) =>
                  matchesSearch(searchQuery, item.name, item.aliases.join(" ")),
                )
                .map((item) => (
                <tr key={item.id} className={!item.isActive ? "opacity-50" : undefined}>
                  <td className="px-4 py-3 font-medium">
                    {item.name}
                    {item.isBuiltin && (
                      <span className="ml-2 text-[10px] uppercase text-outline">встроенный</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-body-sm text-on-surface-variant">
                    {[item.name, ...item.aliases].join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void onToggle(item)}
                      className="text-primary text-body-sm hover:underline"
                    >
                      {item.isActive ? "Активен" : "Отключён"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="text-primary text-body-sm hover:underline"
                    >
                      Изменить
                    </button>
                    {!item.isBuiltin && (
                      <button
                        type="button"
                        onClick={() => setDeleteId(item.id)}
                        className="text-error text-body-sm hover:underline"
                      >
                        Удалить
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Изменить партнёра" loading={saving}>
        <div className="space-y-3">
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Название"
          />
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
            value={editAliases}
            onChange={(e) => setEditAliases(e.target.value)}
            placeholder="Варианты через запятую"
          />
        </div>
        <ModalActions
          onCancel={() => setEditItem(null)}
          onConfirm={() => void onSaveEdit()}
          confirmLabel="Сохранить"
          loading={saving}
          confirmDisabled={!editName.trim()}
        />
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => void onDelete()}
        title="Удалить партнёра?"
        description="Заявки сохранятся, но автоприоритет по этому партнёру перестанет работать."
        confirmLabel="Удалить"
        loading={deleting}
        destructive
      />
    </div>
  );
}
