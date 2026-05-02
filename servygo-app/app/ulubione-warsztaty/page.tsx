"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import ServyGoSubpageNavBar from "@/components/ServyGoSubpageNavBar";
import { fetchUserFavoriteWorkshops, isWorkshopStatusPublicVisible } from "@/lib/favoriteWorkshopsDb";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export default function UlubioneWarsztatyPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<{ favoriteId: string; id: string; name: string; city: string; address: string }>>(
    [],
  );
  const [error, setError] = useState("");

  const isDark = mounted ? theme === "dark" : false;

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setMounted(true);
      const th = window.localStorage.getItem("servygo-theme");
      if (th === "light" || th === "dark") setTheme(th);
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("servygo-theme", theme);
  }, [mounted, theme]);

  const load = useCallback(async (uid: string) => {
    if (!supabase) return;
    const raw = await fetchUserFavoriteWorkshops(supabase, uid);
    setRows(
      raw
        .filter((r) => isWorkshopStatusPublicVisible(r.workshop.status))
        .map((r) => ({
          favoriteId: r.favoriteId,
          id: r.workshop.id,
          name: r.workshop.name,
          city: (r.workshop.city ?? "").trim() || "—",
          address: (r.workshop.address ?? "").trim() || "—",
        })),
    );
  }, []);

  useEffect(() => {
    if (!mounted || !isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    let c = false;
    void (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (c) return;
      if (!data.user) {
        setUser(null);
        setRows([]);
        setLoading(false);
        return;
      }
      setUser(data.user);
      try {
        await load(data.user.id);
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się wczytać listy.");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [mounted, load]);

  if (!mounted) {
    return (
      <ServyGoPageShell isDark={false}>
        <main className="min-h-[40vh]" />
      </ServyGoPageShell>
    );
  }

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className={`mx-auto min-h-screen max-w-3xl px-4 py-6 sm:py-8 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
        <ServyGoSubpageNavBar isDark={isDark} />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Ulubione warsztaty</h1>
          <button
            type="button"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${isDark ? "border-zinc-600" : "border-blue-200"}`}
          >
            {isDark ? "☀️ Jasny" : "🌙 Ciemny"}
          </button>
        </div>
        <Link href="/" className={`mb-6 inline-block text-sm font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>
          ← Strona główna
        </Link>

        {!user ? (
          <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            <Link href="/?auth=login" className="font-semibold text-blue-600 underline dark:text-blue-300">
              Zaloguj się
            </Link>
            , aby zobaczyć ulubione warsztaty.
          </p>
        ) : loading ? (
          <p className="text-sm opacity-80">Wczytywanie…</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        ) : rows.length === 0 ? (
          <p className={`rounded-2xl border p-6 text-sm ${isDark ? "border-zinc-700 bg-zinc-900/80" : "border-blue-100 bg-white"}`}>
            Nie masz jeszcze żadnych ulubionych warsztatów. Dodaj je serduszkiem na stronie warsztatu.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((w) => (
              <li
                key={w.favoriteId}
                className={`rounded-2xl border p-4 sm:p-5 ${isDark ? "border-zinc-700 bg-zinc-900/80" : "border-blue-100 bg-white shadow-sm"}`}
              >
                <h2 className="text-lg font-semibold">{w.name}</h2>
                <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{w.city}</p>
                <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{w.address}</p>
                <p className={`mt-2 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                  Oceny i opinie: wkrótce w ServyGo (brak danych w profilu).
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Link
                    href={`/warsztat/${w.id}`}
                    className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2 text-center text-sm font-semibold ${
                      isDark ? "border-blue-400/50 text-blue-200" : "border-blue-300 text-blue-800"
                    }`}
                  >
                    Zobacz szczegóły
                  </Link>
                  <Link
                    href={`/?favoriteWorkshopId=${encodeURIComponent(w.id)}`}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-orange-500 px-4 py-2 text-center text-sm font-semibold text-white"
                  >
                    Umów wizytę
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </ServyGoPageShell>
  );
}
