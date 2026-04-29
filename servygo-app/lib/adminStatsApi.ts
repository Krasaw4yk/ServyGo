import { supabase } from "@/lib/supabaseClient";
import { formatSupabaseError } from "@/lib/workshopApi";
import { isAdmin } from "@/lib/adminApi";

type StatusCount = { label: string; count: number };
type NameCount = { label: string; count: number };

export type AdminDashboardStats = {
  usersCount: number;
  workshopsCount: number;
  pendingLeadsCount: number;
  bookingsTodayCount: number;
  bookingsMonthCount: number;
  avgWorkshopRating: number;
  bookingStartClicks: number;
  pageViewsCount: number;
  visits7d: number[];
  bookings7d: number[];
  recentBookings: Array<{
    date: string;
    client: string;
    workshop: string;
    service: string;
    car: string;
    term: string;
    status: string;
  }>;
  bookingsByStatus: StatusCount[];
  popularServices: NameCount[];
  popularCities: NameCount[];
  funnel: Array<{ label: string; value: number }>;
  hasAnalytics: boolean;
};

const EMPTY_STATS: AdminDashboardStats = {
  usersCount: 0,
  workshopsCount: 0,
  pendingLeadsCount: 0,
  bookingsTodayCount: 0,
  bookingsMonthCount: 0,
  avgWorkshopRating: 0,
  bookingStartClicks: 0,
  pageViewsCount: 0,
  visits7d: [0, 0, 0, 0, 0, 0, 0],
  bookings7d: [0, 0, 0, 0, 0, 0, 0],
  recentBookings: [],
  bookingsByStatus: [],
  popularServices: [],
  popularCities: [],
  funnel: [
    { label: "Wejścia na stronę", value: 0 },
    { label: "Wyszukiwania", value: 0 },
    { label: "Kliknięcia warsztatów", value: 0 },
    { label: "Rezerwacje", value: 0 },
  ],
  hasAnalytics: false,
};

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateLike(value: string | null | undefined): Date | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date;
  const fallback = new Date(`${raw}T00:00:00`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function toSafeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? "Unknown error");
}

function isMissingRelationError(errorMessage: string): boolean {
  const x = errorMessage.toLowerCase();
  return x.includes("does not exist") || x.includes("relation") || x.includes("42p01");
}

