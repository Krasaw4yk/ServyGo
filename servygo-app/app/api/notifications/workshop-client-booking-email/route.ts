import { NextResponse } from "next/server";
import { getAuthUserEmailById } from "@/lib/authUserEmail";
import { sendBookingNotificationEmail } from "@/lib/sendBookingNotificationEmail";
import { createSupabaseServiceRoleClient, createSupabaseUserClientFromAccessToken } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type NotifyType = "booking_cancelled" | "reschedule_proposed";

type Body = {
  type?: NotifyType;
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

  const type = body.type;
  const bookingId = body.bookingId?.trim() ?? "";
  const workshopId = body.workshopId?.trim() ?? "";
  const clientUserId = body.clientUserId?.trim() ?? "";
  const subject = body.subject?.trim() ?? "";
  const text = body.body?.trim() ?? "";

  if ((type !== "booking_cancelled" && type !== "reschedule_proposed") || !bookingId || !workshopId || !clientUserId || !subject || !text) {
    return NextResponse.json({ error: "Wymagane: type, bookingId, workshopId, clientUserId, subject, body." }, { status: 400 });
  }

  const { data: workshop, error: wErr } = await service
    .from("workshops")
    .select("id, owner_id")
    .eq("id", workshopId)
    .maybeSingle();
  if (wErr || !workshop || workshop.owner_id !== user.id) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  const { data: booking, error: bErr } = await service
    .from("bookings")
    .select("id, user_id, workshop_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (bErr || !booking || booking.workshop_id !== workshopId || booking.user_id !== clientUserId) {
    return NextResponse.json({ error: "Nieprawidłowa rezerwacja." }, { status: 400 });
  }

  const snapEmail = body.clientEmail?.trim();
  const to =
    snapEmail && snapEmail.includes("@") ? snapEmail : await getAuthUserEmailById(clientUserId);

  try {
    await sendBookingNotificationEmail({
      to: to ?? undefined,
      type,
      bookingId,
      subject,
      body: text,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[workshop-client-booking-email]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
