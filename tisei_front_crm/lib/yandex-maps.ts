const YANDEX_SCRIPT_ID = "yandex-maps-script";

export function getYandexMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";
}

export function loadYandexMaps(): Promise<YMapsNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Yandex Maps only in browser"));
  }

  const w = window as Window & { ymaps?: YMapsNamespace };
  if (w.ymaps) {
    return new Promise((resolve) => w.ymaps!.ready(() => resolve(w.ymaps!)));
  }

  const existing = document.getElementById(YANDEX_SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => {
        if (w.ymaps) w.ymaps.ready(() => resolve(w.ymaps!));
        else reject(new Error("ymaps missing"));
      });
      existing.addEventListener("error", () => reject(new Error("Yandex Maps load error")));
    });
  }

  const key = getYandexMapsApiKey();
  if (!key) return Promise.reject(new Error("NEXT_PUBLIC_YANDEX_MAPS_API_KEY не задан"));

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = YANDEX_SCRIPT_ID;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      if (!w.ymaps) {
        reject(new Error("ymaps missing"));
        return;
      }
      w.ymaps.ready(() => resolve(w.ymaps!));
    };
    script.onerror = () => reject(new Error("Не удалось загрузить Yandex Maps"));
    document.head.appendChild(script);
  });
}

/** Минимальные типы Yandex Maps 2.1 */
export interface YMapsNamespace {
  ready: (cb: () => void) => void;
  Map: new (
    element: HTMLElement | string,
    state: { center: number[]; zoom: number; controls?: string[] },
    options?: Record<string, unknown>,
  ) => YMap;
  Placemark: new (
    coords: number[],
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YGeoObject;
  multiRouter: {
    MultiRoute: new (
      model: { referencePoints: number[][]; params?: Record<string, unknown> },
      options?: Record<string, unknown>,
    ) => YGeoObject;
  };
}

export interface YGeoObject {
  events: { add: (event: string, cb: () => void) => void };
}

export interface YMap {
  geoObjects: {
    add: (obj: YGeoObject) => void;
    removeAll: () => void;
  };
  setBounds: (bounds: number[][], options?: Record<string, unknown>) => void;
  setCenter: (center: number[], zoom?: number) => void;
  destroy: () => void;
}

export const DEPOT_CENTER: [number, number] = [51.1332039, 71.4761833];
export const ASTANA_CENTER: [number, number] = [51.128207, 71.430411];
