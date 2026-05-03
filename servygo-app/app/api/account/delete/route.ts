import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient, createSupabaseUserClientFromAccessToken } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = { confirmationEmail?: string };

function isBlockingBookingStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase().trim();
  if (!s) return false;
  if (s.startsWith("cancelled")) return false;
  if (s === "completed" || s === "done" || s === "quote_rejected" || s === "rejected") return false;
  return true;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Brak nagłówka Authorization: Bearer." }, { status: 401 });
  }

  const userClient = createSupabaseUserClientFromAccessToken(token);
  const service = createSupabaseServiceRoleClient();
  if (!userClient || !service) {
    return NextResponse.json({ error: "Brak konfiguracji Supabase po stronie serwera." }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Sesja wygasła lub brak użytkownika." }, { status: 401 });
  }

  const email = (user.email ?? "").trim().toLowerCase();
  const confirmation = typeof body.confirmationEmail === "string" ? body.confirmationEmail.trim().toLowerCase() : "";
  if (!confirmation || confirmation !== email) {
    return NextResponse.json({ error: "Potwierdź wpisując dokładnie adres e-mail konta." }, { status: 400 });
  }

  const { data: bookings, error: bookingErr } = await userClient
    .from("bookings")
    .select("id, status")
    .eq("user_id", user.id)
    .limit(200);

  if (bookingErr) {
    return NextResponse.json({ error: bookingErr.message }, { status: 400 });
  }

  const blocking = (bookings ?? []).filter((b: { status?: string | null }) => isBlockingBookingStatus(b.status));
  if (blocking.length > 0) {
    return NextResponse.json(
      {
        error:
          "Nie możesz usunąć konta, dopóki masz aktywną rezerwację. Najpierw anuluj lub zakończ rezerwację w ServyGo.",
      },
      { status: 409 },
    );
  }

  const deletedEmail = `deleted_${user.id.replace(/-/g, "").slice(0, 12)}@servygo.invalid`;

  const { error: profileErr } = await service
    .from("profiles")
    .update({
      deleted_at: new Date().toISOString(),
      account_status: "deleted",
      first_name: "Usunięte",
      last_name: "konto",
      phone: null,
      review_public_nickname: null,
      email: deletedEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 400 });
  }

  const { error: banErr } = await service.auth.admin.updateUserById(user.id, {
    ban_duration: "876600h",
  });
  if (banErr) {
    return NextResponse.json({ error: banErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
