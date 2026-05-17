"use client";

import { sendBookingEmailNotification } from "@/lib/notificationApi";
import { sendBookingNotificationEmail } from "@/lib/sendBookingNotificationEmail";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

function originForLinks(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
}

async function authBearerToken(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token?.trim() || null;
}

export function quoteDecisionLabel(
  quoteStatus: string | null | undefined,
  bookingStatus: string | null | undefined,
  t?: (path: string) => string,
): string {
  const qs = (quoteStatus ?? "").trim().toLowerCase();
  const bs = (bookingStatus ?? "").trim().toLowerCase();

  let pathKey: keyof typeof FALLBACK_DECISION_LABELS_BY_PATH | null = null;
  if (qs === "sent" || qs === "pending_client_decision") pathKey = "bookingsPage.quoteDecision.pendingClient";
  else if (qs === "accepted") pathKey = "bookingsPage.quoteDecision.acceptedByClient";
  else if (qs === "rejected") pathKey = "bookingsPage.quoteDecision.rejectedByClient";
  else if (qs === "cancelled") pathKey = "bookingsPage.quoteDecision.quoteCancelled";
  else if (bs === "quote_sent") pathKey = "bookingsPage.quoteDecision.pendingClient";
  else if (bs === "awaiting_new_quote") pathKey = "bookingsPage.quoteDecision.awaitingNewQuote";
  else if (bs === "quote_rejected") pathKey = "bookingsPage.quoteDecision.quoteRejectedShort";
  else if (bs === "confirmed" && qs === "") pathKey = "bookingsPage.quoteDecision.acceptedConfirmed";

  if (pathKey) return t ? t(pathKey) : FALLBACK_DECISION_LABELS_BY_PATH[pathKey];
  return t ? t("commonUi.dash") : "—";
}

const FALLBACK_DECISION_LABELS_BY_PATH = {
  "bookingsPage.quoteDecision.pendingClient": "Oczekuje na decyzję klienta",
  "bookingsPage.quoteDecision.acceptedByClient": "Zaakceptowana przez klienta",
  "bookingsPage.quoteDecision.rejectedByClient": "Odrzucona przez klienta",
  "bookingsPage.quoteDecision.quoteCancelled": "Anulowana (wycena)",
  "bookingsPage.quoteDecision.awaitingNewQuote": "Odrzucona — oczekuje na nową wycenę",
  "bookingsPage.quoteDecision.quoteRejectedShort": "Wycena odrzucona",
  "bookingsPage.quoteDecision.acceptedConfirmed": "Zaakceptowana — potwierdzona",
} as const;

export async function notifyClientBookingQuoteSent(payload: {
  clientUserId: string;
  clientEmail?: string | null;
  bookingId: string;
  workshopId: string;
  workshopName: string;
  serviceName: string;
  bookingDateLine: string;
  priceNumber: number;
  quoteNote?: string | null;
}): Promise<void> {
  const origin = originForLinks();
  const link = origin ? `${origin}/moje-rezerwacje` : "/moje-rezerwacje";
  const priceFormatted = payload.priceNumber.toFixed(2);
  const noteLine = payload.quoteNote?.trim()
    ? `\nWiadomość od warsztatu: ${payload.quoteNote.trim()}`
    : "";

  await sendBookingEmailNotification({
    bookingId: payload.bookingId,
    workshopId: payload.workshopId,
    recipientId: payload.clientUserId,
    subject: "ServyGo: warsztat wysłał wycenę",
    message: [
      `Warsztat: ${payload.workshopName}`,
      `Usługa: ${payload.serviceName}`,
      `Kwota: ${priceFormatted} zł.${noteLine}`,
      "",
      `Zaloguj się i przejdź do: ${link}`,
    ].join("\n"),
  });

  const emailBody = [
    `Warsztat ${payload.workshopName} wysłał wycenę dla usługi ${payload.serviceName}.`,
    `Kwota: ${priceFormatted} zł.${noteLine}`,
    "",
    `Wejdź w Moje rezerwacje (${link}), aby zaakceptować lub odrzucić.`,
    `Termin rezerwacji: ${payload.bookingDateLine}`,
  ].join("\n");

  const subject = "Wycena gotowa";
  const token = await authBearerToken();
  if (token) {
    try {
      const res = await fetch("/api/notifications/client-quote-sent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientUserId: payload.clientUserId,
          clientEmail: payload.clientEmail ?? null,
          bookingId: payload.bookingId,
          workshopId: payload.workshopId,
          subject,
          body: emailBody,
        }),
      });
      if (res.ok) return;
      console.warn("[notifyClientBookingQuoteSent] API client-quote-sent nie powiodło się, fallback lokalny.");
    } catch (e) {
      console.warn("[notifyClientBookingQuoteSent] Błąd API, fallback lokalny:", e);
    }
  }

  await sendBookingNotificationEmail({
    to: payload.clientEmail ?? undefined,
    type: "quote_sent",
    bookingId: payload.bookingId,
    subject,
    body: emailBody,
  });
}

