"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { MSym } from "../components/symbols";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { useGlobalSearch } from "@/lib/global-search";
import { matchesSearch } from "@/lib/search-utils";
import { useTheme, type ThemeMode } from "@/lib/theme";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreference,
} from "@/lib/notifications-api";
import { changePassword } from "@/lib/settings-api";
import { ApiError } from "@/lib/api";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "light", label: "Светлая", icon: "light_mode" },
  { value: "dark", label: "Тёмная", icon: "dark_mode" },
  { value: "system", label: "Как в системе", icon: "brightness_auto" },
];

const INPUT =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm";

export function SettingsContent() {
  useRequireAuth();
  const { user } = useAuth();
  const { theme, setTheme, loading: themeLoading } = useTheme();
  const { debouncedQuery } = useGlobalSearch();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchNotificationPreferences();
      setPreferences(data.preferences);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить настройки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePreference = async (eventType: string, isEnabled: boolean) => {
    const next = preferences.map((p) => (p.eventType === eventType ? { ...p, isEnabled } : p));
    setPreferences(next);
    setSaving(true);
    setSuccess("");
    try {
      const data = await updateNotificationPreferences(
        next.map((p) => ({ eventType: p.eventType, isEnabled: p.isEnabled })),
      );
      setPreferences(data.preferences);
      setSuccess("Сохранено");
      window.dispatchEvent(new Event("tisei-prefs-changed"));
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка сохранения");
      void load();
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setPasswordError("Новый пароль должен содержать минимум 8 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Пароли не совпадают");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("Новый пароль должен отличаться от текущего");
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setPasswordSuccess("Пароль успешно изменён");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(""), 3500);
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Не удалось изменить пароль");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <AppShell active="settings" mobileActive="profile" searchPlaceholder="Настройки...">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-headline-md text-headline-md">Настройки</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {user?.fullName} · оформление, безопасность и уведомления
          </p>
        </div>

        {error && <p className="text-error text-body-sm">{error}</p>}
        {success && (
          <p className="text-primary text-body-sm flex items-center gap-2">
            <MSym name="check_circle" className="text-[18px]" />
            {success}
          </p>
        )}

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h2 className="font-headline-sm text-headline-sm mb-1">Смена пароля</h2>
          <p className="text-body-sm text-on-surface-variant mb-4">
            Любой пользователь может сменить свой пароль. Укажите текущий и новый пароль (не менее 8
            символов).
          </p>

          {passwordError && <p className="text-error text-body-sm mb-3">{passwordError}</p>}
          {passwordSuccess && (
            <p className="text-primary text-body-sm mb-3 flex items-center gap-2">
              <MSym name="check_circle" className="text-[18px]" />
              {passwordSuccess}
            </p>
          )}

          <form onSubmit={(e) => void onChangePassword(e)} className="space-y-3">
            <div>
              <label className="block text-label-md text-on-surface-variant mb-1">
                Текущий пароль
              </label>
              <input
                className={INPUT}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={passwordSaving}
              />
            </div>
            <div>
              <label className="block text-label-md text-on-surface-variant mb-1">Новый пароль</label>
              <input
                className={INPUT}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                disabled={passwordSaving}
              />
            </div>
            <div>
              <label className="block text-label-md text-on-surface-variant mb-1">
                Повторите новый пароль
              </label>
              <input
                className={INPUT}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={passwordSaving}
              />
            </div>
            <button
              type="submit"
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              className="px-4 py-2.5 bg-primary text-on-primary rounded-lg font-label-md disabled:opacity-50"
            >
              {passwordSaving ? "Сохранение..." : "Изменить пароль"}
            </button>
          </form>
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h2 className="font-headline-sm text-headline-sm mb-1">Оформление</h2>
          <p className="text-body-sm text-on-surface-variant mb-4">
            Сохраняется в вашем аккаунте на сервере
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={themeLoading || saving}
                onClick={() => void setTheme(opt.value)}
                className={
                  theme === opt.value
                    ? "flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-primary bg-primary-container/10"
                    : "flex flex-col items-center gap-2 p-4 rounded-xl border border-outline-variant hover:border-primary/40"
                }
              >
                <MSym name={opt.icon} className="text-[28px] text-primary" />
                <span className="font-label-md text-sm">{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h2 className="font-headline-sm text-headline-sm mb-1">Уведомления</h2>
          <p className="text-body-sm text-on-surface-variant mb-4">
            Всплывающие уведомления снизу экрана — сохраняются для вашего аккаунта
          </p>

          {loading ? (
            <p className="text-on-surface-variant text-body-sm">Загрузка...</p>
          ) : (
            <ul className="divide-y divide-outline-variant">
              {preferences
                .filter((pref) => matchesSearch(debouncedQuery, pref.label, pref.eventType))
                .map((pref) => (
                  <li key={pref.eventType} className="py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-body-md font-medium">{pref.label}</p>
                      {pref.eventType === "request.created" && (
                        <p className="text-body-sm text-on-surface-variant mt-0.5">
                          Тост при новой заявке на любом экране
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      role="switch"
                      aria-checked={pref.isEnabled}
                      onClick={() => void togglePreference(pref.eventType, !pref.isEnabled)}
                      className={
                        pref.isEnabled
                          ? "relative w-12 h-7 rounded-full bg-primary transition-colors shrink-0"
                          : "relative w-12 h-7 rounded-full bg-outline-variant transition-colors shrink-0"
                      }
                    >
                      <span
                        className={
                          pref.isEnabled
                            ? "absolute top-1 left-6 w-5 h-5 rounded-full bg-on-primary shadow transition-all"
                            : "absolute top-1 left-1 w-5 h-5 rounded-full bg-surface-container-lowest shadow transition-all"
                        }
                      />
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
