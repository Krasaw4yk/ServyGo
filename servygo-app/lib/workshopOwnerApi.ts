import { supabase } from "@/lib/supabaseClient";
import { parseBookingVehicleData } from "@/lib/bookingSnapshotDisplay";
import {
  WORKSHOP_VISITOR_CONTACT_UNAVAILABLE,
  workshopVisibleDriverDisplayName,
  type WorkshopVisibleDriverProfile,
} from "@/lib/driverPrivacyWorkshop";
import { formatSupabaseError, isValidWorkshopGoogleMapsUrl, type Workshop } from "@/lib/workshopApi";

export type WorkshopOwnerBookingRow = {
  id: string;
  user_id: string;
  workshop_id: string;
  workshop_name: string;
  service_name: string;
  price: number;
  duration_minutes: number;
  date: string;
  time: string;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
  final_price?: number | null;
  quoted_price?: number | null;
  current_quote_id?: string | null;
  quote_sent_at?: string | null;
  quote_expires_at?: string | null;
  quote_note?: string | null;
  quote_status?: string | null;
  cancel_reason?: string | null;
  proposed_booking_date?: string | null;
  proposed_start_time?: string | null;
  proposed_end_time?: string | null;
  reschedule_reason?: string | null;
  reschedule_status?: string | null;
  reschedule_note?: string | null;
  proposed_by?: string | null;
  employee_id?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  car_id: string | null;
  vehicle_data?: unknown;
  notes?: string | null;
  problem_description?: string | null;
  service_category?: string | null;
  selected_services?: unknown;
  search_mode?: string | null;
  booking_type?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  clientLabel: string;
  clientEmail: string;
  clientPhone: string;
  carLabel: string;
  /** Z public.booking_lead_settlements (1:1) */
  settlement_status?: string | null;
  lead_fee_amount?: number | null;
  test_mode?: boolean | null;
  settlement_currency?: string | null;
};

