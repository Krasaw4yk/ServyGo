import { supabase } from "@/lib/supabaseClient";
import { classifyServiceCategory } from "@/lib/serviceCategoryClassifier";
import { formatSupabaseError, workshopLeadStatusLabelMap } from "@/lib/workshopApi";

export type AdminRole = "owner" | "admin";

export type AdminUserRow = {
  id: string;
  user_id: string;
  email: string;
  role: AdminRole;
  created_at: string;
};

export type AdminWorkshopStatus = "pending" | "approved" | "rejected" | "suspended" | "archived";

export type WorkshopLeadRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  workshop_name: string;
  nip: string | null;
  city: string | null;
  postal_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  description: string | null;
  message: string | null;
  services?: string | null;
  google_maps_url?: string | null;
  status: string | null;
};

export type AdminWorkshopListRow = {
  id: string;
  owner_id?: string | null;
  owner_user_id?: string | null;
  name: string;
  slug?: string | null;
  nip: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  description: string | null;
  status: string | null;
  google_maps_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | string | null;
  reviews_count?: number | null;
  google_place_id?: string | null;
  show_on_map?: boolean | null;
  services_summary?: string | null;
  opening_hours?: string | null;
  created_at: string | null;
  updated_at: string | null;
  service_count?: number;
};

/** Status warsztatu w tabeli `workshops` (panel admina). */
export type AdminWorkshopEntityStatus = "active" | "suspended" | "hidden";

export type AdminWorkshopServiceRow = {
  id: string;
  service_name: string;
};

export type AdminWorkshopBookingRow = {
  id: string;
  user_id: string;
  workshop_id: string;
  workshop_name: string;
  service_name: string;
  price: number;
  duration_minutes: number;
  date: string;
  time: string;
  status: string;
  created_at: string;
  settlement_status?: string | null;
  lead_fee_amount?: number | null;
  test_mode?: boolean | null;
};

export type WorkshopMonthlyLeadMetricsRow = {
  workshop_id: string;
  workshop_name: string | null;
  month: string;
  total_bookings: number;
  confirmed_bookings: number;
  completed_bookings: number;
  no_show_bookings: number;
  cancelled_bookings: number;
  billable_leads: number;
  waived_test_leads: number;
  disputed_leads: number;
  not_billable_leads: number;
  estimated_amount_pln: number;
  test_value_pln: number;
};

export type AdminBookingListRow = {
  id: string;
  workshop_id: string;
  workshop_name: string;
  service_name: string;
  status: string;
  created_at: string;
  booking_date: string | null;
  time: string | null;
  settlement_status: string | null;
  lead_fee_amount: number | null;
  test_mode: boolean | null;
};

export type AdminWorkshopDetail = AdminWorkshopListRow & {
  services: AdminWorkshopServiceRow[];
  bookings: AdminWorkshopBookingRow[];
};

export type AdminWorkshopUpdatePayload = {
  name: string;
  slug?: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  google_maps_url: string | null;
  opening_hours: string | null;
  status: AdminWorkshopEntityStatus;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviews_count?: number | null;
  google_place_id?: string | null;
  show_on_map?: boolean;
};

export type AdminSidebarNotificationCounts = {
  pendingLeads: number;
  newBookings: number;
  newUsers24h: number;
  newReviews: number;
  servicesChanges: number;
};

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function normalizeWorkshopStatus(status: string | null | undefined): AdminWorkshopStatus {
  const normalized = (status ?? "").toLowerCase().trim();
  if (normalized === "archived") {
    return "archived";
  }
  if (normalized === "approved" || normalized === "aktywny" || normalized === "umowa_podpisana" || normalized === "active") {
    return "approved";
  }
  if (normalized === "rejected" || normalized === "odmowil") {
    return "rejected";
  }
  if (normalized === "suspended" || normalized === "wylaczony") {
    return "suspended";
  }
  return "pending";
}

export function formatWorkshopLeadStatusLabel(status: string | null | undefined): string {
  const raw = (status ?? "").trim();
  if (raw && workshopLeadStatusLabelMap[raw]) {
    return workshopLeadStatusLabelMap[raw];
  }
  const norm = normalizeWorkshopStatus(status);
  const labels: Record<AdminWorkshopStatus, string> = {
    pending: "Oczekuje",
    approved: "Zaakceptowane",
    rejected: "Odrzucone",
    suspended: "Zawieszone",
    archived: "Zarchiwizowane",
  };
  return labels[norm] ?? (raw || "Oczekuje");
}

