"use client";

import { supabase } from "@/lib/supabaseClient";
import { formatSupabaseError } from "@/lib/workshopApi";
import { isAdmin } from "@/lib/adminApi";
import { getUserActiveWorkshop } from "@/lib/workshopApi";

export type InternalMessageRole = "client" | "workshop" | "admin" | "owner" | "system";

export type InternalMessage = {
  id: string;
  sender_id: string | null;
  recipient_id: string | null;
  sender_role: string | null;
  recipient_role: string | null;
  subject: string | null;
  body: string;
  related_booking_id: string | null;
  related_workshop_id: string | null;
  service_request_id: string | null;
  is_read: boolean;
  created_at: string;
  sender_label: string;
  recipient_label: string;
};

type MessageProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type MessageWorkshop = {
  id: string;
  name: string;
};

type InternalMessageRow = Omit<InternalMessage, "sender_label" | "recipient_label">;

function profileLabel(profile: MessageProfile | undefined, fallback: string) {
  if (!profile) return fallback;
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return full || profile.email?.trim() || fallback;
}

function roleLabel(role: string | null | undefined) {
  if (!role) return "Użytkownik";
  if (role === "admin" || role === "owner") return "Administrator";
  if (role === "workshop") return "Warsztat";
  if (role === "system") return "System";
  return "Klient";
}

function mapInternalMessages(
  rows: InternalMessageRow[],
  profiles: MessageProfile[],
  workshops: MessageWorkshop[],
): InternalMessage[] {
  const profileMap = new Map(profiles.map((x) => [x.id, x]));
  const workshopMap = new Map(workshops.map((x) => [x.id, x.name]));
  return rows.map((row) => {
    const senderProfile = row.sender_id ? profileMap.get(row.sender_id) : undefined;
    const recipientProfile = row.recipient_id ? profileMap.get(row.recipient_id) : undefined;
    const workshopName = row.related_workshop_id ? workshopMap.get(row.related_workshop_id) : null;

    let senderLabel: string;
    if (row.sender_role === "system") {
      senderLabel = "Wiadomość systemowa";
    } else if (row.sender_role === "workshop") {
      senderLabel = workshopName?.trim() ? `Warsztat: ${workshopName.trim()}` : "Warsztat";
    } else {
      senderLabel = profileLabel(senderProfile, workshopName ?? roleLabel(row.sender_role));
    }

    return {
      ...row,
      sender_label: senderLabel,
      recipient_label: profileLabel(recipientProfile, roleLabel(row.recipient_role)),
    };
  });
}

async function loadMessageRelations(rows: InternalMessageRow[]) {
  if (!supabase || rows.length === 0) {
    return { profiles: [] as MessageProfile[], workshops: [] as MessageWorkshop[] };
  }
  const userIds = Array.from(
    new Set(
      rows.flatMap((row) => [row.sender_id, row.recipient_id]).filter((x): x is string => Boolean(x)),
    ),
  );
  const workshopIds = Array.from(
    new Set(rows.map((row) => row.related_workshop_id).filter((x): x is string => Boolean(x))),
  );
  const [profilesRes, workshopsRes] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, first_name, last_name, email").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    workshopIds.length
      ? supabase.from("workshops").select("id, name").in("id", workshopIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesRes.error) throw new Error(formatSupabaseError(profilesRes.error));
  if (workshopsRes.error) throw new Error(formatSupabaseError(workshopsRes.error));
  return {
    profiles: (profilesRes.data as MessageProfile[] | null) ?? [],
    workshops: (workshopsRes.data as MessageWorkshop[] | null) ?? [],
  };
}

export async function resolveMessageViewerContext(userId: string, email?: string | null) {
  const [adminAccess, activeWorkshop] = await Promise.all([
    isAdmin(userId, email),
    getUserActiveWorkshop(userId).catch(() => null),
  ]);
  const isAdminUser = Boolean(adminAccess);
  const isWorkshopUser = Boolean(activeWorkshop);
  return {
    isAdminOrOwner: isAdminUser,
    isWorkshopOwner: isWorkshopUser,
    hasActiveWorkshop: isWorkshopUser,
    workshopId: activeWorkshop?.id ?? null,
    role: isAdminUser ? ("admin" as const) : isWorkshopUser ? ("workshop" as const) : ("client" as const),
  };
}

