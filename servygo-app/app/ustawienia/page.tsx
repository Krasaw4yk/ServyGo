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
import { createTranslator, type LanguageCode } from "@/lib/translations";
import { recordUserConsentEvent } from "@/lib/userConsentsApi";
import LegalReacceptanceModal from "@/components/legal/LegalReacceptanceModal";
import { useIsClient } from "@/lib/useIsClient";

type ToggleKey = "email" | "sms" | "reminders" | "promotions";

type SidebarNavItem =
  | { type: "scroll"; label: string; sectionId: string }
  | { type: "link"; label: string; href: string };

const SIDEBAR_NAV: SidebarNavItem[] = [
  { type: "scroll", label: "Ustawienia konta", sectionId: "sec-konto" },
  { type: "link", label: "Moje rezerwacje", href: "/moje-rezerwacje" },
  { type: "link", label: "Moje auta", href: "/moje-auta" },
  { type: "scroll", label: "Bezpieczeństwo", sectionId: "sec-bezpieczenstwo" },
  { type: "link", label: "Moje wiadomości", href: "/moje-wiadomosci" },
  { type: "link", label: "Kalendarz", href: "/moj-kalendarz" },
  { type: "scroll", label: "Prywatność", sectionId: "sec-prywatnosc" },
  { type: "scroll", label: "Usuń konto", sectionId: "sec-usun-konto" },
  { type: "scroll", label: "Pomoc i kontakt", sectionId: "sec-aplikacji" },
];

function sidebarEntryClass(active: boolean) {
  return `block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
    active ? "bg-blue-600 text-white" : "bg-white text-zinc-700 hover:bg-blue-50 hover:text-blue-700"
  }`;
}
type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  marketing_consent: boolean | null;
  marketing_consent_at: string | null;
  pricing_notice_accepted_at: string | null;
  liability_notice_accepted_at: string | null;
  accepted_terms_version: string | null;
  accepted_privacy_version: string | null;
  accepted_pricing_notice_version: string | null;
  accepted_liability_notice_version: string | null;
};

