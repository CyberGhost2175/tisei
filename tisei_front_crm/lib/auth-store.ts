import type { AuthUser } from "./types";
import { clearThemeCookie } from "./theme-utils";

const TOKEN_KEY = "tisei_access_token";
const USER_KEY = "tisei_user";
const AUTH_FLAG = "tisei_auth";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveSession(accessToken: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  document.cookie = `${AUTH_FLAG}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  document.cookie = `tisei_role=${user.role}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = `${AUTH_FLAG}=; path=/; max-age=0`;
  document.cookie = `tisei_role=; path=/; max-age=0`;
  clearThemeCookie();
}
