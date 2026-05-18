import { supabase } from "@/lib/supabaseClient";
import type { MockWorkshop } from "@/lib/mockWorkshops";
import { DROPOFF_CALENDAR_SLOT_MINUTES, type BookingSlotMode } from "@/lib/bookingVisitKind";
import { parseOpeningSchedule } from "@/lib/workshopOwnerApi";

function pad2(v: number) {
  return String(v).padStart(2, "0");
}

function dateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function minutesFromHHmm(value: string) {
  const [h, m] = value.split(":").map(Number);
  const hh = Number.isFinite(h) ? h : 0;
  const mm = Number.isFinite(m) ? m : 0;
  return hh * 60 + mm;
}

function hhmmFromMinutes(value: number) {
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function weekdayKeyFromDateKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  return map[dow];
}

type SlotArgs = {
  workshopId: string;
  date: string;
  serviceDurationMinutes: number;
  employeeId?: string | null;
  requiredRoles?: string[];
  /** Domyślnie `exact_time` — sloty kończą się tak, by zmieścić czas usługi przed zamknięciem. */
  slotMode?: BookingSlotMode;
};

/** Bloki zajętości z RPC (bez PII klienta). */
type SlotOccupancyBlock = {
  employee_id: string | null;
  start_mins: number;
  end_mins: number;
};

