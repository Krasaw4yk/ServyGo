"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import BookingConversationModal from "@/components/booking/BookingConversationModal";
import ClientRescheduleModal from "@/components/booking/ClientRescheduleModal";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import ServyGoSubpageNavBar from "@/components/ServyGoSubpageNavBar";
import { dash, parseBookingVehicleData } from "@/lib/bookingSnapshotDisplay";
import { quoteDecisionLabel, notifyWorkshopOwnerQuoteResponded } from "@/lib/bookingQuoteNotifications";
import {
  clientCanRespondToActiveBookingQuote,
  clientRescheduleDecisionPending,
  clientWorkshopReschedulePending,
  normalizeBookingStatus,
  resolveClientBookingBadge,
} from "@/lib/bookingStatusUi";
import {
  clientCancelVisitWithNotice,
  respondToBookingQuote,
  respondToBookingReschedule,
  sendSystemMessage,
} from "@/lib/messagesApi";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { useBookingsRealtimeSync } from "@/lib/useServyGoRealtime";
import { inferEndTime } from "@/lib/bookingAvailability";

type ConversationOpen = {
  row: BookingRow & { pickup: string };
  draftSubject?: string;
  draftBody?: string;
};

type BookingRow = {
  id: string;
  workshop_id: string;
  workshop_name: string | null;
  service_name: string | null;
  service_category: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  price: number | null;
  final_price: number | null;
  quoted_price: number | null;
  current_quote_id: string | null;
  duration_minutes: number | null;
  created_at: string | null;
  quote_note: string | null;
  quote_status: string | null;
  quote_sent_at: string | null;
  vehicle_data: unknown;
  problem_description: string | null;
  proposed_booking_date: string | null;
  proposed_start_time: string | null;
  proposed_end_time: string | null;
  reschedule_reason: string | null;
  reschedule_status: string | null;
  proposed_by: string | null;
  employee_id: string | null;
  /** Uzupełniane po pobraniu z `booking_quotes` (current_quote_id). */
  current_quote_status?: string | null;
};

