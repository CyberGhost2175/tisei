"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { AlertModal, ConfirmModal } from "../components/Modal";
import {
  createDictionaryEntry,
  deleteDictionaryEntry,
  fetchDictionary,
  updateDictionaryEntry,
} from "@/lib/dictionaries-api";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { useGlobalSearch } from "@/lib/global-search";
import { matchesSearch } from "@/lib/search-utils";
import type { DictionaryItem, DictionaryType } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { PartnersTab } from "./PartnersTab";
import { RepairActsTab } from "./RepairActsTab";

type PageTab = DictionaryType | "partners" | "repair-acts";

const TABS: { key: PageTab; label: string }[] = [
  { key: "equipment-categories", label: "Категории оборудования" },
  { key: "malfunction-types", label: "Типы неисправностей" },
  { key: "partners", label: "Партнёры-заведения" },
  { key: "repair-acts", label: "АВР ремонт" },
];

export default function DictionariesPage() {
  useRequireAuth();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { debouncedQuery } = useGlobalSearch();
  const [tab, setTab] = useState<PageTab>("equipment-categories");
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [alert, setAlert] = useState<{ title: string; description: string } | null>(null);

  const load = useCallback(async () => {
    if (tab === "partners" || tab === "repair-acts") return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchDictionary(tab, isAdmin);
      setItems(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [tab, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "partners" || tab === "repair-acts") return;
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await createDictionaryEntry(tab, name);
      setNewName("");
      void load();
    } catch (e) {
      setAlert({
        title: "Ошибка",
        description: e instanceof ApiError ? e.message : "Не удалось добавить запись",
      });
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (item: DictionaryItem) => {
    if (tab === "partners" || tab === "repair-acts") return;
    try {
      await updateDictionaryEntry(tab, item.id, { isActive: !item.isActive });
      void load();
    } catch (e) {
      setAlert({
        title: "Ошибка",
        description: e instanceof ApiError ? e.message : "Не удалось изменить запись",
      });
    }
  };

  const onDelete = async () => {
    if (!deleteId || tab === "partners" || tab === "repair-acts") return;
    setDeleting(true);
    try {
      await deleteDictionaryEntry(tab, deleteId);
      setDeleteId(null);
      void load();
    } catch (e) {
      setAlert({
        title: "Ошибка",
        description: e instanceof ApiError ? e.message : "Не удалось удалить запись",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (user?.role === "executor" || user?.role === "master") {
    return (
      <AppShell active="refs" mobileActive="profile" searchPlaceholder="Поиск...">
        <p className="text-error">Раздел недоступен для исполнителей</p>
      </AppShell>
    );
  }

  return (
    <>
    <AppShell active="refs" mobileActive="profile" searchPlaceholder="Поиск в справочниках...">
      <div className="mb-6">
        <h2 className="font-headline-md text-headline-md">Справочники</h2>
        <p className="text-body-sm text-on-surface-variant">
          Категории оборудования, типы неисправностей, партнёры и АВР ремонта
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? "px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-sm"
                : "px-4 py-2 rounded-lg bg-surface-container-low text-on-surface-variant hover:text-primary text-sm"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && tab !== "partners" && tab !== "repair-acts" && (
        <p className="text-error text-body-sm mb-4">{error}</p>
      )}

      {tab === "partners" ? (
        <PartnersTab isAdmin={isAdmin} searchQuery={debouncedQuery} />
      ) : tab === "repair-acts" ? (
        <RepairActsTab searchQuery={debouncedQuery} />
      ) : (
        <>
      {isAdmin && (
        <form onSubmit={(e) => void onAdd(e)} className="flex gap-2 mb-6">
          <input
            className="flex-1 max-w-md bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2"
            placeholder="Новая запись..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="submit"
            disabled={saving || !newName.trim()}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg disabled:opacity-50"
          >
            Добавить
          </button>
        </form>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-on-surface-variant">Загрузка...</p>
        ) : items.filter((item) => matchesSearch(debouncedQuery, item.name)).length === 0 ? (
          <p className="p-6 text-on-surface-variant">
            {debouncedQuery ? "Ничего не найдено" : "Записей нет"}
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {items
              .filter((item) => matchesSearch(debouncedQuery, item.name))
              .map((item) => (
              <li key={item.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <span className={item.isActive ? "font-medium" : "text-outline line-through"}>
                    {item.name}
                  </span>
                  {!item.isActive && (
                    <span className="ml-2 text-xs text-outline uppercase">неактивна</span>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => void onToggle(item)}
                      className="text-body-sm text-primary hover:underline"
                    >
                      {item.isActive ? "Скрыть" : "Активировать"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(item.id)}
                      className="text-body-sm text-error hover:underline"
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
        </>
      )}
    </AppShell>

    <ConfirmModal
      open={!!deleteId}
      onClose={() => setDeleteId(null)}
      onConfirm={() => void onDelete()}
      title="Удалить запись?"
      description="Запись будет удалена из справочника без возможности восстановления."
      confirmLabel="Удалить"
      loading={deleting}
      destructive
    />

    <AlertModal
      open={!!alert}
      onClose={() => setAlert(null)}
      title={alert?.title ?? ""}
      description={alert?.description}
      tone="danger"
    />
    </>
  );
}