function parseSlotOccupancyBlocks(data: unknown): SlotOccupancyBlock[] {
  if (!data || !Array.isArray(data)) return [];
  const out: SlotOccupancyBlock[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const start = typeof row.start_mins === "number" ? row.start_mins : Number(row.start_mins);
    const end = typeof row.end_mins === "number" ? row.end_mins : Number(row.end_mins);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const e = row.employee_id;
    const employee_id = e === null || e === undefined ? null : typeof e === "string" ? e : String(e);
    out.push({ employee_id, start_mins: start, end_mins: end });
  }
  return out;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

export async function getAvailableSlots(args: SlotArgs): Promise<string[]> {
  if (!supabase) throw new Error("Supabase client not available.");

  const slotMode: BookingSlotMode = args.slotMode ?? "exact_time";
  const rawDur = args.serviceDurationMinutes;
  const duration =
    slotMode === "dropoff"
      ? Math.max(1, DROPOFF_CALENDAR_SLOT_MINUTES)
      : Math.max(1, Number.isFinite(rawDur) && rawDur != null ? Math.floor(Number(rawDur)) : 60);

  const [{ data: workshop, error: workshopError }, { data: exceptionRow, error: exceptionError }] =
    await Promise.all([
      supabase.from("workshops").select("id, opening_hours").eq("id", args.workshopId).maybeSingle(),
      supabase
        .from("workshop_availability_exceptions")
        .select("is_closed, open_time, close_time")
        .eq("workshop_id", args.workshopId)
        .eq("date", args.date)
        .maybeSingle(),
    ]);
  if (workshopError) throw new Error(workshopError.message);
  if (exceptionError) throw new Error(exceptionError.message);
  if (!workshop) return [];

  const opening = parseOpeningSchedule((workshop as { opening_hours?: string | null }).opening_hours);
  const weekdayKey = weekdayKeyFromDateKey(args.date);
  const weekly = opening[weekdayKey];
  const isClosed = Boolean((exceptionRow as { is_closed?: boolean } | null)?.is_closed ?? weekly.closed);
  if (isClosed) return [];

  const openRaw = String((exceptionRow as { open_time?: string | null } | null)?.open_time ?? weekly.open).slice(
    0,
    5,
  );
  const closeRaw = String((exceptionRow as { close_time?: string | null } | null)?.close_time ?? weekly.close).slice(
    0,
    5,
  );
  const openMins = minutesFromHHmm(openRaw);
  const closeMins = minutesFromHHmm(closeRaw);
  if (closeMins <= openMins) return [];

  const employeeQuery = supabase
    .from("workshop_employees")
    .select("id, role, specializations, is_active")
    .eq("workshop_id", args.workshopId)
    .eq("is_active", true);
  const { data: employeeRows, error: employeeError } = args.employeeId
    ? await employeeQuery.eq("id", args.employeeId)
    : await employeeQuery;
  if (employeeError) throw new Error(employeeError.message);

  const requiredRoles = (args.requiredRoles ?? []).map((r) => r.trim().toLowerCase()).filter(Boolean);
  const allActiveEmployees = (
    (employeeRows as { id: string; role: string; specializations?: unknown }[] | null) ?? []
  ).map((row) => row.id);
  const filteredEmployees = (
    (employeeRows as { id: string; role: string; specializations?: unknown }[] | null) ?? []
  )
    .filter((row) => {
      if (requiredRoles.length === 0) return true;
      const roleSet = new Set<string>([
        row.role?.toLowerCase?.() ?? "",
        ...(Array.isArray(row.specializations) ? row.specializations : []).map((x) => String(x).toLowerCase()),
      ]);
      return requiredRoles.some((r) => roleSet.has(r));
    })
    .map((row) => row.id);

  const candidateEmployees = filteredEmployees.length > 0 ? filteredEmployees : allActiveEmployees;

  const { data: blockRpc, error: blockError } = await supabase.rpc("list_booking_slot_blocks_public", {
    p_workshop_id: args.workshopId,
    p_booking_date: args.date,
  });

  if (blockError) throw new Error(blockError.message);
  const blocks = parseSlotOccupancyBlocks(blockRpc as unknown);

  if (candidateEmployees.length === 0) {
    const globalBusy = blocks.map((b) => ({ start: b.start_mins, end: b.end_mins }));
    const slots: string[] = [];
    if (slotMode === "dropoff") {
      for (let t = openMins; t <= closeMins; t += 30) {
        const end = t + duration;
        const free = !globalBusy.some((it) => overlaps(t, end, it.start, it.end));
        if (free) slots.push(hhmmFromMinutes(t));
      }
    } else {
      for (let t = openMins; t + duration <= closeMins; t += 30) {
        const end = t + duration;
        const free = !globalBusy.some((it) => overlaps(t, end, it.start, it.end));
        if (free) slots.push(hhmmFromMinutes(t));
      }
    }
    const todayKey = dateKeyFromDate(new Date());
    if (args.date === todayKey) {
      const nowM = new Date().getHours() * 60 + new Date().getMinutes();
      return slots.filter((slot) => minutesFromHHmm(slot) > nowM);
    }
    return slots;
  }

  const intervalsByEmployee = new Map<string, Array<{ start: number; end: number }>>();
  for (const employeeId of candidateEmployees) intervalsByEmployee.set(employeeId, []);

  for (const b of blocks) {
    const sm = b.start_mins;
    const em = b.end_mins;
    const eid = b.employee_id;
    if (eid && intervalsByEmployee.has(eid)) {
      intervalsByEmployee.get(eid)?.push({ start: sm, end: em });
    } else {
      for (const employeeId of candidateEmployees) {
        intervalsByEmployee.get(employeeId)?.push({ start: sm, end: em });
      }
    }
  }

  const slots: string[] = [];
  if (slotMode === "dropoff") {
    for (let t = openMins; t <= closeMins; t += 30) {
      const end = t + duration;
      const hasEmployee = candidateEmployees.some((employeeId) => {
        const intervals = intervalsByEmployee.get(employeeId) ?? [];
        return !intervals.some((it) => overlaps(t, end, it.start, it.end));
      });
      if (hasEmployee) slots.push(hhmmFromMinutes(t));
    }
  } else {
    for (let t = openMins; t + duration <= closeMins; t += 30) {
      const end = t + duration;
      const hasEmployee = candidateEmployees.some((employeeId) => {
        const intervals = intervalsByEmployee.get(employeeId) ?? [];
        return !intervals.some((it) => overlaps(t, end, it.start, it.end));
      });
      if (hasEmployee) slots.push(hhmmFromMinutes(t));
    }
  }
  const todayKey = dateKeyFromDate(new Date());
  if (args.date === todayKey) {
    const nowM = new Date().getHours() * 60 + new Date().getMinutes();
    return slots.filter((slot) => minutesFromHHmm(slot) > nowM);
  }
  return slots;
}

export function inferEndTime(startTime: string, durationMinutes: number): string {
  const d = Number.isFinite(durationMinutes) ? Math.floor(durationMinutes) : 60;
  return hhmmFromMinutes(minutesFromHHmm(startTime) + d);
}

export function toLocalDateKey(date: Date): string {
  return dateKeyFromDate(date);
}

function overlapsMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Sloty z konfiguracji `workshop.availability` (mock / fallback bez Supabase).
 * Logika zbliżona do kalendarza: dni robocze, godziny, wyjątki, zajęte terminy z `bookedSlots`.
 */
export function computeLocalAvailabilitySlots(
  workshop: Pick<MockWorkshop, "availability" | "bookedSlots" | "closedDates">,
  dateKey: string,
  durationMinutes: number,
  now: Date = new Date(),
): string[] {
  const duration = Math.max(1, Math.floor(Number(durationMinutes)) || 60);
  const [y, mo, d] = dateKey.split("-").map(Number);
  if (!y || !mo || !d) return [];
  const dayDate = new Date(y, mo - 1, d);
  if (Number.isNaN(dayDate.getTime())) return [];

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dayDate < todayStart) return [];

  const jsDow = dayDate.getDay();
  const { availability, bookedSlots, closedDates } = workshop;
  if (!availability.workingDays.includes(jsDow)) return [];

  const blocked = new Set<string>([...(availability.blockedDates ?? []), ...(closedDates ?? [])]);
  if (blocked.has(dateKey)) return [];

  const customRaw = availability.customAvailability?.[dateKey];
  if (Object.prototype.hasOwnProperty.call(availability.customAvailability ?? {}, dateKey)) {
    if (!Array.isArray(customRaw) || customRaw.length === 0) return [];
  }

  const weekdayKey = String(jsDow);
  const customSlots = Array.isArray(customRaw) && customRaw.length > 0 ? customRaw : null;
  const templateSlots = customSlots ?? availability.availableTimeSlots[weekdayKey] ?? [];

  const openM = minutesFromHHmm(availability.openingHours.start);
  const closeM = minutesFromHHmm(availability.openingHours.end);
  if (closeM <= openM) return [];

  const busy: { start: number; end: number }[] = [];
  for (const raw of bookedSlots ?? []) {
    const s = String(raw).trim();
    if (!s.includes("T")) continue;
    const [datePart, timePart] = s.split("T");
    if (datePart !== dateKey) continue;
    const hhmm = timePart.slice(0, 5);
    const sm = minutesFromHHmm(hhmm);
    if (!Number.isFinite(sm)) continue;
    busy.push({ start: sm, end: sm + duration });
  }

  let candidates: string[] =
    templateSlots.length > 0
      ? templateSlots
          .map((slot) => slot.slice(0, 5))
          .filter((slot) => {
            const sm = minutesFromHHmm(slot);
            return Number.isFinite(sm) && sm >= openM && sm + duration <= closeM;
          })
      : (() => {
          const out: string[] = [];
          for (let t = openM; t + duration <= closeM; t += 30) {
            out.push(hhmmFromMinutes(t));
          }
          return out;
        })();

  const todayKey = dateKeyFromDate(now);
  const nowM = now.getHours() * 60 + now.getMinutes();

  candidates = candidates.filter((slot) => {
    const sm = minutesFromHHmm(slot.slice(0, 5));
    const em = sm + duration;
    if (!busy.every((b) => !overlapsMinutes(sm, em, b.start, b.end))) return false;
    if (dateKey === todayKey && sm < nowM) return false;
    return true;
  });

  return [...new Set(candidates)].sort((a, b) => minutesFromHHmm(a) - minutesFromHHmm(b));
}

/** Tak samo jak kalendarz rezerwacji: Supabase RPC lub lokalny model dostępności (mock). */
export async function resolveAvailableSlotsForWorkshopDay(
  workshop: MockWorkshop,
  dateKey: string,
  durationMinutes: number,
): Promise<string[]> {
  if (workshop.usesLocalCalendar === true) {
    return computeLocalAvailabilitySlots(workshop, dateKey, durationMinutes);
  }
  if (!supabase) {
    return computeLocalAvailabilitySlots(workshop, dateKey, durationMinutes);
  }
  try {
    return await getAvailableSlots({
      workshopId: workshop.supabaseId,
      date: dateKey,
      serviceDurationMinutes: durationMinutes,
    });
  } catch {
    return computeLocalAvailabilitySlots(workshop, dateKey, durationMinutes);
  }
}
