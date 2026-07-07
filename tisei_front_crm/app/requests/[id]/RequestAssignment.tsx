"use client";

import { useEffect, useState } from "react";
import { MSym } from "../../components/symbols";
import { ConfirmModal } from "../../components/Modal";
import { assignExecutors, claimRequest } from "@/lib/requests-api";
import { fetchExecutors } from "@/lib/users-api";
import { useAuth } from "@/lib/AuthProvider";
import type { ServiceRequest } from "@/lib/types";
import { ApiError } from "@/lib/api";

export function RequestAssignment({
  request,
  onUpdated,
}: {
  request: ServiceRequest;
  onUpdated: (r: ServiceRequest) => void;
}) {
  const { user } = useAuth();
  const [executors, setExecutors] = useState<Array<{ id: string; fullName: string }>>([]);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showClaim, setShowClaim] = useState(false);
  const [error, setError] = useState("");

  const isManager = user?.role === "admin" || user?.role === "manager";
  const isExecutor = user?.role === "executor";
  const assignedToMe = request.assignments?.some((a) => a.executorId === user?.id);
  const canClaim =
    isExecutor &&
    !assignedToMe &&
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

  const assignedNames =
    request.assignments?.map((a) => a.executor.fullName).join(", ") || "не назначены";

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
            <option value="">Выберите исполнителя</option>
            {executors.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.fullName}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedId || saving || ["closed", "cancelled"].includes(request.status)}
            onClick={() => void onAssign()}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md disabled:opacity-50"
          >
            {saving ? "..." : "Назначить"}
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

      {assignedToMe && isExecutor && (
        <p className="mt-3 text-body-sm text-primary flex items-center gap-2">
          <MSym name="check_circle" className="text-[18px]" />
          Вы назначены на эту заявку — маршрут появится в разделе «Карта»
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
    </section>
  );
}
