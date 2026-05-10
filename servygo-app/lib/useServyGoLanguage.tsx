"use client";

import { createTranslator, type LanguageCode } from "@/lib/translations";
import {
  SERVYGO_LANGUAGE_CHANGED_EVENT,
  SERVYGO_LANGUAGE_STORAGE_KEY,
  parseStoredLanguage,
} from "@/lib/servygoLanguageConstants";
import { useIsClient } from "@/lib/useIsClient";
import { useEffect, useMemo, useState } from "react";

/**
 * Tracks `servygo_language` across the SPA: reacts to persistence from the homepage,
 * settings, or other tabs (storage event).
 */
export function useServyGoLanguage(): LanguageCode {
  const mounted = useIsClient();
  const [language, setLanguage] = useState<LanguageCode>("pl");

  useEffect(() => {
    if (!mounted) return;
    function readLanguage(): LanguageCode {
      return parseStoredLanguage(window.localStorage.getItem(SERVYGO_LANGUAGE_STORAGE_KEY));
    }
    queueMicrotask(() => setLanguage(readLanguage()));

    function onServyGoLanguagePersisted() {
      setLanguage(readLanguage());
    }
    function onStorage(event: StorageEvent) {
      if (event.key === SERVYGO_LANGUAGE_STORAGE_KEY) onServyGoLanguagePersisted();
    }
    window.addEventListener(SERVYGO_LANGUAGE_CHANGED_EVENT, onServyGoLanguagePersisted);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SERVYGO_LANGUAGE_CHANGED_EVENT, onServyGoLanguagePersisted);
      window.removeEventListener("storage", onStorage);
    };
  }, [mounted]);

  return mounted ? language : "pl";
}

export function useServyGoTranslator(): { t: (path: string) => string; language: LanguageCode } {
  const language = useServyGoLanguage();
  const t = useMemo(() => createTranslator(language), [language]);
  return { t, language };
}
