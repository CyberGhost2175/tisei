"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  downloadRepairAct,
  fetchRepairActsOverview,
  loadRepairActPreview,
  openRepairActInBrowser,
  type RepairActLocationRow,
  type RepairActPartnerSummary,
  type RepairActsOverview,
} from "@/lib/repair-acts-api";
import { ApiError } from "@/lib/api";
import { matchesSearch } from "@/lib/search-utils";
import { MSym } from "../components/symbols";

function currentPeriodValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatActDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

function PdfPreviewModal({
  open,
  title,
  url,
  loading,
  error,
  onClose,
  onDownload,
  onOpenTab,
}: {
  open: boolean;
  title: string;
  url: string | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onDownload: () => void;
  onOpenTab: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-inverse-surface/50 backdrop-blur-[2px] p-3 sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex flex-col flex-1 min-h-0 w-full max-w-6xl mx-auto bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-outline-variant shrink-0">
          <h2 className="font-headline-sm text-on-surface flex-1 min-w-0 truncate pr-2">{title}</h2>
          <button
            type="button"
            onClick={onOpenTab}
            disabled={!url}
            className="px-3 py-1.5 text-sm text-primary hover:underline disabled:opacity-40"
          >
            В новой вкладке
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-primary text-primary text-sm disabled:opacity-50"
          >
            Скачать
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant"
            aria-label="Закрыть"
          >
            <MSym name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="flex-1 min-h-0 bg-surface-container-low">
          {loading ? (
            <p className="p-8 text-center text-on-surface-variant">Формирование АВР…</p>
          ) : error ? (
            <p className="p-8 text-center text-error">{error}</p>
          ) : url ? (
            <iframe title={title} src={url} className="w-full h-full min-h-[70vh] border-0 bg-white" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function RepairActsTab({ searchQuery = "" }: { searchQuery?: string }) {
  const [period, setPeriod] = useState(currentPeriodValue);
  const [data, setData] = useState<RepairActsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [onlyWithRepairs, setOnlyWithRepairs] = useState(true);

  const [preview, setPreview] = useState<{
    locationId: string;
    title: string;
    url: string | null;
    filename: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const overview = await fetchRepairActsOverview(period);
      setData(overview);
      const firstWith = overview.partners.find((p) => p.locationsWithRepairs > 0);
      setExpandedId((prev) => prev ?? firstWith?.id ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  const partners = useMemo(() => {
    if (!data) return [];
    return data.partners
      .filter(
        (p) =>
          matchesSearch(searchQuery, p.name) ||
          p.locations.some(
            (l) =>
              matchesSearch(searchQuery, l.locationName) ||
              matchesSearch(searchQuery, l.address) ||
              matchesSearch(searchQuery, l.city),
          ),
      )
      .map((p) => ({
        ...p,
        locations: onlyWithRepairs ? p.locations.filter((l) => l.actReady) : p.locations,
      }))
      .filter((p) => (onlyWithRepairs ? p.locations.length > 0 : true));
  }, [data, searchQuery, onlyWithRepairs]);

  const closePreview = useCallback(() => {
    setPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setPreviewError("");
    setPreviewLoading(false);
  }, []);

  const onView = async (partner: RepairActPartnerSummary, loc: RepairActLocationRow) => {
    const title = `АВР · ${partner.name} ${loc.locationName}`;
    setPreviewError("");
    setPreviewLoading(true);
    setPreview({ locationId: loc.locationId, title, url: null, filename: "" });
    try {
      const { url, filename } = await loadRepairActPreview(loc.locationId, period);
      setPreview({ locationId: loc.locationId, title, url, filename });
      void load();
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Не удалось открыть акт");
    } finally {
      setPreviewLoading(false);
    }
  };

  const onDownload = async (locationId: string) => {
    setBusyId(locationId);
    setError("");
    try {
      await downloadRepairAct(locationId, period);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось скачать акт");
    } finally {
      setBusyId(null);
    }
  };

  const onDownloadAll = async (partner: RepairActPartnerSummary) => {
    const ready = partner.locations.filter((l) => l.actReady);
    if (ready.length === 0) return;
    setBusyId(partner.id);
    setError("");
    try {
      for (const loc of ready) {
        await downloadRepairAct(loc.locationId, period);
      }
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось скачать акты");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-outline-variant bg-surface-container-low/60 px-4 py-3 text-body-sm text-on-surface-variant">
        <p className="text-on-surface font-medium">Один АВР = одна точка</p>
        <p className="mt-1">
          В документ попадают только закрытые заявки ремонта этой точки (с 1-го по 22-е число месяца).
          Дата на бланке — всегда 22-е. Можно смотреть PDF сразу или скачать.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-body-sm">
          <span className="text-on-surface-variant">Период (месяц акта)</span>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-body-sm self-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyWithRepairs}
            onChange={(e) => setOnlyWithRepairs(e.target.checked)}
          />
          Только точки с ремонтом
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="px-4 py-2 rounded-lg bg-surface-container-low text-on-surface hover:text-primary text-sm"
        >
          Обновить
        </button>
        {data && (
          <p className="text-body-sm text-on-surface-variant self-center">
            Дата документа:{" "}
            <span className="text-on-surface font-medium">{formatActDate(data.actDate)}</span>
          </p>
        )}
      </div>

      {error && <p className="text-error text-body-sm">{error}</p>}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-on-surface-variant">Загрузка...</p>
        ) : partners.length === 0 ? (
          <p className="p-6 text-on-surface-variant">
            {searchQuery || onlyWithRepairs
              ? "Нет точек с закрытыми заявками ремонта за период до 22-го числа"
              : "Нет активных партнёров"}
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {partners.map((partner) => {
              const expanded = expandedId === partner.id;
              const readyCount = partner.locations.filter((l) => l.actReady).length;
              return (
                <li key={partner.id}>
                  <div className="px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : partner.id)}
                      className="text-left flex-1 min-w-[200px]"
                    >
                      <p className="font-medium text-on-surface">{partner.name}</p>
                      <p className="text-body-sm text-on-surface-variant mt-0.5">
                        АВР к формированию: {readyCount}
                        {" · "}заявок: {partner.requestCount}
                        {" · "}запчасти: {formatMoney(partner.partsTotal)} ₸
                        {partner.priceIncludesVat ? " (с НДС)" : " (без НДС)"}
                      </p>
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : partner.id)}
                        className="px-3 py-1.5 text-sm text-primary hover:underline"
                      >
                        {expanded ? "Скрыть точки" : "Точки"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === partner.id || readyCount === 0}
                        onClick={() => void onDownloadAll(partner)}
                        className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-sm disabled:opacity-50"
                      >
                        {busyId === partner.id ? "Скачивание…" : "Скачать все АВР"}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="px-4 pb-4">
                      <div className="rounded-lg border border-outline-variant overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-surface-container-low text-on-surface-variant text-left">
                            <tr>
                              <th className="px-3 py-2 font-medium">Точка (один АВР)</th>
                              <th className="px-3 py-2 font-medium">Адрес</th>
                              <th className="px-3 py-2 font-medium">Заявки</th>
                              <th className="px-3 py-2 font-medium">Сумма запчастей</th>
                              <th className="px-3 py-2 font-medium">№ акта</th>
                              <th className="px-3 py-2 font-medium text-right">Действия</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant">
                            {partner.locations.map((loc) => (
                              <tr
                                key={loc.locationId}
                                className={!loc.actReady ? "opacity-60" : undefined}
                              >
                                <td className="px-3 py-2">
                                  <span className="font-medium">
                                    {partner.name} {loc.locationName}
                                  </span>
                                  <span className="block text-xs text-on-surface-variant">
                                    {loc.city}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-on-surface-variant">{loc.address}</td>
                                <td className="px-3 py-2">{loc.requestCount}</td>
                                <td className="px-3 py-2">{formatMoney(loc.partsTotal)} ₸</td>
                                <td className="px-3 py-2">{loc.actNumber ?? "—"}</td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-wrap justify-end gap-3">
                                    <button
                                      type="button"
                                      disabled={!loc.actReady || previewLoading}
                                      onClick={() => void onView(partner, loc)}
                                      className="text-primary hover:underline disabled:opacity-40 disabled:no-underline font-medium"
                                    >
                                      Смотреть
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!loc.actReady || busyId === loc.locationId}
                                      onClick={() => openRepairActInBrowser(loc.locationId, period)}
                                      className="text-on-surface-variant hover:text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                                    >
                                      Вкладка
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!loc.actReady || busyId === loc.locationId}
                                      onClick={() => void onDownload(loc.locationId)}
                                      className="text-on-surface-variant hover:text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                                    >
                                      {busyId === loc.locationId ? "…" : "Скачать"}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <PdfPreviewModal
        open={!!preview}
        title={preview?.title ?? "АВР"}
        url={preview?.url ?? null}
        loading={previewLoading}
        error={previewError}
        onClose={closePreview}
        onDownload={() => {
          if (preview) void onDownload(preview.locationId);
        }}
        onOpenTab={() => {
          if (preview) openRepairActInBrowser(preview.locationId, period);
        }}
      />
    </div>
  );
}
