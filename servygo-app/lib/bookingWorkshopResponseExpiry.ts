import { supabase } from "@/lib/supabaseClient";
import { sendSystemMessage } from "@/lib/messagesApi";
import { formatSupabaseError } from "@/lib/workshopApi";

/** Wersja testowa: czas na pierwszą odpowiedź warsztatu po wyborze terminu przez kierowcę (pending_quote bez wyceny). */
export const BOOKING_WORKSHOP_RESPONSE_HOURS = 24;

export type ExpiredBookingTimeoutRow = {
  booking_id: string;
  client_user_id: string;
  workshop_id: string;
};

/**
 * Manual test (Supabase SQL + wywołanie z panelu warsztatu lub admina):
 * 1. Ustaw booking `pending_quote`, `quote_sent_at` null, `created_at` > 24h temu.
 * 2. Uruchom `runExpirePendingBookingsWorkshopTimeout()` (np. wejście do panelu).
 * 3. Status → `cancelled`, `cancelled_by` = system, powód timeout.
 * 4. Slot zwolniony (status poza aktywnymi blokującymi slot).
 */
export async function runExpirePendingBookingsWorkshopTimeout(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc("expire_pending_bookings_workshop_response_timeout", {
    p_hours: BOOKING_WORKSHOP_RESPONSE_HOURS,
  });
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data ?? []) as ExpiredBookingTimeoutRow[];
  let notified = 0;
  for (const row of rows) {
    if (!row.client_user_id || !row.booking_id) continue;
    try {
      await sendSystemMessage({
        recipientId: row.client_user_id,
        recipientRole: "client",
        subject: "Rezerwacja anulowana",
        body: "Rezerwacja została anulowana, ponieważ warsztat nie odpowiedział w wymaganym czasie.",
        relatedBookingId: row.booking_id,
        relatedWorkshopId: row.workshop_id,
      });
      notified += 1;
    } catch {
      // wiadomość pomocnicza — nie blokuj wygaśnięcia
    }
  }
  return rows.length;
}
