"use client";

import { supabase } from "@/lib/supabaseClient";
import { formatSupabaseError } from "@/lib/workshopApi";

export type UserCalendarEventStatus = "upcoming" | "completed" | "cancelled";

export type UserCalendarEventRow = {
  id: string;
  user_id: string;
  car_id: string | null;
  title: string;
  event_type: string;
  event_date: string;
  event_time: string | null;
  description: string | null;
  reminder_days_before: number | null;
  status: UserCalendarEventStatus | string;
  created_at: string;
  updated_at: string;
};

export type UserCalendarEventInput = {
  title: string;
  event_type: string;
  event_date: string;
  event_time?: string | null;
  car_id?: string | null;
  description?: string | null;
  reminder_days_before?: number | null;
  status?: UserCalendarEventStatus | string;
};

export async function listUserCalendarEvents(userId: string): Promise<UserCalendarEventRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("user_calendar_events")
    .select("*")
    .eq("user_id", userId)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: false });
  if (error) throw new Error(formatSupabaseError(error));
  return (data as UserCalendarEventRow[] | null) ?? [];
}

export async function insertUserCalendarEvent(userId: string, input: UserCalendarEventInput): Promise<UserCalendarEventRow> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("user_calendar_events")
    .insert({
      user_id: userId,
      title: input.title.trim(),
      event_type: (input.event_type || "custom").trim(),
      event_date: input.event_date,
      event_time: input.event_time?.trim() || null,
      car_id: input.car_id ?? null,
      description: input.description?.trim() || null,
      reminder_days_before: input.reminder_days_before ?? null,
      status: input.status ?? "upcoming",
    })
    .select("*")
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as UserCalendarEventRow;
}

export async function updateUserCalendarEvent(
  userId: string,
  id: string,
  patch: Partial<UserCalendarEventInput> & { status?: string },
): Promise<UserCalendarEventRow> {
  if (!supabase) throw new Error("Supabase client not available.");
  const payload: Record<string, unknown> = {};
  if (patch.title != null) payload.title = patch.title.trim();
  if (patch.event_type != null) payload.event_type = patch.event_type.trim();
  if (patch.event_date != null) payload.event_date = patch.event_date;
  if (patch.event_time !== undefined) payload.event_time = patch.event_time?.trim() || null;
  if (patch.car_id !== undefined) payload.car_id = patch.car_id;
  if (patch.description !== undefined) payload.description = patch.description?.trim() || null;
  if (patch.reminder_days_before !== undefined) payload.reminder_days_before = patch.reminder_days_before;
  if (patch.status != null) payload.status = patch.status;
  const { data, error } = await supabase
    .from("user_calendar_events")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as UserCalendarEventRow;
}

export async function deleteUserCalendarEvent(userId: string, id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.from("user_calendar_events").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(formatSupabaseError(error));
}
