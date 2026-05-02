import type { SupabaseClient } from "@supabase/supabase-js";

/** Zgodne z polityką publicznego odczytu warsztatów (active / approved / aktywny). */
export function isWorkshopStatusPublicVisible(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase().trim();
  return s === "active" || s === "approved" || s === "aktywny";
}

export type WorkshopSummaryRow = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  status: string | null;
};

export type UserFavoriteWorkshopRow = {
  id: string;
  user_id: string;
  workshop_id: string;
  created_at: string;
  workshops: WorkshopSummaryRow | WorkshopSummaryRow[] | null;
};

function singleWorkshop(w: UserFavoriteWorkshopRow["workshops"]): WorkshopSummaryRow | null {
  if (w == null) return null;
  return Array.isArray(w) ? (w[0] ?? null) : w;
}

export async function fetchUserFavoriteWorkshops(
  supabase: SupabaseClient,
  userId: string,
): Promise<Array<{ favoriteId: string; workshop: WorkshopSummaryRow }>> {
  const { data, error } = await supabase
    .from("user_favorite_workshops")
    .select("id, user_id, workshop_id, created_at, workshops ( id, name, city, address, status )")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data as UserFavoriteWorkshopRow[] | null) ?? [];
  const out: Array<{ favoriteId: string; workshop: WorkshopSummaryRow }> = [];
  for (const row of rows) {
    const ws = singleWorkshop(row.workshops);
    if (ws?.id) {
      out.push({ favoriteId: row.id, workshop: ws });
    }
  }
  return out;
}

export async function countUserFavoriteWorkshops(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("user_favorite_workshops")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

export async function isWorkshopFavorited(
  supabase: SupabaseClient,
  userId: string,
  workshopId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_favorite_workshops")
    .select("id")
    .eq("user_id", userId)
    .eq("workshop_id", workshopId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function addFavoriteWorkshop(supabase: SupabaseClient, userId: string, workshopId: string) {
  const { error } = await supabase.from("user_favorite_workshops").insert({
    user_id: userId,
    workshop_id: workshopId,
  });
  if (error) throw error;
}

export async function removeFavoriteWorkshop(supabase: SupabaseClient, userId: string, workshopId: string) {
  const { error } = await supabase
    .from("user_favorite_workshops")
    .delete()
    .eq("user_id", userId)
    .eq("workshop_id", workshopId);
  if (error) throw error;
}
