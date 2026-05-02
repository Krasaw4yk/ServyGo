"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
export default function MojeKontoPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setMounted(true);
    const saved = window.localStorage.getItem("servygo-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      router.replace("/?auth=login");
      return;
    }
    let alive = true;
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!alive) return;
      if (sessionData.session?.user) {
        setUser(sessionData.session.user);
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      if (!data.user) {
        router.replace("/?auth=login");
        return;
      }
      setUser(data.user);
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("servygo-theme", theme);
  }, [mounted, theme]);

  if (!mounted || !user) return null;
  const isDark = theme === "dark";

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className={`mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
        <header className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
          <Link href="/" className="inline-flex">
            <Image
              src={isDark ? "/servygo-logo-dark-cropped.png" : "/servygo-logo-light-cropped.png"}
              alt="ServyGo"
              width={192}
              height={72}
              className="h-10 w-auto object-contain sm:h-12"
            />
          </Link>
          <h1 className="text-2xl font-bold">Moje konto</h1>
          <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Zalogowano jako: {user.email ?? "użytkownik"}</p>
        </header>

        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/" className={`rounded-2xl border px-4 py-4 text-sm font-medium ${isDark ? "border-zinc-700 bg-zinc-900/70 hover:bg-zinc-800/80" : "border-blue-200 bg-white/85 hover:bg-blue-50"}`}>
            Przejdź do wyszukiwarki i profilu
          </Link>
          <Link href="/ustawienia" className={`rounded-2xl border px-4 py-4 text-sm font-medium ${isDark ? "border-zinc-700 bg-zinc-900/70 hover:bg-zinc-800/80" : "border-blue-200 bg-white/85 hover:bg-blue-50"}`}>
            Ustawienia
          </Link>
          <Link href="/moj-kalendarz" className={`rounded-2xl border px-4 py-4 text-sm font-medium ${isDark ? "border-zinc-700 bg-zinc-900/70 hover:bg-zinc-800/80" : "border-blue-200 bg-white/85 hover:bg-blue-50"}`}>
            Mój kalendarz
          </Link>
          <Link href="/moje-auta" className={`rounded-2xl border px-4 py-4 text-sm font-medium ${isDark ? "border-zinc-700 bg-zinc-900/70 hover:bg-zinc-800/80" : "border-blue-200 bg-white/85 hover:bg-blue-50"}`}>
            Moje auta
          </Link>
        </section>
      </main>
    </ServyGoPageShell>
  );
}
