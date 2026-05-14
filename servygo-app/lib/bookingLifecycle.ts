/**
 * Statusy biznesowe naprawy (MVP — rozszerzenie; współistnieją z legacy quote-flow w DB).
 * Użyj w panelu warsztatu / mapowaniu etykiet.
 */
export const BOOKING_REPAIR_STATUSES = [
  "pending",
  "car_delivered",
  "in_progress",
  "waiting_customer_approval",
  "ready_for_pickup",
  "completed",
  "cancelled",
] as const;

export type BookingRepairStatus = (typeof BOOKING_REPAIR_STATUSES)[number];

/** Statusy zapisane w `bookings.status` (legacy quote + naprawa). */
export type BookingDbStatus =
  | BookingRepairStatus
  | "pending_quote"
  | "quote_sent"
  | "awaiting_new_quote"
  | "awaiting_quote"
  | "new"
  | "quote_accepted"
  | "confirmed"
  | "quote_rejected"
  | "awaiting_reschedule"
  | "rejected"
  | "done"
  | "cancelled_by_client"
  | "cancelled_by_workshop"
  | "cancelled_by_system"
  | "service_not_completed"
  | "no_show";

const TERMINAL = new Set<string>([
  "completed",
  "done",
  "cancelled",
  "cancelled_by_client",
  "cancelled_by_workshop",
  "cancelled_by_system",
  "rejected",
  "no_show",
  "service_not_completed",
]);

export function isTerminalBookingStatus(status: string | null | undefined): boolean {
  return TERMINAL.has(String(status ?? "").trim().toLowerCase());
}

export function normalizeBookingStatusKey(status: string | null | undefined): string {
  return String(status ?? "").trim().toLowerCase();
}
