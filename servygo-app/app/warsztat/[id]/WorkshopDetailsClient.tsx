"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import MobileBottomSheet from "@/components/MobileBottomSheet";
import type { MockWorkshop } from "@/lib/mockWorkshops";
import { fetchPublicWorkshopByIdAsMock, matchWorkshopServicesForVehicle } from "@/lib/publicWorkshopsFromDb";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { sendSystemMessage } from "@/lib/messagesApi";
import { createTranslator, LanguageCode } from "@/lib/translations";
import { getAvailableSlots, inferEndTime } from "@/lib/bookingAvailability";
import { trackEvent } from "@/lib/analytics";
import { classifyServiceCategory } from "@/lib/serviceCategoryClassifier";
import { vehicleTypeOptions, type VehicleTypeKey } from "@/lib/vehicleData";
import WorkshopFavoriteToggle from "@/components/WorkshopFavoriteToggle";
import WorkshopLocationMiniMap from "@/components/workshop/WorkshopLocationMiniMap";
import {
  averageRating,
  fetchPublishedServygoReviewsForWorkshop,
  listEligibleBookingsForServygoReview,
  submitServygoReview,
  type ServygoReviewDisplayMode,
  type WorkshopServygoReviewRow,
} from "@/lib/workshopServygoReviewsApi";
import { listActiveWorkshopPhotos, type WorkshopPhotoRow } from "@/lib/workshopPhotosApi";
import { LEGAL_VERSIONS } from "@/lib/legalVersions";

function padTime(value: number) {
  return String(value).padStart(2, "0");
}

