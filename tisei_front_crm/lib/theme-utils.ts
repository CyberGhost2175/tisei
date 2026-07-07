import type { ThemeMode } from "./settings-api";

const THEME_COOKIE = "tisei_theme";

export function setThemeCookie(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function clearThemeCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}
