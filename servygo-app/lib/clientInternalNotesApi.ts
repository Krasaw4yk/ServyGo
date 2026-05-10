import { supabase } from "@/lib/supabaseClient";
import { formatSupabaseError } from "@/lib/workshopApi";

export type ClientInternalNoteType = "neutral" | "positive" | "warning" | "problem";

export type ClientInternalNoteRow = {
  id: string;
  client_user_id: string;
  booking_id: string | null;
  workshop_id: string | null;
  author_user_id: string;
  author_role: "workshop" | "admin";
  note_type: ClientInternalNoteType;
  content: string;
  created_at: string;
  updated_at: string;
  author_label?: string | null;
  workshop_name?: string | null;
};

export type AddWorkshopClientNotePayload = {
  clientUserId: string;
  workshopId: string;
  bookingId?: string | null;
  noteType: ClientInternalNoteType;
  content: string;
};

export type AddAdminClientNotePayload = {
  clientUserId: string;
  bookingId?: string | null;
  workshopId?: string | null;
  noteType: ClientInternalNoteType;
  content: string;
};

function mapRpcRow(row: Record<string, unknown>): ClientInternalNoteRow {
  return {
    id: String(row.id),
    client_user_id: String(row.client_user_id),
    booking_id: row.booking_id != null ? String(row.booking_id) : null,
    workshop_id: row.workshop_id != null ? String(row.workshop_id) : null,
    author_user_id: String(row.author_user_id),
    author_role: row.author_role === "admin" ? "admin" : "workshop",
    note_type: normalizeNoteType(row.note_type),
    content: String(row.content ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    author_label: row.author_label != null ? String(row.author_label) : null,
    workshop_name: row.workshop_name != null ? String(row.workshop_name) : null,
  };
}

function normalizeNoteType(raw: unknown): ClientInternalNoteType {
  const t = String(raw ?? "neutral").toLowerCase().trim();
  if (t === "positive" || t === "warning" || t === "problem" || t === "neutral") return t;
  return "neutral";
}

function assertContent(content: string): string {
  const t = content.trim();
  if (t.length < 3 || t.length > 1000) throw new Error("Treść notatki musi mieć od 3 do 1000 znaków.");
  return t;
}

export async function listClientInternalNotesForWorkshop(
  clientUserId: string,
  workshopId: string,
): Promise<ClientInternalNoteRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase.rpc("list_client_internal_notes", {
    p_client_user_id: clientUserId,
    p_workshop_id: workshopId,
  });
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data as Record<string, unknown>[] | null) ?? [];
  return rows.map(mapRpcRow);
}

export async function addClientInternalNoteAsWorkshop(payload: AddWorkshopClientNotePayload): Promise<string> {
  if (!supabase) throw new Error("Supabase client not available.");
  const content = assertContent(payload.content);
  const { data, error } = await supabase.rpc("add_client_internal_note", {
    p_client_user_id: payload.clientUserId,
    p_booking_id: payload.bookingId ?? null,
    p_workshop_id: payload.workshopId,
    p_note_type: payload.noteType,
    p_content: content,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return String(data ?? "");
}

export async function listClientInternalNotesForAdmin(
  clientUserId: string,
  currentUserId: string,
  email?: string | null,
): Promise<ClientInternalNoteRow[]> {
  void currentUserId;
  void email;
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase.rpc("list_client_internal_notes", {
    p_client_user_id: clientUserId,
    p_workshop_id: null,
  });
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data as Record<string, unknown>[] | null) ?? [];
  return rows.map(mapRpcRow);
}

export async function addClientInternalNoteAsAdmin(payload: AddAdminClientNotePayload): Promise<string> {
  if (!supabase) throw new Error("Supabase client not available.");
  const content = assertContent(payload.content);
  const { data, error } = await supabase.rpc("add_client_internal_note", {
    p_client_user_id: payload.clientUserId,
    p_booking_id: payload.bookingId ?? null,
    p_workshop_id: payload.workshopId ?? null,
    p_note_type: payload.noteType,
    p_content: content,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return String(data ?? "");
}

export async function softDeleteClientInternalNote(
  noteId: string,
  currentUserId: string,
  email?: string | null,
): Promise<void> {
  void currentUserId;
  void email;
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.rpc("soft_delete_client_internal_note", {
    p_note_id: noteId,
  });
  if (error) throw new Error(formatSupabaseError(error));
}
