import { supabase } from "@/lib/supabaseClient";
import type { MockWorkshop, WorkshopAvailabilityConfig, WorkshopServiceOffer } from "@/lib/mockWorkshops";
import { normalizeServiceDifficultyLevel } from "@/lib/serviceDifficulty";
import { mockWorkshops } from "@/lib/mockWorkshops";
import { getApproxCityCenterCoords } from "@/lib/offersGeo";
import { normalizeServiceTextForMatch } from "@/lib/serviceCategoryClassifier";
import { formatSupabaseError } from "@/lib/workshopApi";

/** Statusy warsztatu widoczne publicznie (wyniki, oferty, strona warsztatu). */
export function isPubliclyListedWorkshopStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase().trim();
  return s === "active";
}

export type WorkshopVisibilityStatus = "hidden" | "pending" | "active" | "archived";

function normalizeVisibilityStatus(value: string | null | undefined): WorkshopVisibilityStatus {
  const normalized = (value ?? "").toLowerCase().trim();
  if (normalized === "active" || normalized === "pending" || normalized === "archived") return normalized;
  return "hidden";
}

export function isWorkshopPubliclyVisible(
  status: string | null | undefined,
  visibilityStatus: string | null | undefined,
): boolean {
  return isPubliclyListedWorkshopStatus(status) && normalizeVisibilityStatus(visibilityStatus) === "active";
}

/** Lista ofert: wszystkie aktywne warsztaty (mapa ma własny filtr pinów). */
export function isWorkshopVisibleOnOffersPage(
  status: string | null | undefined,
  showOnMap: boolean | null | undefined,
  visibilityStatus: string | null | undefined,
): boolean {
  void showOnMap;
  return isWorkshopPubliclyVisible(status, visibilityStatus);
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
    category?: string | null;
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
  slug?: string | null;
  city: string | null;
  address: string | null;
  description: string | null;
  status: string | null;
  is_demo?: boolean | null;
  visibility_status?: string | null;
  google_maps_url: string | null;
  services_summary: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | string | null;
  reviews_count?: number | null;
  google_place_id?: string | null;
  show_on_map?: boolean | null;
  workshop_services?: {
    id: string;
    service_name: string;
    service_key: string | null;
    category?: string | null;
    price_from: number | null;
    price_to: number | null;
    duration_minutes: number | null;
    required_roles: unknown;
    is_active: boolean;
  }[] | null;
};

type WorkshopVehiclePriceRow = {
  id: string;
  workshop_id: string;
  workshop_service_id: string | null;
  service_name: string;
  vehicle_type: string;
  brand: string | null;
  model: string | null;
  year_from: number | null;
  year_to: number | null;
  engine: string | null;
  fuel: string | null;
  price_from: number | null;
  price_to: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  difficulty_level?: string | null;
};

export type VehicleSearchCriteria = {
  service?: string;
  vehicleType?: string;
  brand?: string;
  model?: string;
  year?: number | null;
  engine?: string;
  fuel?: string;
};

function inferFuelType(engine: string | null | undefined, fuel: string | null | undefined) {
  const explicit = (fuel ?? "").trim();
  if (explicit) return explicit;
  const e = (engine ?? "").toLowerCase();
  if (e.includes("diesel")) return "Diesel";
  if (e.includes("benz")) return "Benzyna";
  if (e.includes("lpg")) return "LPG";
  return "Nie określono";
}

function buildVehicleSpecificOffers(rows: WorkshopVehiclePriceRow[]): WorkshopServiceOffer[] {
  return rows
    .filter((row) => row.is_active !== false && row.service_name.trim())
    .map((row) => ({
      id: row.workshop_service_id ?? row.id,
      service_name: row.service_name.trim(),
      service_key: null,
      difficulty_level: normalizeServiceDifficultyLevel(row.difficulty_level),
      vehicle_type: (row.vehicle_type ?? "").trim() || "Osobowy",
      brand: (row.brand ?? "").trim() || "—",
      model: (row.model ?? "").trim() || "—",
      year_from: row.year_from ?? 1955,
      year_to: row.year_to ?? new Date().getFullYear() + 1,
      engine: (row.engine ?? "").trim() || "—",
      fuelType: inferFuelType(row.engine, row.fuel),
      price: row.price_from ?? 0,
      price_from: row.price_from ?? null,
      price_to: row.price_to ?? null,
      duration_minutes: row.duration_minutes ?? 60,
      next_available: "—",
      required_roles: [],
      body_types: (row as { body_type?: string | null }).body_type
        ? String((row as { body_type?: string | null }).body_type).split(",").filter(Boolean)
        : null,
    }));
}

