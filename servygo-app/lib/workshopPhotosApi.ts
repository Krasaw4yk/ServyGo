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
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Musisz być zalogowany.");

  const formData = new FormData();
  formData.append("workshopId", params.workshopId);
  formData.append("file", params.file);
  formData.append("uploadedByRole", params.uploadedByRole);
  if (params.caption?.trim()) {
    formData.append("caption", params.caption.trim());
  }

  const res = await fetch("/api/workshop/photos/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  let payload: { error?: string } = {};
  try {
    payload = (await res.json()) as { error?: string };
  } catch {
    payload = {};
  }

  if (!res.ok) {
    throw new Error(payload.error || "Upload nie powiódł się.");
  }
}

export async function setWorkshopPhotoHidden(id: string, hidden: boolean): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.from("workshop_photos").update({ status: hidden ? "hidden" : "active" }).eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}
