import { apiFetch } from "./api";

export type ThemeMode = "light" | "dark" | "system";

export type UserSettings = {
  theme: ThemeMode;
};

export function fetchUserSettings() {
  return apiFetch<UserSettings>("/users/me/settings");
}

export function updateUserSettings(body: Partial<UserSettings>) {
  return apiFetch<UserSettings>("/users/me/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
