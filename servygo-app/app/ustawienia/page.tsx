"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { isAdmin } from "@/lib/adminApi";
import { getUserActiveWorkshop } from "@/lib/workshopApi";

type ToggleKey = "email" | "sms" | "reminders" | "promotions";
type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

function SettingToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-xl border border-blue-100 bg-white px-4 py-3 text-left transition hover:border-blue-300"
    >
      <span>
        <span className="block text-sm font-semibold text-zinc-900">{label}</span>
        <span className="block text-xs text-zinc-500">{description}</span>
      </span>
      <span
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
          checked ? "bg-blue-600" : "bg-zinc-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

export default function UstawieniaPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roleBadge, setRoleBadge] = useState("Użytkownik");
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [activeMenu, setActiveMenu] = useState("Ustawienia konta");
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    email: true,
    sms: false,
    reminders: true,
    promotions: false,
  });

  useEffect(() => {
    setMounted(true);
    const savedTheme = window.localStorage.getItem("servygo-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (!mounted || !isSupabaseConfigured || !supabase) return;
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
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        router.replace("/?auth=login");
      }
    });
    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted || !user || !supabase) return;
    let cancelled = false;
    void (async () => {
      const [{ data: profileRow }, { count: carsCount }, { count: bookings }, adminAccess, activeWorkshop] =
        await Promise.all([
          supabase.from("profiles").select("first_name, last_name, email, phone").eq("id", user.id).maybeSingle(),
          supabase.from("cars").select("id", { head: true, count: "exact" }).eq("user_id", user.id),
          supabase.from("bookings").select("id", { head: true, count: "exact" }).eq("user_id", user.id),
          isAdmin(user.id, user.email ?? null),
          getUserActiveWorkshop(user.id).catch(() => null),
        ]);
      if (cancelled) return;
      setProfile((profileRow as ProfileRow | null) ?? null);
      setVehiclesCount(carsCount ?? 0);
      setBookingsCount(bookings ?? 0);
      if (adminAccess) {
        setRoleBadge("Admin");
      } else if (activeWorkshop) {
        setRoleBadge("Warsztat");
      } else {
        setRoleBadge("Użytkownik");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, user]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("servygo-theme", theme);
  }, [mounted, theme]);

  const displayName = useMemo(() => {
    const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
    return full || user?.email || "Użytkownik ServyGo";
  }, [profile?.first_name, profile?.last_name, user?.email]);

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!mounted || !user) return null;
  const isDark = theme === "dark";

  const sidebarItems = [
    "Ustawienia konta",
    "Moje rezerwacje",
    "Moje pojazdy",
    "Bezpieczeństwo",
    "Powiadomienia",
    "Płatności",
    "Prywatność",
    "Pomoc i kontakt",
    "O aplikacji",
  ];

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className="min-h-screen bg-[radial-gradient(1200px_500px_at_85%_-10%,rgba(37,99,235,0.16),transparent_65%),radial-gradient(900px_420px_at_-8%_105%,rgba(251,146,60,0.16),transparent_70%)] px-3 py-4 sm:px-6 sm:py-7">
        <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-4 lg:flex-row">
          <aside className="w-full rounded-3xl border border-blue-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(37,99,235,0.12)] backdrop-blur-md lg:sticky lg:top-4 lg:w-[330px] lg:self-start">
            <Link href="/" className="inline-flex">
              <Image src="/servygo-logo-light-cropped.png" alt="ServyGo" width={186} height={70} className="h-10 w-auto object-contain" />
            </Link>
            <div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-orange-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                  {displayName[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">{displayName}</p>
                  <p className="truncate text-xs text-zinc-500">{profile?.email ?? user.email ?? "—"}</p>
                </div>
              </div>
              <span className="mt-3 inline-flex rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                {roleBadge}
              </span>
            </div>

            <nav className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1">
              {sidebarItems.map((item) => {
                const active = item === activeMenu;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveMenu(item)}
                    className={`rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                      active
                        ? "bg-blue-600 text-white"
                        : "bg-white text-zinc-700 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Wyloguj się
            </button>
          </aside>

          <section className="w-full rounded-3xl border border-blue-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(37,99,235,0.12)] backdrop-blur-md sm:p-7">
            <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-zinc-900">Ustawienia</h1>
                <p className="mt-1 text-sm text-zinc-600">Zarządzaj swoim kontem i preferencjami</p>
              </div>
              <div className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-blue-600">🔔</div>
            </header>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-zinc-900">Dane konta</h2>
                <div className="mt-3 space-y-2 text-sm text-zinc-700">
                  <p><span className="font-semibold">Imię i nazwisko:</span> {displayName}</p>
                  <p><span className="font-semibold">E-mail:</span> {profile?.email ?? user.email ?? "—"}</p>
                  <p><span className="font-semibold">Telefon:</span> {profile?.phone ?? "Nie ustawiono"}</p>
                </div>
                <button type="button" className="mt-4 rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                  Edytuj dane
                </button>
              </article>

              <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-zinc-900">Powiadomienia</h2>
                <div className="mt-3 space-y-2">
                  <SettingToggle checked={toggles.email} onChange={() => setToggles((p) => ({ ...p, email: !p.email }))} label="Powiadomienia e-mail" description="Informacje o zmianach statusu rezerwacji." />
                  <SettingToggle checked={toggles.sms} onChange={() => setToggles((p) => ({ ...p, sms: !p.sms }))} label="Powiadomienia SMS" description="Krótkie alerty o terminach i zmianach." />
                  <SettingToggle checked={toggles.reminders} onChange={() => setToggles((p) => ({ ...p, reminders: !p.reminders }))} label="Przypomnienia o wizytach" description="Przypomnienia przed zaplanowaną wizytą." />
                  <SettingToggle checked={toggles.promotions} onChange={() => setToggles((p) => ({ ...p, promotions: !p.promotions }))} label="Oferty i promocje" description="Rabaty i specjalne oferty ServyGo." />
                </div>
              </article>

              <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-zinc-900">Bezpieczeństwo</h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">Zmiana hasła</li>
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">Weryfikacja dwuetapowa</li>
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">Aktywne sesje</li>
                </ul>
              </article>

              <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-zinc-900">Prywatność</h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">Polityka prywatności</li>
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">Zarządzanie danymi</li>
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">Ustawienia prywatności</li>
                </ul>
              </article>

              <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-zinc-900">Moje pojazdy</h2>
                <p className="mt-2 text-sm text-zinc-600">Masz zapisanych {vehiclesCount} pojazdów. Zarządzaj nimi i dodawaj kolejne auta.</p>
                <Link href="/moje-konto" className="mt-4 inline-flex rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                  Zarządzaj pojazdami
                </Link>
              </article>

              <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-zinc-900">Moje rezerwacje</h2>
                <p className="mt-2 text-sm text-zinc-600">Masz {bookingsCount} rezerwacji. Sprawdź swoje aktualne i poprzednie wizyty.</p>
                <Link href="/moje-rezerwacje" className="mt-4 inline-flex rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                  Zobacz rezerwacje
                </Link>
              </article>

              <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-zinc-900">Płatności</h2>
                <p className="mt-2 text-sm text-zinc-600">Historia płatności i metody płatności będą dostępne w tej sekcji.</p>
                <button type="button" className="mt-4 rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                  Przegląd płatności
                </button>
              </article>

              <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-zinc-900">Pomoc i kontakt</h2>
                <p className="mt-2 text-sm text-zinc-600">Skontaktuj się z naszym zespołem wsparcia lub odwiedź FAQ.</p>
                <div className="mt-4 flex gap-2">
                  <button type="button" className="rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                    FAQ
                  </button>
                  <button type="button" className="rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                    Kontakt
                  </button>
                </div>
              </article>
            </div>

            <article className="mt-5 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 p-5 text-white shadow-[0_18px_38px_rgba(37,99,235,0.35)]">
              <h3 className="text-lg font-semibold">Potrzebujesz pomocy?</h3>
              <p className="mt-1 text-sm text-blue-50">Skontaktuj się z naszym zespołem supportu — odpowiadamy zwykle w ciągu 24h.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/30">
                  FAQ
                </button>
                <button type="button" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                  Kontakt
                </button>
              </div>
            </article>
          </section>
        </div>
      </main>
    </ServyGoPageShell>
  );
}
