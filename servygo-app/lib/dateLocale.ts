import type { LanguageCode } from "@/lib/translations";

/** BCP 47 tag for `toLocaleString` / `toLocaleDateString` from ServyGo UI language. */
export function localeTagForLanguage(lang: LanguageCode): string {
  if (lang === "en") return "en-GB";
  if (lang === "ua") return "uk-UA";
  return "pl-PL";
}
