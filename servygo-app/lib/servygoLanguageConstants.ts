import type { LanguageCode } from "@/lib/translations";

/** localStorage key for UI language */
export const SERVYGO_LANGUAGE_STORAGE_KEY = "servygo_language";

/** Same-tab broadcast when language is persisted */
export const SERVYGO_LANGUAGE_CHANGED_EVENT = "servygo_language_changed";

export function parseStoredLanguage(raw: string | null): LanguageCode {
  if (raw === "pl" || raw === "en" || raw === "ua") return raw;
  return "pl";
}

export function persistServyGoLanguage(code: LanguageCode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SERVYGO_LANGUAGE_STORAGE_KEY, code);
  window.dispatchEvent(new CustomEvent(SERVYGO_LANGUAGE_CHANGED_EVENT));
}
