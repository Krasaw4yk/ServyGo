"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelBooking,
  getInboxMessages,
  getSentMessages,
  getUnreadMessagesCount,
  markMessageAsRead,
  respondToBookingQuote,
  respondToBookingReschedule,
  sendInternalMessage,
  sendSystemMessage,
  type InternalMessage,
  type InternalMessageRole,
} from "@/lib/messagesApi";
import { supabase } from "@/lib/supabaseClient";
import { sendBookingEmailNotification } from "@/lib/notificationApi";

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
  const [relatedBookingId, setRelatedBookingId] = useState<string | null>(null);
  const [relatedWorkshopId, setRelatedWorkshopId] = useState<string | null>(null);
  const [serviceRequestId, setServiceRequestId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => inbox.filter((x) => !x.is_read && x.recipient_id === currentUserId).length,
    [currentUserId, inbox],
  );

  const activeList = tab === "inbox" ? inbox : sent;
  const allMessages = useMemo(() => {
    const map = new Map<string, InternalMessage>();
    for (const message of [...inbox, ...sent]) map.set(message.id, message);
    return Array.from(map.values());
  }, [inbox, sent]);
  const activeThreads = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; latest: InternalMessage; unreadCount: number; messages: InternalMessage[] }
    >();
    const sorted = [...activeList].sort((a, b) => b.created_at.localeCompare(a.created_at));
    for (const message of sorted) {
      const key = message.related_booking_id
        ? `booking:${message.related_booking_id}`
        : message.service_request_id
          ? `request:${message.service_request_id}`
          : `single:${message.id}`;
      const label = message.related_booking_id
        ? `Rezerwacja #${message.related_booking_id.slice(0, 8)}`
        : message.service_request_id
          ? `Zapytanie #${message.service_request_id.slice(0, 8)}`
          : "Wiadomość";
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          key,
          label,
          latest: message,
          unreadCount: !message.is_read && message.recipient_id === currentUserId ? 1 : 0,
          messages: [message],
        });
      } else {
        existing.messages.push(message);
        if (!message.is_read && message.recipient_id === currentUserId) existing.unreadCount += 1;
      }
    }
    return Array.from(groups.values());
  }, [activeList, currentUserId]);
  const selectedThread = activeThreads.find((thread) => thread.key === selectedId) ?? null;
  const selectedMessage = selectedThread?.latest ?? null;
  const threadMessages = useMemo(() => {
    if (!selectedMessage) return [] as InternalMessage[];
    if (selectedMessage.related_booking_id) {
      return allMessages
        .filter((m) => m.related_booking_id === selectedMessage.related_booking_id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    if (selectedMessage.service_request_id) {
      return allMessages
        .filter((m) => m.service_request_id === selectedMessage.service_request_id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return [selectedMessage];
  }, [allMessages, selectedMessage]);

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
      if (!selectedId && inboxRows.length > 0) {
        const first = inboxRows[0];
        setSelectedId(first.related_booking_id ? `booking:${first.related_booking_id}` : first.service_request_id ? `request:${first.service_request_id}` : `single:${first.id}`);
      }
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
    setSelectedId(
      message.related_booking_id
        ? `booking:${message.related_booking_id}`
        : message.service_request_id
          ? `request:${message.service_request_id}`
          : `single:${message.id}`,
    );
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
    if (!recipientId.trim()) {
      setError("Brak odbiorcy dla tej rozmowy.");
      return;
    }
    if (!relatedBookingId && !serviceRequestId) {
      setError("Nowa wiadomość musi być powiązana z rezerwacją lub zapytaniem.");
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
        relatedBookingId,
        relatedWorkshopId,
        serviceRequestId,
      });
      setSubject("");
      setBody("");
      setRecipientId("");
      setRelatedBookingId(null);
      setRelatedWorkshopId(null);
      setServiceRequestId(null);
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
    setRelatedBookingId(message.related_booking_id ?? null);
    setRelatedWorkshopId(message.related_workshop_id ?? null);
    setServiceRequestId(message.service_request_id ?? null);
  }

  const canRespondToQuote = useMemo(() => {
    if (!selectedMessage) return false;
    if (selectedMessage.recipient_id !== currentUserId) return false;
    if (!selectedMessage.related_booking_id) return false;
    if (selectedMessage.sender_role !== "system") return false;
    const subject = (selectedMessage.subject ?? "").toLowerCase();
    return subject.includes("wycena");
  }, [currentUserId, selectedMessage]);

  const canRespondToReschedule = useMemo(() => {
    if (!selectedMessage) return false;
    if (selectedMessage.recipient_id !== currentUserId) return false;
    if (!selectedMessage.related_booking_id) return false;
    const subject = (selectedMessage.subject ?? "").toLowerCase();
    return subject.includes("propozycja nowego terminu");
  }, [currentUserId, selectedMessage]);

  async function notifyWorkshopAboutQuoteDecision(message: InternalMessage, accepted: boolean) {
    if (!supabase) return;
    if (!message.related_workshop_id || !message.related_booking_id) return;
    const { data: workshopRow } = await supabase
      .from("workshops")
      .select("owner_id, name")
      .eq("id", message.related_workshop_id)
      .maybeSingle();
    const ownerId = (workshopRow as { owner_id?: string | null } | null)?.owner_id ?? null;
    const workshopName = (workshopRow as { name?: string | null } | null)?.name ?? "Warsztat";
    await sendSystemMessage({
      recipientId: ownerId,
      recipientRole: "workshop",
      subject: accepted ? "Klient zaakceptował wycenę" : "Klient odrzucił wycenę",
      body: accepted
        ? `Klient zaakceptował wycenę dla rezerwacji (${message.related_booking_id}) w warsztacie ${workshopName}.`
        : `Klient odrzucił wycenę dla rezerwacji (${message.related_booking_id}) w warsztacie ${workshopName}.`,
      relatedBookingId: message.related_booking_id,
      relatedWorkshopId: message.related_workshop_id,
    });
    if (ownerId) {
      await sendBookingEmailNotification({
        bookingId: message.related_booking_id,
        workshopId: message.related_workshop_id,
        recipientId: ownerId,
        subject: accepted ? "ServyGo: klient zaakceptował wycenę" : "ServyGo: klient odrzucił wycenę",
        message: accepted
          ? "Klient zaakceptował wycenę. Sprawdź szczegóły w panelu ServyGo."
          : "Klient odrzucił wycenę. Sprawdź szczegóły w panelu ServyGo.",
      });
    }
  }

  async function handleQuoteDecision(accept: boolean) {
    if (!selectedMessage?.related_booking_id) return;
    setError("");
    setInfo("");
    try {
      await respondToBookingQuote(selectedMessage.related_booking_id, accept);
      await notifyWorkshopAboutQuoteDecision(selectedMessage, accept);
      setInfo(accept ? "Wycena została zaakceptowana." : "Wycena została odrzucona.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać decyzji.");
    }
  }

  async function handleCancelBooking() {
    if (!supabase) return;
    if (!selectedMessage?.related_booking_id) return;
    const reason = window.prompt("Podaj krótki powód anulowania:");
    if (!reason?.trim()) return;
    setError("");
    setInfo("");
    try {
      const status = await cancelBooking(selectedMessage.related_booking_id, reason.trim());
      if (selectedMessage.related_workshop_id) {
        const { data: workshopRow } = await supabase
          .from("workshops")
          .select("owner_id")
          .eq("id", selectedMessage.related_workshop_id)
          .maybeSingle();
        const ownerId = (workshopRow as { owner_id?: string | null } | null)?.owner_id ?? null;
        await sendSystemMessage({
          recipientId: ownerId,
          recipientRole: "workshop",
          subject: "Klient anulował rezerwację",
          body: `Powód anulowania: ${reason.trim()}`,
          relatedBookingId: selectedMessage.related_booking_id,
          relatedWorkshopId: selectedMessage.related_workshop_id,
        });
        if (ownerId) {
          await sendBookingEmailNotification({
            bookingId: selectedMessage.related_booking_id,
            workshopId: selectedMessage.related_workshop_id,
            recipientId: ownerId,
            subject: "ServyGo: klient anulował rezerwację",
            message: `Klient anulował rezerwację. Powód: ${reason.trim()}`,
          });
        }
      }
      setInfo(`Rezerwacja anulowana (${status}).`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się anulować rezerwacji.");
    }
  }

  async function handleRescheduleDecision(accept: boolean) {
    if (!selectedMessage?.related_booking_id) return;
    setError("");
    setInfo("");
    try {
      await respondToBookingReschedule(selectedMessage.related_booking_id, accept);
      if (selectedMessage.related_workshop_id && supabase) {
        const { data: workshopRow } = await supabase
          .from("workshops")
          .select("owner_id")
          .eq("id", selectedMessage.related_workshop_id)
          .maybeSingle();
        const ownerId = (workshopRow as { owner_id?: string | null } | null)?.owner_id ?? null;
        if (ownerId) {
          await sendSystemMessage({
            recipientId: ownerId,
            recipientRole: "workshop",
            subject: accept ? "Klient zaakceptował zmianę terminu" : "Klient odrzucił zmianę terminu",
            body: accept
              ? "Klient zaakceptował nowy termin rezerwacji."
              : "Klient odrzucił proponowaną zmianę terminu.",
            relatedBookingId: selectedMessage.related_booking_id,
            relatedWorkshopId: selectedMessage.related_workshop_id,
          });
          await sendBookingEmailNotification({
            bookingId: selectedMessage.related_booking_id,
            workshopId: selectedMessage.related_workshop_id,
            recipientId: ownerId,
            subject: accept ? "ServyGo: klient zaakceptował nowy termin" : "ServyGo: klient odrzucił nowy termin",
            message: accept
              ? "Klient zaakceptował propozycję zmiany terminu."
              : "Klient odrzucił propozycję zmiany terminu.",
          });
        }
      }
      setInfo(accept ? "Zaakceptowano nowy termin." : "Odrzucono propozycję nowego terminu.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać decyzji.");
    }
  }

  return (
    <div className={`rounded-2xl border p-4 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m4 7 8 6 8-6" />
          </svg>
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>Powiązana rezerwacja (UUID)</span>
              <input value={relatedBookingId ?? ""} onChange={(e) => setRelatedBookingId(e.target.value.trim() || null)} className="rounded-lg border px-3 py-2 text-sm text-black" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Powiązane zapytanie (UUID)</span>
              <input value={serviceRequestId ?? ""} onChange={(e) => setServiceRequestId(e.target.value.trim() || null)} className="rounded-lg border px-3 py-2 text-sm text-black" />
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
            {activeThreads.length === 0 ? (
              <p className="px-3 py-4 text-sm text-zinc-500">Brak wiadomości.</p>
            ) : (
              activeThreads.map((thread) => (
                <button
                  key={thread.key}
                  type="button"
                  onClick={() => void openMessage(thread.latest)}
                  className={`w-full border-b px-3 py-2 text-left last:border-b-0 ${selectedId === thread.key ? (isDark ? "bg-zinc-800" : "bg-blue-50") : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm font-medium ${thread.unreadCount > 0 ? "text-blue-500" : ""}`}>{thread.latest.subject || "(bez tematu)"}</p>
                    {thread.unreadCount > 0 ? <span className="h-2 w-2 rounded-full bg-rose-500" /> : null}
                  </div>
                  <p className="truncate text-xs text-zinc-500">{thread.label} · {tab === "inbox" ? `Od: ${thread.latest.sender_label}` : `Do: ${thread.latest.recipient_label}`}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">{formatDate(thread.latest.created_at)} · {thread.unreadCount > 0 ? "nieprzeczytane" : "przeczytane"}</p>
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
                <div className="max-h-[42vh] space-y-2 overflow-y-auto rounded-lg border p-3 text-sm">
                  {threadMessages.map((msg) => (
                    <div key={msg.id} className={`rounded-lg border p-2 ${msg.sender_id === currentUserId ? (isDark ? "border-blue-500/40 bg-blue-950/30" : "border-blue-200 bg-blue-50") : (isDark ? "border-zinc-700 bg-zinc-900/60" : "border-zinc-200 bg-white")}`}>
                      <p className="text-xs text-zinc-500">{msg.sender_label} · {formatDate(msg.created_at)}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words">{msg.body}</p>
                    </div>
                  ))}
                </div>
                {viewerRole === "client" && selectedMessage.related_booking_id ? (
                  <div className="flex flex-wrap gap-2">
                    {canRespondToQuote ? (
                      <>
                        <button type="button" onClick={() => void handleQuoteDecision(true)} className="rounded-lg border border-emerald-500/60 px-3 py-1 text-sm font-semibold">
                          Akceptuję wycenę
                        </button>
                        <button type="button" onClick={() => void handleQuoteDecision(false)} className="rounded-lg border border-rose-500/60 px-3 py-1 text-sm font-semibold">
                          Odrzucam wycenę
                        </button>
                      </>
                    ) : null}
                    {canRespondToReschedule ? (
                      <>
                        <button type="button" onClick={() => void handleRescheduleDecision(true)} className="rounded-lg border border-purple-500/60 px-3 py-1 text-sm font-semibold">
                          Akceptuję nowy termin
                        </button>
                        <button type="button" onClick={() => void handleRescheduleDecision(false)} className="rounded-lg border border-zinc-500/60 px-3 py-1 text-sm font-semibold">
                          Odrzucam nowy termin
                        </button>
                      </>
                    ) : null}
                    <button type="button" onClick={() => void handleCancelBooking()} className="rounded-lg border border-zinc-500/60 px-3 py-1 text-sm">
                      Anuluj rezerwację
                    </button>
                  </div>
                ) : null}
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
