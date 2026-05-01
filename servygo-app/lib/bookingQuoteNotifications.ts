"use client";

import { sendSystemMessage } from "@/lib/messagesApi";
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
): string {
  const qs = (quoteStatus ?? "").trim().toLowerCase();
  const bs = (bookingStatus ?? "").trim().toLowerCase();
  if (qs === "sent" || qs === "pending_client_decision") return "Oczekuje na decyzję klienta";
  if (qs === "accepted") return "Zaakceptowana przez klienta";
  if (qs === "rejected") return "Odrzucona przez klienta";
  if (qs === "cancelled") return "Anulowana (wycena)";
  if (bs === "quote_sent") return "Oczekuje na decyzję klienta";
  if (bs === "confirmed" && qs === "") return "Zaakceptowana — potwierdzona";
  return "—";
}

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

  await sendSystemMessage({
    recipientId: payload.clientUserId,
    recipientRole: "client",
    subject: "Wycena gotowa",
    body: [
      `Warsztat ${payload.workshopName} wysłał wycenę dla usługi ${payload.serviceName}.`,
      `Kwota: ${priceFormatted} zł.${noteLine}`,
      "",
      `Wejdź w Moje rezerwacje (${link}), aby zaakceptować lub odrzucić.`,
      `Termin rezerwacji: ${payload.bookingDateLine}`,
    ].join("\n"),
    relatedBookingId: payload.bookingId,
    relatedWorkshopId: payload.workshopId,
  });

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
}): Promise<void> {
  if (!payload.ownerUserId) return;
  const priceBit =
    payload.accepted && payload.finalPrice != null && Number.isFinite(payload.finalPrice)
      ? ` Kwota: ${payload.finalPrice.toFixed(2)} zł.`
      : "";
  await sendSystemMessage({
    recipientId: payload.ownerUserId,
    recipientRole: "workshop",
    subject: payload.accepted ? "Klient zaakceptował wycenę" : "Klient odrzucił wycenę",
    body: payload.accepted
      ? `Klient zaakceptował wycenę dla usługi „${payload.serviceName}”.${priceBit} Warsztat: ${payload.workshopName}.`
      : `Klient odrzucił wycenę dla usługi „${payload.serviceName}”. Warsztat: ${payload.workshopName}.`,
    relatedBookingId: payload.bookingId,
    relatedWorkshopId: payload.workshopId,
  });

  await sendBookingNotificationEmail({
    type: payload.accepted ? "quote_accepted" : "quote_rejected",
    bookingId: payload.bookingId,
    subject: payload.accepted ? "Klient zaakceptował wycenę" : "Klient odrzucił wycenę",
    body: payload.accepted
      ? `Klient zaakceptował wycenę dla usługi „${payload.serviceName}”.${priceBit} Warsztat: ${payload.workshopName}.`
      : `Klient odrzucił wycenę dla usługi „${payload.serviceName}”. Warsztat: ${payload.workshopName}.`,
  });
}