export async function getAdminRecord(userId: string, email?: string | null): Promise<AdminUserRow | null> {
  if (!supabase) throw new Error("Supabase client not available.");
  const normalizedEmail = normalizeEmail(email);
  let query = supabase.from("admin_users").select("*").eq("user_id", userId);
  if (normalizedEmail) {
    query = query.or(`email.eq.${normalizedEmail}`);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  return (data as AdminUserRow | null) ?? null;
}

export async function isAdmin(userId: string, email?: string | null): Promise<boolean> {
  const record = await getAdminRecord(userId, email);
  return Boolean(record);
}

export async function bootstrapFirstAdmin(): Promise<AdminUserRow | null> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase.rpc("bootstrap_first_admin");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as AdminUserRow | null) ?? null;
}

export async function addAdmin(
  userId: string,
  email: string,
): Promise<AdminUserRow | null> {
  if (!supabase) throw new Error("Supabase client not available.");
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase.rpc("add_admin_if_empty", {
    target_user_id: userId,
    target_email: normalizedEmail,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as AdminUserRow | null) ?? null;
}

export async function listWorkshopLeadsForAdmin(
  userId: string,
  email?: string | null,
): Promise<WorkshopLeadRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu do zgłoszeń warsztatów.");
  const { data, error } = await supabase
    .from("workshop_leads")
    .select(
      "id, created_at, updated_at, workshop_name, nip, city, postal_code, address, phone, email, contact_person, description, message, services, google_maps_url, status",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  return (data as WorkshopLeadRow[] | null) ?? [];
}

export function formatAdminWorkshopEntityStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase().trim();
  if (s === "active") return "Aktywny";
  if (s === "suspended" || s === "wylaczony") return "Zawieszony";
  if (s === "hidden") return "Ukryty";
  if (s === "pending") return "Oczekuje";
  return status?.trim() || "—";
}

export async function listWorkshopsForAdmin(
  userId: string,
  email?: string | null,
): Promise<AdminWorkshopListRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu do listy warsztatów.");
  const { data, error } = await supabase
    .from("workshops")
    .select(
      "id, owner_id, owner_user_id, name, slug, nip, phone, email, city, address, description, status, google_maps_url, latitude, longitude, rating, reviews_count, google_place_id, show_on_map, services_summary, opening_hours, created_at, updated_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data as AdminWorkshopListRow[] | null) ?? [];
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.id);
  const { data: svcRows, error: svcError } = await supabase.from("workshop_services").select("workshop_id").in("workshop_id", ids);
  if (svcError) throw new Error(formatSupabaseError(svcError));
  const counts = new Map<string, number>();
  for (const row of (svcRows as { workshop_id: string }[] | null) ?? []) {
    counts.set(row.workshop_id, (counts.get(row.workshop_id) ?? 0) + 1);
  }
  return rows.map((r) => ({ ...r, service_count: counts.get(r.id) ?? 0 }));
}

export async function getWorkshopDetailForAdmin(
  userId: string,
  email: string | null | undefined,
  workshopId: string,
): Promise<AdminWorkshopDetail> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu do szczegółów warsztatu.");
  const { data: workshop, error: wError } = await supabase
    .from("workshops")
    .select(
      "id, owner_id, owner_user_id, name, slug, nip, phone, email, city, address, description, status, google_maps_url, latitude, longitude, rating, reviews_count, google_place_id, show_on_map, services_summary, opening_hours, created_at, updated_at",
    )
    .eq("id", workshopId)
    .single();
  if (wError) throw new Error(formatSupabaseError(wError));
  const base = workshop as AdminWorkshopListRow;
  const { data: services, error: sError } = await supabase
    .from("workshop_services")
    .select("id, service_name")
    .eq("workshop_id", workshopId)
    .order("created_at", { ascending: true });
  if (sError) throw new Error(formatSupabaseError(sError));
  const { data: bookingsRaw, error: bError } = await supabase
    .from("bookings")
    .select(
      "id, user_id, workshop_id, workshop_name, service_name, price, duration_minutes, date, time, status, created_at, booking_lead_settlements ( settlement_status, lead_fee_amount, test_mode )",
    )
    .eq("workshop_id", workshopId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (bError) throw new Error(formatSupabaseError(bError));
  type BRow = Omit<AdminWorkshopBookingRow, "settlement_status" | "lead_fee_amount" | "test_mode"> & {
    booking_lead_settlements?: { settlement_status: string; lead_fee_amount: number; test_mode: boolean } | null;
  };
  const bookings = ((bookingsRaw ?? []) as unknown as BRow[]).map((b) => {
    const emb = b.booking_lead_settlements;
    const s = emb && !Array.isArray(emb) ? emb : Array.isArray(emb) ? emb[0] : null;
    const { booking_lead_settlements: _x, ...rest } = b;
    return {
      ...rest,
      settlement_status: s?.settlement_status ?? null,
      lead_fee_amount: s?.lead_fee_amount ?? null,
      test_mode: s?.test_mode ?? null,
    } satisfies AdminWorkshopBookingRow;
  });
  return {
    ...base,
    service_count: (services as AdminWorkshopServiceRow[] | null)?.length ?? 0,
    services: (services as AdminWorkshopServiceRow[] | null) ?? [],
    bookings,
  };
}

