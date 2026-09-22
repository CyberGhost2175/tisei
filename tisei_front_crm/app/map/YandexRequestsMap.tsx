"use client";

import { useEffect, useRef } from "react";
import type { MapRequestPoint, RouteDepot } from "@/lib/types";
import { masterMapColor } from "@/lib/map-master-colors";
import { DEPOT_CENTER, loadYandexMaps, type YMap } from "@/lib/yandex-maps";

const STATUS_COLORS: Record<string, string> = {
  new: "#1565c0",
  in_progress: "#2e7d32",
  awaiting_parts: "#ef6c00",
  frozen: "#757575",
  in_service: "#6a1b9a",
  awaiting_approval: "#00838f",
  repeat: "#ad1457",
  closed: "#9e9e9e",
  cancelled: "#bdbdbd",
};

const PARTNER_COLOR = "#4fc3f7";

export function YandexRequestsMap({
  points,
  depot,
  selectedIds,
  focusedId,
  onTogglePoint,
  colorByExecutor = false,
  executorIndex,
}: {
  points: MapRequestPoint[];
  depot?: RouteDepot;
  selectedIds: string[];
  focusedId: string | null;
  onTogglePoint?: (requestId: string) => void;
  colorByExecutor?: boolean;
  executorIndex?: Map<string, number>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YMap | null>(null);
  const onToggleRef = useRef(onTogglePoint);
  onToggleRef.current = onTogglePoint;

  const depotLat = depot?.latitude ?? DEPOT_CENTER[0];
  const depotLon = depot?.longitude ?? DEPOT_CENTER[1];
  const depotAddress = depot?.address ?? "Жанкент 180/1";

  const dataRef = useRef({
    points,
    depotLat,
    depotLon,
    depotAddress,
    selectedIds,
    focusedId,
    colorByExecutor,
    executorIndex,
  });
  dataRef.current = {
    points,
    depotLat,
    depotLon,
    depotAddress,
    selectedIds,
    focusedId,
    colorByExecutor,
    executorIndex,
  };

  const mapStateKey = [
    points
      .map(
        (p) =>
          `${p.requestId}:${p.latitude}:${p.longitude}:${p.status}:${p.phone}:${p.executors.map((e) => e.id).join(",")}`,
      )
      .join("|"),
    depotLat,
    depotLon,
    selectedIds.join(","),
    focusedId ?? "",
    colorByExecutor ? "exec" : "status",
    executorIndex ? [...executorIndex.entries()].join("|") : "",
  ].join("::");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    const {
      points: pts,
      depotLat: lat,
      depotLon: lon,
      depotAddress: address,
      selectedIds: selected,
      focusedId: focused,
      colorByExecutor: byExec,
      executorIndex: execIdx,
    } = dataRef.current;
    const selectedLookup = new Set(selected);
    const depotCoords: [number, number] = [lat, lon];
    const index = execIdx ?? new Map<string, number>();

    void loadYandexMaps()
      .then((ymaps) => {
        if (cancelled) return;

        if (mapRef.current) {
          mapRef.current.destroy();
          mapRef.current = null;
        }

        const map = new ymaps.Map(
          el,
          {
            center: depotCoords,
            zoom: pts.length === 0 ? 12 : 11,
            controls: ["zoomControl", "fullscreenControl", "geolocationControl"],
          },
          { suppressMapOpenBlock: true },
        );
        mapRef.current = map;
        map.geoObjects.removeAll();

        const depotMark = new ymaps.Placemark(
          depotCoords,
          {
            balloonContentHeader: "<strong>База</strong>",
            balloonContentBody: address,
            hintContent: "База мастеров",
          },
          { preset: "islands#greenHomeIcon", iconColor: "#2e7d32" },
        );
        map.geoObjects.add(depotMark);

        pts.forEach((p) => {
          const isSelected = selectedLookup.has(p.requestId);
          const isFocused = focused === p.requestId;
          const executor = p.executors[0];
          const executorName = p.executors.map((e) => e.fullName).join(", ") || "Не назначен";
          // Режим «по мастеру» важнее партнёрского цвета — иначе не видно, кому точка.
          const color = byExec
            ? masterMapColor(executor?.id, index)
            : p.isPartner
              ? PARTNER_COLOR
              : (STATUS_COLORS[p.status] ?? "#00626a");

          const caption = byExec
            ? `${executor?.fullName?.split(/\s+/)[0] ?? "?"} · ${p.number.replace(/^TiSei-\d{6}-/, "")}`
            : p.number.replace(/^TiSei-\d{6}-/, "");

          const placemark = new ymaps.Placemark(
            [p.latitude, p.longitude],
            {
              balloonContentHeader: `<strong>${p.number}</strong>${p.isPartner ? " · Партнёр" : ""}${isSelected ? " · выбрана" : ""}`,
              balloonContentBody: `<div style="max-width:280px;line-height:1.45;font-size:13px">
                <div><b>Место / компания</b><br/>${p.companyOrFullName}</div>
                <div style="margin-top:6px"><b>Адрес</b><br/>${p.address || "—"}</div>
                <div style="margin-top:6px"><b>Телефон</b><br/>${p.phone || "—"}</div>
                <div style="margin-top:6px;color:#666">Мастер: ${executorName}</div>
              </div>`,
              hintContent: `${p.number} · ${executorName}`,
              iconCaption: caption,
            },
            {
              preset: isFocused
                ? "islands#redCircleDotIconWithCaption"
                : isSelected
                  ? "islands#darkGreenCircleDotIconWithCaption"
                  : "islands#circleDotIconWithCaption",
              iconColor: isFocused ? "#ba1a1a" : isSelected ? "#1b5e20" : color,
              iconCaptionMaxWidth: 140,
              openBalloonOnClick: true,
            },
          );
          placemark.events.add("click", () => {
            onToggleRef.current?.(p.requestId);
            try {
              placemark.balloon?.open();
            } catch {
              /* balloon may already be open */
            }
          });
          map.geoObjects.add(placemark);

          if (isFocused) {
            try {
              placemark.balloon?.open();
            } catch {
              /* ignore */
            }
          }
        });

        if (pts.length > 0) {
          const bounds = pts.reduce(
            (acc, p) => {
              acc[0] = Math.min(acc[0], p.latitude);
              acc[1] = Math.min(acc[1], p.longitude);
              acc[2] = Math.max(acc[2], p.latitude);
              acc[3] = Math.max(acc[3], p.longitude);
              return acc;
            },
            [depotLat, depotLon, depotLat, depotLon],
          );
          map.setBounds(
            [
              [bounds[0], bounds[1]],
              [bounds[2], bounds[3]],
            ],
            { checkZoomRange: true, zoomMargin: 40 },
          );
        }
      })
      .catch(() => {
        /* ошибка показывается в родителе */
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [mapStateKey, depotLat, depotLon]);

  return (
    <div className="relative w-full h-full min-h-[360px] md:min-h-0 rounded-2xl overflow-hidden border border-outline-variant shadow-inner bg-surface-container-low">
      <div ref={containerRef} className="absolute inset-0" />
      {points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant text-body-sm p-6 text-center bg-surface-container-lowest/80 pointer-events-none">
          Нет заявок с координатами по выбранным фильтрам
        </div>
      )}
    </div>
  );
}
