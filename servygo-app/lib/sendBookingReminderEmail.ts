import { sendEmail } from "@/lib/resendClient";

/**
 * Przypomnienia e-mail o wizycie (Resend).
 */
export type BookingReminderEmailKind = "visit_5_days_before" | "visit_1_day_before";

export async function sendBookingReminderEmail(payload: {
  to: string | null | undefined;
  kind: BookingReminderEmailKind;
  bookingId: string;
  workshopName: string;
  serviceName: string;
  bookingDate: string;
  startTime: string;
}): Promise<void> {
  const to = payload.to?.trim();
  if (!to) {
    console.info("[sendBookingReminderEmail] Brak adresu e-mail odbiorcy — pominięto wysyłkę.", {
      kind: payload.kind,
      bookingId: payload.bookingId,
    });
    return;
  }

  const subjects: Record<BookingReminderEmailKind, string> = {
    visit_5_days_before: "ServyGo: zbliża się Twoja wizyta w warsztacie",
    visit_1_day_before: "ServyGo: przypomnienie o jutrzejszej wizycie",
  };

  const bodies: Record<BookingReminderEmailKind, string> = {
    visit_5_days_before: `Przypominamy, że za kilka dni masz zaplanowaną wizytę w warsztacie ${payload.workshopName} dla usługi ${payload.serviceName}. Termin: ${payload.bookingDate} o ${payload.startTime}. Jeśli wiesz, że nie możesz przyjechać, anuluj wizytę wcześniej, aby warsztat mógł zwolnić termin.`,
    visit_1_day_before: `Jutro masz wizytę w warsztacie ${payload.workshopName} dla usługi ${payload.serviceName}. Termin: ${payload.bookingDate} o ${payload.startTime}. Jeśli nie możesz przyjechać, anuluj wizytę w ServyGo lub skontaktuj się z warsztatem.`,
  };

  try {
    const result = await sendEmail({
      to,
      subject: subjects[payload.kind],
      text: bodies[payload.kind],
    });
    if (!result.sent) {
      console.warn("[sendBookingReminderEmail] Nie wysłono e-maila.", {
        kind: payload.kind,
        bookingId: payload.bookingId,
        reason: result.reason ?? "unknown",
      });
    }
  } catch (error) {
    console.error("[sendBookingReminderEmail] Błąd wysyłki:", error);
  }
}
