"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import AutocompleteSelect from "@/components/AutocompleteSelect";
import ServiceCategoryPicker from "@/components/ServiceCategoryPicker";
import MobileBottomSheet from "@/components/MobileBottomSheet";
import InternalInbox from "@/components/InternalInbox";
import UserCenterCards from "@/components/home/UserCenterCards";
import { MobileCompactSearchField, searchFormFieldIconMap } from "@/components/home/MobileCompactSearchField";
import { VinOptionalHint } from "@/components/VinOptionalHint";
import UserDetailsSection from "@/components/home/UserDetailsSection";
import ClientNotificationBell from "@/components/home/ClientNotificationBell";
import { pickDashboardUpcomingBooking, resolveClientBookingBadge } from "@/lib/bookingStatusUi";
import RecommendedWorkshopsSection from "@/components/home/RecommendedWorkshopsSection";
import LandingCtaFooter from "@/components/home/LandingCtaFooter";
import LandingInfoDialogs from "@/components/home/LandingInfoDialogs";
import { countryOptions, polishCityOptions } from "@/lib/locationData";
import { getServiceCatalogByVehicleType } from "@/lib/serviceCatalog";
import {
  createTranslator,
  getTranslationNode,
  LanguageCode,
} from "@/lib/translations";
import {
  getVehicleBrands,
  getVehicleFuels,
  getVehicleModels,
  getVehicleTypeLabel,
  getVehicleYears,
  sortAlphabetically,
  sortYearsDesc,
  vehicleData,
  vehicleTypeOptions,
  type VehicleTypeKey,
} from "@/lib/vehicleData";
import { trackEvent } from "@/lib/analytics";
import { LEGAL_VERSIONS } from "@/lib/legalVersions";
import {
  fetchUserFavoriteWorkshops,
  isWorkshopStatusPublicVisible,
} from "@/lib/favoriteWorkshopsDb";
import {
  buildFavoriteMatchCriteria,
  getCatalogServiceMatchesInWorkshop,
  isCatalogServiceAvailableInWorkshopOffers,
  priceHintFromMatches,
} from "@/lib/favoriteWorkshopServiceMatch";
import type { WorkshopServiceOffer } from "@/lib/mockWorkshops";
import { fetchPublicWorkshopByIdAsMock } from "@/lib/publicWorkshopsFromDb";
import {
  deleteUserCarRow,
  fetchUserCars,
  insertUserCar,
  mapCarToStored,
  setUserPrimaryCar,
  type StoredVehicle,
  updateUserCarRow,
} from "@/lib/userCarsDb";
import { resolveMessageViewerContext } from "@/lib/messagesApi";
import { getUnifiedUnreadCount } from "@/lib/notificationsApi";
type ActiveDropdown = "user" | "lang" | null;
type AuthModalType = "login" | "register" | null;
type AccountTab = "profile" | "vehicles" | "security" | "messages";

type UserProfileDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  shareFullLastNameWithWorkshops: boolean;
  reviewPublicNickname: string;
};

type SavedCarOption = {
  id: string;
  label: string;
};

function pickFirstNonEmpty(...values: Array<string | undefined>) {
  const found = values.find((value) => typeof value === "string" && value.trim().length > 0);
  return found?.trim() ?? "";
}

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  share_full_last_name_with_workshops?: boolean | null;
  review_public_nickname?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const fieldClassName =
  "rounded-xl border border-zinc-600/70 bg-zinc-900/70 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:shadow-[0_0_0_1px_rgba(249,115,22,0.5),0_0_30px_rgba(37,99,235,0.35)]";

const lightFieldClassName =
  "rounded-xl border border-blue-200/80 bg-slate-100/85 px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300/60 focus:shadow-[0_0_0_1px_rgba(249,115,22,0.35),0_0_20px_rgba(37,99,235,0.2)]";

const searchFieldErrorRingClass =
  "!border-[#ef4444] shadow-[0_0_0_2px_rgba(239,68,68,0.15)] focus:!border-[#ef4444] focus:shadow-[0_0_0_2px_rgba(239,68,68,0.2)]";
const searchFieldErrorHintClass = "text-xs font-medium text-[#dc2626]";

type SearchFieldKey = "vehicleType" | "brand" | "model" | "year" | "fuel" | "service" | "city";

const LOCAL_CLEANUP_VERSION_KEY = "servygo_local_cleanup_v1";

