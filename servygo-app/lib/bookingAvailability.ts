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

  const rawDur = args.serviceDurationMinutes;
  const duration = Math.max(
    1,
    Number.isFinite(rawDur) && rawDur != null ? Math.floor(Number(rawDur)) : 60,
  );

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
    for (let t = openMins; t + duration <= closeMins; t += 30) {
      const end = t + duration;
      const free = !globalBusy.some((it) => overlaps(t, end, it.start, it.end));
      if (free) slots.push(hhmmFromMinutes(t));
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
  for (let t = openMins; t + duration <= closeMins; t += 30) {
    const end = t + duration;
    const hasEmployee = candidateEmployees.some((employeeId) => {
      const intervals = intervalsByEmployee.get(employeeId) ?? [];
      return !intervals.some((it) => overlaps(t, end, it.start, it.end));
    });
    if (hasEmployee) slots.push(hhmmFromMinutes(t));
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