export async function listBookingsWithLeadSettlementForAdmin(
  userId: string,
  email: string | null | undefined,
): Promise<AdminBookingListRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu do listy rezerwacji.");
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, workshop_id, workshop_name, service_name, status, created_at, booking_date, date, time, start_time, booking_lead_settlements ( settlement_status, lead_fee_amount, test_mode )",
    )
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) throw new Error(formatSupabaseError(error));
  type Raw = {
    id: string;
    workshop_id: string;
    workshop_name: string;
    service_name: string;
    status: string;
    created_at: string;
    booking_date: string | null;
    date: string | null;
    time: string | null;
    start_time: string | null;
    booking_lead_settlements?: { settlement_status: string; lead_fee_amount: number; test_mode: boolean } | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((b) => {
    const emb = b.booking_lead_settlements;
    const s = emb && !Array.isArray(emb) ? emb : Array.isArray(emb) ? emb[0] : null;
    const dateLine = (b.booking_date ?? b.date ?? "").trim();
    const timeLine = (b.start_time ? b.start_time.slice(0, 5) : null) ?? (b.time ? b.time.slice(0, 5) : null);
    return {
      id: b.id,
      workshop_id: b.workshop_id,
      workshop_name: b.workshop_name,
      service_name: b.service_name,
      status: b.status,
      created_at: b.created_at,
      booking_date: dateLine || null,
      time: timeLine,
      settlement_status: s?.settlement_status ?? null,
      lead_fee_amount: s?.lead_fee_amount ?? null,
      test_mode: s?.test_mode ?? null,
    };
  });
}

export async function listWorkshopMonthlyLeadMetricsForAdmin(
  userId: string,
  email: string | null | undefined,
): Promise<WorkshopMonthlyLeadMetricsRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu do raportu leadów.");
  const { data, error } = await supabase.from("workshop_monthly_lead_metrics").select("*");
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data ?? []) as Record<string, unknown>[];
  const mapped = rows.map((r) => ({
    workshop_id: String(r.workshop_id ?? ""),
    workshop_name: (r.workshop_name as string | null) ?? null,
    month: typeof r.month === "string" ? r.month : String(r.month ?? ""),
    total_bookings: Number(r.total_bookings ?? 0),
    confirmed_bookings: Number(r.confirmed_bookings ?? 0),
    completed_bookings: Number(r.completed_bookings ?? 0),
    no_show_bookings: Number(r.no_show_bookings ?? 0),
    cancelled_bookings: Number(r.cancelled_bookings ?? 0),
    billable_leads: Number(r.billable_leads ?? 0),
    waived_test_leads: Number(r.waived_test_leads ?? 0),
    disputed_leads: Number(r.disputed_leads ?? 0),
    not_billable_leads: Number(r.not_billable_leads ?? 0),
    estimated_amount_pln: Number(r.estimated_amount_pln ?? 0),
    test_value_pln: Number(r.test_value_pln ?? 0),
  }));
  mapped.sort((a, b) => {
    const byMonth = b.month.localeCompare(a.month);
    if (byMonth !== 0) return byMonth;
    return (a.workshop_name ?? "").localeCompare(b.workshop_name ?? "", "pl");
  });
  return mapped;
}

