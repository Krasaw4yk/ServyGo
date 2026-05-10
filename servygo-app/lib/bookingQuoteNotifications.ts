"use client";

import { sendBookingEmailNotification } from "@/lib/notificationApi";
import { sendBookingNotificationEmail } from "@/lib/sendBookingNotificationEmail";

function originForLinks(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
}

/** TODO: dodatkowy kanał e-mail (np. Edge Function) — obecnie POST /api/notifications/email + Resend. */

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

  await sendBookingNotificationEmail({
    type: "quote_sent",
    bookingId: payload.bookingId,
    subject: "Wycena gotowa",
    body: emailBody,
  });
}

export async function notifyWorkshopOwnerQuoteResponded(payload: {
  ownerUserId: string | null;
  bookingId: string;
  workshopId: string;
  workshopName: string;
  serviceName: string;
  accepted: boolean;
  finalPrice?: number | null;
  /** Overrides default Polish workshop notification copy (UI language). */
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
  await sendBookingNotificationEmail({
    type: payload.accepted ? "quote_accepted" : "quote_rejected",
    bookingId: payload.bookingId,
    subject,
    body,
  });
}
