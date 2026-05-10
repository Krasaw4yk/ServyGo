"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CompletionCheckNotificationCard from "@/components/CompletionCheckNotificationCard";
import {
  cancelBooking,
  getInboxMessages,
  getSentMessages,
  markMessageAsRead,
  respondToBookingQuote,
  respondToBookingReschedule,
  sendInternalMessage,
  sendSystemMessage,
  type InternalMessage,
  type InternalMessageRole,
} from "@/lib/messagesApi";
import {
  getUnifiedUnreadCount,
  listUserNotifications,
  markNotificationAsRead,
  type UserNotificationRow,
} from "@/lib/notificationsApi";
import { supabase } from "@/lib/supabaseClient";
import { sendBookingEmailNotification } from "@/lib/notificationApi";
import { useInboxRealtimeSync } from "@/lib/useServyGoRealtime";
import { clientCanRespondToActiveBookingQuote } from "@/lib/bookingStatusUi";
import { fillTemplate } from "@/lib/fillTemplate";
import { localeTagForLanguage } from "@/lib/dateLocale";
import { useServyGoTranslator } from "@/lib/useServyGoLanguage";

function formatInboxLoadError(e: unknown, t: (path: string) => string): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const msg = raw.trim() || t("commonUi.unknownError");
  if (/failed to fetch dynamically imported module/i.test(msg) || /loading chunk \d+ failed/i.test(msg)) {
    return t("inboxPage.loadErrorChunk");
  }
  if (/failed to fetch/i.test(msg) || /networkerror/i.test(msg)) {
    return t("inboxPage.loadErrorNetwork");
  }
  if (msg.length > 220) {
    return t("inboxPage.loadErrorGeneric");
  }
  return msg;
}

type InternalInboxProps = {
  currentUserId: string;
  isDark: boolean;
  viewerRole: InternalMessageRole;
  includeAllForAdmin?: boolean;
  onUnreadCountChange?: (count: number) => void;
  /** Tekst gdy lista jest pusta (np. strona /moje-wiadomosci). */
  emptySidebarHint?: string;
  /** Ukrywa powielony tytuł „Moje wiadomości” w karcie (gdy nagłówek jest na stronie nadrzędnej). */
  embeddedInPage?: boolean;
  /** Widok komunikatora (mobile: lista ⇄ pełny ekran; desktop: dwie kolumny). */
  enableMobileMessenger?: boolean;
};

function bookingListHref(viewerRole: InternalMessageRole): string {
  if (viewerRole === "workshop") return "/workshop-panel?section=Rezerwacje";
  if (viewerRole === "admin") return "/admin";
  return "/moje-rezerwacje";
}

