"use client";

import { useEffect, useState } from "react";
import { MSym } from "../../components/symbols";
import { ConfirmModal } from "../../components/Modal";
import {
  acceptRequestOffer,
  assignExecutors,
  claimRequest,
  declineRequest,
} from "@/lib/requests-api";
import { fetchExecutors } from "@/lib/users-api";
import { useAuth } from "@/lib/AuthProvider";
import { isFieldRole, isPartnerMaster, isStaffMaster, ROLE_LABELS } from "@/lib/role-access";
import type { ServiceRequest, UserRole } from "@/lib/types";
import { ApiError } from "@/lib/api";

export function RequestAssignment({
  request,
  onUpdated,
}: {
  request: ServiceRequest;
  onUpdated: (r: ServiceRequest) => void;
}) {
  const { user } = useAuth();
  const [executors, setExecutors] = useState<
    Array<{ id: string; fullName: string; role?: UserRole }>
  >([]);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showClaim, setShowClaim] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [error, setError] = useState("");

  const isManager = user?.role === "admin" || user?.role === "manager";
  const fieldRole = isFieldRole(user?.role);
  const staffMaster = isStaffMaster(user?.role);
  const partnerMaster = isPartnerMaster(user?.role);
  const myAssignment = request.assignments?.find((a) => a.executorId === user?.id);
  const assignedToMe = !!myAssignment;
  const isProposed = myAssignment?.status === "proposed";
  const isAccepted = assignedToMe && !isProposed;
  const canClaim =
    staffMaster &&
    !assignedToMe &&
    !["closed", "cancelled"].includes(request.status);
  const canAccept = fieldRole && isProposed;
  const canDecline =
    fieldRole &&
    assignedToMe &&
    !["closed", "cancelled"].includes(request.status);

  useEffect(() => {
    if (!isManager) return;
    void fetchExecutors()
      .then(setExecutors)
      .catch(() => setExecutors([]));
  }, [isManager]);

  useEffect(() => {
    const current = request.assignments?.[0]?.executorId ?? "";
    setSelectedId(current);
  }, [request.assignments]);

  const onAssign = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    try {
      const updated = await assignExecutors(request.id, [selectedId]);
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка назначения");
    } finally {
      setSaving(false);
    }
  };

  const onClaim = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await claimRequest(request.id);
      onUpdated(updated);
      setShowClaim(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось взять заявку");
    } finally {
      setSaving(false);
    }
  };

  const onAccept = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await acceptRequestOffer(request.id);
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось принять заявку");
    } finally {
      setSaving(false);
    }
  };

  const onDecline = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await declineRequest(request.id);
      onUpdated(updated);
      setShowDecline(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось отказаться");
    } finally {
      setSaving(false);
    }
  };

  const assignedNames =
    request.assignments
      ?.map((a) => {
        const role = a.executor.role;
        const suffix =
          role === "master"
            ? a.status === "proposed"
              ? " (предложено)"
              : " (мастер)"
            : role === "executor"
              ? " (штатный)"
              : "";
        return `${a.executor.fullName}${suffix}`;
      })
      .join(", ") || "не назначены";

  return (
    <section className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <h3 className="font-label-md text-outline uppercase mb-4">Исполнитель</h3>

      {error && <p className="text-error text-body-sm mb-3">{error}</p>}

      <p className="text-body-md mb-4">
        Сейчас: <span className="font-medium">{assignedNames}</span>
      </p>

      {isManager && (
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={saving || ["closed", "cancelled"].includes(request.status)}
          >
            <option value="">Выберите мастера</option>
            {executors.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.fullName}
                {ex.role ? ` — ${ROLE_LABELS[ex.role]}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedId || saving || ["closed", "cancelled"].includes(request.status)}
            onClick={() => void onAssign()}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md disabled:opacity-50"
          >
            {saving
              ? "..."
              : executors.find((e) => e.id === selectedId)?.role === "master"
                ? "Предложить"
                : "Назначить"}
          </button>
        </div>
      )}

      {canAccept && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void onAccept()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md disabled:opacity-50"
          >
            <MSym name="check_circle" className="text-[18px]" />
            Взять в работу
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setShowDecline(true)}
            className="flex items-center gap-2 px-4 py-2 border border-outline-variant rounded-lg font-label-md disabled:opacity-50"
          >
            Отказаться
          </button>
        </div>
      )}

      {canClaim && (
        <button
          type="button"
          onClick={() => setShowClaim(true)}
          className="mt-2 flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-primary rounded-lg font-label-md"
        >
          <MSym name="engineering" className="text-[18px]" />
          Взять в работу
        </button>
      )}

      {canDecline && !canAccept && (
        <button
          type="button"
          disabled={saving}
          onClick={() => setShowDecline(true)}
          className="mt-3 flex items-center gap-2 px-4 py-2 border border-outline-variant rounded-lg font-label-md disabled:opacity-50"
        >
          Отказаться от заявки
        </button>
      )}

      {isAccepted && fieldRole && (
        <p className="mt-3 text-body-sm text-primary flex items-center gap-2">
          <MSym name="check_circle" className="text-[18px]" />
          Вы назначены на эту заявку — маршрут появится в разделе «Карта»
        </p>
      )}

      {isProposed && partnerMaster && (
        <p className="mt-3 text-body-sm text-on-surface-variant">
          Вам предложена эта заявка. Примите её в работу или откажитесь.
        </p>
      )}

      <ConfirmModal
        open={showClaim}
        onClose={() => setShowClaim(false)}
        onConfirm={() => void onClaim()}
        title="Взять заявку в работу?"
        description={`Заявка ${request.number} будет добавлена в ваш маршрут.`}
        confirmLabel="Взять"
        loading={saving}
      />

      <ConfirmModal
        open={showDecline}
        onClose={() => setShowDecline(false)}
        onConfirm={() => void onDecline()}
        title="Отказаться от заявки?"
        description="Заявка вернётся в статус «Новая» и станет доступна для назначения другому мастеру."
        confirmLabel="Отказаться"
        loading={saving}
      />
    </section>
  );
}
