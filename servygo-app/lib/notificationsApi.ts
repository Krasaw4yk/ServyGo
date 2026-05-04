"use client";

import { getUnreadMessagesCount } from "@/lib/messagesApi";
import { supabase } from "@/lib/supabaseClient";
import { formatSupabaseError } from "@/lib/workshopApi";

export type AppNotificationType =
  | "quote_ready"
  | "quote_accepted"
  | "quote_rejected"
  | "visit_reminder"
  | "completion_check"
  | "service_not_completed"
  | "service_not_completed_admin"
  | "new_message";

export type UserNotificationRow = {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  booking_id: string | null;
  workshop_id: string | null;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

export async function listUserNotifications(userId: string, limit = 200): Promise<UserNotificationRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id, user_id, notification_type, title, body, booking_id, workshop_id, payload, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(formatSupabaseError(error));
  return ((data as UserNotificationRow[]) ?? []).map((row) => ({
    ...row,
    payload: (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<string, unknown>,
  }));
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { count, error } = await supabase
    .from("user_notifications")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw new Error(formatSupabaseError(error));
  return count ?? 0;
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.from("user_notifications").update({ is_read: true }).eq("id", notificationId);
  if (error) throw new Error(formatSupabaseError(error));
}

/** Licznik nieprzeczytanych wiadomości (internal_messages) + powiadomień aplikacyjnych. */
export async function getUnifiedUnreadCount(userId: string, messagesIncludeAllForAdmin = false): Promise<number> {
  const [a, b] = await Promise.all([
    getUnreadMessagesCount(userId, messagesIncludeAllForAdmin),
    getUnreadNotificationsCount(userId),
  ]);
  return a + b;
}

export async function clientConfirmServiceCompleted(bookingId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.rpc("client_confirm_service_completed", { p_booking_id: bookingId });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function clientReportServiceNotCompleted(bookingId: string, reason: string, note: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.rpc("client_report_service_not_completed", {
    p_booking_id: bookingId,
    p_reason: reason,
    p_note: note,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function insertServiceReview(payload: {
  bookingId: string;
  workshopId: string;
  rating: number;
  comment: string | null;
  userId: string;
}): Promise<string> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("service_reviews")
    .insert({
      booking_id: payload.bookingId,
      workshop_id: payload.workshopId,
      user_id: payload.userId,
      rating: payload.rating,
      comment: payload.comment?.trim() || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  const id = (data as { id: string }).id;
  const { error: uerr } = await supabase
    .from("bookings")
    .update({
      service_review_id: id,
      completion_feedback_status: "rated",
    })
    .eq("id", payload.bookingId)
    .eq("user_id", payload.userId);
  if (uerr) throw new Error(formatSupabaseError(uerr));
  return id;
}
