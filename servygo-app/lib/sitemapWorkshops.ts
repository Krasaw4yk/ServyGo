import { createClient } from "@supabase/supabase-js";
import { isWorkshopPubliclyVisible } from "@/lib/publicWorkshopsFromDb";

/** ID warsztatów publicznie listowanych (bez demo) — do sitemap /warsztat/[id]. */
export async function listPublicWorkshopIdsForSitemap(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return [];

  const supabase = createClient(url, key);
  const { data, error } = await supabase.from("workshops").select("id,status,is_demo,visibility_status");
  if (error) return [];

  const rows = (data as { id: string; status: string | null; is_demo?: boolean | null; visibility_status?: string | null }[] | null) ?? [];
  return rows
    .filter((r) => isWorkshopPubliclyVisible(r.status, r.visibility_status))
    .filter((r) => r.is_demo !== true)
    .map((r) => r.id);
}
