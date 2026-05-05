"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AutocompleteSelect from "@/components/AutocompleteSelect";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import { polishCityOptions } from "@/lib/locationData";
import { sortAlphabetically } from "@/lib/vehicleData";
import { createTranslator, LanguageCode } from "@/lib/translations";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { createWorkshopLead, isValidWorkshopGoogleMapsUrl } from "@/lib/workshopApi";
import { trackEvent } from "@/lib/analytics";
import { LEGAL_VERSIONS } from "@/lib/legalVersions";

const fieldClassName =
  "rounded-xl border border-zinc-600/70 bg-zinc-900/70 px-4 py-3 text-zinc-100 placeholder:text-zinc-400 transition-all duration-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40";

const lightFieldClassName =
  "rounded-xl border border-blue-200/80 bg-slate-100/85 px-4 py-3 text-zinc-900 placeholder:text-zinc-500 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300/60";

type FieldKey =
  | "workshopName"
  | "nip"
  | "phone"
  | "email"
  | "postalCode"
  | "address"
  | "contactPerson"
  | "description"
  | "servicesText"
  | "googleMapsUrl"
  | "message";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatPolishPostalCode(rawDigits: string) {
  const d = rawDigits.slice(0, 5);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}-${d.slice(2)}`;
}

function formatPolishPhone(phoneDigits: string) {
  const d = phoneDigits.slice(0, 9);
  const parts: string[] = [];
  if (d.length > 0) parts.push(d.slice(0, 3));
  if (d.length > 3) parts.push(d.slice(3, 6));
  if (d.length > 6) parts.push(d.slice(6, 9));
  const body = parts.join(" ").trim();
  return body ? `+48 ${body}` : "+48 ";
}

export default function AddWorkshopPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<LanguageCode>("pl");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [workshopName, setWorkshopName] = useState("");
  const [nip, setNip] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [description, setDescription] = useState("");
  const [servicesText, setServicesText] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [message, setMessage] = useState("");
  const [workshopLegalAccepted, setWorkshopLegalAccepted] = useState(false);
  const [workshopDataTruthContactPublicationAccepted, setWorkshopDataTruthContactPublicationAccepted] = useState(false);
  const [workshopPilotAccepted, setWorkshopPilotAccepted] = useState(false);
  const [workshopMarketingConsent, setWorkshopMarketingConsent] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMounted(true);
      const savedTheme = window.localStorage.getItem("servygo-theme");
      const savedLanguage = window.localStorage.getItem("servygo_language");
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      if (savedLanguage === "pl" || savedLanguage === "en" || savedLanguage === "ua") {
        setLanguage(savedLanguage);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("servygo-theme", theme);
  }, [mounted, theme]);

  useEffect(() => {
    if (!mounted) return;
    void trackEvent("page_view", { page: "/dodaj-warsztat" });
  }, [mounted]);

  const isDark = mounted ? theme === "dark" : false;
  const t = useMemo(() => createTranslator(language), [language]);
  const currentFieldClassName = isDark ? fieldClassName : lightFieldClassName;
  const cityOptions = useMemo(
    () => sortAlphabetically(polishCityOptions).map((option) => ({ value: option, label: option })),
    [],
  );

  function validateField(field: FieldKey, value?: string) {
    const v =
      value ??
      ({
        workshopName,
        nip,
        phone,
        email,
        postalCode,
        address,
        contactPerson,
        description,
        servicesText,
        googleMapsUrl,
        message,
      }[field] as string);

    const trimmed = v.trim();

    if (field === "workshopName" && !trimmed) return "Podaj nazwę warsztatu.";
    if (field === "email") {
      if (!trimmed) return "Podaj e-mail kontaktowy.";
      if (!EMAIL_REGEX.test(trimmed)) return "Podaj poprawny adres e-mail.";
    }
    if (field === "nip" && trimmed && !/^\d{10}$/.test(trimmed)) return "NIP musi mieć dokładnie 10 cyfr.";
    if (field === "phone" && trimmed && !/^\d{9}$/.test(trimmed)) return "Numer telefonu musi mieć 9 cyfr po +48.";
    if (field === "postalCode" && trimmed && !/^\d{2}-\d{3}$/.test(trimmed)) return "Kod pocztowy musi mieć format XX-XXX.";
    if (field === "googleMapsUrl") {
      if (!trimmed) return "Wklej link do Google Maps.";
      if (!isValidWorkshopGoogleMapsUrl(trimmed)) return "Podaj poprawny link Google Maps.";
    }
    return "";
  }

  function setFieldValue(field: FieldKey, value: string) {
    const setters: Record<FieldKey, (v: string) => void> = {
      workshopName: setWorkshopName,
      nip: setNip,
      phone: setPhone,
      email: setEmail,
      postalCode: setPostalCode,
      address: setAddress,
      contactPerson: setContactPerson,
      description: setDescription,
      servicesText: setServicesText,
      googleMapsUrl: setGoogleMapsUrl,
      message: setMessage,
    };
    setters[field](value);
    if (submitAttempted || fieldErrors[field]) {
      const err = validateField(field, value);
      setFieldErrors((prev) => ({ ...prev, [field]: err || undefined }));
    }
  }

  function validCheckVisible(field: FieldKey) {
    const valueMap: Record<FieldKey, string> = {
      workshopName,
      nip,
      phone,
      email,
      postalCode,
      address,
      contactPerson,
      description,
      servicesText,
      googleMapsUrl,
      message,
    };
    const val = valueMap[field].trim();
    if (!val) return false;
    return !validateField(field, valueMap[field]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    setError("");
    setInfo("");

    if (!supabase || !isSupabaseConfigured) {
      setError(t("auth.errors.supabaseMissing"));
      return;
    }
    const keys: FieldKey[] = [
      "workshopName",
      "nip",
      "phone",
      "email",
      "postalCode",
      "address",
      "contactPerson",
      "description",
      "servicesText",
      "googleMapsUrl",
      "message",
    ];
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    for (const key of keys) {
      const err = validateField(key);
      if (err) nextErrors[key] = err;
    }
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setError("Popraw oznaczone pola formularza.");
      return;
    }
    if (!workshopLegalAccepted || !workshopDataTruthContactPublicationAccepted || !workshopPilotAccepted) {
      setError("Aby wysłać zgłoszenie warsztatu, zaznacz wymagane zgody.");
      return;
    }

    const mapsTrimmed = googleMapsUrl.trim();
    const acceptedAt = new Date().toISOString();
    const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : null;
    setLoading(true);
    try {
      await createWorkshopLead({
        workshop_name: workshopName.trim(),
        nip: nip.trim() || null,
        phone: phone ? `+48 ${phone}` : null,
        email: email.trim(),
        city: city.trim() || null,
        postal_code: postalCode.trim() || null,
        address: address.trim() || null,
        contact_person: contactPerson.trim() || null,
        description: description.trim() || null,
        message: message.trim() || null,
        services: servicesText.trim() || null,
        google_maps_url: mapsTrimmed,
        terms_accepted_at: acceptedAt,
        privacy_accepted_at: acceptedAt,
        workshop_data_truth_confirmed_at: acceptedAt,
        workshop_contact_consent_at: acceptedAt,
        workshop_publication_consent_at: acceptedAt,
        pilot_terms_accepted_at: acceptedAt,
        marketing_consent: workshopMarketingConsent,
        marketing_consent_at: workshopMarketingConsent ? acceptedAt : null,
        accepted_terms_version: LEGAL_VERSIONS.terms,
        accepted_privacy_version: LEGAL_VERSIONS.privacy,
        accepted_workshop_pilot_version: LEGAL_VERSIONS.workshopPilot,
        consent_user_agent: userAgent,
      });
      setInfo(t("workshop.messages.leadSaved"));
      setWorkshopName("");
      setNip("");
      setPhone("");
      setEmail("");
      setCity("");
      setPostalCode("");
      setAddress("");
      setContactPerson("");
      setDescription("");
      setServicesText("");
      setGoogleMapsUrl("");
      setMessage("");
      setWorkshopLegalAccepted(false);
      setWorkshopDataTruthContactPublicationAccepted(false);
      setWorkshopPilotAccepted(false);
      setWorkshopMarketingConsent(false);
      setFieldErrors({});
      setSubmitAttempted(false);
    } catch (submitError) {
      const saveErrorMessage =
        submitError instanceof Error ? submitError.message : t("workshop.messages.saveError");
      setError(saveErrorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className="min-h-screen px-2 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-4xl">
        <div
          className={`rounded-3xl border p-4 shadow-2xl backdrop-blur-2xl sm:p-8 ${
            isDark
              ? "border-blue-500/25 bg-zinc-900/90"
              : "border-blue-200/85 bg-white/90 shadow-[0_20px_60px_rgba(37,99,235,0.18)]"
          }`}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <Link href="/" className="inline-flex items-center">
              <Image
                src={isDark ? "/servygo-logo-dark-cropped.png" : "/servygo-logo-light-cropped.png"}
                alt="ServyGo"
                width={192}
                height={72}
                className="h-10 w-auto object-contain sm:h-12"
              />
            </Link>
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className="inline-flex w-full justify-center rounded-xl border border-blue-300/60 px-3 py-2 text-sm font-semibold transition hover:border-orange-300 sm:w-auto sm:px-4"
            >
              {theme === "dark" ? "☀️" : "🌙"} {theme === "dark" ? t("header.themeLight") : t("header.themeDark")}
            </button>
          </div>
          <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{t("workshop.addTitle")}</h1>
          <p className={`mb-6 text-sm sm:text-base ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            {t("workshop.leadSubtitle")}
          </p>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium">
                  {t("workshop.fields.name")} {validCheckVisible("workshopName") ? <span className="text-emerald-500">✓</span> : null}
                </span>
                <input
                  value={workshopName}
                  onChange={(event) => setFieldValue("workshopName", event.target.value)}
                  className={currentFieldClassName}
                  placeholder="Np. Auto Serwis Kowalski"
                  required
                />
                {fieldErrors.workshopName ? <p className="text-xs text-rose-500">{fieldErrors.workshopName}</p> : null}
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">
                  {t("workshop.fields.nip")} {validCheckVisible("nip") ? <span className="text-emerald-500">✓</span> : null}
                </span>
                <input
                  value={nip}
                  onChange={(event) => setFieldValue("nip", digitsOnly(event.target.value).slice(0, 10))}
                  className={currentFieldClassName}
                  inputMode="numeric"
                  placeholder="10 cyfr, np. 1234567890"
                />
                {fieldErrors.nip ? <p className="text-xs text-rose-500">{fieldErrors.nip}</p> : null}
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">
                  {t("workshop.fields.phone")} {validCheckVisible("phone") ? <span className="text-emerald-500">✓</span> : null}
                </span>
                <input
                  value={formatPolishPhone(phone)}
                  onChange={(event) => {
                    let d = digitsOnly(event.target.value);
                    if (d.startsWith("48") && d.length > 9) d = d.slice(2);
                    setFieldValue("phone", d.slice(0, 9));
                  }}
                  className={currentFieldClassName}
                  inputMode="numeric"
                  placeholder="+48 123 456 789"
                />
                {fieldErrors.phone ? <p className="text-xs text-rose-500">{fieldErrors.phone}</p> : null}
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">
                  {t("workshop.fields.email")} {validCheckVisible("email") ? <span className="text-emerald-500">✓</span> : null}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setFieldValue("email", event.target.value)}
                  className={currentFieldClassName}
                  placeholder="np. kontakt@warsztat.pl"
                  required
                />
                {fieldErrors.email ? <p className="text-xs text-rose-500">{fieldErrors.email}</p> : null}
              </label>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("workshop.fields.city")}</span>
                <AutocompleteSelect
                  value={city}
                  onChange={setCity}
                  options={cityOptions}
                  placeholder={t("account.placeholders.city")}
                  noResultsText={t("account.placeholders.noResults")}
                  inputClassName={currentFieldClassName}
                  isDark={isDark}
                />
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">
                  {t("workshop.fields.postalCode")} {validCheckVisible("postalCode") ? <span className="text-emerald-500">✓</span> : null}
                </span>
                <input
                  value={postalCode}
                  onChange={(event) => setFieldValue("postalCode", formatPolishPostalCode(digitsOnly(event.target.value)))}
                  className={currentFieldClassName}
                  placeholder="np. 43-300"
                  inputMode="numeric"
                />
                {fieldErrors.postalCode ? <p className="text-xs text-rose-500">{fieldErrors.postalCode}</p> : null}
              </label>
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium">{t("workshop.fields.address")}</span>
                <input
                  value={address}
                  onChange={(event) => setFieldValue("address", event.target.value)}
                  className={currentFieldClassName}
                  placeholder="Np. ul. Cieszyńska 45"
                />
                {fieldErrors.address ? <p className="text-xs text-rose-500">{fieldErrors.address}</p> : null}
              </label>
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium">{t("workshop.fields.contactPerson")}</span>
                <input
                  value={contactPerson}
                  onChange={(event) => setFieldValue("contactPerson", event.target.value)}
                  className={currentFieldClassName}
                  placeholder="Np. Jan Kowalski"
                />
                {fieldErrors.contactPerson ? <p className="text-xs text-rose-500">{fieldErrors.contactPerson}</p> : null}
              </label>
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium">{t("workshop.fields.description")}</span>
                <textarea
                  value={description}
                  onChange={(event) => setFieldValue("description", event.target.value)}
                  className={`${currentFieldClassName} min-h-[120px]`}
                  placeholder="Np. Specjalizujemy się w naprawach silników diesla i szybkiej diagnostyce komputerowej..."
                />
                <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  Opisz swój warsztat — czym się zajmujesz, jakie masz doświadczenie, czym się wyróżniasz.
                </p>
                {fieldErrors.description ? <p className="text-xs text-rose-500">{fieldErrors.description}</p> : null}
              </label>
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium">{t("workshop.fields.services")}</span>
                <textarea
                  value={servicesText}
                  onChange={(event) => setFieldValue("servicesText", event.target.value)}
                  className={`${currentFieldClassName} min-h-[100px]`}
                  placeholder="Np. wymiana oleju, diagnostyka komputerowa, hamulce, klimatyzacja"
                />
                <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  Wymień główne usługi, które oferujesz (oddziel przecinkami).
                </p>
                {fieldErrors.servicesText ? <p className="text-xs text-rose-500">{fieldErrors.servicesText}</p> : null}
              </label>
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium">
                  {t("workshop.fields.googleMapsUrl")} {validCheckVisible("googleMapsUrl") ? <span className="text-emerald-500">✓</span> : null}
                </span>
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  required
                  value={googleMapsUrl}
                  onChange={(event) => setFieldValue("googleMapsUrl", event.target.value)}
                  className={currentFieldClassName}
                  placeholder="https://maps.google.com/..."
                  title={t("workshop.fields.googleMapsUrlTooltip")}
                  aria-describedby="workshop-google-maps-hint"
                />
                <p
                  id="workshop-google-maps-hint"
                  className={`text-xs leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
                >
                  Kliknij swój warsztat w Google Maps i wklej tutaj link.
                </p>
                {fieldErrors.googleMapsUrl ? <p className="text-xs text-rose-500">{fieldErrors.googleMapsUrl}</p> : null}
              </label>
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium">{t("workshop.fields.message")}</span>
                <textarea
                  value={message}
                  onChange={(event) => setFieldValue("message", event.target.value)}
                  className={`${currentFieldClassName} min-h-[120px]`}
                  placeholder="Dodatkowe informacje (opcjonalnie)"
                />
                {fieldErrors.message ? <p className="text-xs text-rose-500">{fieldErrors.message}</p> : null}
              </label>
              <label className={`sm:col-span-2 flex items-start gap-3 text-sm leading-snug ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                <input
                  type="checkbox"
                  checked={workshopLegalAccepted}
                  onChange={(event) => setWorkshopLegalAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-400"
                />
                <span>
                  Akceptuję{" "}
                  <Link href="/regulamin" className={`font-medium underline underline-offset-2 ${isDark ? "text-sky-300 hover:text-orange-200" : "text-blue-700 hover:text-orange-600"}`}>
                    Regulamin
                  </Link>{" "}
                  serwisu ServyGo oraz potwierdzam zapoznanie się z{" "}
                  <Link href="/polityka-prywatnosci" className={`font-medium underline underline-offset-2 ${isDark ? "text-sky-300 hover:text-orange-200" : "text-blue-700 hover:text-orange-600"}`}>
                    Polityką prywatności
                  </Link>
                  .
                </span>
              </label>
              <label className={`sm:col-span-2 flex items-start gap-3 text-sm leading-snug ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                <input
                  type="checkbox"
                  checked={workshopDataTruthContactPublicationAccepted}
                  onChange={(event) => setWorkshopDataTruthContactPublicationAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-400"
                />
                <span>
                  Potwierdzam, że podane dane warsztatu są prawdziwe oraz wyrażam zgodę na kontakt ze strony ServyGo w
                  sprawie zgłoszenia, weryfikacji, utworzenia profilu warsztatu i ewentualnej współpracy. Wyrażam również
                  zgodę na publikację profilu warsztatu w serwisie ServyGo po pozytywnej weryfikacji.
                </span>
              </label>
              <label className={`sm:col-span-2 flex items-start gap-3 text-sm leading-snug ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                <input
                  type="checkbox"
                  checked={workshopPilotAccepted}
                  onChange={(event) => setWorkshopPilotAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-400"
                />
                <span>
                  Rozumiem, że udział w pilotażu ServyGo jest bezpłatny i testowy, ServyGo nie gwarantuje liczby klientów,
                  zapytań ani rezerwacji, a każda ze stron może zakończyć udział w pilotażu w dowolnym momencie.
                </span>
              </label>
              <label className={`sm:col-span-2 flex items-start gap-3 text-sm leading-snug ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                <input
                  type="checkbox"
                  checked={workshopMarketingConsent}
                  onChange={(event) => setWorkshopMarketingConsent(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-400"
                />
                <span>
                  Chcę otrzymywać informacje o rozwoju ServyGo, nowych funkcjach oraz przyszłych warunkach współpracy.
                </span>
              </label>

              {error ? (
                <p
                  className={`sm:col-span-2 rounded-xl border px-3 py-2 text-sm ${
                    isDark
                      ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
                      : "border-orange-200 bg-orange-50 text-orange-700"
                  }`}
                >
                  {error}
                </p>
              ) : null}
              {info ? (
                <p
                  className={`sm:col-span-2 rounded-xl border px-3 py-2 text-sm ${
                    isDark
                      ? "border-blue-400/40 bg-blue-500/10 text-blue-100"
                      : "border-blue-200 bg-blue-50 text-blue-700"
                  }`}
                >
                  {info}
                </p>
              ) : null}
              <div className="sm:col-span-2 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {loading ? t("account.messages.saving") : t("workshop.actions.sendLead")}
                </button>
                <Link
                  href="/"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-blue-300/60 px-5 font-semibold sm:w-auto"
                >
                  {t("header.login")}
                </Link>
              </div>
          </form>
        </div>
      </div>
      </main>
    </ServyGoPageShell>
  );
}
