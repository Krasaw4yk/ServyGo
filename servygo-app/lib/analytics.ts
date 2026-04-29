import { supabase } from "@/lib/supabaseClient";

export type AnalyticsEventName =
  | "page_view"
  | "search_submit"
  | "workshop_click"
  | "booking_start"
  | "booking_confirm";

type AnalyticsMetadata = Record<string, unknown>;

export async function trackEvent(
  eventName: AnalyticsEventName,
  metadata?: AnalyticsMetadata,
): Promise<void> {
  if (!supabase) return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("analytics_events").insert({
      event_name: eventName,
      path: typeof window !== "undefined" ? window.location.pathname : null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      user_id: user?.id ?? null,
      metadata: metadata ?? {},
    });
  } catch {
    // analytics must never break UX
  }
}