export async function getAdminDashboardStats(
  userId: string,
  email?: string | null,
): Promise<AdminDashboardStats> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu do statystyk administratora.");

  const now = new Date();
  const todayKey = toDateKey(now);
  const monthPrefix = todayKey.slice(0, 7);
  const last7Keys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    return toDateKey(d);
  });

  const usersReq = supabase.from("profiles").select("id", { count: "exact", head: true });
  const workshopsReq = supabase.from("workshops").select("id", { count: "exact", head: true });
  const leadsReq = supabase.from("workshop_leads").select("id", { count: "exact", head: true }).in("status", ["pending", "new"]);
  const bookingsReq = supabase
    .from("bookings")
    .select("id, workshop_name, service_name, date, time, booking_date, start_time, status, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  const ratingReq = supabase.from("workshops").select("rating");

  const [usersRes, workshopsRes, leadsRes, bookingsRes, ratingRes] = await Promise.all([
    usersReq,
    workshopsReq,
    leadsReq,
    bookingsReq,
    ratingReq,
  ]);

  if (bookingsRes.error) throw new Error(formatSupabaseError(bookingsRes.error));

  const bookingRows =
    ((bookingsRes.data as Array<{
      id: string;
      workshop_name: string | null;
      service_name: string | null;
      date: string | null;
      time: string | null;
      booking_date: string | null;
      start_time: string | null;
      status: string | null;
      created_at: string | null;
    }> | null) ?? []);

  const bookingsTodayCount = bookingRows.filter((row) => ((row.booking_date ?? row.date) ?? "").startsWith(todayKey)).length;
  const bookingsMonthCount = bookingRows.filter((row) => ((row.booking_date ?? row.date) ?? "").startsWith(monthPrefix)).length;

  const bookingsByStatusMap = new Map<string, number>();
  const popularServicesMap = new Map<string, number>();
  const bookings7dMap = new Map<string, number>(last7Keys.map((k) => [k, 0]));

  for (const row of bookingRows) {
    const statusLabel = (row.status ?? "unknown").trim() || "unknown";
    bookingsByStatusMap.set(statusLabel, (bookingsByStatusMap.get(statusLabel) ?? 0) + 1);
    const service = (row.service_name ?? "").trim();
    if (service) popularServicesMap.set(service, (popularServicesMap.get(service) ?? 0) + 1);

    const dateKey = (row.booking_date ?? row.date ?? "").slice(0, 10);
    if (bookings7dMap.has(dateKey)) {
      bookings7dMap.set(dateKey, (bookings7dMap.get(dateKey) ?? 0) + 1);
    }
  }

  const recentBookings = bookingRows.slice(0, 10).map((row) => ({
    date: (row.created_at ?? "").slice(0, 10) || "—",
    client: "—",
    workshop: row.workshop_name ?? "—",
    service: row.service_name ?? "—",
    car: "—",
    term: `${row.booking_date ?? row.date ?? "—"} ${row.start_time?.slice(0, 5) ?? row.time ?? ""}`.trim(),
    status: row.status ?? "—",
  }));

  let avgWorkshopRating = 0;
  if (!ratingRes.error) {
    const ratings = ((ratingRes.data as Array<{ rating?: number | null }> | null) ?? [])
      .map((x) => x.rating)
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (ratings.length > 0) {
      avgWorkshopRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    }
  }

  const workshopsCitiesRes = await supabase.from("workshops").select("city").not("city", "is", null);
  const popularCitiesMap = new Map<string, number>();
  if (!workshopsCitiesRes.error) {
    const cityRows = (workshopsCitiesRes.data as Array<{ city: string | null }> | null) ?? [];
    for (const row of cityRows) {
      const city = (row.city ?? "").trim();
      if (!city) continue;
      popularCitiesMap.set(city, (popularCitiesMap.get(city) ?? 0) + 1);
    }
  }

  let hasAnalytics = false;
  let pageViewsCount = 0;
  let bookingStartClicks = 0;
  let funnelSearchSubmit = 0;
  let funnelWorkshopClick = 0;
  let funnelBookingConfirm = 0;
  const visits7dMap = new Map<string, number>(last7Keys.map((k) => [k, 0]));

  const analyticsRes = await supabase
    .from("analytics_events")
    .select("event_name, created_at")
    .in("event_name", ["page_view", "search_submit", "workshop_click", "booking_start", "booking_confirm"])
    .gte("created_at", new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString());

  if (!analyticsRes.error) {
    hasAnalytics = true;
    const events = (analyticsRes.data as Array<{ event_name: string; created_at: string }> | null) ?? [];
    for (const event of events) {
      const name = event.event_name;
      if (name === "page_view") pageViewsCount += 1;
      if (name === "search_submit") funnelSearchSubmit += 1;
      if (name === "workshop_click") funnelWorkshopClick += 1;
      if (name === "booking_start") bookingStartClicks += 1;
      if (name === "booking_confirm") funnelBookingConfirm += 1;

      const parsed = parseDateLike(event.created_at);
      if (!parsed) continue;
      const key = toDateKey(parsed);
      if (name === "page_view" && visits7dMap.has(key)) {
        visits7dMap.set(key, (visits7dMap.get(key) ?? 0) + 1);
      }
    }
  } else if (!isMissingRelationError(toSafeErrorMessage(analyticsRes.error))) {
    throw new Error(formatSupabaseError(analyticsRes.error));
  }

  const bookingsByStatus = Array.from(bookingsByStatusMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const popularServices = Array.from(popularServicesMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const popularCities = Array.from(popularCitiesMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    ...EMPTY_STATS,
    usersCount: usersRes.error ? 0 : (usersRes.count ?? 0),
    workshopsCount: workshopsRes.error ? 0 : (workshopsRes.count ?? 0),
    pendingLeadsCount: leadsRes.error ? 0 : (leadsRes.count ?? 0),
    bookingsTodayCount,
    bookingsMonthCount,
    avgWorkshopRating,
    bookingStartClicks,
    pageViewsCount,
    visits7d: last7Keys.map((k) => visits7dMap.get(k) ?? 0),
    bookings7d: last7Keys.map((k) => bookings7dMap.get(k) ?? 0),
    recentBookings,
    bookingsByStatus,
    popularServices,
    popularCities,
    funnel: [
      { label: "Wejścia na stronę", value: pageViewsCount },
      { label: "Wyszukiwania", value: funnelSearchSubmit },
      { label: "Kliknięcia warsztatów", value: funnelWorkshopClick },
      { label: "Rezerwacje", value: funnelBookingConfirm },
    ],
    hasAnalytics,
  };
}
