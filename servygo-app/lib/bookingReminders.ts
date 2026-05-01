import { createSupabaseServiceRoleClient } from "@/lib/supabaseAdmin";
import { sendBookingReminderEmail } from "@/lib/sendBookingReminderEmail";

type BookingRow = {
  id: string;
  user_id: string;
  workshop_id: string;
  workshop_name: string | null;
  service_name: string | null;
  booking_date: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  status: string | null;
  created_at: string;
  client_email: string | null;
};

/** Różnica w dniach kalendarzowych UTC między start (wcześniejsza) a end. */
function calendarDaysBetweenUTC(start: Date, end: Date): number {
  const a = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const b = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function parseBookingDateKey(bookingDate: string | null): string | null {
  if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate.trim())) return null;
  return bookingDate.trim();
}

function visitEndMs(booking: BookingRow): number {
  const dk = parseBookingDateKey(booking.booking_date);
  if (!dk) return NaN;
  const tm = (booking.start_time ?? "09:00:00").slice(0, 8);
  const [yy, mm, dd] = dk.split("-").map(Number);
  const timeParts = tm.split(":");
  const hh = Number(timeParts[0] ?? 0);
  const mi = Number(timeParts[1] ?? 0);
  const ss = Number(timeParts[2] ?? 0);
  const start = Date.UTC(yy, (mm || 1) - 1, dd || 1, hh, mi, ss);
  const dur = booking.duration_minutes ?? 60;
  return start + Math.max(15, dur) * 60 * 1000;
}

const COMPLETION_GRACE_MS = 45 * 60 * 1000;

async function tryInsertReminderLog(
  admin: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>,
  row: { booking_id: string; reminder_type: string; channel: string; status?: string; error?: string | null },
): Promise<boolean> {
  const { error } = await admin.from("booking_reminders").insert({
    booking_id: row.booking_id,
    reminder_type: row.reminder_type,
    channel: row.channel,
    status: row.status ?? "sent",
    error: row.error ?? null,
  });
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return true;
}

async function insertNotificationIfFresh(
  admin: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>,
  opts: {
    userId: string;
    type: string;
    title: string;
    body: string;
    bookingId: string;
    workshopId: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.from("user_notifications").insert({
    user_id: opts.userId,
    notification_type: opts.type,
    title: opts.title,
    body: opts.body,
    booking_id: opts.bookingId,
    workshop_id: opts.workshopId,
    payload: opts.payload ?? {},
  });
  if (error) throw new Error(error.message);
}

export type ProcessBookingRemindersResult = {
  ran: boolean;
  visit5d: number;
  visit1d: number;
  completionChecks: number;
  errors: string[];
};

/**
 * Wywołuj z cron / route API (service role). Idempotentnie wg booking_reminders.
 */
export async function processBookingReminders(): Promise<ProcessBookingRemindersResult> {
  const result: ProcessBookingRemindersResult = {
    ran: false,
    visit5d: 0,
    visit1d: 0,
    completionChecks: 0,
    errors: [],
  };

  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    result.errors.push("Brak SUPABASE_SERVICE_ROLE_KEY — pominięto processBookingReminders.");
    return result;
  }

  result.ran = true;
  const now = new Date();

  const { data: bookings, error: qerr } = await admin
    .from("bookings")
    .select("id, user_id, workshop_id, workshop_name, service_name, booking_date, start_time, duration_minutes, status, created_at, client_email")
    .in("status", ["confirmed"]);

  if (qerr) {
    result.errors.push(qerr.message);
    return result;
  }

  const rows = (bookings as BookingRow[] | null) ?? [];

  for (const b of rows) {
    const visitKey = parseBookingDateKey(b.booking_date);
    if (!visitKey) continue;

    const visitDate = new Date(`${visitKey}T12:00:00.000Z`);
    const created = new Date(b.created_at);
    const leadDays = calendarDaysBetweenUTC(created, visitDate);

    const daysUntilVisit = calendarDaysBetweenUTC(now, visitDate);

    const workshopName = b.workshop_name ?? "warsztacie";
    const serviceName = b.service_name ?? "usłudze";
    const timeShort = (b.start_time ?? "").slice(0, 5) || "—";

    try {
      // --- Wizyta za 5 dni ---
      if (daysUntilVisit === 5 && leadDays >= 5) {
        const inserted = await tryInsertReminderLog(admin, {
          booking_id: b.id,
          reminder_type: "visit_5_days_before",
          channel: "notification",
        });
        if (inserted) {
          await insertNotificationIfFresh(admin, {
            userId: b.user_id,
            type: "visit_reminder",
            title: "Zbliża się wizyta w warsztacie",
            body: `Za kilka dni masz wizytę w ${workshopName} (${serviceName}). Termin: ${visitKey} o ${timeShort}.`,
            bookingId: b.id,
            workshopId: b.workshop_id,
            payload: { variant: "5d" },
          });
          result.visit5d += 1;
        }

        const emailFresh = await tryInsertReminderLog(admin, {
          booking_id: b.id,
          reminder_type: "visit_5_days_before",
          channel: "email",
        });
        if (emailFresh) {
          await sendBookingReminderEmail({
            to: b.client_email,
            kind: "visit_5_days_before",
            bookingId: b.id,
            workshopName,
            serviceName,
            bookingDate: visitKey,
            startTime: timeShort,
          });
        }
      }

      // --- Wizyta jutro ---
      if (daysUntilVisit === 1 && leadDays >= 1) {
        const inserted = await tryInsertReminderLog(admin, {
          booking_id: b.id,
          reminder_type: "visit_1_day_before",
          channel: "notification",
        });
        if (inserted) {
          await insertNotificationIfFresh(admin, {
            userId: b.user_id,
            type: "visit_reminder",
            title: "Jutro wizyta w warsztacie",
            body: `Jutro (${visitKey}) o ${timeShort} masz wizytę w ${workshopName} — ${serviceName}.`,
            bookingId: b.id,
            workshopId: b.workshop_id,
            payload: { variant: "1d" },
          });
          result.visit1d += 1;
        }

        const emailFresh = await tryInsertReminderLog(admin, {
          booking_id: b.id,
          reminder_type: "visit_1_day_before",
          channel: "email",
        });
        if (emailFresh) {
          await sendBookingReminderEmail({
            to: b.client_email,
            kind: "visit_1_day_before",
            bookingId: b.id,
            workshopName,
            serviceName,
            bookingDate: visitKey,
            startTime: timeShort,
          });
        }
      }

      // --- Po zakończeniu wizyty + margines: pytanie o wykonanie ---
      const endMs = visitEndMs(b);
      if (Number.isFinite(endMs) && now.getTime() >= endMs + COMPLETION_GRACE_MS) {
        const inserted = await tryInsertReminderLog(admin, {
          booking_id: b.id,
          reminder_type: "completion_check",
          channel: "notification",
        });
        if (inserted) {
          await insertNotificationIfFresh(admin, {
            userId: b.user_id,
            type: "completion_check",
            title: "Czy usługa została wykonana?",
            body: `Twoja wizyta w warsztacie ${workshopName} dla usługi ${serviceName} powinna być już zakończona. Potwierdź, czy usługa została wykonana.`,
            bookingId: b.id,
            workshopId: b.workshop_id,
            payload: { actions: ["completed_yes", "completed_no"] },
          });
          result.completionChecks += 1;
        }
      }
    } catch (e) {
      result.errors.push(`${b.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