function mergeOffers(vehicleSpecific: WorkshopServiceOffer[], genericOffers: WorkshopServiceOffer[]): WorkshopServiceOffer[] {
  if (vehicleSpecific.length === 0) return genericOffers;
  const out: WorkshopServiceOffer[] = [...vehicleSpecific];
  for (const generic of genericOffers) {
    const exists = vehicleSpecific.some(
      (row) => normalizeServiceName(row.service_name) === normalizeServiceName(generic.service_name),
    );
    if (!exists) out.push(generic);
  }
  return out;
}

function normalizeServiceName(name: string) {
  return name.trim().toLowerCase().replace(/[-_]+/g, " ");
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

/** Porównanie nazw usług: ten sam pipeline co klasyfikator (PL, bez diakrytyków). */
function normalizeServiceForMatch(name: string) {
  return normalizeServiceTextForMatch(name).replace(/\s+/g, " ");
}

function serviceNameMatchesClientQuery(requestedRaw: string, serviceName: string): boolean {
  const requested = normalizeServiceForMatch(requestedRaw);
  const offered = normalizeServiceForMatch(serviceName);
  if (!requested) return true;
  return offered.includes(requested) || requested.includes(offered);
}

/** Ujednolicenie typu pojazdu z URL (car) i etykiet z cennika („Osobowy”, „Samochód osobowy”). */
function canonicalVehicleTypeSlug(raw: string): string {
  const t = normalizeText(raw);
  if (!t) return "";
  if (t === "car" || t.includes("osobow") || t === "samochod" || t === "osobowy") return "car";
  if (t === "motorcycle" || t.includes("motocykl")) return "motorcycle";
  if (t === "van" || t.includes("dostawcz")) return "van";
  return t;
}

function vehicleTypesCompatible(storedRaw: string, requestedRaw: string): boolean {
  if (!normalizeText(requestedRaw)) return true;
  const req = canonicalVehicleTypeSlug(requestedRaw);
  const st = canonicalVehicleTypeSlug(storedRaw);
  if (!st) return true;
  return req === st;
}

const FUEL_SYNONYM_GROUPS: string[][] = [
  ["diesel", "olej", "napedow", "napędow", "naft", "tdi", "hdi", "cdi", "dci", "jtd", "crdi", "edc", "bluetec"],
  ["benzyn", "pb95", "pb98", "pb ", "gasoline", "petrol"],
  ["lpg", "gaz", "autogaz"],
  ["hybryd", "hybrid"],
  ["elektr", "ev ", "electric"],
];

function fuelsAndEngineCompatible(
  clientFuelOrEngineRaw: string,
  serviceEngineRaw: string,
  serviceFuelTypeRaw: string,
): boolean {
  const clientSlug = normalizeServiceTextForMatch(clientFuelOrEngineRaw);
  if (!clientSlug.trim()) return true;

  const engineNorm = serviceEngineRaw === "—" || serviceEngineRaw === "-" ? "" : serviceEngineRaw;
  const fuelNorm =
    serviceFuelTypeRaw === "Nie określono" || serviceFuelTypeRaw === "—" ? "" : serviceFuelTypeRaw;
  const engineSlug = normalizeServiceTextForMatch(engineNorm);
  const fuelSlug = normalizeServiceTextForMatch(fuelNorm);
  const pool = normalizeServiceTextForMatch(`${serviceEngineRaw} ${serviceFuelTypeRaw}`);

  if (pool.includes(clientSlug) || clientSlug.includes(pool)) return true;

  const clientHay = normalizeText(clientFuelOrEngineRaw);
  const poolHay = normalizeText(`${engineNorm} ${fuelNorm}`);

  for (const group of FUEL_SYNONYM_GROUPS) {
    let c = false;
    let p = false;
    for (const frag of group) {
      if (clientHay.includes(frag)) c = true;
      if (poolHay.includes(frag)) p = true;
    }
    if (c && p) return true;
  }

  return engineSlug.includes(clientSlug) || fuelSlug.includes(clientSlug) || clientSlug.includes(fuelSlug);
}

export function matchWorkshopServicesForVehicle(
  services: WorkshopServiceOffer[],
  criteria: VehicleSearchCriteria,
): WorkshopServiceOffer[] {
  const serviceSearchRaw = (criteria.service ?? "").trim();
  const legacyRequested = normalizeServiceName(serviceSearchRaw);
  const vehicleType = normalizeText(criteria.vehicleType);
  const brand = normalizeText(criteria.brand);
  const model = normalizeText(criteria.model);
  const engine = normalizeText(criteria.engine ?? "");
  const fuel = normalizeText(criteria.fuel ?? "");
  const motorQueryRaw = [criteria.fuel, criteria.engine].filter(Boolean).join(" ").trim();
  const year = typeof criteria.year === "number" && Number.isFinite(criteria.year) ? criteria.year : null;

  const strictMatches = services.filter((service) => {
    if (
      serviceSearchRaw &&
      !serviceNameMatchesClientQuery(serviceSearchRaw, service.service_name) &&
      !(legacyRequested && normalizeServiceName(service.service_name).includes(legacyRequested))
    )
      return false;
    if (vehicleType && !vehicleTypesCompatible(service.vehicle_type, criteria.vehicleType ?? "")) return false;
    if (brand && normalizeText(service.brand) !== brand) return false;
    if (model && normalizeText(service.model) !== model) return false;
    if (
      normalizeText(motorQueryRaw) &&
      !fuelsAndEngineCompatible(motorQueryRaw, service.engine, service.fuelType ?? "")
    )
      return false;
    if (year != null && !(service.year_from <= year && service.year_to >= year)) return false;
    return true;
  });
  if (strictMatches.length > 0) return strictMatches;

  if (vehicleType) {
    const bodyTypeMatches = services.filter((s) => {
      const bt = (s as { body_types?: string[] | null }).body_types;
      return Array.isArray(bt) && bt.length > 0;
    });
    if (bodyTypeMatches.length > 0) return bodyTypeMatches;
  }

  // Bez pełnego dopasowania paliwa: pokaż tę samą usługę + auto (+ rocznik), żeby klient widział ofertę „do potwierdzenia”.
  if (normalizeText(motorQueryRaw) && brand && model) {
    const looseMotor = services.filter((service) => {
      if (
        serviceSearchRaw &&
        !serviceNameMatchesClientQuery(serviceSearchRaw, service.service_name) &&
        !(legacyRequested && normalizeServiceName(service.service_name).includes(legacyRequested))
      )
        return false;
      if (vehicleType && !vehicleTypesCompatible(service.vehicle_type, criteria.vehicleType ?? "")) return false;
      if (normalizeText(service.brand) !== brand) return false;
      if (normalizeText(service.model) !== model) return false;
      if (year != null && !(service.year_from <= year && service.year_to >= year)) return false;
      return true;
    });
    if (looseMotor.length > 0) return looseMotor;
  }

  const hasConcreteVehicleData = Boolean(
    brand || model || normalizeText(engine) || normalizeText(fuel) || year != null,
  );
  if (hasConcreteVehicleData) return [];

  if (legacyRequested) {
    return services.filter(
      (service) =>
        serviceNameMatchesClientQuery(serviceSearchRaw, service.service_name) ||
        normalizeServiceName(service.service_name).includes(legacyRequested),
    );
  }
  return services;
}

function buildGoogleSearchUrl(name: string, address: string | null, city: string | null) {
  const q = [name, address, city].filter((p) => p && String(p).trim()).join(", ").trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || name)}`;
}

function parseDbRating(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
}

export function buildMockWorkshopFromDbRow(w: WorkshopWithNestedServices): MockWorkshop {
  const fallback = getApproxCityCenterCoords(w.city);
  const latRaw = w.latitude;
  const lngRaw = w.longitude;
  const hasDbCoords =
    latRaw != null &&
    lngRaw != null &&
    Number.isFinite(Number(latRaw)) &&
    Number.isFinite(Number(lngRaw));
  const lat = hasDbCoords ? Number(latRaw) : fallback.lat;
  const lng = hasDbCoords ? Number(lngRaw) : fallback.lng;
  const nested = Array.isArray(w.workshop_services) ? w.workshop_services : [];
  const offers = buildServiceOffers(nested, w.services_summary);
  const storedMaps = (w.google_maps_url ?? "").trim();
  const mapsUrl = storedMaps || buildGoogleSearchUrl(w.name, w.address, w.city);
  const showOnMap = w.show_on_map === true;
  const placeId = (w.google_place_id ?? "").trim();
  const visibilityStatus = normalizeVisibilityStatus(w.visibility_status);

  return {
    id: w.id,
    supabaseId: w.id,
    googlePlaceId: placeId,
    googleMapsUrl: mapsUrl,
    workshopGoogleMapsUrl: storedMaps || null,
    slug: (w.slug ?? "").trim() || null,
    name: w.name,
    city: (w.city ?? "").trim() || "—",
    address: (w.address ?? "").trim() || "—",
    rating: parseDbRating(w.rating),
    reviewsCount: typeof w.reviews_count === "number" && Number.isFinite(w.reviews_count) ? w.reviews_count : 0,
    lat,
    lng,
    showOnMap,
    isDemo: w.is_demo === true,
    visibilityStatus,
    /** Na mapie /oferty: poprawne lat/lng (z bazy lub przybliżenie z miasta). showOnMap to osobna flaga admina. */
    hasMapPin: Boolean(Number.isFinite(lat) && Number.isFinite(lng)),
    hasPreciseMapCoords: hasDbCoords,
    usesLocalCalendar: false,
    photoUrls: [],
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
  slug,
  city,
  address,
  description,
  status,
  is_demo,
  visibility_status,
  google_maps_url,
  services_summary,
  latitude,
  longitude,
  rating,
  reviews_count,
  google_place_id,
  show_on_map,
  workshop_services ( id, service_name, service_key, category, price_from, price_to, duration_minutes, required_roles, is_active )
`;

