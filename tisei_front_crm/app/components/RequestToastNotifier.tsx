"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MSym } from "./symbols";
import { useAuth } from "@/lib/AuthProvider";
import { usePolling } from "@/lib/usePolling";
import {
  fetchNotificationPreferences,
  fetchNotifications,
  markNotificationRead,
  type AppNotification,
  type NewRequestPayload,
} from "@/lib/notifications-api";
import { PRIORITY_LABELS } from "@/lib/labels";
import type { RequestPriority } from "@/lib/types";

type ToastItem = {
  notification: AppNotification;
  payload: NewRequestPayload;
};

function parsePayload(notification: AppNotification): NewRequestPayload | null {
  const p = notification.payload;
  if (!p || typeof p !== "object") return null;
  const data = p as Partial<NewRequestPayload>;
  if (!data.requestId || !data.number) return null;
  return {
    requestId: data.requestId,
    number: data.number,
    companyOrFullName: data.companyOrFullName ?? "Новая заявка",
    address: data.address ?? null,
    priority: data.priority ?? "normal",
    isPartner: data.isPartner,
  };
}

function RequestToast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { payload, notification } = item;
  const priority = (payload.priority in PRIORITY_LABELS
    ? payload.priority
    : "normal") as RequestPriority;

  useEffect(() => {
    const t = setTimeout(() => {
      void markNotificationRead(notification.id).catch(() => undefined);
      onDismiss(notification.id);
    }, 12000);
    return () => clearTimeout(t);
  }, [notification.id, onDismiss]);

  const open = () => {
    void markNotificationRead(notification.id).catch(() => undefined);
    onDismiss(notification.id);
  };

  return (
    <div
      role="status"
      className="w-full md:w-[400px] rounded-2xl border border-outline-variant/50 bg-surface-container-lowest shadow-2xl overflow-hidden animate-[slideUp_0.35s_ease-out]"
    >
      <div className="h-1 bg-gradient-to-r from-primary via-secondary to-primary" />
      <div className="p-4 flex gap-3">
        <div
          className={
            payload.isPartner
              ? "w-11 h-11 rounded-xl bg-[#e65100]/15 text-[#e65100] flex items-center justify-center shrink-0"
              : "w-11 h-11 rounded-xl bg-primary-container/25 text-primary flex items-center justify-center shrink-0"
          }
        >
          <MSym name="assignment" className="text-[24px]" fill />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-label-md text-primary text-[11px] uppercase tracking-wide">
                Новая заявка
              </p>
              <p className="font-headline-sm text-headline-sm truncate">{payload.number}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void markNotificationRead(notification.id).catch(() => undefined);
                onDismiss(notification.id);
              }}
              className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0"
              aria-label="Закрыть"
            >
              <MSym name="close" className="text-[18px]" />
            </button>
          </div>

          <p className="text-body-sm font-medium mt-1 truncate">{payload.companyOrFullName}</p>
          {payload.address && (
            <p className="text-body-sm text-on-surface-variant mt-0.5 line-clamp-2">
              {payload.address}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
              {PRIORITY_LABELS[priority]}
            </span>
            {payload.isPartner && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#e65100]/15 text-[#e65100]">
                Партнёр
              </span>
            )}
          </div>

          <Link
            href={`/requests/${payload.requestId}`}
            onClick={open}
            className="mt-3 inline-flex items-center gap-1.5 text-primary font-label-md text-sm hover:underline"
          >
            Открыть заявку
            <MSym name="arrow_forward" className="text-[16px]" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RequestToastNotifier() {
  const { user, loading } = useAuth();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const toastsEnabledRef = useRef(true);

  const refreshPrefs = useCallback(async () => {
    try {
      const data = await fetchNotificationPreferences();
      const pref = data.preferences.find((p) => p.eventType === "request.created");
      toastsEnabledRef.current = pref?.isEnabled ?? true;
    } catch {
      toastsEnabledRef.current = true;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!user) return;

    await refreshPrefs();
    if (!toastsEnabledRef.current) return;

    try {
      const data = await fetchNotifications({
        isRead: false,
        event: "request.created",
        pageSize: 30,
      });

      if (!initializedRef.current) {
        data.items.forEach((n) => seenRef.current.add(n.id));
        initializedRef.current = true;
        return;
      }

      const fresh: ToastItem[] = [];
      for (const n of data.items) {
        if (seenRef.current.has(n.id)) continue;
        seenRef.current.add(n.id);
        const payload = parsePayload(n);
        if (payload) fresh.push({ notification: n, payload });
      }

      if (fresh.length > 0) {
        setToasts((prev) => [...fresh.reverse(), ...prev].slice(0, 4));
      }
    } catch {
      /* сеть / сессия */
    }
  }, [user, refreshPrefs]);

  useEffect(() => {
    if (!user) {
      initializedRef.current = false;
      seenRef.current.clear();
      setToasts([]);
      return;
    }
    void refreshPrefs();
    const onPrefs = () => void refreshPrefs();
    window.addEventListener("tisei-prefs-changed", onPrefs);
    return () => window.removeEventListener("tisei-prefs-changed", onPrefs);
  }, [user?.id, refreshPrefs]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.notification.id !== id));
  }, []);

  useEffect(() => {
    if (user && !loading) void poll();
  }, [user, loading, poll]);

  usePolling(() => void poll(), 5000, !!user && !loading);

  if (!user || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-[120] flex flex-col items-stretch md:items-end gap-3 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.notification.id} className="pointer-events-auto">
          <RequestToast item={t} onDismiss={dismissToast} />
        </div>
      ))}
    </div>
  );
}
