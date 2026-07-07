import { apiFetch } from "./api";

export interface PartnerEstablishment {
  id: string;
  name: string;
  aliases: string[];
  isBuiltin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function fetchPartners(all = false) {
  const qs = all ? "?all=true" : "";
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