export async function updateWorkshopAsAdmin(
  userId: string,
  email: string | null | undefined,
  workshopId: string,
  payload: AdminWorkshopUpdatePayload,
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu do edycji warsztatu.");
  const st = payload.status.toLowerCase().trim();
  if (st !== "active" && st !== "suspended" && st !== "hidden") {
    throw new Error("Niedozwolony status warsztatu.");
  }
  const slugRaw = (payload.slug ?? "").trim();
  const placeRaw = (payload.google_place_id ?? "").trim();
  const lat =
    payload.latitude === null || payload.latitude === undefined || String(payload.latitude) === ""
      ? null
      : Number(payload.latitude);
  const lng =
    payload.longitude === null || payload.longitude === undefined || String(payload.longitude) === ""
      ? null
      : Number(payload.longitude);
  const ratingNum =
    payload.rating === null || payload.rating === undefined ? null : Math.min(5, Math.max(0, Number(payload.rating)));
  const reviewsNum =
    payload.reviews_count === null || payload.reviews_count === undefined
      ? null
      : Math.max(0, Math.floor(Number(payload.reviews_count)));

  const { error } = await supabase
    .from("workshops")
    .update({
      name: payload.name.trim(),
      slug: slugRaw || null,
      city: payload.city?.trim() || null,
      address: payload.address?.trim() || null,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      description: payload.description?.trim() || null,
      google_maps_url: payload.google_maps_url?.trim() || null,
      opening_hours: payload.opening_hours?.trim() || null,
      latitude: lat != null && Number.isFinite(lat) ? lat : null,
      longitude: lng != null && Number.isFinite(lng) ? lng : null,
      rating: ratingNum != null && Number.isFinite(ratingNum) ? ratingNum : null,
      reviews_count: reviewsNum != null && Number.isFinite(reviewsNum) ? reviewsNum : null,
      google_place_id: placeRaw || null,
      show_on_map: Boolean(payload.show_on_map),
      status: st,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workshopId);
  if (error) throw new Error(formatSupabaseError(error));
}

/** Tylko przełącznik widoczności na mapie ServyGo (bez pełnego formularza edycji). */
export async function updateWorkshopShowOnMapAsAdmin(
  userId: string,
  email: string | null | undefined,
  workshopId: string,
  showOnMap: boolean,
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu do edycji warsztatu.");
  const { error } = await supabase
    .from("workshops")
    .update({
      show_on_map: showOnMap,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workshopId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function replaceWorkshopServicesAsAdmin(
  userId: string,
  email: string | null | undefined,
  workshopId: string,
  serviceNames: string[],
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu do edycji usług warsztatu.");
  const normalized = Array.from(new Set(serviceNames.map((n) => n.trim()).filter(Boolean)));
  const normalizedKey = (value: string) => value.trim().toLocaleLowerCase("pl");
  const { data: existing, error: exError } = await supabase
    .from("workshop_services")
    .select("id, service_name, is_active")
    .eq("workshop_id", workshopId);
  if (exError) throw new Error(formatSupabaseError(exError));

  const existingRows = ((existing as { id: string; service_name: string; is_active: boolean | null }[] | null) ?? []);
  const existingByName = new Map(existingRows.map((row) => [normalizedKey(row.service_name), row]));

  const toUpsert = normalized.map((service_name) => {
    const match = existingByName.get(normalizedKey(service_name));
    if (match) {
      return {
        id: match.id,
        workshop_id: workshopId,
        service_name,
        is_active: true,
      };
    }
    const { category } = classifyServiceCategory(service_name);
    return {
      workshop_id: workshopId,
      service_name,
      category,
      category_manual: false,
      is_active: true,
      is_custom: false,
    };
  });

  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase.from("workshop_services").upsert(toUpsert, {
      onConflict: "id",
      ignoreDuplicates: false,
    });
    if (upsertError) throw new Error(formatSupabaseError(upsertError));
  }

  const incomingNameSet = new Set(normalized.map((item) => normalizedKey(item)));
  const toDeactivateIds = existingRows
    .filter((row) => !incomingNameSet.has(normalizedKey(row.service_name)) && row.is_active !== false)
    .map((row) => row.id);

  if (toDeactivateIds.length > 0) {
    // Do not delete workshop_services directly because vehicle prices may reference them.
    const { error: deactivateError } = await supabase
      .from("workshop_services")
      .update({ is_active: false })
      .eq("workshop_id", workshopId)
      .in("id", toDeactivateIds);
    if (deactivateError) throw new Error(formatSupabaseError(deactivateError));
  }

  const summary = normalized.length > 0 ? normalized.join(", ") : null;
  const { error: sumError } = await supabase
    .from("workshops")
    .update({ services_summary: summary, updated_at: new Date().toISOString() })
    .eq("id", workshopId);
  if (sumError) throw new Error(formatSupabaseError(sumError));
}

export async function setWorkshopStatusAsAdmin(
  userId: string,
  email: string | null | undefined,
  workshopId: string,
  status: AdminWorkshopEntityStatus,
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu do zmiany statusu warsztatu.");
  const st = status.toLowerCase().trim() as AdminWorkshopEntityStatus;
  const { error } = await supabase
    .from("workshops")
    .update({ status: st, updated_at: new Date().toISOString() })
    .eq("id", workshopId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function getAdminSidebarNotificationCounts(
  userId: string,
  email?: string | null,
): Promise<AdminSidebarNotificationCounts> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu do powiadomień admina.");

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    pendingLeadsRes,
    newBookingsRes,
    newUsersRes,
    newReviewsRes,
  ] = await Promise.all([
    supabase.from("workshop_leads").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).in("status", ["new", "pending"]),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since24h),
    supabase.from("workshops").select("id", { count: "exact", head: true }).gte("updated_at", since24h).not("google_maps_url", "is", null),
  ]);

  return {
    pendingLeads: pendingLeadsRes.error ? 0 : (pendingLeadsRes.count ?? 0),
    newBookings: newBookingsRes.error ? 0 : (newBookingsRes.count ?? 0),
    newUsers24h: newUsersRes.error ? 0 : (newUsersRes.count ?? 0),
    newReviews: newReviewsRes.error ? 0 : (newReviewsRes.count ?? 0),
    servicesChanges: 0,
  };
}

/** Akceptacja zgłoszenia: konto Auth + mail (invite / reset) + warsztat z owner_id (wywołanie API serwerowego). */
export async function approveWorkshopLeadWithOwnerEmail(
  accessToken: string,
  leadId: string,
  ownerEmail: string,
): Promise<{ workshopId: string; invited: boolean }> {
  const res = await fetch("/api/admin/approve-workshop-lead", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ leadId, ownerEmail: ownerEmail.trim() }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; workshopId?: string; invited?: boolean };
  if (!res.ok) {
    throw new Error(json.error ?? `Błąd akceptacji (${res.status}).`);
  }
  if (!json.workshopId || typeof json.workshopId !== "string") {
    throw new Error("Brak identyfikatora warsztatu w odpowiedzi serwera.");
  }
  return { workshopId: json.workshopId, invited: Boolean(json.invited) };
}

