import { inferEndTime } from "@/lib/bookingAvailability";

/** Normalizes legacy DB statuses to the canonical client-facing model. */
export function normalizeBookingStatus(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "awaiting_quote" || s === "new" || s === "pending") return "pending_quote";
  if (s === "quote_accepted") return "confirmed";
  if (s === "cancelled_by_client" || s === "cancelled_by_workshop" || s === "cancelled_by_system") return "cancelled";
  return s;
}

const TERMINAL_NO_UPCOMING = new Set(["cancelled", "completed", "done", "rejected", "service_not_completed"]);

export type ClientBookingBadge = {
  label: string;
  className: string;
};

/** Badge for homepage / moje-rezerwacje — colors per product spec. */
export function resolveClientBookingBadge(input: {
  status: string | null | undefined;
  quoteStatus?: string | null;
  rescheduleStatus?: string | null;
  proposedBy?: string | null;
  isDark?: boolean;
}): ClientBookingBadge {
  const st = normalizeBookingStatus(input.status);
  const qs = (input.quoteStatus ?? "").trim().toLowerCase();
  const rs = (input.rescheduleStatus ?? "").trim().toLowerCase();
  const pb = (input.proposedBy ?? "").trim().toLowerCase();
  const dark = Boolean(input.isDark);

  if (st === "cancelled") {
    return {
      label: "Anulowana",
      className: dark
        ? "border border-zinc-600 bg-zinc-800/90 text-zinc-200 shadow-sm"
        : "border border-zinc-300 bg-zinc-100 text-zinc-800 shadow-sm",
    };
  }

  if (rs === "pending_client_decision" || st === "awaiting_reschedule") {
    return {
      label: "Propozycja zmiany terminu",
      className: dark
        ? "border border-amber-500/40 bg-amber-500/15 text-amber-100 shadow-sm"
        : "border border-yellow-200 bg-yellow-100 text-yellow-900 shadow-sm",
    };
  }

  if (rs === "pending_workshop_decision" && pb === "client") {
    return {
      label: "Prośba o zmianę terminu",
      className: dark
        ? "border border-sky-500/40 bg-sky-500/15 text-sky-100 shadow-sm"
        : "border border-sky-200 bg-sky-50 text-sky-900 shadow-sm",
    };
  }

  if (st === "quote_rejected") {
    return {
      label: "Wycena odrzucona",
      className: dark
        ? "border border-red-500/45 bg-red-500/15 text-red-100 shadow-sm"
        : "border border-red-200 bg-red-100 text-red-700 shadow-sm",
    };
  }

  if (st === "confirmed") {
    return {
      label: "Potwierdzona",
      className: dark
        ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-100 shadow-sm"
        : "border border-green-200 bg-green-100 text-green-700 shadow-sm",
    };
  }

  if (st === "quote_sent" || qs === "sent" || qs === "pending_client_decision") {
    return {
      label: "Wycena gotowa",
      className: dark
        ? "border border-yellow-500/35 bg-yellow-500/12 text-yellow-100 shadow-sm"
        : "border border-yellow-200 bg-yellow-100 text-yellow-800 shadow-sm",
    };
  }

  if (st === "pending_quote" || !st) {
    return {
      label: "Oczekuje na wycenę",
      className: dark
        ? "border border-orange-500/45 bg-orange-500/15 text-orange-100 shadow-sm"
        : "border border-orange-200 bg-orange-100 text-orange-700 shadow-sm",
    };
  }

  return {
    label: st || "—",
    className: dark
      ? "border border-zinc-600 bg-zinc-800/80 text-zinc-200 shadow-sm"
      : "border border-zinc-200 bg-zinc-50 text-zinc-700 shadow-sm",
  };
}

export function isBookingEligibleForUpcomingCard(status: string | null | undefined): boolean {
  const st = normalizeBookingStatus(status);
  return !TERMINAL_NO_UPCOMING.has(st);
}

/** End of visit in local wall time (ms since epoch). */
export function bookingVisitEndMs(input: {
  bookingDate: string | null | undefined;
  endTime: string | null | undefined;
  startTime: string | null | undefined;
  durationMinutes: number | null | undefined;
}): number | null {
  const date = (input.bookingDate ?? "").trim();
  if (!date) return null;
  const endRaw = (input.endTime ?? "").trim();
  const startRaw = (input.startTime ?? "").trim();
  let hh = "23";
  let mm = "59";
  if (endRaw.length >= 4) {
    const parts = endRaw.slice(0, 8).split(":");
    hh = (parts[0] ?? "23").padStart(2, "0");
    mm = (parts[1] ?? "59").padStart(2, "0");
  } else if (startRaw.length >= 4) {
    const inferred = inferEndTime(startRaw.slice(0, 5), input.durationMinutes ?? 60);
    const parts = inferred.split(":");
    hh = (parts[0] ?? "23").padStart(2, "0");
    mm = (parts[1] ?? "59").padStart(2, "0");
  }
  const isoLocal = `${date}T${hh}:${mm}:00`;
  const t = new Date(isoLocal).getTime();
  return Number.isFinite(t) ? t : null;
}

export type BookingLikeForDashboard = {
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes?: number | null;
  status: string | null;
};

/** Earliest booking whose visit end is still in the future; excludes terminal statuses. */
export function pickDashboardUpcomingBooking<T extends BookingLikeForDashboard>(
  rows: T[],
  now: Date = new Date(),
): T | null {
  const nowMs = now.getTime();
  const candidates = rows
    .filter((r) => r.booking_date && isBookingEligibleForUpcomingCard(r.status))
    .map((r) => ({
      row: r,
      endMs: bookingVisitEndMs({
        bookingDate: r.booking_date,
        endTime: r.end_time,
        startTime: r.start_time,
        durationMinutes: r.duration_minutes ?? 60,
      }),
      sortKey: `${r.booking_date ?? ""} ${(r.start_time ?? "").slice(0, 8)}`,
    }))
    .filter((x) => x.endMs != null && x.endMs > nowMs)
    .sort((a, b) => {
      const ae = a.endMs ?? 0;
      const be = b.endMs ?? 0;
      if (ae !== be) return ae - be;
      return a.sortKey.localeCompare(b.sortKey);
    });
  return candidates[0]?.row ?? null;
}

export function clientQuoteDecisionPending(status: string | null | undefined, quoteStatus: string | null | undefined): boolean {
  const st = normalizeBookingStatus(status);
  const qs = (quoteStatus ?? "").trim().toLowerCase();
  return st === "quote_sent" && (qs === "sent" || qs === "pending_client_decision" || qs === "");
}

export function clientRescheduleDecisionPending(
  status: string | null | undefined,
  rescheduleStatus: string | null | undefined,
): boolean {
  const st = normalizeBookingStatus(status);
  const rs = (rescheduleStatus ?? "").trim().toLowerCase();
  if (st !== "awaiting_reschedule") return false;
  return rs === "pending_client_decision" || rs === "";
}

/** Klient zaproponował nowy termin — warsztat ma zdecydować. */
export function clientWorkshopReschedulePending(
  rescheduleStatus: string | null | undefined,
  proposedBy: string | null | undefined,
): boolean {
  const rs = (rescheduleStatus ?? "").trim().toLowerCase();
  const pb = (proposedBy ?? "").trim().toLowerCase();
  return rs === "pending_workshop_decision" && pb === "client";
}
