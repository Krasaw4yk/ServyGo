"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
type BookingRow = {
  id: string;
  service_name: string;
  booking_date: string | null;
  date: string;
  start_time: string | null;
  time: string;
  status: string;
};

function statusColor(status: string) {
  const x = status.toLowerCase();
  if (x === "awaiting_quote") return "bg-zinc-500";
  if (x === "quote_sent") return "bg-orange-500";
  if (x === "confirmed") return "bg-emerald-500";
  if (x.includes("cancelled") || x === "quote_rejected") return "bg-rose-500";
  return "bg-blue-500";
}

function statusLabel(status: string) {
  const x = status.toLowerCase();
  if (x === "awaiting_quote") return "Oczekuje na wycenę";
  if (x === "quote_sent") return "Wycena wysłana";
  if (x === "confirmed") return "Potwierdzona";
  if (x.includes("cancelled")) return "Anulowana";
  if (x === "quote_rejected") return "Wycena odrzucona";
  return status;
}

export default function MojeKontoKalendarzPage() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const { data, error: dbError } = await supabase
        .from("bookings")
        .select("id, service_name, booking_date, date, start_time, time, status")
        .eq("user_id", userData.user.id)
        .gte("booking_date", todayKey)
        .in("status", [
          "awaiting_quote",
          "quote_sent",
          "confirmed",
          "cancelled_by_client",
          "cancelled_by_workshop",
          "cancelled_by_system",
          "quote_rejected",
        ])
        .order("booking_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (dbError) {
        setError(dbError.message);
        return;
      }
      setRows((data as BookingRow[] | null) ?? []);
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const row of rows) {
      const key = row.booking_date ?? row.date;
      const current = map.get(key) ?? [];
      current.push(row);
      map.set(key, current);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mój kalendarz</h1>
        <Link href="/moje-konto" className="rounded-lg border px-3 py-1.5 text-sm">Wróć do konta</Link>
      </div>
      {error ? <p className="mb-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="space-y-4">
        {grouped.length === 0 ? (
          <p className="rounded-xl border px-4 py-3 text-sm text-zinc-600">Brak przyszłych rezerwacji.</p>
        ) : (
          grouped.map(([day, dayRows]) => (
            <section key={day} className="rounded-xl border p-4">
              <h2 className="text-lg font-semibold">{day}</h2>
              <div className="mt-3 space-y-2">
                {dayRows.map((row) => (
                  <article key={row.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div>
                      <p className="font-semibold">{row.service_name}</p>
                      <p className="text-zinc-600">{(row.start_time?.slice(0, 5) ?? row.time) || "—"}</p>
                    </div>
                    <span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs text-white ${statusColor(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
