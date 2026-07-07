import { apiFetch } from "./api";

export type ServiceEquipmentItem = {
  id: string;
  companyOrFullName: string;
  partnerEstablishmentId: string | null;
  partnerEstablishment?: { id: string; name: string } | null;
  equipmentCategoryId: string | null;
  equipmentCategory?: { id: string; name: string } | null;
  equipmentCategoryText: string | null;
  equipmentName: string | null;
  problemDescription: string | null;
  requestId: string | null;
  request?: { id: string; number: string } | null;
  status: "in_service" | "returned";
  receivedAt: string;
  returnedAt: string | null;
  notes: string | null;
};

export function fetchServiceEquipment(status?: "in_service" | "returned") {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<ServiceEquipmentItem[]>(`/service-equipment${qs}`);
}

export function createServiceEquipment(body: {
  companyOrFullName: string;
  partnerEstablishmentId?: string | null;
  equipmentCategoryId?: string;
  equipmentCategoryText?: string;
  equipmentName?: string;
  problemDescription?: string;
  requestId?: string;
  notes?: string;
}) {
  return apiFetch<ServiceEquipmentItem>(`/service-equipment`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateServiceEquipment(
  id: string,
  body: Partial<{
    companyOrFullName: string;
    partnerEstablishmentId: string | null;
    equipmentCategoryId: string;
    equipmentCategoryText: string;
    equipmentName: string;
    problemDescription: string;
    notes: string;
    status: "in_service" | "returned";
  }>,
) {
  return apiFetch<ServiceEquipmentItem>(`/service-equipment/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteServiceEquipment(id: string) {
  return apiFetch<{ message: string }>(`/service-equipment/${id}`, { method: "DELETE" });
}
