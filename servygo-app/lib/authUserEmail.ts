import { createSupabaseServiceRoleClient } from "@/lib/supabaseAdmin";

/** E-mail z Auth (service role). Best effort — przy błędzie zwraca null. */
export async function getAuthUserEmailById(userId: string): Promise<string | null> {
  const id = userId.trim();
  if (!id) return null;

  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    console.warn("[getAuthUserEmailById] Brak SUPABASE_SERVICE_ROLE_KEY — nie można odczytać e-maila.");
    return null;
  }

  try {
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error) {
      console.warn("[getAuthUserEmailById] Nie znaleziono użytkownika:", id, error.message);
      return null;
    }
    const email = data.user?.email?.trim();
    return email && email.includes("@") ? email : null;
  } catch (err) {
    console.warn("[getAuthUserEmailById] Błąd odczytu e-maila:", err);
    return null;
  }
}
