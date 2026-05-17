import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertCanManageWorkshopPhotos(
  userClient: SupabaseClient,
  userId: string,
  workshopId: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const { data: workshop, error: workshopErr } = await userClient
    .from("workshops")
    .select("id, owner_id")
    .eq("id", workshopId)
    .maybeSingle();

  if (workshopErr) {
    return { error: workshopErr.message || "Nie udało się zweryfikować warsztatu.", status: 500 };
  }
  if (!workshop) {
    return { error: "Nie znaleziono warsztatu.", status: 404 };
  }
  if (workshop.owner_id === userId) {
    return { ok: true };
  }

  const { data: adminRow, error: adminErr } = await userClient
    .from("admin_users")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (adminErr) {
    return { error: adminErr.message || "Nie udało się zweryfikować uprawnień.", status: 500 };
  }
  if (adminRow) {
    return { ok: true };
  }

  return { error: "Brak uprawnień do zarządzania zdjęciami tego warsztatu.", status: 403 };
}
