"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { inferEndTime } from "@/lib/bookingAvailability";

type BookingRow = {
  id: string;
  workshop_name: string | null;
  service_name: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  price: number | null;
  final_price: number | null;
  duration_minutes: number | null;
  created_at: string | null;
};

function statusLabel(statusRaw: string | null | undefined) {
  const status = (statusRaw ?? "").trim().toLowerCase();
  if (status === "awaiting_quote") return "Oczekuje na wycenę";
  if (status === "quote_sent") return "Wycena wysłana";
  if (status === "quote_accepted") return "Wycena zaakceptowana";
  if (status === "quote_rejected") return "Wycena odrzucona";
  if (status === "confirmed") return "Potwierdzona";
  if (status === "awaiting_reschedule") return "Oczekuje na zmianę terminu";
  if (status === "cancelled" || status === "cancelled_by_client" || status === "cancelled_by_workshop") return "Anulowana";
  if (status === "completed" || status === "done") return "Zakończona";
  if (status === "new" || status === "pending") return "Nowa";
  return statusRaw || "Nieznany";
}

function statusClass(statusRaw: string | null | undefined, isDark: boolean) {
  const status = (statusRaw ?? "").trim().toLowerCase();
  if (status.includes("cancel")) return isDark ? "border-red-500/30 bg-red-500/15 text-red-200" : "border-red-200 bg-red-50 text-red-700";
  if (status === "confirmed" || status === "quote_accepted") return isDark ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "completed" || status === "done") return isDark ? "border-slate-500/30 bg-slate-500/15 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700";
  return isDark ? "border-blue-500/30 bg-blue-500/15 text-blue-100" : "border-blue-200 bg-blue-50 text-blue-700";
}

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
  if (row.final_price != null && Number.isFinite(row.final_price)) return `${row.final_price} zł`;
  if (row.price != null && Number.isFinite(row.price) && row.price > 0) return `${row.price} zł`;
  return "Do potwierdzenia";
}

export default function MojeRezerwacjePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      const { data, error: queryError } = await supabase
        .from("bookings")
        .select("id, workshop_name, service_name, booking_date, start_time, end_time, status, price, final_price, duration_minutes, created_at")
        .eq("user_id", user.id)
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setBookings([]);
      } else {
        setBookings((data as BookingRow[] | null) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, user]);

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

  if (!mounted || !user) return null;

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section
          className={`rounded-3xl border p-5 shadow-[0_20px_50px_rgba(37,99,235,0.12)] sm:p-7 ${
            isDark ? "border-blue-500/25 bg-zinc-900/80 text-zinc-100" : "border-blue-200/80 bg-white/90 text-zinc-900"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">Moje rezerwacje</h1>
              <p className={`mt-1 text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                Aktualne i poprzednie wizyty w warsztatach ServyGo.
              </p>
            </div>
            <Link
              href="/"
              className={`inline-flex rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                isDark ? "border-blue-400/50 text-zinc-100 hover:border-orange-400/70" : "border-blue-300 text-zinc-800 hover:border-orange-400"
              }`}
            >
              Wróć na stronę główną
            </Link>
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
            {bookingsWithPickup.map((row) => (
              <article
                key={row.id}
                className={`rounded-2xl border p-5 shadow-sm ${
                  isDark ? "border-zinc-700 bg-zinc-900/75" : "border-blue-200/80 bg-white/95"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{row.workshop_name || "Warsztat"}</h2>
                    <p className={`mt-1 text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{row.service_name || "Usługa"}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(row.status, isDark)}`}>
                    {statusLabel(row.status)}
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
              </article>
            ))}
          </section>
        )}
      </main>
    </ServyGoPageShell>
  );
}

