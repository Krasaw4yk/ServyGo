"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getInboxMessages,
  getSentMessages,
  getUnreadMessagesCount,
  markMessageAsRead,
  sendInternalMessage,
  type InternalMessage,
  type InternalMessageRole,
} from "@/lib/messagesApi";

type InternalInboxProps = {
  currentUserId: string;
  isDark: boolean;
  viewerRole: InternalMessageRole;
  includeAllForAdmin?: boolean;
  onUnreadCountChange?: (count: number) => void;
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("pl-PL");
}

export default function InternalInbox({
  currentUserId,
  isDark,
  viewerRole,
  includeAllForAdmin = false,
  onUnreadCountChange,
}: InternalInboxProps) {
  const [loading, setLoading] = useState(true);
  const [inbox, setInbox] = useState<InternalMessage[]>([]);
  const [sent, setSent] = useState<InternalMessage[]>([]);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [recipientRole, setRecipientRole] = useState<InternalMessageRole>("admin");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const unreadCount = useMemo(
    () => inbox.filter((x) => !x.is_read && x.recipient_id === currentUserId).length,
    [currentUserId, inbox],
  );

  const activeList = tab === "inbox" ? inbox : sent;
  const selectedMessage = activeList.find((x) => x.id === selectedId) ?? null;

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inboxRows, sentRows, unread] = await Promise.all([
        getInboxMessages(currentUserId, includeAllForAdmin),
        getSentMessages(currentUserId),
        getUnreadMessagesCount(currentUserId, includeAllForAdmin),
      ]);
      setInbox(inboxRows);
      setSent(sentRows);
      onUnreadCountChange?.(unread);
      if (!selectedId && inboxRows.length > 0) setSelectedId(inboxRows[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się pobrać wiadomości.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, includeAllForAdmin, onUnreadCountChange, selectedId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function openMessage(message: InternalMessage) {
    setSelectedId(message.id);
    if (message.recipient_id !== currentUserId || message.is_read) return;
    try {
      await markMessageAsRead(message.id);
      setInbox((prev) => prev.map((row) => (row.id === message.id ? { ...row, is_read: true } : row)));
      const unread = await getUnreadMessagesCount(currentUserId, includeAllForAdmin);
      onUnreadCountChange?.(unread);
    } catch {
      // best effort
    }
  }

  async function sendMessage() {
    setError("");
    setInfo("");
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError("Wpisz treść wiadomości.");
      return;
    }
    if (!recipientId.trim() && recipientRole !== "admin") {
      setError("Podaj odbiorcę (UUID) albo wybierz rolę administratora.");
      return;
    }
    setSending(true);
    try {
      await sendInternalMessage({
        senderId: currentUserId,
        recipientId: recipientId.trim() || null,
        senderRole: viewerRole,
        recipientRole,
        subject: subject.trim() || null,
        body: trimmedBody,
      });
      setSubject("");
      setBody("");
      setRecipientId("");
      setComposeOpen(false);
      setInfo("Wiadomość wysłana.");
      await reload();
      setTab("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wysłać wiadomości.");
    } finally {
      setSending(false);
    }
  }

  function startReply(message: InternalMessage) {
    setComposeOpen(true);
    setTab("inbox");
    setSubject(message.subject ? `RE: ${message.subject}` : "RE: Wiadomość");
    setBody(`\n\n---\n${message.body}`);
    setRecipientId(message.sender_id ?? "");
    setRecipientRole((message.sender_role as InternalMessageRole) ?? "client");
  }

  return (
    <div className={`rounded-2xl border p-4 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">✉️</span>
          <h3 className="text-lg font-semibold">Skrzynka wiadomości</h3>
          {unreadCount > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setComposeOpen((prev) => !prev)} className="rounded-lg border px-3 py-1.5 text-sm">
            {composeOpen ? "Zamknij" : "Nowa wiadomość"}
          </button>
          <button type="button" onClick={() => void reload()} className="rounded-lg border px-3 py-1.5 text-sm">
            Odśwież
          </button>
        </div>
      </div>

      {error ? <p className={`mb-3 rounded-lg border px-3 py-2 text-sm ${isDark ? "border-rose-500/40 bg-rose-950/40 text-rose-100" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{error}</p> : null}
      {info ? <p className={`mb-3 rounded-lg border px-3 py-2 text-sm ${isDark ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{info}</p> : null}

      {composeOpen ? (
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>Rola odbiorcy</span>
              <select value={recipientRole} onChange={(e) => setRecipientRole(e.target.value as InternalMessageRole)} className="rounded-lg border px-3 py-2 text-sm text-black">
                <option value="admin">Admin</option>
                <option value="workshop">Warsztat</option>
                <option value="client">Klient</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Odbiorca (UUID)</span>
              <input value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm text-black" placeholder="opcjonalnie przy wysyłce do admina" />
            </label>
          </div>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border px-3 py-2 text-sm text-black" placeholder="Temat" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="rounded-lg border px-3 py-2 text-sm text-black" placeholder="Treść wiadomości" />
          <div>
            <button type="button" disabled={sending} onClick={() => void sendMessage()} className="rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:opacity-60">
              {sending ? "Wysyłanie..." : "Wyślij"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex gap-2">
        <button type="button" onClick={() => setTab("inbox")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === "inbox" ? "bg-blue-600 text-white" : "border"}`}>
          Odebrane
        </button>
        <button type="button" onClick={() => setTab("sent")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === "sent" ? "bg-blue-600 text-white" : "border"}`}>
          Wysłane
        </button>
      </div>

      {loading ? (
        <p className="text-sm">Ładowanie wiadomości...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border">
            {activeList.length === 0 ? (
              <p className="px-3 py-4 text-sm text-zinc-500">Brak wiadomości.</p>
            ) : (
              activeList.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => void openMessage(msg)}
                  className={`w-full border-b px-3 py-2 text-left last:border-b-0 ${selectedId === msg.id ? (isDark ? "bg-zinc-800" : "bg-blue-50") : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm font-medium ${!msg.is_read && msg.recipient_id === currentUserId ? "text-blue-500" : ""}`}>{msg.subject || "(bez tematu)"}</p>
                    {!msg.is_read && msg.recipient_id === currentUserId ? <span className="h-2 w-2 rounded-full bg-rose-500" /> : null}
                  </div>
                  <p className="truncate text-xs text-zinc-500">{tab === "inbox" ? `Od: ${msg.sender_label}` : `Do: ${msg.recipient_label}`}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">{formatDate(msg.created_at)}</p>
                </button>
              ))
            )}
          </div>
          <div className="min-w-0 rounded-xl border p-3">
            {selectedMessage ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="break-words text-base font-semibold">{selectedMessage.subject || "(bez tematu)"}</h4>
                    <p className="text-xs text-zinc-500">
                      {tab === "inbox" ? `Od: ${selectedMessage.sender_label}` : `Do: ${selectedMessage.recipient_label}`} · {formatDate(selectedMessage.created_at)}
                    </p>
                  </div>
                  {selectedMessage.sender_id && selectedMessage.sender_id !== currentUserId ? (
                    <button type="button" onClick={() => startReply(selectedMessage)} className="rounded-lg border px-3 py-1 text-sm">
                      Odpowiedz
                    </button>
                  ) : null}
                </div>
                <div className="max-h-[42vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border p-3 text-sm">
                  {selectedMessage.body}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Wybierz wiadomość z listy.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
