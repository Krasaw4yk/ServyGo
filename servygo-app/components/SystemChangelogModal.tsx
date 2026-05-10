"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LanguageCode } from "@/lib/translations";
import {
  getLatestSystemChangelogForAudience,
  getSeenChangelogStorageKey,
  getSystemChangelogSignatureForAudience,
} from "@/lib/systemChangelog";
import type { SystemChangelogChangeType } from "@/lib/systemChangelog";
import { useServyGoTranslator } from "@/lib/useServyGoLanguage";
import { useIsClient } from "@/lib/useIsClient";

type Props = {
  audience: "workshop" | "admin";
  isDark: boolean;
  /** Panel gotowy — np. załadowany warsztat / potwierdzony dostęp admina */
  showWhen: boolean;
};

function typeBadgeClass(type: SystemChangelogChangeType, isDark: boolean): string {
  const base =
    "inline-flex shrink-0 items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide";
  switch (type) {
    case "new":
      return `${base} ${isDark ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`;
    case "fix":
      return `${base} ${isDark ? "border-sky-500/35 bg-sky-500/15 text-sky-200" : "border-sky-200 bg-sky-50 text-sky-900"}`;
    case "important":
      return `${base} ${isDark ? "border-amber-500/35 bg-amber-500/15 text-amber-200" : "border-amber-300 bg-amber-50 text-amber-950"}`;
    default:
      return `${base} ${isDark ? "border-zinc-600 bg-zinc-800/90 text-zinc-200" : "border-blue-100 bg-blue-50/70 text-blue-950"}`;
  }
}

function formatDate(localeTag: string, iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(localeTag, { year: "numeric", month: "short", day: "numeric" });
}

function localeFromLanguage(lang: LanguageCode): string {
  if (lang === "en") return "en-GB";
  if (lang === "ua") return "uk-UA";
  return "pl-PL";
}

function typeLabelKey(type: SystemChangelogChangeType): string {
  return `systemChangelog.type.${type}`;
}

export default function SystemChangelogModal({ audience, isDark, showWhen }: Props) {
  const mounted = useIsClient();
  const { t, language } = useServyGoTranslator();
  const [open, setOpen] = useState(false);
  const dateLocale = localeFromLanguage(language);

  const resolved = useMemo(() => {
    return getLatestSystemChangelogForAudience(audience).map((entry) => ({
      entry,
      ...entry.copy[language],
    }));
  }, [audience, language]);

  const storageKey = getSeenChangelogStorageKey(audience);

  const considerOpen = useCallback(() => {
    if (!mounted || typeof window === "undefined" || !showWhen) return;
    const rows = getLatestSystemChangelogForAudience(audience);
    if (rows.length === 0) return;
    const sig = getSystemChangelogSignatureForAudience(audience);
    try {
      const prev = window.localStorage.getItem(storageKey);
      if (prev === sig) return;
    } catch {
      return;
    }
    queueMicrotask(() => setOpen(true));
  }, [audience, mounted, showWhen, storageKey]);

  useEffect(() => {
    if (!showWhen) queueMicrotask(() => setOpen(false));
  }, [showWhen]);

  useEffect(() => {
    considerOpen();
  }, [considerOpen]);

  const persistSeenAndClose = useCallback(() => {
    try {
      const sig = getSystemChangelogSignatureForAudience(audience);
      window.localStorage.setItem(storageKey, sig);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, [audience, storageKey]);

  const muted = isDark ? "text-zinc-400" : "text-zinc-600";
  const panel = isDark ? "border-blue-500/35 bg-zinc-900 shadow-2xl" : "border-blue-200 bg-white shadow-xl";
  const thead = isDark ? "text-zinc-300" : "text-zinc-600";
  const rowBorder = isDark ? "border-t border-zinc-800" : "border-t border-blue-100";

  if (!mounted || !open || resolved.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[1px]"
        aria-label={t("systemChangelog.closeButton")}
        onClick={persistSeenAndClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="servygo-changelog-modal-title"
        className={`relative z-[71] mx-4 mb-6 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border sm:mx-0 sm:mb-0 sm:max-h-[85vh] sm:max-w-2xl ${panel}`}
      >
        <div className={`flex shrink-0 items-start justify-between gap-3 border-b px-4 py-4 sm:px-5 ${isDark ? "border-zinc-700" : "border-blue-100"}`}>
          <div className="min-w-0 pr-2">
            <h2 id="servygo-changelog-modal-title" className="text-lg font-bold sm:text-xl">
              {t("systemChangelog.modalTitle")}
            </h2>
            <p className={`mt-1 text-xs leading-snug sm:text-sm ${muted}`}>{t("systemChangelog.modalDescription")}</p>
          </div>
          <button
            type="button"
            onClick={persistSeenAndClose}
            className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-lg leading-none font-semibold ${isDark ? "border-zinc-600 text-zinc-300 hover:bg-zinc-800" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`}
            aria-label={t("systemChangelog.closeButton")}
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          <div className="hidden sm:block sm:overflow-x-auto">
            <table className="w-full min-w-[520px] table-auto text-sm">
              <thead className={thead}>
                <tr>
                  <th className="whitespace-nowrap px-2 py-2 text-left font-semibold">{t("systemChangelog.columns.date")}</th>
                  <th className="px-2 py-2 text-left font-semibold">{t("systemChangelog.columns.title")}</th>
                  <th className="min-w-[180px] px-2 py-2 text-left font-semibold">{t("systemChangelog.columns.description")}</th>
                  <th className="whitespace-nowrap px-2 py-2 text-left font-semibold">{t("systemChangelog.columns.type")}</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map(({ entry, title, description }) => (
                  <tr key={entry.id} className={rowBorder}>
                    <td className="whitespace-nowrap px-2 py-2.5 align-top tabular-nums text-xs">{formatDate(dateLocale, entry.date)}</td>
                    <td className="px-2 py-2.5 align-top font-semibold">{title}</td>
                    <td className={`px-2 py-2.5 align-top text-xs ${muted}`}>{description}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 align-top">
                      <span className={typeBadgeClass(entry.type, isDark)}>{t(typeLabelKey(entry.type))}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 sm:hidden" aria-label={t("systemChangelog.mobileListAria")}>
            {resolved.map(({ entry, title, description }) => (
              <li
                key={entry.id}
                className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-950/55" : "border-blue-100 bg-blue-50/40"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <time className="text-[11px] font-medium tabular-nums text-zinc-500" dateTime={entry.date}>
                    {formatDate(dateLocale, entry.date)}
                  </time>
                  <span className={typeBadgeClass(entry.type, isDark)}>{t(typeLabelKey(entry.type))}</span>
                </div>
                <p className="mt-1.5 font-semibold leading-snug">{title}</p>
                <p className={`mt-1 text-sm leading-snug ${muted}`}>{description}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className={`flex shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-5 ${isDark ? "border-zinc-700 bg-zinc-950/40" : "border-blue-100 bg-blue-50/40"}`}>
          <button
            type="button"
            onClick={persistSeenAndClose}
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${isDark ? "border-zinc-600 text-zinc-200" : "border-zinc-300 text-zinc-800"}`}
          >
            {t("systemChangelog.closeButton")}
          </button>
          <button
            type="button"
            onClick={persistSeenAndClose}
            className="rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            {t("systemChangelog.understoodButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
