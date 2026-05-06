"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createTranslator, LanguageCode } from "@/lib/translations";
import type { MockWorkshop } from "@/lib/mockWorkshops";
import { fetchPublicWorkshopsAsMock, matchWorkshopServicesForVehicle } from "@/lib/publicWorkshopsFromDb";
import { resolveAvailableSlotsForWorkshopDay, toLocalDateKey } from "@/lib/bookingAvailability";
import { getApproxCityCenterCoords, haversineDistanceKm } from "@/lib/offersGeo";
import { classifyServiceCategory } from "@/lib/serviceCategoryClassifier";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import MobileBottomSheet from "@/components/MobileBottomSheet";
import { trackEvent } from "@/lib/analytics";
import type { OffersMapMarker } from "@/components/offers/OffersLeafletMap";
import OffersLeafletMapErrorBoundary from "@/components/offers/OffersLeafletMapErrorBoundary";

const OffersLeafletMap = dynamic(() => import("@/components/offers/OffersLeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-blue-200/60 bg-slate-100/80 text-sm text-zinc-600 dark:border-blue-500/25 dark:bg-zinc-900/60 dark:text-zinc-300">
      …
    </div>
  ),
});

type ViewMode = "list" | "map";
type SortKey = "nearest" | "cheapest" | "rating" | "slot";
type AvailFilter = "all" | "today" | "soon";

function normalizeSearchToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPriceRange(priceFrom?: number | null, priceTo?: number | null) {
  if (priceFrom != null && priceTo != null && priceTo >= priceFrom) return `${priceFrom}-${priceTo} zł`;
  if (priceFrom != null) return `od ${priceFrom} zł`;
  if (priceTo != null) return `do ${priceTo} zł`;
  return "Cena po wycenie";
}

