"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { MSym } from "../components/symbols";
import { AlertModal, ConfirmModal } from "../components/Modal";
import {
  archiveUser,
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
} from "@/lib/users-api";
import { useAuth, useRequireAuth, useRequireRole } from "@/lib/AuthProvider";
import { useGlobalSearch } from "@/lib/global-search";
import { formatDate } from "@/lib/labels";
import { ROLE_ACCESS, ROLE_LABELS } from "@/lib/role-access";
import type { UserProfile, UserRole } from "@/lib/types";
import { ApiError } from "@/lib/api";

type RoleFilter = "all" | UserRole;

const ROLE_TABS: { key: RoleFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "executor", label: "Мастера" },
  { key: "manager", label: "Менеджеры" },
  { key: "admin", label: "Админы" },
];

const INPUT_CLS =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary";

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  role: "executor" as UserRole,
};

export default function UsersPage() {
  useRequireAuth();
  useRequireRole(["admin"]);
  const { user: currentUser } = useAuth();

  const [items, setItems] = useState<UserProfile[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const { debouncedQuery } = useGlobalSearch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "executor" as UserRole,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [alert, setAlert] = useState<{ title: string; description: string } | null>(null);

  const load = useCallback(
    async (page = 1, role = roleFilter, q = debouncedQuery) => {
      setLoading(true);
      setError("");
      try {
        const params: Record<string, string | number | boolean | undefined> = {
          page,
          pageSize: 20,
          search: q || undefined,
        };
        if (role !== "all") params.role = role;
        const data = await fetchUsers(params);
        setItems(data.items);
        setMeta(data.meta);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    },
    [roleFilter, debouncedQuery],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const openCreate = (role?: UserRole) => {
    setForm({ ...emptyForm, role: role ?? (roleFilter !== "all" ? roleFilter : "executor") });
    setShowForm(true);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createUser({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password || undefined,
        role: form.role,
      });
      setShowForm(false);
      setForm(emptyForm);
      void load(meta.page);
    } catch (e) {
      setAlert({
        title: "Ошибка создания",
        description: e instanceof ApiError ? e.message : "Не удалось создать пользователя",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: UserProfile) => {
    setEditTarget(u);
    setEditForm({
      fullName: u.fullName,
      email: u.email,
      phone: u.phone ?? "",
      role: u.role,
      isActive: u.isActive,
    });
  };

  const onSaveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateUser(editTarget.id, {
        fullName: editForm.fullName,
        email: editForm.email,
        phone: editForm.phone || null,
        role: editForm.role,
        isActive: editForm.isActive,
      });
      setEditTarget(null);
      void load(meta.page);
    } catch (e) {
      setAlert({
        title: "Ошибка сохранения",
        description: e instanceof ApiError ? e.message : "Не удалось обновить пользователя",
      });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      void load(meta.page);
    } catch (e) {
      setAlert({
        title: "Ошибка удаления",
        description: e instanceof ApiError ? e.message : "Не удалось удалить",
      });
    } finally {
      setDeleting(false);
    }
  };

  const onQuickArchive = async (u: UserProfile) => {
    try {
      await archiveUser(u.id);
      void load(meta.page);
    } catch (e) {
      setAlert({
        title: "Ошибка",
        description: e instanceof ApiError ? e.message : "Не удалось деактивировать",
      });
    }
  };

  const isSelf = (u: UserProfile) => u.id === currentUser?.id;

  return (
    <>
      <AppShell
        active="users"
        mobileActive="profile"
        searchPlaceholder="Поиск по имени или email..."
        actions={
          <button
            type="button"
            onClick={() => openCreate()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-label-md rounded-lg text-sm"
          >
            <MSym name="person_add" className="text-[18px]" />
            Добавить
          </button>
        }
      >
        <div className="mb-6">
          <h2 className="font-headline-md text-headline-md">Пользователи</h2>
          <p className="text-body-sm text-on-surface-variant">
            {loading ? "Загрузка..." : `Всего: ${meta.total}`} · управление ролями и доступами
          </p>
        </div>

        <div className="mb-6 grid md:grid-cols-3 gap-3">
          {(["admin", "manager", "executor"] as UserRole[]).map((role) => (
            <div
              key={role}
              className="p-4 rounded-xl border border-outline-variant bg-surface-container-lowest"
            >
              <p className="font-label-md text-primary mb-2">{ROLE_LABELS[role]}</p>
              <ul className="text-body-sm text-on-surface-variant space-y-1 list-disc list-inside">
                {ROLE_ACCESS[role].map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setRoleFilter(tab.key);
                void load(1, tab.key, debouncedQuery);
              }}
              className={
                roleFilter === tab.key
                  ? "px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-label-md"
                  : "px-4 py-2 rounded-lg bg-surface-container-low text-on-surface-variant text-sm"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {debouncedQuery && (
          <p className="text-body-sm text-on-surface-variant mb-4">
            Поиск: «{debouncedQuery}» · используйте поле вверху страницы
          </p>
        )}

        {error && <p className="text-error text-body-sm mb-4">{error}</p>}

        {showForm && (
          <form
            onSubmit={(e) => void onCreate(e)}
            className="mb-6 p-4 bg-surface-container-lowest border border-outline-variant rounded-xl"
          >
            <h3 className="font-headline-sm mb-4">Новый пользователь</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                required
                placeholder="ФИО *"
                className={INPUT_CLS}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
              <input
                required
                type="email"
                placeholder="Email *"
                className={INPUT_CLS}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                placeholder="Телефон"
                className={INPUT_CLS}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <input
                placeholder="Пароль (если пусто — сгенерируется)"
                type="password"
                className={INPUT_CLS}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <select
                className={INPUT_CLS}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              >
                <option value="executor">Исполнитель (мастер)</option>
                <option value="manager">Менеджер</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg disabled:opacity-50"
              >
                {saving ? "Создание..." : "Создать"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-outline-variant rounded-lg"
              >
                Отмена
              </button>
            </div>
          </form>
        )}

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-x-auto">
          <table className="w-full text-left min-w-[720px]">
            <thead className="bg-surface-container-low">
              <tr className="border-b border-outline-variant">
                {["ФИО", "Email", "Роль", "Статус", "Последний вход", "Действия"].map((h) => (
                  <th key={h} className="px-4 py-3 font-label-md text-outline uppercase text-xs">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {items.map((u) => (
                <tr key={u.id} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3 font-medium">
                    {u.fullName}
                    {isSelf(u) && (
                      <span className="ml-2 text-[10px] text-primary uppercase">вы</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-body-sm">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-body-sm font-medium">{ROLE_LABELS[u.role]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.isActive
                          ? "text-primary text-xs font-bold uppercase"
                          : "text-outline text-xs font-bold uppercase"
                      }
                    >
                      {u.isActive ? "Активен" : "Отключён"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-body-sm text-on-surface-variant">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="text-body-sm text-primary hover:underline"
                      >
                        Изменить
                      </button>
                      {u.isActive && !isSelf(u) && (
                        <button
                          type="button"
                          onClick={() => void onQuickArchive(u)}
                          className="text-body-sm text-on-surface-variant hover:underline"
                        >
                          Отключить
                        </button>
                      )}
                      {!isSelf(u) && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(u)}
                          className="text-body-sm text-error hover:underline"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant">
                    Пользователей не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openCreate("executor")}
            className="text-sm text-primary hover:underline"
          >
            + Добавить мастера
          </button>
          <button
            type="button"
            onClick={() => openCreate("manager")}
            className="text-sm text-primary hover:underline"
          >
            + Добавить менеджера
          </button>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <span className="text-body-sm text-on-surface-variant">
            Стр. {meta.page} из {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={meta.page <= 1}
              onClick={() => void load(meta.page - 1)}
              className="px-3 py-1 rounded border border-outline-variant disabled:opacity-40"
            >
              Назад
            </button>
            <button
              type="button"
              disabled={meta.page >= meta.totalPages}
              onClick={() => void load(meta.page + 1)}
              className="px-3 py-1 rounded border border-outline-variant disabled:opacity-40"
            >
              Далее
            </button>
          </div>
        </div>
      </AppShell>

      {editTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-inverse-surface/40">
          <div className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-2xl">
            <h3 className="font-headline-sm mb-4">Редактировать: {editTarget.fullName}</h3>
            <div className="space-y-3">
              <input
                className={INPUT_CLS}
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                placeholder="ФИО"
              />
              <input
                className={INPUT_CLS}
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="Email"
              />
              <input
                className={INPUT_CLS}
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="Телефон"
              />
              <select
                className={INPUT_CLS}
                value={editForm.role}
                disabled={isSelf(editTarget)}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-body-sm">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  disabled={isSelf(editTarget)}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                Активен (доступ к CRM)
              </label>
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 border border-outline-variant rounded-lg"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSaveEdit()}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg disabled:opacity-50"
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void onDelete()}
        title="Удалить пользователя?"
        description={
          deleteTarget
            ? `${deleteTarget.fullName} будет удалён безвозвратно. Назначения на заявках сохранятся в истории.`
            : undefined
        }
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
