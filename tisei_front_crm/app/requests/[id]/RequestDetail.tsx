"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/Sidebar";
import { MobileNav } from "../../components/MobileNav";
import { MSym } from "../../components/symbols";
import { AlertModal, ConfirmModal } from "../../components/Modal";
import { changeRequestStatus, deleteRequest, fetchRequest, updateRequest } from "@/lib/requests-api";
import { fetchDictionary } from "@/lib/dictionaries-api";
import { ClosingForm } from "./ClosingForm";
import { RequestAssignment } from "./RequestAssignment";
import { RequestComments } from "./RequestComments";
import { RequestAttachments } from "./RequestAttachments";
import { RequestPartUsage } from "./RequestPartUsage";
import { ActShareButton } from "./ActShareButton";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import {
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  formatDate,
  priorityLabel,
} from "@/lib/labels";
import type { DictionaryItem, RequestPriority, RequestStatus, ServiceRequest } from "@/lib/types";
import { ApiError } from "@/lib/api";

const PRIORITIES: RequestPriority[] = ["P1", "P2", "P3", "P4"];

const STATUSES: RequestStatus[] = [
  "new",
  "in_progress",
  "awaiting_parts",
  "in_service",
  "awaiting_approval",
  "repeat",
];

const REACTIVATE_STATUSES: RequestStatus[] = [
  "repeat",
  "awaiting_approval",
  "in_progress",
  "awaiting_parts",
  "frozen",
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
  const [partsReloadKey, setPartsReloadKey] = useState(0);
  const [alert, setAlert] = useState<{ title: string; description: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEditMeta = user?.role === "admin" || user?.role === "manager";
  const canDelete = canEditMeta;
  const canReactivateClosed = canEditMeta || user?.role === "executor";
  const canWriteOnRequest =
    canEditMeta ||
    ((user?.role === "executor" || user?.role === "master") &&
      !!request?.assignments?.some(
        (a) => a.executorId === user.id && a.status !== "proposed",
      ));

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

  const onPriorityChange = async (priority: RequestPriority | null) => {
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

  const onDelete = async () => {
    if (!request) return;
    setDeleting(true);
    try {
      await deleteRequest(request.id);
      setConfirmDelete(false);
      router.push("/requests");
    } catch (e) {
      setConfirmDelete(false);
      setAlert({
        title: "Не удалось удалить",
        description: e instanceof ApiError ? e.message : "Ошибка удаления заявки",
      });
    } finally {
      setDeleting(false);
    }
  };

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
            <h2 className="font-headline-md text-headline-md flex flex-wrap items-center gap-2">
              {request.number}
              {request.fromMaintenanceRequest && (
                <span className="text-[11px] font-bold uppercase text-amber-800 bg-amber-100 px-2 py-1 rounded">
                  С обслуживания
                </span>
              )}
              {request.kind === "maintenance" && (
                <span className="text-[11px] font-bold uppercase text-primary bg-primary/10 px-2 py-1 rounded">
                  Обслуживание
                </span>
              )}
            </h2>
            <p className="text-on-surface-variant text-body-sm">
              Источник: {SOURCE_LABELS[request.source]} · {formatDate(request.createdAt)}
              {request.fromMaintenanceRequest && (
                <>
                  {" · "}
                  <Link
                    href={`/requests/${request.fromMaintenanceRequest.id}`}
                    className="text-primary hover:underline"
                  >
                    ТО {request.fromMaintenanceRequest.number}
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canDelete && (
              <button
                type="button"
                disabled={saving || deleting}
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 rounded-lg border border-error/40 text-error font-label-md hover:bg-error-container/20 disabled:opacity-50"
              >
                Удалить
              </button>
            )}
          {request.status === "closed" && canReactivateClosed ? (
            <select
              value=""
              disabled={saving}
              onChange={(e) => {
                const next = e.target.value as RequestStatus;
                if (next) onStatusSelect(next);
              }}
              className="bg-primary-container text-on-primary font-label-md px-4 py-2 rounded-lg"
            >
              <option value="">Закрыта — активировать…</option>
              {REACTIVATE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  → {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          ) : request.status === "frozen" && !canEditMeta ? (
            <span className="bg-surface-container-high text-on-surface-variant font-label-md px-4 py-2 rounded-lg">
              {STATUS_LABELS[request.status]}
            </span>
          ) : request.status === "closed" ? (
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
              {(canEditMeta
                ? [...STATUSES, "frozen" as RequestStatus].filter(
                    (s, i, arr) => arr.indexOf(s) === i,
                  )
                : STATUSES
              ).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard title="Клиент" value={request.companyOrFullName} />
          <InfoCard title="Телефон" value={request.phone} />
          <InfoCard title="Email" value={request.email ?? "—"} />
          <InfoCard title="Адрес" value={request.address ?? "—"} />
          <InfoCard title="Приоритет" value={priorityLabel(request.priority)} />
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
              value={request.priority ?? ""}
              disabled={saving}
              onChange={(e) =>
                void onPriorityChange(
                  e.target.value ? (e.target.value as RequestPriority) : null,
                )
              }
              className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-body-md"
            >
              <option value="">Не задан</option>
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
        <RequestPartUsage
          requestId={request.id}
          requestStatus={request.status}
          canWrite={canWriteOnRequest}
          onChanged={() => setPartsReloadKey((k) => k + 1)}
        />

        <ClosingForm
          requestId={request.id}
          reloadKey={partsReloadKey}
          companyCommissionRate={
            request.assignments?.some((a) => a.executor.role === "master") ? 0.2 : 0.1
          }
          onClosed={() => router.push("/")}
        />

        {request.status === "closed" && <ActShareButton requestId={request.id} />}
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
        title={request.status === "closed" ? "Активировать заявку?" : "Сменить статус заявки?"}
        description={
          confirmStatus
            ? request.status === "closed"
              ? `Заявка ${request.number} будет переведена в статус «${STATUS_LABELS[confirmStatus]}». Исполнитель будет сброшен — назначьте заново.`
              : `Заявка ${request.number} будет переведена в статус «${STATUS_LABELS[confirmStatus]}».`
            : undefined
        }
        confirmLabel={
          confirmStatus === "closed"
            ? "Закрыть заявку"
            : request.status === "closed"
              ? "Да, активировать"
              : "Изменить статус"
        }
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

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void onDelete()}
        title="Удалить заявку?"
        description={
          request
            ? `Точно удалить заявку ${request.number} (${request.companyOrFullName})? Её можно будет восстановить в течение 30 дней.`
            : undefined
        }
        confirmLabel="Да, удалить"
        loading={deleting}
        destructive
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
