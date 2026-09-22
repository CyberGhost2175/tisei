import { apiFetch } from "./api";
import { getAccessToken } from "./auth-store";
import { API_URL } from "./types";

export type MaintenancePartnerSummary = {
  id: string;
  name: string;
  maintenanceCloseDay: number;
  closeByDate: string;
  actDate: string;
  actNumber: number | null;
  unitPrice: number;
  locationsTotal: number;
  requestsTotal: number;
  closedCount: number;
  openCount: number;
  allClosed: boolean;
  actReady: boolean;
  deadlineHint: string;
};

export type MaintenanceOverview = {
  period: string;
  periodLabel: string;
  rules: string[];
  partners: MaintenancePartnerSummary[];
};

export type MaintenanceLocationRow = {
  locationId: string;
  locationName: string;
  address: string;
  equipmentQuantity: number | null;
  maintenancePrice: number | null;
  request: null | {
    id: string;
    number: string;
    status: string;
    findings: string | null;
    deadline: string | null;
    closedAt: string | null;
    transferredRepairs: Array<{ id: string; number: string; status: string }>;
  };
};

export type MaintenancePartnerDetail = {
  period: string;
  periodLabel: string;
  partner: {
    id: string;
    name: string;
    maintenanceCloseDay: number;
    unitPrice: number;
    priceIncludesVat?: boolean;
    customerName: string | null;
    customerBin: string | null;
    customerAddress: string | null;
    contractNumber: string | null;
    contractDate: string | null;
    executorName: string | null;
    executorBin: string | null;
    executorAddress: string | null;
  };
  setting: {
    closeByDate: string;
    actDate: string;
    actNumber: number | null;
  };
  deadlineHint: string;
  stats: {
    locationsTotal: number;
    closedCount: number;
    openCount: number;
    allClosed: boolean;
    actReady: boolean;
  };
  cities: Array<{ city: string; locations: MaintenanceLocationRow[] }>;
};

function periodQs(period?: string) {
  return period ? `?period=${encodeURIComponent(period)}` : "";
}

export function fetchMaintenanceOverview(period?: string) {
  return apiFetch<MaintenanceOverview>(`/maintenance${periodQs(period)}`);
}

export function fetchMaintenancePartner(partnerId: string, period?: string) {
  return apiFetch<MaintenancePartnerDetail>(
    `/maintenance/partners/${partnerId}${periodQs(period)}`,
  );
}

export function updateMaintenancePeriod(
  partnerId: string,
  period: string,
  body: { closeByDate?: string; actDate?: string | null; actNumber?: number | null },
) {
  return apiFetch<{ closeByDate: string; actDate: string; actNumber: number | null }>(
    `/maintenance/partners/${partnerId}/period?period=${encodeURIComponent(period)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function updateMaintenanceFindings(requestId: string, findings: string) {
  return apiFetch<{ id: string; findings: string | null }>(
    `/maintenance/requests/${requestId}/findings`,
    { method: "PATCH", body: JSON.stringify({ findings }) },
  );
}

export function closeMaintenanceRequest(requestId: string, findings?: string) {
  return apiFetch<{ id: string; status: string; closedAt: string | null }>(
    `/maintenance/requests/${requestId}/close`,
    { method: "POST", body: JSON.stringify({ findings }) },
  );
}

export function closeAllMaintenance(partnerId: string, period?: string) {
  return apiFetch<{ period: string; closed: number; message?: string }>(
    `/maintenance/partners/${partnerId}/close-all${periodQs(period)}`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function transferMaintenanceToRepair(
  requestId: string,
  body: { findings: string; problemDescription?: string },
) {
  return apiFetch<{ id: string; number: string; fromMaintenance: boolean; label: string }>(
    `/maintenance/requests/${requestId}/transfer-to-repair`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function downloadMaintenanceAct(partnerId: string, period?: string) {
  const token = getAccessToken();
  const res = await fetch(
    `${API_URL}/maintenance/partners/${partnerId}/act.pdf${periodQs(period)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    },
  );
  if (!res.ok) {
    let message = "Не удалось скачать акт";
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
  const filename = decodeURIComponent(match?.[1] || match?.[2] || "act.pdf");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
