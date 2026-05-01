/**
 * Placeholder for future transactional e-mail (Resend / Edge Function).
 * Wire real delivery here without changing call sites.
 */
export async function sendBookingNotificationEmail(payload: {
  to?: string | null;
  type:
    | "quote_sent"
    | "quote_accepted"
    | "quote_rejected"
    | "booking_cancelled"
    | "reschedule_proposed"
    | "reschedule_accepted"
    | "reschedule_rejected"
    | "internal_message";
  bookingId: string;
  subject: string;
  body: string;
}): Promise<void> {
  console.info("[sendBookingNotificationEmail:TODO]", {
    type: payload.type,
    bookingId: payload.bookingId,
    to: payload.to ?? null,
    subject: payload.subject,
    bodyPreview: payload.body.slice(0, 160),
  });
}