export type WorkshopEmployeeRow = {
  id: string;
  workshop_id: string;
  first_name: string;
  last_name: string;
  role: string;
  specializations: string[];
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type WorkshopOpeningDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WorkshopOpeningDay = {
  closed: boolean;
  open: string;
  close: string;
};

export type WorkshopOpeningSchedule = Record<WorkshopOpeningDayKey, WorkshopOpeningDay>;
export type WorkshopAvailabilityExceptionRow = {
  id: string;
  workshop_id: string;
  date: string;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkshopServiceConfigRow = {
  id: string;
  workshop_id: string;
  service_key: string | null;
  service_name: string;
  category: string | null;
  category_manual?: boolean | null;
  description: string | null;
  price_from: number | null;
  price_to: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  is_custom: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type WorkshopServiceVehiclePriceRow = {
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
  transmission: string | null;
  price_from: number | null;
  price_to: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  difficulty_level?: "low" | "medium" | "high" | null;
  body_type?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const DAY_KEYS: WorkshopOpeningDayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function defaultOpeningSchedule(): WorkshopOpeningSchedule {
  const day: WorkshopOpeningDay = { closed: false, open: "08:00", close: "17:00" };
  return {
    mon: { ...day },
    tue: { ...day },
    wed: { ...day },
    thu: { ...day },
    fri: { ...day },
    sat: { closed: true, open: "08:00", close: "14:00" },
    sun: { closed: true, open: "08:00", close: "14:00" },
  };
}

export function parseOpeningSchedule(raw: string | null | undefined): WorkshopOpeningSchedule {
  if (!raw?.trim()) return defaultOpeningSchedule();
  try {
    const o = JSON.parse(raw) as Record<string, WorkshopOpeningDay>;
    const out = defaultOpeningSchedule();
    for (const k of DAY_KEYS) {
      const v = o[k];
      if (v && typeof v === "object") {
        out[k] = {
          closed: Boolean(v.closed),
          open: typeof v.open === "string" ? v.open : out[k].open,
          close: typeof v.close === "string" ? v.close : out[k].close,
        };
      }
    }
    return out;
  } catch {
    return defaultOpeningSchedule();
  }
}

export function stringifyOpeningSchedule(s: WorkshopOpeningSchedule): string {
  return JSON.stringify(s);
}

export async function listAvailabilityExceptionsForOwner(workshopId: string): Promise<WorkshopAvailabilityExceptionRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshop_availability_exceptions")
    .select("id, workshop_id, date, is_closed, open_time, close_time, note, created_at, updated_at")
    .eq("workshop_id", workshopId)
    .order("date", { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  return (data as WorkshopAvailabilityExceptionRow[] | null) ?? [];
}

export async function upsertAvailabilityExceptionForOwner(
  workshopId: string,
  payload: { date: string; is_closed: boolean; open_time: string | null; close_time: string | null; note?: string | null },
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const row = {
    workshop_id: workshopId,
    date: payload.date,
    is_closed: payload.is_closed,
    open_time: payload.is_closed ? null : payload.open_time,
    close_time: payload.is_closed ? null : payload.close_time,
    note: payload.note?.trim() || null,
  };
  const { error } = await supabase
    .from("workshop_availability_exceptions")
    .upsert(row, { onConflict: "workshop_id,date", ignoreDuplicates: false });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function deleteAvailabilityExceptionForOwner(workshopId: string, date: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase
    .from("workshop_availability_exceptions")
    .delete()
    .eq("workshop_id", workshopId)
    .eq("date", date);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function getOwnedWorkshopForUser(userId: string): Promise<Workshop | null> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshops")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  return (data as Workshop | null) ?? null;
}

export async function listBookingsForWorkshopOwner(
  workshopId: string,
  options?: { exposeDriverDirectContact?: boolean },
): Promise<WorkshopOwnerBookingRow[]> {
  const exposeDriverDirectContact = options?.exposeDriverDirectContact === true;
  if (!supabase) throw new Error("Supabase client not available.");
  const { data: rows, error } = await supabase
    .from("bookings")
    .select(
      [
        "id",
        "user_id",
        "workshop_id",
        "workshop_name",
        "service_name",
        "service_category",
        "price",
        "final_price",
        "quoted_price",
        "current_quote_id",
        "quote_sent_at",
        "quote_expires_at",
        "quote_note",
        "quote_status",
        "cancel_reason",
        "proposed_booking_date",
        "proposed_start_time",
        "proposed_end_time",
        "reschedule_reason",
        "reschedule_status",
        "reschedule_note",
        "proposed_by",
        "cancelled_at",
        "cancelled_by",
        "cancellation_reason",
        "duration_minutes",
        "date",
        "time",
        "booking_date",
        "start_time",
        "end_time",
        "status",
        "created_at",
        "car_id",
        "vehicle_data",
        "notes",
        "problem_description",
        "selected_services",
        "search_mode",
        "booking_type",
        "client_name",
        "client_email",
        "client_phone",
        "employee_id",
        "booking_lead_settlements ( settlement_status, lead_fee_amount, test_mode, currency )",
      ].join(", "),
    )
    .eq("workshop_id", workshopId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(formatSupabaseError(error));
  type RowWithSettlement = Omit<
    WorkshopOwnerBookingRow,
    "clientLabel" | "clientEmail" | "clientPhone" | "carLabel" | "settlement_status" | "lead_fee_amount" | "test_mode" | "settlement_currency"
  > & {
    booking_lead_settlements?: { settlement_status: string; lead_fee_amount: number; test_mode: boolean; currency: string } | null;
  };
  const list = ((rows ?? []) as unknown) as RowWithSettlement[];
  if (list.length === 0) return [];
  const userIds = [...new Set(list.map((r) => r.user_id))];
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*").in("id", userIds);
  if (pErr) throw new Error(formatSupabaseError(pErr));
  const profileMap = new Map(
    (profiles as unknown as (WorkshopVisibleDriverProfile & { id: string; email?: string | null; phone?: string | null })[] | null)?.map(
      (p) => [p.id, p],
    ) ?? [],
  );
  const { data: cars, error: cErr } = await supabase
    .from("cars")
    .select("id, user_id, brand, model, year, plate_number, is_primary")
    .in("user_id", userIds);
  if (cErr) throw new Error(formatSupabaseError(cErr));
  const carsByUser = new Map<
    string,
    { id: string; brand: string | null; model: string | null; year: number | null; plate_number: string | null; is_primary: boolean }[]
  >();
  for (const c of (cars as {
    id: string;
    user_id: string;
    brand: string | null;
    model: string | null;
    year: number | null;
    plate_number: string | null;
    is_primary: boolean;
  }[] | null) ?? []) {
    const arr = carsByUser.get(c.user_id) ?? [];
    arr.push(c);
    carsByUser.set(c.user_id, arr);
  }
  function resolveClientEmail(uid: string, snapshotEmail: string | null | undefined) {
    const snap = (snapshotEmail ?? "").trim();
    if (snap) return snap;
    const p = profileMap.get(uid);
    return p?.email?.trim() || "—";
  }
  function resolveClientPhone(uid: string, snapshotPhone: string | null | undefined) {
    const snap = (snapshotPhone ?? "").trim();
    if (snap) return snap;
    const p = profileMap.get(uid);
    const raw = (p?.phone ?? "").trim();
    return raw || "—";
  }
  function carLabel(uid: string, carId: string | null, vehicleData: unknown) {
    const vd = parseBookingVehicleData(vehicleData);
    const fromJson = [vd.brand, vd.model, vd.year].filter(Boolean).join(" ").trim();
    if (fromJson) {
      const tail = [vd.vehicleType, vd.fuel, vd.vin ? `VIN ${vd.vin}` : "", vd.plate].filter(Boolean).join(" · ");
      return tail ? `${fromJson} (${tail})` : fromJson;
    }
    const listC = carsByUser.get(uid) ?? [];
    const one = carId ? listC.find((c) => c.id === carId) : undefined;
    if (!one) return "—";
    const bits = [one.brand, one.model, one.year != null ? String(one.year) : null, one.plate_number].filter(Boolean);
    return bits.join(" · ") || "—";
  }
  return list.map((r) => {
    const emb = r.booking_lead_settlements;
    const stRow = emb && !Array.isArray(emb) ? emb : Array.isArray(emb) ? emb[0] : null;
    const rest = { ...r };
    delete rest.booking_lead_settlements;
    return {
      ...rest,
      date: r.booking_date ?? r.date,
      time: (r.start_time ? r.start_time.slice(0, 5) : null) ?? r.time,
      settlement_status: stRow?.settlement_status ?? null,
      lead_fee_amount: stRow?.lead_fee_amount ?? null,
      test_mode: stRow?.test_mode ?? null,
      settlement_currency: stRow?.currency ?? null,
      clientLabel: workshopVisibleDriverDisplayName(profileMap.get(r.user_id), r.client_name),
      clientEmail: exposeDriverDirectContact ? resolveClientEmail(r.user_id, r.client_email) : WORKSHOP_VISITOR_CONTACT_UNAVAILABLE,
      clientPhone: exposeDriverDirectContact ? resolveClientPhone(r.user_id, r.client_phone) : WORKSHOP_VISITOR_CONTACT_UNAVAILABLE,
      carLabel: carLabel(r.user_id, r.car_id, r.vehicle_data),
    };
  });
}

export async function markBookingVisitCompletedAsWorkshopOwner(bookingId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.rpc("mark_booking_visit_completed", { p_booking_id: bookingId });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function markBookingNoShowAsWorkshopOwner(bookingId: string, reason?: string | null): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.rpc("mark_booking_no_show", {
    p_booking_id: bookingId,
    p_reason: reason?.trim() ? reason.trim() : null,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function markBookingSettlementDisputedAsWorkshopOwner(bookingId: string, reason: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Podaj powód sporu.");
  const { error } = await supabase.rpc("mark_booking_settlement_disputed", {
    p_booking_id: bookingId,
    p_reason: trimmed,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function listWorkshopEmployeesForOwner(workshopId: string): Promise<WorkshopEmployeeRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshop_employees")
    .select("id, workshop_id, first_name, last_name, role, specializations, is_active, created_at, updated_at")
    .eq("workshop_id", workshopId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  type EmployeeRowFromDb = Omit<WorkshopEmployeeRow, "specializations"> & { specializations?: unknown };
  return ((data as EmployeeRowFromDb[] | null) ?? []).map((row) => {
    const specializations = Array.isArray(row.specializations) ? row.specializations.map((x) => String(x)) : [];
    return {
      ...row,
      specializations,
    };
  });
}

export async function upsertWorkshopEmployeeForOwner(
  workshopId: string,
  payload: {
    id?: string;
    first_name: string;
    last_name: string;
    role: string;
    specializations?: string[];
    is_active?: boolean;
  },
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { error } = await supabase.from("workshop_employees").upsert({
    ...(payload.id ? { id: payload.id } : {}),
    workshop_id: workshopId,
    first_name: payload.first_name.trim(),
    last_name: payload.last_name.trim(),
    role: payload.role.trim(),
    specializations: payload.specializations ?? [],
    is_active: payload.is_active ?? true,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

const OWNER_BOOKING_STATUSES = [
  "pending_quote",
  "quote_sent",
  "quote_rejected",
  "confirmed",
  "cancelled",
  "completed",
  "pending",
  "new",
  "done",
  "rejected",
  "awaiting_reschedule",
  /** Legacy alias kept until DB migration 36 applied everywhere */
  "awaiting_quote",
  "quote_accepted",
  "cancelled_by_client",
  "cancelled_by_workshop",
  "cancelled_by_system",
] as const;

export async function updateBookingStatusAsWorkshopOwner(bookingId: string, status: (typeof OWNER_BOOKING_STATUSES)[number]): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  if (!OWNER_BOOKING_STATUSES.includes(status)) throw new Error("Niedozwolony status rezerwacji.");
  const { error } = await supabase.from("bookings").update({ status }).eq("id", bookingId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function sendBookingQuoteAsWorkshopOwner(
  bookingId: string,
  finalPrice: number,
  quoteNote?: string | null,
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  if (!Number.isFinite(finalPrice) || finalPrice < 0) throw new Error("Nieprawidłowa cena.");

  const { data: row, error: rowErr } = await supabase.from("bookings").select("status").eq("id", bookingId).maybeSingle();
  if (rowErr) throw new Error(formatSupabaseError(rowErr));
  const st = ((row as { status?: string | null } | null)?.status ?? "").trim().toLowerCase();
  if (st === "confirmed" || st === "completed") {
    throw new Error("Nie można wysłać nowej wyceny po potwierdzeniu wizyty.");
  }
  if (
    st === "cancelled" ||
    st === "cancelled_by_client" ||
    st === "cancelled_by_workshop" ||
    st === "cancelled_by_system"
  ) {
    throw new Error("Nie można wysłać wyceny dla anulowanej rezerwacji.");
  }

  const trimmedNote = quoteNote?.trim() ?? "";
  const { error } = await supabase.rpc("send_booking_quote", {
    p_booking_id: bookingId,
    p_final_price: finalPrice,
    p_quote_note: trimmedNote.length ? trimmedNote : null,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function cancelBookingAsWorkshopOwner(bookingId: string, reason: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("Powód anulowania jest wymagany.");
  const { error } = await supabase.rpc("cancel_booking", {
    p_booking_id: bookingId,
    p_reason: trimmedReason,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function proposeBookingRescheduleAsWorkshopOwner(
  bookingId: string,
  newDate: string,
  newStartTime: string,
  reason: string,
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("Powód zmiany terminu jest wymagany.");
  const { error } = await supabase.rpc("propose_booking_reschedule", {
    p_booking_id: bookingId,
    p_new_booking_date: newDate,
    p_new_start_time: newStartTime,
    p_reason: trimmedReason,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export type WorkshopOwnerProfilePatch = {
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  google_maps_url: string | null;
  opening_hours: string | null;
};

export async function updateOwnedWorkshopProfile(workshopId: string, patch: WorkshopOwnerProfilePatch): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const maps = patch.google_maps_url?.trim() ?? "";
  if (maps && !isValidWorkshopGoogleMapsUrl(maps)) {
    throw new Error("Nieprawidłowy link Google Maps.");
  }
  const { error } = await supabase
    .from("workshops")
    .update({
      name: patch.name.trim(),
      city: patch.city?.trim() || null,
      address: patch.address?.trim() || null,
      phone: patch.phone?.trim() || null,
      email: patch.email?.trim() || null,
      description: patch.description?.trim() || null,
      google_maps_url: maps || null,
      opening_hours: patch.opening_hours?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workshopId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function listWorkshopServiceConfigsForOwner(workshopId: string): Promise<WorkshopServiceConfigRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshop_services")
    .select(
      "id, workshop_id, service_key, service_name, category, category_manual, description, price_from, price_to, duration_minutes, is_active, is_custom, created_at, updated_at",
    )
    .eq("workshop_id", workshopId)
    .order("service_name", { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  return (data as WorkshopServiceConfigRow[] | null) ?? [];
}

export async function upsertWorkshopServiceConfigsForOwner(
  workshopId: string,
  rows: Array<{
    id?: string;
    service_key?: string | null;
    service_name: string;
    category?: string | null;
    category_manual?: boolean;
    description?: string | null;
    price_from?: number | null;
    price_to?: number | null;
    duration_minutes?: number | null;
    is_active?: boolean;
    is_custom?: boolean;
  }>,
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const normalized = rows.map((r) => ({
    id: r.id?.trim() || null,
    workshop_id: workshopId,
    service_key: r.service_key ?? null,
    service_name: r.service_name.trim(),
    category: r.category?.trim() || null,
    category_manual: Boolean(r.category_manual),
    description: r.description?.trim() || null,
    price_from: r.price_from ?? null,
    price_to: r.price_to ?? null,
    duration_minutes: r.duration_minutes ?? null,
    is_active: r.is_active ?? true,
    is_custom: r.is_custom ?? false,
  }));
  const rowsWithId = normalized.filter((r) => Boolean(r.id)).map((r) => ({ ...r, id: r.id as string }));
  const rowsWithoutId = normalized
    .filter((r) => !r.id)
    .map((row) => {
      const { id, ...rest } = row;
      return id ? rest : rest;
    });

  if (rowsWithId.length > 0) {
    const { error } = await supabase
      .from("workshop_services")
      .upsert(rowsWithId, { onConflict: "id", ignoreDuplicates: false });
    if (error) throw new Error(formatSupabaseError(error));
  }

  if (rowsWithoutId.length > 0) {
    const { error } = await supabase
      .from("workshop_services")
      .insert(rowsWithoutId);
    if (error) throw new Error(formatSupabaseError(error));
  }
}

export async function deleteWorkshopServiceConfigsForOwner(workshopId: string, ids: string[]): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const targetIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (targetIds.length === 0) return;
  const { error } = await supabase
    .from("workshop_services")
    .delete()
    .eq("workshop_id", workshopId)
    .in("id", targetIds);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function listWorkshopServiceVehiclePricesForOwner(workshopId: string): Promise<WorkshopServiceVehiclePriceRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshop_service_vehicle_prices")
    .select(
      "id, workshop_id, workshop_service_id, service_name, vehicle_type, brand, model, year_from, year_to, engine, fuel, transmission, price_from, price_to, duration_minutes, is_active, difficulty_level, created_at, updated_at",
    )
    .eq("workshop_id", workshopId)
    .order("service_name", { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  return (data as WorkshopServiceVehiclePriceRow[] | null) ?? [];
}

export async function upsertWorkshopServiceVehiclePricesForOwner(
  workshopId: string,
  rows: Array<{
    id?: string;
    workshop_service_id?: string | null;
    service_name: string;
    vehicle_type: string;
    brand?: string | null;
    model?: string | null;
    year_from?: number | null;
    year_to?: number | null;
    engine?: string | null;
    fuel?: string | null;
    transmission?: string | null;
    price_from?: number | null;
    price_to?: number | null;
    duration_minutes?: number | null;
    is_active?: boolean;
    difficulty_level?: "low" | "medium" | "high" | null;
    body_type?: string | null;
  }>,
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const payload = rows.map((row) => ({
    ...(row.id?.trim() ? { id: row.id.trim() } : {}),
    workshop_id: workshopId,
    workshop_service_id: row.workshop_service_id?.trim() || null,
    service_name: row.service_name.trim(),
    vehicle_type: row.vehicle_type.trim(),
    brand: row.brand?.trim() || null,
    model: row.model?.trim() || null,
    year_from: row.year_from ?? null,
    year_to: row.year_to ?? null,
    engine: row.engine?.trim() || null,
    fuel: row.fuel?.trim() || null,
    transmission: row.transmission?.trim() || null,
    price_from: row.price_from ?? null,
    price_to: row.price_to ?? null,
    duration_minutes: row.duration_minutes ?? null,
    is_active: row.is_active ?? true,
    difficulty_level: row.difficulty_level ?? "medium",
    body_type: row.body_type?.trim() || null,
  }));
  if (payload.length === 0) return;
  const { error } = await supabase
    .from("workshop_service_vehicle_prices")
    .upsert(payload, { onConflict: "id", ignoreDuplicates: false });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function deleteWorkshopServiceVehiclePricesForOwner(workshopId: string, ids: string[]): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const targetIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (targetIds.length === 0) return;
  const { error } = await supabase
    .from("workshop_service_vehicle_prices")
    .delete()
    .eq("workshop_id", workshopId)
    .in("id", targetIds);
  if (error) throw new Error(formatSupabaseError(error));
}

export function googleReviewsHintUrl(workshop: Pick<Workshop, "google_maps_url" | "name" | "city">): string {
  const direct = workshop.google_maps_url?.trim();
  if (direct) return direct;
  const q = [workshop.name, workshop.city].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || workshop.name)}`;
}

/** Wiersz widoku public.workshop_monthly_lead_metrics (filtrowany po workshop_id w aplikacji). */
export type WorkshopOwnerMonthlyLeadMetricsRow = {
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

export type WorkshopOwnerLeadSettlementListRow = {
  id: string;
  booking_id: string;
  settlement_status: string;
  lead_fee_amount: number;
  currency: string;
  test_mode: boolean;
  booking_date: string | null;
  start_time: string | null;
  service_name: string;
  booking_status: string;
  client_display: string;
};

function mapMonthlyMetricsRow(r: Record<string, unknown>): WorkshopOwnerMonthlyLeadMetricsRow {
  return {
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
  };
}

export async function listWorkshopMonthlyLeadMetricsForOwner(workshopId: string): Promise<WorkshopOwnerMonthlyLeadMetricsRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const wid = workshopId.trim();
  if (!wid) throw new Error("Brak identyfikatora warsztatu.");
  const { data, error } = await supabase
    .from("workshop_monthly_lead_metrics")
    .select("*")
    .eq("workshop_id", wid);
  if (error) throw new Error(formatSupabaseError(error));
  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapMonthlyMetricsRow);
  rows.sort((a, b) => {
    const byMonth = b.month.localeCompare(a.month);
    if (byMonth !== 0) return byMonth;
    return (a.workshop_name ?? "").localeCompare(b.workshop_name ?? "", "pl");
  });
  return rows;
}

export async function listRecentLeadSettlementsForOwner(
  workshopId: string,
  limit = 50,
): Promise<WorkshopOwnerLeadSettlementListRow[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const wid = workshopId.trim();
  if (!wid) throw new Error("Brak identyfikatora warsztatu.");
  const { data, error } = await supabase
    .from("booking_lead_settlements")
    .select(
      "id, booking_id, settlement_status, lead_fee_amount, currency, test_mode, updated_at, bookings ( booking_date, start_time, service_name, status, client_name )",
    )
    .eq("workshop_id", wid)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(formatSupabaseError(error));

  type Raw = {
    id: string;
    booking_id: string;
    settlement_status: string;
    lead_fee_amount: number;
    currency: string;
    test_mode: boolean;
    bookings?: {
      booking_date: string | null;
      start_time: string | null;
      service_name: string;
      status: string;
      client_name: string | null;
    } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((row) => {
    const b = row.bookings;
    const emb = b && !Array.isArray(b) ? b : Array.isArray(b) ? b[0] : null;
    const dateStr = emb?.booking_date ? String(emb.booking_date).slice(0, 10) : null;
    const clientDisplay = (emb?.client_name ?? "").trim() || "Klient";
    return {
      id: row.id,
      booking_id: row.booking_id,
      settlement_status: row.settlement_status,
      lead_fee_amount: Number(row.lead_fee_amount),
      currency: (row.currency ?? "PLN").trim() || "PLN",
      test_mode: Boolean(row.test_mode),
      booking_date: dateStr,
      start_time: emb?.start_time ? String(emb.start_time).slice(0, 5) : null,
      service_name: (emb?.service_name ?? "").trim() || "—",
      booking_status: (emb?.status ?? "").trim() || "—",
      client_display: clientDisplay,
    };
  });
}
