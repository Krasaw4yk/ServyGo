import { NextResponse } from "next/server";
import { sendClientQuoteSentEmail } from "@/lib/bookingQuoteNotificationSend.server";
import { createSupabaseServiceRoleClient, createSupabaseUserClientFromAccessToken } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  clientUserId?: string;
  clientEmail?: string | null;
  bookingId?: string;
  workshopId?: string;
  subject?: string;
  body?: string;
};

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  const userClient = createSupabaseUserClientFromAccessToken(token);
  const service = createSupabaseServiceRoleClient();
  if (!userClient || !service) {
    return NextResponse.json({ error: "Brak konfiguracji Supabase." }, { status: 503 });
  }

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Sesja wygasła." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON." }, { status: 400 });
  }

  const bookingId = body.bookingId?.trim() ?? "";
  const workshopId = body.workshopId?.trim() ?? "";
  const clientUserId = body.clientUserId?.trim() ?? "";
  const subject = body.subject?.trim() ?? "Wycena gotowa";
  const emailBody = body.body?.trim() ?? "";

  if (!bookingId || !workshopId || !clientUserId || !emailBody) {
    return NextResponse.json({ error: "Wymagane: bookingId, workshopId, clientUserId, body." }, { status: 400 });
  }

  const { data: workshop, error: wErr } = await service
    .from("workshops")
    .select("id, owner_id")
    .eq("id", workshopId)
    .maybeSingle();
  if (wErr || !workshop) {
    return NextResponse.json({ error: "Nie znaleziono warsztatu." }, { status: 404 });
  }
  if (workshop.owner_id !== user.id) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  const { data: booking, error: bErr } = await service
    .from("bookings")
    .select("id, user_id, workshop_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (bErr || !booking) {
    return NextResponse.json({ error: "Nie znaleziono rezerwacji." }, { status: 404 });
  }
  if (booking.workshop_id !== workshopId || booking.user_id !== clientUserId) {
    return NextResponse.json({ error: "Nieprawidłowa rezerwacja." }, { status: 400 });
  }

  try {
    await sendClientQuoteSentEmail({
      clientUserId,
      clientEmail: body.clientEmail ?? null,
      bookingId,
      subject,
      body: emailBody,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[client-quote-sent]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
