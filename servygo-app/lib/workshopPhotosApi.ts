import { supabase } from "@/lib/supabaseClient";
import { formatSupabaseError } from "@/lib/workshopApi";

export const WORKSHOP_PHOTOS_BUCKET = "workshop-photos";

export type WorkshopPhotoRow = {
  id: string;
  workshop_id: string;
  storage_path: string;
  public_url: string | null;
  uploaded_by: string | null;
  uploaded_by_role: string | null;
  caption: string | null;
  sort_order: number;
  status: "active" | "hidden";
  created_at: string;
  updated_at: string;
};

export async function listActiveWorkshopPhotos(workshopId: string): Promise<WorkshopPhotoRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshop_photos")
    .select("*")
    .eq("workshop_id", workshopId)
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(80);
  if (error) throw new Error(formatSupabaseError(error));
  return (data as WorkshopPhotoRow[] | null) ?? [];
}

export async function listWorkshopPhotosForManage(workshopId: string): Promise<WorkshopPhotoRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshop_photos")
    .select("*")
    .eq("workshop_id", workshopId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(120);
  if (error) throw new Error(formatSupabaseError(error));
  return (data as WorkshopPhotoRow[] | null) ?? [];
}

export async function uploadWorkshopPhoto(params: {
  workshopId: string;
  file: File;
  caption?: string | null;
  uploadedByRole: string;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Musisz być zalogowany.");

  const safeName = params.file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const path = `${params.workshopId}/${crypto.randomUUID()}-${safeName}`;

  const { error: upErr } = await supabase.storage.from(WORKSHOP_PHOTOS_BUCKET).upload(path, params.file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message || "Nie udało się wgrać pliku (sprawdź bucket workshop-photos w Supabase).");

  const pub = supabase.storage.from(WORKSHOP_PHOTOS_BUCKET).getPublicUrl(path);
  const publicUrl = pub.data.publicUrl ?? null;

  const { error } = await supabase.from("workshop_photos").insert({
    workshop_id: params.workshopId,
    storage_path: path,
    public_url: publicUrl,
    uploaded_by: user.id,
    uploaded_by_role: params.uploadedByRole,
    caption: params.caption?.trim() || null,
    sort_order: 0,
    status: "active",
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function setWorkshopPhotoHidden(id: string, hidden: boolean): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.from("workshop_photos").update({ status: hidden ? "hidden" : "active" }).eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}
