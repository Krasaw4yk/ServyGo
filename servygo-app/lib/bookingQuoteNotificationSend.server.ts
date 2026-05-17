import { getAuthUserEmailById } from "@/lib/authUserEmail";
import { sendBookingNotificationEmail } from "@/lib/sendBookingNotificationEmail";

export async function sendClientQuoteSentEmail(payload: {
  clientUserId: string;
  clientEmail?: string | null;
  bookingId: string;
  subject: string;
  body: string;
}): Promise<void> {
  const to =
    payload.clientEmail?.trim() && payload.clientEmail.includes("@")
      ? payload.clientEmail.trim()
      : await getAuthUserEmailById(payload.clientUserId);

  await sendBookingNotificationEmail({
    to: to ?? undefined,
    type: "quote_sent",
    bookingId: payload.bookingId,
    subject: payload.subject,
    body: payload.body,
  });
}

export async function sendWorkshopOwnerQuoteResponseEmail(payload: {
  ownerUserId: string | null;
  ownerEmail?: string | null;
  bookingId: string;
  accepted: boolean;
  subject: string;
  body: string;
}): Promise<void> {
  if (!payload.ownerUserId) return;

  const to =
    payload.ownerEmail?.trim() && payload.ownerEmail.includes("@")
      ? payload.ownerEmail.trim()
      : await getAuthUserEmailById(payload.ownerUserId);

  await sendBookingNotificationEmail({
    to: to ?? undefined,
    type: payload.accepted ? "quote_accepted" : "quote_rejected",
    bookingId: payload.bookingId,
    subject: payload.subject,
    body: payload.body,
  });
}
