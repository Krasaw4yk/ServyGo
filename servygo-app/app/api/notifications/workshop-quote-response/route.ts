import { NextResponse } from "next/server";
import { sendWorkshopOwnerQuoteResponseEmail } from "@/lib/bookingQuoteNotificationSend.server";
import { createSupabaseServiceRoleClient, createSupabaseUserClientFromAccessToken } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  ownerUserId?: string | null;
  ownerEmail?: string | null;
  bookingId?: string;
  workshopId?: string;
  accepted?: boolean;
  emailSubject?: string;
  emailBody?: string;
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
  const accepted = body.accepted === true;
  const subject = body.emailSubject?.trim() ?? "";
  const emailBody = body.emailBody?.trim() ?? "";
  const ownerUserId = body.ownerUserId?.trim() ?? "";

  if (!bookingId || !workshopId || !ownerUserId || !subject || !emailBody) {
    return NextResponse.json({ error: "Wymagane: bookingId, workshopId, ownerUserId, emailSubject, emailBody." }, { status: 400 });
  }

  const { data: booking, error: bErr } = await service
    .from("bookings")
    .select("id, user_id, workshop_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (bErr || !booking) {
    return NextResponse.json({ error: "Nie znaleziono rezerwacji." }, { status: 404 });
  }
  if (booking.user_id !== user.id) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }
  if (booking.workshop_id !== workshopId) {
    return NextResponse.json({ error: "Nieprawidłowy warsztat." }, { status: 400 });
  }

  const { data: workshop, error: wErr } = await service
    .from("workshops")
    .select("id, owner_id")
    .eq("id", workshopId)
    .maybeSingle();
  if (wErr || !workshop?.owner_id || workshop.owner_id !== ownerUserId) {
    return NextResponse.json({ error: "Nieprawidłowy właściciel warsztatu." }, { status: 400 });
  }

  try {
    await sendWorkshopOwnerQuoteResponseEmail({
      ownerUserId,
      ownerEmail: body.ownerEmail ?? null,
      bookingId,
      accepted,
      subject,
      body: emailBody,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[workshop-quote-response]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
