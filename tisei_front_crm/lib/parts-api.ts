import { apiFetch } from "./api";

export type PartSection = "SERVICE" | "KFC";

export type Part = {
  id: string;
  name: string;
  section: PartSection;
  quantity: number;
  unitPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PartsSpendingPeriod = "day" | "week" | "month" | "quarter";

export type PartsSpending = {
  period: PartsSpendingPeriod;
  from: string;
  to: string;
  totalSpent: number;
  usageCount: number;
  section?: PartSection | null;
};

export type RequestPartUsage = {
  id: string;
  requestId: string;
  partId: string | null;
  partNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  lineTotal: number;
  addedById: string | null;
  createdAt: string;
  addedBy?: { id: string; fullName: string } | null;
};

export const PART_SECTION_LABELS: Record<PartSection, string> = {
  SERVICE: "СЕРВИС",
  KFC: "KFC",
};

export function fetchParts(activeOnly = false, section?: PartSection) {
  const params = new URLSearchParams();
  if (activeOnly) params.set("activeOnly", "true");
  if (section) params.set("section", section);
  const qs = params.toString() ? `?${params}` : "";
  return apiFetch<Part[]>(`/parts${qs}`);
}

export function fetchPartsSpending(period: PartsSpendingPeriod, section?: PartSection) {
  const params = new URLSearchParams({ period });
  if (section) params.set("section", section);
  return apiFetch<PartsSpending>(`/parts/spending?${params}`);
}

export function createPart(body: {
  name: string;
  section: PartSection;
  quantity?: number;
  unitPrice: number;
}) {
  return apiFetch<Part>("/parts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updatePart(
  id: string,
  body: Partial<{ name: string; section: PartSection; quantity: number; unitPrice: number }>,
) {
  return apiFetch<Part>(`/parts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function bulkSetPartQuantity(body: { section: "SERVICE"; quantity: number }) {
  return apiFetch<{ updated: number; section: PartSection; quantity: number }>(
    "/parts/bulk-quantity",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function deletePart(id: string) {
  return apiFetch<{ message: string }>(`/parts/${id}`, { method: "DELETE" });
}

export function fetchRequestPartUsages(requestId: string) {
  return apiFetch<RequestPartUsage[]>(`/requests/${requestId}/part-usages`);
}

export function addRequestPartUsage(requestId: string, body: { partId: string; quantity: number }) {
  return apiFetch<RequestPartUsage>(`/requests/${requestId}/part-usages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteRequestPartUsage(requestId: string, usageId: string) {
  return apiFetch<{ message: string }>(`/requests/${requestId}/part-usages/${usageId}`, {
    method: "DELETE",
  });
}
