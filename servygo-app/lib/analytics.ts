import { supabase } from "@/lib/supabaseClient";

export type AnalyticsEventName =
  | "page_view"
  | "search_submit"
  | "workshop_click"
  | "booking_start"
  | "booking_confirm";

type AnalyticsMetadata = Record<string, unknown>;

const VISITOR_ID_KEY = "servygo_visitor_id";
const SESSION_ID_KEY = "servygo_session_id";

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function getVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const next = randomId("v");
    window.localStorage.setItem(VISITOR_ID_KEY, next);
    return next;
  } catch {
    return null;
  }
}

function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const next = randomId("s");
    window.sessionStorage.setItem(SESSION_ID_KEY, next);
    return next;
  } catch {
    return null;
  }
}

function detectDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = (navigator.userAgent || "").toLowerCase();
  const width = window.innerWidth;
  if (ua.includes("ipad") || (ua.includes("android") && !ua.includes("mobile")) || (width >= 768 && width <= 1024)) {
    return "tablet";
  }
  if (ua.includes("mobi") || width < 768) return "mobile";
  return "desktop";
}

function detectBrowser(uaRaw: string): string {
  const ua = uaRaw.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("chrome/") && !ua.includes("edg/")) return "Chrome";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if (ua.includes("firefox/")) return "Firefox";
  return "Inne";
}

function detectOs(uaRaw: string): string {
  const ua = uaRaw.toLowerCase();
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "iOS";
  if (ua.includes("mac os")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  return "Inne";
}

function detectSource(referrerRaw: string): string {
  const ref = referrerRaw.toLowerCase();
  if (!ref) return "Bezpośrednio";
  if (ref.includes("google.")) return "Google";
  if (ref.includes("facebook.") || ref.includes("fb.")) return "Facebook";
  if (ref.includes("instagram.")) return "Instagram";
  if (ref.includes("tiktok.")) return "TikTok";
  if (ref.includes("t.me") || ref.includes("telegram.")) return "Telegram";
  return "Inne";
}

export async function trackEvent(
  eventName: AnalyticsEventName,
  metadata?: AnalyticsMetadata,
): Promise<void> {
  if (!supabase) return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const referrer = typeof document !== "undefined" ? document.referrer || "" : "";
    await supabase.from("analytics_events").insert({
      event_name: eventName,
      path: typeof window !== "undefined" ? window.location.pathname : null,
      referrer: referrer || null,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      device_type: detectDeviceType(),
      browser: detectBrowser(userAgent),
      os: detectOs(userAgent),
      user_agent: userAgent || null,
      source: detectSource(referrer),
      user_id: user?.id ?? null,
      metadata: metadata ?? {},
    });
  } catch {
    // analytics must never break UX
  }
}
