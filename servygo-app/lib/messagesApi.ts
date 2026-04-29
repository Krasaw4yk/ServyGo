"use client";

import { supabase } from "@/lib/supabaseClient";
import { formatSupabaseError } from "@/lib/workshopApi";
import { isAdmin } from "@/lib/adminApi";
import { getOwnedWorkshopForUser } from "@/lib/workshopOwnerApi";

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
    return {
      ...row,
      sender_label: profileLabel(senderProfile, workshopName ?? roleLabel(row.sender_role)),
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
  const [adminAccess, ownedWorkshop] = await Promise.all([
    isAdmin(userId, email),
    getOwnedWorkshopForUser(userId).catch(() => null),
  ]);
  return {
    isAdminOrOwner: adminAccess,
    isWorkshopOwner: Boolean(ownedWorkshop),
    workshopId: ownedWorkshop?.id ?? null,
    role: adminAccess ? ("admin" as const) : ownedWorkshop ? ("workshop" as const) : ("client" as const),
  };
}

export async function getInboxMessages(userId: string, includeAllForAdmin = false): Promise<InternalMessage[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  let query = supabase
    .from("internal_messages")
    .select("id, sender_id, recipient_id, sender_role, recipient_role, subject, body, related_booking_id, related_workshop_id, is_read, created_at")
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
    .select("id, sender_id, recipient_id, sender_role, recipient_role, subject, body, related_booking_id, related_workshop_id, is_read, created_at")
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
  const { error } = await supabase.from("internal_messages").update({ is_read: true }).eq("id", messageId);
  if (error) throw new Error(formatSupabaseError(error));
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
  });
}