export default function InternalInbox({
  currentUserId,
  isDark,
  viewerRole,
  includeAllForAdmin = false,
  onUnreadCountChange,
  emptySidebarHint,
  embeddedInPage = false,
  enableMobileMessenger = false,
}: InternalInboxProps) {
  const { t, language } = useServyGoTranslator();
  const dateLocaleTag = localeTagForLanguage(language);
  function formatDate(value: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString(dateLocaleTag);
  }

  const [loading, setLoading] = useState(true);
  const [inbox, setInbox] = useState<InternalMessage[]>([]);
  const [sent, setSent] = useState<InternalMessage[]>([]);
  const [notifications, setNotifications] = useState<UserNotificationRow[]>([]);
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
  const [bookingClientUserId, setBookingClientUserId] = useState<string | null>(null);
  const [workshopReplyBody, setWorkshopReplyBody] = useState("");
  const [workshopReplyBusy, setWorkshopReplyBusy] = useState(false);
  const [workshopOwnerUserId, setWorkshopOwnerUserId] = useState<string | null>(null);
  const [clientReplyBody, setClientReplyBody] = useState("");
  const [clientReplyBusy, setClientReplyBusy] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [clientQuoteUi, setClientQuoteUi] = useState<{
    loadState: "idle" | "loading" | "ready";
    canRespond: boolean;
    confirmedReadonly: boolean;
  }>({ loadState: "idle", canRespond: false, confirmedReadonly: false });

  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  useEffect(() => {
    onUnreadCountChangeRef.current = onUnreadCountChange;
  }, [onUnreadCountChange]);

  const reloadGeneration = useRef(0);
  const composeGuardGen = useRef(0);
  const wideLayoutEffectGen = useRef(0);
  const workshopOwnerLookupGen = useRef(0);
  const clientQuoteLookupGen = useRef(0);
  const bookingClientLookupGen = useRef(0);

  const unreadCount = useMemo(() => {
    const msg = inbox.filter((x) => !x.is_read && x.recipient_id === currentUserId).length;
    const nfn = notifications.filter((x) => !x.is_read).length;
    return msg + nfn;
  }, [currentUserId, inbox, notifications]);

  const canUseAdminCompose = viewerRole === "admin";

  const resolvedEmptyListHint = useMemo(() => {
    if (viewerRole === "admin") return emptySidebarHint ?? t("inboxPage.emptyListAdmin");
    if (enableMobileMessenger) {
      if (viewerRole === "workshop") return t("inboxPage.emptyListWorkshop");
      return t("inboxPage.emptyListClient");
    }
    return emptySidebarHint ?? t("inboxPage.emptyListAdmin");
  }, [viewerRole, emptySidebarHint, enableMobileMessenger, t]);

  useEffect(() => {
    const gen = ++composeGuardGen.current;
    if (!canUseAdminCompose && composeOpen) {
      queueMicrotask(() => {
        if (gen !== composeGuardGen.current) return;
        setComposeOpen(false);
      });
    }
  }, [canUseAdminCompose, composeOpen]);

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
    const sorted = [...allMessages].sort((a, b) => b.created_at.localeCompare(a.created_at));
    for (const message of sorted) {
      const key = message.related_booking_id
        ? `booking:${message.related_booking_id}`
        : message.service_request_id
          ? `request:${message.service_request_id}`
          : `single:${message.id}`;
      const label = message.related_booking_id
        ? fillTemplate(t("inboxPage.threadLabelBooking"), { id: message.related_booking_id.slice(0, 8) })
        : message.service_request_id
          ? fillTemplate(t("inboxPage.threadLabelRequest"), { id: message.service_request_id.slice(0, 8) })
          : t("inboxPage.threadLabelMessage");
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
  }, [allMessages, currentUserId, t]);

  const mergedSidebarRows = useMemo(() => {
    type Row =
      | { kind: "notification"; key: string; sortMs: number; notification: UserNotificationRow }
      | { kind: "message"; key: string; sortMs: number; thread: (typeof activeThreads)[number] };
    const rows: Row[] = [];
    for (const n of notifications) {
      const sortMs = new Date(n.created_at).getTime();
      rows.push({ kind: "notification", key: `notification:${n.id}`, sortMs, notification: n });
    }
    for (const thread of activeThreads) {
      const sortMs = new Date(thread.latest.created_at).getTime();
      rows.push({ kind: "message", key: thread.key, sortMs, thread });
    }
    rows.sort((a, b) => b.sortMs - a.sortMs);
    return rows;
  }, [notifications, activeThreads]);

  const [wideDesktop, setWideDesktop] = useState(true);
  useEffect(() => {
    const gen = ++wideLayoutEffectGen.current;
    if (!enableMobileMessenger) {
      queueMicrotask(() => {
        if (gen !== wideLayoutEffectGen.current) return;
        setWideDesktop(true);
      });
      return;
    }
    const mq = window.matchMedia("(min-width:768px)");
    const sync = () => setWideDesktop(mq.matches);
    const rafId = window.requestAnimationFrame(() => {
      if (gen !== wideLayoutEffectGen.current) return;
      sync();
    });
    mq.addEventListener("change", sync);
    return () => {
      window.cancelAnimationFrame(rafId);
      mq.removeEventListener("change", sync);
    };
  }, [enableMobileMessenger]);

  const resolvedSelectedKey = useMemo(() => {
    if (loading || mergedSidebarRows.length === 0) return null;
    if (enableMobileMessenger && !wideDesktop) return selectedId;
    if (selectedId && mergedSidebarRows.some((r) => r.key === selectedId)) return selectedId;
    return mergedSidebarRows[0].key;
  }, [loading, mergedSidebarRows, enableMobileMessenger, wideDesktop, selectedId]);

  const selectedThread = activeThreads.find((thread) => thread.key === resolvedSelectedKey) ?? null;
  const selectedMessage = selectedThread?.latest ?? null;
  const selectedNotification = useMemo(() => {
    if (!resolvedSelectedKey?.startsWith("notification:")) return null;
    const nid = resolvedSelectedKey.slice("notification:".length);
    return notifications.find((x) => x.id === nid) ?? null;
  }, [resolvedSelectedKey, notifications]);
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

  useEffect(() => {
    const gen = ++workshopOwnerLookupGen.current;
    const sb = supabase;
    if (viewerRole !== "client" || !selectedMessage?.related_booking_id || !sb) {
      queueMicrotask(() => {
        if (gen !== workshopOwnerLookupGen.current) return;
        setWorkshopOwnerUserId(null);
      });
      return;
    }
    let cancelled = false;
    void sb
      .from("bookings")
      .select("workshop_id")
      .eq("id", selectedMessage.related_booking_id)
      .maybeSingle()
      .then(async ({ data: bRow, error }) => {
        if (cancelled || error || gen !== workshopOwnerLookupGen.current) return;
        const wid = (bRow as { workshop_id?: string } | null)?.workshop_id;
        if (!wid) return;
        const { data: wRow } = await sb.from("workshops").select("owner_id").eq("id", wid).maybeSingle();
        if (cancelled || gen !== workshopOwnerLookupGen.current) return;
        setWorkshopOwnerUserId((wRow as { owner_id?: string | null } | null)?.owner_id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [viewerRole, selectedMessage?.related_booking_id]);

  useEffect(() => {
    const gen = ++clientQuoteLookupGen.current;
    const sb = supabase;
    if (viewerRole !== "client" || !selectedMessage?.related_booking_id || !sb) {
      queueMicrotask(() => {
        if (gen !== clientQuoteLookupGen.current) return;
        setClientQuoteUi({ loadState: "idle", canRespond: false, confirmedReadonly: false });
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || gen !== clientQuoteLookupGen.current) return;
      setClientQuoteUi((prev) => ({ ...prev, loadState: "loading" }));
    });
    void (async () => {
      const bid = selectedMessage.related_booking_id!;
      const { data: bRow, error: bErr } = await sb.from("bookings").select("status, current_quote_id").eq("id", bid).maybeSingle();
      if (cancelled || gen !== clientQuoteLookupGen.current) return;
      if (bErr || !bRow) {
        if (gen !== clientQuoteLookupGen.current) return;
        setClientQuoteUi({ loadState: "ready", canRespond: false, confirmedReadonly: false });
        return;
      }
      const st = ((bRow as { status?: string | null }).status ?? "").trim().toLowerCase();
      const cur = ((bRow as { current_quote_id?: string | null }).current_quote_id ?? "").trim();
      if (st === "confirmed" && cur) {
        if (gen !== clientQuoteLookupGen.current) return;
        setClientQuoteUi({ loadState: "ready", canRespond: false, confirmedReadonly: true });
        return;
      }
      if (st !== "quote_sent" || !cur) {
        if (gen !== clientQuoteLookupGen.current) return;
        setClientQuoteUi({ loadState: "ready", canRespond: false, confirmedReadonly: false });
        return;
      }
      const { data: qRow, error: qErr } = await sb.from("booking_quotes").select("status").eq("id", cur).maybeSingle();
      if (cancelled || gen !== clientQuoteLookupGen.current) return;
      if (qErr) {
        setClientQuoteUi({ loadState: "ready", canRespond: false, confirmedReadonly: false });
        return;
      }
      const qStatus = ((qRow as { status?: string | null } | null)?.status ?? null) as string | null;
      const canRespond = clientCanRespondToActiveBookingQuote({
        bookingStatusRaw: (bRow as { status?: string | null }).status,
        currentQuoteId: cur,
        currentQuoteRowStatus: qStatus,
      });
      if (gen !== clientQuoteLookupGen.current) return;
      setClientQuoteUi({ loadState: "ready", canRespond, confirmedReadonly: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerRole, selectedMessage?.related_booking_id, selectedMessage?.id, loading]);

  const reload = useCallback(async () => {
    const gen = ++reloadGeneration.current;
    setLoading(true);
    setError("");
    try {
      const [noteRows, inboxRows, sentRows, unread] = await Promise.all([
        listUserNotifications(currentUserId),
        getInboxMessages(currentUserId, includeAllForAdmin),
        getSentMessages(currentUserId),
        getUnifiedUnreadCount(currentUserId, includeAllForAdmin),
      ]);
      if (gen !== reloadGeneration.current) return;
      setNotifications(noteRows);
      setInbox(inboxRows);
      setSent(sentRows);
      onUnreadCountChangeRef.current?.(unread);
    } catch (e) {
      if (gen !== reloadGeneration.current) return;
      setError(formatInboxLoadError(e, t));
    } finally {
      if (gen === reloadGeneration.current) {
        setLoading(false);
      }
    }
  }, [currentUserId, includeAllForAdmin, t]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void reload());
    return () => window.cancelAnimationFrame(frame);
  }, [reload]);

  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);
  useInboxRealtimeSync(Boolean(supabase && currentUserId), currentUserId, () => {
    void reloadRef.current();
  });

  useEffect(() => {
    if (!enableMobileMessenger) return;
    const mq = window.matchMedia("(min-width:768px)");
    function onMqChange() {
      if (!mq.matches) return;
      setMobileView("list");
    }
    mq.addEventListener("change", onMqChange);
    return () => mq.removeEventListener("change", onMqChange);
  }, [enableMobileMessenger]);

  useEffect(() => {
    if (!enableMobileMessenger) return;
    const mq = window.matchMedia("(min-width:768px)");
    function applyBodyScrollLock() {
      const narrow = !mq.matches;
      document.body.style.overflow = narrow && mobileView === "chat" ? "hidden" : "";
    }
    applyBodyScrollLock();
    mq.addEventListener("change", applyBodyScrollLock);
    return () => {
      mq.removeEventListener("change", applyBodyScrollLock);
      document.body.style.overflow = "";
    };
  }, [enableMobileMessenger, mobileView]);

  useEffect(() => {
    const gen = ++bookingClientLookupGen.current;
    if (viewerRole !== "workshop" || !selectedMessage?.related_booking_id || !supabase) {
      queueMicrotask(() => {
        if (gen !== bookingClientLookupGen.current) return;
        setBookingClientUserId(null);
      });
      return;
    }
    let cancelled = false;
    void supabase
      .from("bookings")
      .select("user_id")
      .eq("id", selectedMessage.related_booking_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || gen !== bookingClientLookupGen.current) return;
        const uid = (data as { user_id?: string } | null)?.user_id ?? null;
        setBookingClientUserId(uid);
      });
    return () => {
      cancelled = true;
    };
  }, [viewerRole, selectedMessage?.related_booking_id]);

  async function openMessage(message: InternalMessage) {
    const narrowMessenger =
      enableMobileMessenger && typeof window !== "undefined" && !window.matchMedia("(min-width:768px)").matches;
    const key = message.related_booking_id
      ? `booking:${message.related_booking_id}`
      : message.service_request_id
        ? `request:${message.service_request_id}`
        : `single:${message.id}`;
    setSelectedId(key);
    if (narrowMessenger) setMobileView("chat");

    const threadMsgs = message.related_booking_id
      ? allMessages.filter((m) => m.related_booking_id === message.related_booking_id)
      : message.service_request_id
        ? allMessages.filter((m) => m.service_request_id === message.service_request_id)
        : [message];

    const unreadIds = threadMsgs.filter((m) => !m.is_read && m.recipient_id === currentUserId).map((m) => m.id);
    if (unreadIds.length === 0) return;
    try {
      await Promise.all(unreadIds.map((id) => markMessageAsRead(id)));
      setInbox((prev) => prev.map((row) => (unreadIds.includes(row.id) ? { ...row, is_read: true } : row)));
      const unread = await getUnifiedUnreadCount(currentUserId, includeAllForAdmin);
      onUnreadCountChange?.(unread);
    } catch {
      // best effort
    }
  }

  async function openNotification(row: UserNotificationRow) {
    const narrowMessenger =
      enableMobileMessenger && typeof window !== "undefined" && !window.matchMedia("(min-width:768px)").matches;
    setSelectedId(`notification:${row.id}`);
    if (narrowMessenger) setMobileView("chat");
    if (!row.is_read) {
      try {
        await markNotificationAsRead(row.id);
        setNotifications((prev) => prev.map((x) => (x.id === row.id ? { ...x, is_read: true } : x)));
        const unread = await getUnifiedUnreadCount(currentUserId, includeAllForAdmin);
        onUnreadCountChange?.(unread);
      } catch {
        // best effort
      }
    }
  }

  async function sendMessage() {
    if (!canUseAdminCompose) {
      setError(t("inboxPage.errAdminOnlyCompose"));
      setComposeOpen(false);
      return;
    }
    setError("");
    setInfo("");
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError(t("inboxPage.errBodyRequired"));
      return;
    }
    if (!recipientId.trim()) {
      setError(t("inboxPage.errRecipientMissing"));
      return;
    }
    if (!relatedBookingId && !serviceRequestId) {
      setError(t("inboxPage.errComposeNeedsLink"));
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
      setInfo(t("inboxPage.infoMessageSent"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("inboxPage.sendFailed"));
    } finally {
      setSending(false);
    }
  }

  async function sendClientReplyToWorkshop() {
    const trimmed = clientReplyBody.trim();
    if (!trimmed || !workshopOwnerUserId || !selectedMessage?.related_booking_id) {
      setError(t("inboxPage.errBodyRequired"));
      return;
    }
    setClientReplyBusy(true);
    setError("");
    try {
      await sendInternalMessage({
        senderId: currentUserId,
        recipientId: workshopOwnerUserId,
        senderRole: "client",
        recipientRole: "workshop",
        subject: selectedMessage.subject ? `${t("inboxPage.replySubjectPrefix")}${selectedMessage.subject}` : t("inboxPage.subjectFromClient"),
        body: trimmed,
        relatedBookingId: selectedMessage.related_booking_id,
        relatedWorkshopId: selectedMessage.related_workshop_id,
      });
      setClientReplyBody("");
      setInfo(t("inboxPage.sentToWorkshopInfo"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("inboxPage.sendFailed"));
    } finally {
      setClientReplyBusy(false);
    }
  }

  async function sendWorkshopReplyToClient() {
    const trimmed = workshopReplyBody.trim();
    if (!trimmed || !bookingClientUserId || !selectedMessage?.related_booking_id) {
      setError(t("inboxPage.errReplyBodyRequired"));
      return;
    }
    setWorkshopReplyBusy(true);
    setError("");
    try {
      await sendInternalMessage({
        senderId: currentUserId,
        recipientId: bookingClientUserId,
        senderRole: viewerRole,
        recipientRole: "client",
        subject: t("inboxPage.subjectFromWorkshop"),
        body: trimmed,
        relatedBookingId: selectedMessage.related_booking_id,
        relatedWorkshopId: selectedMessage.related_workshop_id,
      });
      setWorkshopReplyBody("");
      setInfo(t("inboxPage.sentReplyToClientInfo"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("inboxPage.sendFailed"));
    } finally {
      setWorkshopReplyBusy(false);
    }
  }

  function startReply(message: InternalMessage) {
    if (!canUseAdminCompose) return;
    setComposeOpen(true);
    setSubject(message.subject ? `${t("inboxPage.replySubjectPrefix")}${message.subject}` : t("inboxPage.replySubjectFallback"));
    setBody(`\n\n---\n${message.body}`);
    setRecipientId(message.sender_id ?? "");
    setRecipientRole((message.sender_role as InternalMessageRole) ?? "client");
    setRelatedBookingId(message.related_booking_id ?? null);
    setRelatedWorkshopId(message.related_workshop_id ?? null);
    setServiceRequestId(message.service_request_id ?? null);
  }

  const canRespondToQuote = useMemo(() => {
    if (!selectedMessage) return false;
    if (viewerRole !== "client") return false;
    if (selectedMessage.recipient_id !== currentUserId) return false;
    if (!selectedMessage.related_booking_id) return false;
    if (selectedMessage.sender_role !== "system") return false;
    const subject = (selectedMessage.subject ?? "").toLowerCase();
    const aboutQuote =
      subject.includes("wycena") || subject.includes("wycenę") || subject.includes("nowa wycena");
    if (!aboutQuote) return false;
    if (clientQuoteUi.loadState !== "ready") return false;
    return clientQuoteUi.canRespond;
  }, [currentUserId, selectedMessage, viewerRole, clientQuoteUi]);

  const canRespondToReschedule = useMemo(() => {
    if (!selectedMessage) return false;
    if (selectedMessage.recipient_id !== currentUserId) return false;
    if (!selectedMessage.related_booking_id) return false;
    const subject = (selectedMessage.subject ?? "").toLowerCase();
    return subject.includes("propozycja") && subject.includes("termin");
  }, [currentUserId, selectedMessage]);

  function bubbleTone(msg: InternalMessage) {
    const sub = (msg.subject ?? "").toLowerCase();
    const bodyLower = (msg.body ?? "").toLowerCase();
    if (sub.includes("zaakceptował wycenę") || bodyLower.includes("zaakceptował wycenę")) {
      return isDark ? "border-emerald-500/40 bg-emerald-950/35 shadow-md" : "border-emerald-200 bg-emerald-50 shadow-md";
    }
    if (sub.includes("odrzucił wycenę") || bodyLower.includes("odrzucił wycenę")) {
      return isDark ? "border-rose-500/45 bg-rose-950/35 shadow-md" : "border-rose-200 bg-rose-50 shadow-md";
    }
    if (msg.sender_role === "system") {
      return isDark ? "border-violet-500/35 bg-violet-950/25 shadow-md" : "border-violet-200 bg-violet-50/90 shadow-md";
    }
    return msg.sender_id === currentUserId
      ? isDark
        ? "border-blue-500/40 bg-blue-950/30 shadow-md"
        : "border-blue-200 bg-blue-50 shadow-md"
      : isDark
        ? "border-zinc-600 bg-zinc-900/70 shadow-md"
        : "border-zinc-200 bg-white shadow-md";
  }

  async function notifyWorkshopAboutQuoteDecisionEmailOnly(message: InternalMessage, accepted: boolean) {
    if (!supabase) return;
    if (!message.related_workshop_id || !message.related_booking_id) return;
    const { data: workshopRow } = await supabase
      .from("workshops")
      .select("owner_id, name")
      .eq("id", message.related_workshop_id)
      .maybeSingle();
    const ownerId = (workshopRow as { owner_id?: string | null } | null)?.owner_id ?? null;
    if (ownerId) {
      await sendBookingEmailNotification({
        bookingId: message.related_booking_id,
        workshopId: message.related_workshop_id,
        recipientId: ownerId,
        subject: accepted ? t("inboxPage.emailServygoQuoteAccepted") : t("inboxPage.emailServygoQuoteRejected"),
        message: accepted
          ? `${t("inboxPage.emailShortQuoteAccepted")} ${t("inboxPage.quoteDetailsInServyGo")}`
          : `${t("inboxPage.emailShortQuoteRejected")} ${t("inboxPage.quoteDetailsInServyGo")}`,
      });
    }
  }

  async function handleQuoteDecision(accept: boolean) {
    if (!selectedMessage?.related_booking_id || !supabase) return;
    setError("");
    setInfo("");
    try {
      const { data: bRow, error: bErr } = await supabase
        .from("bookings")
        .select("current_quote_id, quoted_price, final_price")
        .eq("id", selectedMessage.related_booking_id)
        .maybeSingle();
      if (bErr) throw new Error(bErr.message);
      const qid = ((bRow as { current_quote_id?: string | null } | null)?.current_quote_id ?? "").trim();
      if (!qid) throw new Error(t("inboxPage.errNoActiveQuote"));
      await respondToBookingQuote(selectedMessage.related_booking_id, qid, accept);
      await notifyWorkshopAboutQuoteDecisionEmailOnly(selectedMessage, accept);
      setInfo(accept ? t("inboxPage.quoteAcceptedInfo") : t("inboxPage.quoteRejectedInfo"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("inboxPage.quoteDecisionSaveError"));
    }
  }

  async function handleCancelBooking() {
    if (!supabase) return;
    if (!selectedMessage?.related_booking_id) return;
    const reason = window.prompt(t("inboxPage.promptCancelReason"));
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
          subject: t("inboxPage.systemSubjectClientCancelled"),
          body: `${t("inboxPage.systemBodyCancelPrefix")} ${reason.trim()}`,
          relatedBookingId: selectedMessage.related_booking_id,
          relatedWorkshopId: selectedMessage.related_workshop_id,
        });
        if (ownerId) {
          await sendBookingEmailNotification({
            bookingId: selectedMessage.related_booking_id,
            workshopId: selectedMessage.related_workshop_id,
            recipientId: ownerId,
            subject: t("inboxPage.emailServygoBookingCancelled"),
            message: fillTemplate(t("inboxPage.emailCancelNotificationBody"), { reason: reason.trim() }),
          });
        }
      }
      setInfo(fillTemplate(t("inboxPage.infoBookingCancelled"), { status }));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("inboxPage.cancelBookingError"));
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
            subject: accept
              ? t("bookingsPage.systemSubjectClientAcceptedReschedule")
              : t("bookingsPage.systemSubjectClientRejectedReschedule"),
            body: accept ? t("inboxPage.rescheduleSystemBodyAccepted") : t("inboxPage.rescheduleSystemBodyRejected"),
            relatedBookingId: selectedMessage.related_booking_id,
            relatedWorkshopId: selectedMessage.related_workshop_id,
          });
          await sendBookingEmailNotification({
            bookingId: selectedMessage.related_booking_id,
            workshopId: selectedMessage.related_workshop_id,
            recipientId: ownerId,
            subject: accept ? t("inboxPage.emailServygoRescheduleAccepted") : t("inboxPage.emailServygoRescheduleRejected"),
            message: accept ? t("inboxPage.emailShortRescheduleAccepted") : t("inboxPage.emailShortRescheduleRejected"),
          });
        }
      }
      setInfo(accept ? t("inboxPage.rescheduleAcceptedInfo") : t("inboxPage.rescheduleRejectedInfo"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("inboxPage.quoteDecisionSaveError"));
    }
  }

  function notificationKindLabel(n: UserNotificationRow): string {
    if (n.notification_type === "completion_check") return t("inboxPage.notificationKindCompletion");
    if (n.notification_type === "visit_reminder") return t("inboxPage.notificationKindVisitReminder");
    return t("inboxPage.notificationKindGeneric");
  }

  function threadPartnerSubtitle(): string {
    if (!selectedMessage) return "";
    const w = threadMessages.find((m) => m.sender_role === "workshop");
    if (w?.sender_label) return w.sender_label;
    const c = threadMessages.find((m) => m.sender_role === "client");
    if (viewerRole === "workshop" && c?.sender_label) return c.sender_label;
    const other = threadMessages.find((m) => m.sender_id !== currentUserId);
    return other?.sender_label ?? selectedMessage.sender_label ?? "";
  }

  function mobileBubbleClass(msg: InternalMessage): { row: string; bubble: string; meta: string; body: string } {
    const isSystem = msg.sender_role === "system";
    const isMine = !isSystem && msg.sender_id === currentUserId;
    if (isSystem) {
      return {
        row: "justify-center",
        bubble: isDark
          ? "max-w-[min(92%,420px)] rounded-2xl border border-violet-500/35 bg-violet-950/30 px-3 py-2 text-center shadow-sm"
          : "max-w-[min(92%,420px)] rounded-2xl border border-violet-200 bg-violet-50/95 px-3 py-2 text-center shadow-sm",
        meta: `${isDark ? "text-zinc-400" : "text-zinc-500"} text-center text-[11px]`,
        body: `${isDark ? "text-zinc-200" : "text-zinc-800"}`,
      };
    }
    if (isMine) {
      return {
        row: "justify-end",
        bubble: isDark
          ? "max-w-[80%] rounded-2xl border border-blue-500/35 bg-blue-600 px-3 py-2 shadow-sm"
          : "max-w-[80%] rounded-2xl border border-blue-500/40 bg-blue-600 px-3 py-2 text-white shadow-sm",
        meta: `${isDark ? "text-blue-100/85" : "text-blue-50/90"} text-[11px]`,
        body: `${isDark ? "text-blue-50" : "text-white"}`,
      };
    }
    return {
      row: "justify-start",
      bubble: isDark
        ? "max-w-[80%] rounded-2xl border border-blue-900/45 bg-zinc-800/90 px-3 py-2 shadow-sm"
        : "max-w-[80%] rounded-2xl border border-blue-100 bg-white/90 px-3 py-2 shadow-sm",
      meta: `${isDark ? "text-zinc-400" : "text-zinc-500"} text-[11px]`,
      body: `${isDark ? "text-zinc-100" : "text-zinc-900"}`,
    };
  }

  const shellClass = enableMobileMessenger
    ? "w-full overflow-x-hidden border-0 bg-transparent p-0"
    : `rounded-2xl border p-4 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`;

  const toolbarTitle = (
    <div className="flex items-center gap-2">
      {!embeddedInPage ? (
        <>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m4 7 8 6 8-6" />
          </svg>
          <h3 className="text-lg font-semibold">{t("inboxPage.toolbarTitle")}</h3>
        </>
      ) : (
        <span className={`text-sm font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{t("inboxPage.toolbarTitle")}</span>
      )}
      {unreadCount > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </div>
  );

  const toolbarButtonsClassic = (
    <div className="flex gap-2">
      {canUseAdminCompose ? (
        <button type="button" onClick={() => setComposeOpen((prev) => !prev)} className="rounded-lg border px-3 py-1.5 text-sm">
          {composeOpen ? t("commonUi.close") : t("inboxPage.composeNew")}
        </button>
      ) : null}
      <button type="button" onClick={() => void reload()} className="rounded-lg border px-3 py-1.5 text-sm">
        {t("commonUi.refresh")}
      </button>
    </div>
  );

  const toolbarButtonsMobileMessenger = (
    <div className="flex flex-wrap gap-3">
      {canUseAdminCompose ? (
        <button
          type="button"
          onClick={() => setComposeOpen((prev) => !prev)}
          className={`rounded-2xl border px-4 py-2 text-sm shadow-sm ${isDark ? "border-blue-800/60 bg-zinc-900/90" : "border-blue-100 bg-white/90"}`}
        >
          {composeOpen ? t("commonUi.close") : t("inboxPage.composeNew")}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void reload()}
        className={`rounded-2xl border px-4 py-2 text-sm shadow-sm ${isDark ? "border-blue-800/60 bg-zinc-900/90" : "border-blue-100 bg-white/90"}`}
      >
        {t("commonUi.refresh")}
      </button>
    </div>
  );

  const toolbarRowClassic = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      {toolbarTitle}
      {toolbarButtonsClassic}
    </div>
  );

  const composeClassic = canUseAdminCompose && composeOpen ? (
    <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("inboxPage.roleRecipient")}</span>
          <select value={recipientRole} onChange={(e) => setRecipientRole(e.target.value as InternalMessageRole)} className="rounded-lg border px-3 py-2 text-sm text-black">
            <option value="admin">{t("inboxPage.roleAdmin")}</option>
            <option value="workshop">{t("inboxPage.roleWorkshop")}</option>
            <option value="client">{t("inboxPage.roleClient")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("inboxPage.recipientUuid")}</span>
          <input value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm text-black" placeholder={t("inboxPage.recipientUuidPlaceholder")} />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("inboxPage.relatedBookingUuid")}</span>
          <input value={relatedBookingId ?? ""} onChange={(e) => setRelatedBookingId(e.target.value.trim() || null)} className="rounded-lg border px-3 py-2 text-sm text-black" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("inboxPage.relatedRequestUuid")}</span>
          <input value={serviceRequestId ?? ""} onChange={(e) => setServiceRequestId(e.target.value.trim() || null)} className="rounded-lg border px-3 py-2 text-sm text-black" />
        </label>
      </div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border px-3 py-2 text-sm text-black" placeholder={t("inboxPage.subjectPlaceholder")} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="rounded-lg border px-3 py-2 text-sm text-black" placeholder={t("inboxPage.bodyPlaceholder")} />
      <div>
        <button type="button" disabled={sending} onClick={() => void sendMessage()} className="rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:opacity-60">
          {sending ? t("commonUi.sending") : t("commonUi.send")}
        </button>
      </div>
    </div>
  ) : null;

  const composeMobileMessenger = canUseAdminCompose && composeOpen ? (
    <div className={`mb-4 grid grid-cols-1 gap-3 rounded-2xl border p-4 shadow-sm ${isDark ? "border-zinc-700 bg-zinc-900/85" : "border-blue-100 bg-white/90"}`}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("inboxPage.roleRecipient")}</span>
          <select value={recipientRole} onChange={(e) => setRecipientRole(e.target.value as InternalMessageRole)} className="rounded-xl border px-3 py-2 text-sm text-black">
            <option value="admin">{t("inboxPage.roleAdmin")}</option>
            <option value="workshop">{t("inboxPage.roleWorkshop")}</option>
            <option value="client">{t("inboxPage.roleClient")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("inboxPage.recipientUuid")}</span>
          <input value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm text-black" placeholder={t("inboxPage.recipientUuidPlaceholder")} />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("inboxPage.relatedBookingUuid")}</span>
          <input value={relatedBookingId ?? ""} onChange={(e) => setRelatedBookingId(e.target.value.trim() || null)} className="rounded-xl border px-3 py-2 text-sm text-black" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("inboxPage.relatedRequestUuid")}</span>
          <input value={serviceRequestId ?? ""} onChange={(e) => setServiceRequestId(e.target.value.trim() || null)} className="rounded-xl border px-3 py-2 text-sm text-black" />
        </label>
      </div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-xl border px-3 py-2 text-sm text-black" placeholder={t("inboxPage.subjectPlaceholder")} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="rounded-xl border px-3 py-2 text-sm text-black" placeholder={t("inboxPage.bodyPlaceholder")} />
      <div>
        <button type="button" disabled={sending} onClick={() => void sendMessage()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {sending ? t("commonUi.sending") : t("commonUi.send")}
        </button>
      </div>
    </div>
  ) : null;

  const sidebarListDesktop = loading ? null : mergedSidebarRows.length === 0 ? (
    <p className={`px-3 py-6 text-center text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{resolvedEmptyListHint}</p>
  ) : (
    mergedSidebarRows.map((row) =>
      row.kind === "notification" ? (
        <button
          key={row.key}
          type="button"
          onClick={() => void openNotification(row.notification)}
          className={`w-full border-b px-3 py-2.5 text-left transition last:border-b-0 ${
            resolvedSelectedKey === row.key ? (isDark ? "bg-zinc-800" : "bg-blue-50") : ""
          } ${
            !row.notification.is_read
              ? isDark
                ? "bg-blue-950/40 hover:bg-blue-950/55"
                : "bg-sky-50/95 hover:bg-sky-50"
              : isDark
                ? "hover:bg-zinc-800/80"
                : "hover:bg-zinc-50"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-sm font-medium ${!row.notification.is_read ? (isDark ? "text-blue-400" : "text-blue-500") : isDark ? "text-zinc-100" : "text-zinc-900"}`}>
              {row.notification.title}
            </p>
            {!row.notification.is_read ? <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" /> : null}
          </div>
          <p className="truncate text-xs text-zinc-500">{notificationKindLabel(row.notification)}</p>
          {row.notification.body ? <p className={`mt-1 line-clamp-2 text-xs leading-snug ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{row.notification.body}</p> : null}
          <p className="mt-1 text-[11px] text-zinc-500">{formatDate(row.notification.created_at)}</p>
        </button>
      ) : (
        <button
          key={row.key}
          type="button"
          onClick={() => void openMessage(row.thread.latest)}
          className={`w-full border-b px-3 py-2.5 text-left transition last:border-b-0 ${
            resolvedSelectedKey === row.key ? (isDark ? "bg-zinc-800" : "bg-blue-50") : ""
          } ${
            row.thread.unreadCount > 0
              ? isDark
                ? "bg-orange-950/30 hover:bg-orange-950/45"
                : "bg-orange-50/90 hover:bg-orange-50"
              : isDark
                ? "hover:bg-zinc-800/80"
                : "hover:bg-zinc-50"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-sm font-medium ${row.thread.unreadCount > 0 ? (isDark ? "text-orange-400" : "text-orange-600") : isDark ? "text-zinc-100" : "text-zinc-900"}`}>
              {row.thread.latest.subject || t("inboxPage.noSubject")}
            </p>
            {row.thread.unreadCount > 0 ? <span className="h-2 w-2 rounded-full bg-rose-500" /> : null}
          </div>
          <p className="truncate text-xs text-zinc-500">
            {fillTemplate(t("inboxPage.sidebarLine"), { label: row.thread.label, sender: row.thread.latest.sender_label ?? "" })}
          </p>
          {row.thread.latest.body ? <p className={`mt-1 line-clamp-2 text-xs leading-snug ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{row.thread.latest.body}</p> : null}
          <p className="mt-1 text-[11px] text-zinc-500">
            {formatDate(row.thread.latest.created_at)} ·{" "}
            {row.thread.unreadCount > 0 ? t("inboxPage.readStateUnread") : t("inboxPage.readStateRead")}
          </p>
        </button>
      ),
    )
  );

  const mobileUnreadCardHighlight = !isDark
    ? "border-blue-200 bg-sky-50/90 shadow-sm ring-1 ring-blue-100/70"
    : "border-blue-800/45 bg-blue-950/35 ring-1 ring-blue-500/25";

  const sidebarListMobileAsCards =
    mergedSidebarRows.length === 0 ? (
      <p className={`rounded-2xl border border-blue-100 bg-white/90 p-6 text-center text-sm shadow-sm ${isDark ? "border-zinc-700 bg-zinc-900/80 text-zinc-400" : "text-zinc-500"}`}>
        {resolvedEmptyListHint}
      </p>
    ) : (
      <div className="flex flex-col gap-3">
        {mergedSidebarRows.map((row) =>
          row.kind === "notification" ? (
            <button
              key={row.key}
              type="button"
              onClick={() => void openNotification(row.notification)}
              className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
                resolvedSelectedKey === row.key ? (!isDark ? "border-blue-300 bg-blue-50/95" : "border-blue-500/40 bg-zinc-800") : ""
              } ${!row.notification.is_read ? mobileUnreadCardHighlight : !isDark ? "border-blue-100 bg-white/90" : "border-zinc-700 bg-zinc-900/85"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`flex-1 break-words font-semibold ${!row.notification.is_read ? "text-blue-600" : isDark ? "text-zinc-100" : "text-zinc-900"}`}>{row.notification.title}</p>
                {!row.notification.is_read ? (
                  <span className="mt-1 flex shrink-0 items-center gap-1" aria-hidden={true}>
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  </span>
                ) : null}
              </div>
              <p className={`mt-1 text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{notificationKindLabel(row.notification)}</p>
              {row.notification.body ? <p className={`mt-2 line-clamp-3 max-w-full break-words text-sm ${isDark ? "text-zinc-400" : "text-zinc-700"}`}>{row.notification.body}</p> : null}
              <p className="mt-3 text-[11px] text-zinc-500">{formatDate(row.notification.created_at)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {!row.notification.is_read ? t("inboxPage.readStateUnread") : t("inboxPage.readStateRead")}
              </p>
            </button>
          ) : (
            <button
              key={row.key}
              type="button"
              onClick={() => void openMessage(row.thread.latest)}
              className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
                resolvedSelectedKey === row.key ? (!isDark ? "border-blue-300 bg-blue-50/95" : "border-blue-500/40 bg-zinc-800") : ""
              } ${row.thread.unreadCount > 0 ? mobileUnreadCardHighlight : !isDark ? "border-blue-100 bg-white/90" : "border-zinc-700 bg-zinc-900/85"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`flex-1 break-words font-semibold ${row.thread.unreadCount > 0 ? (isDark ? "text-blue-300" : "text-blue-700") : isDark ? "text-zinc-100" : "text-zinc-900"}`}>{row.thread.latest.subject || t("inboxPage.noSubject")}</p>
                {row.thread.unreadCount > 0 ? (
                  <span className="mt-1 flex shrink-0 items-center gap-1.5" aria-hidden={true}>
                    {row.thread.unreadCount > 1 ? (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${isDark ? "bg-blue-500" : "bg-blue-600"}`}>{row.thread.unreadCount}</span>
                    ) : null}
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  </span>
                ) : null}
              </div>
              <p className={`mt-1 text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                {row.thread.label} · {row.thread.latest.sender_label}
              </p>
              {row.thread.latest.body ? <p className={`mt-2 line-clamp-3 max-w-full break-words text-sm ${isDark ? "text-zinc-400" : "text-zinc-700"}`}>{row.thread.latest.body}</p> : null}
              <p className="mt-3 text-[11px] text-zinc-500">{formatDate(row.thread.latest.created_at)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {row.thread.unreadCount > 0 ? t("inboxPage.readStateUnread") : t("inboxPage.readStateRead")}
              </p>
            </button>
          ),
        )}
      </div>
    );

  const classicDetailPane = (
    <div className="min-w-0 rounded-xl border p-3">
      {selectedNotification ? (
        <div className="space-y-3">
          <div>
            <h4 className="break-words text-base font-semibold">{selectedNotification.title}</h4>
            <p className="text-xs text-zinc-500">{formatDate(selectedNotification.created_at)}</p>
            <p className="mt-1 text-xs font-medium text-zinc-500">
              {t("inboxPage.typeLabel")}{" "}
              {selectedNotification.notification_type === "completion_check"
                ? t("inboxPage.typePostVisit")
                : selectedNotification.notification_type === "visit_reminder"
                  ? t("inboxPage.typeVisitReminder")
                  : selectedNotification.notification_type}
            </p>
            {selectedNotification.booking_id ? (
              <p className="mt-2">
                <Link href={bookingListHref(viewerRole)} className={`text-sm font-semibold underline-offset-2 hover:underline ${isDark ? "text-sky-400" : "text-blue-600"}`}>
                  {t("inboxPage.goToBookings")}
                </Link>
              </p>
            ) : null}
          </div>
          {selectedNotification.notification_type === "completion_check" && viewerRole === "client" ? (
            <CompletionCheckNotificationCard notification={selectedNotification} currentUserId={currentUserId} isDark={isDark} onResolved={() => void reload()} />
          ) : (
            <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{selectedNotification.body}</p>
          )}
        </div>
      ) : selectedMessage ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="break-words text-base font-semibold">{selectedMessage.subject || t("inboxPage.noSubject")}</h4>
              <p className="text-xs text-zinc-500">
                {fillTemplate(t("inboxPage.lastActivity"), { date: formatDate(selectedMessage.created_at) })}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-500">
                {t("inboxPage.typeLabel")} {t("inboxPage.internalMessageType")}
              </p>
              {selectedMessage.related_booking_id ? (
                <p className="mt-2">
                  <Link href={bookingListHref(viewerRole)} className={`text-sm font-semibold underline-offset-2 hover:underline ${isDark ? "text-sky-400" : "text-blue-600"}`}>
                    {t("inboxPage.goToBookings")}
                  </Link>
                </p>
              ) : null}
            </div>
            {canUseAdminCompose && selectedMessage.sender_id && selectedMessage.sender_id !== currentUserId ? (
              <button type="button" onClick={() => startReply(selectedMessage)} className="rounded-lg border px-3 py-1 text-sm">
                {t("inboxPage.replyClassic")}
              </button>
            ) : null}
          </div>
          <div className={`max-h-[46vh] space-y-3 overflow-y-auto overflow-x-hidden rounded-2xl border p-4 text-sm ${isDark ? "border-zinc-700 bg-zinc-950/40" : "border-zinc-200 bg-zinc-50/50"}`}>
            {threadMessages.length === 0 ? (
              <p className={`rounded-xl px-3 py-6 text-center text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("inboxPage.emptyThread")}</p>
            ) : (
              threadMessages.map((msg) => (
                <div key={msg.id} className={`rounded-2xl border px-4 py-3 ${bubbleTone(msg)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-xs font-semibold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{msg.sender_label}</p>
                    <p className="text-[11px] text-zinc-500">{formatDate(msg.created_at)}</p>
                  </div>
                  {msg.subject ? <p className={`mt-1 text-xs font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{msg.subject}</p> : null}
                  <p className="mt-2 max-w-full whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
                </div>
              ))
            )}
          </div>
          {viewerRole === "client" && workshopOwnerUserId && selectedMessage.related_booking_id ? (
            <div className={`rounded-xl border p-3 ${isDark ? "border-blue-500/30 bg-blue-950/20" : "border-blue-200 bg-blue-50/60"}`}>
              <p className="text-sm font-semibold">{t("inboxPage.writeToWorkshop")}</p>
              <textarea
                value={clientReplyBody}
                onChange={(e) => setClientReplyBody(e.target.value)}
                rows={4}
                className="mt-2 w-full max-w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-black"
                placeholder={t("inboxPage.clientMessagePlaceholder")}
              />
              <button
                type="button"
                disabled={clientReplyBusy}
                onClick={() => void sendClientReplyToWorkshop()}
                className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {clientReplyBusy ? t("commonUi.sending") : t("commonUi.send")}
              </button>
            </div>
          ) : null}
          {viewerRole === "workshop" && bookingClientUserId && selectedMessage.related_booking_id ? (
            <div className={`rounded-xl border p-3 ${isDark ? "border-blue-500/30 bg-blue-950/20" : "border-blue-200 bg-blue-50/60"}`}>
              <p className="text-sm font-semibold">{t("inboxPage.replyToClient")}</p>
              <textarea
                value={workshopReplyBody}
                onChange={(e) => setWorkshopReplyBody(e.target.value)}
                rows={4}
                className="mt-2 w-full max-w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-black"
                placeholder={t("inboxPage.replyPlaceholder")}
              />
              <button
                type="button"
                disabled={workshopReplyBusy}
                onClick={() => void sendWorkshopReplyToClient()}
                className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {workshopReplyBusy ? t("commonUi.sending") : t("inboxPage.sendReplyWorkshop")}
              </button>
            </div>
          ) : null}
          {viewerRole === "client" && selectedMessage.related_booking_id ? (
            <div className="flex flex-col gap-2">
              {clientQuoteUi.loadState === "ready" && clientQuoteUi.confirmedReadonly ? (
                <p
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    isDark ? "border-emerald-500/35 bg-emerald-950/30 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-900"
                  }`}
                >
                  {t("inboxPage.quoteConfirmedNotice")}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {canRespondToQuote ? (
                  <>
                    <button type="button" onClick={() => void handleQuoteDecision(true)} className="rounded-lg border border-emerald-500/60 px-3 py-1 text-sm font-semibold">
                      {t("inboxPage.acceptQuoteInbox")}
                    </button>
                    <button type="button" onClick={() => void handleQuoteDecision(false)} className="rounded-lg border border-rose-500/60 px-3 py-1 text-sm font-semibold">
                      {t("inboxPage.rejectQuoteInbox")}
                    </button>
                  </>
                ) : null}
                {canRespondToReschedule ? (
                  <>
                    <button type="button" onClick={() => void handleRescheduleDecision(true)} className="rounded-lg border border-purple-500/60 px-3 py-1 text-sm font-semibold">
                      {t("inboxPage.acceptNewTimeInbox")}
                    </button>
                    <button type="button" onClick={() => void handleRescheduleDecision(false)} className="rounded-lg border border-zinc-500/60 px-3 py-1 text-sm font-semibold">
                      {t("inboxPage.rejectNewTimeInbox")}
                    </button>
                  </>
                ) : null}
                <button type="button" onClick={() => void handleCancelBooking()} className="rounded-lg border border-zinc-500/60 px-3 py-1 text-sm">
                  {t("inboxPage.cancelBooking")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">{t("inboxPage.selectFromList")}</p>
      )}
    </div>
  );

  const inboxAlerts = (
    <>
      {error ? (
        <div
          className={`mb-3 rounded-lg border px-3 py-3 text-sm ${isDark ? "border-rose-500/40 bg-rose-950/40 text-rose-100" : "border-rose-200 bg-rose-50 text-rose-800"}`}
          role="status"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className={`mt-3 rounded-lg border px-3 py-1.5 text-xs font-semibold ${isDark ? "border-rose-400/50 hover:bg-rose-950/60" : "border-rose-300 bg-white hover:bg-rose-50"}`}
          >
            {t("commonUi.refresh")}
          </button>
        </div>
      ) : null}
      {info ? <p className={`mb-3 rounded-lg border px-3 py-2 text-sm ${isDark ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{info}</p> : null}
    </>
  );

  const classicLoadingSkeleton = (
    <div className="grid grid-cols-1 gap-3 overflow-x-hidden xl:grid-cols-[320px_minmax(0,1fr)]">
      <div
        className={`h-[min(420px,55vh)] animate-pulse rounded-xl border ${isDark ? "border-zinc-700 bg-zinc-800/50" : "border-zinc-200 bg-zinc-100/90"}`}
        aria-hidden
      />
      <div
        className={`h-[min(420px,55vh)] animate-pulse rounded-xl border ${isDark ? "border-zinc-700 bg-zinc-800/50" : "border-zinc-200 bg-zinc-100/90"}`}
        aria-hidden
      />
      <p className={`col-span-full text-center text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("inboxPage.loadingMessages")}</p>
    </div>
  );

  const classicEmptyState = (
    <div
      className={`rounded-xl border p-10 text-center ${isDark ? "border-zinc-700 bg-zinc-900/60" : "border-blue-200 bg-white/85"}`}
    >
      <p className={`text-sm font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{resolvedEmptyListHint}</p>
      <p className={`mt-3 text-sm leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("inboxPage.emptyClassicExtra")}</p>
    </div>
  );

  const classicGrid = loading ? (
    classicLoadingSkeleton
  ) : mergedSidebarRows.length === 0 ? (
    classicEmptyState
  ) : (
    <div className="grid grid-cols-1 gap-3 overflow-x-hidden xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-xl border">{sidebarListDesktop}</div>
      {classicDetailPane}
    </div>
  );

  const showClientComposer = !!(viewerRole === "client" && workshopOwnerUserId && selectedMessage?.related_booking_id);
  const showWorkshopComposer = !!(viewerRole === "workshop" && bookingClientUserId && selectedMessage?.related_booking_id);

  const mobileBookingHref = selectedMessage?.related_booking_id || selectedNotification?.booking_id || null;

  const messengerThreadScrollContent = (
    <>
      {!selectedNotification && !selectedMessage ? <p className="text-center text-sm text-zinc-500">{t("inboxPage.nothingSelected")}</p> : null}
      {selectedNotification ? (
        <div className="flex flex-col gap-3">
          {selectedNotification.notification_type === "completion_check" && viewerRole === "client" ? (
            <CompletionCheckNotificationCard notification={selectedNotification} currentUserId={currentUserId} isDark={isDark} onResolved={() => void reload()} />
          ) : (
            selectedNotification.body && (
              <div
                className={`mx-auto w-full max-w-[min(96%,560px)] rounded-2xl border p-4 text-sm shadow-sm ${
                  isDark ? "border-slate-700 bg-slate-900/80" : "border-blue-100 bg-white/90"
                }`}
              >
                <p className="whitespace-pre-wrap break-words leading-relaxed">{selectedNotification.body}</p>
                <p className="mt-2 text-center text-[11px] text-zinc-500">{formatDate(selectedNotification.created_at)}</p>
              </div>
            )
          )}
        </div>
      ) : selectedMessage ? (
        <div className="flex flex-col gap-3 pb-4">
          {threadMessages.length === 0 ? (
            <p
              className={`rounded-2xl border p-6 text-center text-sm shadow-sm ${
                isDark ? "border-slate-700 bg-slate-900/80 text-zinc-400" : "border-blue-100 bg-white/90 text-zinc-600"
              }`}
            >
              {t("inboxPage.emptyThread")}
            </p>
          ) : (
            threadMessages.map((msg) => {
              const mStyle = mobileBubbleClass(msg);
              const sys = msg.sender_role === "system";
              const mine = !sys && msg.sender_id === currentUserId;
              const senderClass = sys
                ? isDark
                  ? "text-violet-200"
                  : "text-violet-700"
                : mine
                  ? isDark
                    ? "text-blue-100"
                    : "text-white"
                  : isDark
                    ? "text-zinc-200"
                    : "text-zinc-800";
              return (
                <div key={msg.id} className={`flex w-full min-w-0 px-1 ${mStyle.row}`}>
                  <div className={`${mStyle.bubble} text-sm shadow-sm`}>
                    <p className={`break-words font-semibold ${sys ? "text-[11px]" : "text-xs"} ${senderClass}`}>{sys ? t("commonUi.systemSender") : msg.sender_label}</p>
                    {msg.subject ? <p className={`mt-1 break-words text-xs font-semibold ${mStyle.body}`}>{msg.subject}</p> : null}
                    <p className={`mt-1 whitespace-pre-wrap break-words leading-relaxed ${mStyle.body}`}>{msg.body}</p>
                    <p className={`mt-2 ${mStyle.meta}`}>{formatDate(msg.created_at)}</p>
                  </div>
                </div>
              );
            })
          )}
          {viewerRole === "client" && selectedMessage.related_booking_id ? (
            <div className="flex flex-col gap-2">
              {clientQuoteUi.loadState === "ready" && clientQuoteUi.confirmedReadonly ? (
                <p
                  className={`rounded-2xl border px-3 py-2 text-xs ${
                    isDark ? "border-emerald-500/35 bg-emerald-950/30 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-900"
                  }`}
                >
                  {t("inboxPage.quoteConfirmedNotice")}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {canRespondToQuote ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleQuoteDecision(true)}
                      className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${isDark ? "border-emerald-500/35" : "border-emerald-500/60"}`}
                    >
                      {t("inboxPage.acceptQuoteInbox")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleQuoteDecision(false)}
                      className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${isDark ? "border-rose-500/35" : "border-rose-500/60"}`}
                    >
                      {t("inboxPage.rejectQuoteInbox")}
                    </button>
                  </>
                ) : null}
                {canRespondToReschedule ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleRescheduleDecision(true)}
                      className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${isDark ? "border-purple-500/35" : "border-purple-500/60"}`}
                    >
                      {t("inboxPage.acceptNewTimeInbox")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRescheduleDecision(false)}
                      className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${isDark ? "border-zinc-600" : "border-zinc-500/60"}`}
                    >
                      {t("inboxPage.rejectNewTimeInbox")}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleCancelBooking()}
                  className={`rounded-2xl border px-3 py-2 text-xs ${isDark ? "border-zinc-600" : "border-zinc-500/60"}`}
                >
                  {t("inboxPage.cancelBooking")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const messengerComposerFooter = (wide: boolean) =>
    !((showClientComposer || showWorkshopComposer) && selectedMessage) ? null : (
      <div
        className={`shrink-0 border-t pb-[max(12px,env(safe-area-inset-bottom))] pt-4 ${isDark ? "border-slate-700 bg-slate-900/95 shadow-black/25 shadow-[0_-6px_24px_-10px_rgba(0,0,0,0.35)]" : "border-blue-100 bg-white/95 shadow-[0_-6px_24px_-10px_rgba(15,23,42,0.1)]"}`}
      >
        <div className={`mx-auto flex w-full min-w-0 items-end gap-3 ${wide ? "px-5" : "max-w-lg px-4"}`}>
          <textarea
            value={showClientComposer ? clientReplyBody : workshopReplyBody}
            onChange={(e) => (showClientComposer ? setClientReplyBody(e.target.value) : setWorkshopReplyBody(e.target.value))}
            rows={wide ? 3 : 2}
            className={`min-h-[48px] max-h-40 min-w-0 flex-1 resize-none rounded-2xl border px-4 py-3 text-sm [touch-action:manipulation] ${
              isDark ? "border-slate-600 bg-slate-800 text-white" : "border-blue-100 bg-white text-black"
            }`}
            placeholder={t("inboxPage.footerPlaceholderWide")}
            enterKeyHint="send"
          />
          <button
            type="button"
            disabled={showClientComposer ? clientReplyBusy : workshopReplyBusy}
            onClick={() => void (showClientComposer ? sendClientReplyToWorkshop() : sendWorkshopReplyToClient())}
            className="shrink-0 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-45"
          >
            {showClientComposer
              ? clientReplyBusy
                ? t("inboxPage.sendBusyShort")
                : t("commonUi.send")
              : workshopReplyBusy
                ? t("inboxPage.sendBusyShort")
                : t("commonUi.send")}
          </button>
        </div>
      </div>
    );

  return (
    <div className={`${shellClass} max-w-[100vw] overflow-x-hidden`}>
      {enableMobileMessenger ? (
        <>
          <div className="hidden md:flex md:w-full md:flex-col md:gap-4">
            {inboxAlerts}
            {composeMobileMessenger}
            {loading ? (
              <div
                className={`flex min-h-[600px] h-[calc(100vh-180px)] w-full items-center justify-center rounded-2xl border p-8 text-sm shadow-md ${
                  isDark ? "border-slate-700 bg-slate-900/90 text-zinc-300" : "border-blue-100 bg-white/90 text-zinc-700"
                }`}
              >
                {t("commonUi.loading")}
              </div>
            ) : (
              <div
                className={`flex min-h-[600px] h-[calc(100vh-180px)] w-full flex-col overflow-hidden rounded-2xl border p-5 shadow-md ${
                  isDark ? "border-slate-700 bg-slate-900/90" : "border-blue-100 bg-white/90"
                }`}
              >
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] md:gap-6">
                  <aside className={`flex min-h-0 flex-col pb-4 md:border-r md:pb-0 md:pr-6 ${isDark ? "border-slate-700" : "border-blue-100"}`}>
                    <div className="mb-4 flex shrink-0 flex-col gap-3">
                      <h3 className={`text-lg font-bold tracking-tight ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{t("inboxPage.messengerConversations")}</h3>
                      {toolbarButtonsMobileMessenger}
                    </div>
                    {mergedSidebarRows.length === 0 ? (
                      <div
                        className={`flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center ${isDark ? "border-slate-600 bg-slate-950/40 text-zinc-400" : "border-blue-200/80 bg-blue-50/30 text-zinc-600"}`}
                      >
                        <p className={`text-base font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{t("inboxPage.emptyConversationsTitle")}</p>
                        <p className="mt-2 max-w-xs text-sm">{resolvedEmptyListHint}</p>
                      </div>
                    ) : (
                      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
                        {sidebarListMobileAsCards}
                      </div>
                    )}
                  </aside>
                  <section className="flex min-h-0 min-w-0 flex-col overflow-hidden pt-2 md:pt-0">
                    {mergedSidebarRows.length === 0 ? (
                      <div
                        className={`flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center ${isDark ? "border-slate-600 bg-slate-950/40" : "border-blue-200/80 bg-blue-50/20"}`}
                      >
                        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{t("inboxPage.pickConversationHint")}</p>
                      </div>
                    ) : (
                      <>
                        <header
                          className={`shrink-0 border-b pb-4 ${isDark ? "border-slate-700 bg-slate-900/80" : "border-blue-100 bg-white/80"}`}
                        >
                          <h2 className={`break-words text-xl font-bold leading-snug ${isDark ? "text-zinc-50" : "text-zinc-900"}`}>
                            {selectedNotification?.title ?? selectedMessage?.subject ?? t("inboxPage.conversationDefaultTitle")}
                          </h2>
                          {(selectedNotification || selectedMessage) && (
                            <p className={`mt-1 break-words text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                              {selectedNotification ? notificationKindLabel(selectedNotification) : threadPartnerSubtitle() || selectedMessage?.sender_label || ""}
                            </p>
                          )}
                          {mobileBookingHref ? (
                            <p className="mt-3">
                              <Link
                                href={bookingListHref(viewerRole)}
                                className={`text-sm font-semibold underline-offset-2 hover:underline ${isDark ? "text-sky-400" : "text-blue-600"}`}
                              >
                                {t("inboxPage.goToBookings")}
                              </Link>
                            </p>
                          ) : null}
                        </header>
                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain py-4 [-webkit-overflow-scrolling:touch]">
                          {messengerThreadScrollContent}
                        </div>
                        {messengerComposerFooter(true)}
                      </>
                    )}
                  </section>
                </div>
              </div>
            )}
          </div>
          <div className="md:hidden flex flex-col gap-3 pb-[env(safe-area-inset-bottom)]">
            {mobileView === "list" ? (
              <>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">{toolbarTitle}</div>
                  <div>{toolbarButtonsMobileMessenger}</div>
                </div>
                {inboxAlerts}
                {composeMobileMessenger}
                {loading ? (
                  <p className={`rounded-2xl border border-blue-100 bg-white/90 p-4 text-sm shadow-sm ${isDark ? "border-zinc-700 bg-zinc-900/80" : ""}`}>{t("commonUi.loading")}</p>
                ) : (
                  sidebarListMobileAsCards
                )}
              </>
            ) : (
              <div
                className={`fixed inset-0 z-[60] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] md:hidden ${isDark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50/95 text-zinc-900"}`}
              >
                <header className={`shrink-0 border-b px-4 pb-4 pt-3 shadow-sm ${isDark ? "border-blue-950/70 bg-zinc-900/95" : "border-blue-100 bg-white/95"}`}>
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileView("list")}
                      className={`rounded-2xl border px-3 py-2 text-sm font-medium ${isDark ? "border-zinc-600 bg-zinc-800" : "border-blue-100 bg-white"}`}
                      aria-label={t("inboxPage.mobileBackToListAria")}
                    >
                      ← {t("inboxPage.mobileBackToList")}
                    </button>
                  </div>
                  <h2 className="mt-3 break-words text-lg font-bold">
                    {selectedNotification?.title ?? selectedMessage?.subject ?? t("inboxPage.conversationDefaultTitle")}
                  </h2>
                  <p className={`mt-1 break-words text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    {selectedNotification ? notificationKindLabel(selectedNotification) : threadPartnerSubtitle() || selectedMessage?.sender_label || ""}
                  </p>
                  {mobileBookingHref ? (
                    <p className="mt-3">
                      <Link href={bookingListHref(viewerRole)} className={`text-sm font-semibold underline-offset-2 hover:underline ${isDark ? "text-sky-400" : "text-blue-600"}`}>
                        {t("inboxPage.goToBookings")}
                      </Link>
                    </p>
                  ) : null}
                </header>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-3 [-webkit-overflow-scrolling:touch]">
                    {messengerThreadScrollContent}
                  </div>
                  {messengerComposerFooter(false)}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {toolbarRowClassic}
          {inboxAlerts}
          {composeClassic}
          {classicGrid}
        </>
      )}
    </div>
  );
}
