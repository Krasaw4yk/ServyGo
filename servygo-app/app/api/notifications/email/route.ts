import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient, createSupabaseUserClientFromAccessToken } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  bookingId?: string;
  workshopId?: string;
  recipientId?: string;
  subject?: string;
  message?: string;
};

async function sendWithResend(to: string, subject: string, message: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return { sent: false, reason: "missing_resend_config" as const };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: message,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error: ${response.status} ${text}`);
  }
  return { sent: true as const };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const userClient = createSupabaseUserClientFromAccessToken(token);
  const serviceClient = createSupabaseServiceRoleClient();
  if (!userClient || !serviceClient) {
    return NextResponse.json({ error: "Brak konfiguracji Supabase." }, { status: 503 });
  }

  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) return NextResponse.json({ error: "Brak sesji." }, { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON." }, { status: 400 });
  }

  const bookingId = body.bookingId?.trim() ?? "";
  const workshopId = body.workshopId?.trim() ?? "";
  const recipientId = body.recipientId?.trim() ?? "";
  const subject = body.subject?.trim() ?? "";
  const message = body.message?.trim() ?? "";
  if (!bookingId || !recipientId || !subject || !message) {
    return NextResponse.json({ error: "Wymagane: bookingId, recipientId, subject, message." }, { status: 400 });
  }

  const { data: bookingRow, error: bErr } = await serviceClient
    .from("bookings")
    .select("id, user_id, workshop_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (bErr || !bookingRow) return NextResponse.json({ error: "Nie znaleziono rezerwacji." }, { status: 404 });

  const { data: workshopRow, error: wErr } = await serviceClient
    .from("workshops")
    .select("id, owner_id")
    .eq("id", workshopId || bookingRow.workshop_id)
    .maybeSingle();
  if (wErr || !workshopRow?.owner_id) return NextResponse.json({ error: "Nie znaleziono warsztatu." }, { status: 404 });

  const userId = authData.user.id;
  const isParticipant = userId === bookingRow.user_id || userId === workshopRow.owner_id;
  if (!isParticipant) return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });

  if (recipientId !== bookingRow.user_id && recipientId !== workshopRow.owner_id) {
    return NextResponse.json({ error: "Nieprawidłowy odbiorca." }, { status: 403 });
  }

  const { data: recipientAuth, error: rErr } = await serviceClient.auth.admin.getUserById(recipientId);
  if (rErr || !recipientAuth.user?.email) {
    return NextResponse.json({ error: "Brak e-mail odbiorcy." }, { status: 400 });
  }

  try {
    const result = await sendWithResend(recipientAuth.user.email, subject, message);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Błąd wysyłki e-mail." },
      { status: 502 },
    );
  }
}
