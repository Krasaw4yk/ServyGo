"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import {
  addClientInternalNoteAsAdmin,
  addClientInternalNoteAsWorkshop,
  listClientInternalNotesForAdmin,
  listClientInternalNotesForWorkshop,
  softDeleteClientInternalNote,
  type ClientInternalNoteRow,
  type ClientInternalNoteType,
} from "@/lib/clientInternalNotesApi";
import { useServyGoTranslator } from "@/lib/useServyGoLanguage";

const NOTE_TYPES: ClientInternalNoteType[] = ["neutral", "positive", "warning", "problem"];

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "workshop" | "admin";
  clientUserId: string | undefined | null;
  bookingId?: string | null;
  workshopId?: string | null;
  isDark: boolean;
  adminUserId: string | undefined | null;
  adminEmail?: string | null;
};

function accentBarClass(typ: ClientInternalNoteType, isDark: boolean): string {
  switch (typ) {
    case "positive":
      return isDark ? "bg-emerald-500" : "bg-emerald-500";
    case "warning":
      return isDark ? "bg-amber-400" : "bg-amber-500";
    case "problem":
      return isDark ? "bg-rose-500" : "bg-rose-600";
    default:
      return isDark ? "bg-blue-400" : "bg-blue-500";
  }
}

function typeBadgeClass(typ: ClientInternalNoteType, isDark: boolean): string {
  const base = "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide";
  switch (typ) {
    case "positive":
      return `${base} ${isDark ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`;
    case "warning":
      return `${base} ${isDark ? "border-amber-500/35 bg-amber-500/10 text-amber-100" : "border-amber-300 bg-amber-50 text-amber-950"}`;
    case "problem":
      return `${base} ${isDark ? "border-rose-500/35 bg-rose-500/10 text-rose-100" : "border-rose-300 bg-rose-50 text-rose-950"}`;
    default:
      return `${base} ${isDark ? "border-slate-500/40 bg-slate-700/60 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-800"}`;
  }
}

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s-8-4.434-8-11V5l8-3 8 3v5c0 6.566-8 11-8 11z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconNotes({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPen({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L8 18l-4 1 1-4 10.5-10.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-9 6v-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M7 11V8a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function ClientInternalNotesModal(props: Props) {
  const { open, onClose, mode, clientUserId, bookingId = null, workshopId = null, isDark } = props;
  const { t, language } = useServyGoTranslator();

  const [notes, setNotes] = useState<ClientInternalNoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [noteType, setNoteType] = useState<ClientInternalNoteType>("neutral");
  const [saving, setSaving] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  const localeTag = language === "en" ? "en-GB" : language === "ua" ? "uk-UA" : "pl-PL";

  useEffect(() => {
    if (!open || !supabase) return;
    void supabase.auth.getSession().then(({ data }) => setViewerId(data.session?.user.id ?? null));
  }, [open]);

  const loadNotes = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !clientUserId) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "admin") {
        if (!props.adminUserId) throw new Error(t("clientInternalNotes.errorMissingSession"));
        const list = await listClientInternalNotesForAdmin(clientUserId, props.adminUserId, props.adminEmail);
        setNotes(list);
      } else {
        if (!workshopId) throw new Error(t("clientInternalNotes.errorMissingWorkshop"));
        const list = await listClientInternalNotesForWorkshop(clientUserId, workshopId);
        setNotes(list);
      }
    } catch (e) {
      setNotes([]);
      setError(e instanceof Error ? e.message : t("clientInternalNotes.error"));
    } finally {
      setLoading(false);
    }
  }, [clientUserId, mode, props.adminEmail, props.adminUserId, t, workshopId]);

  useEffect(() => {
    if (!open || !clientUserId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadNotes();
    });
    return () => {
      cancelled = true;
    };
  }, [clientUserId, loadNotes, open]);

  useEffect(() => {
    if (open) return;
    queueMicrotask(() => {
      setDraft("");
      setNoteType("neutral");
      setError("");
    });
  }, [open]);

  const canSubmit = draft.trim().length >= 3 && draft.trim().length <= 1000 && !saving;

  async function submitAdd() {
    if (!clientUserId || !canSubmit) return;
    setSaving(true);
    setError("");
    try {
      if (mode === "admin") {
        if (!props.adminUserId) throw new Error(t("clientInternalNotes.errorMissingSession"));
        await addClientInternalNoteAsAdmin({
          clientUserId,
          bookingId,
          workshopId,
          noteType,
          content: draft,
        });
      } else {
        if (!workshopId) throw new Error(t("clientInternalNotes.errorMissingWorkshop"));
        await addClientInternalNoteAsWorkshop({
          clientUserId,
          workshopId,
          bookingId,
          noteType,
          content: draft,
        });
      }
      setDraft("");
      await loadNotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("clientInternalNotes.error"));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(note: ClientInternalNoteRow) {
    if (!props.adminUserId && mode !== "workshop") return;
    const msg = t("clientInternalNotes.confirmDelete");
    if (!window.confirm(msg)) return;
    try {
      setError("");
      const uid = props.adminUserId ?? viewerId ?? "";
      await softDeleteClientInternalNote(note.id, uid, props.adminEmail);
      await loadNotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("clientInternalNotes.error"));
    }
  }

  const canDeleteNote = useCallback(
    (note: ClientInternalNoteRow): boolean => {
      if (mode === "admin") return Boolean(props.adminUserId);
      if (!viewerId) return false;
      return note.author_role === "workshop" && note.author_user_id === viewerId;
    },
    [mode, props.adminUserId, viewerId],
  );

  const typeLabel = useMemo(
    () =>
      ({
        neutral: t("clientInternalNotes.type.neutral"),
        positive: t("clientInternalNotes.type.positive"),
        warning: t("clientInternalNotes.type.warning"),
        problem: t("clientInternalNotes.type.problem"),
      }) satisfies Record<ClientInternalNoteType, string>,
    [t],
  );

  const shell =
    `relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-lg ` +
    (isDark ? "border-zinc-700/80 bg-zinc-900 text-zinc-100" : "border-zinc-200/90 bg-white text-zinc-900");

  const cardSurface = isDark ? "rounded-xl border border-zinc-700/70 bg-zinc-900/50" : "rounded-xl border border-zinc-200/80 bg-zinc-50/50";
  const muted = isDark ? "text-zinc-400" : "text-zinc-600";

  const fieldBase =
    `w-full rounded-lg border px-3 py-2 text-sm outline-none ring-blue-400/30 transition focus:ring-2 ` +
    (isDark ? "border-zinc-600 bg-zinc-950/90 text-zinc-100 placeholder:text-zinc-500" : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400");

  const iconSm = "h-5 w-5 shrink-0";

  if (!open || !clientUserId) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-zinc-950/65 backdrop-blur-[1px]" onClick={onClose} aria-label={t("commonUi.close")} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-internal-notes-title"
        className={`${shell} w-[calc(100%-1.5rem)] sm:mx-auto sm:w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek + alerty (kompakt) */}
        <header className={`shrink-0 border-b px-4 py-3 ${isDark ? "border-zinc-700/80 bg-zinc-900/80" : "border-zinc-200/80 bg-zinc-50/40"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="client-internal-notes-title" className="text-xl font-bold leading-tight tracking-tight">
                {t("clientInternalNotes.title")}
              </h2>
              <p className={`mt-1 text-sm leading-snug ${muted}`}>{t("clientInternalNotes.description")}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                isDark ? "border-zinc-500/60 bg-zinc-800/60 text-zinc-100" : "border-zinc-300 bg-white text-zinc-800"
              }`}
              aria-label={t("commonUi.close")}
            >
              <span className="text-base leading-none" aria-hidden>
                ×
              </span>
              {t("commonUi.close")}
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <div
              className={`flex gap-2 rounded-lg border p-3 ${
                isDark ? "border-blue-500/30 bg-blue-500/10 text-blue-100" : "border-blue-300/55 bg-blue-50 text-blue-900"
              }`}
            >
              <IconInfo className={`${iconSm} ${isDark ? "text-blue-300" : "text-blue-600"}`} />
              <p className="min-w-0 text-xs leading-snug">{t("clientInternalNotes.compactNoticeBlue")}</p>
            </div>
            <div
              className={`flex gap-2 rounded-lg border p-3 ${
                isDark ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-100/95" : "border-amber-300/65 bg-amber-50 text-amber-950"
              }`}
            >
              <IconShield className={`${iconSm} ${isDark ? "text-amber-300/90" : "text-amber-700"}`} />
              <p className="min-w-0 text-xs leading-snug">{t("clientInternalNotes.compactNoticeAmber")}</p>
            </div>
          </div>

          {!isSupabaseConfigured ? (
            <p className={`mt-2 rounded-lg border px-3 py-2 text-xs ${isDark ? "border-orange-400/35 text-orange-200" : "border-orange-200 text-orange-900"}`}>
              {t("clientInternalNotes.errorSupabase")}
            </p>
          ) : null}
        </header>

        {/* Lista + formularz — scroll */}
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3 ${isDark ? "bg-zinc-950/30" : "bg-white"}`}>
          {error ? (
            <p className="mb-3 rounded-lg border border-rose-500/35 px-3 py-2 text-xs sm:text-sm" role="alert">
              {error}
            </p>
          ) : null}

          {/* Istniejące notatki */}
          <section className={`${cardSurface}`} aria-labelledby="cin-existing-heading">
            <div className={`flex items-center gap-2 border-b px-3 py-2 ${isDark ? "border-zinc-700/70" : "border-zinc-200/90"}`}>
              <IconNotes className={`h-4 w-4 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
              <h3 id="cin-existing-heading" className="text-sm font-semibold">
                {t("clientInternalNotes.existingNotesSection")}
              </h3>
            </div>
            <div className="space-y-2 p-3">
              {loading ? <p className={`text-xs ${muted}`}>{t("clientInternalNotes.loading")}</p> : null}
              {!loading && !notes.length ? <p className={`text-xs ${muted}`}>{t("clientInternalNotes.empty")}</p> : null}
              {!loading &&
                notes.length > 0 &&
                notes.map((n) => {
                  const nt = normalizeNt(n.note_type);
                  const metaParts = [(n.author_label ?? "").trim() || null, n.author_role === "admin" ? t("clientInternalNotes.badgeAdmin") : null, n.workshop_name ?? null].filter(Boolean);
                  return (
                    <article
                      key={n.id}
                      className={`flex overflow-hidden rounded-lg border ${
                        isDark ? "border-zinc-700/80 bg-zinc-900/40" : "border-zinc-200 bg-white"
                      }`}
                    >
                      <div className={`w-1 shrink-0 ${accentBarClass(nt, isDark)}`} aria-hidden />
                      <div className="min-w-0 flex-1 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <time className="text-[10px] tabular-nums text-zinc-500 sm:text-xs" suppressHydrationWarning dateTime={n.created_at ?? undefined}>
                              {n.created_at ? new Date(n.created_at).toLocaleString(localeTag, { dateStyle: "short", timeStyle: "short" }) : "—"}
                            </time>
                            <span className={typeBadgeClass(nt, isDark)}>{typeLabel[nt]}</span>
                          </div>
                          {canDeleteNote(n) ? (
                            <button
                              type="button"
                              className={`shrink-0 text-[10px] font-semibold underline-offset-2 hover:underline sm:text-xs ${isDark ? "text-rose-300" : "text-rose-700"}`}
                              onClick={() => void onDelete(n)}
                            >
                              {t("clientInternalNotes.deleteButton")}
                            </button>
                          ) : null}
                        </div>
                        {metaParts.length ? <p className="mt-1.5 text-[10px] text-zinc-500 sm:text-xs">{metaParts.join(" · ")}</p> : null}
                        <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{n.content}</p>
                      </div>
                    </article>
                  );
                })}
            </div>
          </section>

          {/* Dodaj notatkę — jedna kolumna */}
          <section className={`${cardSurface} mt-3`} aria-labelledby="cin-add-heading">
            <div className={`flex items-center gap-2 border-b px-3 py-2 ${isDark ? "border-zinc-700/70" : "border-zinc-200/90"}`}>
              <IconPen className={`h-4 w-4 ${isDark ? "text-orange-400" : "text-orange-600"}`} />
              <h3 id="cin-add-heading" className="text-sm font-semibold">
                {t("clientInternalNotes.addNoteSection")}
              </h3>
            </div>
            <div className="space-y-3 p-3">
              <div>
                <label htmlFor="cin-note-type" className={`mb-1 block text-[11px] font-semibold uppercase tracking-wide ${muted}`}>
                  {t("clientInternalNotes.noteTypeLabel")}
                </label>
                <select
                  id="cin-note-type"
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value as ClientInternalNoteType)}
                  disabled={saving || !isSupabaseConfigured}
                  className={`${fieldBase} cursor-pointer`}
                >
                  {NOTE_TYPES.map((nt) => (
                    <option key={nt} value={nt}>
                      {typeLabel[nt]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <label htmlFor="cin-content" className={`mb-1 block text-[11px] font-semibold uppercase tracking-wide ${muted}`}>
                  {t("clientInternalNotes.textareaLabel")}
                </label>
                <textarea
                  id="cin-content"
                  maxLength={1000}
                  rows={4}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t("clientInternalNotes.textareaPlaceholder")}
                  disabled={saving || !isSupabaseConfigured}
                  className={`${fieldBase} min-h-[90px] resize-y pb-6 leading-relaxed`}
                />
                <span className={`pointer-events-none absolute bottom-2 right-2 text-[10px] tabular-nums ${muted}`}>{draft.length} / 1000</span>
              </div>
              <button
                type="button"
                disabled={!canSubmit || !isSupabaseConfigured}
                onClick={() => void submitAdd()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition enabled:hover:brightness-105 disabled:opacity-40"
              >
                <IconSend className="h-4 w-4" />
                {saving ? t("clientInternalNotes.submitting") : t("clientInternalNotes.addButton")}
              </button>
              <p className={`flex items-center gap-1.5 text-[10px] leading-snug ${muted}`}>
                <IconLock className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-emerald-400/80" : "text-emerald-700"}`} />
                {t("clientInternalNotes.secureStorageHint")}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function normalizeNt(nt: ClientInternalNoteType | string): ClientInternalNoteType {
  return NOTE_TYPES.includes(nt as ClientInternalNoteType) ? (nt as ClientInternalNoteType) : "neutral";
}