export async function getInboxMessages(userId: string, includeAllForAdmin = false): Promise<InternalMessage[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  let query = supabase
    .from("internal_messages")
    .select("id, sender_id, recipient_id, sender_role, recipient_role, subject, body, related_booking_id, related_workshop_id, service_request_id, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (!includeAllForAdmin) {
    query = query.or(`recipient_id.eq.${userId},sender_id.eq.${userId}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data as InternalMessageRow[] | null) ?? [];
  const relations = await loadMessageRelations(rows);
  return mapInternalMessages(rows, relations.profiles, relations.workshops);
}

export async function getSentMessages(userId: string): Promise<InternalMessage[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("internal_messages")
    .select("id, sender_id, recipient_id, sender_role, recipient_role, subject, body, related_booking_id, related_workshop_id, service_request_id, is_read, created_at")
    .eq("sender_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data as InternalMessageRow[] | null) ?? [];
  const relations = await loadMessageRelations(rows);
  return mapInternalMessages(rows, relations.profiles, relations.workshops);
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.rpc("mark_message_as_read", { p_message_id: messageId });
  if (error) throw new Error(formatSupabaseError(error));
}

/** Wszystkie wiadomości w wątku rezerwacji (odebrane + wysłane), chronologicznie. */
export async function getBookingThreadMessages(
  userId: string,
  bookingId: string,
  includeAllForAdmin = false,
): Promise<InternalMessage[]> {
  const [inboxRows, sentRows] = await Promise.all([
    getInboxMessages(userId, includeAllForAdmin),
    getSentMessages(userId),
  ]);
  const map = new Map<string, InternalMessage>();
  for (const m of [...inboxRows, ...sentRows]) {
    if (m.related_booking_id === bookingId) map.set(m.id, m);
  }
  return Array.from(map.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Oznacza jako przeczytane wszystkie wiadomości w wątku rezerwacji, gdzie użytkownik jest odbiorcą. */
export async function markBookingThreadMessagesRead(userId: string, bookingId: string): Promise<void> {
  const msgs = await getBookingThreadMessages(userId, bookingId, false);
  const unread = msgs.filter((m) => !m.is_read && m.recipient_id === userId);
  await Promise.all(unread.map((m) => markMessageAsRead(m.id)));
}

export async function getUnreadMessagesCount(userId: string, includeAllForAdmin = false): Promise<number> {
  if (!supabase) throw new Error("Supabase client not available.");
  let query = supabase.from("internal_messages").select("id", { head: true, count: "exact" }).eq("is_read", false);
  if (!includeAllForAdmin) {
    query = query.eq("recipient_id", userId);
  }
  const { count, error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
  return count ?? 0;
}

export async function sendInternalMessage(payload: {
  senderId: string | null;
  recipientId: string | null;
  senderRole: InternalMessageRole;
  recipientRole: InternalMessageRole;
  subject?: string | null;
  body: string;
  relatedBookingId?: string | null;
  relatedWorkshopId?: string | null;
  serviceRequestId?: string | null;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const messageBody = payload.body.trim();
  if (!messageBody) throw new Error("Treść wiadomości jest wymagana.");
  const { error } = await supabase.from("internal_messages").insert({
    sender_id: payload.senderId,
    recipient_id: payload.recipientId,
    sender_role: payload.senderRole,
    recipient_role: payload.recipientRole,
    subject: payload.subject?.trim() || null,
    body: messageBody,
    related_booking_id: payload.relatedBookingId ?? null,
    related_workshop_id: payload.relatedWorkshopId ?? null,
    service_request_id: payload.serviceRequestId ?? null,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function sendSystemMessage(payload: {
  recipientId: string | null;
  recipientRole: InternalMessageRole;
  subject?: string | null;
  body: string;
  relatedBookingId?: string | null;
  relatedWorkshopId?: string | null;
  serviceRequestId?: string | null;
}): Promise<void> {
  await sendInternalMessage({
    senderId: null,
    recipientId: payload.recipientId,
    senderRole: "system",
    recipientRole: payload.recipientRole,
    subject: payload.subject,
    body: payload.body,
    relatedBookingId: payload.relatedBookingId,
    relatedWorkshopId: payload.relatedWorkshopId,
    serviceRequestId: payload.serviceRequestId,
  });
}

export async function respondToBookingQuote(bookingId: string, accept: boolean): Promise<"confirmed" | "quote_rejected"> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase.rpc("respond_booking_quote", {
    p_booking_id: bookingId,
    p_accept: accept,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return data === "confirmed" ? "confirmed" : "quote_rejected";
}

export async function cancelBooking(bookingId: string, reason: string): Promise<string> {
  if (!supabase) throw new Error("Supabase client not available.");
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("Powód anulowania jest wymagany.");
  const { data, error } = await supabase.rpc("cancel_booking", {
    p_booking_id: bookingId,
    p_reason: trimmedReason,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return String(data ?? "");
}

export async function respondToBookingReschedule(bookingId: string, accept: boolean): Promise<"confirmed" | "rejected"> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase.rpc("respond_booking_reschedule", {
    p_booking_id: bookingId,
    p_accept: accept,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return data === "confirmed" ? "confirmed" : "rejected";
}

/** Anulacja przez klienta + powiadomienie `user_notifications` dla warsztatu (RPC supabase-39). */
export async function clientCancelVisitWithNotice(bookingId: string, reason?: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.rpc("client_cancel_visit_with_notice", {
    p_booking_id: bookingId,
    p_reason: reason?.trim() ?? "",
  });
  if (error) throw new Error(formatSupabaseError(error));
}

/** Klient proponuje nowy termin — `pending_workshop_decision`, bez zmiany głównej daty (RPC supabase-39). */
export async function clientProposeBookingReschedule(
  bookingId: string,
  newBookingDate: string,
  newStartTimeHHmm: string,
  note?: string,
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const t = newStartTimeHHmm.trim().length <= 5 ? `${newStartTimeHHmm.trim()}:00` : newStartTimeHHmm.trim();
  const { error } = await supabase.rpc("client_propose_booking_reschedule", {
    p_booking_id: bookingId,
    p_new_booking_date: newBookingDate,
    p_new_start_time: t,
    p_note: note?.trim() ?? "",
  });
  if (error) throw new Error(formatSupabaseError(error));
}

/** Warsztat akceptuje lub odrzuca propozycję terminu od klienta (RPC supabase-39). */
export async function workshopRespondClientReschedule(
  bookingId: string,
  accept: boolean,
): Promise<"accepted" | "rejected"> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase.rpc("workshop_respond_client_reschedule", {
    p_booking_id: bookingId,
    p_accept: accept,
  });
  if (error) throw new Error(formatSupabaseError(error));
  const r = String(data ?? "").toLowerCase();
  return r === "accepted" ? "accepted" : "rejected";
}
