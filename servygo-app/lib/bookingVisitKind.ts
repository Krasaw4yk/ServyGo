/** Rezerwacja godzinowa — sloty zależą od łącznego czasu usług. */
export const BOOKING_TYPE_EXACT_TIME = "exact_time" as const;

/** Zostaw auto — godzina = dostarczenie; pełny zakres slotów w godzinach pracy. */
export const BOOKING_TYPE_DROPOFF = "dropoff" as const;

export type BookingTypeValue = typeof BOOKING_TYPE_EXACT_TIME | typeof BOOKING_TYPE_DROPOFF;

export type BookingSlotMode = BookingTypeValue;

/** Musi być zgodne z logiką `create_booking_safe` (kolumna end_time / kolizje). */
export const DROPOFF_CALENDAR_SLOT_MINUTES = 30;

export function isDropoffBookingType(value: string | null | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === BOOKING_TYPE_DROPOFF;
}
