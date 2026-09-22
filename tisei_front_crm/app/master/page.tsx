"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MSym } from "../components/symbols";
import { fetchRequests } from "@/lib/requests-api";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { usePolling } from "@/lib/usePolling";
import { PRIORITY_LABELS, STATUS_LABELS, formatDate, initials } from "@/lib/labels";
import type { ServiceRequest } from "@/lib/types";
import { ApiError } from "@/lib/api";

export default function MasterCabinetPage() {
  useRequireAuth();
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      try {
        const data = await fetchRequests({ executorId: user.id, mine: true, page: 1, pageSize: 20 });
        setRequests(data.items);
        if (!silent) setError("");
      } catch (e) {
        if (!silent) setError(e instanceof ApiError ? e.message : "Ошибка загрузки заявок");
      }
    },
    [user],
  );

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(() => void load(true), 5000, !!user);

  const active = requests.filter((r) => !["closed", "cancelled"].includes(r.status));
  const closed = requests.filter((r) => r.status === "closed");

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen pb-24 overflow-x-hidden">
      <header className="sticky top-0 z-30 bg-surface border-b border-outline-variant px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 28 }}>engineering</span>
          <h1 className="font-headline-sm text-headline-sm text-primary tracking-tight">Береке ТехСервис</h1>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs">
          {user ? initials(user.fullName) : "?"}
        </div>
      </header>

      <main className="p-4 space-y-6 max-w-md mx-auto">
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm">
          <h2 className="font-label-md text-label-md text-on-surface-variant mb-4 flex items-center gap-2">
            <MSym name="account_balance_wallet" className="text-[16px]" /> ИТОГ ЗА СМЕНУ
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary-container/10 p-3 rounded-lg border border-primary/20">
              <p className="font-label-md text-label-md text-primary mb-1">АКТИВНЫЕ</p>
              <p className="font-display-lg text-display-lg text-primary leading-none">{active.length}</p>
            </div>
            <div className="bg-secondary-container/10 p-3 rounded-lg border border-secondary/20">
              <p className="font-label-md text-label-md text-secondary mb-1">ЗАКРЫТЫЕ</p>
              <p className="font-display-lg text-display-lg text-secondary leading-none">{closed.length}</p>
            </div>
          </div>
        </section>

        {error && <p className="text-error">{error}</p>}

        <div className="space-y-4">
          {requests.map((req) => (
            <Link key={req.id} href={`/requests/${req.id}`} className="block bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3 gap-3">
                <div>
                  <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded uppercase">{STATUS_LABELS[req.status]}</span>
                  <h3 className="font-headline-sm text-headline-sm mt-1">{req.number}</h3>
                  <p className="text-on-surface-variant font-body-sm">{req.address ?? req.companyOrFullName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">Приоритет</p>
                  <p className="font-headline-sm text-secondary">
                    {req.priority ? PRIORITY_LABELS[req.priority] : "—"}
                  </p>
                </div>
              </div>
              <p className="text-body-sm mb-2">{req.problemDescription || "—"}</p>
              <div className="text-[11px] text-on-surface-variant">{formatDate(req.deadline || req.createdAt)}</div>
            </Link>
          ))}
          {requests.length === 0 && <p className="text-on-surface-variant">Назначенных заявок нет</p>}
        </div>
      </main>
    </div>
  );
}
