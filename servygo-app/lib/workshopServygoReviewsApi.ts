import { supabase } from "@/lib/supabaseClient";
import { formatSupabaseError } from "@/lib/workshopApi";

export type ServygoReviewDisplayMode = "first_initial" | "nickname";

export type ServygoReviewStatus = "published" | "pending" | "hidden" | "reported";

export type WorkshopServygoReviewRow = {
  id: string;
  workshop_id: string;
  user_id: string;
  booking_id: string | null;
  service_name: string | null;
  rating: number;
  comment: string;
  display_name_mode: ServygoReviewDisplayMode;
  display_name_snapshot: string;
  status: ServygoReviewStatus;
  created_at: string;
  updated_at: string;
};

const ELIGIBLE_BOOKING_STATUSES = ["completed", "done", "quote_accepted", "confirmed"];

export async function fetchPublishedServygoReviewsForWorkshop(workshopId: string): Promise<WorkshopServygoReviewRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshop_servygo_reviews")
    .select("*")
    .eq("workshop_id", workshopId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(formatSupabaseError(error));
  return (data as WorkshopServygoReviewRow[] | null) ?? [];
}

export async function fetchServygoReviewsForWorkshopOwner(workshopId: string): Promise<WorkshopServygoReviewRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshop_servygo_reviews")
    .select("*")
    .eq("workshop_id", workshopId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(formatSupabaseError(error));
  return (data as WorkshopServygoReviewRow[] | null) ?? [];
}

export async function listServygoReviewsForAdmin(limit = 300): Promise<WorkshopServygoReviewRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase.from("workshop_servygo_reviews").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(formatSupabaseError(error));
  return (data as WorkshopServygoReviewRow[] | null) ?? [];
}

export async function updateServygoReviewStatusAdmin(id: string, status: ServygoReviewStatus): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.from("workshop_servygo_reviews").update({ status }).eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function deleteServygoReviewOwn(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.from("workshop_servygo_reviews").delete().eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function listEligibleBookingsForServygoReview(userId: string, workshopId: string): Promise<
  { id: string; service_name: string | null; status: string | null; booking_date: string | null }[]
> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("bookings")
    .select("id, service_name, status, booking_date")
    .eq("user_id", userId)
    .eq("workshop_id", workshopId)
    .in("status", ELIGIBLE_BOOKING_STATUSES)
    .order("booking_date", { ascending: false })
    .limit(50);
  if (error) throw new Error(formatSupabaseError(error));
  return (data as { id: string; service_name: string | null; status: string | null; booking_date: string | null }[] | null) ?? [];
}

function buildDisplaySnapshot(params: {
  mode: ServygoReviewDisplayMode;
  firstName: string;
  lastName: string;
  nickname: string;
}): string {
  if (params.mode === "nickname") {
    return params.nickname.trim() || "Użytkownik ServyGo";
  }
  const fn = params.firstName.trim();
  const ln = params.lastName.trim();
  if (!fn && !ln) return "Użytkownik ServyGo";
  if (!ln) return fn;
  return `${fn} ${ln.charAt(0).toUpperCase()}.`.trim();
}

export async function submitServygoReview(payload: {
  workshopId: string;
  userId: string;
  bookingId: string | null;
  serviceName: string | null;
  rating: number;
  comment: string;
  displayNameMode: ServygoReviewDisplayMode;
  nicknameForReview: string;
  profileFirstName: string;
  profileLastName: string;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  if (payload.displayNameMode === "nickname" && !payload.nicknameForReview.trim()) {
    throw new Error("Podaj pseudonim podpisujący opinię.");
  }
  const snapshot = buildDisplaySnapshot({
    mode: payload.displayNameMode,
    firstName: payload.profileFirstName,
    lastName: payload.profileLastName,
    nickname: payload.nicknameForReview,
  });

  const row = {
    workshop_id: payload.workshopId,
    user_id: payload.userId,
    booking_id: payload.bookingId,
    service_name: payload.serviceName?.trim() || null,
    rating: payload.rating,
    comment: payload.comment.trim(),
    display_name_mode: payload.displayNameMode,
    display_name_snapshot: snapshot,
    status: "pending" as const,
  };

  const { error } = await supabase.from("workshop_servygo_reviews").insert(row);
  if (error) throw new Error(formatSupabaseError(error));
}

export function averageRating(rows: Pick<WorkshopServygoReviewRow, "rating">[]): number {
  if (!rows.length) return 0;
  const sum = rows.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  return Math.round((sum / rows.length) * 10) / 10;
}
