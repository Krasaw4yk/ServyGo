"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export default function UstawHasloPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isSupabaseConfigured || !supabase) {
      setChecking(false);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError("Brak aktywnej sesji. Otwórz ponownie link z e-maila.");
      }
      setChecking(false);
    });
  }, [mounted]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!supabase) return;
    if (password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }
    if (password !== password2) {
      setError("Hasła nie są takie same.");
      return;
    }
    setLoading(true);
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) throw upErr;
      setInfo("Hasło zostało ustawione. Możesz przejść do panelu warsztatu.");
      router.replace("/workshop-panel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać hasła.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <p className="text-sm">Ładowanie…</p>
      </main>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm">Brak konfiguracji Supabase.</p>
        <Link href="/" className="mt-4 inline-block text-blue-600 underline">
          Strona główna
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Ustaw hasło</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Twoje konto ServyGo zostało utworzone lub odświeżone. Ustaw hasło, aby zalogować się do panelu warsztatu.
      </p>
      {checking ? <p className="mt-6 text-sm">Sprawdzanie sesji…</p> : null}
      {!checking ? (
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Nowe hasło
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="block text-sm font-medium">
            Powtórz hasło
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
          {info ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{info}</p> : null}
          <button
            type="submit"
            disabled={loading || checking}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Zapisywanie…" : "Zapisz hasło"}
          </button>
        </form>
      ) : null}
      <Link href="/" className="mt-8 text-center text-sm text-blue-600 underline dark:text-blue-400">
        Strona główna
      </Link>
    </main>
  );
}
