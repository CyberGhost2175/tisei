import { apiFetch } from "./api";

export interface PartnerLocation {
  id: string;
  partnerEstablishmentId: string;
  name: string;
  city: string;
  address: string;
  equipmentQuantity: number | null;
  maintenancePrice: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerEstablishment {
  id: string;
  name: string;
  aliases: string[];
  isBuiltin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  locations?: PartnerLocation[];
  locationsCount?: number;
}

export function fetchPartners(all = false, includeLocations = false) {
  const params = new URLSearchParams();
  if (all) params.set("all", "true");
  if (includeLocations) params.set("locations", "true");
  const qs = params.toString() ? `?${params}` : "";
  return apiFetch<PartnerEstablishment[]>(`/partners${qs}`);
}

export function createPartner(body: { name: string; aliases: string[] }) {
  return apiFetch<PartnerEstablishment>("/partners", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updatePartner(
  id: string,
  body: Partial<{ name: string; aliases: string[]; isActive: boolean }>,
) {
  return apiFetch<PartnerEstablishment>(`/partners/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deletePartner(id: string) {
  return apiFetch<{ message: string }>(`/partners/${id}`, { method: "DELETE" });
}

export function createPartnerLocation(
  partnerId: string,
  body: {
    name: string;
    city?: string;
    address: string;
    equipmentQuantity?: number | null;
    maintenancePrice?: number | null;
  },
) {
  return apiFetch<PartnerLocation>(`/partners/${partnerId}/locations`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updatePartnerLocation(
  partnerId: string,
  locationId: string,
  body: Partial<{
    name: string;
    city: string;
    address: string;
    equipmentQuantity: number | null;
    maintenancePrice: number | null;
    isActive: boolean;
  }>,
) {
  return apiFetch<PartnerLocation>(`/partners/${partnerId}/locations/${locationId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deletePartnerLocation(partnerId: string, locationId: string) {
  return apiFetch<{ message: string }>(`/partners/${partnerId}/locations/${locationId}`, {
    method: "DELETE",
  });
}