export async function notifyWorkshopOwnerQuoteResponded(payload: {
  ownerUserId: string | null;
  ownerEmail?: string | null;
  bookingId: string;
  workshopId: string;
  workshopName: string;
  serviceName: string;
  accepted: boolean;
  finalPrice?: number | null;
  emailSubject?: string;
  emailBody?: string;
}): Promise<void> {
  if (!payload.ownerUserId) return;
  const priceBit =
    payload.accepted && payload.finalPrice != null && Number.isFinite(payload.finalPrice)
      ? ` Kwota: ${payload.finalPrice.toFixed(2)} zł.`
      : "";
  const subject =
    payload.emailSubject ?? (payload.accepted ? "Klient zaakceptował wycenę" : "Klient odrzucił wycenę");
  const body =
    payload.emailBody ??
    (payload.accepted
      ? `Klient zaakceptował wycenę dla usługi „${payload.serviceName}”.${priceBit} Warsztat: ${payload.workshopName}.`
      : `Klient odrzucił wycenę dla usługi „${payload.serviceName}”. Warsztat: ${payload.workshopName}.`);

  const token = await authBearerToken();
  if (token) {
    try {
      const res = await fetch("/api/notifications/workshop-quote-response", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ownerUserId: payload.ownerUserId,
          ownerEmail: payload.ownerEmail ?? null,
          bookingId: payload.bookingId,
          workshopId: payload.workshopId,
          accepted: payload.accepted,
          emailSubject: subject,
          emailBody: body,
        }),
      });
      if (res.ok) return;
      console.warn("[notifyWorkshopOwnerQuoteResponded] API nie powiodło się, fallback lokalny.");
    } catch (e) {
      console.warn("[notifyWorkshopOwnerQuoteResponded] Błąd API, fallback lokalny:", e);
    }
  }

  await sendBookingNotificationEmail({
    to: payload.ownerEmail ?? undefined,
    type: payload.accepted ? "quote_accepted" : "quote_rejected",
    bookingId: payload.bookingId,
    subject,
    body,
  });
}

/** E-mail do klienta z panelu warsztatu (anulowanie / zmiana terminu). */
export async function sendWorkshopClientBookingEmail(payload: {
  type: "booking_cancelled" | "reschedule_proposed";
  booking: { id: string; user_id: string; client_email?: string | null };
  workshopId: string;
  subject: string;
  body: string;
}): Promise<void> {
  const token = await authBearerToken();
  if (token) {
    try {
      const res = await fetch("/api/notifications/workshop-client-booking-email", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: payload.type,
          clientUserId: payload.booking.user_id,
          clientEmail: payload.booking.client_email ?? null,
          bookingId: payload.booking.id,
          workshopId: payload.workshopId,
          subject: payload.subject,
          body: payload.body,
        }),
      });
      if (res.ok) return;
      console.warn("[sendWorkshopClientBookingEmail] API nie powiodło się, fallback lokalny.");
    } catch (e) {
      console.warn("[sendWorkshopClientBookingEmail] Błąd API, fallback lokalny:", e);
    }
  }

  await sendBookingNotificationEmail({
    to: payload.booking.client_email ?? undefined,
    type: payload.type,
    bookingId: payload.booking.id,
    subject: payload.subject,
    body: payload.body,
  });
}
