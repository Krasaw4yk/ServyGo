import { sendEmail } from "@/lib/resendClient";

type NotificationType =
  | "quote_sent"
  | "quote_accepted"
  | "quote_rejected"
  | "booking_cancelled"
  | "reschedule_proposed"
  | "reschedule_accepted"
  | "reschedule_rejected"
  | "internal_message";

function bodyForType(type: NotificationType, bookingId: string): string {
  const id = bookingId.trim();
  switch (type) {
    case "quote_sent":
      return `Warsztat przesłał Ci wycenę dla Twojej rezerwacji #${id}. Zaloguj się do ServyGo, aby ją zaakceptować lub odrzucić.`;
    case "quote_accepted":
      return `Klient zaakceptował Twoją wycenę. Rezerwacja #${id} jest potwierdzona.`;
    case "quote_rejected":
      return `Klient odrzucił wycenę dla rezerwacji #${id}.`;
    case "booking_cancelled":
      return `Rezerwacja #${id} została anulowana.`;
    case "reschedule_proposed":
      return `Zaproponowano nowy termin dla rezerwacji #${id}. Zaloguj się, aby odpowiedzieć.`;
    case "reschedule_accepted":
      return `Zmiana terminu dla rezerwacji #${id} została zaakceptowana.`;
    case "reschedule_rejected":
      return `Zmiana terminu dla rezerwacji #${id} została odrzucona.`;
    case "internal_message":
      return `Masz nową wiadomość w ServyGo dotyczącą rezerwacji #${id}.`;
    default:
      return `Powiadomienie ServyGo dotyczące rezerwacji #${id}.`;
  }
}

export async function sendBookingNotificationEmail(payload: {
  to?: string | null;
  type: NotificationType;
  bookingId: string;
  subject: string;
  body: string;
}): Promise<void> {
  const to = payload.to?.trim();
  if (!to) {
    console.info("[sendBookingNotificationEmail] Brak adresu e-mail odbiorcy — pominięto wysyłkę.", {
      type: payload.type,
      bookingId: payload.bookingId,
    });
    return;
  }

  const subject = payload.subject.trim() || "Powiadomienie ServyGo";
  const text = bodyForType(payload.type, payload.bookingId);

  try {
    const result = await sendEmail({ to, subject, text });
    if (!result.sent) {
      console.warn("[sendBookingNotificationEmail] Nie wysłano e-maila.", {
        type: payload.type,
        bookingId: payload.bookingId,
        reason: result.reason ?? "unknown",
      });
    }
  } catch (error) {
    console.error("[sendBookingNotificationEmail] Błąd wysyłki:", error);
  }
}
