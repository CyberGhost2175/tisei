"use client";

import { useEffect, useRef } from "react";
import type { RouteDepot, RoutePoint } from "@/lib/types";
import { DEPOT_CENTER, loadYandexMaps, type YMap } from "@/lib/yandex-maps";

export function YandexRouteMap({
  points,
  depot,
  activeIndex,
  onSelectPoint,
}: {
  points: RoutePoint[];
  depot?: RouteDepot;
  activeIndex: number | null;
  onSelectPoint?: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YMap | null>(null);
  const onSelectPointRef = useRef(onSelectPoint);
  onSelectPointRef.current = onSelectPoint;

  const depotLat = depot?.latitude ?? DEPOT_CENTER[0];
  const depotLon = depot?.longitude ?? DEPOT_CENTER[1];
  const depotAddress = depot?.address ?? "Жанкент 180/1";

  const dataRef = useRef({
    points,
    depotLat,
    depotLon,
    depotAddress,
    activeIndex,
  });
  dataRef.current = { points, depotLat, depotLon, depotAddress, activeIndex };

  // Одна строка — размер массива зависимостей всегда 1, React не ругается
  const mapStateKey = [
    points.map((p) => `${p.requestId}:${p.latitude}:${p.longitude}:${p.isPartner}`).join("|"),
    depotLat,
    depotLon,
    depotAddress,
    activeIndex ?? "",
  ].join("::");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    const { points: pts, depotLat: lat, depotLon: lon, depotAddress: address, activeIndex: active } =
      dataRef.current;
    const depotCoords: [number, number] = [lat, lon];

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
            hintContent: "Старт · база мастеров",
          },
          {
            preset: "islands#greenHomeIcon",
            iconColor: "#2e7d32",
          },
        );
        map.geoObjects.add(depotMark);

        if (pts.length === 0) return;

        const routePoints: [number, number][] = [
          depotCoords,
          ...pts.map((p) => [p.latitude, p.longitude] as [number, number]),
        ];

        pts.forEach((p, i) => {
          const isActive = active === i;
          const isPartner = p.isPartner;
          const placemark = new ymaps.Placemark(
            [p.latitude, p.longitude],
            {
              balloonContentHeader: `<strong>#${i + 1} · ${p.number}</strong>${isPartner ? " · Партнёр" : ""}`,
              balloonContentBody: `<div style="max-width:240px"><b>${p.companyOrFullName}</b><br/>${p.address || "—"}</div>`,
              hintContent: `#${i + 1} ${p.companyOrFullName}`,
            },
            {
              preset: isActive
                ? "islands#redCircleDotIconWithCaption"
                : isPartner
                  ? "islands#orangeCircleDotIconWithCaption"
                  : "islands#blueCircleDotIconWithCaption",
              iconColor: isActive ? "#ba1a1a" : isPartner ? "#e65100" : "#00626a",
              iconCaption: String(i + 1),
            },
          );
          placemark.events.add("click", () => onSelectPointRef.current?.(i));
          map.geoObjects.add(placemark);
        });

        if (routePoints.length > 1) {
          const multiRoute = new ymaps.multiRouter.MultiRoute(
            {
              referencePoints: routePoints,
              params: { routingMode: "auto", results: 1 },
            },
            {
              boundsAutoApply: true,
              wayPointVisible: false,
              pinVisible: false,
              routeActiveStrokeWidth: 5,
              routeActiveStrokeColor: "#00626a",
            },
          );
          map.geoObjects.add(multiRoute);
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
  }, [mapStateKey]);

  return (
    <div className="relative w-full h-full min-h-[360px] md:min-h-0 rounded-2xl overflow-hidden border border-outline-variant shadow-inner bg-surface-container-low">
      <div ref={containerRef} className="absolute inset-0" />
      {points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant text-body-sm p-6 text-center bg-surface-container-lowest/80 pointer-events-none">
          Нет точек с координатами. Возьмите заявки с адресом в Астане.
        </div>
      )}
    </div>
  );
}
