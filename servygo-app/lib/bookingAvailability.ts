import { supabase } from "@/lib/supabaseClient";
import { parseOpeningSchedule } from "@/lib/workshopOwnerApi";

function pad2(v: number) {
  return String(v).padStart(2, "0");
}

function dateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function minutesFromHHmm(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
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
};

export async function getAvailableSlots(args: SlotArgs): Promise<string[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const duration = Math.max(1, args.serviceDurationMinutes);

  const [{ data: workshop, error: workshopError }, { data: exceptionRow, error: exceptionError }] = await Promise.all([
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

  const openRaw = ((exceptionRow as { open_time?: string | null } | null)?.open_time ?? weekly.open).slice(0, 5);
  const closeRaw = ((exceptionRow as { close_time?: string | null } | null)?.close_time ?? weekly.close).slice(0, 5);
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
  const allActiveEmployees = ((employeeRows as { id: string; role: string; specializations?: unknown }[] | null) ?? []).map(
    (row) => row.id,
  );
  const filteredEmployees = ((employeeRows as { id: string; role: string; specializations?: unknown }[] | null) ?? [])
    .filter((row) => {
      if (requiredRoles.length === 0) return true;
      const roleSet = new Set<string>([
        row.role?.toLowerCase?.() ?? "",
        ...((Array.isArray(row.specializations) ? row.specializations : []).map((x) => String(x).toLowerCase())),
      ]);
      return requiredRoles.some((r) => roleSet.has(r));
    })
    .map((row) => row.id);
  // Fallback: do not hide all slots when service role tags are stricter than configured employees.
  const candidateEmployees = filteredEmployees.length > 0 ? filteredEmployees : allActiveEmployees;
  if (candidateEmployees.length === 0) return [];

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("employee_id, start_time, end_time, time, duration_minutes, start_time, end_time")
    .eq("workshop_id", args.workshopId)
    .eq("booking_date", args.date)
    .in("status", ["awaiting_quote", "quote_sent", "quote_accepted", "awaiting_reschedule", "confirmed", "new"])
    .in("employee_id", candidateEmployees);
  if (bookingsError) throw new Error(bookingsError.message);

  const intervalsByEmployee = new Map<string, Array<{ start: number; end: number }>>();
  for (const employeeId of candidateEmployees) intervalsByEmployee.set(employeeId, []);
  for (const row of (bookings as {
    employee_id: string | null;
    start_time?: string | null;
    end_time?: string | null;
    time?: string | null;
    duration_minutes?: number | null;
  }[] | null) ?? []) {
    if (!row.employee_id || !intervalsByEmployee.has(row.employee_id)) continue;
    const start = (row.start_time ?? row.time ?? "").slice(0, 5);
    if (!start) continue;
    const startMins = minutesFromHHmm(start);
    const endMins = row.end_time
      ? minutesFromHHmm(row.end_time.slice(0, 5))
      : startMins + (row.duration_minutes ?? 0);
    intervalsByEmployee.get(row.employee_id)?.push({ start: startMins, end: endMins });
  }

  const slots: string[] = [];
  for (let t = openMins; t + duration <= closeMins; t += 30) {
    const end = t + duration;
    const hasEmployee = candidateEmployees.some((employeeId) => {
      const intervals = intervalsByEmployee.get(employeeId) ?? [];
      return !intervals.some((it) => t < it.end && end > it.start);
    });
    if (hasEmployee) slots.push(hhmmFromMinutes(t));
  }
  return slots;
}

export function inferEndTime(startTime: string, durationMinutes: number): string {
  return hhmmFromMinutes(minutesFromHHmm(startTime) + durationMinutes);
}

export function toLocalDateKey(date: Date): string {
  return dateKeyFromDate(date);
}
