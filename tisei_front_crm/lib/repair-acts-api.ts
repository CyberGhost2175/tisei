import { apiFetch } from "./api";
import { getAccessToken } from "./auth-store";
import { API_URL } from "./types";

export type RepairActLocationRow = {
  locationId: string;
  locationName: string;
  city: string;
  address: string;
  requestCount: number;
  partsTotal: number;
  actReady: boolean;
  actNumber: number | null;
  actDate: string;
};

export type RepairActPartnerSummary = {
  id: string;
  name: string;
  priceIncludesVat: boolean;
  locationsTotal: number;
  locationsWithRepairs: number;
  requestCount: number;
  partsTotal: number;
  locations: RepairActLocationRow[];
};

export type RepairActsOverview = {
  period: string;
  actDate: string;
  rules: string[];
  partners: RepairActPartnerSummary[];
};

function periodQs(period?: string) {
  return period ? `?period=${encodeURIComponent(period)}` : "";
}

export function fetchRepairActsOverview(period?: string) {
  return apiFetch<RepairActsOverview>(`/repair-acts${periodQs(period)}`);
}

async function fetchRepairActResponse(locationId: string, period?: string) {
  const token = getAccessToken();
  const res = await fetch(
    `${API_URL}/repair-acts/locations/${locationId}/act.pdf${periodQs(period)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    },
  );
  if (!res.ok) {
    let message = "Не удалось получить акт";
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data.error?.message) message = data.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
  const filename = decodeURIComponent(match?.[1] || match?.[2] || "repair-act.pdf");
  const blob = await res.blob();
  return { blob, filename };
}

/** Скачать PDF на диск. */
export async function downloadRepairAct(locationId: string, period?: string) {
  const { blob, filename } = await fetchRepairActResponse(locationId, period);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

/** Получить blob URL для просмотра в iframe / новой вкладке. Вызывающий должен revoke. */
export async function loadRepairActPreview(locationId: string, period?: string) {
  const { blob, filename } = await fetchRepairActResponse(locationId, period);
  const url = URL.createObjectURL(blob);
  return { url, filename };
}

/** Открыть PDF во вкладке браузера (inline). */
export function openRepairActInBrowser(locationId: string, period?: string) {
  const token = getAccessToken();
  const qs = new URLSearchParams();
  if (period) qs.set("period", period);
  if (token) qs.set("access_token", token);
  const url = `${API_URL}/repair-acts/locations/${locationId}/act.pdf?${qs.toString()}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