function formatConsentDate(value: string | null | undefined, emptyLabel: string) {
  if (!value) return emptyLabel;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pl-PL");
}

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
  const mounted = useIsClient();
  const theme = useMemo<"light" | "dark">(() => {
    if (!mounted) return "light";
    const savedTheme = window.localStorage.getItem("servygo-theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "light";
  }, [mounted]);
  const language = useMemo<LanguageCode>(() => {
    if (!mounted) return "pl";
    const savedLanguage = window.localStorage.getItem("servygo_language");
    if (savedLanguage === "pl" || savedLanguage === "en" || savedLanguage === "ua") return savedLanguage;
    return "pl";
  }, [mounted]);
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState("");
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [marketingBusy, setMarketingBusy] = useState(false);
  const [marketingMessage, setMarketingMessage] = useState("");
  const [marketingError, setMarketingError] = useState("");

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
          supabase
            .from("profiles")
            .select(
              "first_name, last_name, email, phone, terms_accepted_at, privacy_accepted_at, marketing_consent, marketing_consent_at, pricing_notice_accepted_at, liability_notice_accepted_at, accepted_terms_version, accepted_privacy_version, accepted_pricing_notice_version, accepted_liability_notice_version",
            )
            .eq("id", user.id)
            .maybeSingle(),
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

  useEffect(() => {
    if (!mounted) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    window.requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [mounted]);

  const displayName = useMemo(() => {
    const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
    return full || user?.email || "Użytkownik ServyGo";
  }, [profile?.first_name, profile?.last_name, user?.email]);
  const t = useMemo(() => createTranslator(language), [language]);

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleMarketingConsentChange(nextValue: boolean) {
    if (!supabase || !user || !profile) return;
    const previous = {
      marketing_consent: profile.marketing_consent,
      marketing_consent_at: profile.marketing_consent_at,
    };
    const nextAcceptedAt = nextValue ? new Date().toISOString() : null;
    setMarketingBusy(true);
    setMarketingError("");
    setMarketingMessage("");
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            marketing_consent: nextValue,
            marketing_consent_at: nextAcceptedAt,
          }
        : prev,
    );
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          marketing_consent: nextValue,
          marketing_consent_at: nextAcceptedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;
      try {
        await recordUserConsentEvent({
          userId: user.id,
          consentType: "marketing",
          consentVersion: null,
          action: nextValue ? "accepted" : "revoked",
          source: "account_settings",
          userAgent: typeof window !== "undefined" ? window.navigator.userAgent : null,
        });
      } catch (historyError) {
        const reason = historyError instanceof Error ? historyError.message : String(historyError);
        console.warn("User consent history write failed after marketing change:", reason);
      }
      setMarketingMessage(t("legal.accountSettings.marketingUpdated"));
    } catch (e) {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              marketing_consent: previous.marketing_consent,
              marketing_consent_at: previous.marketing_consent_at,
            }
          : prev,
      );
      setMarketingError(
        e instanceof Error ? e.message : t("legal.accountSettings.marketingUpdateError"),
      );
    } finally {
      setMarketingBusy(false);
    }
  }

  async function handleConfirmDeleteAccount() {
    if (!supabase || !user?.email) return;
    setDeleteError("");
    if (!deleteAck) {
      setDeleteError("Zaznacz potwierdzenie świadomości skutków.");
      return;
    }
    const confirm = deleteEmailConfirm.trim().toLowerCase();
    if (confirm !== user.email.trim().toLowerCase()) {
      setDeleteError("Wpisz dokładnie swój adres e-mail konta.");
      return;
    }
    setDeleteBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      if (!token) {
        setDeleteError("Brak aktywnej sesji — zaloguj się ponownie.");
        setDeleteBusy(false);
        return;
      }
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmationEmail: deleteEmailConfirm.trim() }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setDeleteError(json?.error ?? "Nie udało się usunąć konta.");
        setDeleteBusy(false);
        return;
      }
      await supabase.auth.signOut();
      router.replace("/?accountDeleted=1");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Błąd żądania.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function scrollToSection(sectionId: string, menuLabel: string) {
    setActiveMenu(menuLabel);
    window.history.replaceState(null, "", `#${sectionId}`);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!mounted || !user) return null;
  const isDark = theme === "dark";

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
              {SIDEBAR_NAV.map((entry) => {
                if (entry.type === "link") {
                  return (
                    <Link key={entry.label} href={entry.href} className={sidebarEntryClass(false)}>
                      {entry.label}
                    </Link>
                  );
                }
                const active = activeMenu === entry.label;
                return (
                  <button
                    key={entry.label}
                    type="button"
                    onClick={() => scrollToSection(entry.sectionId, entry.label)}
                    className={sidebarEntryClass(active)}
                  >
                    {entry.label}
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
            <header className="mb-6">
              <div>
                <h1 className="text-3xl font-bold text-zinc-900">Ustawienia</h1>
                <p className="mt-1 text-sm text-zinc-600">Zarządzaj swoim kontem i preferencjami</p>
              </div>
            </header>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article id="sec-konto" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">Dane konta</h2>
                <div className="mt-3 space-y-2 text-sm text-zinc-700">
                  <p>
                    <span className="font-semibold">Imię:</span> {profile?.first_name?.trim() || "—"}
                  </p>
                  <p>
                    <span className="font-semibold">Nazwisko:</span>{" "}
                    {profile?.last_name?.trim() ? profile.last_name.trim() : <span className="text-zinc-500">nie podano (opcjonalne)</span>}
                  </p>
                  <p><span className="font-semibold">E-mail:</span> {profile?.email ?? user.email ?? "—"}</p>
                  <p><span className="font-semibold">Telefon:</span> {profile?.phone ?? "Nie ustawiono"}</p>
                </div>
                <button type="button" className="mt-4 rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                  Edytuj dane
                </button>
              </article>

              <article id="sec-powiadomienia" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">Powiadomienia</h2>
                <div className="mt-3 space-y-2">
                  <SettingToggle checked={toggles.email} onChange={() => setToggles((p) => ({ ...p, email: !p.email }))} label="Powiadomienia e-mail" description="Informacje o zmianach statusu rezerwacji." />
                  <SettingToggle checked={toggles.sms} onChange={() => setToggles((p) => ({ ...p, sms: !p.sms }))} label="Powiadomienia SMS" description="Krótkie alerty o terminach i zmianach." />
                  <SettingToggle checked={toggles.reminders} onChange={() => setToggles((p) => ({ ...p, reminders: !p.reminders }))} label="Przypomnienia o wizytach" description="Przypomnienia przed zaplanowaną wizytą." />
                  <SettingToggle checked={toggles.promotions} onChange={() => setToggles((p) => ({ ...p, promotions: !p.promotions }))} label="Oferty i promocje" description="Rabaty i specjalne oferty ServyGo." />
                </div>
              </article>

              <article id="sec-bezpieczenstwo" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">Bezpieczeństwo</h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">Zmiana hasła</li>
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">Weryfikacja dwuetapowa</li>
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">Aktywne sesje</li>
                </ul>
              </article>

              <article id="sec-prywatnosc" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">Prywatność</h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">
                    <Link href="/polityka-prywatnosci" className="font-medium text-blue-700 hover:text-orange-600 hover:underline">
                      Polityka prywatności
                    </Link>
                  </li>
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">Zarządzanie danymi</li>
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">Ustawienia prywatności</li>
                </ul>
              </article>

              <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">{t("legal.accountSettings.sectionTitle")}</h2>
                <dl className="mt-3 space-y-3 text-sm">
                  <div className="rounded-xl border border-zinc-200 px-3 py-2">
                    <dt className="font-semibold text-zinc-900">{t("legal.accountSettings.termsTitle")}</dt>
                    <dd className="mt-1 text-zinc-700">
                      {t("legal.accountSettings.acceptedAt")}: {formatConsentDate(profile?.terms_accepted_at, t("legal.accountSettings.missing"))}
                    </dd>
                    <dd className="text-zinc-600">{t("legal.accountSettings.version")}: {profile?.accepted_terms_version?.trim() || "—"}</dd>
                    <dd className="mt-1">
                      <Link href="/regulamin" className="font-medium text-blue-700 hover:text-orange-600 hover:underline">
                        {t("legal.accountSettings.viewTerms")}
                      </Link>
                    </dd>
                  </div>

                  <div className="rounded-xl border border-zinc-200 px-3 py-2">
                    <dt className="font-semibold text-zinc-900">{t("legal.accountSettings.privacyTitle")}</dt>
                    <dd className="mt-1 text-zinc-700">
                      {t("legal.accountSettings.acceptedAt")}: {formatConsentDate(profile?.privacy_accepted_at, t("legal.accountSettings.missing"))}
                    </dd>
                    <dd className="text-zinc-600">{t("legal.accountSettings.version")}: {profile?.accepted_privacy_version?.trim() || "—"}</dd>
                    <dd className="mt-1">
                      <Link href="/polityka-prywatnosci" className="font-medium text-blue-700 hover:text-orange-600 hover:underline">
                        {t("legal.accountSettings.viewPrivacy")}
                      </Link>
                    </dd>
                  </div>

                  <div className="rounded-xl border border-zinc-200 px-3 py-2">
                    <dt className="font-semibold text-zinc-900">{t("legal.accountSettings.pricingTitle")}</dt>
                    <dd className="mt-1 text-zinc-700">
                      {t("legal.accountSettings.acceptedAt")}: {formatConsentDate(profile?.pricing_notice_accepted_at, t("legal.accountSettings.missing"))}
                    </dd>
                    <dd className="text-zinc-600">{t("legal.accountSettings.version")}: {profile?.accepted_pricing_notice_version?.trim() || "—"}</dd>
                  </div>

                  <div className="rounded-xl border border-zinc-200 px-3 py-2">
                    <dt className="font-semibold text-zinc-900">{t("legal.accountSettings.liabilityTitle")}</dt>
                    <dd className="mt-1 text-zinc-700">
                      {t("legal.accountSettings.acceptedAt")}: {formatConsentDate(profile?.liability_notice_accepted_at, t("legal.accountSettings.missing"))}
                    </dd>
                    <dd className="text-zinc-600">{t("legal.accountSettings.version")}: {profile?.accepted_liability_notice_version?.trim() || "—"}</dd>
                  </div>

                  <div className="rounded-xl border border-zinc-200 px-3 py-2">
                    <dt className="font-semibold text-zinc-900">{t("legal.accountSettings.marketingTitle")}</dt>
                    <dd className="mt-1 text-zinc-700">
                      {t("legal.accountSettings.status")}: {profile?.marketing_consent ? t("legal.accountSettings.enabled") : t("legal.accountSettings.disabled")}
                    </dd>
                    <dd className="text-zinc-600">
                      {t("legal.accountSettings.marketingLastConsentAt")}: {formatConsentDate(profile?.marketing_consent_at, t("legal.accountSettings.missing"))}
                    </dd>
                    <label className="mt-3 flex items-start gap-2 text-zinc-800">
                      <input
                        type="checkbox"
                        checked={Boolean(profile?.marketing_consent)}
                        disabled={marketingBusy}
                        onChange={(event) => void handleMarketingConsentChange(event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-400"
                      />
                      <span>{t("legal.accountSettings.marketingToggleLabel")}</span>
                    </label>
                    {marketingMessage ? <p className="mt-2 text-xs text-emerald-700">{marketingMessage}</p> : null}
                    {marketingError ? <p className="mt-2 text-xs text-rose-700">{marketingError}</p> : null}
                  </div>
                </dl>
              </article>

              <article id="sec-auta" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">Moje auta</h2>
                <p className="mt-2 text-sm text-zinc-600">Masz zapisanych {vehiclesCount} aut. Zarządzaj nimi i dodawaj kolejne.</p>
                <Link href="/moje-auta" className="mt-4 inline-flex rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                  Zarządzaj autami
                </Link>
              </article>

              <article id="sec-rezerwacje" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">Moje rezerwacje</h2>
                <p className="mt-2 text-sm text-zinc-600">Masz {bookingsCount} rezerwacji. Sprawdź swoje aktualne i poprzednie wizyty.</p>
                <Link href="/moje-rezerwacje" className="mt-4 inline-flex rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                  Zobacz rezerwacje
                </Link>
              </article>

              <article id="sec-kalendarz" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">Kalendarz wizyt</h2>
                <p className="mt-2 text-sm text-zinc-600">
                  Przeglądaj zaplanowane terminy w wygodnym widoku kalendarza — ta sama lista co na stronie konta.
                </p>
                <Link href="/moj-kalendarz" className="mt-4 inline-flex rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                  Otwórz kalendarz
                </Link>
              </article>

              <article id="sec-usun-konto" className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-rose-900">Usuń konto</h2>
                <p className="mt-2 text-sm leading-relaxed text-rose-950/90">
                  Usunięcie konta spowoduje utratę dostępu do profilu, pojazdów, historii wiadomości i rezerwacji. Część danych może być
                  przechowywana przez czas wymagany do obsługi rezerwacji, bezpieczeństwa, roszczeń lub obowiązków prawnych.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteModalOpen(true);
                    setDeleteError("");
                  }}
                  className="mt-4 rounded-xl border border-rose-600 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Usuń konto
                </button>
              </article>
            </div>

            <article id="sec-aplikacji" className="mt-5 scroll-mt-28 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 p-5 text-white shadow-[0_18px_38px_rgba(37,99,235,0.35)]">
              <h3 className="text-lg font-semibold">Potrzebujesz pomocy?</h3>
              <p className="mt-1 text-sm text-blue-50">Skontaktuj się z naszym zespołem supportu — odpowiadamy zwykle w ciągu 24h.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/#kontakt"
                  className="rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/30"
                  title="Strona główna — sekcja Pomoc; FAQ otwierasz przyciskiem na stronie"
                >
                  FAQ
                </Link>
                <Link
                  href="/#kontakt"
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  title="Strona główna — sekcja Pomoc; kontakt przyciskiem „Skontaktuj się z nami”"
                >
                  Kontakt
                </Link>
                <Link href="/zglos-problem" className="rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-white">
                  Zgłoś problem
                </Link>
              </div>
            </article>

            {deleteModalOpen ? (
              <div className="fixed inset-0 z-[10060] flex items-end justify-center sm:items-center sm:p-6">
                <button
                  type="button"
                  aria-label="Zamknij"
                  className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                  onClick={() => !deleteBusy && setDeleteModalOpen(false)}
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  className="relative z-[1] w-full max-w-md rounded-t-2xl border border-rose-200 bg-white p-5 shadow-2xl sm:rounded-2xl"
                >
                  <h3 className="text-lg font-bold text-zinc-900">Potwierdź usunięcie konta</h3>
                  <p className="mt-2 text-sm text-zinc-600">
                    Wpisz swój adres e-mail <span className="font-mono font-semibold">{user.email}</span>, aby potwierdzić operację.
                  </p>
                  <input
                    value={deleteEmailConfirm}
                    onChange={(e) => setDeleteEmailConfirm(e.target.value)}
                    placeholder="E-mail konta"
                    className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <label className="mt-3 flex gap-2 text-sm text-zinc-700">
                    <input type="checkbox" checked={deleteAck} onChange={(e) => setDeleteAck(e.target.checked)} className="mt-1 h-4 w-4" />
                    Rozumiem, że tej operacji nie można łatwo cofnąć.
                  </label>
                  {deleteError ? <p className="mt-2 text-sm text-rose-700">{deleteError}</p> : null}
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={deleteBusy}
                      onClick={() => setDeleteModalOpen(false)}
                      className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold"
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      disabled={deleteBusy}
                      onClick={() => void handleConfirmDeleteAccount()}
                      className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {deleteBusy ? "Trwa…" : "Potwierdź usunięcie"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <LegalReacceptanceModal
              userId={user?.id ?? null}
              language={language}
              isDark={isDark}
            />
          </section>
        </div>
      </main>
    </ServyGoPageShell>
  );
}
