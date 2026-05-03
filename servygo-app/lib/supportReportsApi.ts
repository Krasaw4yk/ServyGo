import { supabase } from "@/lib/supabaseClient";
import { formatSupabaseError } from "@/lib/workshopApi";

export type SupportReportStatus = "new" | "in_progress" | "closed";

export type SupportReportRow = {
  id: string;
  user_id: string | null;
  email: string;
  report_type: string;
  subject: string;
  message: string;
  booking_id: string | null;
  workshop_id: string | null;
  legal_ack: boolean;
  status: SupportReportStatus;
  created_at: string;
  updated_at: string;
};

export type SupportReportInsert = {
  email: string;
  report_type: string;
  subject: string;
  message: string;
  booking_id?: string | null;
  workshop_id?: string | null;
  legal_ack: boolean;
  /** Gdy zalogowany — ustawiane po stronie klienta na user.id */
  user_id?: string | null;
};

export async function submitSupportReport(payload: SupportReportInsert): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const row = {
    email: payload.email.trim(),
    report_type: payload.report_type.trim(),
    subject: payload.subject.trim(),
    message: payload.message.trim(),
    booking_id: payload.booking_id?.trim() || null,
    workshop_id: payload.workshop_id?.trim() || null,
    legal_ack: payload.legal_ack,
    user_id: payload.user_id ?? null,
  };
  const { error } = await supabase.from("support_reports").insert(row);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function listSupportReportsForAdmin(limit = 200): Promise<SupportReportRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("support_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(formatSupabaseError(error));
  return (data as SupportReportRow[] | null) ?? [];
}

export async function updateSupportReportStatus(id: string, status: SupportReportStatus): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.from("support_reports").update({ status }).eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}
