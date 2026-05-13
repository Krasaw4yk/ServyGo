import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createSupabaseServiceRoleClient,
  createSupabaseUserClientFromAccessToken,
  describeMissingEnvForAdminSupabaseApis,
} from "@/lib/supabaseAdmin";
import {
  findAuthUserIdByEmail,
  normalizeOwnerEmail,
  requireAdminFromAccessToken,
} from "@/lib/serverAdminAuth";
import { getSiteOriginFromRequest } from "@/lib/siteOrigin";

export const runtime = "nodejs";

type Body = { leadId?: string; ownerEmail?: string };

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Brak nagłówka Authorization: Bearer." }, { status: 401 });
  }

  const userClient = createSupabaseUserClientFromAccessToken(token);
  const adminClient = createSupabaseServiceRoleClient();
  if (!userClient || !adminClient) {
    return NextResponse.json(
      {
        error: describeMissingEnvForAdminSupabaseApis({
          hasUserClient: Boolean(userClient),
          hasAdminClient: Boolean(adminClient),
        }),
      },
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

  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  const ownerEmail = normalizeOwnerEmail(typeof body.ownerEmail === "string" ? body.ownerEmail : "");
  if (!leadId || !ownerEmail) {
    return NextResponse.json({ error: "Wymagane pola: leadId, ownerEmail." }, { status: 400 });
  }

  const origin = getSiteOriginFromRequest(request);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/auth/ustaw-haslo")}`;

  let ownerUserId: string | null = null;
  let invited = false;

  try {
    ownerUserId = await findAuthUserIdByEmail(adminClient, ownerEmail);
    if (!ownerUserId) {
      const inviteRes = await adminClient.auth.admin.inviteUserByEmail(ownerEmail, {
        redirectTo,
      });
      if (!inviteRes.error && inviteRes.data.user) {
        ownerUserId = inviteRes.data.user.id;
        invited = true;
      } else {
        return NextResponse.json(
          { error: inviteRes.error?.message ?? "Nie udało się zaprosić użytkownika." },
          { status: 400 },
        );
      }
    } else {
      const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
      if (!anonUrl || !anonKey) {
        return NextResponse.json({ error: "Brak klucza anon do wysłania resetu hasła." }, { status: 503 });
      }
      const mailer = createClient(anonUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: resetErr } = await mailer.auth.resetPasswordForEmail(ownerEmail, {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/ustaw-haslo")}`,
      });
      if (resetErr) {
        return NextResponse.json(
          { error: resetErr.message ?? "Nie udało się wysłać maila resetującego hasło." },
          { status: 400 },
        );
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd Auth.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!ownerUserId) {
    return NextResponse.json({ error: "Brak identyfikatora właściciela." }, { status: 500 });
  }

  const { data: workshopId, error: rpcErr } = await userClient.rpc("admin_approve_workshop_lead", {
    p_lead_id: leadId,
    p_owner_user_id: ownerUserId,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 400 });
  }

  const wid = typeof workshopId === "string" ? workshopId : Array.isArray(workshopId) ? workshopId[0] : null;
  if (!wid || typeof wid !== "string") {
    return NextResponse.json({ error: "Nie udało się utworzyć warsztatu (RPC)." }, { status: 500 });
  }

  return NextResponse.json({ workshopId: wid, invited, ownerUserId });
}