/** Gdy false — ukrywa przycisk „Nie znalazłeś auta?” i kartę zgłoszenia brakującego auta (kod zostaje w projekcie). */
const SHOW_MANUAL_MISSING_VEHICLE_UI = false;

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleTypeKey | "">("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [fuel, setFuel] = useState("");
  const [service, setService] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [searchVin, setSearchVin] = useState("");
  const [searchFieldErrors, setSearchFieldErrors] = useState<Partial<Record<SearchFieldKey, string>>>({});
  const [showManualVehicle, setShowManualVehicle] = useState(false);
  const [manualType, setManualType] = useState("");
  const [manualBrand, setManualBrand] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualYear, setManualYear] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [years, setYears] = useState<string[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);
  const [landingInfoPanel, setLandingInfoPanel] = useState<
    "contact" | "about" | "workshops" | "drivers" | "howItWorks" | "faq" | null
  >(null);
  const [language, setLanguage] = useState<LanguageCode>("pl");
  const [authModal, setAuthModal] = useState<AuthModalType>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authInfo, setAuthInfo] = useState("");
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<AccountTab>("profile");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountInfo, setAccountInfo] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountUnreadMessages, setAccountUnreadMessages] = useState(0);
  const [accountViewerRole, setAccountViewerRole] = useState<"client" | "workshop" | "admin">("client");
  const [accountIncludeAllForAdmin, setAccountIncludeAllForAdmin] = useState(false);
  const [profileDraft, setProfileDraft] = useState<UserProfileDraft>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    city: "",
    shareFullLastNameWithWorkshops: false,
    reviewPublicNickname: "",
  });
  const [vehicleTypeDraft, setVehicleTypeDraft] = useState("");
  const [vehicleBrandDraft, setVehicleBrandDraft] = useState("");
  const [vehicleModelDraft, setVehicleModelDraft] = useState("");
  const [vehicleYearDraft, setVehicleYearDraft] = useState("");
  const [vehicleRegistrationDraft, setVehicleRegistrationDraft] = useState("");
  const [vehicleFuelDraft, setVehicleFuelDraft] = useState("");
  const [vehicleVinDraft, setVehicleVinDraft] = useState("");
  const [vehicleCityDraft, setVehicleCityDraft] = useState("");
  const [vehicles, setVehicles] = useState<StoredVehicle[]>([]);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editVehicleDraft, setEditVehicleDraft] = useState<StoredVehicle | null>(null);
  const [selectedSavedCarId, setSelectedSavedCarId] = useState("");
  const [isManualMode, setIsManualMode] = useState(true);
  const [carPickerQuery, setCarPickerQuery] = useState("");
  const [carPickerOpen, setCarPickerOpen] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [securityPassword, setSecurityPassword] = useState("");
  const [securityPasswordRepeat, setSecurityPasswordRepeat] = useState("");
  const [securityEmailDraft, setSecurityEmailDraft] = useState("");
  const [securityPhoneDraft, setSecurityPhoneDraft] = useState("");
  const [authAttemptWindowStart, setAuthAttemptWindowStart] = useState(() =>
    Date.now(),
  );
  const [authAttemptCount, setAuthAttemptCount] = useState(0);
  const [authBlockedUntil, setAuthBlockedUntil] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [hasWorkshopPanelAccess, setHasWorkshopPanelAccess] = useState(false);
  const [dashboardBookingsCount, setDashboardBookingsCount] = useState(0);
  const [favoriteWorkshopChoices, setFavoriteWorkshopChoices] = useState<Array<{ workshopId: string; name: string }>>(
    [],
  );
  const [favoriteWorkshopsCount, setFavoriteWorkshopsCount] = useState(0);
  const [selectedFavoriteWorkshopId, setSelectedFavoriteWorkshopId] = useState<string | null>(null);
  const [favoriteWorkshopOffers, setFavoriteWorkshopOffers] = useState<WorkshopServiceOffer[] | null>(null);
  const [favoriteWorkshopBanner, setFavoriteWorkshopBanner] = useState("");
  const [dashboardUpcomingBooking, setDashboardUpcomingBooking] = useState<{
    id: string;
    workshop: string;
    service: string;
    date: string;
    time: string;
    address: string;
    badgeLabel: string;
    badgeClassName: string;
  } | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordRepeat, setRegisterPasswordRepeat] = useState("");
  const [registerLegalAccepted, setRegisterLegalAccepted] = useState(false);
  const [registerMarketingConsent, setRegisterMarketingConsent] = useState(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const carPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMounted(true);
      setYears(getVehicleYears());
      const savedTheme = window.localStorage.getItem("servygo-theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
      }
      const savedLanguage = window.localStorage.getItem("servygo_language");
      if (savedLanguage === "pl" || savedLanguage === "en" || savedLanguage === "ua") {
        setLanguage(savedLanguage);
      }

      const params = new URLSearchParams(window.location.search);
      const authParam = params.get("auth");
      if (authParam === "login" || authParam === "register") {
        setAuthModal(authParam);
      }

      if (!window.localStorage.getItem(LOCAL_CLEANUP_VERSION_KEY)) {
        window.localStorage.removeItem("servygo_user_profile");
        window.localStorage.removeItem("servygo_user_vehicles");

        const legacyVehicleKeys = ["servygo_vehicles", "servygoVehicles", "servygo_cars"];
        const legacyBadMarkers = ["fiat", "test", "aaa"];

        for (const storageKey of legacyVehicleKeys) {
          const rawValue = window.localStorage.getItem(storageKey);
          if (!rawValue) continue;
          try {
            const parsedValue = JSON.parse(rawValue);
            if (!Array.isArray(parsedValue)) continue;

            const cleanedVehicles = parsedValue.filter((vehicle: unknown) => {
              if (!vehicle || typeof vehicle !== "object") return false;
              const candidate = vehicle as Record<string, unknown>;
              const searchable = [
                String(candidate.brand ?? "").toLowerCase(),
                String(candidate.model ?? "").toLowerCase(),
                String(candidate.vehicle_type ?? "").toLowerCase(),
              ];
              return !searchable.some((value) =>
                legacyBadMarkers.some((marker) => value.includes(marker)),
              );
            });

            if (cleanedVehicles.length > 0) {
              window.localStorage.setItem(storageKey, JSON.stringify(cleanedVehicles));
            } else {
              window.localStorage.removeItem(storageKey);
            }
          } catch {
            window.localStorage.removeItem(storageKey);
          }
        }

        window.localStorage.setItem(LOCAL_CLEANUP_VERSION_KEY, "done");
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
    window.localStorage.setItem("servygo_language", language);
  }, [mounted, language]);

  useEffect(() => {
    if (!mounted) return;
    void trackEvent("page_view", { page: "/" });
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !authModal) return;
    void trackEvent("page_view", { page: "/auth", modal: authModal });
  }, [mounted, authModal]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!headerRef.current) return;
      if (!headerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    function handleCarPickerOutside(event: MouseEvent) {
      if (!carPickerRef.current) return;
      if (!carPickerRef.current.contains(event.target as Node)) {
        setCarPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleCarPickerOutside);
    return () => document.removeEventListener("mousedown", handleCarPickerOutside);
  }, []);

  useEffect(() => {
    const darkLogo = new window.Image();
    darkLogo.src = "/servygo-logo-dark-cropped.png";
    const lightLogo = new window.Image();
    lightLogo.src = "/servygo-logo-light-cropped.png";
  }, []);

  useEffect(() => {
    function updateViewportMode() {
      setIsMobileViewport(window.innerWidth < 640);
    }
    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let mountedRef = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mountedRef) return;
      setCurrentUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      mountedRef = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function checkAccess() {
      if (!supabase || !currentUser) {
        setIsCurrentUserAdmin(false);
        setHasWorkshopPanelAccess(false);
        return;
      }

      try {
        const context = await resolveMessageViewerContext(currentUser.id, currentUser.email);
        setIsCurrentUserAdmin(context.role === "admin");
        setHasWorkshopPanelAccess(Boolean(context.hasActiveWorkshop));
      } catch {
        setIsCurrentUserAdmin(false);
        setHasWorkshopPanelAccess(false);
      }
    }

    void checkAccess();
  }, [currentUser]);

  useEffect(() => {
    if (!supabase || !currentUser) {
      setDashboardBookingsCount(0);
      setDashboardUpcomingBooking(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, workshop_name, service_name, booking_date, start_time, end_time, duration_minutes, status, quote_status, reschedule_status, proposed_by",
        )
        .eq("user_id", currentUser.id)
        .order("booking_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(100);
      if (cancelled) return;
      if (error) {
        setDashboardBookingsCount(0);
        setDashboardUpcomingBooking(null);
        return;
      }
      const rows =
        (data as {
          id: string;
          workshop_name: string | null;
          service_name: string | null;
          booking_date: string | null;
          start_time: string | null;
          end_time: string | null;
          duration_minutes: number | null;
          status: string | null;
          quote_status: string | null;
          reschedule_status: string | null;
          proposed_by: string | null;
        }[] | null) ?? [];
      setDashboardBookingsCount(rows.length);
      const upcoming = pickDashboardUpcomingBooking(rows);
      const dark = theme === "dark";
      if (!upcoming) {
        setDashboardUpcomingBooking(null);
      } else {
        const badge = resolveClientBookingBadge({
          status: upcoming.status,
          quoteStatus: upcoming.quote_status,
          rescheduleStatus: upcoming.reschedule_status,
          proposedBy: upcoming.proposed_by,
          isDark: dark,
        });
        setDashboardUpcomingBooking({
          id: upcoming.id,
          workshop: upcoming.workshop_name ?? "Warsztat ServyGo",
          service: upcoming.service_name ?? "Usługa serwisowa",
          date: upcoming.booking_date ?? "—",
          time: (upcoming.start_time ?? "").slice(0, 5) || "—",
          address: "Adres warsztatu dostępny po otwarciu szczegółów",
          badgeLabel: badge.label,
          badgeClassName: badge.className,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, theme]);

  useEffect(() => {
    if (!currentUser) {
      setAccountUnreadMessages(0);
      setAccountViewerRole("client");
      setAccountIncludeAllForAdmin(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const context = await resolveMessageViewerContext(currentUser.id, currentUser.email);
        const unread = await getUnifiedUnreadCount(currentUser.id, context.isAdminOrOwner);
        if (cancelled) return;
        setAccountUnreadMessages(unread);
        setAccountViewerRole(context.role);
        setAccountIncludeAllForAdmin(context.isAdminOrOwner);
      } catch {
        if (!cancelled) setAccountUnreadMessages(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!supabase || !currentUser) {
      setSelectedSavedCarId("");
      setIsManualMode(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const cars = await fetchUserCars(supabase, currentUser.id);
        if (cancelled) return;
        const mapped = cars.map(mapCarToStored);
        setVehicles(mapped);
        // Do not auto-fill from saved cars on page entry.
        // User must explicitly pick a car from "Wybierz auto".
        setSelectedSavedCarId("");
        setIsManualMode(true);
        setVehicleType("");
        setBrand("");
        setModel("");
        setYear("");
        setFuel("");
        setSearchVin("");
        setSearchCity("");
      } catch {
        if (!cancelled) {
          setVehicles([]);
          setSelectedSavedCarId("");
          setIsManualMode(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!selectedSavedCarId) return;
    const selected = vehicles.find((v) => v.id === selectedSavedCarId);
    if (!selected) return;
    setIsManualMode(false);
    const nextType = selected.vehicleType as VehicleTypeKey | "";
    if (nextType) {
      setVehicleType(nextType);
    }
    setBrand(selected.brand);
    setModel(selected.model);
    setYear(selected.year);
    setFuel(selected.fuel);
    if (selected.city.trim()) {
      setSearchCity(selected.city);
    }
    setSearchVin(selected.vin.trim().slice(0, 17).toUpperCase());
  }, [selectedSavedCarId, vehicles]);

  const hasSavedCars = currentUser != null && vehicles.length > 0;
  const selectedSavedCar = useMemo(
    () => vehicles.find((v) => v.id === selectedSavedCarId) ?? null,
    [selectedSavedCarId, vehicles],
  );
  const sortedVehicles = useMemo(
    () =>
      [...vehicles].sort((a, b) =>
        `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "pl", { sensitivity: "base" }),
      ),
    [vehicles],
  );
  const savedCarOptions = useMemo<SavedCarOption[]>(
    () =>
      sortedVehicles
        .map((vehicle) => ({
          id: vehicle.id,
          label: `${vehicle.brand} ${vehicle.model} (${vehicle.year || "—"})${vehicle.isPrimary ? " • domyślne" : ""}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "pl", { sensitivity: "base" })),
    [sortedVehicles],
  );
  const filteredSavedCarOptions = useMemo(() => {
    const needle = carPickerQuery.trim().toLowerCase();
    if (!needle) return savedCarOptions;
    return savedCarOptions.filter((option) => option.label.toLowerCase().includes(needle));
  }, [carPickerQuery, savedCarOptions]);

  useEffect(() => {
    if (!hasSavedCars) {
      setIsManualMode(true);
      setSelectedSavedCarId("");
    }
  }, [hasSavedCars]);

  const currentVehicleConfig = vehicleType ? vehicleData[vehicleType] : null;
  const brandsForVehicleType = getVehicleBrands(vehicleType);
  const fuelsForVehicleType = getVehicleFuels(vehicleType);
  /** Katalog w pickerze: bez wybranego typu pokazujemy drzewo jak dla „samochód” (22+ główne tematy z usługi.txt), żeby pole nie było puste. Po wyborze typu lista przełącza się na właściwy katalog. */
  const serviceCatalogForVehicleType = useMemo(
    () => getServiceCatalogByVehicleType((vehicleType || "car") as VehicleTypeKey),
    [vehicleType],
  );
  const favoriteMatchCriteria = useMemo(
    () => buildFavoriteMatchCriteria(vehicleType, brand, model, year, fuel),
    [vehicleType, brand, model, year, fuel],
  );
  const getFinalServiceAvailabilityFromFavorite = useCallback(
    (serviceName: string) => {
      if (!selectedFavoriteWorkshopId || !favoriteWorkshopOffers) return null;
      const available = isCatalogServiceAvailableInWorkshopOffers(
        favoriteWorkshopOffers,
        favoriteMatchCriteria,
        serviceName,
      );
      const matches = getCatalogServiceMatchesInWorkshop(
        favoriteWorkshopOffers,
        favoriteMatchCriteria,
        serviceName,
      );
      return {
        available,
        priceHint: available ? priceHintFromMatches(matches) : undefined,
      };
    },
    [selectedFavoriteWorkshopId, favoriteWorkshopOffers, favoriteMatchCriteria],
  );
  const favoriteServiceBlocked = useMemo(() => {
    if (!selectedFavoriteWorkshopId || !favoriteWorkshopOffers?.length || !service.trim()) return false;
    return !isCatalogServiceAvailableInWorkshopOffers(
      favoriteWorkshopOffers,
      favoriteMatchCriteria,
      service,
    );
  }, [selectedFavoriteWorkshopId, favoriteWorkshopOffers, service, favoriteMatchCriteria]);
  const fuelLabel = currentVehicleConfig?.fuelLabel ?? "Silnik / paliwo";
  const serviceLabel = currentVehicleConfig?.serviceLabel ?? "Czego potrzebujesz?";
  const t = useMemo(() => createTranslator(language), [language]);
  const translatedFuelLabel = language === "pl" ? fuelLabel : t("form.labels.fuel");
  const translatedServiceLabel = language === "pl" ? serviceLabel : t("form.labels.service");
  const heroChips =
    (getTranslationNode("hero.chips", language) as string[] | undefined) ??
    (getTranslationNode("hero.chips", "pl") as string[] | undefined) ??
    [];
  const steps =
    (getTranslationNode("sections.steps", language) as
      | { title: string; desc: string }[]
      | undefined) ??
    (getTranslationNode("sections.steps", "pl") as
      | { title: string; desc: string }[]
      | undefined) ??
    [];

  const landingHeaderNavItems = useMemo(
    () =>
      [
        { key: "howItWorks" as const, label: t("landing.navHowItWorks") },
        { key: "drivers" as const, label: t("landing.navForDrivers") },
        { key: "workshops" as const, label: t("landing.navForWorkshops") },
        { key: "about" as const, label: t("landing.navAbout") },
        { key: "contact" as const, label: t("landing.navContact") },
      ] as const,
    [t],
  );

  const modelsForBrand = useMemo(() => {
    if (!brand || !vehicleType) return [];
    const normalizedBrand = brand.trim().toLowerCase();
    const matchedBrand = brandsForVehicleType.find(
      (brandOption) => brandOption.toLowerCase() === normalizedBrand,
    );
    if (!matchedBrand) return [];
    return getVehicleModels(vehicleType, matchedBrand);
  }, [brand, vehicleType, brandsForVehicleType]);

  const isDark = mounted ? theme === "dark" : false;
  const mobileAccountSheetRowClass =
    "flex min-h-[44px] w-full items-center rounded-xl px-4 py-3 text-left text-base font-medium leading-snug transition active:opacity-90 " +
    (isDark ? "text-zinc-100 hover:bg-zinc-800/85" : "text-zinc-900 hover:bg-blue-50/95");
  const mobileAccountSheetSectionLabelClass = isDark ? "text-zinc-500" : "text-zinc-600";
  const mobileAccountSheetDividerClass = isDark ? "mx-3 my-2 h-px shrink-0 bg-zinc-700" : "mx-3 my-2 h-px shrink-0 bg-slate-200";
  const maxManualYear = years[0];
  const accountVehicleBrands = useMemo(
    () => getVehicleBrands(vehicleTypeDraft),
    [vehicleTypeDraft],
  );
  const accountVehicleModels = useMemo(
    () => getVehicleModels(vehicleTypeDraft, vehicleBrandDraft),
    [vehicleTypeDraft, vehicleBrandDraft],
  );
  const accountVehicleFuels = useMemo(
    () => getVehicleFuels(vehicleTypeDraft),
    [vehicleTypeDraft],
  );
  const accountVehicleTypeOptions = useMemo(
    () =>
      vehicleTypeOptions.map((type) => ({
        value: type.key,
        label: t(`form.vehicleTypes.${type.key}`),
      })),
    [t],
  );
  const countrySelectOptions = useMemo(
    () => countryOptions.map((country) => ({ value: country, label: country })),
    [],
  );
  const citySelectOptions = useMemo(
    () => sortAlphabetically(polishCityOptions).map((city) => ({ value: city, label: city })),
    [],
  );
  const sortedYears = useMemo(() => sortYearsDesc(years).map(String), [years]);
  const currentFieldClassName = isDark ? fieldClassName : lightFieldClassName;
  const searchFormControlMobileStrip =
    "max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:ring-0 max-md:focus:border-transparent max-md:focus:ring-0 max-md:focus:shadow-none max-md:px-0 max-md:py-2 max-md:rounded-none max-md:text-base max-md:leading-snug max-md:placeholder:text-zinc-500";
  const searchFormAutocompleteShell = "max-md:gap-0";
  /** Pusta — strzałka w `AutocompleteSelect` jest widoczna na mobile (wspólny cel kliknięcia z polem). */
  const searchFormChevronToggleHide = "";
  const headerShellClass = isDark
    ? "sticky top-0 z-[1000] isolate mb-4 box-border w-full max-w-full overflow-x-hidden border-b border-blue-500/20 bg-zinc-950/78 px-2 py-2 max-sm:overflow-hidden max-md:py-1.5 backdrop-blur-xl sm:overflow-visible sm:px-3 sm:py-2.5 md:mb-7 md:px-4"
    : "sticky top-0 z-[1000] isolate mb-4 box-border w-full max-w-full overflow-x-hidden border-b border-blue-100/90 bg-white/92 px-2 py-2 max-sm:overflow-hidden max-md:py-1.5 backdrop-blur-xl sm:overflow-visible sm:px-3 sm:py-2.5 md:mb-7 md:px-4";
  const triggerButtonClass = isDark
    ? "inline-flex h-8 max-w-full min-w-0 shrink items-center gap-1 whitespace-nowrap rounded-xl border border-zinc-700/80 bg-zinc-900/78 px-1.5 text-[11px] font-medium text-zinc-100 shadow-[0_0_24px_rgba(15,23,42,0.5)] transition-all duration-300 hover:border-blue-400/60 hover:text-blue-300 sm:h-12 sm:shrink-0 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm md:h-14 md:px-5 md:text-base"
    : "inline-flex h-8 max-w-full min-w-0 shrink items-center gap-1 whitespace-nowrap rounded-xl border border-blue-200/75 bg-white/82 px-1.5 text-[11px] font-medium text-slate-700 shadow-[0_0_24px_rgba(15,23,42,0.08)] transition-all duration-300 hover:border-orange-300/80 hover:text-blue-700 sm:h-12 sm:shrink-0 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm md:h-14 md:px-5 md:text-base";
  const userTriggerButtonClass = isDark
    ? "inline-flex h-8 max-w-full min-w-0 shrink items-center gap-1 whitespace-nowrap rounded-xl border border-zinc-700/80 bg-zinc-900/78 px-1.5 text-[11px] text-zinc-100 shadow-[0_0_24px_rgba(15,23,42,0.5)] transition-all duration-300 hover:border-blue-400/60 hover:text-blue-300 sm:h-12 sm:shrink-0 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm md:h-14 md:px-4 md:text-base"
    : "inline-flex h-8 max-w-full min-w-0 shrink items-center gap-1 whitespace-nowrap rounded-xl border border-blue-200/75 bg-white/82 px-1.5 text-[11px] text-slate-700 shadow-[0_0_24px_rgba(15,23,42,0.08)] transition-all duration-300 hover:border-orange-300/80 hover:text-blue-700 sm:h-12 sm:shrink-0 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm md:h-14 md:px-4 md:text-base";
  const ctaButtonClass = isDark
    ? "inline-flex h-8 max-w-full min-w-0 shrink items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-blue-400/40 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-1.5 text-[11px] font-semibold text-white shadow-[0_0_28px_rgba(59,130,246,0.28)] transition-all duration-300 hover:brightness-110 sm:h-12 sm:shrink-0 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm md:h-14 md:px-5 md:text-base"
    : "inline-flex h-8 max-w-full min-w-0 shrink items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-blue-300/80 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-1.5 text-[11px] font-semibold text-white shadow-[0_0_28px_rgba(59,130,246,0.22)] transition-all duration-300 hover:brightness-110 sm:h-12 sm:shrink-0 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm md:h-14 md:px-5 md:text-base";
  const dropdownPanelClass = isDark
    ? "isolate rounded-2xl border border-blue-500/25 bg-zinc-900/98 p-2 shadow-[0_26px_60px_rgba(2,6,23,0.78)] backdrop-blur-xl"
    : "isolate rounded-2xl border border-blue-200/85 bg-white p-2 shadow-[0_26px_60px_rgba(15,23,42,0.24)] ring-1 ring-orange-200/45 backdrop-blur-xl";
  const dropdownSectionLabelClass = isDark
    ? "my-1 border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500"
    : "my-1 border-t border-slate-200 px-3 py-2 text-xs text-slate-500";
  const dropdownHintClass = isDark ? "px-3 py-2 text-sm text-zinc-400" : "px-3 py-2 text-sm text-slate-500";
  const dropdownSubtextClass = isDark ? "block text-xs text-zinc-400" : "block text-xs text-slate-500";
  const pageBaseClass = isDark
    ? "relative overflow-hidden bg-gradient-to-br from-[#030712] via-[#08142b] to-[#030712] text-zinc-100"
    : "relative overflow-hidden bg-[linear-gradient(135deg,#f8fbff_0%,#eef6ff_28%,#ffffff_48%,#fff7ed_76%,#fffdf5_100%)] text-zinc-900";
  const pageGlowClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_520px_at_86%_-8%,rgba(59,130,246,0.34),transparent_62%),radial-gradient(980px_480px_at_-8%_102%,rgba(249,115,22,0.18),transparent_70%),radial-gradient(760px_360px_at_52%_45%,rgba(56,189,248,0.12),transparent_72%)]"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(1220px_560px_at_88%_-8%,rgba(37,99,235,0.22),transparent_62%),radial-gradient(1040px_560px_at_-8%_102%,rgba(249,115,22,0.2),transparent_70%),radial-gradient(820px_390px_at_52%_44%,rgba(125,211,252,0.14),transparent_72%)]";
  const pageMeshClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(59,130,246,0.1),transparent_42%),radial-gradient(circle_at_78%_74%,rgba(251,146,60,0.08),transparent_48%)] opacity-75 mix-blend-screen"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(59,130,246,0.08),transparent_42%),radial-gradient(circle_at_78%_74%,rgba(251,146,60,0.06),transparent_50%)] opacity-70";
  const pageNoiseClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20"
    : "pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.016)_1px,transparent_1px)] bg-[size:48px_48px] opacity-25";
  const pagePatternClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:22px_22px] opacity-10"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(37,99,235,0.065)_1px,transparent_1px)] bg-[size:22px_22px] opacity-30";
  const pageIllustrationClass = isDark
    ? "pointer-events-none absolute inset-0 opacity-0"
    : "pointer-events-none absolute inset-0 opacity-0";
  const pageIllustrationMaskClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(280px_170px_at_49%_52%,rgba(2,6,23,0.95),transparent_72%)]"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(280px_170px_at_49%_52%,rgba(248,251,255,0.95),transparent_72%)]";
  function clearSearchFieldError(field: SearchFieldKey) {
    setSearchFieldErrors((prev) => {
      if (prev[field] == null) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setMessage("");
    setMessageType("");
    setSearchFieldErrors({});

    const resolvedBrand = String(formData.get("brand") ?? "").trim();
    const resolvedModel = String(formData.get("model") ?? "").trim();
    const resolvedYear = String(formData.get("year") ?? "").trim();
    const resolvedFuel = String(formData.get("fuel") ?? "").trim();
    const selectedService = String(formData.get("service") ?? "").trim();

    const errs: Partial<Record<SearchFieldKey, string>> = {};
    if (!vehicleType) errs.vehicleType = "Wybierz typ auta.";
    if (!resolvedBrand) errs.brand = "Wybierz markę.";
    if (!resolvedModel) errs.model = "Wybierz model.";
    if (!resolvedYear) errs.year = "Wybierz rocznik.";
    if (!resolvedFuel) errs.fuel = "Wybierz paliwo.";
    if (!selectedService) errs.service = "Wybierz, czego potrzebujesz.";
    if (!searchCity.trim()) errs.city = "Podaj miasto.";
    const critForFavorite = buildFavoriteMatchCriteria(
      vehicleType,
      resolvedBrand,
      resolvedModel,
      resolvedYear,
      resolvedFuel,
    );
    if (
      selectedFavoriteWorkshopId &&
      Array.isArray(favoriteWorkshopOffers) &&
      favoriteWorkshopOffers.length > 0 &&
      !isCatalogServiceAvailableInWorkshopOffers(favoriteWorkshopOffers, critForFavorite, selectedService)
    ) {
      errs.service =
        "Ta usługa nie jest dostępna w wybranym warsztacie. Wybierz inną usługę albo usuń filtr ulubionego warsztatu.";
    }
    if (Object.keys(errs).length > 0) {
      setSearchFieldErrors(errs);
      setMessage(t("form.messages.requiredFields"));
      setMessageType("error");
      return;
    }

    const vinInput = String(formData.get("vin") ?? "").trim().toUpperCase();
    if (vinInput.length > 17) {
      setMessage("VIN może mieć maksymalnie 17 znaków.");
      setMessageType("error");
      return;
    }

    const payload = {
      vehicleType: formData.get("vehicleType"),
      vehicleTypeLabel: currentVehicleConfig?.label ?? formData.get("vehicleType"),
      brand: resolvedBrand,
      model: resolvedModel,
      year: resolvedYear,
      fuel: resolvedFuel,
      service: formData.get("service"),
      problem: formData.get("problem"),
      city: formData.get("city"),
      vin: vinInput,
      selectedCarId: selectedSavedCar?.id ?? null,
      selectedCarLabel: selectedSavedCar ? `${selectedSavedCar.brand} ${selectedSavedCar.model}` : null,
      firstName: profileDraft.firstName.trim(),
      lastName: profileDraft.lastName.trim(),
      manualVehicle: {
        type: formData.get("manualType"),
        brand: formData.get("manualBrand"),
        model: formData.get("manualModel"),
        year: formData.get("manualYear"),
        description: formData.get("manualDescription"),
      },
      vehicleSource: isManualMode ? "reczne_dodanie" : "lista",
    };

    void trackEvent("search_submit", {
      page: "/",
      vehicleType: String(payload.vehicleType ?? ""),
      brand: payload.brand,
      model: payload.model,
      year: payload.year,
      fuel: payload.fuel,
      city: String(payload.city ?? ""),
      service: String(payload.service ?? ""),
    });

    if (selectedFavoriteWorkshopId && favoriteWorkshopOffers === null) {
      setMessage("Poczekaj chwilę — wczytujemy usługi wybranego warsztatu.");
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);
    const query = new URLSearchParams();
    query.set("vehicleType", String(payload.vehicleType ?? ""));
    query.set("service", String(payload.service ?? ""));
    query.set("city", String(payload.city ?? ""));
    query.set("brand", String(payload.brand ?? ""));
    query.set("model", String(payload.model ?? ""));
    query.set("year", String(payload.year ?? ""));
    query.set("fuel", String(payload.fuel ?? ""));
    query.set("engine", String(payload.fuel ?? ""));
    if (payload.vin) query.set("vin", payload.vin);
    if (payload.firstName) query.set("firstName", payload.firstName);
    if (payload.lastName) query.set("lastName", payload.lastName);
    if (payload.selectedCarId) query.set("carId", payload.selectedCarId);
    const problemText = String(payload.problem ?? "").trim();
    if (problemText) {
      query.set("problem", problemText);
    }
    setIsSubmitting(false);
    if (
      selectedFavoriteWorkshopId &&
      favoriteWorkshopOffers &&
      favoriteWorkshopOffers.length > 0 &&
      isCatalogServiceAvailableInWorkshopOffers(
        favoriteWorkshopOffers,
        critForFavorite,
        selectedService,
      )
    ) {
      router.push(`/warsztat/${selectedFavoriteWorkshopId}?${query.toString()}`);
      return;
    }
    router.push(`/oferty?${query.toString()}`);
  }

  function selectTheme(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    setActiveDropdown(null);
  }

  function selectLanguage(nextLanguage: LanguageCode) {
    setLanguage(nextLanguage);
    setActiveDropdown(null);
  }

  function openLoginModal() {
    setAuthError("");
    setAuthInfo("");
    setAuthModal("login");
    setActiveDropdown(null);
  }

  function openRegisterModal() {
    setAuthError("");
    setAuthInfo("");
    setAuthModal("register");
    setActiveDropdown(null);
  }

  function closeAuthModal() {
    if (authLoading) return;
    setAuthModal(null);
    setAuthError("");
    setAuthInfo("");
  }

  async function getUserProfile(userId: string): Promise<Profile | null> {
    if (!supabase) throw new Error("Supabase client not available.");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data as Profile | null) ?? null;
  }

  async function upsertUserProfile(userId: string, profile: Partial<Profile>): Promise<Profile> {
    if (!supabase) throw new Error("Supabase client not available.");
    const payload: Record<string, unknown> = {
      id: userId,
      first_name: profile.first_name ?? null,
      last_name: profile.last_name ?? null,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      country: profile.country ?? null,
      city: profile.city ?? null,
      updated_at: new Date().toISOString(),
    };
    if (profile.share_full_last_name_with_workshops !== undefined) {
      payload.share_full_last_name_with_workshops = Boolean(profile.share_full_last_name_with_workshops);
    }
    if (profile.review_public_nickname !== undefined) {
      payload.review_public_nickname = profile.review_public_nickname?.trim() || null;
    }
    const { data, error } = await supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(payload as any, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;
    return data as Profile;
  }

  const loadAccountData = useCallback(async (forUser?: User | null) => {
    const user = forUser ?? currentUser;
    if (!supabase || !user) return;

    setAccountLoading(true);
    setAccountError("");

    try {
      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const metadataFirstName = typeof metadata.first_name === "string" ? metadata.first_name : "";
      const metadataLastName = typeof metadata.last_name === "string" ? metadata.last_name : "";
      const metadataFullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
      const [fullNameFirst = "", ...fullNameRest] = metadataFullName ? metadataFullName.split(/\s+/) : [];
      const fullNameLast = fullNameRest.join(" ").trim();
      const metadataPhone = typeof metadata.phone === "string" ? metadata.phone : "";

      let profile = await getUserProfile(user.id);
      if (!profile) {
        profile = await upsertUserProfile(user.id, {
          first_name: pickFirstNonEmpty(metadataFirstName, fullNameFirst),
          last_name: pickFirstNonEmpty(metadataLastName, fullNameLast),
          email: user.email ?? null,
          phone: metadataPhone,
          country: "",
          city: "",
        });
      }

      const cars = await fetchUserCars(supabase, user.id);
      setProfileDraft({
        firstName: pickFirstNonEmpty(profile.first_name ?? undefined, metadataFirstName, fullNameFirst),
        lastName: pickFirstNonEmpty(profile.last_name ?? undefined, metadataLastName, fullNameLast),
        email: pickFirstNonEmpty(user.email),
        phone: pickFirstNonEmpty(profile.phone ?? undefined, metadataPhone),
        country: profile.country ?? "",
        city: profile.city ?? "",
        shareFullLastNameWithWorkshops: profile.share_full_last_name_with_workshops === true,
        reviewPublicNickname: profile.review_public_nickname?.trim() ?? "",
      });
      setSecurityEmailDraft(user.email ?? "");
      setSecurityPhoneDraft(pickFirstNonEmpty(profile.phone ?? undefined, metadataPhone));
      setVehicles(cars.map(mapCarToStored));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("account.messages.loadError");
      setAccountError(message);
    } finally {
      setAccountLoading(false);
    }
  }, [currentUser, t]);

  const loadAccountDataRef = useRef(loadAccountData);
  loadAccountDataRef.current = loadAccountData;

  const vehiclesDeepLinkHandledRef = useRef(false);

  useEffect(() => {
    if (!mounted || vehiclesDeepLinkHandledRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("account") !== "vehicles") return;

    void (async () => {
      if (!supabase || !isSupabaseConfigured) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setAuthModal("login");
        router.replace("/", { scroll: false });
        return;
      }
      vehiclesDeepLinkHandledRef.current = true;
      router.replace("/moje-auta", { scroll: false });
    })();
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted || !supabase || !currentUser || !isSupabaseConfigured) {
      setFavoriteWorkshopChoices([]);
      setFavoriteWorkshopsCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchUserFavoriteWorkshops(supabase, currentUser.id);
        if (cancelled) return;
        const choices = rows
          .filter((r) => isWorkshopStatusPublicVisible(r.workshop.status))
          .map((r) => ({ workshopId: r.workshop.id, name: r.workshop.name }));
        setFavoriteWorkshopChoices(choices);
        setFavoriteWorkshopsCount(choices.length);
      } catch {
        if (!cancelled) {
          setFavoriteWorkshopChoices([]);
          setFavoriteWorkshopsCount(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, currentUser]);

  useEffect(() => {
    if (!selectedFavoriteWorkshopId) {
      setFavoriteWorkshopOffers(null);
      setFavoriteWorkshopBanner("");
      return;
    }
    let cancelled = false;
    setFavoriteWorkshopBanner("");
    void (async () => {
      try {
        const mock = await fetchPublicWorkshopByIdAsMock(selectedFavoriteWorkshopId);
        if (cancelled) return;
        if (!mock) {
          setFavoriteWorkshopOffers([]);
          setFavoriteWorkshopBanner("Nie udało się wczytać oferty tego warsztatu.");
          return;
        }
        setFavoriteWorkshopOffers(mock.services ?? []);
      } catch (e) {
        if (!cancelled) {
          setFavoriteWorkshopOffers([]);
          setFavoriteWorkshopBanner(e instanceof Error ? e.message : "Błąd wczytywania warsztatu.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedFavoriteWorkshopId]);

  useEffect(() => {
    const fid = searchParams.get("favoriteWorkshopId")?.trim() ?? "";
    if (!fid || favoriteWorkshopChoices.length === 0) return;
    if (favoriteWorkshopChoices.some((x) => x.workshopId === fid)) {
      setSelectedFavoriteWorkshopId(fid);
    }
  }, [searchParams, favoriteWorkshopChoices]);

  useEffect(() => {
    if (!mounted || !currentUser) return;
    const frameId = window.requestAnimationFrame(() => {
      void loadAccountData();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [mounted, currentUser, loadAccountData]);

  function openAccountModal() {
    if (!currentUser) return;
    setAccountModalOpen(true);
    setAccountTab("profile");
    setAccountError("");
    setAccountInfo("");
    setSecurityEmailDraft(currentUser.email ?? profileDraft.email);
    setSecurityPhoneDraft(profileDraft.phone);
    setActiveDropdown(null);
    void loadAccountData();
  }

  function closeAccountModal() {
    setAccountModalOpen(false);
    setAccountError("");
    setAccountInfo("");
    setShowPasswordChange(false);
    setSecurityPassword("");
    setSecurityPasswordRepeat("");
  }

  async function handleProfileSave() {
    if (!currentUser || !supabase) {
      setAccountError(t("auth.errors.notLoggedIn"));
      return;
    }
    const first = profileDraft.firstName.trim();
    const last = profileDraft.lastName.trim();
    if (!first) {
      setAccountError(t("account.validation.profileFirstNameRequired"));
      setAccountInfo("");
      return;
    }

    setAccountSaving(true);
    try {
      const data = await upsertUserProfile(currentUser.id, {
        first_name: first,
        last_name: last || null,
        email: currentUser.email ?? null,
        phone: profileDraft.phone.trim(),
        country: profileDraft.country.trim(),
        city: profileDraft.city.trim(),
        share_full_last_name_with_workshops: profileDraft.shareFullLastNameWithWorkshops,
        review_public_nickname: profileDraft.reviewPublicNickname.trim() || null,
      });
      const nextProfile = {
        ...profileDraft,
        firstName: data.first_name ?? "",
        lastName: data.last_name ?? "",
        phone: data.phone ?? "",
        country: data.country ?? "",
        city: data.city ?? "",
        shareFullLastNameWithWorkshops: data.share_full_last_name_with_workshops === true,
        reviewPublicNickname: data.review_public_nickname?.trim() ?? "",
      };
      setProfileDraft(nextProfile);
      setSecurityPhoneDraft(nextProfile.phone);
      setAccountError("");
      setAccountInfo(t("account.messages.profileSaved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("account.messages.profileSaveError");
      setAccountError(message);
      setAccountInfo("");
    } finally {
      setAccountSaving(false);
    }
  }

  function resetVehicleDraft() {
    setVehicleTypeDraft("");
    setVehicleBrandDraft("");
    setVehicleModelDraft("");
    setVehicleYearDraft("");
    setVehicleRegistrationDraft("");
    setVehicleFuelDraft("");
    setVehicleVinDraft("");
    setVehicleCityDraft("");
  }

  async function handleVehicleAdd() {
    if (!currentUser || !supabase) {
      setAccountError(t("auth.errors.notLoggedIn"));
      return;
    }
    if (!vehicleBrandDraft.trim() || !vehicleModelDraft.trim() || !vehicleYearDraft.trim()) {
      setAccountError(t("account.validation.vehicleRequired"));
      setAccountInfo("");
      return;
    }

    const parsedYear = Number.parseInt(vehicleYearDraft.trim(), 10);
    if (!Number.isFinite(parsedYear)) {
      setAccountError(t("account.validation.vehicleRequired"));
      setAccountInfo("");
      return;
    }

    setAccountSaving(true);
    try {
      const inserted = await insertUserCar(supabase, currentUser.id, {
        vehicle_type: vehicleTypeDraft.trim() || null,
        brand: vehicleBrandDraft.trim(),
        model: vehicleModelDraft.trim(),
        year: parsedYear,
        fuel: vehicleFuelDraft.trim() || null,
        plate_number: vehicleRegistrationDraft.trim() || null,
        vin: vehicleVinDraft.trim().toUpperCase() || null,
        city: vehicleCityDraft.trim() || null,
        is_primary: vehicles.length === 0,
      });
      const nextVehicles = [mapCarToStored(inserted), ...vehicles];
      setVehicles(nextVehicles);
      resetVehicleDraft();
      setAccountError("");
      setAccountInfo(t("account.messages.vehicleSaved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("account.messages.vehicleSaveError");
      setAccountError(message);
      setAccountInfo("");
    } finally {
      setAccountSaving(false);
    }
  }

  async function handleVehicleDelete(vehicleId: string) {
    if (!currentUser || !supabase) {
      setAccountError(t("auth.errors.notLoggedIn"));
      return;
    }

    setAccountSaving(true);
    try {
      await deleteUserCarRow(supabase, vehicleId);
      const nextVehicles = vehicles.filter((vehicle) => vehicle.id !== vehicleId);
      if (!nextVehicles.some((vehicle) => vehicle.isPrimary) && nextVehicles.length > 0) {
        await setUserPrimaryCar(supabase, currentUser.id, nextVehicles[0].id);
        nextVehicles[0] = { ...nextVehicles[0], isPrimary: true };
      }
      setVehicles(nextVehicles);
      if (selectedSavedCarId === vehicleId) {
        setSelectedSavedCarId((nextVehicles.find((v) => v.isPrimary) ?? nextVehicles[0])?.id ?? "");
      }
      if (editingVehicleId === vehicleId) {
        cancelVehicleEdit();
      }
      setAccountInfo(t("account.messages.vehicleDeleted"));
      setAccountError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("account.messages.vehicleDeleteError");
      setAccountError(message);
      setAccountInfo("");
    } finally {
      setAccountSaving(false);
    }
  }

  function beginVehicleEdit(vehicle: StoredVehicle) {
    setEditingVehicleId(vehicle.id);
    setEditVehicleDraft({ ...vehicle });
    setAccountError("");
    setAccountInfo("");
  }

  function cancelVehicleEdit() {
    setEditingVehicleId(null);
    setEditVehicleDraft(null);
  }

  async function handleVehicleEditSave() {
    if (!currentUser || !supabase || !editingVehicleId || !editVehicleDraft) {
      setAccountError(t("auth.errors.notLoggedIn"));
      return;
    }
    if (!editVehicleDraft.brand.trim() || !editVehicleDraft.model.trim() || !editVehicleDraft.year.trim()) {
      setAccountError(t("account.validation.vehicleRequired"));
      setAccountInfo("");
      return;
    }
    const parsedYear = Number.parseInt(editVehicleDraft.year.trim(), 10);
    if (!Number.isFinite(parsedYear)) {
      setAccountError(t("account.validation.vehicleRequired"));
      setAccountInfo("");
      return;
    }
    setAccountSaving(true);
    try {
      const updated = await updateUserCarRow(supabase, currentUser.id, editingVehicleId, {
        vehicle_type: editVehicleDraft.vehicleType.trim() || null,
        brand: editVehicleDraft.brand.trim(),
        model: editVehicleDraft.model.trim(),
        year: parsedYear,
        fuel: editVehicleDraft.fuel.trim() || null,
        plate_number: editVehicleDraft.registration.trim() || null,
        vin: editVehicleDraft.vin.trim().toUpperCase() || null,
        city: editVehicleDraft.city.trim() || null,
        is_primary: editVehicleDraft.isPrimary,
      });
      setVehicles((prev) => prev.map((v) => (v.id === editingVehicleId ? mapCarToStored(updated) : v)));
      setAccountError("");
      setAccountInfo(t("account.messages.vehicleSaved"));
      cancelVehicleEdit();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("account.messages.vehicleSaveError");
      setAccountError(message);
      setAccountInfo("");
    } finally {
      setAccountSaving(false);
    }
  }

  async function handleSetPrimaryVehicle(vehicleId: string) {
    if (!currentUser || !supabase) {
      setAccountError(t("auth.errors.notLoggedIn"));
      return;
    }

    setAccountSaving(true);
    try {
      await setUserPrimaryCar(supabase, currentUser.id, vehicleId);
      const nextVehicles = vehicles.map((vehicle) => ({
        ...vehicle,
        isPrimary: vehicle.id === vehicleId,
      }));
      setVehicles(nextVehicles);
      setSelectedSavedCarId(vehicleId);
      setAccountInfo(t("account.messages.primaryVehicleSet"));
      setAccountError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("account.messages.primaryVehicleError");
      setAccountError(message);
      setAccountInfo("");
    } finally {
      setAccountSaving(false);
    }
  }

  async function handlePasswordUiSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !currentUser) {
      setAccountError(t("auth.errors.notLoggedIn"));
      return;
    }
    if (securityPassword.trim().length < 6) {
      setAccountError(t("account.validation.passwordMin"));
      setAccountInfo("");
      return;
    }
    if (securityPassword !== securityPasswordRepeat) {
      setAccountError(t("account.validation.passwordMismatch"));
      setAccountInfo("");
      return;
    }
    setAccountSaving(true);
    const { error } = await supabase.auth.updateUser({ password: securityPassword.trim() });
    setAccountSaving(false);
    if (error) {
      setAccountError(error.message);
      setAccountInfo("");
      return;
    }
    setSecurityPassword("");
    setSecurityPasswordRepeat("");
    setShowPasswordChange(false);
    setAccountError("");
    setAccountInfo(t("account.messages.passwordUiSaved"));
  }

  async function handleSecurityEmailSave() {
    if (!supabase || !currentUser) {
      setAccountError(t("auth.errors.notLoggedIn"));
      return;
    }
    const email = securityEmailDraft.trim();
    if (!email || !email.includes("@")) {
      setAccountError(t("auth.errors.emailInvalid"));
      setAccountInfo("");
      return;
    }
    setAccountSaving(true);
    const { error } = await supabase.auth.updateUser({ email });
    setAccountSaving(false);
    if (error) {
      setAccountError(error.message);
      setAccountInfo("");
      return;
    }
    setProfileDraft((prev) => ({ ...prev, email }));
    setAccountError("");
    setAccountInfo(t("account.messages.emailUpdateRequested"));
  }

  async function handleSecurityPhoneSave() {
    if (!currentUser || !supabase) {
      setAccountError(t("auth.errors.notLoggedIn"));
      return;
    }
    const phone = securityPhoneDraft.trim();
    setAccountSaving(true);
    try {
      await upsertUserProfile(currentUser.id, {
        first_name: profileDraft.firstName.trim(),
        last_name: profileDraft.lastName.trim(),
        email: currentUser.email ?? null,
        phone,
        country: profileDraft.country.trim(),
        city: profileDraft.city.trim(),
      });
      setProfileDraft((prev) => ({ ...prev, phone }));
      setAccountError("");
      setAccountInfo(t("account.messages.phoneUpdated"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("account.messages.profileSaveError");
      setAccountError(message);
      setAccountInfo("");
    } finally {
      setAccountSaving(false);
    }
  }

  async function handlePasswordResetEmail() {
    if (!supabase || !currentUser?.email) {
      setAccountError(t("auth.errors.emailInvalid"));
      setAccountInfo("");
      return;
    }
    setAccountSaving(true);
    const { error } = await supabase.auth.resetPasswordForEmail(currentUser.email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}` : undefined,
    });
    setAccountSaving(false);
    if (error) {
      setAccountError(error.message);
      setAccountInfo("");
      return;
    }
    setAccountError("");
    setAccountInfo(t("account.security.resetInfo"));
  }

  function handleGoogleLogin() {
    setAuthError("");
    setAuthInfo(t("auth.info.googleSoon"));
  }

  function handleAppleLogin() {
    setAuthError("");
    setAuthInfo(t("auth.info.appleSoon"));
  }

  function localizeAuthError(rawMessage: string) {
    const message = rawMessage.toLowerCase();
    if (message.includes("invalid login credentials")) return t("auth.errors.invalidCredentials");
    if (message.includes("email address") && message.includes("invalid")) return t("auth.errors.emailInvalid");
    if (message.includes("rate limit")) return t("auth.errors.rateLimitExceeded");
    if (message.includes("database error saving new user")) return t("auth.errors.databaseSaveNewUser");
    return rawMessage;
  }

  function checkAuthAttemptLimit() {
    const now = Date.now();
    const cooldownMs = 3 * 60 * 1000;
    const maxAttempts = 5;

    if (authBlockedUntil && now < authBlockedUntil) {
      const leftSeconds = Math.ceil((authBlockedUntil - now) / 1000);
      setAuthError(t("auth.errors.cooldown").replace("{seconds}", String(leftSeconds)));
      return false;
    }

    if (now - authAttemptWindowStart > cooldownMs) {
      setAuthAttemptWindowStart(now);
      setAuthAttemptCount(0);
      setAuthBlockedUntil(null);
      return true;
    }

    if (authAttemptCount >= maxAttempts) {
      const blockedTo = authAttemptWindowStart + cooldownMs;
      setAuthBlockedUntil(blockedTo);
      const leftSeconds = Math.ceil((blockedTo - now) / 1000);
      setAuthError(t("auth.errors.cooldown").replace("{seconds}", String(leftSeconds)));
      return false;
    }

    return true;
  }

  function registerAuthAttempt() {
    setAuthAttemptCount((prev) => prev + 1);
  }

  async function handleLogout() {
    if (!supabase) return;
    setAuthError("");
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
      return;
    }
    setActiveDropdown(null);
    setAccountModalOpen(false);
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthInfo("");

    if (!supabase || !isSupabaseConfigured) {
      setAuthError(t("auth.errors.supabaseMissing"));
      return;
    }

    if (!checkAuthAttemptLimit()) return;

    const identifier = loginIdentifier.trim();
    if (!identifier) {
      setAuthError(t("auth.errors.emailOrPhoneRequired"));
      return;
    }
    if (loginPassword.trim().length < 6) {
      setAuthError(t("auth.errors.passwordMin"));
      return;
    }

    registerAuthAttempt();
    setAuthLoading(true);
    const credentials = identifier.includes("@")
      ? { email: identifier, password: loginPassword }
      : { phone: identifier, password: loginPassword };
    const { error } = await supabase.auth.signInWithPassword(credentials);
    setAuthLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("rate limit")) {
        setAuthBlockedUntil(Date.now() + 3 * 60 * 1000);
      }
      setAuthError(localizeAuthError(error.message));
      return;
    }

    setAuthAttemptCount(0);
    setAuthBlockedUntil(null);
    setAuthModal(null);
    setLoginPassword("");
    setLoginIdentifier("");

    await supabase.auth.getUser();
    // Zamierzone: bez automatycznego przekierowania — użytkownik zostaje na stronie i wybiera panel z menu.
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authLoading) return;
    setAuthError("");
    setAuthInfo("");

    if (!supabase || !isSupabaseConfigured) {
      setAuthError(t("auth.errors.supabaseMissing"));
      return;
    }

    const firstName = registerFirstName.trim();
    const lastName = registerLastName.trim();
    const email = registerEmail.trim();
    const phone = registerPhone.trim();
    const password = registerPassword.trim();
    const repeatedPassword = registerPasswordRepeat.trim();

    if (!firstName) {
      setAuthError(t("account.validation.profileFirstNameRequired"));
      return;
    }

    if (!email || !email.includes("@")) {
      setAuthError(t("auth.errors.emailInvalid"));
      return;
    }
    if (!phone) {
      setAuthError(t("auth.errors.phoneRequired"));
      return;
    }
    if (password.length < 6) {
      setAuthError(t("auth.errors.passwordMin"));
      return;
    }
    if (password !== repeatedPassword) {
      setAuthError(t("auth.errors.passwordMismatch"));
      return;
    }
    if (!registerLegalAccepted) {
      setAuthError("Aby założyć konto, zaakceptuj Regulamin i zapoznaj się z Polityką prywatności.");
      return;
    }

    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone,
        },
      },
    });
    console.log("SIGNUP RESPONSE:", { data, error });

    if (error) {
      setAuthLoading(false);
      if (error.message.toLowerCase().includes("rate limit")) {
        setAuthBlockedUntil(Date.now() + 3 * 60 * 1000);
      }
      setAuthError(localizeAuthError(error.message));
      return;
    }

    if (data.user) {
      const acceptedAt = new Date().toISOString();
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          terms_accepted_at: acceptedAt,
          privacy_accepted_at: acceptedAt,
          accepted_terms_version: LEGAL_VERSIONS.terms,
          accepted_privacy_version: LEGAL_VERSIONS.privacy,
          marketing_consent: registerMarketingConsent,
          marketing_consent_at: registerMarketingConsent ? acceptedAt : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      if (profileError) {
        console.warn("Profile upsert after signup failed:", profileError.message);
        setAuthLoading(false);
        setAuthError(
          "Konto zostało utworzone, ale nie udało się zapisać wymaganych zgód. Spróbuj zalogować się ponownie lub skontaktuj się z pomocą ServyGo.",
        );
        return;
      }
    }

    setAuthLoading(false);
    setAuthAttemptCount(0);
    setAuthBlockedUntil(null);
    setAuthInfo(t("auth.info.accountCreated"));
    if (data.user && data.session) {
      setAuthModal(null);
    } else {
      setAuthModal("login");
    }
    setRegisterFirstName("");
    setRegisterLastName("");
    setRegisterEmail("");
    setRegisterPhone("");
    setRegisterPassword("");
    setRegisterPasswordRepeat("");
    setRegisterLegalAccepted(false);
    setRegisterMarketingConsent(false);
  }

  return (
    <div className={`min-h-screen overflow-x-hidden ${pageBaseClass}`}>
      {!isDark ? (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 right-[-120px] h-[420px] w-[420px] rounded-full bg-blue-300/30 blur-3xl" />
          <div className="absolute left-[-140px] top-[35%] h-[360px] w-[360px] rounded-full bg-orange-300/25 blur-3xl" />
          <div className="absolute right-[20%] top-[50%] h-[300px] w-[300px] rounded-full bg-sky-300/20 blur-3xl" />
          <div className="absolute bottom-[-120px] right-[10%] h-[380px] w-[380px] rounded-full bg-yellow-200/25 blur-3xl" />
        </div>
      ) : null}
      <div className={pageIllustrationClass} />
      <div className={pageIllustrationMaskClass} />
      <div className={pageGlowClass} />
      <div className={pageMeshClass} />
      <div className={pageNoiseClass} />
      <div className={pagePatternClass} />
      <main className="relative z-0 mx-auto w-full max-w-[1760px] px-4 py-5 max-md:px-3 max-md:py-4 sm:px-6 sm:py-9 lg:px-8 2xl:px-10">
        <section
          className="relative isolate w-full max-w-full overflow-x-hidden px-0 pb-8 pt-0 sm:pb-10"
        >
          <div
            ref={headerRef}
            className={`${headerShellClass}${currentUser ? " max-md:py-2" : ""}`}
          >
            <div
              className={`flex w-full min-w-0 max-w-full flex-row items-center justify-between gap-1 overflow-x-hidden max-sm:overflow-hidden max-md:gap-0.5 sm:gap-2 sm:overflow-visible xl:gap-6${currentUser ? " max-md:gap-1" : ""}`}
            >
              <Image
                src={
                  isDark
                    ? "/servygo-logo-dark-cropped.png"
                    : "/servygo-logo-light-cropped.png"
                }
                alt="ServyGo"
                width={256}
                height={96}
                priority
                className={`h-8 w-auto max-w-[min(36vw,132px)] shrink-0 object-contain max-md:h-9 max-md:translate-x-px max-md:max-w-[min(42vw,154px)] sm:h-12 sm:max-w-none md:mr-6 md:h-16 md:max-w-[256px] md:translate-x-0${currentUser ? " max-md:max-w-[min(50vw,176px)]" : ""}`}
              />

              <nav className="mx-auto hidden min-w-0 flex-1 justify-center gap-6 xl:flex">
                {landingHeaderNavItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setLandingInfoPanel(item.key)}
                    className={`text-sm font-medium transition ${
                      isDark ? "text-zinc-200 hover:text-blue-300" : "text-zinc-700 hover:text-blue-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              <div
                className={`relative z-[1001] ml-auto flex min-w-0 max-w-full flex-1 basis-0 flex-row flex-nowrap items-center justify-end gap-1 overflow-x-hidden max-sm:overflow-hidden max-md:gap-0.5 sm:max-w-none sm:flex-none sm:basis-auto sm:gap-2 sm:overflow-visible sm:pr-1 md:gap-3 md:pr-2 xl:ml-0${currentUser ? " max-md:gap-1" : ""}`}
              >
                <div className="relative z-[1002] min-w-0 shrink">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDropdown((prev) => (prev === "user" ? null : "user"))
                    }
                    className={`${userTriggerButtonClass}${currentUser ? " max-sm:h-[34px] max-sm:min-h-[34px] max-sm:w-[34px] max-sm:min-w-[34px] max-sm:justify-center max-sm:px-0 max-sm:py-0 max-sm:gap-0" : ""}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-4 w-4 shrink-0 sm:h-5 sm:w-5${currentUser ? " max-sm:h-[17px] max-sm:w-[17px]" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <circle cx="12" cy="8" r="3.5" />
                      <path d="M5 19a7 7 0 0 1 14 0" />
                    </svg>
                    <svg viewBox="0 0 20 20" className="hidden h-3.5 w-3.5 shrink-0 sm:block sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="m5 7 5 6 5-6" />
                    </svg>
                  </button>
                  <div
                    className={`absolute right-0 top-[calc(100%+10px)] z-[9999] w-[min(92vw,360px)] max-w-[calc(100vw-24px)] origin-top-right ${dropdownPanelClass} transition-all duration-200 sm:w-72 sm:max-w-none ${
                      activeDropdown === "user"
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none -translate-y-2 opacity-0"
                    } hidden sm:block`}
                  >
                    {currentUser ? (
                      <>
                        <button
                          type="button"
                          onClick={openAccountModal}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                        >
                          <span className="mt-1 text-blue-400">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5" /><path d="M5 19a7 7 0 0 1 14 0" /></svg>
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">{t("auth.account")}</span>
                            <span className={dropdownSubtextClass}>{currentUser.email ?? t("auth.userFallback")}</span>
                          </span>
                        </button>
                        <Link
                          href="/moje-rezerwacje"
                          onClick={() => setActiveDropdown(null)}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                        >
                          <span className="mt-1 text-blue-400">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6.75A1.75 1.75 0 0 1 5.75 5h12.5A1.75 1.75 0 0 1 20 6.75v10.5A1.75 1.75 0 0 1 18.25 19H5.75A1.75 1.75 0 0 1 4 17.25V6.75Z" /><path d="M8 9h8M8 12h8M8 15h5" /></svg>
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">Moje rezerwacje</span>
                          </span>
                        </Link>
                        <Link
                          href="/moje-auta"
                          onClick={() => setActiveDropdown(null)}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                        >
                          <span className="mt-1 text-blue-400">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M5 11h14M5 16h10M5 6h14" />
                              <path d="M3 19h18" />
                            </svg>
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">Moje auta</span>
                          </span>
                        </Link>
                        <Link
                          href="/moj-kalendarz"
                          onClick={() => setActiveDropdown(null)}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                        >
                          <span className="mt-1 text-blue-400">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 2v4m8-4v4m4 8v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10"/><path d="M20 10V8l-2-4H6L4 8v2"/><circle cx="12" cy="14" r="1"/></svg>
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">Mój kalendarz</span>
                          </span>
                        </Link>
                        <Link
                          href="/moje-wiadomosci"
                          onClick={() => setActiveDropdown(null)}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                        >
                          <span className="mt-1 text-blue-400">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                            </svg>
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">{t("header.conversationsNav")}</span>
                          </span>
                        </Link>
                        <Link
                          href="/ustawienia"
                          onClick={() => setActiveDropdown(null)}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                        >
                          <span className="mt-1 text-blue-400">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4v3m0 10v3M4 12h3m10 0h3M6.3 6.3l2.1 2.1m7.2 7.2 2.1 2.1m0-11.4-2.1 2.1m-7.2 7.2-2.1 2.1" /><circle cx="12" cy="12" r="3.5" /></svg>
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">Ustawienia</span>
                          </span>
                        </Link>
                        {isCurrentUserAdmin ? (
                          <Link
                            href="/admin"
                            onClick={() => setActiveDropdown(null)}
                            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                          >
                            <span className="mt-1 text-blue-400">
                              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l8 4v6c0 5-3.3 8-8 8s-8-3-8-8V7l8-4Z" /><path d="m9.5 12 1.8 1.8L14.7 10.4" /></svg>
                            </span>
                            <span>
                              <span className="block text-sm font-semibold">Panel admina</span>
                            </span>
                          </Link>
                        ) : null}
                        {hasWorkshopPanelAccess ? (
                          <Link
                            href="/workshop-panel"
                            onClick={() => setActiveDropdown(null)}
                            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                          >
                            <span className="mt-1 text-blue-400">
                              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6.75A1.75 1.75 0 0 1 4.75 5h14.5A1.75 1.75 0 0 1 21 6.75v10.5A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25V6.75Z"/><path d="M8 15h8M8 11h5"/></svg>
                            </span>
                            <span>
                              <span className="block text-sm font-semibold">{t("workshop.panelTitle")}</span>
                            </span>
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                        >
                          <span className="mt-1 text-blue-400">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 17l5-5-5-5" /><path d="M4 12h11" /></svg>
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">{t("auth.logout")}</span>
                          </span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={openLoginModal}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                        >
                          <span className="mt-1 text-blue-400">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 17l5-5-5-5" /><path d="M4 12h11" /></svg>
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">{t("header.login")}</span>
                            <span className={dropdownSubtextClass}>{t("header.welcomeBack")}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={openRegisterModal}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                        >
                          <span className="mt-1 text-blue-400">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5" /><path d="M5 19a7 7 0 0 1 14 0" /></svg>
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">{t("header.register")}</span>
                            <span className={dropdownSubtextClass}>{t("header.createAccount")}</span>
                          </span>
                        </button>
                        <div className={dropdownSectionLabelClass}>{t("header.forWorkshops")}</div>
                        <Link
                          href="/dodaj-warsztat"
                          onClick={() => setActiveDropdown(null)}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                        >
                          <span className="mt-1 text-blue-400">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.7 6.3a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4l-7.9 7.9-3.3.7.7-3.3 7.5-7.9Z" /></svg>
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">{t("header.addWorkshop")}</span>
                            <span className={dropdownSubtextClass}>{t("header.registerWorkshop")}</span>
                          </span>
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                <div className="relative z-[1002] min-w-0 shrink">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDropdown((prev) => (prev === "lang" ? null : "lang"))
                    }
                    className={`${triggerButtonClass}${currentUser ? " max-sm:h-[34px] max-sm:min-h-[34px] max-sm:px-[10px] max-sm:text-[11px] max-sm:gap-[7px]" : ""}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3c-2.4 2.5-3.6 5.5-3.6 9S9.6 18.5 12 21" /></svg>
                    {language.toUpperCase()}
                    <svg
                      viewBox="0 0 20 20"
                      className={
                        currentUser
                          ? "h-3 w-3 shrink-0 max-sm:inline-block sm:inline-block sm:h-4 sm:w-4"
                          : "hidden h-3 w-3 shrink-0 sm:block sm:h-4 sm:w-4"
                      }
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="m5 7 5 6 5-6" />
                    </svg>
                  </button>
                  <div
                    className={`absolute right-0 top-[calc(100%+10px)] z-[9999] w-[min(92vw,360px)] max-w-[calc(100vw-24px)] origin-top-right ${dropdownPanelClass} transition-all duration-200 sm:w-56 sm:max-w-none ${
                      activeDropdown === "lang"
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none -translate-y-2 opacity-0"
                    } hidden sm:block`}
                  >
                    <p className={dropdownHintClass}>{t("header.chooseLanguage")}</p>
                    {[
                      { code: "pl", label: t("language.pl"), flag: "🇵🇱" },
                      { code: "en", label: t("language.en"), flag: "🇬🇧" },
                      { code: "ua", label: t("language.ua"), flag: "🇺🇦" },
                    ].map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => selectLanguage(item.code as LanguageCode)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-lg">{item.flag}</span>
                          <span>{item.label}</span>
                        </span>
                        {language === item.code ? <span className="text-blue-400">✓</span> : null}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative z-[1002] min-w-0 shrink">
                  <button
                    type="button"
                    onClick={() => selectTheme(isDark ? "light" : "dark")}
                    title={isDark ? t("header.themeDark") : t("header.themeLight")}
                    aria-label={isDark ? t("header.themeDark") : t("header.themeLight")}
                    className={`${triggerButtonClass} size-8 shrink-0 justify-center gap-0 !px-0 sm:size-12 md:size-14 max-sm:!size-[34px]`}
                  >
                    <span className="text-lg leading-none sm:text-xl" aria-hidden>
                      {isDark ? "🌙" : "☀️"}
                    </span>
                  </button>
                </div>

                {currentUser ? (
                  <div className="relative z-[1002] min-w-0 shrink">
                    <ClientNotificationBell
                      isDark={isDark}
                      unreadCount={accountUnreadMessages}
                      ariaLabel={t("header.notificationBellAria")}
                      title={t("header.notificationBellTitle")}
                      buttonClassName={`${triggerButtonClass} max-sm:h-[34px] max-sm:min-h-[34px] max-sm:w-[34px] max-sm:min-w-[34px] max-sm:justify-center max-sm:px-0 max-sm:py-0`}
                    />
                  </div>
                ) : null}

                {!currentUser ? (
                  <>
                    <button
                      type="button"
                      onClick={openLoginModal}
                      className={triggerButtonClass}
                    >
                      <span className="inline sm:hidden">{t("header.loginShort")}</span>
                      <span className="hidden sm:inline">{t("header.login")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={openRegisterModal}
                      className={ctaButtonClass}
                    >
                      <span className="inline sm:hidden">{t("header.registerShort")}</span>
                      <span className="hidden sm:inline">{t("header.register")}</span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {isMobileViewport ? (
            <>
              <MobileBottomSheet
                isOpen={activeDropdown === "user"}
                onClose={() => setActiveDropdown(null)}
                title="Konto"
                isDark={isDark}
              >
                <div className="flex flex-col pb-[env(safe-area-inset-bottom,0px)]">
                  {currentUser ? (
                    <>
                      <p
                        className={`px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide ${mobileAccountSheetSectionLabelClass}`}
                      >
                        Konto
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          openAccountModal();
                          setActiveDropdown(null);
                        }}
                        className={mobileAccountSheetRowClass}
                      >
                        <span className="flex min-w-0 flex-col items-start gap-0.5">
                          <span>{t("auth.account")}</span>
                          {currentUser.email ? (
                            <span className={`text-sm font-normal ${mobileAccountSheetSectionLabelClass}`}>{currentUser.email}</span>
                          ) : null}
                        </span>
                      </button>
                      <Link href="/moje-rezerwacje" onClick={() => setActiveDropdown(null)} className={mobileAccountSheetRowClass}>
                        Moje rezerwacje
                      </Link>
                      <Link href="/moje-auta" onClick={() => setActiveDropdown(null)} className={mobileAccountSheetRowClass}>
                        Moje auta
                      </Link>
                      <Link href="/moj-kalendarz" onClick={() => setActiveDropdown(null)} className={mobileAccountSheetRowClass}>
                        Mój kalendarz
                      </Link>
                      <Link href="/moje-wiadomosci" onClick={() => setActiveDropdown(null)} className={mobileAccountSheetRowClass}>
                        {t("header.conversationsNav")}
                      </Link>
                      <Link href="/ustawienia" onClick={() => setActiveDropdown(null)} className={mobileAccountSheetRowClass}>
                        Ustawienia
                      </Link>
                      {isCurrentUserAdmin ? (
                        <Link href="/admin" onClick={() => setActiveDropdown(null)} className={mobileAccountSheetRowClass}>
                          Panel admina
                        </Link>
                      ) : null}
                      {hasWorkshopPanelAccess ? (
                        <Link href="/workshop-panel" onClick={() => setActiveDropdown(null)} className={mobileAccountSheetRowClass}>
                          {t("workshop.panelTitle")}
                        </Link>
                      ) : null}
                      <div className={mobileAccountSheetDividerClass} aria-hidden />
                      <p
                        className={`px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide ${mobileAccountSheetSectionLabelClass}`}
                      >
                        Strona
                      </p>
                      {landingHeaderNavItems.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setActiveDropdown(null);
                            setLandingInfoPanel(item.key);
                          }}
                          className={mobileAccountSheetRowClass}
                        >
                          {item.label}
                        </button>
                      ))}
                      <div className={mobileAccountSheetDividerClass} aria-hidden />
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDropdown(null);
                          void handleLogout();
                        }}
                        className={mobileAccountSheetRowClass}
                      >
                        {t("auth.logout")}
                      </button>
                    </>
                  ) : (
                    <>
                      <p
                        className={`px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide ${mobileAccountSheetSectionLabelClass}`}
                      >
                        Konto
                      </p>
                      <button type="button" onClick={openLoginModal} className={mobileAccountSheetRowClass}>
                        {t("header.login")}
                      </button>
                      <button type="button" onClick={openRegisterModal} className={mobileAccountSheetRowClass}>
                        {t("header.register")}
                      </button>
                      <Link href="/dodaj-warsztat" onClick={() => setActiveDropdown(null)} className={mobileAccountSheetRowClass}>
                        {t("header.addWorkshop")}
                      </Link>
                      <div className={mobileAccountSheetDividerClass} aria-hidden />
                      <p
                        className={`px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide ${mobileAccountSheetSectionLabelClass}`}
                      >
                        Strona
                      </p>
                      {landingHeaderNavItems.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setActiveDropdown(null);
                            setLandingInfoPanel(item.key);
                          }}
                          className={mobileAccountSheetRowClass}
                        >
                          {item.label}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </MobileBottomSheet>

              <MobileBottomSheet
                isOpen={activeDropdown === "lang"}
                onClose={() => setActiveDropdown(null)}
                title={t("header.chooseLanguage")}
                isDark={isDark}
              >
                <div className="space-y-1">
                  {[
                    { code: "pl", label: t("language.pl"), flag: "🇵🇱" },
                    { code: "en", label: t("language.en"), flag: "🇬🇧" },
                    { code: "ua", label: t("language.ua"), flag: "🇺🇦" },
                  ].map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => selectLanguage(item.code as LanguageCode)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm hover:bg-blue-500/10"
                    >
                      <span>{item.flag} {item.label}</span>
                      {language === item.code ? <span>✓</span> : null}
                    </button>
                  ))}
                </div>
              </MobileBottomSheet>
            </>
          ) : null}

          <div id="o-nas" className="scroll-mt-28 grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${
                  isDark
                    ? "border-blue-400/25 bg-zinc-900/80 text-blue-200"
                    : "border-blue-200/90 bg-white/82 text-blue-700 shadow-[0_6px_18px_rgba(59,130,246,0.12)]"
                }`}
              >
                {t("hero.badge")}
              </span>
              <h1 className="mt-4 block max-w-3xl pb-4 text-3xl font-bold leading-[1.45] antialiased [-webkit-font-smoothing:antialiased] [text-rendering:optimizeLegibility] [text-wrap:balance] break-words sm:text-4xl md:text-5xl md:leading-[1.42]">
                {t("hero.titlePrefix")}{" "}
                <span className="relative inline-block max-w-full align-baseline pb-[0.22em] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] bg-gradient-to-r from-blue-500 to-blue-300 bg-clip-text font-bold text-transparent">
                  {t("hero.titleHighlightOffers")}
                </span>{" "}
                <span className="relative inline-block max-w-full align-baseline pb-[0.22em] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] bg-gradient-to-r from-orange-500 to-orange-300 bg-clip-text font-bold text-transparent">
                  {t("hero.titleHighlightRepairs")}
                </span>,{" "}
                <span className="relative inline-block max-w-full align-baseline pb-[0.22em] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text font-bold text-transparent">
                  {t("hero.titleHighlightReplacement")}
                </span>,{" "}
                <span className="relative inline-block max-w-full align-baseline pb-[0.22em] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] bg-gradient-to-r from-sky-400 to-blue-300 bg-clip-text font-bold text-transparent">
                  {t("hero.titleHighlightDiagnostics")}
                </span>
              </h1>
              <p
                className={`mt-4 max-w-2xl text-sm [text-wrap:balance] break-words sm:text-base md:text-lg ${
                  isDark ? "text-zinc-300" : "text-zinc-700"
                }`}
              >
                {t("hero.subtitle")}
              </p>
              <p
                className={`mt-3 max-w-2xl text-sm [text-wrap:balance] break-words sm:text-[15px] md:text-base ${
                  isDark ? "text-zinc-400" : "text-zinc-600"
                }`}
              >
                {t("hero.seoLead")}
              </p>
              <div className={`mt-4 h-px w-40 bg-gradient-to-r ${isDark ? "from-blue-500/70 via-orange-400/45 to-transparent" : "from-blue-500/60 via-orange-400/55 to-transparent"}`} />
              <div className="mt-6 flex flex-wrap gap-2 sm:gap-3">
                {heroChips.map((benefit) => (
                    <span
                      key={benefit}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-all duration-300 hover:-translate-y-0.5 sm:px-3 sm:text-sm ${
                        isDark
                          ? "border-blue-500/25 bg-[#08172c]/75 text-zinc-100 hover:border-orange-400/50 hover:shadow-[0_0_18px_rgba(59,130,246,0.26)]"
                          : "border-orange-300/90 bg-gradient-to-r from-white/86 via-sky-50/85 to-orange-50/90 text-zinc-700 shadow-[0_0_0_1px_rgba(59,130,246,0.1),0_10px_24px_rgba(249,115,22,0.12)] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.16),0_14px_26px_rgba(249,115,22,0.18)]"
                      }`}
                    >
                      {benefit}
                    </span>
                  ))}
              </div>
            </div>

            <div className="mt-5 lg:mt-0">
              <div className="relative flex h-[260px] w-full items-center justify-center sm:h-[320px] md:h-[380px] lg:h-[420px]">
                <div className="absolute -z-10 h-[120%] w-[120%] rounded-full bg-gradient-to-r from-blue-200/30 via-cyan-200/20 via-yellow-200/15 to-orange-200/30 blur-3xl" />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-orange-50 opacity-80 blur-2xl" />
                <div className="absolute right-20 top-10 h-40 w-40 rounded-full bg-blue-400/20 blur-3xl" />
                <div className="absolute bottom-10 left-10 h-32 w-32 rounded-full bg-orange-400/20 blur-3xl" />
                <img
                  src="/hero-servygo-illustration.png"
                  alt="ServyGo ilustracja"
                  className="relative z-10 h-full w-full select-none object-contain opacity-95 mix-blend-multiply pointer-events-none"
                  style={{
                    maskImage: "radial-gradient(circle at center, black 60%, transparent 100%)",
                    WebkitMaskImage: "radial-gradient(circle at center, black 60%, transparent 100%)",
                  }}
                />
              </div>
            </div>
          </div>

          <div
            className={`relative mt-8 overflow-hidden rounded-2xl border p-5 shadow-2xl backdrop-blur-xl max-md:p-3 max-md:pt-4 sm:p-6 md:p-8 ${
              isDark
                ? "border-blue-500/20 bg-gradient-to-br from-[#091427]/88 via-[#071224]/84 to-[#040a15]/80 text-zinc-100 shadow-blue-500/20"
                : "border border-blue-200/60 bg-white/85 text-zinc-900 shadow-[0_24px_70px_rgba(37,99,235,0.12),0_14px_40px_rgba(249,115,22,0.10)]"
            }`}
          >
            {!isDark ? (
              <>
                <div className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-blue-200/40 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 -right-12 h-52 w-52 rounded-full bg-orange-200/40 blur-3xl" />
              </>
            ) : null}
            <div className="flex flex-col gap-2 max-md:gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <h2 className="text-xl font-bold max-md:text-lg sm:text-2xl">
                {t("form.title")}
                <span className="ml-2 text-orange-400">•</span>
              </h2>
              {currentUser && vehicles.length > 0 ? (
                <div ref={carPickerRef} className="relative flex w-full flex-col gap-1 sm:w-[360px]">
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Wybierz auto</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCarPickerOpen((prev) => !prev);
                      setCarPickerQuery("");
                    }}
                    className={`${currentFieldClassName} flex items-center justify-between text-left`}
                  >
                    <span className="truncate">
                      {selectedSavedCar
                        ? savedCarOptions.find((x) => x.id === selectedSavedCar.id)?.label ?? "Wybierz auto"
                        : isManualMode
                          ? "Auto wpisywane ręcznie"
                          : "Wybierz auto"}
                    </span>
                    <span>▾</span>
                  </button>
                  {carPickerOpen ? (
                    <div className={`absolute left-0 right-0 top-[calc(100%+8px)] z-40 rounded-xl border p-2 ${isDark ? "border-zinc-700 bg-zinc-900" : "border-blue-200 bg-white"}`}>
                      <input
                        value={carPickerQuery}
                        onChange={(event) => setCarPickerQuery(event.target.value)}
                        placeholder="Szukaj auta..."
                        className={`${currentFieldClassName} mb-2`}
                      />
                      <div className="max-h-[min(240px,60vh)] overflow-y-auto [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSavedCarId("");
                            setIsManualMode(true);
                            setCarPickerQuery("");
                            setCarPickerOpen(false);
                            setVehicleType("");
                            setBrand("");
                            setModel("");
                            setYear("");
                            setFuel("");
                            setService("");
                            setSearchCity("");
                            setSearchVin("");
                          }}
                          className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${isDark ? "text-zinc-100 hover:bg-zinc-800" : "text-zinc-800 hover:bg-blue-50"}`}
                        >
                          Wpisz dane ręcznie
                        </button>
                        {filteredSavedCarOptions.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-zinc-500">Brak aut</p>
                        ) : (
                          filteredSavedCarOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setSelectedSavedCarId(option.id);
                                setIsManualMode(false);
                                setShowManualVehicle(false);
                                setCarPickerQuery("");
                                setCarPickerOpen(false);
                              }}
                              className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${selectedSavedCarId === option.id ? (isDark ? "bg-zinc-800 text-zinc-100" : "bg-blue-100 text-zinc-900") : (isDark ? "text-zinc-200 hover:bg-zinc-800" : "text-zinc-700 hover:bg-blue-50")}`}
                            >
                              {option.label}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p
              className={`mt-2 max-w-3xl text-sm max-md:mt-1 max-md:text-[13px] sm:text-base ${
                isDark ? "text-zinc-300" : "text-zinc-700"
              }`}
            >
              {t("form.subtitle")}
            </p>
            {currentUser && favoriteWorkshopChoices.length > 0 ? (
              <div
                className={`mt-4 rounded-xl border px-4 py-3 max-md:mt-2 max-md:px-3 max-md:py-2 ${
                  isDark ? "border-blue-500/30 bg-zinc-900/80" : "border-blue-200 bg-white/90"
                }`}
              >
                <label className="block text-xs font-semibold uppercase tracking-wide opacity-80">
                  Wybierz ulubiony warsztat
                </label>
                <select
                  value={selectedFavoriteWorkshopId ?? ""}
                  onChange={(e) => setSelectedFavoriteWorkshopId(e.target.value || null)}
                  className={`mt-2 w-full max-w-md rounded-xl border px-3 py-2 text-sm ${
                    isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-blue-200 bg-white text-zinc-900"
                  }`}
                >
                  <option value="">Szukaj we wszystkich warsztatach</option>
                  {favoriteWorkshopChoices.map((w) => (
                    <option key={w.workshopId} value={w.workshopId}>
                      {w.name}
                    </option>
                  ))}
                </select>
                {selectedFavoriteWorkshopId ? (
                  <p className={`mt-2 text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                    Tryb:{" "}
                    <span className="font-semibold">
                      {favoriteWorkshopChoices.find((x) => x.workshopId === selectedFavoriteWorkshopId)?.name ??
                        "wybrany warsztat"}
                    </span>
                    . Usługi są weryfikowane względem jego aktualnej oferty.
                  </p>
                ) : null}
                {favoriteWorkshopBanner ? (
                  <p className="mt-2 text-sm text-orange-600 dark:text-orange-300">{favoriteWorkshopBanner}</p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2 max-md:mt-2 max-md:gap-1.5">
              {vehicleTypeOptions.map((type) => {
                const active = vehicleType === type.key;
                return (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => {
                      clearSearchFieldError("vehicleType");
                      setVehicleType(type.key);
                      setBrand("");
                      setModel("");
                      setYear("");
                      setFuel("");
                      setService("");
                    }}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition max-md:px-2.5 max-md:py-1.5 max-md:text-xs ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : isDark
                          ? "border-zinc-700 bg-zinc-900/70 text-zinc-200 hover:border-blue-400/60"
                          : "border-blue-200 bg-white text-zinc-700 hover:border-blue-400"
                    }`}
                  >
                    {t(`form.vehicleTypes.${type.key}`)}
                  </button>
                );
              })}
            </div>
            <form
              id="servygo-search"
              onSubmit={handleSubmit}
              className="mt-6 grid grid-cols-1 gap-2 max-md:gap-2 max-md:pb-24 md:gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              <MobileCompactSearchField
                label={t("form.labels.vehicleType")}
                isDark={isDark}
                icon={searchFormFieldIconMap.vehicleType}
                error={
                  searchFieldErrors.vehicleType ? (
                    <p className={searchFieldErrorHintClass}>{searchFieldErrors.vehicleType}</p>
                  ) : null
                }
              >
                <AutocompleteSelect
                  value={vehicleType}
                  onChange={(nextValue) => {
                    clearSearchFieldError("vehicleType");
                    const selectedType = nextValue as VehicleTypeKey | "";
                    setVehicleType(selectedType);
                    setBrand("");
                    setModel("");
                    setYear("");
                    setService("");
                    setFuel("");
                  }}
                  options={vehicleTypeOptions.map((type) => ({
                    value: type.key,
                    label: t(`form.vehicleTypes.${type.key}`),
                  }))}
                  placeholder={t("form.selects.vehicleType")}
                  required
                  noResultsText={t("account.placeholders.noResults")}
                  rootClassName={searchFormAutocompleteShell}
                  toggleButtonClassName={searchFormChevronToggleHide}
                  inputClassName={`${currentFieldClassName}${searchFieldErrors.vehicleType ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
                  isDark={isDark}
                />
                <input type="hidden" name="vehicleType" value={vehicleType} />
              </MobileCompactSearchField>

              <MobileCompactSearchField
                label={t("form.labels.brand")}
                isDark={isDark}
                icon={searchFormFieldIconMap.brand}
                error={
                  searchFieldErrors.brand ? (
                    <p className={searchFieldErrorHintClass}>{searchFieldErrors.brand}</p>
                  ) : null
                }
              >
                <AutocompleteSelect
                  name="brand"
                  value={brand}
                  onChange={(nextBrand) => {
                    clearSearchFieldError("brand");
                    setBrand(nextBrand);
                    setModel("");
                  }}
                  options={brandsForVehicleType}
                  placeholder={
                    vehicleType ? t("form.selects.brand") : t("form.selects.chooseTypeFirst")
                  }
                  disabled={!vehicleType}
                  required
                  noResultsText={t("account.placeholders.noResults")}
                  rootClassName={searchFormAutocompleteShell}
                  toggleButtonClassName={searchFormChevronToggleHide}
                  inputClassName={`${currentFieldClassName}${searchFieldErrors.brand ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
                  isDark={isDark}
                />
              </MobileCompactSearchField>

              <MobileCompactSearchField
                label={t("form.labels.model")}
                isDark={isDark}
                icon={searchFormFieldIconMap.model}
                error={
                  searchFieldErrors.model ? (
                    <p className={searchFieldErrorHintClass}>{searchFieldErrors.model}</p>
                  ) : null
                }
              >
                <AutocompleteSelect
                  name="model"
                  value={model}
                  onChange={(nextModel) => {
                    clearSearchFieldError("model");
                    setModel(nextModel);
                  }}
                  options={modelsForBrand}
                  placeholder={brand ? t("form.selects.model") : t("form.selects.chooseBrandFirst")}
                  disabled={!brand}
                  required
                  noResultsText={t("account.placeholders.noResults")}
                  rootClassName={searchFormAutocompleteShell}
                  toggleButtonClassName={searchFormChevronToggleHide}
                  inputClassName={`${currentFieldClassName}${searchFieldErrors.model ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
                  isDark={isDark}
                />
              </MobileCompactSearchField>

              <MobileCompactSearchField
                label={t("form.labels.year")}
                isDark={isDark}
                icon={searchFormFieldIconMap.year}
                error={
                  searchFieldErrors.year ? (
                    <p className={searchFieldErrorHintClass}>{searchFieldErrors.year}</p>
                  ) : null
                }
              >
                <AutocompleteSelect
                  name="year"
                  value={year}
                  onChange={(nextYear) => {
                    clearSearchFieldError("year");
                    setYear(nextYear);
                  }}
                  options={years}
                  placeholder={t("form.selects.year")}
                  required
                  noResultsText={t("account.placeholders.noResults")}
                  rootClassName={searchFormAutocompleteShell}
                  toggleButtonClassName={searchFormChevronToggleHide}
                  inputClassName={`${currentFieldClassName}${searchFieldErrors.year ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
                  isDark={isDark}
                />
              </MobileCompactSearchField>

              <MobileCompactSearchField
                label={translatedFuelLabel}
                isDark={isDark}
                icon={searchFormFieldIconMap.fuel}
                error={
                  searchFieldErrors.fuel ? (
                    <p className={searchFieldErrorHintClass}>{searchFieldErrors.fuel}</p>
                  ) : null
                }
              >
                <AutocompleteSelect
                  name="fuel"
                  value={fuel}
                  onChange={(nextFuel) => {
                    clearSearchFieldError("fuel");
                    setFuel(nextFuel);
                  }}
                  options={fuelsForVehicleType}
                  placeholder={
                    vehicleType ? t("form.selects.fuel") : t("form.selects.chooseTypeFirst")
                  }
                  disabled={!vehicleType}
                  required
                  noResultsText={t("account.placeholders.noResults")}
                  rootClassName={searchFormAutocompleteShell}
                  toggleButtonClassName={searchFormChevronToggleHide}
                  inputClassName={`${currentFieldClassName}${searchFieldErrors.fuel ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
                  isDark={isDark}
                />
              </MobileCompactSearchField>

              <MobileCompactSearchField
                label={translatedServiceLabel}
                isDark={isDark}
                icon={searchFormFieldIconMap.service}
                error={
                  searchFieldErrors.service ? (
                    <p className={searchFieldErrorHintClass}>{searchFieldErrors.service}</p>
                  ) : null
                }
              >
                <ServiceCategoryPicker
                  value={service}
                  onChange={(next) => {
                    clearSearchFieldError("service");
                    setService(next);
                  }}
                  categories={serviceCatalogForVehicleType}
                  disabled={serviceCatalogForVehicleType.length === 0}
                  isDark={isDark}
                  toggleButtonClassName={searchFormChevronToggleHide}
                  inputClassName={`${currentFieldClassName}${searchFieldErrors.service ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
                  placeholder={t("form.selects.serviceCategory")}
                  noResultsText={t("account.placeholders.noResults")}
                  getFinalServiceAvailability={getFinalServiceAvailabilityFromFavorite}
                />
                <input type="hidden" name="service" value={service} />
                {selectedFavoriteWorkshopId && favoriteServiceBlocked ? (
                  <div className="mt-2 space-y-2 rounded-xl border border-red-300/50 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200">
                    <p>
                      Ta usługa nie jest dostępna w wybranym warsztacie. Wybierz inną usługę albo usuń filtr ulubionego
                      warsztatu.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFavoriteWorkshopId(null);
                        clearSearchFieldError("service");
                      }}
                      className="font-semibold underline decoration-red-600/60 hover:no-underline"
                    >
                      Szukaj we wszystkich warsztatach
                    </button>
                  </div>
                ) : null}
              </MobileCompactSearchField>

              <MobileCompactSearchField
                label={t("form.labels.problem")}
                isDark={isDark}
                icon={searchFormFieldIconMap.problem}
                variant="block"
              >
                <textarea
                  name="problem"
                  rows={3}
                  placeholder={t("form.placeholders.problem")}
                  className={`${currentFieldClassName} min-h-[100px] w-full max-md:min-h-[104px] max-md:px-2 max-md:py-2 max-md:text-base md:min-h-[120px]`}
                />
              </MobileCompactSearchField>

              <div className="grid grid-cols-1 gap-2 max-md:gap-2 md:col-span-2 md:grid-cols-2 md:gap-4 xl:col-span-3">
                <MobileCompactSearchField
                  label={t("form.labels.city")}
                  isDark={isDark}
                  icon={searchFormFieldIconMap.city}
                  error={
                    searchFieldErrors.city ? (
                      <p className={searchFieldErrorHintClass}>{searchFieldErrors.city}</p>
                    ) : null
                  }
                >
                  <input
                    type="text"
                    name="city"
                    value={searchCity}
                    onChange={(event) => {
                      clearSearchFieldError("city");
                      setSearchCity(event.target.value);
                    }}
                    placeholder={t("form.placeholders.city")}
                    className={`${currentFieldClassName}${searchFieldErrors.city ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
                  />
                </MobileCompactSearchField>
                <MobileCompactSearchField label={t("form.labels.vin")} isDark={isDark} icon={searchFormFieldIconMap.vin}>
                  <input
                    type="text"
                    name="vin"
                    maxLength={17}
                    value={searchVin}
                    onChange={(event) => setSearchVin(event.target.value.toUpperCase().slice(0, 17))}
                    placeholder={t("account.placeholders.vin")}
                    className={`${currentFieldClassName} ${searchFormControlMobileStrip}`}
                  />
                  <VinOptionalHint text={t("account.vehicle.vinHint")} isDark={isDark} />
                  {SHOW_MANUAL_MISSING_VEHICLE_UI ? (
                    <div className="mt-1 flex items-center gap-2 max-md:mt-1 md:mt-1">
                      <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>lub</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSavedCarId("");
                          setShowManualVehicle((prev) => !prev);
                          setVehicleType("");
                          setBrand("");
                          setModel("");
                          setYear("");
                          setFuel("");
                          setService("");
                          setSearchCity("");
                          setSearchVin("");
                        }}
                        className={`text-xs font-semibold ${isDark ? "text-blue-300 hover:text-orange-300" : "text-blue-700 hover:text-orange-600"}`}
                      >
                        {t("form.manual.toggleShow")}
                      </button>
                    </div>
                  ) : null}
                </MobileCompactSearchField>
              </div>

              <div
                className={`z-[1002] mt-1 grid grid-cols-1 gap-2 max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:mx-auto max-md:mt-0 max-md:w-full max-md:grid-cols-2 max-md:gap-2 max-md:border-t max-md:px-3 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] max-md:pt-2 max-md:backdrop-blur-xl md:static md:col-span-2 md:grid md:grid-cols-2 md:gap-3 md:border-0 md:px-0 md:pb-0 md:pt-0 xl:col-span-3 ${
                  isDark
                    ? "max-md:border-zinc-700/80 max-md:bg-zinc-950/95"
                    : "max-md:border-blue-200/90 max-md:bg-white/95"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSavedCarId("");
                    setShowManualVehicle(false);
                    setVehicleType("");
                    setBrand("");
                    setModel("");
                    setYear("");
                    setFuel("");
                    setService("");
                    setSearchCity("");
                    setSearchVin("");
                    setSearchFieldErrors({});
                    setMessage("");
                    setMessageType("");
                  }}
                  className={`inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-[1.01] max-md:h-10 md:h-12 md:px-6 md:py-3 md:text-base ${
                    isDark
                      ? "border-zinc-600 bg-zinc-900/70 text-zinc-100 hover:border-blue-400/60"
                      : "border-blue-200 bg-white text-zinc-800 hover:border-blue-500"
                  }`}
                >
                  Wyczyść filtry
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-10 w-full max-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(59,130,246,0.28),0_8px_22px_rgba(249,115,22,0.24)] transition-all duration-300 hover:scale-[1.01] hover:from-blue-500 hover:to-orange-400 hover:shadow-[0_14px_36px_rgba(59,130,246,0.35),0_10px_28px_rgba(249,115,22,0.3)] max-md:h-10 max-md:max-h-[48px] md:h-12 md:px-6 md:py-3 md:text-base"
                >
                  {isSubmitting ? t("form.buttons.submitting") : t("form.buttons.submit")}
                </button>
              </div>

              {SHOW_MANUAL_MISSING_VEHICLE_UI && showManualVehicle ? (
                <div
                  className={`md:col-span-2 rounded-2xl border p-4 sm:p-5 ${
                    isDark
                      ? "border-zinc-700/70 bg-zinc-900/70"
                      : "border-blue-200/80 bg-white/70"
                  }`}
                >
                  <h3 className="text-lg font-semibold">{t("form.manual.title")}</h3>
                  <p
                    className={`mt-2 text-sm ${
                      isDark ? "text-zinc-300" : "text-zinc-700"
                    }`}
                  >
                    {t("form.manual.subtitle")}
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("form.manual.labels.type")}</span>
                      <input
                        type="text"
                        name="manualType"
                        value={manualType}
                        onChange={(event) => setManualType(event.target.value)}
                        placeholder={t("form.manual.placeholders.type")}
                        className={currentFieldClassName}
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("form.manual.labels.brand")}</span>
                      <input
                        type="text"
                        name="manualBrand"
                        value={manualBrand}
                        onChange={(event) => setManualBrand(event.target.value)}
                        placeholder={t("form.manual.placeholders.brand")}
                        className={currentFieldClassName}
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("form.manual.labels.model")}</span>
                      <input
                        type="text"
                        name="manualModel"
                        value={manualModel}
                        onChange={(event) => setManualModel(event.target.value)}
                        placeholder={t("form.manual.placeholders.model")}
                        className={currentFieldClassName}
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("form.manual.labels.year")}</span>
                      <input
                        type="number"
                        name="manualYear"
                        min="1900"
                        max={maxManualYear}
                        value={manualYear}
                        onChange={(event) => setManualYear(event.target.value)}
                        placeholder={t("form.manual.placeholders.year")}
                        className={currentFieldClassName}
                      />
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-2">
                      <span className="text-sm font-medium">{t("form.manual.labels.description")}</span>
                      <textarea
                        name="manualDescription"
                        rows={3}
                        value={manualDescription}
                        onChange={(event) =>
                          setManualDescription(event.target.value)
                        }
                        placeholder={t("form.manual.placeholders.description")}
                        className={currentFieldClassName}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </form>
            {message ? (
              <p
                className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                  messageType === "error"
                    ? isDark
                      ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
                      : "border-orange-300 bg-orange-50 text-orange-700"
                    : isDark
                      ? "border-blue-400/30 bg-blue-500/15 text-blue-100"
                      : "border-blue-300 bg-blue-50 text-blue-700"
                }`}
              >
                {message}
              </p>
            ) : null}
          </div>
        </section>

        <UserCenterCards
          isDark={isDark}
          isLoggedIn={Boolean(currentUser)}
          favoriteWorkshopsCount={favoriteWorkshopsCount}
          dashboardBookingsCount={dashboardBookingsCount}
          triggerButtonClass={triggerButtonClass}
          ctaButtonClass={ctaButtonClass}
          onLogin={openLoginModal}
          onRegister={openRegisterModal}
        />
        <UserDetailsSection
          isDark={isDark}
          isLoggedIn={Boolean(currentUser)}
          sortedVehicles={sortedVehicles}
          dashboardUpcomingBooking={dashboardUpcomingBooking}
          steps={steps}
          onOpenAccountModal={openAccountModal}
        />
        <RecommendedWorkshopsSection isDark={isDark} city={searchCity} />
        <LandingCtaFooter
          isDark={isDark}
          onOpenContact={() => setLandingInfoPanel("contact")}
          onOpenFaq={() => setLandingInfoPanel("faq")}
        />

        {accountModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 max-md:p-0 max-md:items-stretch">
            <button
              type="button"
              onClick={closeAccountModal}
              className="absolute inset-0 bg-zinc-950/65 backdrop-blur-sm"
              aria-label={t("auth.closeModal")}
            />
            <div
              className={`relative z-[1] mx-auto flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:flex-1 max-md:rounded-none md:max-h-[96vh] md:max-w-5xl ${
                isDark
                  ? "border-blue-500/25 bg-zinc-900/92 text-zinc-100"
                  : "border-blue-200/85 bg-white/92 text-zinc-900"
              }`}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-blue-300/20 px-4 py-3 sm:px-6">
                <h3 className="text-xl font-semibold sm:text-2xl">{t("account.title")}</h3>
                <button
                  type="button"
                  onClick={closeAccountModal}
                  className={`rounded-lg px-2 py-1 text-sm transition ${
                    isDark ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-500 hover:bg-slate-100"
                  }`}
                >
                  ✕
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-0">
                <aside
                  className={`shrink-0 border-b border-blue-300/20 p-3 max-md:max-h-[min(260px,36vh)] max-md:min-h-0 max-md:overflow-y-auto max-md:[-webkit-overflow-scrolling:touch] md:border-b-0 md:max-h-none md:overflow-visible md:border-r ${
                    isDark ? "border-zinc-800" : "border-blue-100"
                  }`}
                >
                  <div className="grid grid-cols-1 gap-2">
                    {([
                      { key: "profile", label: t("account.tabs.profile") },
                      { key: "vehicles", label: t("account.tabs.vehicles") },
                      { key: "security", label: t("account.tabs.security") },
                      {
                        key: "messages",
                        label: `${t("header.conversationsTab")}${accountUnreadMessages > 0 ? ` (${accountUnreadMessages > 99 ? "99+" : accountUnreadMessages})` : ""}`,
                      },
                    ] as { key: AccountTab; label: string }[]).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setAccountTab(tab.key);
                          setAccountError("");
                          setAccountInfo("");
                        }}
                        className={`rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                          accountTab === tab.key
                            ? isDark
                              ? "bg-blue-500/20 text-blue-200"
                              : "bg-blue-100 text-blue-700"
                            : isDark
                              ? "bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800"
                              : "bg-white text-zinc-700 hover:bg-slate-50"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </aside>

                <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 pb-28 [-webkit-overflow-scrolling:touch] sm:px-6 sm:pb-28 md:max-h-none md:pb-12">
                  {!currentUser ? (
                    <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
                      isDark ? "border-orange-400/40 bg-orange-500/10 text-orange-200" : "border-orange-200 bg-orange-50 text-orange-700"
                    }`}>
                      {t("auth.errors.notLoggedIn")}
                    </p>
                  ) : null}
                  {accountLoading ? (
                    <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
                      isDark ? "border-blue-400/40 bg-blue-500/10 text-blue-100" : "border-blue-200 bg-blue-50 text-blue-700"
                    }`}>
                      {t("account.messages.loading")}
                    </p>
                  ) : null}
                  {accountError ? (
                    <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
                      isDark ? "border-orange-400/40 bg-orange-500/10 text-orange-200" : "border-orange-200 bg-orange-50 text-orange-700"
                    }`}>
                      {accountError}
                    </p>
                  ) : null}
                  {accountInfo ? (
                    <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
                      isDark ? "border-blue-400/40 bg-blue-500/10 text-blue-100" : "border-blue-200 bg-blue-50 text-blue-700"
                    }`}>
                      {accountInfo}
                    </p>
                  ) : null}

                  {accountTab === "profile" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium">{t("account.profile.firstName")}</span>
                        <input
                          type="text"
                          value={profileDraft.firstName}
                          onChange={(event) => setProfileDraft((prev) => ({ ...prev, firstName: event.target.value }))}
                          className={currentFieldClassName}
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium">
                          {t("account.profile.lastName")}{" "}
                          <span className={`text-xs font-normal ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                            {t("account.profile.lastNameOptional")}
                          </span>
                        </span>
                        <input
                          type="text"
                          value={profileDraft.lastName}
                          onChange={(event) => setProfileDraft((prev) => ({ ...prev, lastName: event.target.value }))}
                          className={currentFieldClassName}
                        />
                      </label>
                      <label className="flex flex-col gap-2 sm:col-span-2">
                        <span className="text-sm font-medium">{t("account.profile.reviewNickname")}</span>
                        <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                          {t("account.profile.reviewNicknameHint")}
                        </span>
                        <input
                          type="text"
                          value={profileDraft.reviewPublicNickname}
                          onChange={(event) =>
                            setProfileDraft((prev) => ({ ...prev, reviewPublicNickname: event.target.value }))
                          }
                          className={currentFieldClassName}
                        />
                      </label>
                      <label className={`flex items-start gap-3 sm:col-span-2 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                        <input
                          type="checkbox"
                          checked={profileDraft.shareFullLastNameWithWorkshops}
                          onChange={(event) =>
                            setProfileDraft((prev) => ({
                              ...prev,
                              shareFullLastNameWithWorkshops: event.target.checked,
                            }))
                          }
                          className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-400"
                        />
                        <span>
                          <span className="block text-sm font-medium">{t("account.profile.shareFullLastNameWithWorkshops")}</span>
                          <span className={`mt-1 block text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                            {t("account.profile.shareFullLastNameHint")}
                          </span>
                        </span>
                      </label>
                      <p className={`sm:col-span-2 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                        Pełne nazwisko, e-mail i telefon nie są publikowane przy opiniach ServyGo — zgodnie z{" "}
                        <Link
                          href="/polityka-prywatnosci"
                          className={`font-semibold underline underline-offset-2 ${isDark ? "text-sky-300 hover:text-orange-200" : "text-blue-700 hover:text-orange-600"}`}
                        >
                          Polityką prywatności
                        </Link>
                        .
                      </p>
                      <AutocompleteSelect
                        label={t("account.profile.country")}
                        value={profileDraft.country}
                        onChange={(value) => setProfileDraft((prev) => ({ ...prev, country: value }))}
                        options={countrySelectOptions}
                        placeholder={t("account.placeholders.country")}
                        noResultsText={t("account.placeholders.noResults")}
                        disabled={accountSaving || accountLoading}
                        isDark={isDark}
                        inputClassName={currentFieldClassName}
                      />
                      <AutocompleteSelect
                        label={t("account.profile.city")}
                        value={profileDraft.city}
                        onChange={(value) => setProfileDraft((prev) => ({ ...prev, city: value }))}
                        options={citySelectOptions}
                        placeholder={t("account.placeholders.city")}
                        noResultsText={t("account.placeholders.noResults")}
                        disabled={accountSaving || accountLoading}
                        isDark={isDark}
                        inputClassName={currentFieldClassName}
                      />
                      <button
                        type="button"
                        onClick={handleProfileSave}
                        disabled={accountSaving || accountLoading}
                        className="sm:col-span-2 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-5 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {accountSaving ? t("account.messages.saving") : t("account.profile.save")}
                      </button>
                    </div>
                  ) : null}

                  {accountTab === "vehicles" ? (
                    <div className="space-y-4">
                      <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                        Pełna lista i zarządzanie autami:{" "}
                        <Link
                          href="/moje-auta"
                          className={`font-semibold underline ${isDark ? "text-blue-300" : "text-blue-700"}`}
                          onClick={() => setAccountModalOpen(false)}
                        >
                          Moje auta
                        </Link>
                        .
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <AutocompleteSelect
                          label={t("account.vehicle.vehicleType")}
                          value={vehicleTypeDraft}
                          onChange={(value) => {
                            setVehicleTypeDraft(value);
                            setVehicleBrandDraft("");
                            setVehicleModelDraft("");
                            setVehicleFuelDraft("");
                          }}
                          options={accountVehicleTypeOptions}
                          placeholder={t("account.placeholders.vehicleType")}
                          noResultsText={t("account.placeholders.noResults")}
                          disabled={accountSaving || accountLoading}
                          isDark={isDark}
                          inputClassName={currentFieldClassName}
                        />
                        <AutocompleteSelect
                          label={t("account.vehicle.brand")}
                          value={vehicleBrandDraft}
                          onChange={(value) => {
                            setVehicleBrandDraft(value);
                            setVehicleModelDraft("");
                          }}
                          options={accountVehicleBrands}
                          placeholder={t("account.placeholders.brand")}
                          noResultsText={t("account.placeholders.noResults")}
                          disabled={!vehicleTypeDraft || accountSaving || accountLoading}
                          isDark={isDark}
                          inputClassName={currentFieldClassName}
                        />
                        <AutocompleteSelect
                          label={t("account.vehicle.model")}
                          value={vehicleModelDraft}
                          onChange={setVehicleModelDraft}
                          options={accountVehicleModels}
                          placeholder={t("account.placeholders.model")}
                          noResultsText={t("account.placeholders.noResults")}
                          disabled={!vehicleTypeDraft || !vehicleBrandDraft || accountSaving || accountLoading}
                          isDark={isDark}
                          inputClassName={currentFieldClassName}
                        />
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-medium">{t("account.vehicle.year")}</span>
                          <select
                            value={vehicleYearDraft}
                            onChange={(event) => setVehicleYearDraft(event.target.value)}
                            className={currentFieldClassName}
                            disabled={accountSaving || accountLoading}
                          >
                            <option value="">{t("account.placeholders.year")}</option>
                            {sortedYears.map((yearOption) => (
                              <option key={yearOption} value={yearOption}>
                                {yearOption}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-medium">{t("account.vehicle.registration")}</span>
                          <input value={vehicleRegistrationDraft} onChange={(event) => setVehicleRegistrationDraft(event.target.value)} className={currentFieldClassName} placeholder={t("account.placeholders.registration")} />
                        </label>
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-medium">{t("account.vehicle.vin")}</span>
                          <input
                            value={vehicleVinDraft}
                            onChange={(event) => setVehicleVinDraft(event.target.value.toUpperCase())}
                            className={currentFieldClassName}
                            placeholder={t("account.placeholders.vin")}
                          />
                          <VinOptionalHint text={t("account.vehicle.vinHint")} isDark={isDark} className="mt-0" />
                        </label>
                        <AutocompleteSelect
                          label={t("account.vehicle.fuel")}
                          value={vehicleFuelDraft}
                          onChange={setVehicleFuelDraft}
                          options={accountVehicleFuels}
                          placeholder={t("account.placeholders.fuel")}
                          noResultsText={t("account.placeholders.noResults")}
                          disabled={!vehicleTypeDraft || accountSaving || accountLoading}
                          isDark={isDark}
                          inputClassName={currentFieldClassName}
                        />
                        <AutocompleteSelect
                          label={t("account.vehicle.city")}
                          value={vehicleCityDraft}
                          onChange={setVehicleCityDraft}
                          options={citySelectOptions}
                          placeholder={t("account.placeholders.city")}
                          noResultsText={t("account.placeholders.noResults")}
                          disabled={accountSaving || accountLoading}
                          isDark={isDark}
                          inputClassName={currentFieldClassName}
                        />
                        <button
                          type="button"
                          onClick={handleVehicleAdd}
                          disabled={accountSaving || accountLoading}
                          className="sm:col-span-2 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-5 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {accountSaving ? t("account.messages.saving") : t("account.vehicle.add")}
                        </button>
                      </div>

                      <div>
                        <h4 className="mb-3 text-base font-semibold">{t("account.vehicle.listTitle")}</h4>
                        <div className="space-y-3">
                          {vehicles.length === 0 ? (
                            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>—</p>
                          ) : (
                            sortedVehicles.map((vehicle) => (
                              <article
                                key={vehicle.id}
                                className={`rounded-xl border p-3 overflow-hidden ${
                                  isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-100 bg-white/80"
                                }`}
                              >
                                <div className="flex flex-col gap-1">
                                  <p className="text-base font-semibold leading-snug sm:text-[17px]">
                                    {vehicle.brand} {vehicle.model}{" "}
                                    <span className={`font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>({vehicle.year})</span>
                                  </p>
                                  <p className={`text-xs leading-relaxed sm:text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                                    {vehicle.vehicleType ? getVehicleTypeLabel(vehicle.vehicleType) : "—"}
                                    {" · "}
                                    {vehicle.fuel || "—"}
                                    {" · "}
                                    {vehicle.registration || "—"}
                                  </p>
                                  {vehicle.vin ? (
                                    <p className={`text-xs leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                                      VIN: {vehicle.vin}
                                    </p>
                                  ) : null}
                                  {vehicle.city ? (
                                    <p className={`text-xs leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                                      {t("account.vehicle.city")}: {vehicle.city}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSetPrimaryVehicle(vehicle.id)}
                                    disabled={accountSaving || accountLoading}
                                    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap sm:px-3 sm:py-1.5 sm:text-sm ${
                                      vehicle.isPrimary
                                        ? "bg-blue-500 text-white"
                                        : isDark
                                          ? "bg-zinc-800 text-zinc-200"
                                          : "bg-slate-100 text-zinc-700"
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                  >
                                    {vehicle.isPrimary ? t("account.vehicle.primary") : t("account.vehicle.setPrimary")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => beginVehicleEdit(vehicle)}
                                    disabled={accountSaving || accountLoading}
                                    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap sm:px-3 sm:py-1.5 sm:text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                                      isDark ? "bg-zinc-800 text-zinc-200" : "bg-slate-100 text-zinc-700"
                                    }`}
                                  >
                                    {t("account.vehicle.edit")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleVehicleDelete(vehicle.id)}
                                    disabled={accountSaving || accountLoading}
                                    className="shrink-0 rounded-lg bg-orange-500/15 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-orange-500 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:py-1.5 sm:text-sm"
                                  >
                                    {t("account.vehicle.remove")}
                                  </button>
                                </div>
                                {editingVehicleId === vehicle.id && editVehicleDraft ? (
                                  <div className={`mt-3 grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-2 ${
                                    isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-100 bg-white/80"
                                  }`}>
                                    <input value={editVehicleDraft.brand} onChange={(e) => setEditVehicleDraft((prev) => prev ? { ...prev, brand: e.target.value } : prev)} className={currentFieldClassName} placeholder={t("account.vehicle.brand")} />
                                    <input value={editVehicleDraft.model} onChange={(e) => setEditVehicleDraft((prev) => prev ? { ...prev, model: e.target.value } : prev)} className={currentFieldClassName} placeholder={t("account.vehicle.model")} />
                                    <input value={editVehicleDraft.year} onChange={(e) => setEditVehicleDraft((prev) => prev ? { ...prev, year: e.target.value } : prev)} className={currentFieldClassName} placeholder={t("account.vehicle.year")} />
                                    <input value={editVehicleDraft.registration} onChange={(e) => setEditVehicleDraft((prev) => prev ? { ...prev, registration: e.target.value } : prev)} className={currentFieldClassName} placeholder={t("account.vehicle.registration")} />
                                    <input value={editVehicleDraft.fuel} onChange={(e) => setEditVehicleDraft((prev) => prev ? { ...prev, fuel: e.target.value } : prev)} className={currentFieldClassName} placeholder={t("account.vehicle.fuel")} />
                                    <input value={editVehicleDraft.city} onChange={(e) => setEditVehicleDraft((prev) => prev ? { ...prev, city: e.target.value } : prev)} className={currentFieldClassName} placeholder={t("account.vehicle.city")} />
                                    <input value={editVehicleDraft.vin} onChange={(e) => setEditVehicleDraft((prev) => prev ? { ...prev, vin: e.target.value.toUpperCase() } : prev)} className={`${currentFieldClassName} sm:col-span-2`} placeholder={t("account.vehicle.vin")} />
                                    <VinOptionalHint
                                      text={t("account.vehicle.vinHint")}
                                      isDark={isDark}
                                      className="sm:col-span-2"
                                    />
                                    <div className="sm:col-span-2 flex flex-wrap gap-2">
                                      <button type="button" onClick={() => void handleVehicleEditSave()} disabled={accountSaving || accountLoading} className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-60">
                                        {t("account.vehicle.save")}
                                      </button>
                                      <button type="button" onClick={cancelVehicleEdit} disabled={accountSaving || accountLoading} className={`rounded-lg px-3 py-1 text-sm ${isDark ? "bg-zinc-800 text-zinc-200" : "bg-slate-100 text-zinc-700"}`}>
                                        {t("account.vehicle.cancel")}
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </article>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {accountTab === "security" ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-medium">{t("account.security.changeEmail")}</span>
                          <input
                            type="email"
                            value={securityEmailDraft}
                            onChange={(event) => setSecurityEmailDraft(event.target.value)}
                            className={currentFieldClassName}
                            placeholder={t("auth.placeholders.email")}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleSecurityEmailSave}
                          disabled={accountSaving || accountLoading}
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {accountSaving ? t("account.messages.saving") : t("account.security.saveEmail")}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-medium">{t("account.security.changePhone")}</span>
                          <input
                            type="tel"
                            value={securityPhoneDraft}
                            onChange={(event) => setSecurityPhoneDraft(event.target.value)}
                            className={currentFieldClassName}
                            placeholder={t("auth.placeholders.phone")}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleSecurityPhoneSave}
                          disabled={accountSaving || accountLoading}
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {accountSaving ? t("account.messages.saving") : t("account.security.savePhone")}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowPasswordChange((prev) => !prev)}
                        className={`inline-flex w-full items-center justify-center rounded-xl border px-4 py-2 font-medium transition ${
                          isDark ? "border-blue-400/40 bg-zinc-900/70 hover:border-orange-400/60" : "border-blue-200 bg-white hover:border-orange-300"
                        }`}
                      >
                        {t("account.security.changePassword")}
                      </button>

                      {showPasswordChange ? (
                        <form onSubmit={handlePasswordUiSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-2">
                            <span className="text-sm font-medium">{t("account.security.newPassword")}</span>
                            <input type="password" value={securityPassword} onChange={(event) => setSecurityPassword(event.target.value)} className={currentFieldClassName} />
                          </label>
                          <label className="flex flex-col gap-2">
                            <span className="text-sm font-medium">{t("account.security.repeatPassword")}</span>
                            <input type="password" value={securityPasswordRepeat} onChange={(event) => setSecurityPasswordRepeat(event.target.value)} className={currentFieldClassName} />
                          </label>
                          <button
                            type="submit"
                            disabled={accountSaving || accountLoading}
                            className="sm:col-span-2 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {accountSaving ? t("account.messages.saving") : t("account.security.savePassword")}
                          </button>
                        </form>
                      ) : null}

                      <button
                        type="button"
                        onClick={handlePasswordResetEmail}
                        disabled={accountSaving || accountLoading}
                        className={`inline-flex w-full items-center justify-center rounded-xl border px-4 py-2 font-medium transition ${
                          isDark ? "border-blue-400/40 bg-zinc-900/70 hover:border-orange-400/60" : "border-blue-200 bg-white hover:border-orange-300"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {t("account.security.resetPassword")}
                      </button>

                      <div className={`rounded-xl border p-3 ${isDark ? "border-orange-400/30 bg-orange-500/10" : "border-orange-200 bg-orange-50/80"}`}>
                        <p className={`text-sm ${isDark ? "text-orange-200" : "text-orange-700"}`}>
                          {t("account.security.deleteWarning")}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setAccountInfo(t("account.security.deleteWarning"));
                            setAccountError("");
                          }}
                          className="mt-3 inline-flex rounded-lg bg-orange-500/15 px-3 py-1.5 text-sm font-medium text-orange-500"
                        >
                          {t("account.security.confirmDelete")}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {accountTab === "messages" && currentUser ? (
                    <InternalInbox
                      currentUserId={currentUser.id}
                      isDark={isDark}
                      viewerRole={accountViewerRole}
                      includeAllForAdmin={accountIncludeAllForAdmin}
                      onUnreadCountChange={setAccountUnreadMessages}
                      emptySidebarHint="Nie masz jeszcze wiadomości"
                      embeddedInPage
                    />
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        ) : null}

        {authModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <button
              type="button"
              onClick={closeAuthModal}
              className="absolute inset-0 bg-zinc-950/65 backdrop-blur-sm"
              aria-label={t("auth.closeModal")}
            />
            <div
              className={`relative z-[1] w-full max-w-[min(92vw,32rem)] rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl sm:p-7 ${
                isDark
                  ? "border-blue-500/25 bg-zinc-900/90 text-zinc-100"
                  : "border-blue-200/80 bg-white/90 text-zinc-900"
              }`}
            >
              <button
                type="button"
                onClick={closeAuthModal}
                className={`absolute right-4 top-4 rounded-lg px-2 py-1 text-sm transition ${
                  isDark ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-500 hover:bg-slate-100"
                }`}
              >
                ✕
              </button>

              {authModal === "login" ? (
                <>
                  <h3 className="text-2xl font-semibold">{t("auth.loginTitle")}</h3>
                  <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    {t("auth.loginSubtitle")}
                  </p>
                  <form onSubmit={handleLoginSubmit} className="mt-5 space-y-3">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("auth.fields.emailOrPhone")}</span>
                      <input
                        type="text"
                        value={loginIdentifier}
                        onChange={(event) => setLoginIdentifier(event.target.value)}
                        className={currentFieldClassName}
                        placeholder={t("auth.placeholders.emailOrPhone")}
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("auth.fields.password")}</span>
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(event) => setLoginPassword(event.target.value)}
                        className={currentFieldClassName}
                        placeholder={t("auth.placeholders.password")}
                      />
                    </label>

                    {authError ? (
                      <p className={`rounded-xl border px-3 py-2 text-sm ${
                        isDark ? "border-orange-400/40 bg-orange-500/10 text-orange-200" : "border-orange-200 bg-orange-50 text-orange-700"
                      }`}>
                        {authError}
                      </p>
                    ) : null}
                    {authInfo ? (
                      <p className={`rounded-xl border px-3 py-2 text-sm ${
                        isDark ? "border-blue-400/40 bg-blue-500/10 text-blue-100" : "border-blue-200 bg-blue-50 text-blue-700"
                      }`}>
                        {authInfo}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-5 font-semibold text-white transition-all duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {authLoading ? t("auth.buttons.loggingIn") : t("auth.buttons.login")}
                    </button>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className={`inline-flex h-11 w-full items-center justify-center rounded-xl border px-5 font-medium transition ${
                        isDark ? "border-blue-400/30 bg-zinc-900/60 hover:border-orange-400/50" : "border-blue-200 bg-white/80 hover:border-orange-300"
                      }`}
                    >
                      {t("auth.buttons.continueGoogle")}
                    </button>
                    <button
                      type="button"
                      onClick={handleAppleLogin}
                      className={`inline-flex h-11 w-full items-center justify-center rounded-xl border px-5 font-medium transition ${
                        isDark ? "border-blue-400/30 bg-zinc-900/60 hover:border-orange-400/50" : "border-blue-200 bg-white/80 hover:border-orange-300"
                      }`}
                    >
                      {t("auth.buttons.continueApple")}
                    </button>
                  </form>
                  <p className={`mt-4 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    {t("auth.switch.noAccount")}{" "}
                    <button
                      type="button"
                      onClick={openRegisterModal}
                      className="font-semibold text-blue-500 hover:text-orange-500"
                    >
                      {t("auth.switch.goRegister")}
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-semibold">{t("auth.registerTitle")}</h3>
                  <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    {t("auth.registerSubtitle")}
                  </p>
                  <form onSubmit={handleRegisterSubmit} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("auth.fields.firstName")}</span>
                      <input
                        type="text"
                        value={registerFirstName}
                        onChange={(event) => setRegisterFirstName(event.target.value)}
                        className={currentFieldClassName}
                        placeholder={t("auth.placeholders.firstName")}
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("auth.fields.lastName")}</span>
                      <input
                        type="text"
                        value={registerLastName}
                        onChange={(event) => setRegisterLastName(event.target.value)}
                        className={currentFieldClassName}
                        placeholder={t("auth.placeholders.lastName")}
                      />
                    </label>
                    <label className="flex flex-col gap-2 sm:col-span-2">
                      <span className="text-sm font-medium">{t("auth.fields.email")}</span>
                      <input
                        type="email"
                        value={registerEmail}
                        onChange={(event) => setRegisterEmail(event.target.value)}
                        className={currentFieldClassName}
                        placeholder={t("auth.placeholders.email")}
                      />
                    </label>
                    <label className="flex flex-col gap-2 sm:col-span-2">
                      <span className="text-sm font-medium">{t("auth.fields.phone")}</span>
                      <input
                        type="tel"
                        value={registerPhone}
                        onChange={(event) => setRegisterPhone(event.target.value)}
                        className={currentFieldClassName}
                        placeholder={t("auth.placeholders.phone")}
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("auth.fields.password")}</span>
                      <input
                        type="password"
                        value={registerPassword}
                        onChange={(event) => setRegisterPassword(event.target.value)}
                        className={currentFieldClassName}
                        placeholder={t("auth.placeholders.password")}
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("auth.fields.repeatPassword")}</span>
                      <input
                        type="password"
                        value={registerPasswordRepeat}
                        onChange={(event) => setRegisterPasswordRepeat(event.target.value)}
                        className={currentFieldClassName}
                        placeholder={t("auth.placeholders.repeatPassword")}
                      />
                    </label>
                    <label className={`sm:col-span-2 flex items-start gap-3 text-sm leading-snug ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                      <input
                        type="checkbox"
                        checked={registerLegalAccepted}
                        onChange={(event) => setRegisterLegalAccepted(event.target.checked)}
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
                        checked={registerMarketingConsent}
                        onChange={(event) => setRegisterMarketingConsent(event.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-400"
                      />
                      <span>
                        Chcę otrzymywać od ServyGo informacje o nowościach, promocjach i ofertach specjalnych drogą e-mailową
                        lub SMS. Zgodę mogę wycofać w każdej chwili.
                      </span>
                    </label>

                    {authError ? (
                      <p className={`sm:col-span-2 rounded-xl border px-3 py-2 text-sm ${
                        isDark ? "border-orange-400/40 bg-orange-500/10 text-orange-200" : "border-orange-200 bg-orange-50 text-orange-700"
                      }`}>
                        {authError}
                      </p>
                    ) : null}
                    {authInfo ? (
                      <p className={`sm:col-span-2 rounded-xl border px-3 py-2 text-sm ${
                        isDark ? "border-blue-400/40 bg-blue-500/10 text-blue-100" : "border-blue-200 bg-blue-50 text-blue-700"
                      }`}>
                        {authInfo}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="sm:col-span-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-5 font-semibold text-white transition-all duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {authLoading ? t("auth.buttons.registering") : t("auth.buttons.register")}
                    </button>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className={`sm:col-span-2 inline-flex h-11 w-full items-center justify-center rounded-xl border px-5 font-medium transition ${
                        isDark ? "border-blue-400/30 bg-zinc-900/60 hover:border-orange-400/50" : "border-blue-200 bg-white/80 hover:border-orange-300"
                      }`}
                    >
                      {t("auth.buttons.continueGoogle")}
                    </button>
                    <button
                      type="button"
                      onClick={handleAppleLogin}
                      className={`sm:col-span-2 inline-flex h-11 w-full items-center justify-center rounded-xl border px-5 font-medium transition ${
                        isDark ? "border-blue-400/30 bg-zinc-900/60 hover:border-orange-400/50" : "border-blue-200 bg-white/80 hover:border-orange-300"
                      }`}
                    >
                      {t("auth.buttons.continueApple")}
                    </button>
                  </form>
                  <p className={`mt-4 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    {t("auth.switch.hasAccount")}{" "}
                    <button
                      type="button"
                      onClick={openLoginModal}
                      className="font-semibold text-blue-500 hover:text-orange-500"
                    >
                      {t("auth.switch.goLogin")}
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
        ) : null}

        <LandingInfoDialogs
          panel={landingInfoPanel}
          onClose={() => setLandingInfoPanel(null)}
          onDriversSeeHow={() => setLandingInfoPanel("howItWorks")}
          language={language}
          isDark={isDark}
        />
      </main>
    </div>
  );
}

export default function HomePageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
          Wczytywanie…
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
