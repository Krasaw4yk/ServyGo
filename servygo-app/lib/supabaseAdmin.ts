import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Komunikat dla API admina, gdy brakuje zmiennych do klienta użytkownika lub service role.
 * Nie zwraca wartości sekretów — tylko nazwy zmiennych.
 */
export function describeMissingEnvForAdminSupabaseApis(params: {
  hasUserClient: boolean;
  hasAdminClient: boolean;
}): string {
  const url = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const anon = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  const service = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  const missing = new Set<string>();
  if (!params.hasUserClient) {
    if (!url) missing.add("NEXT_PUBLIC_SUPABASE_URL");
    if (!anon) missing.add("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!params.hasAdminClient) {
    if (!url) missing.add("NEXT_PUBLIC_SUPABASE_URL");
    if (!service) missing.add("SUPABASE_SERVICE_ROLE_KEY");
  }

  const list = [...missing];
  if (list.length === 0) {
    return "Brak klientów Supabase po stronie serwera (sprawdź .env.local i zrestartuj proces Node).";
  }

  const onlyServiceMissing = list.length === 1 && list[0] === "SUPABASE_SERVICE_ROLE_KEY";
  const serviceHint = onlyServiceMissing
    ? " Wpisz go w .env.local w katalogu servygo-app (wartość „service_role” z Supabase → Project Settings → API), zrestartuj `npm run dev`. Nie używaj prefiksu NEXT_PUBLIC_."
    : list.includes("SUPABASE_SERVICE_ROLE_KEY")
      ? " W tym SUPABASE_SERVICE_ROLE_KEY (service_role z Supabase → Settings → API) — tylko na serwerze, bez NEXT_PUBLIC_."
      : "";

  return `Brakuje zmiennych środowiska serwera: ${list.join(", ")}.${serviceHint}`;
}

/** Klient z service_role — tylko import na serwerze (Route Handlers / Server Actions). */
export function createSupabaseServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createSupabaseUserClientFromAccessToken(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
