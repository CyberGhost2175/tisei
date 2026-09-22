"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { MSym } from "../../components/symbols";
import { ConfirmModal } from "../../components/Modal";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { ApiError } from "@/lib/api";
import { STATUS_LABELS, formatDate } from "@/lib/labels";
import type { RequestStatus } from "@/lib/types";
import {
  closeAllMaintenance,
  closeMaintenanceRequest,
  downloadMaintenanceAct,
  fetchMaintenancePartner,
  transferMaintenanceToRepair,
  updateMaintenanceFindings,
  updateMaintenancePeriod,
  type MaintenanceLocationRow,
  type MaintenancePartnerDetail,
} from "@/lib/maintenance-api";

function toDateInput(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function LocationCard({
  row,
  onChanged,
}: {
  row: MaintenanceLocationRow;
  onChanged: () => void;
}) {
  const req = row.request;
  const [findings, setFindings] = useState(req?.findings ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);

  useEffect(() => {
    setFindings(req?.findings ?? "");
  }, [req?.findings, req?.id]);

  if (!req) {
    return (
      <div className="p-3 rounded-lg border border-dashed border-outline-variant text-body-sm text-on-surface-variant">
        <p className="font-medium text-on-surface">{row.locationName}</p>
        <p className="mt-0.5">{row.address}</p>
        {(row.equipmentQuantity != null || row.maintenancePrice != null) && (
          <p className="mt-0.5">
            {row.equipmentQuantity != null ? `Техника: ${row.equipmentQuantity} шт.` : ""}
            {row.equipmentQuantity != null && row.maintenancePrice != null ? " · " : ""}
            {row.maintenancePrice != null
              ? `ТО: ${row.maintenancePrice.toLocaleString("ru-RU")} ₸`
              : ""}
          </p>
        )}
        <p className="mt-1">Заявка ТО ещё не создана</p>
      </div>
    );
  }

  const closed = req.status === "closed";

  const saveFindings = async () => {
    setBusy(true);
    setError("");
    try {
      await updateMaintenanceFindings(req.id, findings);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const onClose = async () => {
    setBusy(true);
    setError("");
    try {
      await closeMaintenanceRequest(req.id, findings);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось закрыть");
    } finally {
      setBusy(false);
    }
  };

  const onTransfer = async () => {
    if (!findings.trim()) {
      setError("Укажите поломку для перевода на ремонт");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await transferMaintenanceToRepair(req.id, { findings: findings.trim() });
      setShowTransfer(false);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось перевести");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 rounded-lg border border-outline-variant bg-surface-container-lowest space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{row.locationName}</p>
          <p className="text-body-sm text-on-surface-variant">{row.address}</p>
          {(row.equipmentQuantity != null || row.maintenancePrice != null) && (
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              {row.equipmentQuantity != null ? `Техника: ${row.equipmentQuantity} шт.` : null}
              {row.equipmentQuantity != null && row.maintenancePrice != null ? " · " : null}
              {row.maintenancePrice != null
                ? `ТО: ${row.maintenancePrice.toLocaleString("ru-RU")} ₸`
                : null}
            </p>
          )}
          <p className="text-[11px] text-outline mt-1">
            <Link href={`/requests/${req.id}`} className="text-primary hover:underline">
              {req.number}
            </Link>
            {" · "}
            {STATUS_LABELS[req.status as RequestStatus] ?? req.status}
            {req.closedAt ? ` · закрыто ${formatDate(req.closedAt)}` : ""}
          </p>
        </div>
        {closed ? (
          <span className="text-[11px] uppercase px-2 py-1 rounded bg-primary/15 text-primary shrink-0">
            Закрыто
          </span>
        ) : (
          <span className="text-[11px] uppercase px-2 py-1 rounded bg-tertiary-container/40 text-on-surface shrink-0">
            Открыто
          </span>
        )}
      </div>

      {req.transferredRepairs.length > 0 && (
        <p className="text-body-sm text-on-surface-variant">
          Ремонт:{" "}
          {req.transferredRepairs.map((r, i) => (
            <span key={r.id}>
              {i > 0 ? ", " : ""}
              <Link href={`/requests/${r.id}`} className="text-primary hover:underline">
                {r.number}
              </Link>
              <span className="ml-1 text-[10px] uppercase text-primary">С обслуживания</span>
            </span>
          ))}
        </p>
      )}

      {!closed && (
        <>
          <textarea
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-body-sm min-h-[72px]"
            placeholder="Замечания / поломки (если есть)..."
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            disabled={busy}
          />
          {error && <p className="text-error text-body-sm">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveFindings()}
              className="px-3 py-1.5 rounded-lg border border-outline-variant text-body-sm disabled:opacity-50"
            >
              Сохранить замечания
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onClose()}
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-body-sm disabled:opacity-50"
            >
              Закрыть ТО
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowTransfer((v) => !v)}
              className="px-3 py-1.5 rounded-lg border border-error/40 text-error text-body-sm disabled:opacity-50"
            >
              На ремонт
            </button>
          </div>
          {showTransfer && (
            <div className="p-3 rounded-lg bg-error-container/20 border border-error/20 space-y-2">
              <p className="text-body-sm">
                Будет создана обычная заявка с пометкой «С обслуживания». Укажите поломку выше.
              </p>
              <button
                type="button"
                disabled={busy || !findings.trim()}
                onClick={() => void onTransfer()}
                className="px-3 py-1.5 rounded-lg bg-error text-on-error text-body-sm disabled:opacity-50"
              >
                Перевести на ремонт
              </button>
            </div>
          )}
        </>
      )}

      {closed && req.findings && (
        <p className="text-body-sm text-on-surface-variant">Замечания: {req.findings}</p>
      )}
    </div>
  );
}

export default function MaintenancePartnerPage() {
  useRequireAuth();
  const { user } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const partnerId = String(params.partnerId);
  const period = searchParams.get("period") || undefined;
  const canEditDates = user?.role === "admin" || user?.role === "manager";

  const [data, setData] = useState<MaintenancePartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closeBy, setCloseBy] = useState("");
  const [actDate, setActDate] = useState("");
  const [savingDates, setSavingDates] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmCloseAll, setConfirmCloseAll] = useState(false);
  const [closingAll, setClosingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const detail = await fetchMaintenancePartner(partnerId, period);
      setData(detail);
      setCloseBy(toDateInput(detail.setting.closeByDate));
      setActDate(toDateInput(detail.setting.actDate));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [partnerId, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDates = async () => {
    if (!data) return;
    setSavingDates(true);
    setError("");
    try {
      await updateMaintenancePeriod(partnerId, data.period, {
        closeByDate: new Date(`${closeBy}T23:59:59`).toISOString(),
        actDate: new Date(`${actDate}T12:00:00`).toISOString(),
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить даты");
    } finally {
      setSavingDates(false);
    }
  };

  const onDownloadAct = async () => {
    if (!data) return;
    setDownloading(true);
    setError("");
    try {
      await downloadMaintenanceAct(partnerId, data.period);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось скачать акт");
    } finally {
      setDownloading(false);
    }
  };

  const onCloseAll = async () => {
    if (!data) return;
    setClosingAll(true);
    setError("");
    try {
      await closeAllMaintenance(partnerId, data.period);
      setConfirmCloseAll(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось закрыть все точки");
    } finally {
      setClosingAll(false);
    }
  };

  return (
    <AppShell
      active="maintenance"
      mobileActive="tasks"
      searchPlaceholder="Поиск..."
      searchEnabled={false}
      mainClassName="p-container-margin pb-24 md:pb-8"
    >
      <div className="max-w-5xl mx-auto">
        <Link
          href={`/maintenance${period ? `?period=${period}` : ""}`}
          className="inline-flex items-center gap-1 text-body-sm text-primary hover:underline mb-4"
        >
          <MSym name="arrow_back" className="text-[16px]" />
          Все партнёры
        </Link>

        {loading && !data ? (
          <p className="text-on-surface-variant">Загрузка...</p>
        ) : !data ? (
          <p className="text-error">{error || "Не найдено"}</p>
        ) : (
          <>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="font-headline-md text-headline-md text-primary">{data.partner.name}</h1>
                <p className="text-body-md text-on-surface-variant mt-1">
                  Плановое ТО · {data.periodLabel}
                </p>
              </div>
              <div className="text-body-sm text-on-surface-variant">
                Закрыто{" "}
                <span className="font-medium text-primary">{data.stats.closedCount}</span> /{" "}
                {data.stats.locationsTotal}
              </div>
            </div>

            <div className="mb-6 p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
              <p className="font-label-md text-primary uppercase flex items-center gap-2">
                <MSym name="schedule" className="text-[18px]" />
                Срок для мастера
              </p>
              <p className="text-body-sm">{data.deadlineHint}</p>
              <p className="text-body-sm text-on-surface-variant">
                Закрыть до: <span className="font-medium text-on-surface">{formatDate(data.setting.closeByDate)}</span>
                {" · "}
                Дата акта: <span className="font-medium text-on-surface">{formatDate(data.setting.actDate)}</span>
              </p>

              {canEditDates && (
                <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-primary/20">
                  <label className="text-body-sm">
                    Дата закрытия
                    <input
                      type="date"
                      className="block mt-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2"
                      value={closeBy}
                      onChange={(e) => setCloseBy(e.target.value)}
                    />
                  </label>
                  <label className="text-body-sm">
                    Дата акта
                    <input
                      type="date"
                      className="block mt-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2"
                      value={actDate}
                      onChange={(e) => setActDate(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingDates}
                    onClick={() => void saveDates()}
                    className="px-4 py-2 rounded-lg border border-outline-variant text-body-sm disabled:opacity-50"
                  >
                    {savingDates ? "..." : "Сохранить даты"}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {data.stats.openCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmCloseAll(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-body-sm"
                  >
                    <MSym name="done_all" className="text-[18px]" />
                    Закрыть все ({data.stats.openCount})
                  </button>
                )}
                {data.stats.actReady && (
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={() => void onDownloadAct()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary text-primary text-body-sm disabled:opacity-50"
                  >
                    <MSym name="download" className="text-[18px]" />
                    {downloading ? "Формирование..." : "Скачать акт выполненных работ"}
                  </button>
                )}
              </div>
            </div>

            {error && <p className="text-error text-body-sm mb-4">{error}</p>}

            <div className="space-y-6">
              {data.cities.map((city) => (
                <section key={city.city}>
                  <h2 className="font-label-md text-outline uppercase mb-3">{city.city}</h2>
                  <div className="grid gap-3">
                    {city.locations.map((loc) => (
                      <LocationCard key={loc.locationId} row={loc} onChanged={() => void load()} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <ConfirmModal
              open={confirmCloseAll}
              onClose={() => setConfirmCloseAll(false)}
              onConfirm={() => void onCloseAll()}
              title="Закрыть все точки?"
              description={`Будут закрыты все открытые заявки ТО по «${data.partner.name}» за ${data.periodLabel} (${data.stats.openCount} шт.).`}
              confirmLabel="Закрыть все"
              loading={closingAll}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
