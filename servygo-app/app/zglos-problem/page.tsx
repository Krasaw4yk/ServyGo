"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { submitSupportReport } from "@/lib/supportReportsApi";

const REPORT_TYPES = [
  { id: "technical_service", label: "Problem techniczny z Serwisem" },
  { id: "booking", label: "Problem z rezerwacją" },
  { id: "workshop", label: "Problem z warsztatem" },
  { id: "other", label: "Inne" },
] as const;

export default function ZglosProblemPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [user, setUser] = useState<User | null>(null);
  const [reportType, setReportType] = useState<string>(REPORT_TYPES[0].id);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [workshopId, setWorkshopId] = useState("");
  const [legalAck, setLegalAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = window.localStorage.getItem("servygo-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  useEffect(() => {
    if (!mounted || !isSupabaseConfigured || !supabase) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const u = data.user ?? null;
      setUser(u);
      if (u?.email) setEmail(u.email);
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const isDark = theme === "dark";

  const title = useMemo(() => "Zgłoś problem", []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!isSupabaseConfigured || !supabase) {
      setError("Brak konfiguracji Supabase.");
      return;
    }
    const sub = subject.trim();
    const msg = message.trim();
    const em = email.trim();
    if (!sub || !msg || !em) {
      setError("Uzupełnij temat, opis i e-mail kontaktowy.");
      return;
    }
    if (!legalAck) {
      setError("Zaznacz wymagane oświadczenie dotyczące reklamacji naprawy.");
      return;
    }
    setBusy(true);
    try {
      await submitSupportReport({
        user_id: user?.id ?? null,
        email: em,
        report_type: reportType,
        subject: sub,
        message: msg,
        booking_id: bookingId.trim() || null,
        workshop_id: workshopId.trim() || null,
        legal_ack: true,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wysłać zgłoszenia.");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className={`mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex">
            <Image
              src={isDark ? "/servygo-logo-dark-cropped.png" : "/servygo-logo-light-cropped.png"}
              alt="ServyGo"
              width={186}
              height={70}
              className="h-9 w-auto object-contain sm:h-10"
            />
          </Link>
          <Link href="/" className={`text-sm font-semibold underline ${isDark ? "text-blue-300" : "text-blue-700"}`}>
            Strona główna
          </Link>
        </header>

        <article className={`rounded-2xl border p-5 sm:p-6 ${isDark ? "border-zinc-700 bg-zinc-900/75" : "border-blue-200 bg-white/90"}`}>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className={`mt-2 text-sm leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            To zgłoszenie dotyczy problemu z działaniem Serwisu lub zgłoszenia sprawy do administratora w sprawie warsztatu /
            platformy.{" "}
            <strong className={isDark ? "text-zinc-200" : "text-zinc-800"}>
              Nie jest formalną reklamacją jakości naprawy pojazdu
            </strong>{" "}
            — taką reklamację należy kierować bezpośrednio do warsztatu.
          </p>

          {done ? (
            <p className={`mt-6 text-sm font-semibold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
              Dziękujemy — zgłoszenie zostało zapisane. Jeśli podałeś e-mail, możemy się odezwać po analizie sprawy.
            </p>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="mt-6 grid gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Typ zgłoszenia</span>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                >
                  {REPORT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Temat</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Opis</span>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">E-mail kontaktowy</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Numer rezerwacji / ID (opcjonalnie)</span>
                <input
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  placeholder="UUID z „Moje rezerwacje”"
                  className={`rounded-xl border px-3 py-2 font-mono text-xs ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">ID warsztatu (opcjonalnie)</span>
                <input
                  value={workshopId}
                  onChange={(e) => setWorkshopId(e.target.value)}
                  placeholder="UUID warsztatu"
                  className={`rounded-xl border px-3 py-2 font-mono text-xs ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                />
              </label>
              <label className={`flex gap-3 text-sm leading-snug ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                <input
                  type="checkbox"
                  checked={legalAck}
                  onChange={(e) => setLegalAck(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-400"
                />
                <span>
                  Rozumiem, że ServyGo nie rozpatruje reklamacji dotyczących jakości naprawy. Taką reklamację należy kierować
                  bezpośrednio do warsztatu. Zgłoszenie w ServyGo służy do analizy problemu i bezpieczeństwa platformy.
                </span>
              </label>
              {error ? <p className="text-sm font-medium text-orange-600 dark:text-orange-300">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Wysyłanie…" : "Wyślij zgłoszenie"}
              </button>
            </form>
          )}
        </article>
      </main>
    </ServyGoPageShell>
  );
}
