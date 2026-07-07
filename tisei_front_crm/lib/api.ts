import { API_URL } from "./types";
import { clearSession, getAccessToken, saveSession } from "./auth-store";
import type { AuthUser } from "./types";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  const data = await res.json().catch(() => ({}));
  const err = (data as { error?: { message?: string; code?: string } }).error;
  return new ApiError(err?.message ?? res.statusText, res.status, err?.code);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && retry && path !== "/auth/refresh") {
    const refreshed = await refreshTokens();
    if (refreshed) return apiFetch<T>(path, options, false);
    clearSession();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError("Сессия истекла", 401);
  }

  if (!res.ok) throw await parseError(res);

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function refreshTokens(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string; user: AuthUser };
    saveSession(data.accessToken, data.user);
    return true;
  } catch {
    return false;
  }
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = (data as { error?: { message?: string } }).error;
    throw new ApiError(err?.message ?? "Ошибка входа", res.status);
  }

  if ("requires2fa" in data && data.requires2fa) {
    return data as { requires2fa: true; pendingToken: string };
  }

  const auth = data as { accessToken: string; user: AuthUser };
  saveSession(auth.accessToken, auth.user);
  return auth;
}

export async function verify2fa(pendingToken: string, code: string) {
  const res = await fetch(`${API_URL}/auth/2fa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ pendingToken, code }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { message?: string } }).error;
    throw new ApiError(err?.message ?? "Неверный код", res.status);
  }

  const auth = data as { accessToken: string; user: AuthUser };
  saveSession(auth.accessToken, auth.user);
  return auth;
}

export async function logout() {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    clearSession();
  }
}

export async function apiUpload<T>(path: string, formData: FormData, retry = true): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    credentials: "include",
    body: formData,
  });

  if (res.status === 401 && retry && path !== "/auth/refresh") {
    const refreshed = await refreshTokens();
    if (refreshed) return apiUpload<T>(path, formData, false);
    clearSession();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError("Сессия истекла", 401);
  }

  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<T>;
}