function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutesToTime(value: number) {
  const normalized = ((value % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${padTime(hours)}:${padTime(minutes)}`;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())}`;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeServiceQuery(value: string) {
  return normalizeText(value).replace(/[-_]+/g, " ");
}

function formatPriceRange(priceFrom?: number | null, priceTo?: number | null, fallback?: number) {
  if (priceFrom != null && priceTo != null && priceTo >= priceFrom) return `${priceFrom}-${priceTo} zł`;
  if (priceFrom != null) return `od ${priceFrom} zł`;
  if (priceTo != null) return `do ${priceTo} zł`;
  if (typeof fallback === "number" && Number.isFinite(fallback) && fallback > 0) return `od ${fallback} zł`;
  return "Zapytaj o widełki";
}

function WorkshopDetailsPageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<LanguageCode>("pl");
  const [loading, setLoading] = useState(true);
  const [workshop, setWorkshop] = useState<MockWorkshop | null>(null);
  const [detailError, setDetailError] = useState("");
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedServiceKey, setSelectedServiceKey] = useState("");
  const [calendarMonthDate, setCalendarMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [hasAcceptedPricingAndLiabilityNotice, setHasAcceptedPricingAndLiabilityNotice] = useState(false);
  const [pricingLiabilityNoticeAccepted, setPricingLiabilityNoticeAccepted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ id: string; label: string; role: string }>>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("any");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [employeeSheetOpen, setEmployeeSheetOpen] = useState(false);
  const [servygoReviews, setServygoReviews] = useState<WorkshopServygoReviewRow[]>([]);
  const [workshopPhotos, setWorkshopPhotos] = useState<WorkshopPhotoRow[]>([]);
  const [servygoReviewOpen, setServygoReviewOpen] = useState(false);
  const [servygoEligible, setServygoEligible] = useState<{ id: string; service_name: string | null }[]>([]);
  const [servygoBookingId, setServygoBookingId] = useState("");
  const [servygoRating, setServygoRating] = useState(5);
  const [servygoComment, setServygoComment] = useState("");
  const [servygoDisplayMode, setServygoDisplayMode] = useState<ServygoReviewDisplayMode>("first_initial");
  const [servygoNickname, setServygoNickname] = useState("");
  const [servygoProfileFirst, setServygoProfileFirst] = useState("");
  const [servygoProfileLast, setServygoProfileLast] = useState("");
  const [servygoBusy, setServygoBusy] = useState(false);
  const [servygoMsg, setServygoMsg] = useState("");

  const workshopId = typeof params?.id === "string" ? params.id : "";

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
    if (!workshopId) {
      setWorkshop(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setDetailError("");
      try {
        const row = await fetchPublicWorkshopByIdAsMock(workshopId);
        if (!cancelled) setWorkshop(row);
      } catch (err) {
        if (!cancelled) {
          setDetailError(err instanceof Error ? err.message : "Nie udało się wczytać warsztatu.");
          setWorkshop(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workshopId]);

  useEffect(() => {
    if (!workshop?.supabaseId) {
      setServygoReviews([]);
      setWorkshopPhotos([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [rev, pho] = await Promise.all([
          fetchPublishedServygoReviewsForWorkshop(workshop.supabaseId),
          listActiveWorkshopPhotos(workshop.supabaseId),
        ]);
        if (!cancelled) {
          setServygoReviews(rev);
          setWorkshopPhotos(pho);
        }
      } catch {
        if (!cancelled) {
          setServygoReviews([]);
          setWorkshopPhotos([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workshop?.supabaseId]);

  useEffect(() => {
    if (!servygoReviewOpen || !currentUserId || !workshop?.supabaseId || !supabase) return;
    let cancelled = false;
    void (async () => {
      try {
        const [eligible, prof] = await Promise.all([
          listEligibleBookingsForServygoReview(currentUserId, workshop.supabaseId),
          supabase.from("profiles").select("first_name,last_name,review_public_nickname").eq("id", currentUserId).maybeSingle(),
        ]);
        if (cancelled) return;
        setServygoEligible(eligible.map((e) => ({ id: e.id, service_name: e.service_name })));
        const p = prof.data as { first_name?: string | null; last_name?: string | null; review_public_nickname?: string | null } | null;
        setServygoProfileFirst((p?.first_name ?? "").trim());
        setServygoProfileLast((p?.last_name ?? "").trim());
        setServygoNickname((p?.review_public_nickname ?? "").trim());
        if (eligible.length === 1) setServygoBookingId(eligible[0].id);
      } catch {
        if (!cancelled) setServygoEligible([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [servygoReviewOpen, currentUserId, workshop?.supabaseId, supabase]);

  useEffect(() => {
    if (!workshop?.supabaseId || !supabase) {
      setEmployeeOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("workshop_employees")
        .select("id, first_name, last_name, role")
        .eq("workshop_id", workshop.supabaseId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const rows = (data as { id: string; first_name: string; last_name: string; role: string }[] | null) ?? [];
      setEmployeeOptions(
        rows.map((row, idx) => ({
          id: row.id,
          role: row.role,
          label: `${row.role?.trim() || "Stanowisko"} (${idx + 1})`,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [workshop?.supabaseId]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("servygo-theme", theme);
  }, [mounted, theme]);

  useEffect(() => {
    function updateViewportMode() {
      setIsMobileViewport(window.innerWidth < 640);
    }
    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  useEffect(() => {
    if (!mounted || !workshopId) return;
    void trackEvent("page_view", { page: `/warsztat/${workshopId}`, workshopId });
  }, [mounted, workshopId]);

  useEffect(() => {
    if (!mounted) return;

    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(Boolean(data.user));
      setCurrentUserId(data.user?.id ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user));
      setCurrentUserId(session?.user?.id ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !isSupabaseConfigured || !supabase || !currentUserId) {
      setHasAcceptedPricingAndLiabilityNotice(false);
      setPricingLiabilityNoticeAccepted(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "pricing_notice_accepted_at,liability_notice_accepted_at,accepted_pricing_notice_version,accepted_liability_notice_version",
        )
        .eq("id", currentUserId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setHasAcceptedPricingAndLiabilityNotice(false);
        setPricingLiabilityNoticeAccepted(false);
        return;
      }

      const row = (data ??
        null) as
        | {
            pricing_notice_accepted_at?: string | null;
            liability_notice_accepted_at?: string | null;
            accepted_pricing_notice_version?: string | null;
            accepted_liability_notice_version?: string | null;
          }
        | null;

      const accepted =
        Boolean(row?.pricing_notice_accepted_at) &&
        Boolean(row?.liability_notice_accepted_at) &&
        row?.accepted_pricing_notice_version === LEGAL_VERSIONS.pricingNotice &&
        row?.accepted_liability_notice_version === LEGAL_VERSIONS.liabilityNotice;

      setHasAcceptedPricingAndLiabilityNotice(accepted);
      setPricingLiabilityNoticeAccepted(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, currentUserId]);

  const t = useMemo(() => createTranslator(language), [language]);
  const isDark = mounted ? theme === "dark" : false;

  const requestedService = normalizeServiceQuery(searchParams.get("service") ?? "");
  const backToOffersHref = useMemo(() => {
    const query = searchParams.toString();
    return query ? `/oferty?${query}` : "/oferty";
  }, [searchParams]);
  const selectedVehicle = useMemo(
    () => ({
      vehicleType: normalizeText(searchParams.get("vehicleType") ?? ""),
      brand: normalizeText(searchParams.get("brand") ?? ""),
      model: normalizeText(searchParams.get("model") ?? ""),
      year: Number.parseInt(searchParams.get("year") ?? "", 10),
      engine: normalizeText(searchParams.get("engine") ?? ""),
      fuel: normalizeText(searchParams.get("fuel") ?? ""),
      city: normalizeText(searchParams.get("city") ?? ""),
      vin: normalizeText(searchParams.get("vin") ?? "").slice(0, 17).toUpperCase(),
    }),
    [searchParams],
  );
  const selectedClient = useMemo(
    () => ({
      firstName: (searchParams.get("firstName") ?? "").trim(),
      lastName: (searchParams.get("lastName") ?? "").trim(),
    }),
    [searchParams],
  );
  const problemFromSearch = useMemo(() => (searchParams.get("problem") ?? "").trim(), [searchParams]);

  const workshopDetailHref = useMemo(() => {
    const q = searchParams.toString();
    const id = workshop?.id ?? "";
    if (!id) return "";
    return q ? `/warsztat/${id}?${q}` : `/warsztat/${id}`;
  }, [searchParams, workshop?.id]);

  const filteredServices = useMemo(() => {
    if (!workshop) return [];
    return matchWorkshopServicesForVehicle(workshop.services, {
      service: requestedService,
      vehicleType: selectedVehicle.vehicleType,
      brand: selectedVehicle.brand,
      model: selectedVehicle.model,
      year: Number.isFinite(selectedVehicle.year) ? selectedVehicle.year : null,
      engine: selectedVehicle.engine,
      fuel: selectedVehicle.fuel,
    });
  }, [
    requestedService,
    selectedVehicle.brand,
    selectedVehicle.engine,
    selectedVehicle.fuel,
    selectedVehicle.model,
    selectedVehicle.vehicleType,
    selectedVehicle.year,
    workshop,
  ]);

  const defaultService = useMemo(() => {
    if (!workshop) return null;
    if (!requestedService) return filteredServices[0] ?? null;
    return (
      filteredServices.find((service) =>
        normalizeServiceQuery(service.service_name).includes(requestedService),
      ) ??
      filteredServices[0] ??
      null
    );
  }, [filteredServices, requestedService, workshop]);

  const selectedService = useMemo(() => {
    if (!workshop) return null;
    if (!selectedServiceKey) return defaultService;
    return (
      filteredServices.find(
        (service) =>
          `${service.service_name}-${service.brand}-${service.model}-${service.engine}` ===
          selectedServiceKey,
      ) ??
      defaultService
    );
  }, [defaultService, filteredServices, selectedServiceKey, workshop]);

  const locale = language === "ua" ? "uk-UA" : language === "en" ? "en-US" : "pl-PL";
  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
      }).format(calendarMonthDate),
    [calendarMonthDate, locale],
  );
  // Stabilny timestamp (połówka dnia): nowy Date() przy każdym renderze zmieniałby tożsamość zależności
  // useEffect (sloty kalendarza) i prowadził do „Maximum update depth exceeded”.
  const todayStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth(), 1);
    const firstDayWeekIndex = (firstDay.getDay() + 6) % 7;
    const startDate = addDays(firstDay, -firstDayWeekIndex);
    return Array.from({ length: 42 }).map((_, index) => {
      const date = addDays(startDate, index);
      const isCurrentMonth = date.getMonth() === calendarMonthDate.getMonth();
      return {
        key: toDateKey(date),
        date,
        isCurrentMonth,
      };
    });
  }, [calendarMonthDate]);

  const [calendarDaySlots, setCalendarDaySlots] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!workshop || !selectedService) {
      setCalendarDaySlots({});
      return;
    }
    const days = calendarGrid.filter((day) => {
      if (!day.isCurrentMonth) return false;
      const normalized = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate());
      return normalized >= todayStart;
    });
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        days.map(async (day) => {
          try {
            const slots = await getAvailableSlots({
              workshopId: workshop.supabaseId,
              date: day.key,
              serviceDurationMinutes: selectedService.duration_minutes ?? 60,
              employeeId: selectedEmployeeId === "any" ? null : selectedEmployeeId,
              requiredRoles: selectedService.required_roles ?? [],
            });
            return [day.key, slots] as const;
          } catch {
            return [day.key, [] as string[]] as const;
          }
        }),
      );
      if (cancelled) return;
      setCalendarDaySlots(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [calendarGrid, selectedEmployeeId, selectedService, todayStart, workshop]);

  const firstAvailableDateKey = useMemo(() => {
    const firstAvailable = calendarGrid.find((day) => {
      if (!day.isCurrentMonth) return false;
      const normalizedDay = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate());
      if (normalizedDay < todayStart) return false;
      return (calendarDaySlots[day.key] ?? []).length > 0;
    });
    return firstAvailable?.key ?? "";
  }, [calendarDaySlots, calendarGrid, todayStart]);

  const effectiveDateKey = selectedDateKey || firstAvailableDateKey;
  const selectedDayDate = useMemo(() => parseDateKey(effectiveDateKey), [effectiveDateKey]);

  const isSelectedDayClosed = useMemo(() => {
    if (!selectedDayDate || !effectiveDateKey) return false;
    const dateNotPast =
      new Date(
        selectedDayDate.getFullYear(),
        selectedDayDate.getMonth(),
        selectedDayDate.getDate(),
      ) >= todayStart;
    if (!dateNotPast) return true;
    return (calendarDaySlots[effectiveDateKey] ?? []).length === 0;
  }, [calendarDaySlots, effectiveDateKey, selectedDayDate, todayStart]);

  const [dynamicAvailableTimes, setDynamicAvailableTimes] = useState<string[]>([]);

  useEffect(() => {
    if (!workshop || !selectedService || !effectiveDateKey || isSelectedDayClosed) {
      setDynamicAvailableTimes([]);
      return;
    }
    setDynamicAvailableTimes(calendarDaySlots[effectiveDateKey] ?? []);
  }, [calendarDaySlots, effectiveDateKey, isSelectedDayClosed, selectedService, workshop]);

  const effectiveSelectedTime =
    selectedTime && dynamicAvailableTimes.includes(selectedTime) ? selectedTime : "";

  const arrivalTime = effectiveSelectedTime;
  const pickupTime =
    selectedService && effectiveSelectedTime
      ? inferEndTime(
          effectiveSelectedTime,
          (selectedService.duration_minutes ?? 60) + (workshop?.bufferMinutes ?? 0),
        )
      : "";

  async function handleBookingConfirm() {
    if (!workshop) return;
    if (!isLoggedIn || !currentUserId || !supabase || !isSupabaseConfigured) return;
    if (!effectiveDateKey || !effectiveSelectedTime || !selectedService) return;
    if (!hasAcceptedPricingAndLiabilityNotice && !pricingLiabilityNoticeAccepted) {
      setBookingError(
        "Aby kontynuować, potwierdź zasady dotyczące ceny orientacyjnej i odpowiedzialności warsztatu.",
      );
      return;
    }
    setBookingSuccess("");
    setBookingError("");
    setBookingLoading(true);
    try {
      if (!hasAcceptedPricingAndLiabilityNotice) {
        const acceptedAt = new Date().toISOString();
        const { error: consentError } = await supabase
          .from("profiles")
          .update({
            pricing_notice_accepted_at: acceptedAt,
            liability_notice_accepted_at: acceptedAt,
            accepted_pricing_notice_version: LEGAL_VERSIONS.pricingNotice,
            accepted_liability_notice_version: LEGAL_VERSIONS.liabilityNotice,
            updated_at: acceptedAt,
          })
          .eq("id", currentUserId);

        if (consentError) {
          throw new Error(
            "Nie udało się zapisać wymaganej zgody. Spróbuj ponownie za chwilę.",
          );
        }
        setHasAcceptedPricingAndLiabilityNotice(true);
        setPricingLiabilityNoticeAccepted(false);
      }

      const slots = await getAvailableSlots({
        workshopId: workshop.supabaseId,
        date: effectiveDateKey,
        serviceDurationMinutes: selectedService.duration_minutes ?? 60,
        employeeId: selectedEmployeeId === "any" ? null : selectedEmployeeId,
        requiredRoles: selectedService.required_roles ?? [],
      });
      if (!slots.includes(effectiveSelectedTime)) {
        throw new Error("SLOT_TAKEN");
      }
      const vtKey = selectedVehicle.vehicleType as VehicleTypeKey | "";
      const vehicleTypeLabel =
        (vtKey && vehicleTypeOptions.some((x) => x.key === vtKey)
          ? vehicleTypeOptions.find((x) => x.key === vtKey)?.label
          : null) ?? (selectedVehicle.vehicleType ? selectedVehicle.vehicleType : null);
      const categoryGuess = classifyServiceCategory(selectedService.service_name).category?.trim() ?? "";

      const { data: bookingId, error } = await supabase.rpc("create_booking_safe", {
        p_workshop_id: workshop.supabaseId,
        p_user_id: currentUserId,
        p_service_id: selectedService.id ?? null,
        p_service_name: selectedService.service_name,
        p_vehicle_data: {
          vehicle_type: selectedVehicle.vehicleType || null,
          vehicle_type_label: vehicleTypeLabel,
          brand: selectedVehicle.brand || null,
          model: selectedVehicle.model || null,
          year: Number.isFinite(selectedVehicle.year) ? selectedVehicle.year : null,
          engine: selectedVehicle.engine || null,
          fuel: selectedVehicle.fuel || null,
          city: selectedVehicle.city || null,
          vin: selectedVehicle.vin || null,
          plate_number: null,
        },
        p_booking_date: effectiveDateKey,
        p_start_time: effectiveSelectedTime,
        p_duration_minutes: selectedService.duration_minutes ?? 60,
        p_client_name: [selectedClient.firstName, selectedClient.lastName].filter(Boolean).join(" ").trim(),
        p_client_email: "",
        p_client_phone: "",
        p_notes: null,
        p_problem_description: problemFromSearch || null,
        p_service_category: categoryGuess || null,
        p_employee_id: selectedEmployeeId === "any" ? null : selectedEmployeeId,
      });
      if (error) throw error;
      const { data: ownerRow } = await supabase
        .from("workshops")
        .select("owner_id")
        .eq("id", workshop.supabaseId)
        .maybeSingle();
      const ownerUserId = ((ownerRow as { owner_id?: string | null } | null)?.owner_id ?? null) as string | null;
      const bookingIdValue = typeof bookingId === "string" ? bookingId : null;
      const notificationTasks = [
        sendSystemMessage({
          recipientId: ownerUserId,
          recipientRole: "workshop",
          subject: `Nowa rezerwacja: ${selectedService.service_name}`,
          body: [
            `Warsztat: ${workshop.name}`,
            `Usługa: ${selectedService.service_name}`,
            `Termin: ${effectiveDateKey} ${effectiveSelectedTime}`,
            "Status: Oczekuje na wycenę",
          ].join("\n"),
          relatedBookingId: bookingIdValue,
          relatedWorkshopId: workshop.supabaseId,
        }),
        sendSystemMessage({
          recipientId: currentUserId,
          recipientRole: "client",
          subject: `Potwierdzenie utworzenia rezerwacji: ${selectedService.service_name}`,
          body: [
            `Warsztat: ${workshop.name}`,
            `Usługa: ${selectedService.service_name}`,
            `Termin: ${effectiveDateKey} ${effectiveSelectedTime}`,
            "Status: Oczekuje na wycenę",
            "Warsztat prześle ostateczną wycenę w osobnej wiadomości.",
          ].join("\n"),
          relatedBookingId: bookingIdValue,
          relatedWorkshopId: workshop.supabaseId,
        }),
      ];
      void Promise.allSettled(notificationTasks);
      void trackEvent("booking_confirm", {
        workshopId: workshop.supabaseId,
        workshopName: workshop.name,
        service: selectedService.service_name,
      });
      setBookingSuccess(t("workshopDetails.bookingSaved"));
      setSelectedTime("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("SLOT_CONFLICT") || msg.includes("SLOT_TAKEN")) {
        setBookingError("Ten termin został już zajęty. Wybierz inną godzinę.");
      } else if (msg.includes("OUTSIDE_OPENING_HOURS")) {
        setBookingError("Wybrana godzina jest poza godzinami pracy warsztatu.");
      } else if (msg.includes("Not authenticated")) {
        setBookingError("Zaloguj się ponownie i spróbuj jeszcze raz.");
      } else if (msg.includes("Brak dostępnego pracownika")) {
        setBookingError("Warsztat nie ma obecnie aktywnych pracowników do tego terminu.");
      } else {
        setBookingError(msg || t("workshopDetails.bookingSaveError"));
      }
    } finally {
      setBookingLoading(false);
    }
  }

  if (!workshop && !loading) {
    return (
      <ServyGoPageShell isDark={isDark}>
        <main className="min-h-screen px-3 py-6 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-3xl border border-blue-300/25 bg-white/70 p-8 text-center shadow-xl backdrop-blur-xl dark:border-blue-500/25 dark:bg-zinc-900/70">
            <h1 className="text-2xl font-semibold">{t("workshopDetails.notFound")}</h1>
            {detailError ? (
              <p className={`mt-3 text-sm ${isDark ? "text-orange-200" : "text-orange-800"}`}>{detailError}</p>
            ) : null}
            <Link
              href={backToOffersHref}
              className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t("workshopDetails.backToOffers")}
            </Link>
          </div>
        </main>
      </ServyGoPageShell>
    );
  }

  if (!workshop) {
    return (
      <ServyGoPageShell isDark={isDark}>
        <main className="min-h-screen px-3 py-6 sm:px-6">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className={`h-[540px] animate-pulse rounded-3xl ${isDark ? "bg-zinc-800" : "bg-slate-200"}`} />
            <div className={`h-[540px] animate-pulse rounded-3xl ${isDark ? "bg-zinc-800" : "bg-slate-200"}`} />
          </div>
        </main>
      </ServyGoPageShell>
    );
  }

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className="min-h-screen px-2 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto w-full max-w-6xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/"
              onClick={(event) => {
                event.preventDefault();
                router.push("/");
              }}
              className="relative z-20 inline-flex items-center"
            >
              <Image
                src={isDark ? "/servygo-logo-dark-cropped.png" : "/servygo-logo-light-cropped.png"}
                alt="ServyGo"
                width={192}
                height={72}
                className="h-10 w-auto object-contain sm:h-12"
              />
            </Link>
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <Link
                href={backToOffersHref}
                onClick={(event) => {
                  event.preventDefault();
                  router.push(backToOffersHref);
                }}
                className={`inline-flex w-full items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition sm:w-auto ${
                  isDark
                    ? "border-blue-400/50 bg-zinc-900/70 text-zinc-200 hover:border-orange-300"
                    : "border-blue-200 bg-white/80 text-zinc-700 hover:border-orange-300"
                }`}
              >
                {t("workshopDetails.backToOffers")}
              </Link>
              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                className={`inline-flex w-full items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition sm:w-auto ${
                  isDark
                    ? "border-blue-400/50 bg-zinc-900/70 text-zinc-200 hover:border-orange-300"
                    : "border-blue-200 bg-white/80 text-zinc-700 hover:border-orange-300"
                }`}
              >
                {theme === "dark" ? "☀️" : "🌙"} {theme === "dark" ? t("header.themeLight") : t("header.themeDark")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section
              className={`rounded-3xl border p-5 backdrop-blur-xl sm:p-6 ${
                isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/80"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="break-words text-2xl font-bold sm:text-3xl">{workshop.name}</h2>
                  {workshop.isDemo ? (
                    <div className={`mt-2 rounded-xl border px-3 py-2 text-xs sm:text-sm ${isDark ? "border-amber-400/35 bg-amber-500/15 text-amber-200" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
                      <p className="font-semibold">Profil demonstracyjny</p>
                      <p className="mt-0.5 opacity-90">Ten profil służy do testowania działania ServyGo.</p>
                    </div>
                  ) : null}
                  <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    {workshop.address}
                  </p>
                  <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{workshop.city}</p>
                </div>
                <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end sm:text-right">
                  <WorkshopFavoriteToggle
                    workshopId={workshop.supabaseId}
                    isDark={isDark}
                    isLoggedIn={isLoggedIn}
                    userId={currentUserId}
                    onRequireAuth={() => {
                      router.push("/?auth=login");
                    }}
                  />
                  <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-sm">
                    ⭐ {workshop.rating.toFixed(1)} ({workshop.reviewsCount} {t("workshopDetails.reviews")})
                  </div>
                  <Link
                    href={(workshop.workshopGoogleMapsUrl?.trim() || workshop.googleMapsUrl) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex w-full items-center justify-center rounded-xl border px-3 py-1.5 text-sm font-semibold transition sm:w-auto ${
                      isDark
                        ? "border-orange-300/50 bg-orange-500/10 text-orange-200 hover:border-orange-300"
                        : "border-orange-300/70 bg-orange-50 text-orange-700 hover:border-orange-400"
                    }`}
                  >
                    Opinia Google Maps
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isLoggedIn) {
                        router.push("/?auth=login");
                        return;
                      }
                      setServygoMsg("");
                      setServygoReviewOpen(true);
                    }}
                    className={`inline-flex w-full items-center justify-center rounded-xl border px-3 py-1.5 text-sm font-semibold transition sm:w-auto ${
                      isDark
                        ? "border-blue-300/50 bg-blue-500/10 text-blue-100 hover:border-blue-300"
                        : "border-blue-300/70 bg-blue-50 text-blue-800 hover:border-blue-400"
                    }`}
                  >
                    Zostaw opinię ServyGo
                  </button>
                </div>
              </div>

              <div
                className={`mt-5 rounded-2xl border p-3 ${
                  isDark
                    ? "border-blue-500/30 bg-gradient-to-br from-zinc-900 to-slate-950"
                    : "border-blue-200 bg-gradient-to-br from-sky-100 via-white to-orange-100"
                }`}
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                  <div
                    className={`relative overflow-hidden rounded-2xl border ${
                      isDark ? "border-zinc-700 bg-zinc-800/70" : "border-blue-100 bg-white/70"
                    }`}
                  >
                    <div className="h-52 bg-[linear-gradient(120deg,rgba(59,130,246,0.16),rgba(249,115,22,0.18),rgba(56,189,248,0.14))] dark:bg-[linear-gradient(120deg,rgba(59,130,246,0.22),rgba(249,115,22,0.16),rgba(2,6,23,0.22))]" />
                    <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.22)_45%,transparent_60%)]" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
                    {[1, 2, 3].map((thumb) => (
                      <div
                        key={thumb}
                        className={`relative h-[68px] overflow-hidden rounded-xl border ${
                          isDark ? "border-zinc-700 bg-zinc-800/70" : "border-blue-100 bg-white/70"
                        }`}
                      >
                        <div className="h-full bg-[linear-gradient(120deg,rgba(59,130,246,0.14),rgba(249,115,22,0.14),rgba(15,23,42,0.08))]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p className={`mt-4 text-sm leading-relaxed sm:text-base ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                {workshop.description}
              </p>

              {workshopPhotos.length > 0 ? (
                <div className="mt-6">
                  <h2 className={`text-lg font-semibold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>Zdjęcia warsztatu</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {workshopPhotos.map((ph) =>
                      ph.public_url ? (
                        <div
                          key={ph.id}
                          className={`overflow-hidden rounded-2xl border ${
                            isDark ? "border-zinc-700 bg-zinc-900/60" : "border-blue-100 bg-white/80"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ph.public_url} alt="" className="aspect-video w-full object-cover" />
                          {ph.caption ? (
                            <p className={`px-2 py-1 text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{ph.caption}</p>
                          ) : null}
                        </div>
                      ) : null,
                    )}
                  </div>
                </div>
              ) : (
                <div className={`mt-6 overflow-hidden rounded-2xl border ${isDark ? "border-zinc-700 bg-zinc-900/50" : "border-blue-100 bg-white/80"}`}>
                  <div className="h-40 bg-[linear-gradient(120deg,rgba(59,130,246,0.16),rgba(249,115,22,0.16),rgba(30,41,59,0.08))] dark:bg-[linear-gradient(120deg,rgba(59,130,246,0.22),rgba(249,115,22,0.2),rgba(2,6,23,0.28))]" />
                  <div className={`px-4 py-3 text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                    Zdjęcie warsztatu wkrótce
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-2xl border border-blue-400/25 bg-blue-500/5 p-4 sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className={`text-lg font-semibold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>Opinie ServyGo</h2>
                    <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                      Odrębne od ocen Google — widoczne podpis zgodnie z ustawieniami (bez e-maila i telefonu).
                    </p>
                  </div>
                  <div className={`rounded-xl border px-3 py-2 text-sm ${isDark ? "border-zinc-600 text-zinc-200" : "border-blue-200 text-zinc-800"}`}>
                    Średnia:{" "}
                    <strong>{servygoReviews.length ? averageRating(servygoReviews).toFixed(1) : "—"}</strong> · Liczba:{" "}
                    <strong>{servygoReviews.length}</strong>
                  </div>
                </div>
                <ul className={`mt-4 space-y-3 text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                  {servygoReviews.length === 0 ? (
                    <li className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-700 text-zinc-400" : "border-blue-100 text-zinc-600"}`}>
                      Jeszcze brak opinii ServyGo dla tego warsztatu.
                    </li>
                  ) : (
                    servygoReviews.map((r) => (
                      <li
                        key={r.id}
                        className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-700 bg-zinc-900/40" : "border-blue-100 bg-white/70"}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">{r.display_name_snapshot}</span>
                          <span className="text-xs opacity-80">{new Date(r.created_at).toLocaleDateString("pl-PL")}</span>
                        </div>
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">★ {r.rating}/5</p>
                        {r.service_name ? <p className="mt-1 text-xs opacity-80">Usługa: {r.service_name}</p> : null}
                        <p className="mt-2 whitespace-pre-wrap">{r.comment}</p>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  className={`inline-flex rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
                    isDark
                      ? "border-blue-400/40 bg-zinc-900/70 text-zinc-100 hover:border-orange-300/70"
                      : "border-blue-300/70 bg-white/80 text-zinc-800 hover:border-orange-300"
                  }`}
                >
                  Wybierz inne auto
                </button>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{t("workshopDetails.servicesAndPrices")}</h2>
                  <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("workshopDetails.chooseService")}</p>
                </div>
                <div className="mt-3 space-y-2">
                  {filteredServices.map((service) => {
                    const serviceKey = `${service.service_name}-${service.brand}-${service.model}-${service.engine}`;
                    const highlighted = selectedService?.service_name === service.service_name
                      && selectedService.brand === service.brand
                      && selectedService.model === service.model
                      && selectedService.engine === service.engine;
                    return (
                      <button
                        type="button"
                        key={`${workshop.id}-${service.service_name}-${service.brand}-${service.model}`}
                        onClick={() => {
                          setSelectedServiceKey(serviceKey);
                          setSelectedTime("");
                        }}
                        className={`rounded-2xl border p-3 text-left transition ${
                          highlighted
                            ? "border-orange-300 bg-orange-500/12 shadow-[0_0_0_1px_rgba(249,115,22,0.45),0_0_20px_rgba(249,115,22,0.22)]"
                            : isDark
                              ? "border-blue-500/25 bg-zinc-900/60 hover:border-blue-400/50"
                              : "border-blue-200 bg-white/75 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="break-words text-base font-semibold">{service.service_name}</p>
                          <div className="flex items-center gap-2">
                            {highlighted ? (
                              <span className="rounded-full border border-blue-300/40 bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-200">
                                {t("workshopDetails.selected")}
                              </span>
                            ) : null}
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                highlighted
                                  ? "bg-orange-500 text-white"
                                  : isDark
                                    ? "border border-blue-400/40 bg-blue-500/15 text-blue-200"
                                    : "border border-blue-300/60 bg-blue-50 text-blue-700"
                              }`}
                            >
                              {formatPriceRange(service.price_from, service.price_to, service.price)}
                            </span>
                          </div>
                        </div>
                        <p className={`mt-1 text-xs sm:text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                          {selectedVehicle.brand ? `${service.brand} ${service.model}` : `${service.brand} ${service.model}`} • {service.engine} • {service.year_from}-{service.year_to} • {service.fuelType ?? "—"}
                        </p>
                        <p className={`mt-1 text-xs sm:text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                          ⏱ {t("workshopDetails.serviceDuration")}: {service.duration_minutes} min
                        </p>
                        <p className={`mt-1 text-xs sm:text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                          {t("workshopDetails.supportedVehicle")}: {service.vehicle_type}
                        </p>
                      </button>
                    );
                  })}
                  {filteredServices.length === 0 && workshop.services.length === 0 ? (
                    <p
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        isDark
                          ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
                          : "border-orange-200 bg-orange-50 text-orange-700"
                      }`}
                    >
                      Brak usług i cen dla wybranego auta. Wybierz inne auto, aby sprawdzić ofertę tego warsztatu.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <section
                className={`rounded-3xl border p-5 backdrop-blur-xl sm:p-6 ${
                  isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/80"
                }`}
              >
                <h3 className="text-lg font-semibold">{t("workshopDetails.nearestSlots")}</h3>
                <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {t("workshopDetails.openingHours")}: {workshop.availability.openingHours.start}-{workshop.availability.openingHours.end}
                </p>

                <div className={`mt-3 rounded-2xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/50" : "border-blue-200 bg-white/75"}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setCalendarMonthDate(
                          new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() - 1, 1),
                        );
                        setSelectedTime("");
                      }}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition ${
                        isDark ? "border-zinc-600 hover:border-blue-400/60" : "border-blue-200 hover:border-blue-300"
                      }`}
                    >
                      ‹
                    </button>
                    <p className="text-sm font-semibold capitalize">{monthTitle}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCalendarMonthDate(
                          new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() + 1, 1),
                        );
                        setSelectedTime("");
                      }}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition ${
                        isDark ? "border-zinc-600 hover:border-blue-400/60" : "border-blue-200 hover:border-blue-300"
                      }`}
                    >
                      ›
                    </button>
                  </div>
                  <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide opacity-80">
                    {["Pon", "Wto", "Śro", "Czw", "Pią", "Sob", "Nie"].map((dayName) => (
                      <span key={dayName}>{dayName}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarGrid.map((day) => {
                      const normalizedDay = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate());
                      const isPast = normalizedDay < todayStart;
                      const hasDaySlots = (calendarDaySlots[day.key] ?? []).length > 0;
                      const isClosed = isPast || !hasDaySlots;
                      const isActive = day.key === effectiveDateKey;
                      return (
                        <button
                          key={`${workshop.id}-day-${day.key}`}
                          type="button"
                          disabled={!day.isCurrentMonth || isClosed}
                          onClick={() => {
                            setSelectedDateKey(day.key);
                            setSelectedTime("");
                          }}
                          className={`h-9 rounded-lg border text-xs font-semibold transition ${
                            isActive
                              ? "border-orange-300 bg-orange-500 text-white shadow-[0_0_0_1px_rgba(249,115,22,0.45)]"
                              : !day.isCurrentMonth || isClosed
                                ? isDark
                                  ? "cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-600"
                                  : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                : isDark
                                  ? "border-zinc-700 bg-zinc-900/60 hover:border-blue-400/60"
                                  : "border-blue-200 bg-white/70 hover:border-blue-300"
                          }`}
                        >
                          {day.date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isSelectedDayClosed ? (
                  <p className="mt-4 rounded-xl border border-orange-300/50 bg-orange-500/10 px-3 py-2 text-sm">
                    {t("workshopDetails.workshopClosedDay")}
                  </p>
                ) : (
                  <>
                    <div className="mt-4">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-80">
                        Pracownik
                      </label>
                      {isMobileViewport ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEmployeeSheetOpen(true)}
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/80"}`}
                          >
                            {selectedEmployeeId === "any"
                              ? "Dowolny dostępny pracownik"
                              : employeeOptions.find((employee) => employee.id === selectedEmployeeId)?.label ?? "Wybierz pracownika"}
                          </button>
                          <MobileBottomSheet
                            isOpen={employeeSheetOpen}
                            onClose={() => setEmployeeSheetOpen(false)}
                            title="Wybierz pracownika"
                            isDark={isDark}
                          >
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEmployeeId("any");
                                  setSelectedTime("");
                                  setEmployeeSheetOpen(false);
                                }}
                                className="w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-blue-500/10"
                              >
                                Dowolny dostępny pracownik
                              </button>
                              {employeeOptions.map((employee) => (
                                <button
                                  key={employee.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedEmployeeId(employee.id);
                                    setSelectedTime("");
                                    setEmployeeSheetOpen(false);
                                  }}
                                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm hover:bg-blue-500/10"
                                >
                                  <span>{employee.label}</span>
                                  {selectedEmployeeId === employee.id ? <span>✓</span> : null}
                                </button>
                              ))}
                            </div>
                          </MobileBottomSheet>
                        </>
                      ) : (
                        <select
                          value={selectedEmployeeId}
                          onChange={(e) => {
                            setSelectedEmployeeId(e.target.value);
                            setSelectedTime("");
                          }}
                          className={`w-full rounded-xl border px-3 py-2 text-sm ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/80"}`}
                        >
                          <option value="any">Dowolny dostępny pracownik</option>
                          {employeeOptions.map((employee) => (
                            <option key={employee.id} value={employee.id}>{employee.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {dynamicAvailableTimes.map((time) => {
                        const active = time === effectiveSelectedTime;
                        return (
                          <button
                            key={`${workshop.id}-time-${time}`}
                            type="button"
                            onClick={() => setSelectedTime(time)}
                            className={`rounded-xl border px-2 py-2 text-sm font-medium transition ${
                              active
                                ? "border-blue-400 bg-blue-500/20"
                                : isDark
                                  ? "border-zinc-700 bg-zinc-900/60 hover:border-blue-400/60"
                                  : "border-blue-200 bg-white/70 hover:border-blue-300"
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                    {dynamicAvailableTimes.length === 0 ? (
                      <p className="mt-3 text-sm">{t("workshopDetails.noHoursAvailable")}</p>
                    ) : null}
                  </>
                )}

                {arrivalTime && pickupTime ? (
                  <div className="mt-4 space-y-1 rounded-xl border border-blue-300/40 bg-blue-500/10 px-3 py-2 text-sm">
                    <p>
                      {t("workshopDetails.arrivalTime")}: {arrivalTime}
                    </p>
                    <p>
                      {t("workshopDetails.pickupTime")}: {pickupTime}
                    </p>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setBookingSuccess("");
                    setBookingError("");
                    void trackEvent("booking_start", {
                      workshopId: workshop.supabaseId,
                      workshopName: workshop.name,
                      service: selectedService?.service_name ?? null,
                    });
                    setIsBookingModalOpen(true);
                  }}
                  className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-3 text-sm font-semibold text-white"
                >
                  {t("workshopDetails.bookAppointment")}
                </button>
              </section>

              <section
                className={`relative h-56 overflow-hidden rounded-3xl border ${
                  isDark
                    ? "border-blue-500/25 bg-zinc-950"
                    : "border-blue-200 bg-white"
                }`}
              >
                {workshop.hasMapPin === true && workshopDetailHref ? (
                  <WorkshopLocationMiniMap
                    workshopId={workshop.id}
                    name={workshop.name}
                    addressLine={[workshop.city, workshop.address].filter(Boolean).join(" · ")}
                    lat={workshop.lat}
                    lng={workshop.lng}
                    detailsHref={workshopDetailHref}
                    rating={workshop.rating}
                    reviewsCount={workshop.reviewsCount}
                  />
                ) : (
                  <div
                    className={`flex h-full items-center justify-center px-4 text-center text-sm ${
                      isDark ? "text-zinc-400" : "text-zinc-600"
                    }`}
                  >
                    {workshop.hasPreciseMapCoords === true && workshop.showOnMap !== true
                      ? t("workshopDetails.workshopLocationNotOnPublicMap")
                      : t("workshopDetails.noWorkshopLocation")}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>

        {isBookingModalOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 sm:p-4">
            <div
              className={`max-h-[90vh] w-full max-w-[calc(100vw-24px)] overflow-y-auto rounded-3xl border p-4 backdrop-blur-xl sm:max-w-lg sm:p-6 ${
                isDark ? "border-zinc-700 bg-zinc-900/90 text-zinc-100" : "border-blue-200 bg-white/90 text-zinc-900"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-semibold">{t("workshopDetails.bookAppointment")}</h3>
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className={`rounded-xl border px-2 py-1 text-sm ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <p><strong>{workshop.name}</strong></p>
                <p>{selectedService?.service_name ?? "-"}</p>
                <p>{t("workshopDetails.price")}: {formatPriceRange(selectedService?.price_from, selectedService?.price_to, selectedService?.price)}</p>
                <p>{t("workshopDetails.serviceDuration")}: {selectedService?.duration_minutes ?? "-"} min</p>
                <p>
                  {t("workshopDetails.selectSlot")}:{" "}
                  {effectiveDateKey && effectiveSelectedTime
                    ? `${effectiveDateKey} ${effectiveSelectedTime}`
                    : "-"}
                </p>
                <p>{t("workshopDetails.pickupTime")}: {pickupTime || "-"}</p>
              </div>

              {!isLoggedIn ? (
                <div className="mt-5 rounded-2xl border border-orange-300/50 bg-orange-500/10 p-4 text-sm">
                  <p>{t("workshopDetails.loginRequired")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="/?auth=login"
                      className="inline-flex rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white"
                    >
                      {t("header.login")}
                    </Link>
                    <Link
                      href="/?auth=register"
                      className="inline-flex rounded-xl border border-blue-300 px-4 py-2 font-semibold"
                    >
                      {t("header.register")}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <p className="rounded-xl border border-blue-300/40 bg-blue-500/10 px-3 py-2 text-sm">
                    {effectiveDateKey && effectiveSelectedTime
                      ? `${effectiveDateKey} ${effectiveSelectedTime}`
                      : t("workshopDetails.noHoursAvailable")}
                  </p>
                  {!hasAcceptedPricingAndLiabilityNotice ? (
                    <label
                      className={`mt-3 flex items-start gap-3 rounded-xl border px-3 py-2 text-sm leading-snug ${
                        isDark
                          ? "border-zinc-700 bg-zinc-900/60 text-zinc-300"
                          : "border-zinc-300 bg-white text-zinc-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={pricingLiabilityNoticeAccepted}
                        onChange={(event) => setPricingLiabilityNoticeAccepted(event.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-400"
                      />
                      <span>
                        Rozumiem, że ceny widoczne w ServyGo mogą mieć charakter orientacyjny, a ostateczna cena usługi
                        zostanie potwierdzona przez warsztat przed wykonaniem usługi. Przyjmuję do wiadomości, że ServyGo
                        nie wykonuje usług motoryzacyjnych i nie odpowiada za samą naprawę pojazdu.
                      </span>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleBookingConfirm}
                    disabled={!effectiveDateKey || !effectiveSelectedTime || bookingLoading}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bookingLoading ? t("workshopDetails.savingBooking") : t("workshopDetails.confirmBooking")}
                  </button>
                </div>
              )}

              {bookingSuccess ? (
                <div className="mt-4 space-y-3">
                  <p
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      isDark ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {bookingSuccess}
                  </p>
                  <Link
                    href="/moje-rezerwacje"
                    className="inline-flex rounded-xl border border-blue-300/60 px-4 py-2 text-sm font-semibold transition hover:border-orange-300"
                  >
                    {t("workshopDetails.myBookings")}
                  </Link>
                </div>
              ) : null}
              {bookingError ? (
                <p
                  className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
                    isDark ? "border-orange-400/40 bg-orange-500/10 text-orange-200" : "border-orange-200 bg-orange-50 text-orange-700"
                  }`}
                >
                  {bookingError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {workshop ? (
          <MobileBottomSheet
            isOpen={servygoReviewOpen}
            title="Zostaw opinię ServyGo"
            onClose={() => {
              if (!servygoBusy) setServygoReviewOpen(false);
            }}
            isDark={isDark}
            tallList
            stackClassName="z-[10056]"
          >
            <div className="space-y-3 px-1 pb-4 text-sm">
              {servygoMsg ? (
                <p className={`rounded-xl border px-3 py-2 ${isDark ? "border-emerald-500/40 text-emerald-200" : "border-emerald-200 text-emerald-800"}`}>
                  {servygoMsg}
                </p>
              ) : null}
              {servygoEligible.length === 0 ? (
                <p className={isDark ? "text-zinc-400" : "text-zinc-600"}>
                  Możesz dodać opinię ServyGo po zakończonej lub potwierdzonej rezerwacji w tym warsztacie. Jeśli dopiero się umówiłeś, wróć po wizycie.
                </p>
              ) : (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="font-medium">Rezerwacja</span>
                    <select
                      value={servygoBookingId}
                      onChange={(e) => setServygoBookingId(e.target.value)}
                      className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                    >
                      <option value="">— wybierz —</option>
                      {servygoEligible.map((b) => (
                        <option key={b.id} value={b.id}>
                          {(b.service_name ?? "Usługa").slice(0, 60)} · {b.id.slice(0, 8)}…
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-medium">Ocena</span>
                    <select
                      value={servygoRating}
                      onChange={(e) => setServygoRating(Number(e.target.value))}
                      className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} — gwiazdek
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-medium">Treść opinii</span>
                    <textarea
                      rows={4}
                      value={servygoComment}
                      onChange={(e) => setServygoComment(e.target.value)}
                      className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                    />
                  </label>
                  <fieldset className="space-y-2">
                    <legend className="font-medium">Podpis przy opinii</legend>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={servygoDisplayMode === "first_initial"}
                        onChange={() => setServygoDisplayMode("first_initial")}
                      />
                      Imię i pierwsza litera nazwiska
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={servygoDisplayMode === "nickname"}
                        onChange={() => setServygoDisplayMode("nickname")}
                      />
                      Pseudonim
                    </label>
                  </fieldset>
                  {servygoDisplayMode === "nickname" ? (
                    <label className="flex flex-col gap-1">
                      <span className="font-medium">Pseudonim</span>
                      <input
                        value={servygoNickname}
                        onChange={(e) => setServygoNickname(e.target.value)}
                        className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                      />
                    </label>
                  ) : null}
                  <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>
                    Pełne nazwisko, e-mail i telefon nie są publikowane przy opinii ServyGo.
                  </p>
                  <button
                    type="button"
                    disabled={servygoBusy || !servygoBookingId || !servygoComment.trim()}
                    onClick={() => {
                      if (!currentUserId || !workshop.supabaseId || !supabase) return;
                      setServygoBusy(true);
                      setServygoMsg("");
                      const sid = servygoEligible.find((b) => b.id === servygoBookingId)?.service_name ?? null;
                      void (async () => {
                        try {
                          await submitServygoReview({
                            workshopId: workshop.supabaseId,
                            userId: currentUserId,
                            bookingId: servygoBookingId,
                            serviceName: sid,
                            rating: servygoRating,
                            comment: servygoComment,
                            displayNameMode: servygoDisplayMode,
                            nicknameForReview: servygoNickname,
                            profileFirstName: servygoProfileFirst,
                            profileLastName: servygoProfileLast,
                          });
                          const next = await fetchPublishedServygoReviewsForWorkshop(workshop.supabaseId);
                          setServygoReviews(next);
                          setServygoMsg("Dziękujemy — opinia została przekazana i oczekuje na moderację.");
                          setServygoComment("");
                        } catch (e) {
                          setServygoMsg(e instanceof Error ? e.message : "Nie udało się zapisać opinii.");
                        } finally {
                          setServygoBusy(false);
                        }
                      })();
                    }}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-orange-500 px-4 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {servygoBusy ? "Wysyłanie…" : "Wyślij opinię"}
                  </button>
                </>
              )}
            </div>
          </MobileBottomSheet>
        ) : null}
      </main>
    </ServyGoPageShell>
  );
}

export default function WorkshopDetailsClient() {
  return (
    <Suspense fallback={null}>
      <WorkshopDetailsPageContent />
    </Suspense>
  );
}
