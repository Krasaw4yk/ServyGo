"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getInboxMessages,
  markBookingThreadMessagesRead,
  markMessageAsRead,
  resolveMessageViewerContext,
  type InternalMessage,
} from "@/lib/messagesApi";
import { getUnifiedUnreadCount, listUserNotifications, markNotificationAsRead, type UserNotificationRow } from "@/lib/notificationsApi";

type BellRow =
  | { kind: "message"; key: string; created_at: string; message: InternalMessage }
  | { kind: "notification"; key: string; created_at: string; notification: UserNotificationRow };

type ClientNotificationBellProps = {
  userId: string;
  userEmail?: string | null;
  isDark: boolean;
  unreadCount: number;
  messagesHref?: string;
  /** Gdy podane (np. klasa przycisków język/motyw w headerze), zamiast małego kwadratu. */
  buttonClassName?: string;
  onUnreadCountChange?: (n: number) => void;
};

export default function ClientNotificationBell({
  userId,
  userEmail,
  isDark,
  unreadCount,
  messagesHref = "/moje-wiadomosci",
  buttonClassName,
  onUnreadCountChange,
}: ClientNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<BellRow[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const refreshUnread = useCallback(async () => {
    try {
      const ctx = await resolveMessageViewerContext(userId, userEmail);
      const n = await getUnifiedUnreadCount(userId, ctx.isAdminOrOwner);
      onUnreadCountChange?.(n);
    } catch {
      // ignore
    }
  }, [userEmail, userId, onUnreadCountChange]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function loadDropdown() {
    setLoading(true);
    try {
      const ctx = await resolveMessageViewerContext(userId, userEmail);
      const [msgRows, noteRows] = await Promise.all([
        getInboxMessages(userId, ctx.isAdminOrOwner),
        listUserNotifications(userId, 80),
      ]);
      const merged: BellRow[] = [
        ...msgRows.map(
          (m): BellRow => ({
            kind: "message",
            key: `m:${m.id}`,
            created_at: m.created_at,
            message: m,
          }),
        ),
        ...noteRows.map(
          (n): BellRow => ({
            kind: "notification",
            key: `n:${n.id}`,
            created_at: n.created_at,
            notification: n,
          }),
        ),
      ];
      merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setRows(merged.slice(0, 14));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function onToggle() {
    const next = !open;
    setOpen(next);
    if (next) await loadDropdown();
  }

  async function onPickMessage(message: InternalMessage) {
    try {
      if (message.related_booking_id) {
        await markBookingThreadMessagesRead(userId, message.related_booking_id);
      } else if (!message.is_read && message.recipient_id === userId) {
        await markMessageAsRead(message.id);
      }
    } catch {
      // best effort
    }
    await refreshUnread();
    setOpen(false);
  }

  async function onPickNotification(n: UserNotificationRow) {
    try {
      if (!n.is_read) await markNotificationAsRead(n.id);
    } catch {
      // best effort
    }
    await refreshUnread();
    setOpen(false);
  }

  const shell = isDark ? "border-zinc-600 bg-zinc-900/95 text-zinc-100 shadow-xl" : "border-blue-200 bg-white text-zinc-900 shadow-xl";

  const compactBellBtnClass = `relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
    isDark ? "border-zinc-600 text-zinc-100 hover:bg-zinc-800" : "border-blue-200 text-blue-800 hover:bg-blue-50"
  }`;
  const bellBtnClass = buttonClassName?.trim()
    ? `relative shrink-0 ${buttonClassName}`
    : compactBellBtnClass;
  const bellIconClass = buttonClassName?.trim() ? "h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:h-6 shrink-0" : "h-5 w-5 shrink-0";

  const allLinkLabel = messagesHref.includes("workshop-panel") ? "Panel warsztatu" : "Wszystkie powiadomienia";

  function rowUnread(row: BellRow): boolean {
    if (row.kind === "message") {
      const m = row.message;
      return !m.is_read && m.recipient_id === userId;
    }
    return !row.notification.is_read;
  }

  return (
    <div className="relative" ref={panelRef}>
      <button type="button" onClick={() => void onToggle()} aria-label="Powiadomienia" className={bellBtnClass}>
        <svg viewBox="0 0 24 24" className={bellIconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={`absolute right-0 top-[calc(100%+10px)] z-[10002] w-[min(92vw,380px)] overflow-hidden rounded-2xl border ${shell}`}
        >
          <div className={`flex items-center justify-between border-b px-3 py-2 text-sm font-semibold ${isDark ? "border-zinc-700" : "border-blue-100"}`}>
            <span>Powiadomienia</span>
            <Link href={messagesHref} className="text-xs font-semibold text-blue-500 hover:underline" onClick={() => setOpen(false)}>
              {allLinkLabel}
            </Link>
          </div>
          <div className="max-h-[min(70vh,420px)] overflow-y-auto">
            {loading ? (
              <p className={`px-3 py-4 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Ładowanie…</p>
            ) : rows.length === 0 ? (
              <p className={`px-3 py-4 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Brak powiadomień.</p>
            ) : (
              rows.map((row) =>
                row.kind === "message" ? (
                  <Link
                    key={row.key}
                    href={messagesHref}
                    onClick={() => void onPickMessage(row.message)}
                    className={`block border-b px-3 py-3 text-left transition last:border-b-0 ${
                      rowUnread(row)
                        ? isDark
                          ? "bg-blue-950/40"
                          : "bg-blue-50/90"
                        : isDark
                          ? "hover:bg-zinc-800"
                          : "hover:bg-zinc-50"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Wiadomość</p>
                    <p className="text-sm font-semibold leading-snug">{row.message.subject || "(bez tematu)"}</p>
                    <p className={`mt-1 line-clamp-2 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{row.message.body}</p>
                    <p className={`mt-1 text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                      {new Date(row.message.created_at).toLocaleString("pl-PL")}
                    </p>
                  </Link>
                ) : (
                  <Link
                    key={row.key}
                    href={messagesHref}
                    onClick={() => void onPickNotification(row.notification)}
                    className={`block border-b px-3 py-3 text-left transition last:border-b-0 ${
                      rowUnread(row)
                        ? isDark
                          ? "bg-blue-950/40"
                          : "bg-blue-50/90"
                        : isDark
                          ? "hover:bg-zinc-800"
                          : "hover:bg-zinc-50"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {row.notification.notification_type === "completion_check" ? "Po wizycie" : "Informacja"}
                    </p>
                    <p className="text-sm font-semibold leading-snug">{row.notification.title}</p>
                    <p className={`mt-1 line-clamp-2 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{row.notification.body}</p>
                    <p className={`mt-1 text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                      {new Date(row.notification.created_at).toLocaleString("pl-PL")}
                    </p>
                  </Link>
                ),
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