export async function resendWorkshopOwnerAccessEmail(accessToken: string, workshopId: string): Promise<void> {
  const res = await fetch("/api/admin/resend-workshop-access", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workshopId }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Błąd wysyłki (${res.status}).`);
  }
}

export async function updateWorkshopLeadStatusAsAdmin(
  userId: string,
  email: string | null | undefined,
  leadId: string,
  status: AdminWorkshopStatus,
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu do zmiany statusu zgłoszenia.");
  const { error } = await supabase
    .from("workshop_leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) throw new Error(formatSupabaseError(error));
}

/** Tworzy przykładowe zgłoszenie (status pending) — wymaga funkcji RPC z supabase-admin-approve-lead.sql. */
export async function seedTestWorkshopLeadAsAdmin(
  userId: string,
  email: string | null | undefined,
): Promise<string> {
  if (!supabase) throw new Error("Supabase client not available.");
  const hasAccess = await isAdmin(userId, email);
  if (!hasAccess) throw new Error("Brak dostępu.");
  const { data, error } = await supabase.rpc("admin_seed_test_workshop_lead");
  if (error) throw new Error(formatSupabaseError(error));
  const id = Array.isArray(data) ? data[0] : data;
  if (typeof id !== "string") {
    throw new Error("Nie udało się utworzyć testowego zgłoszenia (oczekiwano UUID).");
  }
  return id;
}
