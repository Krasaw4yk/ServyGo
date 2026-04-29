import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createSupabaseServiceRoleClient,
  createSupabaseUserClientFromAccessToken,
} from "@/lib/supabaseAdmin";
import { requireAdminFromAccessToken } from "@/lib/serverAdminAuth";
import { getSiteOriginFromRequest } from "@/lib/siteOrigin";

export const runtime = "nodejs";

type Body = { workshopId?: string };

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Brak nagłówka Authorization: Bearer." }, { status: 401 });
  }

  const userClient = createSupabaseUserClientFromAccessToken(token);
  const serviceAdmin = createSupabaseServiceRoleClient();
  if (!userClient || !serviceAdmin) {
    return NextResponse.json(
      { error: "Brak konfiguracji Supabase lub SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const adminGate = await requireAdminFromAccessToken(userClient);
  if ("error" in adminGate) {
    return NextResponse.json({ error: adminGate.error }, { status: adminGate.status });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON." }, { status: 400 });
  }

  const workshopId = typeof body.workshopId === "string" ? body.workshopId.trim() : "";
  if (!workshopId) {
    return NextResponse.json({ error: "Wymagane pole: workshopId." }, { status: 400 });
  }

  const { data: row, error: wErr } = await userClient
    .from("workshops")
    .select("owner_id")
    .eq("id", workshopId)
    .maybeSingle();

  if (wErr || !row?.owner_id) {
    return NextResponse.json(
      { error: "Warsztat nie ma przypisanego właściciela lub brak dostępu." },
      { status: 400 },
    );
  }

  const { data: authUser, error: guErr } = await serviceAdmin.auth.admin.getUserById(row.owner_id as string);
  if (guErr || !authUser.user?.email) {
    return NextResponse.json({ error: "Nie udało się odczytać adresu e-mail właściciela z Auth." }, { status: 400 });
  }

  const origin = getSiteOriginFromRequest(request);
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonUrl || !anonKey) {
    return NextResponse.json({ error: "Brak klucza anon." }, { status: 503 });
  }

  const mailer = createClient(anonUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: resetErr } = await mailer.auth.resetPasswordForEmail(authUser.user.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/ustaw-haslo")}`,
  });

  if (resetErr) {
    return NextResponse.json({ error: resetErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