function formatDate(dateRaw: string | null | undefined) {
  if (!dateRaw) return "—";
  const parsed = new Date(`${dateRaw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateRaw;
  return parsed.toLocaleDateString("pl-PL", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function trimTime(value: string | null | undefined) {
  return (value ?? "").slice(0, 5) || "—";
}

function formatPrice(row: BookingRow) {
  const q = row.quoted_price;
  if (q != null && Number.isFinite(q)) return `${q} zł`;
  if (row.final_price != null && Number.isFinite(row.final_price)) return `${row.final_price} zł`;
  if (row.price != null && Number.isFinite(row.price) && row.price > 0) return `${row.price} zł`;
  return "Do potwierdzenia";
}

function MojeRezerwacjePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = (searchParams.get("highlight") ?? "").trim();
  const chatBookingId = (searchParams.get("chat") ?? "").trim();
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quoteBusyId, setQuoteBusyId] = useState<string | null>(null);
  const [rescheduleBusyId, setRescheduleBusyId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationOpen | null>(null);
  const [cancelModalRow, setCancelModalRow] = useState<(BookingRow & { pickup: string }) | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [rescheduleModalRow, setRescheduleModalRow] = useState<(BookingRow & { pickup: string }) | null>(null);

  const refreshBookings = useCallback(async () => {
    if (!user || !supabase) return;
    const { data, error: queryError } = await supabase
      .from("bookings")
      .select(
        "id, workshop_id, workshop_name, service_name, service_category, booking_date, start_time, end_time, status, price, final_price, quoted_price, current_quote_id, duration_minutes, created_at, quote_note, quote_status, quote_sent_at, vehicle_data, problem_description, proposed_booking_date, proposed_start_time, proposed_end_time, reschedule_reason, reschedule_status, proposed_by, employee_id",
      )
      .eq("user_id", user.id)
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(200);
    if (queryError) {
      setError(queryError.message);
      return;
    }
    let list = (data as BookingRow[] | null) ?? [];
    const quoteIds = [...new Set(list.map((b) => (b.current_quote_id ?? "").trim()).filter(Boolean))] as string[];
    if (quoteIds.length > 0) {
      const { data: qRows, error: qErr } = await supabase.from("booking_quotes").select("id, status").in("id", quoteIds);
      if (qErr) {
        setError(qErr.message);
        return;
      }
      const statusById = new Map((qRows as { id: string; status: string | null }[] | null)?.map((q) => [q.id, q.status]) ?? []);
      list = list.map((b) => {
        const qid = (b.current_quote_id ?? "").trim();
        return { ...b, current_quote_status: qid ? (statusById.get(qid) ?? null) : null };
      });
    }
    setBookings(list);
  }, [user]);

  useEffect(() => {
    setMounted(true);
    const savedTheme = window.localStorage.getItem("servygo-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isSupabaseConfigured || !supabase) {
      router.replace("/?auth=login");
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        router.replace("/?auth=login");
        return;
      }
      setUser(data.user);
    })();
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        return;
      }
      setUser(null);
      router.replace("/?auth=login");
    });
    return () => {
      cancelled = true;
      auth.subscription.unsubscribe();
    };
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted || !user || !supabase) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      await refreshBookings();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, user, refreshBookings]);

  const refreshBookingsRef = useRef(refreshBookings);
  refreshBookingsRef.current = refreshBookings;
  useBookingsRealtimeSync({
    enabled: Boolean(mounted && user && supabase),
    clientUserId: user?.id ?? null,
    onRefresh: () => {
      void refreshBookingsRef.current();
    },
  });

  const isDark = theme === "dark";
  const bookingsWithPickup = useMemo(
    () =>
      bookings.map((row) => {
        const start = trimTime(row.start_time);
        const pickup = row.end_time
          ? trimTime(row.end_time)
          : start !== "—"
            ? inferEndTime(start, row.duration_minutes ?? 60)
            : "—";
        return { ...row, pickup };
      }),
    [bookings],
  );

  useEffect(() => {
    if (!highlightId || loading) return;
    requestAnimationFrame(() => highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [highlightId, loading, bookings.length]);

  useEffect(() => {
    if (!chatBookingId || loading || bookingsWithPickup.length === 0) return;
    const row = bookingsWithPickup.find((x) => x.id === chatBookingId);
    if (!row) return;
    setConversation((prev) => (prev?.row.id === row.id ? prev : { row }));
  }, [chatBookingId, loading, bookingsWithPickup]);

  function closeConversation() {
    setConversation(null);
    if (chatBookingId) router.replace("/moje-rezerwacje", { scroll: false });
  }

  async function handleRescheduleDecision(row: BookingRow & { pickup: string }, accept: boolean) {
    if (!supabase) return;
    setRescheduleBusyId(row.id);
    setError("");
    try {
      await respondToBookingReschedule(row.id, accept);
      const { data: wRow } = await supabase.from("workshops").select("owner_id").eq("id", row.workshop_id).maybeSingle();
      const ownerId = (wRow as { owner_id?: string | null } | null)?.owner_id ?? null;
      if (ownerId) {
        await sendSystemMessage({
          recipientId: ownerId,
          recipientRole: "workshop",
          subject: accept ? "Klient zaakceptował zmianę terminu" : "Klient odrzucił zmianę terminu",
          body: accept
            ? `Klient zaakceptował nowy termin dla usługi „${row.service_name ?? "usługa"}”.`
            : `Klient odrzucił propozycję zmiany terminu dla usługi „${row.service_name ?? "usługa"}”.`,
          relatedBookingId: row.id,
          relatedWorkshopId: row.workshop_id,
        });
      }
      const { data: fresh } = await supabase
        .from("bookings")
        .select(
          "booking_date, start_time, end_time, status, proposed_booking_date, proposed_start_time, proposed_end_time, reschedule_status",
        )
        .eq("id", row.id)
        .maybeSingle();
      if (fresh) {
        const patch = fresh as Partial<BookingRow>;
        setBookings((prev) => prev.map((b) => (b.id === row.id ? { ...b, ...patch } : b)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać decyzji o terminie.");
    } finally {
      setRescheduleBusyId(null);
    }
  }

  async function confirmCancelVisit() {
    if (!cancelModalRow) return;
    setCancelBusy(true);
    setError("");
    try {
      await clientCancelVisitWithNotice(cancelModalRow.id, cancelReasonDraft.trim() || undefined);
      setCancelModalRow(null);
      setCancelReasonDraft("");
      await refreshBookings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zrezygnować z wizyty.");
    } finally {
      setCancelBusy(false);
    }
  }

  async function handleQuoteDecision(row: BookingRow & { pickup: string }, accept: boolean) {
    if (!supabase) return;
    const quoteId = (row.current_quote_id ?? "").trim();
    if (!quoteId) {
      setError("Brak aktywnej wyceny — odśwież stronę.");
      return;
    }
    setQuoteBusyId(row.id);
    setError("");
    try {
      await respondToBookingQuote(row.id, quoteId, accept);
      const { data: wRow } = await supabase
        .from("workshops")
        .select("owner_id, name")
        .eq("id", row.workshop_id)
        .maybeSingle();
      const w = wRow as { owner_id?: string | null; name?: string | null } | null;
      const priceForEmail =
        row.quoted_price != null && Number.isFinite(row.quoted_price)
          ? row.quoted_price
          : row.final_price != null && Number.isFinite(row.final_price)
            ? row.final_price
            : null;
      await notifyWorkshopOwnerQuoteResponded({
        ownerUserId: w?.owner_id ?? null,
        bookingId: row.id,
        workshopId: row.workshop_id,
        workshopName: w?.name ?? row.workshop_name ?? "Warsztat",
        serviceName: row.service_name ?? "Usługa",
        accepted: accept,
        finalPrice: priceForEmail,
      });
      await refreshBookings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać decyzji.");
    } finally {
      setQuoteBusyId(null);
    }
  }

  if (!mounted || !user) return null;

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <ServyGoSubpageNavBar isDark={isDark} />
        <section
          className={`rounded-3xl border p-5 shadow-[0_20px_50px_rgba(37,99,235,0.12)] sm:p-7 ${
            isDark ? "border-blue-500/25 bg-zinc-900/80 text-zinc-100" : "border-blue-200/80 bg-white/90 text-zinc-900"
          }`}
        >
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Moje rezerwacje</h1>
            <p className={`mt-1 text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
              Aktualne i poprzednie wizyty w warsztatach ServyGo.
            </p>
          </div>
        </section>

        {loading ? (
          <div className={`mt-5 rounded-2xl border p-6 text-sm ${isDark ? "border-zinc-700 bg-zinc-900/70 text-zinc-200" : "border-blue-200 bg-white text-zinc-700"}`}>
            Ładowanie rezerwacji...
          </div>
        ) : error ? (
          <div className={`mt-5 rounded-2xl border p-6 text-sm ${isDark ? "border-orange-500/40 bg-orange-500/10 text-orange-200" : "border-orange-200 bg-orange-50 text-orange-700"}`}>
            Nie udało się pobrać rezerwacji: {error}
          </div>
        ) : bookingsWithPickup.length === 0 ? (
          <div className={`mt-5 rounded-2xl border p-6 text-sm ${isDark ? "border-zinc-700 bg-zinc-900/70 text-zinc-200" : "border-blue-200 bg-white text-zinc-700"}`}>
            Nie masz jeszcze żadnych rezerwacji.
          </div>
        ) : (
          <section className="mt-5 space-y-4">
            {bookingsWithPickup.map((row) => {
              const vd = parseBookingVehicleData(row.vehicle_data);
              const stRaw = row.status ?? "";
              const norm = normalizeBookingStatus(stRaw);
              const badge = resolveClientBookingBadge({
                status: row.status,
                quoteStatus: row.quote_status,
                rescheduleStatus: row.reschedule_status,
                proposedBy: row.proposed_by,
                isDark,
              });
              const statusLc = (row.status ?? "").trim().toLowerCase();
              const qidTrim = (row.current_quote_id ?? "").trim();
              const quoteRowSt = (row.current_quote_status ?? "").trim().toLowerCase();
              const canQuoteButtons = clientCanRespondToActiveBookingQuote({
                bookingStatusRaw: row.status,
                currentQuoteId: row.current_quote_id,
                currentQuoteRowStatus: row.current_quote_status,
              });
              const reschedulePending = clientRescheduleDecisionPending(row.status, row.reschedule_status);
              const showAcceptedPrice =
                norm === "confirmed" && row.final_price != null && Number.isFinite(row.final_price);
              const quoteReadonlyNonActionable =
                Boolean(qidTrim) &&
                !canQuoteButtons &&
                (statusLc !== "quote_sent" || (statusLc === "quote_sent" && quoteRowSt !== "active"));
              const quotePanelAccepted = norm === "confirmed" && Boolean(qidTrim) && !canQuoteButtons;
              const hasQuote =
                canQuoteButtons ||
                showAcceptedPrice ||
                (norm === "confirmed" && Boolean(qidTrim)) ||
                (quoteReadonlyNonActionable &&
                  (row.quoted_price != null ||
                    (row.final_price != null && Number.isFinite(row.final_price)) ||
                    (row.quote_note ?? "").trim().length > 0));
              const quoteRejected =
                norm === "quote_rejected" ||
                norm === "awaiting_new_quote" ||
                (row.quote_status ?? "").trim().toLowerCase() === "rejected";
              const problemText = (row.problem_description ?? "").trim();
              const allowContact =
                norm !== "cancelled" && norm !== "completed" && norm !== "done" && norm !== "rejected";
              const awaitingWorkshopOnClientProposal = clientWorkshopReschedulePending(row.reschedule_status, row.proposed_by);
              const allowReschedule =
                allowContact &&
                !canQuoteButtons &&
                !reschedulePending &&
                !awaitingWorkshopOnClientProposal &&
                (norm === "confirmed" || norm === "quote_sent") &&
                statusLc !== "awaiting_reschedule";

              return (
                <article
                  key={row.id}
                  ref={row.id === highlightId ? highlightRef : undefined}
                  className={`rounded-2xl border p-5 shadow-sm ${
                    row.id === highlightId
                      ? isDark
                        ? "border-orange-500/50 ring-2 ring-orange-500/30"
                        : "border-orange-300 ring-2 ring-orange-200"
                      : ""
                  } ${isDark ? "border-zinc-700 bg-zinc-900/75" : "border-blue-200/80 bg-white/95"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{row.workshop_name || "Warsztat"}</h2>
                      <p className={`mt-1 text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{row.service_name || "Usługa"}</p>
                      {row.service_category ? (
                        <p className={`mt-0.5 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Kategoria: {row.service_category}</p>
                      ) : null}
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                    <div>
                      <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Data</p>
                      <p className="font-medium">{formatDate(row.booking_date)}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Godzina</p>
                      <p className="font-medium">{trimTime(row.start_time)}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Przewidywany odbiór</p>
                      <p className="font-medium">{row.pickup}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Cena</p>
                      <p className="font-medium">{formatPrice(row)}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Czas usługi</p>
                      <p className="font-medium">{row.duration_minutes ?? 60} min</p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>ID</p>
                      <p className="font-mono text-xs">{row.id.slice(0, 8)}...</p>
                    </div>
                  </div>

                  <div
                    className={`mt-4 grid gap-3 rounded-xl border p-3 text-sm sm:grid-cols-2 ${
                      isDark ? "border-zinc-700 bg-zinc-950/40" : "border-blue-100 bg-blue-50/40"
                    }`}
                  >
                    <div>
                      <p className={`text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Auto (z zapytania)</p>
                      <p className="mt-1 font-medium">{dash([vd.brand, vd.model].filter(Boolean).join(" "))}</p>
                      <p className={`mt-1 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                        {dash(vd.vehicleType)} · rocznik {dash(vd.year)} · {dash(vd.fuel)}
                      </p>
                      <p className={`mt-1 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>VIN: {dash(vd.vin)}</p>
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Opis problemu</p>
                      <p className={`mt-1 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{problemText || "—"}</p>
                      {!problemText ? (
                        <p className={`mt-1 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Klient nie podał opisu.</p>
                      ) : null}
                    </div>
                  </div>

                  {hasQuote ? (
                    <div
                      className={`mt-4 rounded-xl border p-4 shadow-sm ${
                        quoteRejected
                          ? isDark
                            ? "border-red-500/35 bg-red-950/35"
                            : "border-red-200 bg-red-50/90"
                          : isDark
                            ? "border-emerald-500/25 bg-emerald-950/25"
                            : "border-emerald-200 bg-emerald-50/70"
                      }`}
                    >
                      <p
                        className={`text-xs font-bold uppercase tracking-wide ${
                          quoteRejected
                            ? isDark
                              ? "text-red-200"
                              : "text-red-800"
                            : quotePanelAccepted
                              ? isDark
                                ? "text-emerald-200"
                                : "text-emerald-800"
                              : quoteReadonlyNonActionable && statusLc !== "quote_sent"
                                ? isDark
                                  ? "text-zinc-300"
                                  : "text-zinc-600"
                                : isDark
                                  ? "text-emerald-200"
                                  : "text-emerald-800"
                        }`}
                      >
                        {quoteRejected
                          ? "Wycena warsztatu"
                          : quotePanelAccepted
                            ? "Wycena zaakceptowana"
                            : quoteReadonlyNonActionable && statusLc !== "quote_sent"
                              ? "Wycena (informacja)"
                              : "Wycena warsztatu"}
                      </p>
                      {quotePanelAccepted && !quoteRejected ? (
                        <p className={`mt-1 text-xs font-medium ${isDark ? "text-emerald-100/90" : "text-emerald-900/90"}`}>
                          Wizyta potwierdzona — decyzji o wycenie nie trzeba powtarzać.
                        </p>
                      ) : null}
                      <p
                        className={`mt-2 text-lg font-semibold ${
                          quoteRejected
                            ? isDark
                              ? "text-red-100"
                              : "text-red-900"
                            : isDark
                              ? "text-emerald-100"
                              : "text-emerald-900"
                        }`}
                      >
                        {row.quoted_price != null && Number.isFinite(row.quoted_price)
                          ? `${Number(row.quoted_price).toFixed(2)} zł`
                          : row.final_price != null && Number.isFinite(row.final_price)
                            ? `${Number(row.final_price).toFixed(2)} zł`
                            : "—"}
                      </p>
                      {(row.quote_note ?? "").trim() ? (
                        <p
                          className={`mt-2 whitespace-pre-wrap text-sm ${
                            quoteRejected
                              ? isDark
                                ? "text-red-100/95"
                                : "text-red-950"
                              : isDark
                                ? "text-emerald-100/90"
                                : "text-emerald-950"
                          }`}
                        >
                          {row.quote_note}
                        </p>
                      ) : (
                        <p
                          className={`mt-2 text-xs ${
                            quoteRejected
                              ? isDark
                                ? "text-red-200/75"
                                : "text-red-700/85"
                              : isDark
                                ? "text-emerald-200/70"
                                : "text-emerald-800/80"
                          }`}
                        >
                          Brak dodatkowej wiadomości od warsztatu.
                        </p>
                      )}
                      <p
                        className={`mt-2 text-xs font-medium ${
                          quoteRejected
                            ? isDark
                              ? "text-red-200/90"
                              : "text-red-800"
                            : isDark
                              ? "text-emerald-200/80"
                              : "text-emerald-800/90"
                        }`}
                      >
                        Status decyzji: {quoteDecisionLabel(row.quote_status, row.status)}
                      </p>
                    </div>
                  ) : (
                    <p className={`mt-4 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                      {norm === "pending_quote" ? "Oczekuje na wycenę od warsztatu." : null}
                      {norm === "awaiting_new_quote"
                        ? "Odrzuciłeś ostatnią wycenę — warsztat może wysłać nową propozycję."
                        : null}
                    </p>
                  )}

                  {reschedulePending ? (
                    <div
                      className={`mt-4 rounded-xl border p-4 ${isDark ? "border-amber-500/25 bg-amber-950/20" : "border-yellow-200 bg-yellow-50/80"}`}
                    >
                      <p className={`text-sm font-semibold ${isDark ? "text-amber-100" : "text-yellow-950"}`}>
                        Warsztat zaproponował zmianę terminu
                      </p>
                      <p className={`mt-2 text-sm ${isDark ? "text-amber-100/90" : "text-yellow-950"}`}>
                        Nowy termin: {formatDate(row.proposed_booking_date)} · {trimTime(row.proposed_start_time)}
                        {row.proposed_end_time ? ` – odbiór ok. ${trimTime(row.proposed_end_time)}` : ""}
                      </p>
                      {(row.reschedule_reason ?? "").trim() ? (
                        <p className={`mt-2 whitespace-pre-wrap text-sm ${isDark ? "text-amber-100/85" : "text-yellow-950"}`}>
                          {row.reschedule_reason}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={rescheduleBusyId === row.id}
                          onClick={() => void handleRescheduleDecision(row, true)}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                            isDark ? "bg-emerald-600 hover:bg-emerald-500" : "bg-emerald-600 hover:bg-emerald-500"
                          }`}
                        >
                          Akceptuję nowy termin
                        </button>
                        <button
                          type="button"
                          disabled={rescheduleBusyId === row.id}
                          onClick={() => void handleRescheduleDecision(row, false)}
                          className={`rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                            isDark ? "border-zinc-500 text-zinc-100 hover:bg-zinc-800" : "border-zinc-300 text-zinc-800 hover:bg-zinc-50"
                          }`}
                        >
                          Odrzucam zmianę
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {awaitingWorkshopOnClientProposal ? (
                    <div
                      className={`mt-4 rounded-xl border p-4 ${isDark ? "border-sky-500/25 bg-sky-950/25" : "border-sky-200 bg-sky-50/85"}`}
                    >
                      <p className={`text-sm font-semibold ${isDark ? "text-sky-100" : "text-sky-950"}`}>Oczekujemy na decyzję warsztatu</p>
                      <p className={`mt-2 text-sm ${isDark ? "text-sky-100/90" : "text-sky-950"}`}>
                        Proponowany termin: {formatDate(row.proposed_booking_date)} · {trimTime(row.proposed_start_time)}
                      </p>
                      {(row.reschedule_reason ?? "").trim() ? (
                        <p className={`mt-2 whitespace-pre-wrap text-sm ${isDark ? "text-sky-100/85" : "text-sky-950"}`}>{row.reschedule_reason}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {canQuoteButtons ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={quoteBusyId === row.id}
                        onClick={() => void handleQuoteDecision(row, true)}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                          isDark ? "bg-emerald-600 hover:bg-emerald-500" : "bg-emerald-600 hover:bg-emerald-500"
                        }`}
                      >
                        Akceptuję wycenę
                      </button>
                      <button
                        type="button"
                        disabled={quoteBusyId === row.id}
                        onClick={() => void handleQuoteDecision(row, false)}
                        className={`rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                          isDark ? "border-rose-400/60 text-rose-100 hover:bg-rose-950/40" : "border-rose-300 text-rose-700 hover:bg-rose-50"
                        }`}
                      >
                        Odrzucam
                      </button>
                    </div>
                  ) : null}

                  {allowContact ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCancelReasonDraft("");
                          setCancelModalRow(row);
                        }}
                        className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                          isDark
                            ? "border-rose-500/55 text-rose-100 hover:bg-rose-950/35"
                            : "border-rose-400 text-rose-800 hover:bg-rose-50"
                        }`}
                      >
                        Zrezygnuj z wizyty
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConversation(
                            norm === "pending_quote"
                              ? {
                                  row,
                                  draftSubject: `Pytanie o wycenę — ${row.service_name ?? "usługa"}`,
                                  draftBody: `Dzień dobry,\n\nChciałbym dopytać o wycenę usługi „${row.service_name ?? "usługa"}”.\n\n`,
                                }
                              : { row },
                          )
                        }
                        className={`rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm ${
                          isDark ? "border-blue-500/50 bg-blue-950/20 text-blue-100 hover:bg-blue-950/40" : "border-blue-400 bg-blue-50 text-blue-900 hover:bg-blue-100"
                        }`}
                      >
                        {norm === "pending_quote" ? "Wyślij wiadomość (wycena)" : "Wyślij wiadomość"}
                      </button>
                      {allowReschedule ? (
                        <button
                          type="button"
                          onClick={() => setRescheduleModalRow(row)}
                          className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                            isDark
                              ? "border-orange-400/55 text-orange-100 hover:bg-orange-950/30"
                              : "border-orange-400 bg-white text-orange-900 hover:bg-orange-50"
                          }`}
                        >
                          Przenieś wizytę
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        )}
      </main>

      {cancelModalRow ? (
        <div className="fixed inset-0 z-[10052] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="Zamknij" onClick={() => !cancelBusy && setCancelModalRow(null)} />
          <div
            className={`relative z-[1] w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              isDark ? "border-zinc-600 bg-zinc-900 text-zinc-100" : "border-blue-200 bg-white text-zinc-900"
            }`}
          >
            <h3 className="text-lg font-bold">Zrezygnuj z wizyty</h3>
            <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Czy na pewno chcesz zrezygnować z tej wizyty?</p>
            <label className={`mt-4 block text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              Powód rezygnacji (opcjonalnie)
              <textarea
                value={cancelReasonDraft}
                onChange={(e) => setCancelReasonDraft(e.target.value)}
                rows={3}
                className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm text-black ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                placeholder="Np. zmiana planów…"
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={cancelBusy}
                onClick={() => setCancelModalRow(null)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold ${isDark ? "border-zinc-500 text-zinc-200" : "border-zinc-300 text-zinc-800"}`}
              >
                Nie, wróć
              </button>
              <button
                type="button"
                disabled={cancelBusy}
                onClick={() => void confirmCancelVisit()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {cancelBusy ? "Zapisywanie…" : "Tak, rezygnuję"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rescheduleModalRow && user ? (
        <ClientRescheduleModal
          bookingId={rescheduleModalRow.id}
          workshopId={rescheduleModalRow.workshop_id}
          workshopName={rescheduleModalRow.workshop_name || "Warsztat"}
          serviceLabel={rescheduleModalRow.service_name || "Usługa"}
          durationMinutes={rescheduleModalRow.duration_minutes ?? 60}
          employeeId={rescheduleModalRow.employee_id}
          defaultDateKey={rescheduleModalRow.booking_date}
          isDark={isDark}
          onClose={() => setRescheduleModalRow(null)}
          onSuccess={() => void refreshBookings()}
        />
      ) : null}

      {conversation && user ? (
        <BookingConversationModal
          key={`${conversation.row.id}-${conversation.draftBody ?? ""}-${conversation.draftSubject ?? ""}`}
          bookingId={conversation.row.id}
          workshopName={conversation.row.workshop_name || "Warsztat"}
          serviceName={conversation.row.service_name || "Usługa"}
          userId={user.id}
          isDark={isDark}
          onClose={closeConversation}
        />
      ) : null}
    </ServyGoPageShell>
  );
}

export default function MojeRezerwacjePage() {
  return (
    <Suspense fallback={null}>
      <MojeRezerwacjePageContent />
    </Suspense>
  );
}

