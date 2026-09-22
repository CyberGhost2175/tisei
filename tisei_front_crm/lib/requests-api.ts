import { apiFetch, apiUpload } from "./api";
import type {
  AnalyticsReport,
  Attachment,
  ClosingFormData,
  Comment,
  CreateRequestPayload,
  DashboardKpi,
  MapOverview,
  OptimizedRoute,
  Paginated,
  ServiceRequest,
} from "./types";

export function fetchRequests(params: Record<string, string | number | boolean | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const q = qs.toString();
  return apiFetch<Paginated<ServiceRequest>>(`/requests${q ? `?${q}` : ""}`);
}

export function fetchRequest(id: string) {
  return apiFetch<ServiceRequest>(`/requests/${id}`);
}

export function updateRequest(id: string, body: Partial<CreateRequestPayload>) {
  return apiFetch<ServiceRequest>(`/requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function changeRequestStatus(
  id: string,
  status: string,
  options?: { frozenReason?: string; equipmentCategoryId?: string },
) {
  return apiFetch<ServiceRequest>(`/requests/${id}/status`, {
    method: "POST",
    body: JSON.stringify({
      status,
      frozenReason: options?.frozenReason,
      equipmentCategoryId: options?.equipmentCategoryId,
    }),
  });
}

export function assignExecutors(requestId: string, executorIds: string[]) {
  return apiFetch<ServiceRequest>(`/requests/${requestId}/assign`, {
    method: "POST",
    body: JSON.stringify({ executorIds }),
  });
}

export function claimRequest(requestId: string) {
  return apiFetch<ServiceRequest>(`/requests/${requestId}/claim`, { method: "POST" });
}

export function acceptRequestOffer(requestId: string) {
  return apiFetch<ServiceRequest>(`/requests/${requestId}/accept`, { method: "POST" });
}

export function declineRequest(requestId: string) {
  return apiFetch<ServiceRequest>(`/requests/${requestId}/decline`, { method: "POST" });
}

export function fetchDashboard(dateFrom?: string, dateTo?: string) {
  const qs = new URLSearchParams();
  if (dateFrom) qs.set("dateFrom", dateFrom);
  if (dateTo) qs.set("dateTo", dateTo);
  return apiFetch<DashboardKpi>(`/analytics/dashboard${qs.toString() ? `?${qs}` : ""}`);
}

export function fetchReport(type: string, dateFrom?: string, dateTo?: string) {
  const qs = new URLSearchParams();
  if (dateFrom) qs.set("dateFrom", dateFrom);
  if (dateTo) qs.set("dateTo", dateTo);
  return apiFetch<AnalyticsReport>(`/analytics/reports/${type}${qs.toString() ? `?${qs}` : ""}`);
}

export type ExecutorKpiPeriod = "day" | "week" | "month";

export type ExecutorKpiRow = {
  executorId: string;
  executorName: string;
  email: string;
  claimed: number;
  closed: number;
  earned: number;
};

export type ExecutorKpi = {
  period: ExecutorKpiPeriod;
  from: string;
  to: string;
  totalClaimed: number;
  totalClosed: number;
  rows: ExecutorKpiRow[];
};

export function fetchExecutorKpi(period: ExecutorKpiPeriod, search?: string) {
  const qs = new URLSearchParams({ period });
  if (search) qs.set("search", search);
  return apiFetch<ExecutorKpi>(`/analytics/executor-kpi?${qs}`);
}

export type ExecutorKpiClaimedItem = {
  requestId: string;
  number: string;
  companyOrFullName: string;
  address: string | null;
  status: string;
  priority: string;
  assignedAt: string;
};

export type ExecutorKpiClosedItem = {
  requestId: string;
  number: string;
  companyOrFullName: string;
  address: string | null;
  status: string;
  priority: string;
  workPerformed: string | null;
  incomeAmount: number;
  expenseAmount: number;
  profit: number;
  confirmedAt: string | null;
};

export type ExecutorKpiDetail = {
  executor: { id: string; fullName: string; email: string };
  period: ExecutorKpiPeriod;
  from: string;
  to: string;
  claimed: ExecutorKpiClaimedItem[];
  closed: ExecutorKpiClosedItem[];
};

export function fetchExecutorKpiDetail(executorId: string, period: ExecutorKpiPeriod) {
  const qs = new URLSearchParams({ period });
  return apiFetch<ExecutorKpiDetail>(`/analytics/executor-kpi/${executorId}?${qs}`);
}

export function fetchMapOverview(params: Record<string, string | boolean | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const q = qs.toString();
  return apiFetch<MapOverview>(`/routing/map${q ? `?${q}` : ""}`);
}

export function fetchTodayRoute(executorId?: string) {
  const qs = new URLSearchParams();
  if (executorId) qs.set("executorId", executorId);
  return apiFetch<OptimizedRoute>(`/routing/today${qs.toString() ? `?${qs}` : ""}`);
}

export function optimizeRoute(requestIds: string[], executorId?: string) {
  return apiFetch<OptimizedRoute>(`/routing/optimize`, {
    method: "POST",
    body: JSON.stringify({ requestIds, executorId }),
  });
}

export function fetchClosingForm(requestId: string) {
  return apiFetch<ClosingFormData>(`/requests/${requestId}/closing-form`);
}

export function saveClosingForm(
  requestId: string,
  body: { workPerformed?: string; incomeAmount: number; expenseAmount: number },
) {
  return apiFetch<ClosingFormData>(`/requests/${requestId}/closing-form`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function confirmClosingForm(
  requestId: string,
  body: { workPerformed?: string; incomeAmount: number; expenseAmount: number },
) {
  return apiFetch<ClosingFormData>(`/requests/${requestId}/closing-form/confirm`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createActShare(requestId: string) {
  return apiFetch<{ url: string; pdfUrl: string; token: string }>(
    `/requests/${requestId}/act-share`,
    { method: "POST" },
  );
}

export function createRequest(body: CreateRequestPayload) {
  return apiFetch<ServiceRequest>("/requests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteRequest(id: string) {
  return apiFetch<{ message: string }>(`/requests/${id}`, { method: "DELETE" });
}

export function bulkDeleteRequests(ids: string[]) {
  return apiFetch<{ message: string; deleted: number }>("/requests/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function fetchComments(requestId: string, page = 1) {
  return apiFetch<Paginated<Comment>>(
    `/requests/${requestId}/comments?page=${page}&pageSize=50`,
  );
}

export function postComment(requestId: string, text: string) {
  return apiFetch<Comment>(`/requests/${requestId}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function fetchAttachments(requestId: string, page = 1) {
  return apiFetch<Paginated<Attachment>>(
    `/requests/${requestId}/attachments?page=${page}&pageSize=50`,
  );
}

export function uploadAttachment(requestId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<Attachment>(`/requests/${requestId}/attachments`, form);
}

export function deleteAttachment(requestId: string, attachmentId: string) {
  return apiFetch<{ message: string }>(`/requests/${requestId}/attachments/${attachmentId}`, {
    method: "DELETE",
  });
}
