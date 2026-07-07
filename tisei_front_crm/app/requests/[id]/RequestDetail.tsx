"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/Sidebar";
import { MobileNav } from "../../components/MobileNav";
import { MSym } from "../../components/symbols";
import { AlertModal, ConfirmModal } from "../../components/Modal";
import { changeRequestStatus, fetchRequest, updateRequest } from "@/lib/requests-api";
import { fetchDictionary } from "@/lib/dictionaries-api";
import { ClosingForm } from "./ClosingForm";
import { RequestAssignment } from "./RequestAssignment";
import { RequestComments } from "./RequestComments";
import { RequestAttachments } from "./RequestAttachments";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import {
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  formatDate,
} from "@/lib/labels";
import type { DictionaryItem, RequestPriority, RequestStatus, ServiceRequest } from "@/lib/types";
import { ApiError } from "@/lib/api";

const PRIORITIES: RequestPriority[] = ["critical", "high", "normal", "low"];

const STATUSES: RequestStatus[] = [
  "new",
  "in_progress",
  "awaiting_parts",
  "in_service",
];

export function RequestDetail({ id }: { id: string }) {
  useRequireAuth();
  const { user } = useAuth();
  const router = useRouter();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<RequestStatus | null>(null);
  const [showServicePrompt, setShowServicePrompt] = useState(false);
  const [serviceCategoryId, setServiceCategoryId] = useState("");
  const [categories, setCategories] = useState<DictionaryItem[]>([]);
  const [alert, setAlert] = useState<{ title: string; description: string } | null>(null);

  const canEditMeta = user?.role === "admin" || user?.role === "manager";
  const canWriteOnRequest =
    canEditMeta ||
    (user?.role === "executor" &&
      !!request?.assignments?.some((a) => a.executorId === user.id));

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchRequest(id);
      setRequest(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Заявка не найдена");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    if (canEditMeta) {
      void fetchDictionary("equipment-categories").then(setCategories).catch(() => {});
    }
  }, [id, canEditMeta]);

  const applyStatus = async (
    status: RequestStatus,
    options?: { equipmentCategoryId?: string },
  ) => {
    if (!request) return;
    setSaving(true);
    try {
      const updated = await changeRequestStatus(request.id, status, options);
      setRequest(updated);
      setPendingStatus(null);
      setShowServicePrompt(false);
      setServiceCategoryId("");
      if (status === "closed") {
        router.push("/");
      }
    } catch (e) {
      setAlert({
        title: "Ошибка смены статуса",
        description: e instanceof ApiError ? e.message : "Не удалось изменить статус",
      });
    } finally {
      setSaving(false);
    }
  };

  const onPriorityChange = async (priority: RequestPriority) => {
    if (!request || !canEditMeta) return;
    setSaving(true);
    try {
      const updated = await updateRequest(request.id, { priority });
      setRequest(updated);
    } catch (e) {
      setAlert({
        title: "Ошибка",
        description: e instanceof ApiError ? e.message : "Не удалось изменить приоритет",
      });
    } finally {
      setSaving(false);
    }
  };

  const onStatusSelect = (status: RequestStatus) => {
    if (!request || status === request.status) return;
    setPendingStatus(status);
    if (status === "in_service") {
      const hasCategory = request.equipmentCategory?.id || request.equipmentCategoryText;
      if (!hasCategory) {
        setServiceCategoryId("");
        setShowServicePrompt(true);
        return;
      }
    }
  };

  const cancelStatusChange = () => {
    setPendingStatus(null);
    setShowServicePrompt(false);
    setServiceCategoryId("");
  };

  const confirmStatus = pendingStatus && !showServicePrompt ? pendingStatus : null;

  if (loading) {
    return <div className="p-8 md:pl-[260px]">Загрузка заявки...</div>;
  }

  if (error || !request) {
    return (
      <div className="p-8 md:pl-[260px]">
        <p className="text-error">{error || "Не найдено"}</p>
        <Link href="/requests" className="text-primary underline mt-4 inline-block">
          ← К списку
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Sidebar active="requests" />

      <header className="fixed top-0 left-0 md:left-[240px] right-0 h-16 bg-surface border-b border-outline-variant flex items-center px-container-margin z-30">
        <Link href="/requests" className="text-primary flex items-center gap-2">
          <MSym name="arrow_back" /> Назад
        </Link>
      </header>

      <main className="pt-20 pb-28 md:pb-8 md:pl-[240px] px-container-margin min-h-screen max-w-5xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-headline-md text-headline-md">{request.number}</h2>
            <p className="text-on-surface-variant text-body-sm">
              Источник: {SOURCE_LABELS[request.source]} · {formatDate(request.createdAt)}
            </p>
          </div>
          {request.status === "closed" || request.status === "frozen" ? (
            <span className="bg-surface-container-high text-on-surface-variant font-label-md px-4 py-2 rounded-lg">
              {STATUS_LABELS[request.status]}
            </span>
          ) : (
            <select
              value={request.status}
              disabled={saving}
              onChange={(e) => onStatusSelect(e.target.value as RequestStatus)}
              className="bg-primary-container text-on-primary font-label-md px-4 py-2 rounded-lg"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard title="Клиент" value={request.companyOrFullName} />
          <InfoCard title="Телефон" value={request.phone} />
          <InfoCard title="Email" value={request.email ?? "—"} />
          <InfoCard title="Адрес" value={request.address ?? "—"} />
          <InfoCard title="Приоритет" value={PRIORITY_LABELS[request.priority]} />
          {request.partnerEstablishment && (
            <InfoCard title="Партнёр" value={request.partnerEstablishment.name} />
          )}
          <InfoCard
            title="Оборудование"
            value={
              [request.equipmentCategory?.name, request.equipmentCategoryText, request.equipmentName]
                .filter(Boolean)
                .join(" · ") || "—"
            }
          />
        </div>

        {canEditMeta && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-label-md text-outline uppercase">Приоритет</label>
            <select
              value={request.priority}
              disabled={saving}
              onChange={(e) => void onPriorityChange(e.target.value as RequestPriority)}
              className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-body-md"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h3 className="font-label-md text-outline uppercase mb-2">Описание проблемы</h3>
          <p className="text-body-md whitespace-pre-wrap">{request.problemDescription || "—"}</p>
        </div>

        <div className="mt-4 text-body-sm text-on-surface-variant">
          Исполнители:{" "}
          {request.assignments?.map((a) => a.executor.fullName).join(", ") || "не назначены"}
        </div>

        <RequestAssignment request={request} onUpdated={setRequest} />

        <RequestComments requestId={request.id} canWrite={canWriteOnRequest} />
        <RequestAttachments requestId={request.id} canWrite={canWriteOnRequest} />

        <ClosingForm requestId={request.id} onClosed={() => router.push("/")} />
      </main>

      <MobileNav active="tasks" />

      <ConfirmModal
        open={!!confirmStatus}
        onClose={cancelStatusChange}
        onConfirm={() =>
          confirmStatus &&
          void applyStatus(
            confirmStatus,
            confirmStatus === "in_service" && serviceCategoryId
              ? { equipmentCategoryId: serviceCategoryId }
              : undefined,
          )
        }
        title="Сменить статус заявки?"
        description={
          confirmStatus
            ? `Заявка ${request.number} будет переведена в статус «${STATUS_LABELS[confirmStatus]}».`
            : undefined
        }
        confirmLabel={confirmStatus === "closed" ? "Закрыть заявку" : "Изменить статус"}
        loading={saving}
      />

      {showServicePrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-inverse-surface/40">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="font-headline-sm text-headline-sm mb-2">Перевод в сервис</h3>
            <p className="text-body-sm text-on-surface-variant mb-4">
              Укажите категорию оборудования — оно появится в разделе «В сервисе».
            </p>
            <select
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 mb-4"
              value={serviceCategoryId}
              onChange={(e) => setServiceCategoryId(e.target.value)}
            >
              <option value="">Выберите категорию</option>
              {categories.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={cancelStatusChange} className="px-4 py-2 rounded-lg border border-outline-variant">
                Отмена
              </button>
              <button
                type="button"
                disabled={!serviceCategoryId || saving}
                onClick={() =>
                  void applyStatus("in_service", { equipmentCategoryId: serviceCategoryId })
                }
                className="px-4 py-2 rounded-lg bg-primary text-on-primary disabled:opacity-50"
              >
                В сервис
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        open={!!alert}
        onClose={() => setAlert(null)}
        title={alert?.title ?? ""}
        description={alert?.description}
        tone="danger"
      />
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
      <p className="text-label-md text-outline uppercase mb-1">{title}</p>
      <p className="font-body-md font-medium">{value}</p>
    </div>
  );
}
