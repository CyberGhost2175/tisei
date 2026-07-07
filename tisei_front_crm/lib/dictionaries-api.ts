import { apiFetch } from "./api";
import type { DictionaryItem, DictionaryType } from "./types";

export function fetchDictionary(type: DictionaryType, includeInactive = false) {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return apiFetch<DictionaryItem[]>(`/dictionaries/${type}${qs}`);
}

export function createDictionaryEntry(type: DictionaryType, name: string) {
  return apiFetch<DictionaryItem>(`/dictionaries/${type}`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateDictionaryEntry(
  type: DictionaryType,
  id: string,
  body: { name?: string; isActive?: boolean },
) {
  return apiFetch<DictionaryItem>(`/dictionaries/${type}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteDictionaryEntry(type: DictionaryType, id: string) {
  return apiFetch<{ message: string }>(`/dictionaries/${type}/${id}`, {
    method: "DELETE",
  });
}
