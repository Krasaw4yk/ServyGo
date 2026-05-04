import { createClient } from "@supabase/supabase-js";
import { isPubliclyListedWorkshopStatus } from "@/lib/publicWorkshopsFromDb";

/** ID warsztatów publicznie listowanych (status active) — do sitemap /warsztat/[id]. */
export async function listPublicWorkshopIdsForSitemap(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return [];

  const supabase = createClient(url, key);
  const { data, error } = await supabase.from("workshops").select("id,status");
  if (error) return [];

  const rows = (data as { id: string; status: string | null }[] | null) ?? [];
  return rows.filter((r) => isPubliclyListedWorkshopStatus(r.status)).map((r) => r.id);
}
