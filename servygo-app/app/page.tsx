"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import AutocompleteSelect from "@/components/AutocompleteSelect";
import ServiceCategoryPicker from "@/components/ServiceCategoryPicker";
import { countryOptions, polishCityOptions } from "@/lib/locationData";
import { isAdmin } from "@/lib/adminApi";
import { getServiceCatalogByVehicleType } from "@/lib/serviceCatalog";
import { getUserActiveWorkshop } from "@/lib/workshopApi";
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
  vehicleData,
  vehicleTypeOptions,
  type VehicleTypeKey,
} from "@/lib/vehicleData";
type ActiveDropdown = "user" | "lang" | "theme" | null;
type AuthModalType = "login" | "register" | null;
type AccountTab = "profile" | "vehicles" | "security";

type UserProfileDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
};

type StoredVehicle = {
  id: string;
  vehicleType: string;
  brand: string;
  model: string;
  year: string;
  registration: string;
  fuel: string;
  vin: string;
  city: string;
  isPrimary: boolean;
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
  created_at: string | null;
  updated_at: string | null;
};

type Car = {
  id: string;
  user_id: string;
  vehicle_type: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  fuel: string | null;
  plate_number: string | null;
  vin: string | null;
  city: string | null;
  is_primary: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

const fieldClassName =
  "rounded-xl border border-zinc-600/70 bg-zinc-900/70 px-4 py-3 text-zinc-100 placeholder:text-zinc-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:shadow-[0_0_0_1px_rgba(249,115,22,0.5),0_0_30px_rgba(37,99,235,0.35)]";

const lightFieldClassName =
  "rounded-xl border border-blue-200/80 bg-slate-100/85 px-4 py-3 text-zinc-900 placeholder:text-zinc-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300/60 focus:shadow-[0_0_0_1px_rgba(249,115,22,0.35),0_0_20px_rgba(37,99,235,0.2)]";

const LOCAL_CLEANUP_VERSION_KEY = "servygo_local_cleanup_v1";

export default function Home() {
  const router = useRouter();
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
  const [showManualVehicle, setShowManualVehicle] = useState(false);
  const [manualType, setManualType] = useState("");
  const [manualBrand, setManualBrand] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualYear, setManualYear] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [years, setYears] = useState<string[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);
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
  const [profileDraft, setProfileDraft] = useState<UserProfileDraft>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    city: "",
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
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordRepeat, setRegisterPasswordRepeat] = useState("");
  const headerRef = useRef<HTMLDivElement | null>(null);

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
    const darkLogo = new window.Image();
    darkLogo.src = "/servygo-logo-dark-cropped.png";
    const lightLogo = new window.Image();
    lightLogo.src = "/servygo-logo-light-cropped.png";
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
    async function checkAdminAccess() {
      if (!supabase || !currentUser) {
        setIsCurrentUserAdmin(false);
        return;
      }

      try {
        const hasAdminAccess = await isAdmin(currentUser.id, currentUser.email);
        setIsCurrentUserAdmin(hasAdminAccess);
      } catch {
        setIsCurrentUserAdmin(false);
      }
    }

    checkAdminAccess();
  }, [currentUser]);

  useEffect(() => {
    if (!supabase || !currentUser) {
      setSelectedSavedCarId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const cars = await getUserCars(currentUser.id);
        if (cancelled) return;
        const mapped = cars.map(mapCarToStored);
        setVehicles(mapped);
        const primary = mapped.find((x) => x.isPrimary) ?? mapped[0] ?? null;
        setSelectedSavedCarId(primary?.id ?? "");
      } catch {
        if (!cancelled) {
          setVehicles([]);
          setSelectedSavedCarId("");
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
  }, [selectedSavedCarId, vehicles]);

  const currentVehicleConfig = vehicleType ? vehicleData[vehicleType] : null;
  const brandsForVehicleType = getVehicleBrands(vehicleType);
  const fuelsForVehicleType = getVehicleFuels(vehicleType);
  const serviceCatalogForVehicleType = useMemo(
    () => getServiceCatalogByVehicleType(vehicleType),
    [vehicleType],
  );
  const fuelLabel = currentVehicleConfig?.fuelLabel ?? "Silnik / paliwo";
  const serviceLabel = currentVehicleConfig?.serviceLabel ?? "Czego potrzebujesz?";
  const t = useMemo(() => createTranslator(language), [language]);
  const translatedFuelLabel = language === "pl" ? fuelLabel : t("form.labels.fuel");
  const translatedServiceLabel = language === "pl" ? serviceLabel : t("form.labels.service");
  const heroChips =
    (getTranslationNode("hero.chips", language) as string[] | undefined) ??
    (getTranslationNode("hero.chips", "pl") as string[] | undefined) ??
    [];
  const translatedComingSoonTypes =
    (getTranslationNode("form.comingSoonTypes", language) as string[] | undefined) ??
    (getTranslationNode("form.comingSoonTypes", "pl") as string[] | undefined) ??
    [];
  const steps =
    (getTranslationNode("sections.steps", language) as
      | { title: string; desc: string }[]
      | undefined) ??
    (getTranslationNode("sections.steps", "pl") as
      | { title: string; desc: string }[]
      | undefined) ??
    [];
  const driverBenefits =
    (getTranslationNode("sections.driverBenefits", language) as string[] | undefined) ??
    (getTranslationNode("sections.driverBenefits", "pl") as string[] | undefined) ??
    [];
  const workshopBenefits =
    (getTranslationNode("sections.workshopBenefits", language) as
      | string[]
      | undefined) ??
    (getTranslationNode("sections.workshopBenefits", "pl") as string[] | undefined) ??
    [];

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
    () => polishCityOptions.map((city) => ({ value: city, label: city })),
    [],
  );
  const currentFieldClassName = isDark ? fieldClassName : lightFieldClassName;
  const headerShellClass = isDark
    ? "mb-8 w-full max-w-full rounded-3xl border border-blue-500/25 bg-zinc-950/70 px-3 py-3 shadow-[0_20px_70px_rgba(2,6,23,0.65)] backdrop-blur-2xl sm:px-4 md:px-8 md:py-[1.125rem]"
    : "mb-8 w-full max-w-full rounded-3xl border border-transparent bg-white/58 px-3 py-3 shadow-[0_22px_65px_rgba(37,99,235,0.12),0_14px_34px_rgba(249,115,22,0.1)] ring-1 ring-inset ring-[rgba(59,130,246,0.28)] backdrop-blur-2xl sm:px-4 md:px-8 md:py-[1.125rem]";
  const triggerButtonClass = isDark
    ? "inline-flex h-10 max-w-full items-center gap-1.5 rounded-xl border border-zinc-700/80 bg-zinc-900/78 px-2.5 text-xs font-medium text-zinc-100 shadow-[0_0_24px_rgba(15,23,42,0.5)] transition-all duration-300 hover:border-blue-400/60 hover:text-blue-300 sm:h-12 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm md:h-14 md:px-5 md:text-base"
    : "inline-flex h-10 max-w-full items-center gap-1.5 rounded-xl border border-blue-200/75 bg-white/82 px-2.5 text-xs font-medium text-slate-700 shadow-[0_0_24px_rgba(15,23,42,0.08)] transition-all duration-300 hover:border-orange-300/80 hover:text-blue-700 sm:h-12 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm md:h-14 md:px-5 md:text-base";
  const userTriggerButtonClass = isDark
    ? "inline-flex h-10 max-w-full items-center gap-1.5 rounded-xl border border-zinc-700/80 bg-zinc-900/78 px-2.5 text-xs text-zinc-100 shadow-[0_0_24px_rgba(15,23,42,0.5)] transition-all duration-300 hover:border-blue-400/60 hover:text-blue-300 sm:h-12 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm md:h-14 md:px-4 md:text-base"
    : "inline-flex h-10 max-w-full items-center gap-1.5 rounded-xl border border-blue-200/75 bg-white/82 px-2.5 text-xs text-slate-700 shadow-[0_0_24px_rgba(15,23,42,0.08)] transition-all duration-300 hover:border-orange-300/80 hover:text-blue-700 sm:h-12 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm md:h-14 md:px-4 md:text-base";
  const ctaButtonClass = isDark
    ? "inline-flex h-10 max-w-full items-center justify-center gap-1.5 rounded-xl border border-blue-400/40 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-2.5 text-xs font-semibold text-white shadow-[0_0_28px_rgba(59,130,246,0.28)] transition-all duration-300 hover:brightness-110 sm:h-12 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm md:h-14 md:px-5 md:text-base"
    : "inline-flex h-10 max-w-full items-center justify-center gap-1.5 rounded-xl border border-blue-300/80 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-2.5 text-xs font-semibold text-white shadow-[0_0_28px_rgba(59,130,246,0.22)] transition-all duration-300 hover:brightness-110 sm:h-12 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm md:h-14 md:px-5 md:text-base";
  const dropdownPanelClass = isDark
    ? "rounded-2xl border border-blue-500/25 bg-zinc-900/95 p-2 shadow-2xl shadow-blue-900/30 backdrop-blur-xl"
    : "rounded-2xl border border-blue-200/85 bg-white/90 p-2 shadow-2xl shadow-slate-300/40 ring-1 ring-orange-200/45 backdrop-blur-xl";
  const dropdownSectionLabelClass = isDark
    ? "my-1 border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500"
    : "my-1 border-t border-slate-200 px-3 py-2 text-xs text-slate-500";
  const dropdownHintClass = isDark ? "px-3 py-2 text-sm text-zinc-400" : "px-3 py-2 text-sm text-slate-500";
  const dropdownSubtextClass = isDark ? "block text-xs text-zinc-400" : "block text-xs text-slate-500";
  const pageBaseClass = isDark
    ? "relative overflow-hidden bg-gradient-to-br from-[#020617] via-[#06102a] to-[#020617] text-zinc-100"
    : "relative overflow-hidden bg-gradient-to-br from-[#f2f7ff] via-[#fbfdff] to-[#fff4e8] text-zinc-900";
  const pageGlowClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_520px_at_86%_-8%,rgba(59,130,246,0.34),transparent_62%),radial-gradient(980px_480px_at_-8%_102%,rgba(249,115,22,0.18),transparent_70%),radial-gradient(760px_360px_at_52%_45%,rgba(56,189,248,0.12),transparent_72%)]"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(1220px_560px_at_88%_-8%,rgba(59,130,246,0.34),transparent_62%),radial-gradient(1040px_560px_at_-8%_102%,rgba(249,115,22,0.32),transparent_70%),radial-gradient(820px_390px_at_52%_44%,rgba(251,146,60,0.16),transparent_72%)]";
  const pageMeshClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(59,130,246,0.1),transparent_42%),radial-gradient(circle_at_78%_74%,rgba(251,146,60,0.08),transparent_48%)] opacity-75 mix-blend-screen"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(59,130,246,0.14),transparent_42%),radial-gradient(circle_at_78%_74%,rgba(251,146,60,0.16),transparent_50%)] opacity-90";
  const pageNoiseClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20"
    : "pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.022)_1px,transparent_1px)] bg-[size:48px_48px] opacity-35";
  const pagePatternClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:22px_22px] opacity-10"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(37,99,235,0.08)_1px,transparent_1px)] bg-[size:22px_22px] opacity-45";
  const pageIllustrationClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[url('/servygo-flow-bg.png')] bg-no-repeat bg-[length:116%] bg-[position:56%_40%] opacity-[0.22] saturate-[0.78] contrast-[1.08] hue-rotate-[182deg] invert-[0.9]"
    : "pointer-events-none absolute inset-0 bg-[url('/servygo-flow-bg.png')] bg-no-repeat bg-[length:116%] bg-[position:56%_40%] opacity-[0.29] saturate-[1.08] contrast-[1.04]";
  const pageIllustrationMaskClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(280px_170px_at_49%_52%,rgba(2,6,23,0.95),transparent_72%)]"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(280px_170px_at_49%_52%,rgba(248,251,255,0.95),transparent_72%)]";
  const sectionCardClass = isDark
    ? "relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 p-7 shadow-[0_10px_30px_rgba(2,6,23,0.55)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(59,130,246,0.2),0_8px_22px_rgba(249,115,22,0.12)]"
    : "relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-white/82 via-sky-50/75 to-orange-50/72 p-7 shadow-[0_18px_40px_rgba(37,99,235,0.12),0_10px_28px_rgba(249,115,22,0.12)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(37,99,235,0.18),0_12px_30px_rgba(249,115,22,0.17)]";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setMessage("");
    setMessageType("");

    const resolvedBrand = String(formData.get("brand") ?? "").trim();
    const resolvedModel = String(formData.get("model") ?? "").trim();
    const resolvedYear = String(formData.get("year") ?? "").trim();
    const resolvedFuel = String(formData.get("fuel") ?? "").trim();

    const requiredFields = ["vehicleType", "service", "city"];
    const missingField = requiredFields.find((field) => {
      const value = String(formData.get(field) ?? "").trim();
      return value === "";
    });

    if (missingField || !resolvedBrand || !resolvedModel || !resolvedYear || !resolvedFuel) {
      setMessage(t("form.messages.requiredFields"));
      setMessageType("error");
      return;
    }

    const hasSelectedVehicle =
      String(formData.get("vehicleType") ?? "").trim() !== "" &&
      resolvedBrand !== "" &&
      resolvedModel !== "" &&
      resolvedYear !== "";

    const hasManualVehicle =
      String(formData.get("manualType") ?? "").trim() !== "" &&
      String(formData.get("manualBrand") ?? "").trim() !== "" &&
      String(formData.get("manualModel") ?? "").trim() !== "" &&
      String(formData.get("manualYear") ?? "").trim() !== "";

    if (!hasSelectedVehicle && !hasManualVehicle) {
      setMessage(t("form.messages.chooseVehicle"));
      setMessageType("error");
      return;
    }

    if (hasSelectedVehicle) {
      const selectedService = String(formData.get("service") ?? "").trim();
      if (!resolvedFuel || !selectedService) {
        setMessage(t("form.messages.fillFuelService"));
        setMessageType("error");
        return;
      }
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
      manualVehicle: {
        type: formData.get("manualType"),
        brand: formData.get("manualBrand"),
        model: formData.get("manualModel"),
        year: formData.get("manualYear"),
        description: formData.get("manualDescription"),
      },
      vehicleSource: hasSelectedVehicle ? "lista" : "reczne_dodanie",
    };

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
    const problemText = String(payload.problem ?? "").trim();
    if (problemText) {
      query.set("problem", problemText);
    }
    setIsSubmitting(false);
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
    const payload = {
      id: userId,
      first_name: profile.first_name ?? null,
      last_name: profile.last_name ?? null,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      country: profile.country ?? null,
      city: profile.city ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;
    return data as Profile;
  }

  async function getUserCars(userId: string): Promise<Car[]> {
    if (!supabase) throw new Error("Supabase client not available.");
    const { data, error } = await supabase
      .from("cars")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .returns<Car[]>();
    if (error) throw error;
    return (data as Car[] | null) ?? [];
  }

  async function addUserCar(
    userId: string,
    vehicle: Omit<Car, "id" | "user_id" | "created_at" | "updated_at">,
  ): Promise<Car> {
    if (!supabase) throw new Error("Supabase client not available.");
    const { data, error } = await supabase
      .from("cars")
      .insert({
        user_id: userId,
        vehicle_type: vehicle.vehicle_type,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        fuel: vehicle.fuel,
        plate_number: vehicle.plate_number,
        vin: vehicle.vin,
        city: vehicle.city,
        is_primary: vehicle.is_primary ?? false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as Car;
  }

  async function deleteUserCar(carId: string) {
    if (!supabase) throw new Error("Supabase client not available.");
    const { error } = await supabase.from("cars").delete().eq("id", carId);
    if (error) throw error;
  }

  async function updateUserCar(
    userId: string,
    carId: string,
    vehicle: Omit<Car, "id" | "user_id" | "created_at" | "updated_at">,
  ): Promise<Car> {
    if (!supabase) throw new Error("Supabase client not available.");
    const { data, error } = await supabase
      .from("cars")
      .update({
        vehicle_type: vehicle.vehicle_type,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        fuel: vehicle.fuel,
        plate_number: vehicle.plate_number,
        vin: vehicle.vin,
        city: vehicle.city,
        is_primary: vehicle.is_primary ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", carId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return data as Car;
  }

  async function setPrimaryCar(userId: string, carId: string) {
    if (!supabase) throw new Error("Supabase client not available.");
    const { error: clearError } = await supabase
      .from("cars")
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (clearError) throw clearError;

    const { error: setError } = await supabase
      .from("cars")
      .update({ is_primary: true, updated_at: new Date().toISOString() })
      .eq("id", carId)
      .eq("user_id", userId);
    if (setError) throw setError;
  }

  function mapCarToStored(car: Car): StoredVehicle {
    return {
      id: car.id,
      vehicleType: car.vehicle_type ?? "",
      brand: car.brand ?? "",
      model: car.model ?? "",
      year: car.year ? String(car.year) : "",
      registration: car.plate_number ?? "",
      fuel: car.fuel ?? "",
      vin: car.vin ?? "",
      city: car.city ?? "",
      isPrimary: Boolean(car.is_primary),
    };
  }

  const loadAccountData = useCallback(async () => {
    if (!supabase || !currentUser) return;

    setAccountLoading(true);
    setAccountError("");

    try {
      const metadata = (currentUser.user_metadata ?? {}) as Record<string, unknown>;
      const metadataFirstName = typeof metadata.first_name === "string" ? metadata.first_name : "";
      const metadataLastName = typeof metadata.last_name === "string" ? metadata.last_name : "";
      const metadataFullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
      const [fullNameFirst = "", ...fullNameRest] = metadataFullName ? metadataFullName.split(/\s+/) : [];
      const fullNameLast = fullNameRest.join(" ").trim();
      const metadataPhone = typeof metadata.phone === "string" ? metadata.phone : "";

      let profile = await getUserProfile(currentUser.id);
      if (!profile) {
        profile = await upsertUserProfile(currentUser.id, {
          first_name: pickFirstNonEmpty(metadataFirstName, fullNameFirst),
          last_name: pickFirstNonEmpty(metadataLastName, fullNameLast),
          email: currentUser.email ?? null,
          phone: metadataPhone,
          country: "",
          city: "",
        });
      }

      const cars = await getUserCars(currentUser.id);
      setProfileDraft({
        firstName: pickFirstNonEmpty(profile.first_name ?? undefined, metadataFirstName, fullNameFirst),
        lastName: pickFirstNonEmpty(profile.last_name ?? undefined, metadataLastName, fullNameLast),
        email: pickFirstNonEmpty(currentUser.email),
        phone: pickFirstNonEmpty(profile.phone ?? undefined, metadataPhone),
        country: profile.country ?? "",
        city: profile.city ?? "",
      });
      setSecurityEmailDraft(currentUser.email ?? "");
      setSecurityPhoneDraft(pickFirstNonEmpty(profile.phone ?? undefined, metadataPhone));
      setVehicles(cars.map(mapCarToStored));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("account.messages.loadError");
      setAccountError(message);
    } finally {
      setAccountLoading(false);
    }
  }, [currentUser, t]);

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
    if (!first || !last) {
      setAccountError(t("account.validation.profileNameRequired"));
      setAccountInfo("");
      return;
    }

    setAccountSaving(true);
    try {
      const data = await upsertUserProfile(currentUser.id, {
        first_name: first,
        last_name: last,
        email: currentUser.email ?? null,
        phone: profileDraft.phone.trim(),
        country: profileDraft.country.trim(),
        city: profileDraft.city.trim(),
      });
      const nextProfile = {
        ...profileDraft,
        firstName: data.first_name ?? "",
        lastName: data.last_name ?? "",
        phone: data.phone ?? "",
        country: data.country ?? "",
        city: data.city ?? "",
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
      const inserted = await addUserCar(currentUser.id, {
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
      await deleteUserCar(vehicleId);
      const nextVehicles = vehicles.filter((vehicle) => vehicle.id !== vehicleId);
      if (!nextVehicles.some((vehicle) => vehicle.isPrimary) && nextVehicles.length > 0) {
        await setPrimaryCar(currentUser.id, nextVehicles[0].id);
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
      const updated = await updateUserCar(currentUser.id, editingVehicleId, {
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
      await setPrimaryCar(currentUser.id, vehicleId);
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

    const { data } = await supabase.auth.getUser();
    if (data.user) {
      try {
        const hasAdminAccess = await isAdmin(data.user.id, data.user.email);
        if (hasAdminAccess) {
          router.push("/admin");
          return;
        }
        const activeWorkshop = await getUserActiveWorkshop(data.user.id);
        if (activeWorkshop) {
          router.push("/workshop-panel");
        }
      } catch {
        // Keep default user flow when workshop check fails.
      }
    }
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

    if (data.user && data.session) {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      if (profileError) {
        console.warn("Profile upsert after signup failed:", profileError.message);
        setAuthInfo(t("auth.info.accountCreatedProfileLater"));
      }
    }

    setAuthLoading(false);
    setAuthAttemptCount(0);
    setAuthBlockedUntil(null);
    setAuthInfo(t("auth.info.accountCreated"));
    setAuthModal("login");
    setRegisterFirstName("");
    setRegisterLastName("");
    setRegisterEmail("");
    setRegisterPhone("");
    setRegisterPassword("");
    setRegisterPasswordRepeat("");
  }

  return (
    <div className={`min-h-screen ${pageBaseClass}`}>
      <div className={pageIllustrationClass} />
      <div className={pageIllustrationMaskClass} />
      <div className={pageGlowClass} />
      <div className={pageMeshClass} />
      <div className={pageNoiseClass} />
      <div className={pagePatternClass} />
      <main className="relative z-[1] mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <section
          className={`relative overflow-hidden rounded-3xl border px-5 py-8 sm:px-7 sm:py-10 md:px-10 md:py-12 ${
            isDark
              ? "border-blue-500/20 bg-gradient-to-b from-[#061225] via-[#050d1d] to-[#02050b]"
              : "border-blue-200/80 bg-gradient-to-b from-white/60 via-[#f7fbff]/70 to-[#fff4e9]/78 shadow-[0_24px_65px_rgba(37,99,235,0.14),0_20px_46px_rgba(249,115,22,0.13)] backdrop-blur-[2px]"
          }`}
        >
          {isDark ? (
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.18),transparent_45%),radial-gradient(ellipse_at_bottom_left,rgba(249,115,22,0.1),transparent_45%)]" />
          ) : null}
          <div className="pointer-events-none absolute -top-24 right-[-80px] h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-120px] left-[-120px] h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="pointer-events-none absolute left-1/3 top-1/3 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl" />
          <div className={`pointer-events-none absolute right-8 top-24 h-24 w-24 rounded-full blur-2xl ${isDark ? "bg-blue-500/25" : "bg-blue-300/45"}`} />
          <div className={`pointer-events-none absolute bottom-10 left-10 h-28 w-28 rounded-full blur-3xl ${isDark ? "bg-orange-500/15" : "bg-orange-300/45"}`} />

          <div
            ref={headerRef}
            className={headerShellClass}
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
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
                className="h-10 w-auto max-w-[160px] self-start object-contain sm:h-12 sm:max-w-[190px] md:mr-6 md:h-16 md:max-w-[256px]"
              />

              <div className="relative flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3 md:gap-4">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDropdown((prev) => (prev === "user" ? null : "user"))
                    }
                    className={userTriggerButtonClass}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="8" r="3.5" />
                      <path d="M5 19a7 7 0 0 1 14 0" />
                    </svg>
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="m5 7 5 6 5-6" />
                    </svg>
                  </button>
                  <div
                    className={`absolute left-0 top-[calc(100%+10px)] z-30 w-[min(92vw,360px)] max-w-[92vw] origin-top ${dropdownPanelClass} transition-all duration-200 sm:left-auto sm:right-0 sm:w-72 sm:max-w-none sm:origin-top-right ${
                      activeDropdown === "user"
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none -translate-y-2 opacity-0"
                    }`}
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
                        {!isCurrentUserAdmin ? (
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

                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDropdown((prev) => (prev === "lang" ? null : "lang"))
                    }
                    className={triggerButtonClass}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3c-2.4 2.5-3.6 5.5-3.6 9S9.6 18.5 12 21" /></svg>
                    {language.toUpperCase()}
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="m5 7 5 6 5-6" />
                    </svg>
                  </button>
                  <div
                    className={`absolute left-0 top-[calc(100%+10px)] z-30 w-[min(92vw,360px)] max-w-[92vw] origin-top ${dropdownPanelClass} transition-all duration-200 sm:left-auto sm:right-0 sm:w-56 sm:max-w-none sm:origin-top-right ${
                      activeDropdown === "lang"
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none -translate-y-2 opacity-0"
                    }`}
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

                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDropdown((prev) => (prev === "theme" ? null : "theme"))
                    }
                    className={triggerButtonClass}
                  >
                    {isDark ? "🌙" : "☀️"} {isDark ? t("header.themeDark") : t("header.themeLight")}
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="m5 7 5 6 5-6" />
                    </svg>
                  </button>
                  <div
                    className={`absolute left-0 top-[calc(100%+10px)] z-30 w-[min(92vw,360px)] max-w-[92vw] origin-top ${dropdownPanelClass} transition-all duration-200 sm:left-auto sm:right-0 sm:w-52 sm:max-w-none sm:origin-top-right ${
                      activeDropdown === "theme"
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none -translate-y-2 opacity-0"
                    }`}
                  >
                    <p className={dropdownHintClass}>{t("header.chooseTheme")}</p>
                    <button
                      type="button"
                      onClick={() => selectTheme("light")}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                    >
                      <span>☀️ {t("header.themeLight")}</span>
                      {!isDark ? <span className="text-blue-400">✓</span> : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectTheme("dark")}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-blue-500/10"
                    >
                      <span>🌙 {t("header.themeDark")}</span>
                      {isDark ? <span className="text-blue-400">✓</span> : null}
                    </button>
                  </div>
                </div>

                <Link href="/dodaj-warsztat" className={`${ctaButtonClass} w-full sm:w-auto`}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M14.7 6.3a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4l-7.9 7.9-3.3.7.7-3.3 7.5-7.9Z" />
                  </svg>
                  {t("header.addWorkshop")}
                </Link>
              </div>
            </div>
          </div>

          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${
              isDark
                ? "border-blue-400/25 bg-zinc-900/80 text-blue-200"
                : "border-blue-200/90 bg-white/82 text-blue-700 shadow-[0_6px_18px_rgba(59,130,246,0.12)]"
            }`}
          >
            {t("hero.badge")}
          </span>
          <h1 className="mt-4 max-w-3xl pb-1 text-3xl font-bold leading-[1.15] [text-wrap:balance] break-words sm:text-4xl md:text-5xl md:leading-[1.12]">
            {t("hero.titlePrefix")}{" "}
            <span className="pb-[0.08em] bg-gradient-to-r from-blue-500 to-blue-300 bg-clip-text text-transparent break-words">
              {t("hero.titleHighlightOffers")}
            </span>{" "}
            <span className="pb-[0.08em] bg-gradient-to-r from-orange-500 to-orange-300 bg-clip-text text-transparent break-words">
              {t("hero.titleHighlightRepairs")}
            </span>,{" "}
            <span className="pb-[0.08em] bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent break-words">
              {t("hero.titleHighlightReplacement")}
            </span>,{" "}
            <span className="pb-[0.08em] bg-gradient-to-r from-sky-400 to-blue-300 bg-clip-text text-transparent break-words">
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

          <div
            className={`mt-8 rounded-2xl border p-5 shadow-2xl backdrop-blur-xl sm:p-6 md:p-8 ${
              isDark
                ? "border-blue-500/20 bg-gradient-to-br from-[#091427]/88 via-[#071224]/84 to-[#040a15]/80 text-zinc-100 shadow-blue-500/20"
                : "relative border-transparent bg-[rgba(255,255,255,0.78)] text-zinc-900 shadow-[0_30px_80px_rgba(37,99,235,0.2),0_16px_52px_rgba(249,115,22,0.18)] ring-1 ring-inset ring-[rgba(59,130,246,0.34)]"
            }`}
          >
            {!isDark ? (
              <div
                className="pointer-events-none absolute -bottom-16 left-1/2 h-44 w-[72%] -translate-x-1/2 rounded-full bg-orange-300/35 blur-3xl"
                aria-hidden
              />
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h2 className="text-xl font-bold sm:text-2xl">
                {t("form.title")}
                <span className="ml-2 text-orange-400">•</span>
              </h2>
              {currentUser && vehicles.length > 0 ? (
                <label className="flex w-full flex-col gap-1 sm:w-[320px]">
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{t("form.selectSavedCar")}</span>
                  <select
                    value={selectedSavedCarId}
                    onChange={(event) => setSelectedSavedCarId(event.target.value)}
                    className={currentFieldClassName}
                  >
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.brand} {vehicle.model} ({vehicle.year || "—"}){vehicle.isPrimary ? " • domyślne" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <p
              className={`mt-2 max-w-3xl text-sm sm:text-base ${
                isDark ? "text-zinc-300" : "text-zinc-700"
              }`}
            >
              {t("form.subtitle")}
            </p>
            <form
              onSubmit={handleSubmit}
              className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("form.labels.vehicleType")}</span>
                <select
                  name="vehicleType"
                  value={vehicleType}
                  onChange={(event) => {
                    const selectedType = event.target.value as VehicleTypeKey | "";
                    setVehicleType(selectedType);
                    setBrand("");
                    setModel("");
                    setYear("");
                    setService("");
                    setFuel("");
                  }}
                  className={currentFieldClassName}
                >
                  <option value="">{t("form.selects.vehicleType")}</option>
                  {vehicleTypeOptions.map((type) => (
                    <option key={type.key} value={type.key}>
                      {t(`form.vehicleTypes.${type.key}`)}
                    </option>
                  ))}
                  <option disabled>{t("form.selects.separator")}</option>
                  {translatedComingSoonTypes.map((type) => (
                    <option key={type} value="" disabled>
                      {type}
                      {t("form.selects.comingSoonSuffix")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("form.labels.brand")}</span>
                <AutocompleteSelect
                  name="brand"
                  value={brand}
                  onChange={(nextBrand) => {
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
                  inputClassName={currentFieldClassName}
                  isDark={isDark}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("form.labels.model")}</span>
                <AutocompleteSelect
                  name="model"
                  value={model}
                  onChange={setModel}
                  options={modelsForBrand}
                  placeholder={brand ? t("form.selects.model") : t("form.selects.chooseBrandFirst")}
                  disabled={!brand}
                  required
                  noResultsText={t("account.placeholders.noResults")}
                  inputClassName={currentFieldClassName}
                  isDark={isDark}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("form.labels.year")}</span>
                <AutocompleteSelect
                  name="year"
                  value={year}
                  onChange={setYear}
                  options={years}
                  placeholder={t("form.selects.year")}
                  required
                  noResultsText={t("account.placeholders.noResults")}
                  inputClassName={currentFieldClassName}
                  isDark={isDark}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">{translatedFuelLabel}</span>
                <AutocompleteSelect
                  name="fuel"
                  value={fuel}
                  onChange={setFuel}
                  options={fuelsForVehicleType}
                  placeholder={
                    vehicleType ? t("form.selects.fuel") : t("form.selects.chooseTypeFirst")
                  }
                  disabled={!vehicleType}
                  required
                  noResultsText={t("account.placeholders.noResults")}
                  inputClassName={currentFieldClassName}
                  isDark={isDark}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">{translatedServiceLabel}</span>
                <ServiceCategoryPicker
                  value={service}
                  onChange={setService}
                  categories={serviceCatalogForVehicleType}
                  disabled={!vehicleType}
                  isDark={isDark}
                  inputClassName={currentFieldClassName}
                  placeholder={
                    vehicleType ? t("form.selects.serviceCategory") : t("form.selects.chooseTypeFirst")
                  }
                  noResultsText={t("account.placeholders.noResults")}
                />
                <input type="hidden" name="service" value={service} />
              </label>

              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="text-sm font-medium">{t("form.labels.problem")}</span>
                <textarea
                  name="problem"
                  rows={4}
                  placeholder={t("form.placeholders.problem")}
                  className={`${currentFieldClassName} min-h-[120px] md:col-span-2`}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("form.labels.city")}</span>
                <input
                  type="text"
                  name="city"
                  required
                  value={searchCity}
                  onChange={(event) => setSearchCity(event.target.value)}
                  placeholder={t("form.placeholders.city")}
                  className={currentFieldClassName}
                />
              </label>

              <div className="mt-1 grid grid-cols-1 gap-3 md:col-span-2 md:grid-cols-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-6 py-3 font-semibold text-white shadow-[0_10px_30px_rgba(59,130,246,0.28),0_8px_22px_rgba(249,115,22,0.24)] transition-all duration-300 hover:scale-[1.02] hover:from-blue-500 hover:to-orange-400 hover:shadow-[0_14px_36px_rgba(59,130,246,0.35),0_10px_28px_rgba(249,115,22,0.3)]"
                >
                  {isSubmitting ? t("form.buttons.submitting") : t("form.buttons.submit")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualVehicle((prev) => !prev)}
                  className={`inline-flex h-12 w-full items-center justify-center rounded-xl border px-6 py-3 font-semibold transition-all duration-300 hover:scale-[1.02] ${
                    isDark
                      ? "border-blue-400/40 bg-zinc-900/70 text-zinc-100 hover:border-orange-400/60 hover:text-orange-200"
                      : "border-blue-300/80 bg-white/72 text-zinc-800 hover:border-orange-400/85 hover:text-orange-600 hover:shadow-[0_0_24px_rgba(59,130,246,0.16),0_0_18px_rgba(249,115,22,0.22)]"
                  }`}
                >
                  {showManualVehicle
                    ? t("form.manual.toggleHide")
                    : t("form.manual.toggleShow")}
                </button>
              </div>

              {showManualVehicle ? (
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

        <section className="mt-16">
          <h2 className="text-3xl font-semibold">
            <span className={isDark ? "text-zinc-100" : "text-zinc-900"}>{t("sections.howItWorks")}</span>
            {!isDark ? <span className="ml-2 text-orange-500">•</span> : null}
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
                <article key={step.title} className={sectionCardClass}>
                  <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${isDark ? "from-blue-500/0 via-blue-400/60 to-orange-400/0" : "from-blue-500/0 via-blue-500/50 to-orange-400/0"}`} />
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                        isDark
                          ? "bg-blue-500/20 text-blue-200"
                          : "bg-gradient-to-br from-blue-500 to-orange-400 text-white shadow-[0_8px_18px_rgba(59,130,246,0.22),0_6px_14px_rgba(249,115,22,0.2)]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <p className={`text-sm font-medium ${isDark ? "text-blue-300" : "text-orange-500"}`}>
                      {t("sections.stepLabel")} {index + 1}
                    </p>
                  </div>
                  <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
                  <p className={`mt-1.5 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    {step.desc}
                  </p>
                </article>
              ),
            )}
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-2">
          <article
            className={sectionCardClass}
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${isDark ? "from-blue-500/0 via-blue-400/60 to-orange-400/0" : "from-blue-500/0 via-blue-500/50 to-orange-400/0"}`} />
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl font-semibold">
                {t("sections.forDrivers")}
                {!isDark ? <span className="ml-2 text-orange-500">•</span> : null}
              </h2>
              <div className="relative">
                <span
                  className={`pointer-events-none absolute -right-8 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full blur-xl ${
                    isDark ? "bg-blue-400/35" : "bg-blue-500/30"
                  }`}
                />
                <span
                  className={`pointer-events-none absolute -left-6 top-4 h-10 w-10 rounded-full blur-lg ${
                    isDark ? "bg-cyan-300/25" : "bg-sky-400/25"
                  }`}
                />
                <Image
                  src="/drivers-car-icon-v3.png"
                  alt="Ikona kierowcy"
                  width={400}
                  height={200}
                  className={`relative h-36 w-auto object-contain contrast-[1.14] saturate-[1.9] ${
                    isDark
                      ? "brightness-[1.06] drop-shadow-[0_0_16px_rgba(59,130,246,0.38)]"
                      : "brightness-[1.02] drop-shadow-[0_0_12px_rgba(59,130,246,0.28)]"
                  }`}
                />
              </div>
            </div>
            <ul className={`mt-5 space-y-3 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                {driverBenefits.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-blue-400" : "bg-orange-400"}`} />
                    {item}
                  </li>
                ))}
              </ul>
          </article>

          <article
            className={sectionCardClass}
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${isDark ? "from-blue-500/0 via-blue-400/60 to-orange-400/0" : "from-blue-500/0 via-blue-500/50 to-orange-400/0"}`} />
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl font-semibold">
                {t("sections.forWorkshops")}
                {!isDark ? <span className="ml-2 text-orange-500">•</span> : null}
              </h2>
              <div className="relative">
                <span
                  className={`pointer-events-none absolute -right-8 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full blur-xl ${
                    isDark ? "bg-orange-400/35" : "bg-orange-500/30"
                  }`}
                />
                <span
                  className={`pointer-events-none absolute -left-6 top-4 h-10 w-10 rounded-full blur-lg ${
                    isDark ? "bg-amber-300/25" : "bg-orange-400/25"
                  }`}
                />
                <Image
                  src="/workshop-garage-icon-v3.png"
                  alt="Ikona warsztatu"
                  width={300}
                  height={225}
                  className={`relative h-36 w-auto object-contain contrast-[1.16] saturate-[2.0] ${
                    isDark
                      ? "brightness-[1.06] drop-shadow-[0_0_16px_rgba(249,115,22,0.4)]"
                      : "brightness-[1.02] drop-shadow-[0_0_12px_rgba(249,115,22,0.3)]"
                  }`}
                />
              </div>
            </div>
            <ul className={`mt-5 space-y-3 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                {workshopBenefits.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-orange-400" : "bg-blue-500"}`} />
                    {item}
                  </li>
                ))}
              </ul>
          </article>
        </section>

        {accountModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <button
              type="button"
              onClick={closeAccountModal}
              className="absolute inset-0 bg-zinc-950/65 backdrop-blur-sm"
              aria-label={t("auth.closeModal")}
            />
            <div
              className={`relative z-[1] max-h-[96vh] w-full max-w-5xl overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl ${
                isDark
                  ? "border-blue-500/25 bg-zinc-900/92 text-zinc-100"
                  : "border-blue-200/85 bg-white/92 text-zinc-900"
              }`}
            >
              <div className="flex items-center justify-between border-b border-blue-300/20 px-4 py-3 sm:px-6">
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

              <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
                <aside className={`border-b border-blue-300/20 p-3 md:border-b-0 md:border-r ${isDark ? "border-zinc-800" : "border-blue-100"}`}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-1">
                    {([
                      { key: "profile", label: t("account.tabs.profile") },
                      { key: "vehicles", label: t("account.tabs.vehicles") },
                      { key: "security", label: t("account.tabs.security") },
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

                <section className="max-h-[82vh] overflow-y-auto overflow-x-visible p-4 pb-10 sm:p-6 sm:pb-12">
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
                        <span className="text-sm font-medium">{t("account.profile.lastName")}</span>
                        <input
                          type="text"
                          value={profileDraft.lastName}
                          onChange={(event) => setProfileDraft((prev) => ({ ...prev, lastName: event.target.value }))}
                          className={currentFieldClassName}
                        />
                      </label>
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
                            {years.map((yearOption) => (
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
                            vehicles.map((vehicle) => (
                              <article
                                key={vehicle.id}
                                className={`rounded-xl border p-3 ${
                                  isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-100 bg-white/80"
                                }`}
                              >
                                <p className="font-medium">
                                  {vehicle.brand} {vehicle.model} ({vehicle.year})
                                </p>
                                <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                                  {vehicle.vehicleType ? getVehicleTypeLabel(vehicle.vehicleType) : "—"} · {vehicle.fuel || "—"} · {vehicle.registration || "—"}
                                </p>
                                {vehicle.vin ? (
                                  <p className={`mt-1 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                                    VIN: {vehicle.vin}
                                  </p>
                                ) : null}
                                {vehicle.city ? (
                                  <p className={`mt-1 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                                    {t("account.vehicle.city")}: {vehicle.city}
                                  </p>
                                ) : null}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSetPrimaryVehicle(vehicle.id)}
                                    disabled={accountSaving || accountLoading}
                                    className={`rounded-lg px-3 py-1 text-sm ${
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
                                    className={`rounded-lg px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                                      isDark ? "bg-zinc-800 text-zinc-200" : "bg-slate-100 text-zinc-700"
                                    }`}
                                  >
                                    {t("account.vehicle.edit")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleVehicleDelete(vehicle.id)}
                                    disabled={accountSaving || accountLoading}
                                    className="rounded-lg bg-orange-500/15 px-3 py-1 text-sm text-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
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
      </main>
    </div>
  );
}
