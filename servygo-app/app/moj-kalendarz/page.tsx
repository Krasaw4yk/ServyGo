"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import ServyGoSubpageNavBar from "@/components/ServyGoSubpageNavBar";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { useIsClient } from "@/lib/useIsClient";
import {
  deleteUserCalendarEvent,
  insertUserCalendarEvent,
  listUserCalendarEvents,
  updateUserCalendarEvent,
  type UserCalendarEventRow,
} from "@/lib/userCalendarEvents";
import { fillTemplate } from "@/lib/fillTemplate";
import { getTranslationNode } from "@/lib/translations";
import { localeTagForLanguage } from "@/lib/dateLocale";
import { useServyGoTranslator } from "@/lib/useServyGoLanguage";
import type { User } from "@supabase/supabase-js";

type CarOpt = { id: string; label: string };
type BookingCalRow = {
  id: string;
  workshop_name: string | null;
  service_name: string | null;
  booking_date: string | null;
  start_time: string | null;
  status: string | null;
  quote_status: string | null;
  duration_minutes: number | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthMatrix(year: number, monthIndex: number): (Date | null)[][] {
  const first = new Date(year, monthIndex, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let r = 0; r < cells.length / 7; r++) rows.push(cells.slice(r * 7, r * 7 + 7));
  return rows;
}

function normalizeBookingStatus(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase().trim();
  if (s.includes("cancel") || s === "quote_rejected") return "cancelled";
  if (s === "confirmed") return "confirmed";
  return "default";
}

function isQuoteRejectedBooking(b: BookingCalRow): boolean {
  const st = (b.status ?? "").toLowerCase().trim();
  if (st === "quote_rejected") return true;
  return (b.quote_status ?? "").toLowerCase().trim() === "rejected";
}

function bookingVisitEndMs(b: BookingCalRow): number {
  const dk = b.booking_date;
  if (!dk) return 0;
  const tm = (b.start_time ?? "09:00").slice(0, 5);
  const [yy, mm, dd] = dk.split("-").map(Number);
  const [hh, mi] = tm.split(":").map(Number);
  const start = new Date(yy, (mm || 1) - 1, dd || 1, hh || 0, mi || 0, 0, 0);
  const dur = b.duration_minutes ?? 60;
  return start.getTime() + Math.max(15, dur) * 60 * 1000;
}

/** Kropka w komórce dnia: zielona = wizyta jeszcze „aktualna”, szara = po czasie lub anulowana, brak = odrzucona wycena */
function bookingDayDotClass(b: BookingCalRow): string | null {
  if (isQuoteRejectedBooking(b)) return null;
  const st = (b.status ?? "").toLowerCase();
  if (st.includes("cancel")) return "bg-zinc-400";
  const ended = bookingVisitEndMs(b);
  if (ended > 0 && Date.now() > ended) return "bg-zinc-400";
  return "bg-emerald-500";
}

export default function MojKalendarzPage() {
  const mounted = useIsClient();
  const theme = useMemo<"light" | "dark">(() => {
    if (!mounted) return "light";
    const st = window.localStorage.getItem("servygo-theme");
    return st === "light" || st === "dark" ? st : "light";
  }, [mounted]);
  const [user, setUser] = useState<User | null>(null);
  const [cursor, setCursor] = useState(() => new Date());
  const [personal, setPersonal] = useState<UserCalendarEventRow[]>([]);
  const [bookings, setBookings] = useState<BookingCalRow[]>([]);
  const [cars, setCars] = useState<CarOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("custom");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formCarId, setFormCarId] = useState<string>("");
  const [formDesc, setFormDesc] = useState("");
  const [formReminder, setFormReminder] = useState("");
  const [formStatus, setFormStatus] = useState<string>("upcoming");
  const [formBusy, setFormBusy] = useState(false);

  const { t, language } = useServyGoTranslator();
  const dateLocaleTag = localeTagForLanguage(language);

  const weekdayLabels = useMemo(() => {
    const raw = getTranslationNode("calendarPage.weekdayShort", language);
    if (Array.isArray(raw)) return raw as string[];
    return getTranslationNode("calendarPage.weekdayShort", "pl") as string[];
  }, [language]);

  const eventTypeOptions = useMemo(
    () => [
      { value: "inspection", label: t("calendarPage.eventTypeInspection") },
      { value: "oil", label: t("calendarPage.eventTypeOil") },
      { value: "trip", label: t("calendarPage.eventTypeTrip") },
      { value: "insurance_oc", label: t("calendarPage.eventTypeInsurance") },
      { value: "tires", label: t("calendarPage.eventTypeTires") },
      { value: "ac_service", label: t("calendarPage.eventTypeAc") },
      { value: "custom", label: t("calendarPage.eventTypeCustom") },
    ],
    [t],
  );

  function bookingCalendarStatusLabel(status: string | null | undefined): string {
    const s = (status ?? "").trim();
    if (!s) return t("commonUi.dash");
    const lower = s.toLowerCase();
    const paths: Record<string, string> = {
      confirmed: "calendarPage.bookingStatus.confirmed",
      quote_sent: "calendarPage.bookingStatus.quoteSent",
      awaiting_quote: "calendarPage.bookingStatus.awaitingQuote",
      pending_quote: "calendarPage.bookingStatus.awaitingQuote",
      quote_rejected: "calendarPage.bookingStatus.quoteRejected",
      service_not_completed: "calendarPage.bookingStatus.serviceNotCompleted",
      cancelled_by_client: "calendarPage.bookingStatus.cancelledByClient",
      cancelled_by_workshop: "calendarPage.bookingStatus.cancelledByWorkshop",
      cancelled_by_system: "calendarPage.bookingStatus.cancelledBySystem",
    };
    return paths[lower] ? t(paths[lower]) : s;
  }

  function personalEventStatusLabel(st: string | null | undefined): string {
    const s = (st ?? "").trim().toLowerCase();
    if (s === "upcoming") return t("calendarPage.statusUpcoming");
    if (s === "completed") return t("calendarPage.statusCompleted");
    if (s === "cancelled") return t("calendarPage.statusCancelled");
    const raw = (st ?? "").trim();
    return raw ? raw.replace(/_/g, " ") : t("commonUi.dash");
  }

  useEffect(() => {
    if (!mounted || !isSupabaseConfigured || !supabase) return;
    void supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, [mounted]);

  const loadAll = useCallback(async () => {
    if (!user || !supabase) return;
    setLoading(true);
    setError("");
    try {
      const [evs, bRows, carRows] = await Promise.all([
        listUserCalendarEvents(user.id),
        supabase
          .from("bookings")
          .select("id, workshop_name, service_name, booking_date, start_time, status, quote_status, duration_minutes")
          .eq("user_id", user.id)
          .order("booking_date", { ascending: true })
          .limit(400),
        supabase.from("cars").select("id, brand, model, year").eq("user_id", user.id),
      ]);
      setPersonal(evs);
      setBookings((bRows.data as BookingCalRow[] | null) ?? []);
      if (bRows.error) throw new Error(bRows.error.message);
      const cdata = (carRows.data as { id: string; brand: string | null; model: string | null; year: number | null }[] | null) ?? [];
      setCars(
        cdata.map((c) => ({
          id: c.id,
          label: [c.brand, c.model].filter(Boolean).join(" ") + (c.year ? ` (${c.year})` : ""),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("calendarPage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadAll());
    return () => window.cancelAnimationFrame(frame);
  }, [loadAll]);

  const isDark = theme === "dark";
  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const grid = useMemo(() => monthMatrix(year, monthIndex), [year, monthIndex]);
  const todayKey = useMemo(() => dateKey(new Date()), []);

  const markersByDay = useMemo(() => {
    const map = new Map<string, { personal: boolean; bookingClasses: string[] }>();
    function bump(day: string, patch: Partial<{ personal: boolean; bookingClasses: string[] }>) {
      const cur = map.get(day) ?? { personal: false, bookingClasses: [] };
      map.set(day, {
        personal: Boolean(patch.personal || cur.personal),
        bookingClasses: [...cur.bookingClasses, ...(patch.bookingClasses ?? [])],
      });
    }
    for (const ev of personal) {
      if ((ev.status ?? "").toLowerCase() === "cancelled") continue;
      bump(ev.event_date, { personal: true });
    }
    for (const b of bookings) {
      const dk = b.booking_date;
      if (!dk) continue;
      const cls = bookingDayDotClass(b);
      if (cls) bump(dk, { bookingClasses: [cls] });
    }
    return map;
  }, [personal, bookings]);

  const upcomingCombined = useMemo(() => {
    const today = dateKey(new Date());
    type Row =
      | { kind: "personal"; sort: string; data: UserCalendarEventRow }
      | { kind: "booking"; sort: string; data: BookingCalRow };
    const rows: Row[] = [];
    for (const ev of personal) {
      const st = (ev.status ?? "").toLowerCase();
      if (st === "cancelled" || st === "completed") continue;
      const sort = `${ev.event_date}T${(ev.event_time ?? "23:59").slice(0, 5)}`;
      if (ev.event_date >= today) rows.push({ kind: "personal", sort, data: ev });
    }
    for (const b of bookings) {
      const dk = b.booking_date;
      if (!dk || dk < today) continue;
      if (isQuoteRejectedBooking(b)) continue;
      const norm = normalizeBookingStatus(b.status);
      if (norm === "cancelled") continue;
      const sort = `${dk}T${(b.start_time ?? "00:00").slice(0, 5)}`;
      rows.push({ kind: "booking", sort, data: b });
    }
    rows.sort((a, b) => a.sort.localeCompare(b.sort));
    return rows.slice(0, 24);
  }, [personal, bookings]);

  const pastPersonal = useMemo(() => {
    const today = dateKey(new Date());
    return personal.filter((e) => e.event_date < today && (e.status ?? "").toLowerCase() !== "cancelled").slice(-12).reverse();
  }, [personal]);

  function openNewEvent(dayKey?: string) {
    setEditingId(null);
    setFormTitle("");
    setFormType("custom");
    setFormDate(dayKey ?? selectedDay ?? todayKey);
    setFormTime("");
    setFormCarId("");
    setFormDesc("");
    setFormReminder("");
    setFormStatus("upcoming");
    setEditorOpen(true);
  }

  function openEdit(ev: UserCalendarEventRow) {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormType(ev.event_type || "custom");
    setFormDate(ev.event_date);
    setFormTime(ev.event_time?.slice(0, 5) ?? "");
    setFormCarId(ev.car_id ?? "");
    setFormDesc(ev.description ?? "");
    setFormReminder(ev.reminder_days_before != null ? String(ev.reminder_days_before) : "");
    setFormStatus(String(ev.status ?? "upcoming"));
    setEditorOpen(true);
  }

  async function saveEvent() {
    if (!user) return;
    const title = formTitle.trim();
    if (!title || !formDate.trim()) {
      setError(t("calendarPage.titleDateRequired"));
      return;
    }
    setFormBusy(true);
    setError("");
    try {
      const reminder = formReminder.trim() === "" ? null : Number.parseInt(formReminder, 10);
      if (reminder != null && !Number.isFinite(reminder)) throw new Error(t("calendarPage.reminderMustBeNumber"));
      if (editingId) {
        await updateUserCalendarEvent(user.id, editingId, {
          title,
          event_type: formType,
          event_date: formDate,
          event_time: formTime.trim() || null,
          car_id: formCarId || null,
          description: formDesc,
          reminder_days_before: reminder,
          status: formStatus,
        });
      } else {
        await insertUserCalendarEvent(user.id, {
          title,
          event_type: formType,
          event_date: formDate,
          event_time: formTime.trim() || null,
          car_id: formCarId || null,
          description: formDesc,
          reminder_days_before: reminder,
          status: formStatus,
        });
      }
      setEditorOpen(false);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("calendarPage.saveFailed"));
    } finally {
      setFormBusy(false);
    }
  }

  async function removeEvent(id: string) {
    if (!user || !window.confirm(t("calendarPage.confirmDeleteEvent"))) return;
    setError("");
    try {
      await deleteUserCalendarEvent(user.id, id);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("calendarPage.deleteFailed"));
    }
  }

  async function quickComplete(ev: UserCalendarEventRow) {
    if (!user) return;
    try {
      await updateUserCalendarEvent(user.id, ev.id, { status: "completed" });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("calendarPage.quickError"));
    }
  }

  if (!mounted) return null;
  if (!isSupabaseConfigured || !supabase) {
    return (
      <ServyGoPageShell isDark={false}>
        <main className="mx-auto max-w-lg px-4 py-6 text-center text-sm">
          <ServyGoSubpageNavBar isDark={false} variant="calendar" />
          <p className="mt-4">{t("auth.errors.supabaseMissing")}</p>
        </main>
      </ServyGoPageShell>
    );
  }
  if (!user) {
    return (
      <ServyGoPageShell isDark={isDark}>
        <main className="mx-auto max-w-lg px-4 py-8">
          <ServyGoSubpageNavBar isDark={isDark} variant="calendar" />
          <div className="mt-8 text-center text-sm">
            <p>{t("calendarPage.loginPrompt")}</p>
            <Link href="/?auth=login" className="mt-4 inline-block text-blue-600 underline">
              {t("calendarPage.loginLink")}
            </Link>
          </div>
        </main>
      </ServyGoPageShell>
    );
  }

  return (
    <ServyGoPageShell isDark={isDark}>
      <main
        className={`mx-auto min-h-screen w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-8 ${
          isDark ? "text-zinc-100" : "text-zinc-900"
        }`}
      >
        <ServyGoSubpageNavBar isDark={isDark} variant="calendar" />
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{t("calendarPage.title")}</h1>
            <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("calendarPage.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/moje-rezerwacje"
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${isDark ? "border-zinc-600 hover:bg-zinc-800" : "border-blue-200 hover:bg-blue-50"}`}
            >
              {t("calendarPage.bookingsLink")}
            </Link>
            <button
              type="button"
              onClick={() => openNewEvent()}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md"
            >
              {t("calendarPage.addEvent")}
            </button>
          </div>
        </header>

        {error ? (
          <p className={`mt-4 rounded-xl border px-3 py-2 text-sm ${isDark ? "border-rose-500/40 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{error}</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
          <section
            className={`flex-1 rounded-3xl border p-4 shadow-[0_16px_48px_rgba(37,99,235,0.1)] sm:p-6 ${
              isDark ? "border-blue-500/20 bg-zinc-900/80" : "border-blue-200/80 bg-white/95"
            }`}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label={t("calendarPage.monthPrevAria")}
                onClick={() => setCursor(new Date(year, monthIndex - 1, 1))}
                className={`rounded-xl border px-3 py-1.5 text-sm ${isDark ? "border-zinc-600" : "border-blue-200"}`}
              >
                ◀
              </button>
              <p className="text-center text-lg font-semibold capitalize">
                {cursor.toLocaleDateString(dateLocaleTag, { month: "long", year: "numeric" })}
              </p>
              <button
                type="button"
                aria-label={t("calendarPage.monthNextAria")}
                onClick={() => setCursor(new Date(year, monthIndex + 1, 1))}
                className={`rounded-xl border px-3 py-1.5 text-sm ${isDark ? "border-zinc-600" : "border-blue-200"}`}
              >
                ▶
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase opacity-70">
              {weekdayLabels.map((w) => (
                <div key={w} className="py-2">
                  {w}
                </div>
              ))}
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm">{t("calendarPage.loadingGrid")}</p>
            ) : (
              <div className="mt-1 grid gap-1">
                {grid.map((week, wi) => (
                  <div key={`w-${wi}`} className="grid grid-cols-7 gap-1">
                    {week.map((cell, ci) => {
                      if (!cell) return <div key={`e-${wi}-${ci}`} className="aspect-square rounded-xl bg-transparent" />;
                      const dk = dateKey(cell);
                      const sel = selectedDay === dk;
                      const isToday = dk === todayKey;
                      const mk = markersByDay.get(dk);
                      return (
                        <button
                          key={dk}
                          type="button"
                          aria-label={fillTemplate(t("calendarPage.dayCellAria"), { day: String(cell.getDate()) })}
                          aria-pressed={sel}
                          onClick={() => setSelectedDay(dk)}
                          className={`relative flex aspect-square flex-col items-center justify-start rounded-xl border pt-1 text-sm transition ${
                            sel
                              ? "border-blue-500 ring-2 ring-blue-400/40"
                              : isDark
                                ? "border-zinc-700 hover:bg-zinc-800"
                                : "border-blue-100 hover:bg-blue-50/80"
                          } ${isToday ? (isDark ? "bg-blue-950/50" : "bg-blue-50") : ""}`}
                        >
                          <span className="font-semibold">{cell.getDate()}</span>
                          <span className="mt-auto mb-1 flex flex-wrap justify-center gap-1 px-0.5">
                            {mk?.personal ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" title={t("calendarPage.dotTitlePersonal")} />
                            ) : null}
                            {mk?.bookingClasses.map((c, i) => (
                              <span
                                key={`${dk}-b-${i}`}
                                className={`h-1.5 w-1.5 rounded-full ${c}`}
                                title={c.includes("emerald") ? t("calendarPage.dotTitleBookingGreen") : t("calendarPage.dotTitleBookingGray")}
                              />
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <div className={`mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" /> {t("calendarPage.legendPersonal")}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" /> {t("calendarPage.legendBookingActive")}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 shrink-0 rounded-full bg-zinc-400" /> {t("calendarPage.legendBookingPast")}
              </span>
              <span className="flex max-w-[280px] items-start gap-1 sm:max-w-none">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full border border-dashed border-zinc-400 bg-transparent" />{" "}
                {t("calendarPage.legendNoDot")}
              </span>
            </div>
          </section>

          <aside className="w-full shrink-0 space-y-4 lg:max-w-md">
            <section className={`rounded-3xl border p-4 sm:p-5 ${isDark ? "border-zinc-700 bg-zinc-900/75" : "border-blue-200 bg-white/95"}`}>
              <h2 className="text-lg font-bold">
                {selectedDay ? fillTemplate(t("calendarPage.dayPanelTitle"), { date: selectedDay }) : t("calendarPage.dayPanelSelectDay")}
              </h2>
              {selectedDay ? (
                <div className="mt-3 space-y-3 text-sm">
                  <button
                    type="button"
                    onClick={() => openNewEvent(selectedDay)}
                    className="w-full rounded-xl bg-blue-600 py-2 font-semibold text-white"
                  >
                    {t("calendarPage.addEventForDay")}
                  </button>
                  {personal
                    .filter((e) => e.event_date === selectedDay)
                    .map((ev) => (
                      <article key={ev.id} className={`rounded-xl border p-3 ${isDark ? "border-zinc-600" : "border-blue-100"}`}>
                        <p className="font-semibold text-blue-600">{ev.title}</p>
                        <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                          {(ev.event_time ?? "").slice(0, 5) || t("calendarPage.noTime")} · {personalEventStatusLabel(ev.status)}
                        </p>
                        {ev.description ? <p className="mt-1 whitespace-pre-wrap opacity-90">{ev.description}</p> : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" onClick={() => openEdit(ev)} className="text-xs font-semibold text-blue-600 underline">
                            {t("commonUi.edit")}
                          </button>
                          <button type="button" onClick={() => void quickComplete(ev)} className="text-xs font-semibold text-emerald-600 underline">
                            {t("calendarPage.markedDone")}
                          </button>
                          <button type="button" onClick={() => void removeEvent(ev.id)} className="text-xs font-semibold text-rose-600 underline">
                            {t("commonUi.delete")}
                          </button>
                        </div>
                      </article>
                    ))}
                  {bookings
                    .filter((b) => b.booking_date === selectedDay)
                    .map((b) => {
                      const rejected = isQuoteRejectedBooking(b);
                      return (
                        <details
                          key={b.id}
                          className={`rounded-xl border p-3 ${isDark ? "border-zinc-600" : "border-orange-100 bg-orange-50/40"}`}
                          open
                        >
                          <summary className={`cursor-pointer list-none font-semibold text-orange-600 [&::-webkit-details-marker]:hidden`}>
                            {t("calendarPage.visitHeading")} · {b.workshop_name ?? t("commonUi.workshopFallback")} ·{" "}
                            {(b.start_time ?? "").slice(0, 5) || t("commonUi.dash")} · {b.service_name ?? t("commonUi.serviceFallback")}
                            <span className={`ml-1 text-xs font-normal ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                              {t("calendarPage.detailsExpand")}
                            </span>
                          </summary>
                          <div className={`mt-3 space-y-1 border-t pt-3 text-xs ${isDark ? "border-zinc-600 text-zinc-300" : "border-orange-200 text-zinc-800"}`}>
                            <p>
                              <span className="font-semibold">{t("calendarPage.workshopColon")}</span> {b.workshop_name ?? t("commonUi.dash")}
                            </p>
                            <p>
                              <span className="font-semibold">{t("calendarPage.serviceColon")}</span> {b.service_name ?? t("commonUi.dash")}
                            </p>
                            <p>
                              <span className="font-semibold">{t("calendarPage.dateColon")}</span> {b.booking_date ?? t("commonUi.dash")}{" "}
                              <span className="font-semibold">{t("calendarPage.timeColon")}</span> {(b.start_time ?? "").slice(0, 5) || t("commonUi.dash")}
                              {b.duration_minutes != null ? (
                                <>
                                  {" "}
                                  <span className="font-semibold">{t("calendarPage.durationColon")}</span> {b.duration_minutes}{" "}
                                  {t("commonUi.minSuffix")}
                                </>
                              ) : null}
                            </p>
                            <p>
                              <span className="font-semibold">{t("calendarPage.statusColon")}</span> {bookingCalendarStatusLabel(b.status)}
                              {rejected ? t("calendarPage.quoteRejectedSuffix") : null}
                            </p>
                            <Link href={`/moje-rezerwacje?highlight=${encodeURIComponent(b.id)}`} className="mt-2 inline-block font-semibold text-blue-600 underline">
                              {t("calendarPage.fullDetailsMessages")}
                            </Link>
                          </div>
                        </details>
                      );
                    })}
                  {!personal.some((e) => e.event_date === selectedDay) &&
                  !bookings.some((b) => b.booking_date === selectedDay) ? (
                    <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>{t("calendarPage.noEntriesDay")}</p>
                  ) : null}
                </div>
              ) : (
                <p className={`mt-2 text-sm ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>{t("calendarPage.hintPickDay")}</p>
              )}
            </section>

            <section className={`rounded-3xl border p-4 sm:p-5 ${isDark ? "border-zinc-700 bg-zinc-900/75" : "border-blue-200 bg-white/95"}`}>
              <h2 className="text-lg font-bold">{t("calendarPage.upcomingTitle")}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {upcomingCombined.length === 0 ? (
                  <li className={isDark ? "text-zinc-500" : "text-zinc-600"}>{t("calendarPage.upcomingEmpty")}</li>
                ) : (
                  upcomingCombined.map((row) =>
                    row.kind === "personal" ? (
                      <li key={`p-${row.data.id}`} className={`rounded-xl border ${isDark ? "border-blue-500/25" : "border-blue-100"}`}>
                        <details className="px-3 py-2">
                          <summary className="cursor-pointer list-none font-semibold text-blue-600 [&::-webkit-details-marker]:hidden">
                            {row.data.title}
                            <span className={`mt-0.5 block text-xs font-normal ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                              {row.data.event_date} {(row.data.event_time ?? "").slice(0, 5)} · {t("commonUi.expand")}
                            </span>
                          </summary>
                          <div className={`mt-2 space-y-2 border-t pt-2 text-xs ${isDark ? "border-blue-500/20 text-zinc-300" : "border-blue-100 text-zinc-800"}`}>
                            {(row.data.description ?? "").trim() ? (
                              <p className="whitespace-pre-wrap">{row.data.description}</p>
                            ) : (
                              <p className={isDark ? "text-zinc-500" : "text-zinc-600"}>{t("calendarPage.noExtraDescription")}</p>
                            )}
                            <button type="button" className="text-xs font-semibold text-blue-600 underline" onClick={() => openEdit(row.data)}>
                              {t("calendarPage.editOwnEvent")}
                            </button>
                          </div>
                        </details>
                      </li>
                    ) : (
                      <li key={`b-${row.data.id}`} className={`rounded-xl border ${isDark ? "border-orange-500/25" : "border-orange-100 bg-orange-50/50"}`}>
                        <details className="px-3 py-2">
                          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                            <span className="font-semibold text-orange-600">{t("calendarPage.visitAtWorkshop")}</span>
                            <span className={`mt-0.5 block text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-900"}`}>
                              {row.data.workshop_name ?? t("commonUi.workshopFallback")}
                            </span>
                            <span className={`block text-xs ${isDark ? "text-zinc-400" : "text-zinc-700"}`}>
                              {row.data.booking_date} {(row.data.start_time ?? "").slice(0, 5)} ·{" "}
                              {row.data.service_name ?? t("commonUi.serviceFallback")}
                            </span>
                            <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{t("calendarPage.detailsExpandShort")}</span>
                          </summary>
                          <div className={`mt-2 space-y-1 border-t pt-2 text-xs ${isDark ? "border-orange-500/20 text-zinc-300" : "border-orange-200 text-zinc-800"}`}>
                            <p>
                              <span className="font-semibold">{t("calendarPage.workshopColon")}</span> {row.data.workshop_name ?? t("commonUi.dash")}
                            </p>
                            <p>
                              <span className="font-semibold">{t("calendarPage.serviceColon")}</span> {row.data.service_name ?? t("commonUi.dash")}
                            </p>
                            <p>
                              <span className="font-semibold">{t("calendarPage.termColon")}</span> {row.data.booking_date}{" "}
                              {(row.data.start_time ?? "").slice(0, 5) || t("commonUi.dash")}
                            </p>
                            <p>
                              <span className="font-semibold">{t("calendarPage.statusColon")}</span> {bookingCalendarStatusLabel(row.data.status)}
                            </p>
                            <Link
                              href={`/moje-rezerwacje?highlight=${encodeURIComponent(row.data.id)}`}
                              className="mt-1 inline-block font-semibold text-blue-600 underline"
                            >
                              {t("calendarPage.seeBookingMessages")}
                            </Link>
                          </div>
                        </details>
                      </li>
                    ),
                  )
                )}
              </ul>
            </section>

            {pastPersonal.length > 0 ? (
              <section className={`rounded-3xl border p-4 opacity-90 sm:p-5 ${isDark ? "border-zinc-700 bg-zinc-900/60" : "border-zinc-200 bg-zinc-50/90"}`}>
                <h2 className="text-lg font-bold">{t("calendarPage.archiveOwn")}</h2>
                <ul className="mt-2 space-y-1 text-xs">
                  {pastPersonal.map((ev) => (
                    <li key={ev.id}>
                      {ev.event_date} · {ev.title}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>

        {editorOpen ? (
          <div className="fixed inset-0 z-[10060] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
            <div
              className={`max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border p-5 shadow-2xl sm:rounded-3xl ${
                isDark ? "border-zinc-600 bg-zinc-900 text-zinc-100" : "border-blue-200 bg-white text-zinc-900"
              }`}
            >
              <h3 className="text-lg font-bold">{editingId ? t("calendarPage.editorEdit") : t("calendarPage.editorNew")}</h3>
              <label className="mt-3 block text-xs font-semibold">{t("calendarPage.fieldTitle")}</label>
              <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-black" />
              <label className="mt-3 block text-xs font-semibold">{t("calendarPage.fieldType")}</label>
              <select value={formType} onChange={(e) => setFormType(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-black">
                {eventTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <label className="mt-3 block text-xs font-semibold">{t("calendarPage.fieldDate")}</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-black" />
              <label className="mt-3 block text-xs font-semibold">{t("calendarPage.fieldTimeOptional")}</label>
              <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-black" />
              <label className="mt-3 block text-xs font-semibold">{t("calendarPage.fieldCarOptional")}</label>
              <select value={formCarId} onChange={(e) => setFormCarId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-black">
                <option value="">{t("commonUi.dash")}</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label || c.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <label className="mt-3 block text-xs font-semibold">{t("calendarPage.fieldDescription")}</label>
              <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-black" />
              <label className="mt-3 block text-xs font-semibold">{t("calendarPage.fieldReminderDays")}</label>
              <input
                value={formReminder}
                onChange={(e) => setFormReminder(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-black"
                placeholder={t("calendarPage.reminderPlaceholder")}
              />
              <label className="mt-3 block text-xs font-semibold">{t("calendarPage.fieldStatus")}</label>
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-black">
                <option value="upcoming">{t("calendarPage.statusUpcoming")}</option>
                <option value="completed">{t("calendarPage.statusCompleted")}</option>
                <option value="cancelled">{t("calendarPage.statusCancelled")}</option>
              </select>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={formBusy} onClick={() => setEditorOpen(false)} className="rounded-xl border px-4 py-2 text-sm">
                  {t("commonUi.cancel")}
                </button>
                <button type="button" disabled={formBusy} onClick={() => void saveEvent()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  {formBusy ? t("commonUi.savingShort") : t("commonUi.save")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </ServyGoPageShell>
  );
}
