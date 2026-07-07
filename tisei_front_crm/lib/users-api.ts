import { apiFetch } from "./api";
import type { Paginated, UserProfile, UserRole } from "./types";

export function fetchUsers(params: Record<string, string | number | boolean | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const q = qs.toString();
  return apiFetch<Paginated<UserProfile>>(`/users${q ? `?${q}` : ""}`);
}

export function createUser(body: {
  fullName: string;
  email: string;
  phone?: string;
  password?: string;
  role: UserRole;
  specialization?: string[];
}) {
  return apiFetch<UserProfile>("/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateUser(
  id: string,
  body: Partial<{
    fullName: string;
    email: string;
    phone: string | null;
    role: UserRole;
    isActive: boolean;
    specialization: string[];
  }>,
) {
  return apiFetch<UserProfile>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteUser(id: string) {
  return apiFetch<{ message: string }>(`/users/${id}`, { method: "DELETE" });
}

export function archiveUser(id: string) {
  return apiFetch<UserProfile>(`/users/${id}/archive`, { method: "POST" });
}

export function fetchExecutors() {
  return apiFetch<Array<{ id: string; fullName: string; email: string }>>("/users/executors");
}
