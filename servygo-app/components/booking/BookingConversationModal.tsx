"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getBookingThreadMessages, markBookingThreadMessagesRead, type InternalMessage } from "@/lib/messagesApi";
import { fillTemplate } from "@/lib/fillTemplate";
import { localeTagForLanguage } from "@/lib/dateLocale";
import { useServyGoTranslator } from "@/lib/useServyGoLanguage";

type Props = {
  bookingId: string;
  workshopName: string;
  serviceName: string;
  userId: string;
  isDark: boolean;
  onClose: () => void;
};

function bubbleClasses(msg: InternalMessage, currentUserId: string, isDark: boolean) {
  if (msg.sender_role === "system") {
    return isDark ? "border-violet-500/35 bg-violet-950/35 text-zinc-100" : "border-violet-200 bg-violet-50 text-zinc-900";
  }
  const fromMe = msg.sender_id === currentUserId;
  if (fromMe) {
    return isDark ? "border-blue-500/40 bg-blue-950/40 text-zinc-100 ml-8" : "border-blue-200 bg-blue-50 text-zinc-900 ml-8";
  }
  return isDark ? "border-zinc-600 bg-zinc-900/80 text-zinc-100 mr-8" : "border-zinc-200 bg-white text-zinc-900 mr-8";
}

export default function BookingConversationModal({
  bookingId,
  workshopName,
  serviceName,
  userId,
  isDark,
  onClose,
}: Props) {
  const { t, language } = useServyGoTranslator();
  const dateLocaleTag = localeTagForLanguage(language);

  function formatWhen(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(dateLocaleTag, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const footerHint = useMemo(() => {
    const raw = t("bookingsPage.conversationFooterHint");
    const strongLabel = t("bookingsPage.conversationFooterStrong");
    if (!raw.includes("{strong}")) return { before: raw, strong: strongLabel, after: "" };
    const idx = raw.indexOf("{strong}");
    return {
      before: raw.slice(0, idx),
      strong: strongLabel,
      after: raw.slice(idx + "{strong}".length),
    };
  }, [t]);

  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await getBookingThreadMessages(userId, bookingId);
      setMessages(rows);
      await markBookingThreadMessagesRead(userId, bookingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("bookingsPage.conversationLoadError"));
    } finally {
      setLoading(false);
    }
  }, [bookingId, userId, t]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const systemMessages = useMemo(() => messages.filter((m) => m.sender_role === "system"), [messages]);

  const shell = isDark ? "border-zinc-600 bg-zinc-900 text-zinc-100" : "border-blue-200 bg-white text-zinc-900";
  const backdrop = "fixed inset-0 z-[10050] flex items-end justify-center sm:items-center p-0 sm:p-4";

  return (
    <div className={backdrop}>
      <button type="button" className="absolute inset-0 bg-black/60" aria-label={t("commonUi.close")} onClick={onClose} />
      <div
        className={`relative z-[1] flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col rounded-t-3xl border shadow-2xl sm:rounded-3xl ${shell}`}
      >
        <div className={`flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3 ${isDark ? "border-zinc-700" : "border-blue-100"}`}>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{workshopName}</h2>
            <p className={`truncate text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{serviceName}</p>
            <p className={`mt-0.5 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {fillTemplate(t("bookingsPage.conversationModalBookingLine"), { id: bookingId.slice(0, 8) })}…
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 rounded-xl border px-3 py-1.5 text-sm font-semibold ${isDark ? "border-zinc-600 hover:bg-zinc-800" : "border-zinc-300 hover:bg-zinc-50"}`}
          >
            {t("commonUi.close")}
          </button>
        </div>

        <div className={`min-h-[200px] flex-1 overflow-y-auto px-4 py-3 ${isDark ? "bg-zinc-950/40" : "bg-blue-50/40"}`}>
          {loading ? (
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("bookingsPage.conversationLoading")}</p>
          ) : systemMessages.length === 0 ? (
            <p className={`rounded-2xl border px-4 py-6 text-center text-sm ${isDark ? "border-zinc-700 text-zinc-400" : "border-blue-100 text-zinc-600"}`}>
              {t("bookingsPage.conversationEmpty")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {systemMessages.map((msg) => (
                <div key={msg.id} className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${bubbleClasses(msg, userId, isDark)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold opacity-90">{msg.sender_label}</span>
                    <span className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{formatWhen(msg.created_at)}</span>
                  </div>
                  {msg.subject ? <p className="mt-1 text-xs font-semibold opacity-90">{msg.subject}</p> : null}
                  <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {error ? (
          <p className={`shrink-0 px-4 py-2 text-sm ${isDark ? "text-rose-300" : "text-rose-600"}`}>{error}</p>
        ) : null}

        <div className={`shrink-0 border-t p-4 ${isDark ? "border-zinc-700 bg-zinc-900" : "border-blue-100 bg-white"}`}>
          <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            {footerHint.before}
            <strong className={isDark ? "text-zinc-100" : "text-zinc-900"}>{footerHint.strong}</strong>
            {footerHint.after}
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Link
              href="/moje-wiadomosci"
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${isDark ? "border-blue-400/50 text-blue-200 hover:bg-zinc-800" : "border-blue-300 text-blue-800 hover:bg-blue-50"}`}
            >
              {t("bookingsPage.openMessages")}
            </Link>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
            >
              {t("commonUi.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
