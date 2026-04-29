"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import { addAdmin } from "@/lib/adminApi";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export default function MakeMeAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMounted(true);
      const savedTheme = window.localStorage.getItem("servygo-theme");
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("servygo-theme", theme);
  }, [mounted, theme]);

  useEffect(() => {
    async function runPromotion() {
      if (!isSupabaseConfigured || !supabase) {
        setMessage("Brak konfiguracji Supabase.");
        setLoading(false);
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        setMessage("Zaloguj się, aby użyć /make-me-admin.");
        setLoading(false);
        return;
      }

      try {
        const row = await addAdmin(user.id, user.email ?? "");
        if (row) {
          setMessage("Zostałeś adminem");
          setIsSuccess(true);
        } else {
          setMessage("Nie udało się dodać admina. Prawdopodobnie admin_users nie jest pusta.");
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Nie udało się dodać admina.";
        setMessage(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    runPromotion();
  }, []);

  const isDark = mounted ? theme === "dark" : false;

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className={`min-h-screen px-4 py-10 sm:px-6 md:px-10 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-blue-400/25 bg-zinc-900/60 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">Admin Bootstrap</h1>
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className={`inline-flex rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                isDark
                  ? "border-blue-400/50 bg-zinc-900/70 text-zinc-200 hover:border-orange-300"
                  : "border-blue-200 bg-white/80 text-zinc-700 hover:border-orange-300"
              }`}
            >
              {theme === "dark" ? "☀️ Jasny" : "🌙 Ciemny"}
            </button>
          </div>

          <p className={`mt-3 text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Tymczasowy endpoint testowy. Działa tylko gdy tabela `admin_users` jest pusta.
          </p>

          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
              loading
                ? isDark
                  ? "border-blue-400/40 bg-blue-500/10 text-blue-200"
                  : "border-blue-200 bg-blue-50 text-blue-700"
                : isSuccess
                  ? isDark
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : isDark
                    ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
                    : "border-orange-200 bg-orange-50 text-orange-700"
            }`}
          >
            {loading ? "Trwa sprawdzanie uprawnień i próba nadania roli..." : message}
          </div>

          <div className="mt-5">
            <Link
              href="/admin"
              className="inline-flex rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Przejdź do panelu admina
            </Link>
          </div>
        </div>
      </main>
    </ServyGoPageShell>
  );
}