/** Lista warsztatów z Supabase do strony ofert (aktywne). */
export async function fetchPublicWorkshopsAsMock(): Promise<MockWorkshop[]> {
  if (!supabase) {
    return mockWorkshops.filter((w) => (w.showOnMap ?? true) !== false);
  }
  const { data, error } = await supabase.from("workshops").select(PUBLIC_WORKSHOP_SELECT).order("name", { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data as WorkshopWithNestedServices[] | null) ?? [];
  const visibleRows = rows.filter((w) => isWorkshopPubliclyVisible(w.status, w.visibility_status));
  const workshopIds = visibleRows.map((w) => w.id);
  const { data: vehiclePricesRaw, error: vehiclePricesError } = workshopIds.length
    ? await supabase
        .from("workshop_service_vehicle_prices")
        .select(
          "id, workshop_id, workshop_service_id, service_name, vehicle_type, brand, model, year_from, year_to, engine, fuel, price_from, price_to, duration_minutes, is_active, difficulty_level",
        )
        .in("workshop_id", workshopIds)
    : { data: [], error: null };
  if (vehiclePricesError) throw new Error(formatSupabaseError(vehiclePricesError));
  const vehiclePrices = (vehiclePricesRaw as WorkshopVehiclePriceRow[] | null) ?? [];
  const pricesByWorkshop = new Map<string, WorkshopVehiclePriceRow[]>();
  for (const row of vehiclePrices) {
    const list = pricesByWorkshop.get(row.workshop_id) ?? [];
    list.push(row);
    pricesByWorkshop.set(row.workshop_id, list);
  }
  return visibleRows.map((w) => {
    const base = buildMockWorkshopFromDbRow(w);
    const specific = buildVehicleSpecificOffers(pricesByWorkshop.get(w.id) ?? []);
    return { ...base, services: mergeOffers(specific, base.services).map((s) => ({ ...s, workshopId: w.id })) };
  });
}

/** Pojedynczy warsztat (UUID) dla strony szczegółów — null gdy brak lub niewidoczny. */
export async function fetchPublicWorkshopByIdAsMock(id: string): Promise<MockWorkshop | null> {
  if (!supabase || !id.trim()) return null;
  const { data, error } = await supabase.from("workshops").select(PUBLIC_WORKSHOP_SELECT).eq("id", id.trim()).maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  const row = data as WorkshopWithNestedServices | null;
  if (!row || !isWorkshopPubliclyVisible(row.status, row.visibility_status)) return null;
  const base = buildMockWorkshopFromDbRow(row);
  const { data: vehiclePricesRaw, error: vehiclePricesError } = await supabase
    .from("workshop_service_vehicle_prices")
    .select(
      "id, workshop_id, workshop_service_id, service_name, vehicle_type, brand, model, year_from, year_to, engine, fuel, price_from, price_to, duration_minutes, is_active, difficulty_level",
    )
    .eq("workshop_id", id.trim());
  if (vehiclePricesError) throw new Error(formatSupabaseError(vehiclePricesError));
  const specific = buildVehicleSpecificOffers((vehiclePricesRaw as WorkshopVehiclePriceRow[] | null) ?? []);
  return { ...base, services: mergeOffers(specific, base.services).map((s) => ({ ...s, workshopId: row.id })) };
}

type RecommendedWorkshopPhotoRow = {
  public_url: string | null;
  sort_order: number;
  status: string;
};

type RecommendedWorkshopDbRow = {
  id: string;
  name: string | null;
  city: string | null;
  status: string | null;
  visibility_status: string | null;
  rating: number | string | null;
  reviews_count: number | null;
  workshop_photos: RecommendedWorkshopPhotoRow[] | null;
};

export type RecommendedWorkshopCard = {
  id: string;
  name: string;
  city: string | null;
  rating: number;
  reviewsCount: number;
  coverPhotoUrl: string | null;
};

function pickWorkshopCoverPhoto(photos: RecommendedWorkshopPhotoRow[] | null | undefined): string | null {
  if (!photos?.length) return null;
  const active = photos
    .filter((p) => p.status === "active" && (p.public_url ?? "").trim())
    .sort((a, b) => a.sort_order - b.sort_order);
  return active[0]?.public_url?.trim() ?? null;
}

/** Karty „Polecane warsztaty” na stronie głównej (aktywne + widoczne, z okładką ze zdjęć). */
export async function fetchRecommendedWorkshopsForHome(limit = 4): Promise<RecommendedWorkshopCard[]> {
  if (!supabase) return [];
  const fetchLimit = Math.max(limit * 4, limit);
  const { data, error } = await supabase
    .from("workshops")
    .select(
      "id, name, city, status, visibility_status, rating, reviews_count, workshop_photos ( public_url, sort_order, status )",
    )
    .eq("status", "active")
    .order("reviews_count", { ascending: false, nullsFirst: false })
    .limit(fetchLimit);
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data as RecommendedWorkshopDbRow[] | null) ?? [];
  return rows
    .filter((w) => isWorkshopPubliclyVisible(w.status, w.visibility_status))
    .slice(0, limit)
    .map((w) => ({
      id: w.id,
      name: (w.name ?? "").trim() || "Warsztat",
      city: (w.city ?? "").trim() || null,
      rating: parseDbRating(w.rating),
      reviewsCount: typeof w.reviews_count === "number" && Number.isFinite(w.reviews_count) ? w.reviews_count : 0,
      coverPhotoUrl: pickWorkshopCoverPhoto(w.workshop_photos),
    }));
}
