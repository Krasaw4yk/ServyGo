"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createTranslator, LanguageCode } from "@/lib/translations";
import type { MockWorkshop } from "@/lib/mockWorkshops";
import { fetchPublicWorkshopsAsMock } from "@/lib/publicWorkshopsFromDb";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import { trackEvent } from "@/lib/analytics";

type ViewMode = "list" | "map";

export default function OffersPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<LanguageCode>("pl");
  const [loading, setLoading] = useState(true);
  const [workshops, setWorkshops] = useState<MockWorkshop[]>([]);
  const [offersError, setOffersError] = useState("");
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [queryFilters, setQueryFilters] = useState({
    city: "",
    service: "",
    brand: "",
    model: "",
    year: "",
    engine: "",
    vin: "",
    firstName: "",
    lastName: "",
  });

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMounted(true);
      const savedTheme = window.localStorage.getItem("servygo-theme");
      const savedLanguage = window.localStorage.getItem("servygo_language");
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      if (savedLanguage === "pl" || savedLanguage === "en" || savedLanguage === "ua") {
        setLanguage(savedLanguage);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void trackEvent("page_view", { page: "/oferty" });
  }, [mounted]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setOffersError("");
      try {
        const list = await fetchPublicWorkshopsAsMock();
        if (!cancelled) setWorkshops(list);
      } catch (err) {
        if (!cancelled) {
          setOffersError(err instanceof Error ? err.message : "Nie udało się wczytać warsztatów.");
          setWorkshops([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("servygo-theme", theme);
  }, [mounted, theme]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      setQueryFilters({
        city: (params.get("city") ?? "").trim().toLowerCase(),
        service: (params.get("service") ?? "").trim().toLowerCase(),
        brand: (params.get("brand") ?? "").trim().toLowerCase(),
        model: (params.get("model") ?? "").trim().toLowerCase(),
        year: (params.get("year") ?? "").trim().toLowerCase(),
        engine: (params.get("engine") ?? "").trim().toLowerCase(),
        vin: (params.get("vin") ?? "").trim().toUpperCase().slice(0, 17),
        firstName: (params.get("firstName") ?? "").trim(),
        lastName: (params.get("lastName") ?? "").trim(),
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const t = useMemo(() => createTranslator(language), [language]);
  const isDark = mounted ? theme === "dark" : false;

  const exactMatches = useMemo(() => {
    const parsedYear = Number.parseInt(queryFilters.year, 10);
    const yearFilter = Number.isFinite(parsedYear) ? parsedYear : null;

    return workshops
      .map((workshop) => {
        const matchingServices = workshop.services.filter((service) => {
          const cityMatch =
            !queryFilters.city || workshop.city.toLowerCase().includes(queryFilters.city);
          const serviceMatch =
            !queryFilters.service ||
            service.service_name.toLowerCase().includes(queryFilters.service);
          const brandMatch =
            !queryFilters.brand || service.brand.toLowerCase().includes(queryFilters.brand);
          const modelMatch =
            !queryFilters.model || service.model.toLowerCase().includes(queryFilters.model);
          const yearMatch =
            !yearFilter || (service.year_from <= yearFilter && service.year_to >= yearFilter);
          const engineMatch =
            !queryFilters.engine || service.engine.toLowerCase().includes(queryFilters.engine);

          return cityMatch && serviceMatch && brandMatch && modelMatch && yearMatch && engineMatch;
        });
        return { ...workshop, services: matchingServices };
      })
      .filter((workshop) => workshop.services.length > 0);
  }, [queryFilters, workshops]);

  const cityFallbackMatches = useMemo(() => {
    if (exactMatches.length > 0 || !queryFilters.city) {
      return [];
    }
    return workshops
      .filter((workshop) => workshop.city.toLowerCase().includes(queryFilters.city))
      .map((workshop) => ({
        ...workshop,
        services: workshop.services.length > 0 ? [workshop.services[0]] : [],
      }))
      .filter((workshop) => workshop.services.length > 0);
  }, [exactMatches, queryFilters.city, workshops]);

  const filteredWorkshops = exactMatches.length > 0 ? exactMatches : cityFallbackMatches;
  const hasFallback = exactMatches.length === 0 && cityFallbackMatches.length > 0;
  const resultsDesktopHeightClass = hasFallback
    ? "md:h-[calc(100vh-300px)]"
    : "md:h-[calc(100vh-260px)]";

  const activeSelectedWorkshopId = selectedWorkshopId ?? filteredWorkshops[0]?.id ?? null;

  const latMin = Math.min(...filteredWorkshops.map((w) => w.lat), 49);
  const latMax = Math.max(...filteredWorkshops.map((w) => w.lat), 53);
  const lngMin = Math.min(...filteredWorkshops.map((w) => w.lng), 14);
  const lngMax = Math.max(...filteredWorkshops.map((w) => w.lng), 24);

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className="min-h-screen px-3 py-6 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1680px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <Link href="/" className="inline-flex items-center">
            <Image
              src={isDark ? "/servygo-logo-dark-cropped.png" : "/servygo-logo-light-cropped.png"}
              alt="ServyGo"
              width={192}
              height={72}
              className="h-10 w-auto object-contain sm:h-12"
            />
          </Link>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className="inline-flex w-full justify-center rounded-xl border border-blue-300/60 px-3 py-2 text-sm font-semibold transition hover:border-orange-300 sm:w-auto sm:px-4"
            >
              {theme === "dark" ? "☀️" : "🌙"} {theme === "dark" ? t("header.themeLight") : t("header.themeDark")}
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`w-full rounded-xl px-3 py-2 text-sm font-semibold ${
              viewMode === "list"
                ? "bg-blue-600 text-white"
                : isDark
                  ? "bg-zinc-900/70 text-zinc-200"
                  : "bg-white text-zinc-700"
            }`}
          >
            {t("offers.showList")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`w-full rounded-xl px-3 py-2 text-sm font-semibold ${
              viewMode === "map"
                ? "bg-blue-600 text-white"
                : isDark
                  ? "bg-zinc-900/70 text-zinc-200"
                  : "bg-white text-zinc-700"
            }`}
          >
            {t("offers.showMap")}
          </button>
        </div>

        {hasFallback ? (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
              isDark
                ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
                : "border-orange-200 bg-orange-50 text-orange-700"
            }`}
          >
            {t("offers.noExactMatch")}
          </div>
        ) : null}

        {offersError ? (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
              isDark ? "border-rose-400/40 bg-rose-500/10 text-rose-100" : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            {offersError}
          </div>
        ) : null}

        {loading ? (
          <div className={`grid grid-cols-1 gap-4 md:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)] ${resultsDesktopHeightClass}`}>
            <div className={`h-[640px] animate-pulse rounded-2xl ${isDark ? "bg-zinc-800" : "bg-slate-200"} md:h-full`} />
            <div className={`h-[640px] animate-pulse rounded-2xl ${isDark ? "bg-zinc-800" : "bg-slate-200"} md:h-full`} />
          </div>
        ) : filteredWorkshops.length === 0 ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              isDark
                ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
                : "border-orange-200 bg-orange-50 text-orange-700"
            }`}
          >
            {t("offers.noResults")}
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-4 md:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)] ${resultsDesktopHeightClass}`}>
            <section className={`${viewMode === "map" ? "hidden md:block" : "block"}`}>
              <div className="space-y-2 md:h-full md:overflow-y-auto md:pr-1">
                {filteredWorkshops.map((workshop) => {
                  const firstOffer = workshop.services[0];
                  const isSelected = activeSelectedWorkshopId === workshop.id;
                  const detailsParams = new URLSearchParams({
                    city: queryFilters.city || workshop.city,
                    service: queryFilters.service || firstOffer.service_name,
                    brand: queryFilters.brand || firstOffer.brand,
                    model: queryFilters.model || firstOffer.model,
                    year: queryFilters.year || String(firstOffer.year_from),
                    engine: queryFilters.engine || firstOffer.engine,
                    vin: queryFilters.vin || "",
                    firstName: queryFilters.firstName || "",
                    lastName: queryFilters.lastName || "",
                  });
                  return (
                    <article
                      key={workshop.id}
                      onMouseEnter={() => setSelectedWorkshopId(workshop.id)}
                      className={`rounded-2xl border p-3 transition-all md:p-3.5 ${
                        isSelected
                          ? "border-blue-500/60 shadow-[0_0_0_1px_rgba(59,130,246,0.5)]"
                          : isDark
                            ? "border-zinc-700 bg-zinc-900/70"
                            : "border-blue-200 bg-white/80"
                      }`}
                    >
                      <h3 className="break-words text-base font-semibold leading-tight md:text-lg">{workshop.name}</h3>
                      <p className={`mt-0.5 text-xs md:text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                        {workshop.address}
                      </p>
                      <p className={`mt-1 text-xs md:text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                        <strong>⭐ {workshop.rating.toFixed(1)}</strong> ({workshop.reviewsCount}{" "}
                        {t("offers.reviews")})
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs leading-snug md:text-sm sm:grid-cols-2">
                        <p><strong>{t("offers.price")}:</strong> {firstOffer.price} zł</p>
                        <p><strong>{t("offers.duration")}:</strong> {firstOffer.duration_minutes} min</p>
                        <p><strong>{t("offers.service")}:</strong> {firstOffer.service_name}</p>
                        <p><strong>{t("offers.nearestSlot")}:</strong> {firstOffer.next_available}</p>
                      </div>
                      <Link
                        href={`/warsztat/${workshop.id}?${detailsParams.toString()}`}
                        onClick={() =>
                          void trackEvent("workshop_click", {
                            workshopId: workshop.id,
                            workshopName: workshop.name,
                            service: firstOffer.service_name,
                            city: workshop.city,
                          })
                        }
                        className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-3 py-2 text-sm font-semibold text-white md:w-auto md:px-4 md:text-sm"
                      >
                        {t("offers.details")}
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className={`${viewMode === "list" ? "hidden md:block" : "block"}`}>
              <div
                className={`relative h-[640px] overflow-hidden rounded-2xl border md:h-full ${
                  isDark
                    ? "border-blue-500/25 bg-gradient-to-br from-zinc-900 to-slate-950"
                    : "border-blue-200 bg-gradient-to-br from-sky-100 via-white to-orange-100"
                }`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.25),transparent_42%),radial-gradient(circle_at_80%_78%,rgba(249,115,22,0.22),transparent_48%)]" />
                <div
                  className={`absolute inset-4 rounded-xl border ${
                    isDark ? "border-white/10 bg-white/5" : "border-blue-100/80 bg-white/40"
                  }`}
                >
                  <div className="h-full w-full bg-[linear-gradient(to_right,rgba(148,163,184,0.25)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.25)_1px,transparent_1px)] bg-[size:28px_28px]" />
                </div>
                {filteredWorkshops.map((workshop) => {
                  const x = ((workshop.lng - lngMin) / Math.max(lngMax - lngMin, 0.01)) * 90 + 5;
                  const y = 95 - ((workshop.lat - latMin) / Math.max(latMax - latMin, 0.01)) * 90;
                  const isSelected = activeSelectedWorkshopId === workshop.id;
                  return (
                    <button
                      key={workshop.id}
                      type="button"
                      onClick={() => setSelectedWorkshopId(workshop.id)}
                      title={workshop.name}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-xs font-semibold shadow-lg transition ${
                        isSelected
                          ? "border-orange-300 bg-orange-500 text-white"
                          : "border-blue-300 bg-blue-600 text-white"
                      }`}
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      ● {workshop.name}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
      </main>
    </ServyGoPageShell>
  );
}
