import { supabase } from "@/lib/supabaseClient";
import type { MockWorkshop, WorkshopAvailabilityConfig, WorkshopServiceOffer } from "@/lib/mockWorkshops";
import { formatSupabaseError } from "@/lib/workshopApi";

/** Statusy warsztatu widoczne publicznie (wyniki, oferty, strona warsztatu). */
export function isPubliclyListedWorkshopStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase().trim();
  return s === "active";
}

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "bielsko-biała": { lat: 49.82, lng: 19.04 },
  "kraków": { lat: 50.06, lng: 19.94 },
  "warszawa": { lat: 52.23, lng: 21.01 },
  "wrocław": { lat: 51.11, lng: 17.04 },
  "gdańsk": { lat: 54.35, lng: 18.65 },
  "poznań": { lat: 52.41, lng: 16.93 },
  "katowice": { lat: 50.26, lng: 19.02 },
  "łódź": { lat: 51.76, lng: 19.46 },
  "szczecin": { lat: 53.43, lng: 14.55 },
  "bydgoszcz": { lat: 53.12, lng: 18.01 },
  "lublin": { lat: 51.25, lng: 22.57 },
  "rzeszów": { lat: 50.04, lng: 21.99 },
  "częstochowa": { lat: 50.81, lng: 19.12 },
};

function approximateCoordsForCity(city: string | null): { lat: number; lng: number } {
  const key = (city ?? "").trim().toLowerCase();
  if (key && CITY_COORDS[key]) return CITY_COORDS[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return { lat: 50.2 + (h % 900) / 2500, lng: 18.5 + (h % 1100) / 2200 };
}

const DEFAULT_BASE_SLOTS = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

function defaultAvailability(): WorkshopAvailabilityConfig {
  return {
    openingHours: { start: "08:00", end: "17:00" },
    workingDays: [1, 2, 3, 4, 5],
    availableTimeSlots: {
      "1": DEFAULT_BASE_SLOTS,
      "2": DEFAULT_BASE_SLOTS,
      "3": DEFAULT_BASE_SLOTS,
      "4": DEFAULT_BASE_SLOTS,
      "5": DEFAULT_BASE_SLOTS,
    },
    blockedDates: [],
    customAvailability: {},
  };
}

function baseServiceOffer(name: string): WorkshopServiceOffer {
  return {
    id: undefined,
    service_name: name,
    service_key: null,
    vehicle_type: "Osobowy",
    brand: "—",
    model: "—",
    year_from: 1990,
    year_to: 2030,
    engine: "—",
    fuelType: "—",
    price: 0,
    duration_minutes: 60,
    next_available: "—",
    required_roles: [],
  };
}

function serviceNamesFromLeadSummary(summary: string | null | undefined): string[] {
  const raw = (summary ?? "").trim();
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

function buildServiceOffers(
  serviceRows: {
    id?: string;
    service_name: string;
    service_key?: string | null;
    price_from?: number | null;
    price_to?: number | null;
    duration_minutes?: number | null;
    required_roles?: unknown;
    is_active?: boolean;
  }[],
  servicesSummary: string | null | undefined,
): WorkshopServiceOffer[] {
  const activeRows = serviceRows.filter((r) => r.is_active !== false);
  const fromRows = activeRows.map((r) => r.service_name.trim()).filter(Boolean);
  const unique = Array.from(new Set(fromRows.length ? fromRows : serviceNamesFromLeadSummary(servicesSummary)));
  const names = unique.length > 0 ? unique : ["Zapytaj o usługę"];
  return names.map((n) => {
    const row = activeRows.find((x) => x.service_name.trim() === n);
    const base = baseServiceOffer(n);
    if (!row) return base;
    return {
      ...base,
      id: row.id,
      service_key: row.service_key ?? null,
      price: row.price_from ?? 0,
      price_from: row.price_from ?? null,
      price_to: row.price_to ?? null,
      duration_minutes: row.duration_minutes ?? 60,
      required_roles: Array.isArray(row.required_roles)
        ? row.required_roles.map((x) => String(x))
        : [],
    };
  });
}

type WorkshopWithNestedServices = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  description: string | null;
  status: string | null;
  google_maps_url: string | null;
  services_summary: string | null;
  workshop_services?: {
    id: string;
    service_name: string;
    service_key: string | null;
    price_from: number | null;
    price_to: number | null;
    duration_minutes: number | null;
    required_roles: unknown;
    is_active: boolean;
  }[] | null;
};

function buildGoogleSearchUrl(name: string, address: string | null, city: string | null) {
  const q = [name, address, city].filter((p) => p && String(p).trim()).join(", ").trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || name)}`;
}

export function buildMockWorkshopFromDbRow(w: WorkshopWithNestedServices): MockWorkshop {
  const coords = approximateCoordsForCity(w.city);
  const nested = Array.isArray(w.workshop_services) ? w.workshop_services : [];
  const offers = buildServiceOffers(nested, w.services_summary);
  const storedMaps = (w.google_maps_url ?? "").trim();
  const mapsUrl = storedMaps || buildGoogleSearchUrl(w.name, w.address, w.city);

  return {
    id: w.id,
    supabaseId: w.id,
    googlePlaceId: "",
    googleMapsUrl: mapsUrl,
    workshopGoogleMapsUrl: storedMaps || null,
    name: w.name,
    city: (w.city ?? "").trim() || "—",
    address: (w.address ?? "").trim() || "—",
    rating: 0,
    reviewsCount: 0,
    lat: coords.lat,
    lng: coords.lng,
    description: (w.description ?? "").trim() || "—",
    imagePlaceholder: "",
    availability: defaultAvailability(),
    workingDays: "Pn–Pt",
    workingHours: "08:00–17:00",
    closedDates: [],
    bufferMinutes: 15,
    arrivalBeforeMinutes: 10,
    bookedSlots: [],
    services: offers.map((s) => ({ ...s, workshopId: w.id })),
  };
}

const PUBLIC_WORKSHOP_SELECT = `
  id,
  name,
  city,
  address,
  description,
  status,
  google_maps_url,
  services_summary,
  workshop_services ( id, service_name, service_key, price_from, price_to, duration_minutes, required_roles, is_active )
`;

/** Lista warsztatów z Supabase do strony ofert (tylko statusy publiczne — dodatkowy filtr po stronie klienta). */
export async function fetchPublicWorkshopsAsMock(): Promise<MockWorkshop[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("workshops").select(PUBLIC_WORKSHOP_SELECT).order("name", { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data as WorkshopWithNestedServices[] | null) ?? [];
  return rows.filter((w) => isPubliclyListedWorkshopStatus(w.status)).map((w) => buildMockWorkshopFromDbRow(w));
}

/** Pojedynczy warsztat (UUID) dla strony szczegółów — null gdy brak lub niewidoczny. */
export async function fetchPublicWorkshopByIdAsMock(id: string): Promise<MockWorkshop | null> {
  if (!supabase || !id.trim()) return null;
  const { data, error } = await supabase.from("workshops").select(PUBLIC_WORKSHOP_SELECT).eq("id", id.trim()).maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  const row = data as WorkshopWithNestedServices | null;
  if (!row || !isPubliclyListedWorkshopStatus(row.status)) return null;
  return buildMockWorkshopFromDbRow(row);
}
