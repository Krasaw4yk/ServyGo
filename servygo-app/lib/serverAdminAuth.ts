import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAuthOk = { userId: string; email: string | undefined };

export async function requireAdminFromAccessToken(
  userClient: SupabaseClient,
): Promise<AdminAuthOk | { error: string; status: number }> {
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return { error: "Brak lub nieprawidłowa sesja.", status: 401 };
  }
  const userId = userData.user.id;
  const { data: adminRow, error: adminErr } = await userClient
    .from("admin_users")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (adminErr || !adminRow) {
    return { error: "Brak uprawnień administratora.", status: 403 };
  }
  return { userId, email: userData.user.email ?? undefined };
}

export function normalizeOwnerEmail(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t || !t.includes("@")) return null;
  return t;
}

export async function findAuthUserIdByEmail(
  adminClient: SupabaseClient,
  email: string,
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < perPage) break;
  }
  return null;
}
