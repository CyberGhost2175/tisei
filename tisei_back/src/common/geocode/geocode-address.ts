import { env } from '../../config/env.js';

/** Центр Астаны — запасная точка */
export const ASTANA_CENTER = { latitude: 51.128207, longitude: 71.430411 };

/** База мастеров — старт маршрута */
export const DEPOT_ADDRESS = 'Жанкент 180/1, Астана, Казахстан';
export const DEPOT_CENTER = { latitude: 51.1332039, longitude: 71.4761833 };

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

function withRegion(address: string): string {
  const n = normalizeAddress(address);
  if (n.includes('астан') || n.includes('astana') || n.includes('нур-султан')) return address;
  if (n.includes('алмат') || n.includes('almaty')) return `${address}, Казахстан`;
  return `${address}, Астана, Казахстан`;
}

/** Только город без улицы — ставим центр Астаны */
function cityOnlyCoords(address: string): { latitude: number; longitude: number } | null {
  const n = normalizeAddress(address);
  const astanaOnly = /^(г\.?\s*)?(астана|astana|нур-?султан|nur-?sultan)(\s*,?\s*(казахстан|kazakhstan|қазақстан))?\.?$/i;
  if (astanaOnly.test(n)) return { ...ASTANA_CENTER };
  return null;
}

function getYandexGeocoderKey(): string | undefined {
  return env.YANDEX_GEOCODER_API_KEY ?? env.YANDEX_MAPS_API_KEY;
}

async function geocodeYandex(
  address: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const apiKey = getYandexGeocoderKey();
  if (!apiKey) return null;

  const query = withRegion(address);

  const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(query)}&format=json&results=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = (await res.json()) as {
      response?: {
        GeoObjectCollection?: {
          featureMember?: Array<{ GeoObject?: { Point?: { pos?: string } } }>;
        };
      };
    };

    const pos = json.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
    if (!pos) return null;

    const [lon, lat] = pos.split(' ').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { latitude: lat, longitude: lon };
  } catch {
    return null;
  }
}

async function geocode2Gis(
  address: string,
): Promise<{ latitude: number; longitude: number } | null> {
  if (!env.TWOGIS_API_KEY) return null;

  const query = `${address}, Астана`;
  const url = `https://catalog.api.2gis.com/3.0/items/geocode?q=${encodeURIComponent(query)}&key=${env.TWOGIS_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = (await res.json()) as {
      result?: { items?: Array<{ point?: { lat: number; lon: number } }> };
    };
    const point = json.result?.items?.[0]?.point;
    if (!point) return null;
    return { latitude: point.lat, longitude: point.lon };
  } catch {
    return null;
  }
}

async function geocodeNominatim(
  address: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const n = normalizeAddress(address);
  let query = address;
  if (!n.includes('астан') && !n.includes('astana') && !n.includes('алмат') && !n.includes('almaty')) {
    query = `${address}, Astana, Kazakhstan`;
  } else if (n.includes('алмат') || n.includes('almaty')) {
    query = `${address}, Kazakhstan`;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TiSei-CRM/1.0 (service routing)' },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as Array<{ lat: string; lon: string }>;
    const hit = json[0];
    if (!hit) return null;

    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { latitude: lat, longitude: lon };
  } catch {
    return null;
  }
}

/** Геокодирование: город → Yandex → 2GIS → OpenStreetMap */
export async function geocodeAddress(
  address: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = address?.trim();
  if (!trimmed) return null;

  const cityOnly = cityOnlyCoords(trimmed);
  if (cityOnly) return cityOnly;

  return (
    (await geocodeYandex(trimmed)) ??
    (await geocode2Gis(trimmed)) ??
    (await geocodeNominatim(trimmed))
  );
}