function formatDistanceKm(km: number | null) {
  if (km == null || !Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function slotSortRank(label: string, lang: LanguageCode): number {
  const s = (label ?? "").toLowerCase();
  if (s.startsWith("dziś") || (lang === "en" && s.startsWith("today"))) return 0;
  if (s.startsWith("jutro") || (lang === "en" && s.startsWith("tomorrow"))) return 1;
  if (s.startsWith("pojutrze")) return 2;
  if (lang === "ua" && (s.startsWith("сьогодні") || s.startsWith("сегодні"))) return 0;
  if (lang === "ua" && s.startsWith("завтра")) return 1;
  return 5;
}

function priceFromFirstOffer(workshop: MockWorkshop) {
  const o = workshop.services[0];
  if (!o) return 0;
  return o.price_from ?? o.price ?? 0;
}

function displayWord(raw: string) {
  const t = raw.trim();
  if (!t) return "";
  return t.length <= 2 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1);
}

export default function OffersPageClient() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<LanguageCode>("pl");
  const [loading, setLoading] = useState(true);
  const [workshops, setWorkshops] = useState<MockWorkshop[]>([]);
  const [offersError, setOffersError] = useState("");
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortKey, setSortKey] = useState<SortKey>("nearest");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [maxDistanceKm, setMaxDistanceKm] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [availFilter, setAvailFilter] = useState<AvailFilter>("all");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [slotAvailability, setSlotAvailability] = useState<Record<string, { today: boolean; tomorrow: boolean }>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const listCardRefs = useRef<Record<string, HTMLElement | null>>({});

  const [queryFilters, setQueryFilters] = useState({
    city: "",
    cityLabel: "",
    service: "",
    category: "",
    subcategory: "",
    vehicleType: "",
    brand: "",
    model: "",
    year: "",
    engine: "",
    fuel: "",
    problem: "",
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
      const cityRaw = (params.get("city") ?? "").trim();
      const cityNorm = normalizeSearchToken(cityRaw);
      setQueryFilters({
        city: cityNorm,
        cityLabel: cityRaw,
        service: (params.get("service") ?? "").trim(),
        category: (params.get("category") ?? "").trim(),
        subcategory: (params.get("subcategory") ?? "").trim(),
        vehicleType: (params.get("vehicleType") ?? "").trim(),
        brand: (params.get("brand") ?? "").trim().toLowerCase(),
        model: (params.get("model") ?? "").trim().toLowerCase(),
        year: (params.get("year") ?? "").trim().toLowerCase(),
        engine: (params.get("engine") ?? "").trim().toLowerCase(),
        fuel: (params.get("fuel") ?? params.get("engine") ?? "").trim().toLowerCase(),
        problem: (params.get("problem") ?? "").trim(),
        vin: (params.get("vin") ?? "").trim().toUpperCase().slice(0, 17),
        firstName: (params.get("firstName") ?? "").trim(),
        lastName: (params.get("lastName") ?? "").trim(),
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const id = selectedWorkshopId;
    if (!id) return;
    const el = listCardRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedWorkshopId]);

  const t = useMemo(() => createTranslator(language), [language]);
  const isDark = mounted ? theme === "dark" : false;

  const cityCenter = useMemo(
    () => getApproxCityCenterCoords(queryFilters.city || queryFilters.cityLabel),
    [queryFilters.city, queryFilters.cityLabel],
  );

  const exactMatches = useMemo(() => {
    const parsedYear = Number.parseInt(queryFilters.year, 10);
    const yearFilter = Number.isFinite(parsedYear) ? parsedYear : null;

    return workshops
      .map((workshop) => {
        const workshopCityNorm = normalizeSearchToken(workshop.city ?? "");
        const cityMatch =
          !queryFilters.city || workshopCityNorm.includes(queryFilters.city);
        if (!cityMatch) return { ...workshop, services: [] };
        const matchingServices = matchWorkshopServicesForVehicle(workshop.services, {
          service: queryFilters.service,
          vehicleType: queryFilters.vehicleType,
          brand: queryFilters.brand,
          model: queryFilters.model,
          year: yearFilter,
          engine: queryFilters.engine,
          fuel: queryFilters.fuel,
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
      .filter((workshop) => normalizeSearchToken(workshop.city ?? "").includes(queryFilters.city))
      .map((workshop) => ({
        ...workshop,
        services: workshop.services.length > 0 ? [workshop.services[0]] : [],
      }))
      .filter((workshop) => workshop.services.length > 0);
  }, [exactMatches, queryFilters.city, workshops]);

  const baseMatches = exactMatches.length > 0 ? exactMatches : cityFallbackMatches;
  const hasFallback = exactMatches.length === 0 && cityFallbackMatches.length > 0;

  const filteringDebug = useMemo(() => {
    if (process.env.NODE_ENV === "production") return null;
    const reasons = workshops.map((w) => {
      const cityNorm = normalizeSearchToken(w.city ?? "");
      const cityOk = !queryFilters.city || cityNorm.includes(queryFilters.city);
      if (!cityOk) return { workshop: w.name, rejected: "city_mismatch" as const };
      const yearFilter = Number.isFinite(Number.parseInt(queryFilters.year, 10)) ? Number.parseInt(queryFilters.year, 10) : null;
      const svc = matchWorkshopServicesForVehicle(w.services, {
        service: queryFilters.service,
        vehicleType: queryFilters.vehicleType,
        brand: queryFilters.brand,
        model: queryFilters.model,
        year: yearFilter,
        engine: queryFilters.engine,
        fuel: queryFilters.fuel,
      });
      if (svc.length === 0) return { workshop: w.name, rejected: "service_or_vehicle_mismatch" as const };
      return { workshop: w.name, rejected: "passed" as const };
    });
    return {
      params: queryFilters,
      totalBefore: workshops.length,
      afterService: exactMatches.length,
      afterCityFallback: cityFallbackMatches.length,
      finalShown: baseMatches.length,
      reasons,
    };
  }, [workshops, queryFilters, exactMatches.length, cityFallbackMatches.length, baseMatches.length]);

  useEffect(() => {
    if (!filteringDebug) return;
    // Debug tylko w development.
    console.groupCollapsed("[Offers Debug] /oferty filters");
    console.log("query params", filteringDebug.params);
    console.log("workshops before filter", filteringDebug.totalBefore);
    console.log("after service filter", filteringDebug.afterService);
    console.log("after city fallback", filteringDebug.afterCityFallback);
    console.log("final shown", filteringDebug.finalShown);
    console.table(filteringDebug.reasons);
    console.groupEnd();
  }, [filteringDebug]);

  useEffect(() => {
    if (baseMatches.length === 0) {
      setSlotAvailability({});
      setSlotsLoading(false);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    const todayKey = toLocalDateKey(new Date());
    const tomorrowD = new Date();
    tomorrowD.setDate(tomorrowD.getDate() + 1);
    const tomorrowKey = toLocalDateKey(tomorrowD);
    void (async () => {
      const entries = await Promise.all(
        baseMatches.map(async (w) => {
          const dur = w.services[0]?.duration_minutes ?? 60;
          try {
            const todaySlots = await resolveAvailableSlotsForWorkshopDay(w, todayKey, dur);
            const tomorrowSlots = await resolveAvailableSlotsForWorkshopDay(w, tomorrowKey, dur);
            return [w.id, { today: todaySlots.length > 0, tomorrow: tomorrowSlots.length > 0 }] as const;
          } catch {
            return [w.id, { today: false, tomorrow: false }] as const;
          }
        }),
      );
      if (!cancelled) {
        setSlotAvailability(Object.fromEntries(entries));
        setSlotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseMatches]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const w of baseMatches) {
      const o = w.services[0];
      if (!o) continue;
      set.add(classifyServiceCategory(o.service_name).category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pl"));
  }, [baseMatches]);

  const filteredAndSorted = useMemo(() => {
    const maxP = maxPrice.trim() === "" ? null : Number.parseFloat(maxPrice.replace(",", "."));
    const minR = minRating.trim() === "" ? null : Number.parseFloat(minRating.replace(",", "."));
    const maxD = maxDistanceKm.trim() === "" ? null : Number.parseFloat(maxDistanceKm.replace(",", "."));

    let rows = baseMatches.filter((w) => {
      const first = w.services[0];
      if (!first) return false;
      const price = priceFromFirstOffer(w);
      if (maxP != null && Number.isFinite(maxP) && price > maxP) return false;
      if (minR != null && Number.isFinite(minR) && w.rating < minR) return false;
      if (serviceCategory && classifyServiceCategory(first.service_name).category !== serviceCategory) return false;

      const distKm = haversineDistanceKm(cityCenter, { lat: w.lat, lng: w.lng });
      if (maxD != null && Number.isFinite(maxD) && distKm > maxD) return false;

      if (availFilter === "today") {
        if (slotsLoading) return true;
        if (!slotAvailability[w.id]?.today) return false;
      }
      if (availFilter === "soon") {
        if (slotsLoading) return true;
        const a = slotAvailability[w.id];
        if (!a?.today && !a?.tomorrow) return false;
      }
      return true;
    });

    const dist = (w: MockWorkshop) => haversineDistanceKm(cityCenter, { lat: w.lat, lng: w.lng });

    rows = [...rows].sort((a, b) => {
      if (sortKey === "cheapest") return priceFromFirstOffer(a) - priceFromFirstOffer(b);
      if (sortKey === "rating") return b.rating - a.rating || b.reviewsCount - a.reviewsCount;
      if (sortKey === "slot") {
        const sa = a.services[0]?.next_available ?? "";
        const sb = b.services[0]?.next_available ?? "";
        return slotSortRank(sa, language) - slotSortRank(sb, language) || priceFromFirstOffer(a) - priceFromFirstOffer(b);
      }
      return dist(a) - dist(b);
    });

    return rows;
  }, [
    baseMatches,
    availFilter,
    cityCenter,
    language,
    slotAvailability,
    slotsLoading,
    maxDistanceKm,
    maxPrice,
    minRating,
    serviceCategory,
    sortKey,
  ]);

  const activeSelectedWorkshopId = selectedWorkshopId ?? filteredAndSorted[0]?.id ?? null;

  const buildDetailsParams = useCallback(
    (workshop: MockWorkshop) => {
      const firstOffer = workshop.services[0];
      return new URLSearchParams({
        city: queryFilters.cityLabel || queryFilters.city || workshop.city,
        service: queryFilters.service || firstOffer?.service_name || "",
        brand: queryFilters.brand || firstOffer?.brand || "",
        model: queryFilters.model || firstOffer?.model || "",
        year: queryFilters.year || String(firstOffer?.year_from ?? ""),
        engine: queryFilters.engine || firstOffer?.engine || "",
        vin: queryFilters.vin || "",
        firstName: queryFilters.firstName || "",
        lastName: queryFilters.lastName || "",
      });
    },
    [queryFilters],
  );

  const mapMarkers: OffersMapMarker[] = useMemo(() => {
    return filteredAndSorted
      .filter((w) => w.hasMapPin === true)
      .filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lng))
      .map((workshop) => {
        const firstOffer = workshop.services[0];
        const detailsParams = buildDetailsParams(workshop);
        const mapCardAddress = [workshop.city, workshop.address]
          .map((s) => (s ?? "").trim())
          .filter((s) => s && s !== "—")
          .join(" · ");
        return {
          id: workshop.id,
          lat: workshop.lat,
          lng: workshop.lng,
          name: workshop.name,
          address: workshop.address,
          mapCardAddress: mapCardAddress || workshop.address,
          rating: workshop.rating,
          reviewsCount: workshop.reviewsCount,
          priceLabel: formatPriceRange(firstOffer?.price_from, firstOffer?.price_to),
          nearestSlot: firstOffer?.next_available ?? "—",
          detailsHref: `/warsztat/${workshop.id}?${detailsParams.toString()}`,
          selected: activeSelectedWorkshopId === workshop.id,
        };
      });
  }, [activeSelectedWorkshopId, buildDetailsParams, filteredAndSorted]);

  const resultsDesktopHeightClass = hasFallback ? "md:h-[calc(100vh-340px)]" : "md:h-[calc(100vh-300px)]";

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const compareWorkshops = useMemo(
    () => compareIds.map((id) => filteredAndSorted.find((w) => w.id === id)).filter(Boolean) as MockWorkshop[],
    [compareIds, filteredAndSorted],
  );

  const offersFiltersActive = useMemo(() => {
    return (
      maxPrice.trim() !== "" ||
      minRating.trim() !== "" ||
      maxDistanceKm.trim() !== "" ||
      serviceCategory.trim() !== "" ||
      availFilter !== "all"
    );
  }, [maxPrice, minRating, maxDistanceKm, serviceCategory, availFilter]);

  const clearOffersFilters = useCallback(() => {
    setMaxPrice("");
    setMinRating("");
    setMaxDistanceKm("");
    setServiceCategory("");
    setAvailFilter("all");
  }, []);

  const filterFieldClass = `rounded-lg border px-2 py-2 text-base ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`;
  const filterFieldClassSelect = `rounded-lg border px-2 py-2 text-base ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`;

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className="min-h-screen px-2 py-5 sm:px-6 sm:py-8 xl:px-8">
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

          {!loading && baseMatches.length > 0 ? (
            <div className="mb-4 space-y-2">
              <h1 className={`text-lg font-bold sm:text-xl ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
                {t("offers.headline")}
              </h1>
              <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                <span className="font-medium">{t("offers.criteriaPrefix")}</span>{" "}
                {[displayWord(queryFilters.brand), displayWord(queryFilters.model), queryFilters.year, queryFilters.service, queryFilters.cityLabel || queryFilters.city]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {queryFilters.problem ? (
                <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                  {queryFilters.problem.length > 160 ? `${queryFilters.problem.slice(0, 160)}…` : queryFilters.problem}
                </p>
              ) : null}
            </div>
          ) : null}

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

          {!loading && baseMatches.length > 0 ? (
            <>
              <div className="mb-3 md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className={`w-full rounded-xl border px-4 py-3 text-base font-semibold ${
                    offersFiltersActive
                      ? "border-orange-400/60 bg-orange-500/15 text-orange-900 dark:border-orange-400/40 dark:bg-orange-500/10 dark:text-orange-100"
                      : isDark
                        ? "border-zinc-600 bg-zinc-900/70 text-zinc-100"
                        : "border-zinc-300 bg-white text-zinc-800"
                  }`}
                >
                  {offersFiltersActive ? t("offers.filtersActive") : t("offers.filtersOpen")}
                </button>
              </div>

              <MobileBottomSheet
                isDark={isDark}
                tallList
                title={t("offers.filtersSheetTitle")}
                isOpen={mobileFiltersOpen}
                onClose={() => setMobileFiltersOpen(false)}
              >
                <div className="flex flex-col gap-4 px-1 pb-2">
                  <div className="flex flex-col gap-1">
                    <label className={`text-sm font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{t("offers.sortLabel")}</label>
                    <select
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as SortKey)}
                      className={filterFieldClassSelect}
                    >
                      <option value="nearest">{t("offers.sortNearest")}</option>
                      <option value="cheapest">{t("offers.sortCheapest")}</option>
                      <option value="rating">{t("offers.sortRating")}</option>
                      <option value="slot">{t("offers.sortSlot")}</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <label className="flex flex-col gap-1">
                      <span className={`text-sm font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{t("offers.filterMaxPrice")}</span>
                      <input
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        inputMode="decimal"
                        placeholder="np. 500"
                        className={filterFieldClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={`text-sm font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{t("offers.filterMinRating")}</span>
                      <input
                        value={minRating}
                        onChange={(e) => setMinRating(e.target.value)}
                        inputMode="decimal"
                        placeholder="np. 4"
                        className={filterFieldClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={`text-sm font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{t("offers.filterMaxDistance")}</span>
                      <input
                        value={maxDistanceKm}
                        onChange={(e) => setMaxDistanceKm(e.target.value)}
                        inputMode="decimal"
                        placeholder="np. 15"
                        className={filterFieldClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={`text-sm font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{t("offers.filterServiceCategory")}</span>
                      <select value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)} className={filterFieldClassSelect}>
                        <option value="">{t("offers.filterAllCategories")}</option>
                        {categoryOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={`text-sm font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{t("offers.filterAvailability")}</span>
                      <select
                        value={availFilter}
                        onChange={(e) => setAvailFilter(e.target.value as AvailFilter)}
                        className={filterFieldClassSelect}
                      >
                        <option value="all">{t("offers.filterAvailAll")}</option>
                        <option value="today">{t("offers.filterAvailToday")}</option>
                        <option value="soon">{t("offers.filterAvailSoon")}</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                    {compareIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCompareOpen(true);
                          setMobileFiltersOpen(false);
                        }}
                        className="w-full rounded-xl bg-orange-500 px-4 py-3 text-base font-semibold text-white hover:bg-orange-600"
                      >
                        {t("offers.compareOpen")} ({compareIds.length})
                      </button>
                    ) : null}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={clearOffersFilters}
                        className={`w-full rounded-xl border px-4 py-3 text-base font-semibold sm:flex-1 ${
                          isDark ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "border-zinc-300 text-zinc-800 hover:bg-zinc-50"
                        }`}
                      >
                        {t("offers.filtersClear")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileFiltersOpen(false)}
                        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 sm:flex-1"
                      >
                        {t("offers.filtersDone")}
                      </button>
                    </div>
                  </div>
                </div>
              </MobileBottomSheet>

              <div
                className={`mb-4 hidden flex-col gap-3 rounded-2xl border px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4 sm:px-4 md:flex ${
                  isDark ? "border-zinc-700 bg-zinc-900/50" : "border-blue-200 bg-white/80"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <label className={`text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("offers.sortLabel")}</label>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className={`rounded-lg border px-2 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                  >
                    <option value="nearest">{t("offers.sortNearest")}</option>
                    <option value="cheapest">{t("offers.sortCheapest")}</option>
                    <option value="rating">{t("offers.sortRating")}</option>
                    <option value="slot">{t("offers.sortSlot")}</option>
                  </select>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  <label className="flex flex-col gap-1">
                    <span className={`text-[11px] font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("offers.filterMaxPrice")}</span>
                    <input
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      inputMode="decimal"
                      placeholder="np. 500"
                      className={`rounded-lg border px-2 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950" : "border-zinc-300 bg-white"}`}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={`text-[11px] font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("offers.filterMinRating")}</span>
                    <input
                      value={minRating}
                      onChange={(e) => setMinRating(e.target.value)}
                      inputMode="decimal"
                      placeholder="np. 4"
                      className={`rounded-lg border px-2 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950" : "border-zinc-300 bg-white"}`}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={`text-[11px] font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("offers.filterMaxDistance")}</span>
                    <input
                      value={maxDistanceKm}
                      onChange={(e) => setMaxDistanceKm(e.target.value)}
                      inputMode="decimal"
                      placeholder="np. 15"
                      className={`rounded-lg border px-2 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950" : "border-zinc-300 bg-white"}`}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={`text-[11px] font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("offers.filterServiceCategory")}</span>
                    <select
                      value={serviceCategory}
                      onChange={(e) => setServiceCategory(e.target.value)}
                      className={`rounded-lg border px-2 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                    >
                      <option value="">{t("offers.filterAllCategories")}</option>
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                    <span className={`text-[11px] font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("offers.filterAvailability")}</span>
                    <select
                      value={availFilter}
                      onChange={(e) => setAvailFilter(e.target.value as AvailFilter)}
                      className={`rounded-lg border px-2 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                    >
                      <option value="all">{t("offers.filterAvailAll")}</option>
                      <option value="today">{t("offers.filterAvailToday")}</option>
                      <option value="soon">{t("offers.filterAvailSoon")}</option>
                    </select>
                  </label>
                </div>
                {compareIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCompareOpen(true)}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                  >
                    {t("offers.compareOpen")} ({compareIds.length})
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {loading ? (
            <div
              className={`grid grid-cols-1 gap-3 md:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)] ${resultsDesktopHeightClass}`}
            >
              <div className={`h-[640px] animate-pulse rounded-2xl ${isDark ? "bg-zinc-800" : "bg-slate-200"} md:h-full`} />
              <div className={`h-[640px] animate-pulse rounded-2xl ${isDark ? "bg-zinc-800" : "bg-slate-200"} md:h-full`} />
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div
              className={`rounded-2xl border px-4 py-6 text-center ${
                isDark ? "border-zinc-700 bg-zinc-900/60 text-zinc-200" : "border-blue-200 bg-white/90 text-zinc-800"
              }`}
            >
              <p className="text-base font-semibold">{t("offers.emptyTitle")}</p>
              <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("offers.noResults")}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link
                  href="/#servygo-search"
                  className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {t("offers.changeCriteria")}
                </Link>
                <Link
                  href="/#servygo-search"
                  className={`inline-flex rounded-xl border px-4 py-2 text-sm font-semibold ${
                    isDark ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "border-zinc-300 text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  {t("offers.reportDemand")}
                </Link>
              </div>
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 gap-4 md:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)] ${resultsDesktopHeightClass}`}
            >
              <section className={`${viewMode === "map" ? "hidden md:block" : "block"} md:min-h-0`}>
                <div className="space-y-2 md:h-full md:overflow-y-auto md:pr-1">
                  {filteredAndSorted.filter((w) => w.services[0]).map((workshop) => {
                    const firstOffer = workshop.services[0]!;
                    const detailsParams = buildDetailsParams(workshop);
                    const isSelected = activeSelectedWorkshopId === workshop.id;
                    const distKm = haversineDistanceKm(cityCenter, { lat: workshop.lat, lng: workshop.lng });
                    const detailsHref = `/warsztat/${workshop.id}?${detailsParams.toString()}`;
                    const ratingDisplay = Number.isFinite(Number(workshop.rating)) ? Number(workshop.rating).toFixed(1) : "—";
                    return (
                      <article
                        key={workshop.id}
                        ref={(el) => {
                          listCardRefs.current[workshop.id] = el;
                        }}
                        onMouseEnter={() => setSelectedWorkshopId(workshop.id)}
                        onClick={() => setSelectedWorkshopId(workshop.id)}
                        className={`rounded-2xl border p-3 transition-all md:p-3.5 ${
                          isSelected
                            ? "border-blue-500/60 shadow-[0_0_0_1px_rgba(59,130,246,0.5)]"
                            : isDark
                              ? "border-zinc-700 bg-zinc-900/70"
                              : "border-blue-200 bg-white/80"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="break-words text-base font-semibold leading-tight md:text-lg">{workshop.name}</h3>
                            {workshop.isDemo ? (
                              <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${isDark ? "border-amber-400/40 bg-amber-500/15 text-amber-200" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                                Profil demonstracyjny
                              </p>
                            ) : null}
                          </div>
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={compareIds.includes(workshop.id)}
                              onChange={() => toggleCompare(workshop.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded border-zinc-400"
                            />
                            {t("offers.compareToggle")}
                          </label>
                        </div>
                        <p className={`mt-0.5 text-xs md:text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{workshop.address}</p>
                        <p className={`mt-1 text-xs md:text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                          <strong>⭐ {ratingDisplay}</strong> ({workshop.reviewsCount} {t("offers.reviews")}) ·{" "}
                          {t("offers.distanceFromCenter")}: {formatDistanceKm(distKm)}
                        </p>
                        <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs leading-snug sm:grid-cols-2 md:text-sm">
                          <p>
                            <strong>{t("offers.price")}:</strong> {formatPriceRange(firstOffer.price_from, firstOffer.price_to)}
                          </p>
                          <p>
                            <strong>{t("offers.duration")}:</strong> {firstOffer.duration_minutes} min
                          </p>
                          <p>
                            <strong>{t("offers.service")}:</strong> {firstOffer.service_name}
                          </p>
                          <p>
                            <strong>{t("offers.nearestSlot")}:</strong> {firstOffer.next_available}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <Link
                            href={detailsHref}
                            onClick={() =>
                              void trackEvent("workshop_click", {
                                workshopId: workshop.id,
                                workshopName: workshop.name,
                                service: firstOffer.service_name,
                                city: workshop.city,
                              })
                            }
                            className="inline-flex flex-1 items-center justify-center rounded-xl border border-blue-400/70 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-500/50 dark:text-blue-200 dark:hover:bg-zinc-800"
                          >
                            {t("offers.checkWorkshop")}
                          </Link>
                          <Link
                            href={detailsHref}
                            onClick={() =>
                              void trackEvent("workshop_click", {
                                workshopId: workshop.id,
                                workshopName: workshop.name,
                                source: "book_visit",
                                city: workshop.city,
                              })
                            }
                            className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-3 py-2 text-sm font-semibold text-white"
                          >
                            {t("offers.bookVisit")}
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section
                className={`${viewMode === "list" ? "hidden md:block" : "block"} md:sticky md:top-20 md:self-start ${resultsDesktopHeightClass}`}
              >
                <div
                  className={`relative h-[420px] overflow-hidden rounded-2xl border sm:h-[520px] md:h-full ${
                    isDark ? "border-blue-500/25 bg-zinc-950" : "border-blue-200 bg-white"
                  }`}
                >
                  {mapMarkers.length > 0 ? (
                    <OffersLeafletMapErrorBoundary
                      fallback={
                        <div
                          className={`flex h-full min-h-[320px] flex-col items-center justify-center gap-3 px-4 text-center text-sm ${
                            isDark ? "text-zinc-300" : "text-zinc-600"
                          }`}
                        >
                          <p className="max-w-sm font-medium">Mapa chwilowo niedostępna.</p>
                          <p className="max-w-sm text-xs opacity-90">
                            Lista warsztatów działa normalnie — możesz wybrać warsztat z listy po lewej.
                          </p>
                        </div>
                      }
                    >
                      <OffersLeafletMap
                        markers={mapMarkers}
                        selectedId={activeSelectedWorkshopId}
                        onMarkerClick={(id) => setSelectedWorkshopId(id)}
                        seeOfferLabel={t("offers.seeOfferOnMap")}
                      />
                    </OffersLeafletMapErrorBoundary>
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
                      {t("offers.mapNoPins")}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {compareOpen && compareWorkshops.length > 0 ? (
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-2 sm:items-center"
              role="dialog"
              aria-modal="true"
            >
              <div
                className={`max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border p-4 shadow-2xl ${
                  isDark ? "border-zinc-600 bg-zinc-900 text-zinc-100" : "border-blue-200 bg-white text-zinc-900"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">{t("offers.compareOpen")}</h2>
                  <button
                    type="button"
                    onClick={() => setCompareOpen(false)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                  >
                    {t("offers.compareClose")}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                    <thead>
                      <tr className={isDark ? "border-b border-zinc-700" : "border-b border-zinc-200"}>
                        <th className="py-2 pr-2">{t("offers.compareName")}</th>
                        <th className="py-2 pr-2">⭐</th>
                        <th className="py-2 pr-2">{t("offers.distanceFromCenter")}</th>
                        <th className="py-2 pr-2">{t("offers.price")}</th>
                        <th className="py-2 pr-2">{t("offers.duration")}</th>
                        <th className="py-2">{t("offers.nearestSlot")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareWorkshops.map((w) => {
                        const o = w.services[0];
                        const d = haversineDistanceKm(cityCenter, { lat: w.lat, lng: w.lng });
                        return (
                          <tr key={w.id} className={isDark ? "border-t border-zinc-800" : "border-t border-zinc-100"}>
                            <td className="py-2 pr-2 font-medium">{w.name}</td>
                            <td className="py-2 pr-2">
                              {Number.isFinite(Number(w.rating)) ? Number(w.rating).toFixed(1) : "—"} ({w.reviewsCount})
                            </td>
                            <td className="py-2 pr-2">{formatDistanceKm(d)}</td>
                            <td className="py-2 pr-2">{formatPriceRange(o?.price_from, o?.price_to)}</td>
                            <td className="py-2 pr-2">{o ? `${o.duration_minutes} min` : "—"}</td>
                            <td className="py-2">{o?.next_available ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </ServyGoPageShell>
  );
}
