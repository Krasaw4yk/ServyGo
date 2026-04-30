"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import InternalInbox from "@/components/InternalInbox";
import { getWorkshopDetailForAdmin } from "@/lib/adminApi";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { getUnreadMessagesCount, resolveMessageViewerContext, sendSystemMessage } from "@/lib/messagesApi";
import { sendBookingEmailNotification } from "@/lib/notificationApi";
import { isValidWorkshopGoogleMapsUrl, type Workshop } from "@/lib/workshopApi";
import {
  getAllServiceOptions,
  getVehicleBrands,
  getVehicleFuels,
  getVehicleModels,
  getVehicleYears,
  vehicleTypeOptions,
  type VehicleTypeKey,
} from "@/lib/vehicleData";
import {
  defaultOpeningSchedule,
  deleteWorkshopServiceConfigsForOwner,
  deleteWorkshopServiceVehiclePricesForOwner,
  deleteAvailabilityExceptionForOwner,
  getOwnedWorkshopForUser,
  googleReviewsHintUrl,
  listBookingsForWorkshopOwner,
  listAvailabilityExceptionsForOwner,
  listWorkshopServiceConfigsForOwner,
  listWorkshopServiceVehiclePricesForOwner,
  parseOpeningSchedule,
  stringifyOpeningSchedule,
  type WorkshopAvailabilityExceptionRow,
  type WorkshopOpeningDayKey,
  type WorkshopOpeningSchedule,
  type WorkshopOwnerBookingRow,
  type WorkshopEmployeeRow,
  type WorkshopOwnerProfilePatch,
  listWorkshopEmployeesForOwner,
  upsertWorkshopEmployeeForOwner,
  upsertAvailabilityExceptionForOwner,
  upsertWorkshopServiceConfigsForOwner,
  upsertWorkshopServiceVehiclePricesForOwner,
  cancelBookingAsWorkshopOwner,
  sendBookingQuoteAsWorkshopOwner,
  proposeBookingRescheduleAsWorkshopOwner,
  updateBookingStatusAsWorkshopOwner,
  updateOwnedWorkshopProfile,
} from "@/lib/workshopOwnerApi";

const WORKSHOP_SECTIONS = [
  "Dashboard",
  "Rezerwacje",
  "Wiadomości",
  "Kalendarz / dostępność",
  "Usługi i ceny",
  "Pracownicy",
  "Dane warsztatu",
  "Opinie Google",
  "Ustawienia",
] as const;

type WorkshopSection = (typeof WORKSHOP_SECTIONS)[number];
type ServiceDraftRow = {
  id?: string;
  service_key: string | null;
  service_name: string;
  category: string;
  description: string;
  price_from: string;
  price_to: string;
  duration_minutes: string;
  is_active: boolean;
  is_custom: boolean;
};
type ServiceVehiclePriceDraftRow = {
  id?: string;
  workshop_service_id: string;
  service_name: string;
  vehicle_type: VehicleTypeKey | "";
  brand: string;
  model: string;
  year_from: string;
  year_to: string;
  engine: string;
  fuel: string;
  transmission: string;
  price_from: string;
  price_to: string;
  duration_minutes: string;
  is_active: boolean;
};
type DayOverride = { closed: boolean; open: string; close: string };
type EmployeeDraft = {
  id?: string;
  temp_id: string;
  first_name: string;
  last_name: string;
  role: string;
  role_query: string;
  specializations: string[];
  specialization_query: string;
  role_dropdown_open: boolean;
  specialization_dropdown_open: boolean;
  show_all_specializations: boolean;
  is_active: boolean;
};

const EMPLOYEE_ROLE_OPTIONS = [
  "Mechanik samochodowy",
  "Elektromechanik",
  "Elektryk samochodowy",
  "Diagnosta samochodowy",
  "Wulkanizator",
  "Lakiernik",
  "Blacharz",
  "Specjalista klimatyzacji",
  "Mechanik ciężarowy",
  "Mechanik motocyklowy",
  "Pomocnik mechanika",
  "Kierownik serwisu",
  "Doradca serwisowy",
] as const;

const EMPLOYEE_SPECIALIZATION_OPTIONS = [
  "Diagnostyka komputerowa",
  "Wymiana oleju",
  "Wymiana filtrów",
  "Wymiana opon",
  "Wymiana klocków hamulcowych",
  "Wymiana tarcz hamulcowych",
  "Naprawa zawieszenia",
  "Układ wydechowy",
  "Układ paliwowy",
  "Klimatyzacja",
  "Elektryka",
  "Blacharka",
  "Lakiernictwo",
  "Geometria kół",
  "Regeneracja DPF / EGR",
  "Serwis sezonowy",
  "Przeglądy",
  "Naprawy powypadkowe",
] as const;

const ROLE_TO_SUGGESTED_SPECIALIZATIONS: Record<string, string[]> = {
  "mechanik samochodowy": [
    "Wymiana oleju",
    "Wymiana filtrów",
    "Wymiana klocków hamulcowych",
    "Wymiana tarcz hamulcowych",
    "Naprawa zawieszenia",
    "Układ wydechowy",
    "Układ paliwowy",
    "Serwis sezonowy",
    "Przeglądy",
  ],
  elektromechanik: [
    "Diagnostyka komputerowa",
    "Elektryka",
    "Czujniki",
    "Akumulator",
    "Alternator",
    "Rozrusznik",
    "Klimatyzacja",
    "Systemy elektroniczne",
  ],
  "elektryk samochodowy": [
    "Elektryka",
    "Akumulator",
    "Alternator",
    "Rozrusznik",
    "Oświetlenie",
    "Instalacje elektryczne",
    "Diagnostyka komputerowa",
  ],
  "diagnosta samochodowy": [
    "Diagnostyka komputerowa",
    "Przeglądy",
    "Kontrola układów bezpieczeństwa",
    "Analiza błędów",
    "Testy drogowe",
  ],
  wulkanizator: [
    "Wymiana opon",
    "Wyważanie kół",
    "Naprawa opon",
    "Geometria kół",
  ],
  lakiernik: [
    "Lakiernictwo",
    "Polerowanie",
    "Naprawy lakiernicze",
    "Dobór koloru",
  ],
  blacharz: [
    "Blacharka",
    "Naprawy powypadkowe",
    "Usuwanie wgnieceń",
    "Prostowanie elementów",
  ],
  "specjalista klimatyzacji": [
    "Klimatyzacja",
    "Odgrzybianie klimatyzacji",
    "Napełnianie klimatyzacji",
    "Diagnostyka klimatyzacji",
  ],
  "mechanik motocyklowy": [
    "Serwis motocykli",
    "Wymiana oleju",
    "Wymiana klocków hamulcowych",
    "Łańcuch i napęd",
    "Diagnostyka motocykla",
  ],
};

function mapAdminPreviewBooking(
  row: {
    id: string;
    user_id: string;
    workshop_id: string;
    workshop_name: string;
    service_name: string;
    price: number;
    duration_minutes: number;
    date: string;
    time: string;
    status: string;
    created_at: string;
  },
): WorkshopOwnerBookingRow {
  return {
    ...row,
    car_id: null,
    clientLabel: "Klient",
    clientEmail: "—",
    clientPhone: "—",
    carLabel: "—",
  };
}

function formatBookingStatus(status: string) {
  const x = status.toLowerCase();
  if (x === "awaiting_quote") return "Oczekuje na wycenę";
  if (x === "quote_sent") return "Wycena wysłana";
  if (x === "quote_accepted") return "Wycena zaakceptowana";
  if (x === "quote_rejected") return "Wycena odrzucona";
  if (x === "awaiting_reschedule") return "Oczekuje na decyzję dot. zmiany terminu";
  if (x === "pending" || x === "new") return "Oczekuje";
  if (x === "confirmed") return "Potwierdzona";
  if (x === "cancelled" || x === "cancelled_by_client" || x === "cancelled_by_workshop" || x === "cancelled_by_system") return "Anulowana";
  if (x === "completed" || x === "done") return "Zakończona";
  if (x === "rejected") return "Odrzucona";
  return status;
}

function statusPillClass(status: string, isDark: boolean) {
  const x = status.toLowerCase();
  if (x === "awaiting_quote") return isDark ? "bg-amber-500/20 text-amber-200" : "bg-amber-100 text-amber-700";
  if (x === "quote_sent") return isDark ? "bg-orange-500/20 text-orange-200" : "bg-orange-100 text-orange-700";
  if (x === "awaiting_reschedule") return isDark ? "bg-purple-500/20 text-purple-200" : "bg-purple-100 text-purple-700";
  if (x === "confirmed") return isDark ? "bg-emerald-500/20 text-emerald-200" : "bg-emerald-100 text-emerald-700";
  if (x === "completed" || x === "done") return isDark ? "bg-blue-500/20 text-blue-200" : "bg-blue-100 text-blue-700";
  if (x === "rejected" || x === "quote_rejected" || x === "cancelled" || x === "cancelled_by_client" || x === "cancelled_by_workshop" || x === "cancelled_by_system") return isDark ? "bg-rose-500/20 text-rose-200" : "bg-rose-100 text-rose-700";
  return isDark ? "bg-amber-500/20 text-amber-200" : "bg-amber-100 text-amber-700";
}

function hasWorkshopPanelAccess(workshop: Workshop, userId: string) {
  const ownerOk = workshop.owner_id === userId;
  const status = (workshop.status ?? "").toLowerCase().trim();
  const statusOk = status === "active" || status === "approved" || status === "aktywny";
  return ownerOk && statusOk;
}

function DashboardCardIcon({ type }: { type: "today" | "month" | "pending" | "done" | "rating" | "clicks" }) {
  if (type === "today") {
    return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 3v3M17 3v3M4 9h16" /><rect x="4" y="5" width="16" height="15" rx="2" /></svg>;
  }
  if (type === "month") {
    return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></svg>;
  }
  if (type === "pending") {
    return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  }
  if (type === "done") {
    return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 12 4 4 10-10" /><rect x="3" y="3" width="18" height="18" rx="2" /></svg>;
  }
  if (type === "rating") {
    return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.6L12 18l-5.8 3 1.1-6.6-4.7-4.6 6.5-.9L12 3Z" /></svg>;
  }
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12h14M12 5l7 7-7 7" /><path d="M5 5h5" /></svg>;
}

function asDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKeyLocal(dateKey: string) {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date(NaN);
  }
  return new Date(year, month - 1, day);
}

function dayOverrideFromWeekly(day: WorkshopOpeningSchedule[WorkshopOpeningDayKey]): DayOverride {
  return { closed: day.closed, open: day.open, close: day.close };
}

function weekdayKeyFromDate(dateKey: string): WorkshopOpeningDayKey {
  const date = parseDateKeyLocal(dateKey);
  const dow = date.getDay();
  const map: Record<number, WorkshopOpeningDayKey> = {
    0: "sun",
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
    6: "sat",
  };
  return map[dow] ?? "mon";
}


function WorkshopPanelPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdminPreview = searchParams.get("adminPreview") === "1";
  const previewWorkshopId = (searchParams.get("workshopId") ?? "").trim();
  const readOnly = isAdminPreview;
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [bookings, setBookings] = useState<WorkshopOwnerBookingRow[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeSection, setActiveSection] = useState<WorkshopSection>("Dashboard");
  const [selectedBooking, setSelectedBooking] = useState<WorkshopOwnerBookingRow | null>(null);
  const [opening, setOpening] = useState<WorkshopOpeningSchedule>(defaultOpeningSchedule);
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => asDateKey(new Date()));
  const [weekEditorDraft, setWeekEditorDraft] = useState<Record<string, DayOverride>>({});
  const [availabilityExceptions, setAvailabilityExceptions] = useState<WorkshopAvailabilityExceptionRow[]>([]);
  const [dayDraft, setDayDraft] = useState<DayOverride>({ closed: false, open: "08:00", close: "17:00" });
  const [savingDaySettings, setSavingDaySettings] = useState(false);
  const [savingWeekDateKey, setSavingWeekDateKey] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<WorkshopOwnerProfilePatch | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [serviceDraftRows, setServiceDraftRows] = useState<ServiceDraftRow[]>([]);
  const [serviceVehiclePriceDraftRows, setServiceVehiclePriceDraftRows] = useState<ServiceVehiclePriceDraftRow[]>([]);
  const [servicesCategoryFilter, setServicesCategoryFilter] = useState("Wszystkie");
  const [servicesActivityFilter, setServicesActivityFilter] = useState<"all" | "active" | "inactive">("all");
  const [savingServices, setSavingServices] = useState(false);
  const [savingVehiclePrices, setSavingVehiclePrices] = useState(false);
  const [selectedServiceForVehiclePricing, setSelectedServiceForVehiclePricing] = useState<string>("");
  const [isVehiclePricingModalOpen, setIsVehiclePricingModalOpen] = useState(false);
  const [employeeDraftRows, setEmployeeDraftRows] = useState<EmployeeDraft[]>([]);
  const [savingEmployees, setSavingEmployees] = useState(false);
  const [employeeRoleOptions, setEmployeeRoleOptions] = useState<string[]>(() => [...EMPLOYEE_ROLE_OPTIONS]);
  const [employeeSpecializationOptions, setEmployeeSpecializationOptions] = useState<string[]>(() => [...EMPLOYEE_SPECIALIZATION_OPTIONS]);
  const [showAddCustomServiceModal, setShowAddCustomServiceModal] = useState(false);
  const [customServiceDraft, setCustomServiceDraft] = useState({
    service_name: "",
    category: "Inne",
    description: "",
    price_from: "",
    price_to: "",
    duration_minutes: "",
    is_active: true,
  });
  const [bookingActionId, setBookingActionId] = useState<string | null>(null);
  const [quoteDraftByBookingId, setQuoteDraftByBookingId] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isDark = mounted ? theme === "dark" : false;
  const formInputClassName = `rounded-xl border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-white text-black" : "border-zinc-300 bg-white text-black"}`;
  const exceptionsMap = useMemo(() => {
    const map: Record<string, DayOverride> = {};
    for (const row of availabilityExceptions) {
      map[row.date] = {
        closed: row.is_closed,
        open: row.open_time ? row.open_time.slice(0, 5) : "08:00",
        close: row.close_time ? row.close_time.slice(0, 5) : "17:00",
      };
    }
    return map;
  }, [availabilityExceptions]);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem("servygo-theme");
    if (stored === "dark" || stored === "light") setTheme(stored);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("servygo-theme", theme);
  }, [mounted, theme]);

  useEffect(() => {
    if (!mounted) return;
    function handleResize() {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mounted]);

  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => setSuccess(""), 3000);
    return () => window.clearTimeout(id);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(""), 3000);
    return () => window.clearTimeout(id);
  }, [error]);

  useEffect(() => {
    setSuccess("");
    setError("");
  }, [activeSection]);

  const loadAll = useCallback(async (ws: Workshop) => {
    setError("");
    const [b, exceptions, serviceRows, vehiclePriceRows, employeeRows] = await Promise.all([
      listBookingsForWorkshopOwner(ws.id),
      listAvailabilityExceptionsForOwner(ws.id),
      listWorkshopServiceConfigsForOwner(ws.id),
      listWorkshopServiceVehiclePricesForOwner(ws.id),
      listWorkshopEmployeesForOwner(ws.id),
    ]);
    setBookings(b);
    setOpening(parseOpeningSchedule(ws.opening_hours));
    setAvailabilityExceptions(exceptions);
    setServiceDraftRows(
      serviceRows.map((row) => ({
        id: row.id,
        service_key: row.service_key,
        service_name: row.service_name,
        category: row.category ?? "Inne",
        description: row.description ?? "",
        price_from: row.price_from == null ? "" : String(row.price_from),
        price_to: row.price_to == null ? "" : String(row.price_to),
        duration_minutes: row.duration_minutes == null ? "" : String(row.duration_minutes),
        is_active: row.is_active,
        is_custom: row.is_custom,
      })),
    );
    setServiceVehiclePriceDraftRows(
      vehiclePriceRows.map((row) => ({
        id: row.id,
        workshop_service_id: row.workshop_service_id ?? "",
        service_name: row.service_name,
        vehicle_type: ((row.vehicle_type ?? "").trim().toLowerCase() as VehicleTypeKey) || "car",
        brand: row.brand ?? "",
        model: row.model ?? "",
        year_from: row.year_from == null ? "" : String(row.year_from),
        year_to: row.year_to == null ? "" : String(row.year_to),
        engine: row.engine ?? "",
        fuel: row.fuel ?? "",
        transmission: row.transmission ?? "",
        price_from: row.price_from == null ? "" : String(row.price_from),
        price_to: row.price_to == null ? "" : String(row.price_to),
        duration_minutes: row.duration_minutes == null ? "" : String(row.duration_minutes),
        is_active: row.is_active,
      })),
    );
    setEmployeeDraftRows(
      employeeRows.map((row) => ({
        id: row.id,
        temp_id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        role: row.role,
        role_query: row.role,
        specializations: row.specializations,
        specialization_query: "",
        role_dropdown_open: false,
        specialization_dropdown_open: false,
        show_all_specializations: false,
        is_active: row.is_active,
      })),
    );
    setEmployeeRoleOptions((prev) =>
      Array.from(new Set([...prev, ...employeeRows.map((r) => r.role).filter(Boolean)])),
    );
    setEmployeeSpecializationOptions((prev) =>
      Array.from(new Set([...prev, ...employeeRows.flatMap((r) => r.specializations)])),
    );
    setProfileDraft({
      name: ws.name,
      city: ws.city,
      address: ws.address,
      phone: ws.phone,
      email: ws.email,
      description: ws.description,
      google_maps_url: ws.google_maps_url ?? "",
      opening_hours: ws.opening_hours ?? "",
    });
  }, []);

  useEffect(() => {
    if (!mounted || !isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user ?? null;
      if (!u) {
        if (!cancelled) {
          setWorkshop(null);
          setLoading(false);
          router.replace("/?auth=login");
        }
        return;
      }
      setCurrentUserId(u.id);
      try {
        const unread = await getUnreadMessagesCount(u.id);
        if (!cancelled) setUnreadMessages(unread);
      } catch {
        if (!cancelled) setUnreadMessages(0);
      }
      const viewerContext = await resolveMessageViewerContext(u.id, u.email);
      if (isAdminPreview) {
        if (viewerContext.role !== "admin") {
          if (!cancelled) {
            setWorkshop(null);
            setAccessDenied(true);
            setError("Brak dostępu do podglądu administratora.");
            setLoading(false);
            router.replace("/");
          }
          return;
        }
        if (!previewWorkshopId) {
          if (!cancelled) {
            setWorkshop(null);
            setAccessDenied(true);
            setError("Brak identyfikatora warsztatu do podglądu.");
            setLoading(false);
            router.replace("/admin");
          }
          return;
        }
        try {
          const detail = await getWorkshopDetailForAdmin(u.id, u.email, previewWorkshopId);
          const ws: Workshop = {
            id: detail.id,
            owner_id: detail.owner_id ?? null,
            owner_user_id: detail.owner_user_id ?? null,
            name: detail.name,
            nip: detail.nip ?? null,
            phone: detail.phone ?? null,
            email: detail.email ?? null,
            city: detail.city ?? null,
            address: detail.address ?? null,
            description: detail.description ?? null,
            status: detail.status ?? null,
            google_maps_url: detail.google_maps_url ?? null,
            services_summary: detail.services_summary ?? null,
            opening_hours: detail.opening_hours ?? null,
            created_at: detail.created_at ?? null,
            updated_at: detail.updated_at ?? null,
          };
          if (!cancelled) {
            setWorkshop(ws);
            setBookings(detail.bookings.map(mapAdminPreviewBooking));
            setOpening(parseOpeningSchedule(ws.opening_hours));
            setProfileDraft({
              name: ws.name,
              city: ws.city,
              address: ws.address,
              phone: ws.phone,
              email: ws.email,
              description: ws.description,
              google_maps_url: ws.google_maps_url ?? "",
              opening_hours: ws.opening_hours ?? "",
            });
          }
          const [exceptions, serviceRows, vehiclePriceRows] = await Promise.all([
            listAvailabilityExceptionsForOwner(ws.id),
            listWorkshopServiceConfigsForOwner(ws.id),
            listWorkshopServiceVehiclePricesForOwner(ws.id),
          ]);
          if (!cancelled) {
            setAvailabilityExceptions(exceptions);
            setServiceDraftRows(
              serviceRows.map((row) => ({
                id: row.id,
                service_key: row.service_key,
                service_name: row.service_name,
                category: row.category ?? "Inne",
                description: row.description ?? "",
                price_from: row.price_from == null ? "" : String(row.price_from),
                price_to: row.price_to == null ? "" : String(row.price_to),
                duration_minutes: row.duration_minutes == null ? "" : String(row.duration_minutes),
                is_active: row.is_active,
                is_custom: row.is_custom,
              })),
            );
            setServiceVehiclePriceDraftRows(
              vehiclePriceRows.map((row) => ({
                id: row.id,
                workshop_service_id: row.workshop_service_id ?? "",
                service_name: row.service_name,
                vehicle_type: ((row.vehicle_type ?? "").trim().toLowerCase() as VehicleTypeKey) || "car",
                brand: row.brand ?? "",
                model: row.model ?? "",
                year_from: row.year_from == null ? "" : String(row.year_from),
                year_to: row.year_to == null ? "" : String(row.year_to),
                engine: row.engine ?? "",
                fuel: row.fuel ?? "",
                transmission: row.transmission ?? "",
                price_from: row.price_from == null ? "" : String(row.price_from),
                price_to: row.price_to == null ? "" : String(row.price_to),
                duration_minutes: row.duration_minutes == null ? "" : String(row.duration_minutes),
                is_active: row.is_active,
              })),
            );
          }
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Błąd ładowania podglądu administratora.");
            setWorkshop(null);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }
      if (viewerContext.role === "admin") {
        if (!cancelled) {
          setWorkshop(null);
          setLoading(false);
          router.replace("/admin");
        }
        return;
      }
      if (viewerContext.role !== "workshop") {
        if (!cancelled) {
          setWorkshop(null);
          setAccessDenied(true);
          setError("Panel warsztatu jest dostępny tylko dla właściciela aktywnego warsztatu.");
          setLoading(false);
          router.replace("/moje-konto");
        }
        return;
      }

      try {
        const ws = await getOwnedWorkshopForUser(u.id);
        if (!ws) {
          if (!cancelled) {
            setWorkshop(null);
            setAccessDenied(true);
            setError("Panel warsztatu jest dostępny tylko dla zaakceptowanych warsztatów.");
            setLoading(false);
            router.replace("/moje-konto");
          }
          return;
        }
        if (!hasWorkshopPanelAccess(ws, u.id)) {
          if (!cancelled) {
            setWorkshop(null);
            setAccessDenied(true);
            setError("Panel warsztatu jest dostępny tylko dla zaakceptowanych warsztatów.");
            setLoading(false);
            router.replace("/moje-konto");
          }
          return;
        }
        if (!cancelled) setWorkshop(ws);
        await loadAll(ws);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Błąd ładowania danych.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setWorkshop(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [mounted, router, loadAll, isAdminPreview, previewWorkshopId]);

  const reviewsUrl = useMemo(() => (workshop ? googleReviewsHintUrl(workshop) : ""), [workshop]);

  const stats = useMemo(() => {
    const today = asDateKey(new Date());
    const month = today.slice(0, 7);
    const todayBookings = bookings.filter((b) => b.date === today).length;
    const monthBookings = bookings.filter((b) => (b.date ?? "").startsWith(month)).length;
    const pendingBookings = bookings.filter((b) => {
      const st = b.status.toLowerCase();
      return st === "pending" || st === "new" || st === "awaiting_quote" || st === "quote_sent";
    }).length;
    const completedBookings = bookings.filter((b) => {
      const st = b.status.toLowerCase();
      return st === "completed" || st === "done";
    }).length;
    return {
      todayBookings,
      monthBookings,
      pendingBookings,
      completedBookings,
      googleAvg: 4.7,
      googleMapClicks: Math.max(0, monthBookings * 2),
    };
  }, [bookings]);

  const upcomingBookings = useMemo(() => {
    const now = new Date();
    const enriched = bookings
      .map((booking) => {
        const dateObj = parseDateKeyLocal(booking.date);
        const [hh, mm] = (booking.start_time?.slice(0, 5) ?? booking.time ?? "00:00").split(":").map(Number);
        dateObj.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
        return { booking, at: dateObj };
      })
      .filter((item) => Number.isFinite(item.at.getTime()) && item.at >= now)
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    return enriched.slice(0, 8);
  }, [bookings]);

  const activityEntries = useMemo(() => {
    return bookings
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((booking) => {
        const st = booking.status.toLowerCase();
        const action =
          st === "pending" || st === "new"
            ? "Nowa rezerwacja"
            : st === "cancelled" || st === "rejected"
              ? "Anulowanie / odrzucenie"
              : st === "confirmed"
                ? "Potwierdzona wizyta"
                : "Usługa zakończona";
        return {
          id: booking.id,
          action,
          details: `${booking.service_name} • ${booking.clientLabel}`,
          createdAt: booking.created_at,
        };
      });
  }, [bookings]);

  const topServices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const booking of bookings) {
      const key = booking.service_name?.trim() || "Nieznana usługa";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [bookings]);

  const monthCalendarDays = useMemo(() => {
    const y = calendarMonthCursor.getFullYear();
    const m = calendarMonthCursor.getMonth();
    const firstDay = new Date(y, m, 1);
    const firstDowMon0 = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(y, m, 1 - firstDowMon0);
    return Array.from({ length: 42 }, (_, idx) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + idx);
      const dateKey = asDateKey(d);
      const inCurrentMonth = d.getMonth() === m;
      const override = exceptionsMap[dateKey];
      const weekly = opening[weekdayKeyFromDate(dateKey)];
      const effective = override ?? dayOverrideFromWeekly(weekly);
      const busyCount = bookings.filter((b) => b.date === dateKey).length;
      const closed = effective.closed;
      return { date: d, dateKey, inCurrentMonth, closed, busyCount, effective };
    });
  }, [bookings, calendarMonthCursor, exceptionsMap, opening]);

  const selectedDateConfig = useMemo(() => {
    const override = exceptionsMap[selectedDateKey];
    const weekly = opening[weekdayKeyFromDate(selectedDateKey)];
    return override ?? dayOverrideFromWeekly(weekly);
  }, [exceptionsMap, opening, selectedDateKey]);

  const selectedDateObj = useMemo(() => parseDateKeyLocal(selectedDateKey), [selectedDateKey]);
  const activeWeekStart = useMemo(() => {
    const start = new Date(selectedDateObj);
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
    return start;
  }, [selectedDateObj]);
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(activeWeekStart);
      d.setDate(activeWeekStart.getDate() + i);
      return d;
    });
  }, [activeWeekStart]);
  const weekRangeLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    if (!start || !end) return "";
    const format = (date: Date) =>
      date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
    return `${format(start)}-${format(end)}`;
  }, [weekDates]);

  useEffect(() => {
    setDayDraft(selectedDateConfig);
  }, [selectedDateConfig]);

  useEffect(() => {
    const draft: Record<string, DayOverride> = {};
    for (const dateObj of weekDates) {
      const dateKey = asDateKey(dateObj);
      const override = exceptionsMap[dateKey];
      const weekly = opening[weekdayKeyFromDate(dateKey)];
      draft[dateKey] = override ?? dayOverrideFromWeekly(weekly);
    }
    setWeekEditorDraft(draft);
  }, [weekDates, exceptionsMap, opening]);

  useEffect(() => {
    const parsedDate = parseDateKeyLocal(selectedDateKey);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log("[WorkshopCalendar] selectedDate:", selectedDateKey);
    console.log("[WorkshopCalendar] parsedDate:", parsedDate.toString());
    console.log("[WorkshopCalendar] timezone:", timezone);
  }, [selectedDateKey]);

  const monthSummary = useMemo(() => {
    const todayKey = asDateKey(new Date());
    const todayItems = monthCalendarDays.filter((d) => d.dateKey === todayKey);
    const todayBusy = todayItems[0]?.busyCount ?? 0;
    const todayClosed = todayItems[0]?.closed ?? false;
    const todayAvailableSlots = todayClosed ? 0 : Math.max(0, 8 - todayBusy);
    const monthClosedDays = monthCalendarDays.filter((d) => d.inCurrentMonth && d.closed).length;
    return { todayBusy, todayAvailableSlots, monthClosedDays };
  }, [monthCalendarDays]);
  const activeCalendarStatuses = new Set([
    "awaiting_quote",
    "quote_sent",
    "quote_accepted",
    "awaiting_reschedule",
    "confirmed",
  ]);
  const dailySummary = useMemo(() => {
    const today = asDateKey(new Date());
    const todayRows = bookings.filter((b) => b.date === today);
    const active = todayRows.filter((b) => activeCalendarStatuses.has((b.status ?? "").toLowerCase())).length;
    const cancelled = todayRows.filter((b) => (b.status ?? "").toLowerCase().startsWith("cancelled")).length;
    return { all: todayRows.length, active, cancelled };
  }, [bookings]);
  const weeklySummary = useMemo(() => {
    const weekKeys = new Set(weekDates.map((d) => asDateKey(d)));
    const weekRows = bookings.filter((b) => weekKeys.has(b.date));
    const active = weekRows.filter((b) => activeCalendarStatuses.has((b.status ?? "").toLowerCase())).length;
    const cancelled = weekRows.filter((b) => (b.status ?? "").toLowerCase().startsWith("cancelled")).length;
    return { all: weekRows.length, active, cancelled };
  }, [bookings, weekDates]);
  const selectedDaySlots = useMemo(() => {
    if (dayDraft.closed) return [] as string[];
    const [openH, openM] = dayDraft.open.split(":").map(Number);
    const [closeH, closeM] = dayDraft.close.split(":").map(Number);
    const startMinutes = openH * 60 + openM;
    const endMinutes = closeH * 60 + closeM;
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) return [] as string[];
    const out: string[] = [];
    for (let t = startMinutes; t < endMinutes; t += 30) {
      const hh = String(Math.floor(t / 60)).padStart(2, "0");
      const mm = String(t % 60).padStart(2, "0");
      out.push(`${hh}:${mm}`);
    }
    return out;
  }, [dayDraft]);

  const serviceCatalogRows = useMemo(() => {
    const bucket = new Map<string, { key: string; name: string; category: string }>();
    for (const name of getAllServiceOptions()) {
      const lower = name.toLowerCase();
      const category = lower.includes("olej") || lower.includes("filtr")
        ? "Serwis okresowy"
        : lower.includes("hamul")
          ? "Hamulce"
          : lower.includes("opon") || lower.includes("koł")
            ? "Opony i koła"
            : lower.includes("diagnost")
              ? "Diagnostyka"
              : lower.includes("klimatyz")
                ? "Klimatyzacja"
                : lower.includes("akumulator")
                  ? "Elektryka"
                  : lower.includes("zawieszen")
                    ? "Zawieszenie"
                    : "Inne";
      const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      bucket.set(key, { key, name, category });
    }
    return Array.from(bucket.values()).sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, []);

  const mergedServiceRows = useMemo(() => {
    const byKey = new Map(serviceDraftRows.map((r) => [r.service_key ?? `custom:${r.service_name}`, r]));
    const merged: ServiceDraftRow[] = [];
    for (const item of serviceCatalogRows) {
      const existing = byKey.get(item.key);
      merged.push(
        existing ?? {
          service_key: item.key,
          service_name: item.name,
          category: item.category,
          description: "",
          price_from: "",
          price_to: "",
          duration_minutes: "",
          is_active: false,
          is_custom: false,
        },
      );
      byKey.delete(item.key);
    }
    for (const row of byKey.values()) merged.push(row);
    return merged;
  }, [serviceCatalogRows, serviceDraftRows]);

  const serviceCategories = useMemo(() => {
    const values = Array.from(new Set(mergedServiceRows.map((r) => r.category || "Inne")));
    return ["Wszystkie", ...values.sort((a, b) => a.localeCompare(b, "pl"))];
  }, [mergedServiceRows]);

  const visibleServiceRows = useMemo(
    () =>
      mergedServiceRows.filter((r) => {
        const categoryOk = servicesCategoryFilter === "Wszystkie" || (r.category || "Inne") === servicesCategoryFilter;
        const activityOk = servicesActivityFilter === "all"
          ? true
          : servicesActivityFilter === "active"
            ? r.is_active
            : !r.is_active;
        return categoryOk && activityOk;
      }),
    [mergedServiceRows, servicesCategoryFilter, servicesActivityFilter],
  );
  const vehicleYearOptions = useMemo(() => getVehicleYears(), []);
  const serviceNameOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...serviceCatalogRows.map((row) => row.name),
          ...mergedServiceRows.map((row) => row.service_name).filter(Boolean),
        ]),
      ).sort((a, b) => a.localeCompare(b, "pl")),
    [mergedServiceRows, serviceCatalogRows],
  );
  const vehiclePriceCountByService = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of serviceVehiclePriceDraftRows) {
      const key = row.service_name.trim().toLowerCase();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + (row.is_active ? 1 : 0));
    }
    return map;
  }, [serviceVehiclePriceDraftRows]);
  const selectedServiceVehicleRows = useMemo(
    () =>
      selectedServiceForVehiclePricing
        ? serviceVehiclePriceDraftRows.filter(
            (row) => row.service_name.trim().toLowerCase() === selectedServiceForVehiclePricing.trim().toLowerCase(),
          )
        : [],
    [selectedServiceForVehiclePricing, serviceVehiclePriceDraftRows],
  );

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    if (!workshop || !profileDraft) return;
    setSavingProfile(true);
    setError("");
    setSuccess("");
    try {
      const maps = profileDraft.google_maps_url?.trim() ?? "";
      if (maps && !isValidWorkshopGoogleMapsUrl(maps)) {
        throw new Error("Nieprawidłowy link Google Maps.");
      }
      await updateOwnedWorkshopProfile(workshop.id, {
        ...profileDraft,
        opening_hours: stringifyOpeningSchedule(opening),
      });
      setWorkshop((w) =>
        w
          ? {
              ...w,
              name: profileDraft.name.trim(),
              city: profileDraft.city,
              address: profileDraft.address,
              phone: profileDraft.phone,
              email: profileDraft.email,
              description: profileDraft.description,
              google_maps_url: maps || null,
              opening_hours: stringifyOpeningSchedule(opening),
            }
          : w,
      );
      setSuccess("Dane warsztatu zapisane.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function setBookingStatus(id: string, status: "completed") {
    if (readOnly) return;
    const booking = bookings.find((item) => item.id === id);
    setBookingActionId(id);
    setError("");
    try {
      await updateBookingStatusAsWorkshopOwner(id, status);
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
      if (booking && workshop) {
        const statusLabel = "Zakończona";
        await sendSystemMessage({
          recipientId: booking.user_id,
          recipientRole: "client",
          subject: `Aktualizacja rezerwacji: ${booking.service_name}`,
          body: [
            `Warsztat: ${workshop.name}`,
            `Usługa: ${booking.service_name}`,
            `Termin: ${booking.date} ${booking.start_time?.slice(0, 5) ?? booking.time}`,
            `Status: ${statusLabel}`,
            "",
            "Wizyta została oznaczona jako zakończona.",
          ].join("\n"),
          relatedBookingId: booking.id,
          relatedWorkshopId: workshop.id,
        });
      }
      setSuccess("Status rezerwacji został zaktualizowany.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd aktualizacji rezerwacji.");
    } finally {
      setBookingActionId(null);
    }
  }

  async function sendQuoteForBooking(id: string) {
    if (readOnly || !workshop) return;
    const booking = bookings.find((item) => item.id === id);
    if (!booking) return;
    const raw = (quoteDraftByBookingId[id] ?? "").trim().replace(",", ".");
    const finalPrice = Number(raw);
    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
      setError("Podaj prawidłową cenę końcową.");
      return;
    }
    setBookingActionId(id);
    setError("");
    try {
      await sendBookingQuoteAsWorkshopOwner(id, finalPrice);
      const now = new Date().toISOString();
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, status: "quote_sent", final_price: finalPrice, quote_sent_at: now }
            : b,
        ),
      );
      await sendSystemMessage({
        recipientId: booking.user_id,
        recipientRole: "client",
        subject: `Wycena: ${booking.service_name}`,
        body: [
          `Warsztat: ${workshop.name}`,
          `Usługa: ${booking.service_name}`,
          `Termin: ${booking.date} ${booking.start_time?.slice(0, 5) ?? booking.time}`,
          `Cena końcowa: ${finalPrice.toFixed(2)} zł`,
          "",
          "To jest aktywna wycena. Możesz ją zaakceptować lub odrzucić w skrzynce wiadomości.",
        ].join("\n"),
        relatedBookingId: booking.id,
        relatedWorkshopId: workshop.id,
      });
      await sendBookingEmailNotification({
        bookingId: booking.id,
        workshopId: workshop.id,
        recipientId: booking.user_id,
        subject: `ServyGo: ${booking.service_name} - nowa wycena`,
        message: `Warsztat ${workshop.name} wysłał wycenę: ${finalPrice.toFixed(2)} zł. Sprawdź skrzynkę wiadomości w ServyGo.`,
      });
      setSuccess("Wycena została wysłana do klienta.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wysłać wyceny.");
    } finally {
      setBookingActionId(null);
    }
  }

  async function cancelBookingByWorkshop(id: string) {
    if (readOnly || !workshop) return;
    const booking = bookings.find((item) => item.id === id);
    if (!booking) return;
    const reason = window.prompt("Podaj krótki powód anulowania:");
    if (!reason) return;
    setBookingActionId(id);
    setError("");
    try {
      await cancelBookingAsWorkshopOwner(id, reason);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, status: "cancelled_by_workshop", cancel_reason: reason.trim() }
            : b,
        ),
      );
      await sendSystemMessage({
        recipientId: booking.user_id,
        recipientRole: "client",
        subject: `Anulowanie rezerwacji: ${booking.service_name}`,
        body: [
          `Warsztat: ${workshop.name}`,
          `Usługa: ${booking.service_name}`,
          `Termin: ${booking.date} ${booking.start_time?.slice(0, 5) ?? booking.time}`,
          `Powód anulowania: ${reason.trim()}`,
        ].join("\n"),
        relatedBookingId: booking.id,
        relatedWorkshopId: workshop.id,
      });
      await sendBookingEmailNotification({
        bookingId: booking.id,
        workshopId: workshop.id,
        recipientId: booking.user_id,
        subject: `ServyGo: anulowanie rezerwacji ${booking.service_name}`,
        message: `Warsztat ${workshop.name} anulował rezerwację. Powód: ${reason.trim()}`,
      });
      setSuccess("Rezerwacja została anulowana.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się anulować rezerwacji.");
    } finally {
      setBookingActionId(null);
    }
  }

  async function proposeRescheduleByWorkshop(id: string) {
    if (readOnly || !workshop) return;
    const booking = bookings.find((item) => item.id === id);
    if (!booking) return;
    const newDate = window.prompt("Podaj nową datę (YYYY-MM-DD):", booking.date);
    if (!newDate?.trim()) return;
    const newTime = window.prompt("Podaj nową godzinę (HH:MM):", booking.start_time?.slice(0, 5) ?? booking.time ?? "");
    if (!newTime?.trim()) return;
    const reason = window.prompt("Podaj krótki powód zmiany terminu:");
    if (!reason?.trim()) return;
    setBookingActionId(id);
    setError("");
    try {
      await proposeBookingRescheduleAsWorkshopOwner(id, newDate.trim(), newTime.trim(), reason.trim());
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                status: "awaiting_reschedule",
                proposed_booking_date: newDate.trim(),
                proposed_start_time: newTime.trim(),
                reschedule_reason: reason.trim(),
              }
            : b,
        ),
      );
      await sendSystemMessage({
        recipientId: booking.user_id,
        recipientRole: "client",
        subject: `Propozycja nowego terminu: ${booking.service_name}`,
        body: [
          `Warsztat: ${workshop.name}`,
          `Aktualny termin: ${booking.date} ${booking.start_time?.slice(0, 5) ?? booking.time}`,
          `Proponowany termin: ${newDate.trim()} ${newTime.trim()}`,
          `Powód: ${reason.trim()}`,
          "",
          "W skrzynce możesz zaakceptować lub odrzucić propozycję.",
        ].join("\n"),
        relatedBookingId: booking.id,
        relatedWorkshopId: workshop.id,
      });
      await sendBookingEmailNotification({
        bookingId: booking.id,
        workshopId: workshop.id,
        recipientId: booking.user_id,
        subject: `ServyGo: propozycja nowego terminu (${booking.service_name})`,
        message: `Warsztat zaproponował nowy termin: ${newDate.trim()} ${newTime.trim()}. Powód: ${reason.trim()}`,
      });
      setSuccess("Wysłano propozycję zmiany terminu.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zaproponować nowego terminu.");
    } finally {
      setBookingActionId(null);
    }
  }

  function patchWeekDay(dateKey: string, part: Partial<DayOverride>) {
    setWeekEditorDraft((prev) => ({ ...prev, [dateKey]: { ...prev[dateKey], ...part } }));
  }

  async function saveWeekDate(dateKey: string, config: DayOverride) {
    if (readOnly || !workshop) return;
    setSavingWeekDateKey(dateKey);
    setError("");
    setSuccess("");
    try {
      await upsertAvailabilityExceptionForOwner(workshop.id, {
        date: dateKey,
        is_closed: config.closed,
        open_time: config.closed ? null : config.open,
        close_time: config.closed ? null : config.close,
      });
      const refreshed = await listAvailabilityExceptionsForOwner(workshop.id);
      setAvailabilityExceptions(refreshed);
      setSuccess(`Zapisano ustawienia dnia ${dateKey}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu dnia tygodnia.");
    } finally {
      setSavingWeekDateKey(null);
    }
  }

  async function clearWeekDate(dateKey: string) {
    if (readOnly || !workshop) return;
    setSavingWeekDateKey(dateKey);
    setError("");
    setSuccess("");
    try {
      await deleteAvailabilityExceptionForOwner(workshop.id, dateKey);
      const refreshed = await listAvailabilityExceptionsForOwner(workshop.id);
      setAvailabilityExceptions(refreshed);
      setSuccess(`Usunięto wyjątek dnia ${dateKey}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd usuwania wyjątku dnia tygodnia.");
    } finally {
      setSavingWeekDateKey(null);
    }
  }

  async function saveSelectedDate(config: DayOverride) {
    if (readOnly) return;
    if (!workshop) return;
    setSavingDaySettings(true);
    setError("");
    setSuccess("");
    try {
      await upsertAvailabilityExceptionForOwner(workshop.id, {
        date: selectedDateKey,
        is_closed: config.closed,
        open_time: config.closed ? null : config.open,
        close_time: config.closed ? null : config.close,
      });
      const refreshed = await listAvailabilityExceptionsForOwner(workshop.id);
      setAvailabilityExceptions(refreshed);
      setSuccess("Ustawienia dnia zapisane.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu dnia.");
    } finally {
      setSavingDaySettings(false);
    }
  }

  async function closeSelectedDay() {
    if (readOnly) return;
    await saveSelectedDate({ closed: true, open: "08:00", close: "17:00" });
  }

  async function clearSelectedDateOverride() {
    if (readOnly) return;
    if (!workshop) return;
    setSavingDaySettings(true);
    setError("");
    setSuccess("");
    try {
      await deleteAvailabilityExceptionForOwner(workshop.id, selectedDateKey);
      const refreshed = await listAvailabilityExceptionsForOwner(workshop.id);
      setAvailabilityExceptions(refreshed);
      setSuccess("Usunięto wyjątek dnia.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd usuwania wyjątku.");
    } finally {
      setSavingDaySettings(false);
    }
  }

  function shiftWeek(direction: -1 | 1) {
    const next = new Date(selectedDateObj);
    next.setDate(selectedDateObj.getDate() + direction * 7);
    setSelectedDateKey(asDateKey(next));
    setCalendarMonthCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function patchServiceRow(target: ServiceDraftRow, patch: Partial<ServiceDraftRow>) {
    const key = target.id ? `id:${target.id}` : `key:${target.service_key ?? target.service_name}`;
    setServiceDraftRows((_prev) => {
      const merged = mergedServiceRows.map((row) => {
        const rowKey = row.id ? `id:${row.id}` : `key:${row.service_key ?? row.service_name}`;
        return rowKey === key ? { ...row, ...patch } : row;
      });
      return merged.filter((r) => r.is_custom || r.service_key !== null || r.is_active || r.price_from || r.price_to || r.duration_minutes);
    });
  }

  async function saveServices() {
    if (readOnly) return;
    if (!workshop) return;
    setSavingServices(true);
    setError("");
    setSuccess("");
    try {
      const idsToDelete = mergedServiceRows
        .filter((row) =>
          Boolean(row.id) &&
          row.is_custom &&
          !row.is_active &&
          !row.price_from.trim() &&
          !row.price_to.trim() &&
          !row.duration_minutes.trim() &&
          !row.description.trim(),
        )
        .map((row) => row.id as string);

      const rows = mergedServiceRows
        .filter((row) => {
          if (row.id) return !idsToDelete.includes(row.id);
          return row.is_custom || row.is_active || row.price_from.trim() || row.price_to.trim() || row.duration_minutes.trim();
        })
        .map((row) => ({
          id: row.id,
          service_key: row.service_key,
          service_name: row.service_name,
          category: row.category,
          description: row.description || null,
          price_from: row.price_from.trim() ? Number(row.price_from) : null,
          price_to: row.price_to.trim() ? Number(row.price_to) : null,
          duration_minutes: row.duration_minutes.trim() ? Number(row.duration_minutes) : null,
          is_active: row.is_active,
          is_custom: row.is_custom,
        }));
      await deleteWorkshopServiceConfigsForOwner(workshop.id, idsToDelete);
      await upsertWorkshopServiceConfigsForOwner(workshop.id, rows);
      const refreshed = await listWorkshopServiceConfigsForOwner(workshop.id);
      setServiceDraftRows(
        refreshed.map((row) => ({
          id: row.id,
          service_key: row.service_key,
          service_name: row.service_name,
          category: row.category ?? "Inne",
          description: row.description ?? "",
          price_from: row.price_from == null ? "" : String(row.price_from),
          price_to: row.price_to == null ? "" : String(row.price_to),
          duration_minutes: row.duration_minutes == null ? "" : String(row.duration_minutes),
          is_active: row.is_active,
          is_custom: row.is_custom,
        })),
      );
      setSuccess("Usługi i ceny zostały zapisane.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu usług.");
    } finally {
      setSavingServices(false);
    }
  }

  async function deleteServiceRow(row: ServiceDraftRow) {
    if (readOnly || !workshop) return;
    const confirmed = window.confirm(`Usunąć usługę "${row.service_name}" wraz z przypisanymi cenami aut?`);
    if (!confirmed) return;
    setError("");
    setSuccess("");
    try {
      const linkedVehiclePriceIds = serviceVehiclePriceDraftRows
        .filter((priceRow) => priceRow.service_name.trim().toLowerCase() === row.service_name.trim().toLowerCase() && priceRow.id)
        .map((priceRow) => priceRow.id as string);
      await deleteWorkshopServiceVehiclePricesForOwner(workshop.id, linkedVehiclePriceIds);
      if (row.id) {
        await deleteWorkshopServiceConfigsForOwner(workshop.id, [row.id]);
      }
      setServiceDraftRows((prev) =>
        prev.filter((item) => (item.id ?? item.service_key ?? item.service_name) !== (row.id ?? row.service_key ?? row.service_name)),
      );
      setServiceVehiclePriceDraftRows((prev) =>
        prev.filter((priceRow) => priceRow.service_name.trim().toLowerCase() !== row.service_name.trim().toLowerCase()),
      );
      if (selectedServiceForVehiclePricing.trim().toLowerCase() === row.service_name.trim().toLowerCase()) {
        setSelectedServiceForVehiclePricing("");
      }
      setSuccess(`Usługa "${row.service_name}" została usunięta.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się usunąć usługi.");
    }
  }

  function patchServiceVehiclePriceRow(target: ServiceVehiclePriceDraftRow, patch: Partial<ServiceVehiclePriceDraftRow>) {
    const key = target.id ? `id:${target.id}` : `tmp:${target.service_name}:${target.brand}:${target.model}:${target.engine}`;
    setServiceVehiclePriceDraftRows((prev) =>
      prev.map((row) => {
        const rowKey = row.id ? `id:${row.id}` : `tmp:${row.service_name}:${row.brand}:${row.model}:${row.engine}`;
        return rowKey === key ? { ...row, ...patch } : row;
      }),
    );
  }

  function addServiceVehiclePriceRow(serviceName = "") {
    setServiceVehiclePriceDraftRows((prev) => [
      ...prev,
      {
        workshop_service_id: "",
        service_name: serviceName,
        vehicle_type: "car",
        brand: "",
        model: "",
        year_from: "",
        year_to: "",
        engine: "",
        fuel: "",
        transmission: "",
        price_from: "",
        price_to: "",
        duration_minutes: "",
        is_active: true,
      },
    ]);
  }

  function removeServiceVehiclePriceRow(target: ServiceVehiclePriceDraftRow) {
    const key = target.id ? `id:${target.id}` : `tmp:${target.service_name}:${target.brand}:${target.model}:${target.engine}`;
    setServiceVehiclePriceDraftRows((prev) =>
      prev.filter((row) => {
        const rowKey = row.id ? `id:${row.id}` : `tmp:${row.service_name}:${row.brand}:${row.model}:${row.engine}`;
        return rowKey !== key;
      }),
    );
  }

  async function saveServiceVehiclePrices() {
    if (readOnly || !workshop) return;
    setSavingVehiclePrices(true);
    setError("");
    setSuccess("");
    try {
      const idsToDelete = serviceVehiclePriceDraftRows
        .filter(
          (row) =>
            Boolean(row.id) &&
            !row.is_active &&
            !row.service_name.trim() &&
            !row.price_from.trim() &&
            !row.price_to.trim() &&
            !row.duration_minutes.trim(),
        )
        .map((row) => row.id as string);
      const rows = serviceVehiclePriceDraftRows
        .filter((row) => {
          if (row.id) return !idsToDelete.includes(row.id);
          return Boolean(row.service_name.trim());
        })
        .map((row) => {
          const trimmedService = row.service_name.trim();
          const linkedService = mergedServiceRows.find(
            (item) => item.service_name.trim().toLowerCase() === trimmedService.toLowerCase(),
          );
          return {
            id: row.id,
            workshop_service_id: row.workshop_service_id || linkedService?.id || null,
            service_name: trimmedService,
            vehicle_type: row.vehicle_type || "car",
            brand: row.brand.trim() || null,
            model: row.model.trim() || null,
            year_from: row.year_from.trim() ? Number(row.year_from) : null,
            year_to: row.year_to.trim() ? Number(row.year_to) : null,
            engine: row.engine.trim() || null,
            fuel: row.fuel.trim() || null,
            transmission: row.transmission.trim() || null,
            price_from: row.price_from.trim() ? Number(row.price_from) : null,
            price_to: row.price_to.trim() ? Number(row.price_to) : null,
            duration_minutes: row.duration_minutes.trim() ? Number(row.duration_minutes) : null,
            is_active: row.is_active,
          };
        });
      await deleteWorkshopServiceVehiclePricesForOwner(workshop.id, idsToDelete);
      await upsertWorkshopServiceVehiclePricesForOwner(workshop.id, rows);
      const refreshed = await listWorkshopServiceVehiclePricesForOwner(workshop.id);
      setServiceVehiclePriceDraftRows(
        refreshed.map((row) => ({
          id: row.id,
          workshop_service_id: row.workshop_service_id ?? "",
          service_name: row.service_name,
          vehicle_type: ((row.vehicle_type ?? "").trim().toLowerCase() as VehicleTypeKey) || "car",
          brand: row.brand ?? "",
          model: row.model ?? "",
          year_from: row.year_from == null ? "" : String(row.year_from),
          year_to: row.year_to == null ? "" : String(row.year_to),
          engine: row.engine ?? "",
          fuel: row.fuel ?? "",
          transmission: row.transmission ?? "",
          price_from: row.price_from == null ? "" : String(row.price_from),
          price_to: row.price_to == null ? "" : String(row.price_to),
          duration_minutes: row.duration_minutes == null ? "" : String(row.duration_minutes),
          is_active: row.is_active,
        })),
      );
      setSuccess("Ceny usług pod konkretne auta zostały zapisane.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu cen pod auta.");
    } finally {
      setSavingVehiclePrices(false);
    }
  }

  function patchEmployeeRow(target: EmployeeDraft, patch: Partial<EmployeeDraft>) {
    const key = target.temp_id;
    setEmployeeDraftRows((prev) =>
      prev.map((row) => {
        const rowKey = row.temp_id;
        return rowKey === key ? { ...row, ...patch } : row;
      }),
    );
  }

  async function saveEmployees() {
    if (readOnly || !workshop) return;
    setSavingEmployees(true);
    setError("");
    setSuccess("");
    try {
      for (const row of employeeDraftRows) {
        if (!row.first_name.trim() || !row.last_name.trim() || !row.role.trim()) continue;
        await upsertWorkshopEmployeeForOwner(workshop.id, {
          id: row.id,
          first_name: row.first_name,
          last_name: row.last_name,
          role: row.role,
          specializations: row.specializations,
          is_active: row.is_active,
        });
      }
      const refreshed = await listWorkshopEmployeesForOwner(workshop.id);
      setEmployeeDraftRows(
        refreshed.map((row) => ({
          id: row.id,
          temp_id: row.id,
          first_name: row.first_name,
          last_name: row.last_name,
          role: row.role,
          role_query: row.role,
          specializations: row.specializations,
          specialization_query: "",
          role_dropdown_open: false,
          specialization_dropdown_open: false,
          show_all_specializations: false,
          is_active: row.is_active,
        })),
      );
      setEmployeeRoleOptions((prev) =>
        Array.from(new Set([...prev, ...refreshed.map((r) => r.role).filter(Boolean)])),
      );
      setEmployeeSpecializationOptions((prev) =>
        Array.from(new Set([...prev, ...refreshed.flatMap((r) => r.specializations)])),
      );
      setSuccess("Pracownicy zostali zapisani.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu pracowników.");
    } finally {
      setSavingEmployees(false);
    }
  }

  async function handleSignOut() {
    await supabase?.auth.signOut();
    router.replace("/");
  }

  if (!mounted) return null;

  if (!isSupabaseConfigured) {
    return (
      <ServyGoPageShell isDark={false}>
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-sm">Brak konfiguracji Supabase.</p>
        </main>
      </ServyGoPageShell>
    );
  }

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className={`min-h-screen w-full max-w-none px-3 py-3 sm:px-4 lg:px-5 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
        <div className="flex w-full gap-3 lg:gap-4">
          <aside className="hidden md:block md:w-60 md:min-w-[15rem] md:max-w-[15rem] md:flex-shrink-0 xl:w-64 xl:min-w-[16rem] xl:max-w-[16rem]">
            <div className={`sticky top-4 rounded-3xl border p-4 backdrop-blur-xl ${isDark ? "border-blue-500/25 bg-zinc-900/92" : "border-blue-200/85 bg-white/85"}`}>
              <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-blue-400">ServyGo Workshop</p>
              <nav className="space-y-1.5">
                {WORKSHOP_SECTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveSection(item)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                      activeSection === item
                        ? isDark
                          ? "bg-gradient-to-r from-blue-600/80 to-orange-500/80 text-white"
                          : "bg-gradient-to-r from-blue-600 to-orange-500 text-white"
                        : isDark
                          ? "text-zinc-200 hover:bg-zinc-800/80"
                          : "text-zinc-700 hover:bg-blue-50"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {item === "Wiadomości" ? (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <path d="m4 7 8 6 8-6" />
                        </svg>
                      ) : null}
                      <span>{item}</span>
                      {item === "Wiadomości" && unreadMessages > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                          {unreadMessages > 99 ? "99+" : unreadMessages}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {isSidebarOpen ? (
            <div className="fixed inset-0 z-40 md:hidden" aria-label="Mobile sidebar overlay">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="absolute inset-0 bg-black/50"
                aria-label="Zamknij menu"
              />
              <aside className="absolute inset-y-0 left-0 w-[80%] max-w-[20rem] overflow-y-auto border-r border-blue-200/70 bg-white p-4 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold uppercase tracking-wider text-blue-500">ServyGo Workshop</p>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="rounded-lg border px-2 py-1 text-sm"
                    aria-label="Zamknij menu"
                  >
                    ✕
                  </button>
                </div>
                <nav className="space-y-1.5">
                  {WORKSHOP_SECTIONS.map((item) => (
                    <button
                      key={`mobile-${item}`}
                      type="button"
                      onClick={() => {
                        setActiveSection(item);
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                        activeSection === item
                          ? "bg-gradient-to-r from-blue-600 to-orange-500 text-white"
                          : "text-zinc-700 hover:bg-blue-50"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {item === "Wiadomości" ? (
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="3" y="5" width="18" height="14" rx="2" />
                            <path d="m4 7 8 6 8-6" />
                          </svg>
                        ) : null}
                        <span>{item}</span>
                        {item === "Wiadomości" && unreadMessages > 0 ? (
                          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                            {unreadMessages > 99 ? "99+" : unreadMessages}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </nav>
              </aside>
            </div>
          ) : null}

          <section className="min-w-0 flex-1 space-y-4">
            <header className={`rounded-3xl border px-4 py-3 backdrop-blur-xl sm:px-5 ${isDark ? "border-blue-500/25 bg-zinc-900/88" : "border-blue-200/85 bg-white/86"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-300/70 text-xl md:hidden"
                    aria-label="Otwórz menu panelu"
                  >
                    ☰
                  </button>
                  <Link href="/" className="inline-flex items-center">
                    <Image
                      src={isDark ? "/servygo-logo-dark-cropped.png" : "/servygo-logo-light-cropped.png"}
                      alt="ServyGo"
                      width={192}
                      height={72}
                      className="h-10 w-auto object-contain sm:h-12"
                    />
                  </Link>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold sm:text-3xl">Panel warsztatu</h1>
                    <p className={`mt-1 text-xs sm:text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                      {workshop?.name ?? "Warsztat"} · Status: {workshop?.status ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/" className={`inline-flex rounded-xl border px-4 py-2 text-sm font-semibold ${isDark ? "border-blue-400/50 bg-zinc-900/70 text-zinc-200" : "border-blue-200 bg-white/80 text-zinc-700"}`}>
                    Strona główna
                  </Link>
                  <button
                    type="button"
                    onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                    className={`inline-flex rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      isDark ? "border-blue-400/50 bg-zinc-900/70 text-zinc-200 hover:border-orange-300" : "border-blue-200 bg-white/80 text-zinc-700 hover:border-orange-300"
                    }`}
                  >
                    {theme === "dark" ? "☀️ Jasny" : "🌙 Ciemny"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="inline-flex rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Wyloguj
                  </button>
                </div>
              </div>
            </header>

            {error ? (
              <p className={`rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-rose-500/40 bg-rose-950/45 text-rose-100" : "border-rose-300 bg-rose-50 text-rose-900"}`}>
                {error}
              </p>
            ) : null}
            {success ? (
              <p className={`rounded-2xl border px-4 py-3 text-sm font-medium ${isDark ? "border-emerald-500/40 bg-emerald-950/45 text-emerald-100" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`}>
                {success}
              </p>
            ) : null}
            {isAdminPreview ? (
              <p className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${isDark ? "border-violet-500/40 bg-violet-950/40 text-violet-100" : "border-violet-300 bg-violet-50 text-violet-800"}`}>
                Tryb podglądu administratora — tylko odczyt
              </p>
            ) : null}

            {loading ? <p className="text-sm">Ładowanie panelu…</p> : null}

            {!loading && !workshop ? (
              <section className={`rounded-2xl border p-6 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                <p className="text-sm">{accessDenied ? "Nie masz dostępu do panelu warsztatu." : "Nie znaleziono warsztatu przypisanego do Twojego konta."}</p>
              </section>
            ) : null}

            {!loading && workshop ? (
              <>
                {activeSection === "Dashboard" ? (
                  <section className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                      {[
                        { label: "Rezerwacje dzisiaj", value: stats.todayBookings, icon: "today" as const, tone: "text-blue-500" },
                        { label: "Rezerwacje w miesiącu", value: stats.monthBookings, icon: "month" as const, tone: "text-indigo-500" },
                        {
                          label: "Oczekujące rezerwacje",
                          value: stats.pendingBookings,
                          icon: "pending" as const,
                          tone: "text-amber-500",
                        },
                        { label: "Zakończone usługi", value: stats.completedBookings, icon: "done" as const, tone: "text-emerald-500" },
                        { label: "Średnia ocena Google", value: stats.googleAvg.toFixed(1), icon: "rating" as const, tone: "text-yellow-500" },
                        {
                          label: "Kliknięcia mapy",
                          value: stats.googleMapClicks,
                          icon: "clicks" as const,
                          tone: "text-cyan-500",
                        },
                      ].map((card) => (
                        <article key={card.label} className={`rounded-2xl border p-4 shadow-sm ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                          <div className={`inline-flex rounded-xl border px-2 py-1 ${card.tone}`}>
                            <DashboardCardIcon type={card.icon} />
                          </div>
                          <p className={`mt-2 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                            {card.label}
                          </p>
                          <p className="mt-1 text-2xl font-bold">{bookings.length === 0 ? "Brak danych" : card.value}</p>
                        </article>
                      ))}
                    </div>

                    <section className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                      <h2 className="text-lg font-semibold">Najnowsze rezerwacje</h2>
                      <div className="mt-3 min-w-0 overflow-x-auto">
                        <table className="w-full min-w-[980px] table-auto text-sm">
                          <thead className={isDark ? "text-zinc-300" : "text-zinc-600"}>
                            <tr>
                              <th className="px-3 py-2 text-left">Data</th>
                              <th className="px-3 py-2 text-left">Klient</th>
                              <th className="px-3 py-2 text-left">Telefon/email</th>
                              <th className="px-3 py-2 text-left">Usługa</th>
                              <th className="px-3 py-2 text-left">Auto</th>
                              <th className="px-3 py-2 text-left">Termin</th>
                              <th className="px-3 py-2 text-left">Status</th>
                              <th className="px-3 py-2 text-left">Akcje</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookings.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">Brak rezerwacji</td>
                              </tr>
                            ) : (
                              bookings.slice(0, 10).map((b) => {
                                const busy = bookingActionId === b.id;
                                const st = b.status.toLowerCase();
                                return (
                                  <tr key={b.id} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
                                    <td className="px-3 py-2">{b.created_at?.slice(0, 10) ?? "—"}</td>
                                    <td className="px-3 py-2">{b.clientLabel}</td>
                                    <td className="px-3 py-2 text-xs"><div>{b.clientPhone}</div><div className={isDark ? "text-zinc-400" : "text-zinc-500"}>{b.clientEmail}</div></td>
                                    <td className="px-3 py-2">{b.service_name}</td>
                                    <td className="px-3 py-2 text-xs">{b.carLabel}</td>
                                    <td className="whitespace-nowrap px-3 py-2">{b.date} {b.start_time?.slice(0, 5) ?? b.time}</td>
                                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusPillClass(b.status, isDark)}`}>{formatBookingStatus(b.status)}</span></td>
                                    <td className="px-3 py-2">
                                      <div className="flex flex-wrap gap-1">
                                        <button type="button" disabled={readOnly || busy || (st !== "awaiting_quote" && st !== "quote_sent" && st !== "quote_rejected" && st !== "new" && st !== "pending")} onClick={() => void sendQuoteForBooking(b.id)} className="rounded-lg border border-emerald-500/50 px-2 py-1 text-xs font-semibold disabled:opacity-40">Wyślij wycenę</button>
                                        <button type="button" disabled={readOnly || busy || st === "completed" || st === "cancelled_by_client" || st === "cancelled_by_workshop" || st === "cancelled_by_system"} onClick={() => void cancelBookingByWorkshop(b.id)} className="rounded-lg border border-rose-500/50 px-2 py-1 text-xs font-semibold disabled:opacity-40">Anuluj</button>
                                        <button type="button" onClick={() => setSelectedBooking(b)} className="rounded-lg border border-zinc-400/50 px-2 py-1 text-xs font-semibold">Szczegóły</button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
                      <section className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                        <h3 className="text-base font-semibold">Kalendarz / najbliższe rezerwacje</h3>
                        <div className="mt-3 space-y-2">
                          {upcomingBookings.length === 0 ? (
                            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Brak danych</p>
                          ) : (
                            upcomingBookings.map(({ booking, at }) => (
                              <div key={booking.id} className={`rounded-xl border px-3 py-2 text-sm ${isDark ? "border-zinc-700 bg-zinc-950/60" : "border-blue-100 bg-blue-50/40"}`}>
                                <p className="font-semibold">{at.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })} — {booking.service_name}</p>
                                <p className={isDark ? "text-zinc-400" : "text-zinc-600"}>{booking.clientLabel} · {booking.date}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      <section className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                        <h3 className="text-base font-semibold">Top usługi</h3>
                        <div className="mt-3 space-y-2">
                          {topServices.length === 0 ? (
                            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Brak danych o usługach</p>
                          ) : (
                            topServices.map((service, index) => {
                              const max = topServices[0]?.total ?? 1;
                              const pct = Math.max(6, Math.round((service.total / max) * 100));
                              return (
                                <div key={`${service.name}-${index}`} className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-700 bg-zinc-950/60" : "border-blue-100 bg-blue-50/40"}`}>
                                  <div className="flex items-center justify-between gap-3 text-sm">
                                    <p className="font-semibold">{index + 1}. {service.name}</p>
                                    <p className={`text-xs font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{service.total}</p>
                                  </div>
                                  <div className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-blue-100"}`}>
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </section>

                      <section className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                        <h3 className="text-base font-semibold">Aktywność</h3>
                        <div className="mt-3 space-y-2">
                          {activityEntries.length === 0 ? (
                            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Brak aktywności</p>
                          ) : (
                            activityEntries.map((entry) => (
                              <div key={entry.id} className={`rounded-xl border px-3 py-2 text-sm ${isDark ? "border-zinc-700 bg-zinc-950/60" : "border-blue-100 bg-blue-50/40"}`}>
                                <p className="font-semibold">{entry.action}</p>
                                <p className={isDark ? "text-zinc-400" : "text-zinc-600"}>{entry.details}</p>
                                <p className="text-xs text-zinc-500">{new Date(entry.createdAt).toLocaleString("pl-PL")}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </section>
                    </div>
                  </section>
                ) : null}

                {activeSection === "Rezerwacje" ? (
                  <section className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h2 className="text-lg font-semibold">Rezerwacje</h2>
                    <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Pełna lista rezerwacji z akcjami operacyjnymi.</p>
                    <div className="mt-3 min-w-0 overflow-x-auto">
                      <table className="w-full min-w-[1060px] table-auto text-sm">
                        <thead className={isDark ? "text-zinc-300" : "text-zinc-600"}>
                          <tr>
                            <th className="px-3 py-2 text-left">Data zgłoszenia</th>
                            <th className="px-3 py-2 text-left">Klient</th>
                            <th className="px-3 py-2 text-left">Telefon / email</th>
                            <th className="px-3 py-2 text-left">Usługa</th>
                            <th className="px-3 py-2 text-left">Auto</th>
                            <th className="px-3 py-2 text-left">Termin</th>
                            <th className="px-3 py-2 text-left">Czas</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Akcje</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookings.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">Brak rezerwacji.</td>
                            </tr>
                          ) : (
                            bookings.map((b) => {
                              const busy = bookingActionId === b.id;
                              const st = b.status.toLowerCase();
                              return (
                                <tr key={b.id} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
                                  <td className="px-3 py-2">{b.created_at?.slice(0, 10) ?? "—"}</td>
                                  <td className="px-3 py-2">{b.clientLabel}</td>
                                  <td className="px-3 py-2 text-xs"><div>{b.clientPhone}</div><div className={isDark ? "text-zinc-400" : "text-zinc-500"}>{b.clientEmail}</div></td>
                                  <td className="px-3 py-2">{b.service_name}</td>
                                  <td className="px-3 py-2 text-xs">{b.carLabel}</td>
                                  <td className="whitespace-nowrap px-3 py-2">{b.date} {b.start_time?.slice(0, 5) ?? b.time} - {b.end_time?.slice(0, 5) ?? "—"}</td>
                                  <td className="px-3 py-2">{b.duration_minutes} min</td>
                                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusPillClass(b.status, isDark)}`}>{formatBookingStatus(b.status)}</span></td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={quoteDraftByBookingId[b.id] ?? (typeof b.final_price === "number" ? String(b.final_price) : "")}
                                        onChange={(e) => setQuoteDraftByBookingId((prev) => ({ ...prev, [b.id]: e.target.value }))}
                                        placeholder="Cena"
                                        className="w-24 rounded-lg border px-2 py-1 text-xs text-black"
                                        disabled={readOnly || busy || st === "confirmed" || st === "completed" || st === "cancelled_by_client" || st === "cancelled_by_workshop" || st === "cancelled_by_system"}
                                      />
                                      <button
                                        type="button"
                                        disabled={readOnly || busy || (st !== "awaiting_quote" && st !== "quote_sent" && st !== "quote_rejected" && st !== "new" && st !== "pending")}
                                        onClick={() => void sendQuoteForBooking(b.id)}
                                        className="rounded-lg border border-emerald-500/50 px-2 py-1 text-xs font-semibold disabled:opacity-40"
                                      >
                                        Wyślij wycenę
                                      </button>
                                      <button
                                        type="button"
                                        disabled={readOnly || busy || st === "completed" || st === "done" || st === "cancelled_by_client" || st === "cancelled_by_workshop" || st === "cancelled_by_system"}
                                        onClick={() => void cancelBookingByWorkshop(b.id)}
                                        className="rounded-lg border border-rose-500/50 px-2 py-1 text-xs font-semibold disabled:opacity-40"
                                      >
                                        Anuluj
                                      </button>
                                      <button
                                        type="button"
                                        disabled={readOnly || busy || st === "completed" || st === "done" || st.startsWith("cancelled")}
                                        onClick={() => void proposeRescheduleByWorkshop(b.id)}
                                        className="rounded-lg border border-purple-500/50 px-2 py-1 text-xs font-semibold disabled:opacity-40"
                                      >
                                        Zmień termin
                                      </button>
                                      <button type="button" disabled={readOnly || busy || st !== "confirmed"} onClick={() => void setBookingStatus(b.id, "completed")} className="rounded-lg border border-blue-500/50 px-2 py-1 text-xs font-semibold disabled:opacity-40">Oznacz jako zakończone</button>
                                      <button type="button" onClick={() => setSelectedBooking(b)} className="rounded-lg border border-zinc-400/50 px-2 py-1 text-xs font-semibold">Zobacz</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}

                {activeSection === "Wiadomości" && currentUserId ? (
                  <InternalInbox
                    currentUserId={currentUserId}
                    isDark={isDark}
                    viewerRole="workshop"
                    onUnreadCountChange={setUnreadMessages}
                  />
                ) : null}

                {activeSection === "Kalendarz / dostępność" ? (
                  <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
                    <article className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                      <h2 className="text-lg font-semibold">Kalendarz / dostępność</h2>
                      <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                        Ustawiaj dostępność na konkretne dni, tygodnie i miesiące.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setCalendarMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                          className="rounded-lg border px-3 py-1 text-sm"
                        >
                          ◀ Poprzedni
                        </button>
                        <p className="text-sm font-semibold">
                          {calendarMonthCursor.toLocaleDateString("pl-PL", { month: "long", year: "numeric" })}
                        </p>
                        <button
                          type="button"
                          onClick={() => setCalendarMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                          className="rounded-lg border px-3 py-1 text-sm"
                        >
                          Następny ▶
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold">
                        {["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"].map((d) => (
                          <div key={d} className={isDark ? "text-zinc-400" : "text-zinc-600"}>{d}</div>
                        ))}
                      </div>
                      <div className="mt-1 grid grid-cols-7 gap-1">
                        {monthCalendarDays.map((day) => {
                          const selected = day.dateKey === selectedDateKey;
                          const weekStartForDay = new Date(day.date);
                          const weekOffset = (weekStartForDay.getDay() + 6) % 7;
                          weekStartForDay.setDate(weekStartForDay.getDate() - weekOffset);
                          const inActiveWeek = asDateKey(weekStartForDay) === asDateKey(activeWeekStart);
                          const dotClass = day.closed
                            ? "bg-rose-500"
                            : day.effective.open && day.effective.close
                              ? "bg-emerald-500"
                              : "bg-zinc-400";
                          const tooltip = day.closed
                            ? "Warsztat zamknięty"
                            : day.effective.open && day.effective.close
                              ? `Godziny: ${day.effective.open}-${day.effective.close}`
                              : "Brak danych";
                          return (
                            <button
                              key={day.dateKey}
                              type="button"
                              onClick={() => setSelectedDateKey(day.dateKey)}
                              title={tooltip}
                              className={`rounded-lg border px-2 py-2 text-left text-xs transition ${
                                selected
                                  ? isDark
                                    ? "border-blue-400 bg-blue-500/20"
                                    : "border-blue-500 bg-blue-50"
                                  : isDark
                                    ? "border-zinc-800 hover:border-zinc-600"
                                    : "border-zinc-200 hover:border-blue-300"
                              } ${!day.inCurrentMonth ? "opacity-45" : ""} ${inActiveWeek && !selected ? (isDark ? "bg-blue-900/20" : "bg-blue-50/70") : ""}`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{day.date.getDate()}</span>
                                <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                              </div>
                              <p className="mt-1 text-[10px]">{day.busyCount} zaj.</p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className={`rounded-xl border px-3 py-2 text-sm ${isDark ? "border-zinc-700" : "border-zinc-200"}`}>
                          Dostępne sloty dzisiaj: <strong>{monthSummary.todayAvailableSlots}</strong>
                        </div>
                        <div className={`rounded-xl border px-3 py-2 text-sm ${isDark ? "border-zinc-700" : "border-zinc-200"}`}>
                          Zajęte terminy dzisiaj: <strong>{monthSummary.todayBusy}</strong>
                        </div>
                        <div className={`rounded-xl border px-3 py-2 text-sm ${isDark ? "border-zinc-700" : "border-zinc-200"}`}>
                          Zamknięte dni w tym miesiącu: <strong>{monthSummary.monthClosedDays}</strong>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className={`rounded-xl border px-3 py-2 text-sm ${isDark ? "border-zinc-700" : "border-zinc-200"}`}>
                          Dzisiaj: <strong>{dailySummary.active}</strong> aktywne / <strong>{dailySummary.cancelled}</strong> anulowane
                        </div>
                        <div className={`rounded-xl border px-3 py-2 text-sm ${isDark ? "border-zinc-700" : "border-zinc-200"}`}>
                          Tydzień: <strong>{weeklySummary.active}</strong> aktywne / <strong>{weeklySummary.cancelled}</strong> anulowane
                        </div>
                      </div>
                    </article>

                    <article className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                      <h3 className="text-lg font-semibold">Ustawienia dnia</h3>
                      <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                        {parseDateKeyLocal(selectedDateKey).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}
                      </p>
                      <div className={`mt-3 rounded-xl border p-3 text-xs ${isDark ? "border-zinc-700" : "border-zinc-200"}`}>
                        <p className="mb-2 font-semibold">Najbliższe rezerwacje</p>
                        {upcomingBookings.length === 0 ? (
                          <p className={isDark ? "text-zinc-400" : "text-zinc-600"}>Brak zaplanowanych wizyt.</p>
                        ) : (
                          <div className="space-y-1">
                            {upcomingBookings.slice(0, 5).map(({ booking, at }) => (
                              <div key={booking.id} className="flex items-center justify-between gap-2">
                                <span>{at.toLocaleDateString("pl-PL")} {at.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</span>
                                <span className="truncate">{booking.clientLabel}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" disabled={readOnly} onClick={() => setDayDraft((d) => ({ ...d, closed: false }))} className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${!dayDraft.closed ? "border-emerald-500" : ""}`}>Otwarty</button>
                          <button type="button" disabled={readOnly} onClick={() => setDayDraft((d) => ({ ...d, closed: true }))} className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${dayDraft.closed ? "border-rose-500" : ""}`}>Zamknięty</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="time"
                            step={60}
                            disabled={readOnly || dayDraft.closed}
                            value={dayDraft.open}
                            onChange={(e) => setDayDraft((d) => ({ ...d, open: e.target.value }))}
                            className={formInputClassName}
                          />
                          <input
                            type="time"
                            step={60}
                            disabled={readOnly || dayDraft.closed}
                            value={dayDraft.close}
                            onChange={(e) => setDayDraft((d) => ({ ...d, close: e.target.value }))}
                            className={formInputClassName}
                          />
                        </div>
                        <div className={`rounded-xl border p-3 text-xs ${isDark ? "border-zinc-700" : "border-zinc-200"}`}>
                          <p className="mb-2 font-semibold">Lista dostępnych slotów</p>
                          {selectedDaySlots.length ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedDaySlots.map((slot) => <span key={slot} className={`rounded-full px-2 py-0.5 ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}>{slot}</span>)}
                            </div>
                          ) : (
                            <p className={isDark ? "text-zinc-400" : "text-zinc-600"}>Brak dostępnych slotów dla tego dnia.</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button type="button" disabled={readOnly || savingDaySettings} onClick={() => void saveSelectedDate(dayDraft)} className="rounded-lg border px-2 py-1 text-xs font-semibold disabled:opacity-50">Zapisz dzień</button>
                          <button type="button" disabled={readOnly || savingDaySettings} onClick={() => void closeSelectedDay()} className="rounded-lg border px-2 py-1 text-xs font-semibold disabled:opacity-50">Zamknij ten dzień</button>
                          <button type="button" disabled={readOnly || savingDaySettings} onClick={() => void clearSelectedDateOverride()} className="rounded-lg border px-2 py-1 text-xs font-semibold disabled:opacity-50">Usuń wyjątek</button>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-2">
                        <h3 className="text-base font-semibold">Godziny w tym tygodniu: {weekRangeLabel}</h3>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => shiftWeek(-1)} className="rounded-lg border px-2 py-1 text-xs">←</button>
                          <button type="button" onClick={() => shiftWeek(1)} className="rounded-lg border px-2 py-1 text-xs">→</button>
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        {weekDates.map((dateObj) => {
                          const dateKey = asDateKey(dateObj);
                          const draft = weekEditorDraft[dateKey] ?? {
                            closed: false,
                            open: "08:00",
                            close: "17:00",
                          };
                          const busy = savingWeekDateKey === dateKey;
                          return (
                            <div key={dateKey} className={`grid grid-cols-[1.4fr_auto_auto_auto_auto] items-center gap-2 rounded-xl border px-2 py-2 text-xs ${isDark ? "border-zinc-700" : "border-zinc-200"}`}>
                              <div>
                                <p className="font-medium">
                                  {dateObj.toLocaleDateString("pl-PL", { weekday: "long", day: "2-digit", month: "2-digit" })}
                                </p>
                                <p className={isDark ? "text-zinc-400" : "text-zinc-600"}>{dateKey}</p>
                              </div>
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  disabled={readOnly || busy}
                                  checked={!draft.closed}
                                  onChange={(e) => patchWeekDay(dateKey, { closed: !e.target.checked })}
                                />
                                <span>{draft.closed ? "zamk." : "otw."}</span>
                              </label>
                              <input type="time" step={60} disabled={readOnly || busy || draft.closed} value={draft.open} onChange={(e) => patchWeekDay(dateKey, { open: e.target.value })} className={formInputClassName} />
                              <input type="time" step={60} disabled={readOnly || busy || draft.closed} value={draft.close} onChange={(e) => patchWeekDay(dateKey, { close: e.target.value })} className={formInputClassName} />
                              <div className="flex flex-wrap gap-1">
                                <button type="button" disabled={readOnly || busy} onClick={() => void saveWeekDate(dateKey, draft)} className="rounded border px-2 py-1 disabled:opacity-50">Zapisz</button>
                                <button type="button" disabled={readOnly || busy} onClick={() => void saveWeekDate(dateKey, { closed: true, open: "08:00", close: "17:00" })} className="rounded border px-2 py-1 disabled:opacity-50">Zamknij</button>
                                <button type="button" disabled={readOnly || busy} onClick={() => void clearWeekDate(dateKey)} className="rounded border px-2 py-1 disabled:opacity-50">Usuń wyjątek</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  </section>
                ) : null}

                {activeSection === "Dane warsztatu" ? (
                  <section className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h2 className="text-lg font-semibold">Dane warsztatu</h2>
                    {profileDraft ? (
                      <form onSubmit={(e) => void handleSaveProfile(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
                        <fieldset disabled={readOnly} className="contents">
                        <label className="sm:col-span-2 block text-sm">
                          <span className="text-xs font-medium text-zinc-500">Nazwa</span>
                          <input value={profileDraft.name} onChange={(e) => setProfileDraft((d) => (d ? { ...d, name: e.target.value } : d))} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950" />
                        </label>
                        <label className="block text-sm"><span className="text-xs font-medium text-zinc-500">Miasto</span><input value={profileDraft.city ?? ""} onChange={(e) => setProfileDraft((d) => (d ? { ...d, city: e.target.value } : d))} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950" /></label>
                        <label className="block text-sm"><span className="text-xs font-medium text-zinc-500">Telefon</span><input value={profileDraft.phone ?? ""} onChange={(e) => setProfileDraft((d) => (d ? { ...d, phone: e.target.value } : d))} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950" /></label>
                        <label className="sm:col-span-2 block text-sm"><span className="text-xs font-medium text-zinc-500">Adres</span><input value={profileDraft.address ?? ""} onChange={(e) => setProfileDraft((d) => (d ? { ...d, address: e.target.value } : d))} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950" /></label>
                        <label className="sm:col-span-2 block text-sm"><span className="text-xs font-medium text-zinc-500">E-mail kontaktowy</span><input type="email" value={profileDraft.email ?? ""} onChange={(e) => setProfileDraft((d) => (d ? { ...d, email: e.target.value } : d))} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950" /></label>
                        <label className="sm:col-span-2 block text-sm"><span className="text-xs font-medium text-zinc-500">Opis</span><textarea rows={4} value={profileDraft.description ?? ""} onChange={(e) => setProfileDraft((d) => (d ? { ...d, description: e.target.value } : d))} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950" /></label>
                        <label className="sm:col-span-2 block text-sm"><span className="text-xs font-medium text-zinc-500">Link Google Maps</span><input value={profileDraft.google_maps_url ?? ""} onChange={(e) => setProfileDraft((d) => (d ? { ...d, google_maps_url: e.target.value } : d))} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950" /></label>
                        </fieldset>
                        <div className="sm:col-span-2"><button type="submit" disabled={readOnly || savingProfile} className="rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingProfile ? "Zapisywanie…" : "Zapisz dane warsztatu"}</button></div>
                      </form>
                    ) : null}
                  </section>
                ) : null}

                {activeSection === "Opinie Google" ? (
                  <section className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h2 className="text-lg font-semibold">Opinie Google</h2>
                    <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Udostępnij ten link klientom po zakończonej usłudze.</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {reviewsUrl ? (
                        <a href={reviewsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-xl bg-gradient-to-r from-blue-600 to-orange-500 px-4 py-2 text-sm font-semibold text-white">Otwórz Google Maps / opinie</a>
                      ) : null}
                      <span className={`rounded-xl border px-3 py-2 text-xs ${isDark ? "border-zinc-700 text-zinc-300" : "border-blue-200 text-zinc-600"}`}>Średnia ocena: 4.7 · Liczba opinii: 124 (placeholder)</span>
                    </div>
                  </section>
                ) : null}

                {activeSection === "Usługi i ceny" ? (
                  <section className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Usługi i ceny</h2>
                        <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Lista usług jest wspólna z formularzem wyszukiwania ServyGo.</p>
                      </div>
                      <button type="button" disabled={readOnly} onClick={() => setShowAddCustomServiceModal(true)} className="rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Dodaj własną usługę</button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {serviceCategories.map((cat) => (
                        <button key={cat} type="button" onClick={() => setServicesCategoryFilter(cat)} className={`rounded-full border px-3 py-1 text-xs ${servicesCategoryFilter === cat ? "border-blue-500" : ""}`}>{cat}</button>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { key: "all", label: "Wszystkie" },
                        { key: "active", label: "Aktywne" },
                        { key: "inactive", label: "Nieaktywne" },
                      ].map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setServicesActivityFilter(f.key as "all" | "active" | "inactive")}
                          className={`rounded-full border px-3 py-1 text-xs ${servicesActivityFilter === f.key ? "border-orange-500" : ""}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className={isDark ? "text-zinc-400" : "text-zinc-600"}>
                          <tr>
                            <th className="px-2 py-2 text-left">Usługa</th>
                            <th className="px-2 py-2 text-left">Oferuję</th>
                            <th className="px-2 py-2 text-left">Status</th>
                            <th className="px-2 py-2 text-left">Auta z cenami</th>
                            <th className="px-2 py-2 text-left">Akcje</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleServiceRows.map((row) => (
                            <tr key={row.id ?? row.service_key ?? row.service_name} className={`border-t ${isDark ? "border-zinc-800" : "border-zinc-100"}`}>
                              <td className="px-2 py-2">
                                <p className="font-medium">{row.service_name}</p>
                                <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{row.category}</p>
                              </td>
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={row.is_active}
                                  disabled={readOnly}
                                  onClick={() => patchServiceRow(row, { is_active: !row.is_active })}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${row.is_active ? "bg-blue-600" : "bg-zinc-400"} disabled:opacity-50`}
                                >
                                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${row.is_active ? "translate-x-5" : "translate-x-1"}`} />
                                </button>
                              </td>
                              <td className="px-2 py-2">
                                <span className={`rounded-full px-2 py-1 text-xs ${row.is_active ? (isDark ? "bg-blue-500/20 text-blue-200" : "bg-blue-100 text-blue-700") : (isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600")}`}>
                                  {row.is_active ? "Aktywna" : "Nieaktywna"}
                                </span>
                              </td>
                              <td className="px-2 py-2">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${isDark ? "bg-zinc-800 text-zinc-200" : "bg-zinc-100 text-zinc-700"}`}>
                                  🚗 {vehiclePriceCountByService.get(row.service_name.trim().toLowerCase()) ?? 0}
                                </span>
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedServiceForVehiclePricing(row.service_name);
                                      setIsVehiclePricingModalOpen(true);
                                    }}
                                    className="rounded-lg border px-2 py-1 text-xs font-semibold"
                                  >
                                    Ceny dla aut ({vehiclePriceCountByService.get(row.service_name.trim().toLowerCase()) ?? 0})
                                  </button>
                                  <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => void deleteServiceRow(row)}
                                    className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-500 disabled:opacity-50"
                                  >
                                    Usuń
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button type="button" disabled={readOnly || savingServices} onClick={() => void saveServices()} className="mt-4 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      {savingServices ? "Zapisywanie…" : "Zapisz usługi i ceny"}
                    </button>

                    <div className={`mt-6 rounded-2xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/40" : "border-blue-100 bg-blue-50/40"}`}>
                      <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                        Kliknij <strong>Ceny dla aut (X)</strong>, aby otworzyć panel cen dla konkretnej usługi.
                      </p>
                    </div>
                  </section>
                ) : null}

                {activeSection === "Pracownicy" ? (
                  <section className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Pracownicy</h2>
                        <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                          Zarządzaj listą specjalistów przypisanych do rezerwacji.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => {
                          const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                          setEmployeeDraftRows((prev) => [
                            ...prev,
                            {
                              temp_id: tempId,
                              first_name: "",
                              last_name: "",
                              role: EMPLOYEE_ROLE_OPTIONS[0],
                              role_query: "",
                              specializations: [],
                              specialization_query: "",
                              role_dropdown_open: false,
                              specialization_dropdown_open: false,
                              show_all_specializations: false,
                              is_active: true,
                            },
                          ]);
                        }}
                        className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        Dodaj pracownika
                      </button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {employeeDraftRows.map((row) => {
                        const roleKey = row.role.trim().toLowerCase();
                        const suggestedSpecializations = ROLE_TO_SUGGESTED_SPECIALIZATIONS[roleKey] ?? [];
                        const roleFilter = row.role_query.trim().toLowerCase();
                        const filteredRoles = employeeRoleOptions.filter((option) => option.toLowerCase().includes(roleFilter));
                        const specializationFilter = row.specialization_query.trim().toLowerCase();
                        const searchedSuggested = suggestedSpecializations.filter((option) =>
                          option.toLowerCase().includes(specializationFilter),
                        );
                        const searchedAll = employeeSpecializationOptions.filter(
                          (option) =>
                            option.toLowerCase().includes(specializationFilter) &&
                            !row.specializations.includes(option),
                        );
                        const filteredSpecializations = Array.from(
                          new Set(
                            (row.show_all_specializations ? searchedAll : searchedSuggested).filter(
                              (option) => !row.specializations.includes(option),
                            ),
                          ),
                        );
                        return (
                        <div key={row.temp_id} className={`grid grid-cols-1 gap-2 rounded-xl border p-3 md:grid-cols-6 ${isDark ? "border-zinc-700" : "border-zinc-200"}`}>
                          <input disabled={readOnly} value={row.first_name} onChange={(e) => patchEmployeeRow(row, { first_name: e.target.value })} placeholder="Imię" className={formInputClassName} />
                          <input disabled={readOnly} value={row.last_name} onChange={(e) => patchEmployeeRow(row, { last_name: e.target.value })} placeholder="Nazwisko" className={formInputClassName} />
                          <div className="relative">
                            <input
                              disabled={readOnly}
                              value={row.role_query}
                              onFocus={() => patchEmployeeRow(row, { role_dropdown_open: true })}
                              onBlur={() => window.setTimeout(() => patchEmployeeRow(row, { role_dropdown_open: false }), 100)}
                              onChange={(e) => patchEmployeeRow(row, { role_query: e.target.value, role_dropdown_open: true })}
                              placeholder={`Stanowisko: ${row.role}`}
                              className={formInputClassName}
                            />
                            {!readOnly && row.role_dropdown_open && (filteredRoles.length > 0 || row.role_query.trim()) ? (
                              <div className={`absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border ${isDark ? "border-zinc-700 bg-zinc-900" : "border-zinc-200 bg-white"}`}>
                                {filteredRoles.map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() =>
                                      patchEmployeeRow(row, {
                                        role: option,
                                        role_query: "",
                                        role_dropdown_open: false,
                                        show_all_specializations: false,
                                      })
                                    }
                                    className="block w-full px-3 py-2 text-left text-xs hover:bg-blue-500/10"
                                  >
                                    {option}
                                  </button>
                                ))}
                                {row.role_query.trim() && !employeeRoleOptions.some((x) => x.toLowerCase() === row.role_query.trim().toLowerCase()) ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const custom = row.role_query.trim();
                                      setEmployeeRoleOptions((prev) => Array.from(new Set([...prev, custom])));
                                      patchEmployeeRow(row, {
                                        role: custom,
                                        role_query: "",
                                        role_dropdown_open: false,
                                        show_all_specializations: false,
                                      });
                                    }}
                                    className="block w-full px-3 py-2 text-left text-xs font-semibold text-orange-500 hover:bg-orange-500/10"
                                  >
                                    + Dodaj własne stanowisko: {row.role_query.trim()}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <div className="md:col-span-2">
                            <input
                              disabled={readOnly}
                              value={row.specialization_query}
                              onFocus={() => patchEmployeeRow(row, { specialization_dropdown_open: true })}
                              onBlur={() => window.setTimeout(() => patchEmployeeRow(row, { specialization_dropdown_open: false }), 100)}
                              onChange={(e) => patchEmployeeRow(row, { specialization_query: e.target.value, specialization_dropdown_open: true })}
                              placeholder="Szukaj specjalizacji"
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-black disabled:opacity-50"
                            />
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <p className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                                {row.show_all_specializations ? "Wszystkie specjalizacje" : "Sugerowane dla stanowiska"}
                              </p>
                              <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => patchEmployeeRow(row, { show_all_specializations: !row.show_all_specializations, specialization_dropdown_open: true })}
                                className="text-[11px] font-semibold text-blue-500 disabled:opacity-50"
                              >
                                {row.show_all_specializations ? "Pokaż sugerowane" : "Pokaż wszystkie specjalizacje"}
                              </button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {row.specializations.map((spec) => (
                                <button
                                  key={spec}
                                  type="button"
                                  disabled={readOnly}
                                  onClick={() => patchEmployeeRow(row, { specializations: row.specializations.filter((x) => x !== spec) })}
                                  className={`rounded-full border px-2 py-1 text-xs ${isDark ? "border-zinc-600 bg-zinc-800" : "border-zinc-300 bg-zinc-100"} disabled:opacity-50`}
                                  title="Kliknij, aby usunąć"
                                >
                                  {spec} ×
                                </button>
                              ))}
                            </div>
                            {!readOnly && row.specialization_dropdown_open && (filteredSpecializations.length > 0 || row.specialization_query.trim()) ? (
                              <div className={`mt-1 max-h-36 overflow-auto rounded-xl border ${isDark ? "border-zinc-700 bg-zinc-900" : "border-zinc-200 bg-white"}`}>
                                {filteredSpecializations.map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() =>
                                      patchEmployeeRow(row, {
                                        specializations: [...row.specializations, option],
                                        specialization_query: "",
                                        specialization_dropdown_open: true,
                                      })
                                    }
                                    className="block w-full px-3 py-2 text-left text-xs hover:bg-blue-500/10"
                                  >
                                    {option}
                                  </button>
                                ))}
                                {row.specialization_query.trim() && !employeeSpecializationOptions.some((x) => x.toLowerCase() === row.specialization_query.trim().toLowerCase()) ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const custom = row.specialization_query.trim();
                                      setEmployeeSpecializationOptions((prev) => Array.from(new Set([...prev, custom])));
                                      patchEmployeeRow(row, {
                                        specializations: [...row.specializations, custom],
                                        specialization_query: "",
                                        specialization_dropdown_open: true,
                                      });
                                    }}
                                    className="block w-full px-3 py-2 text-left text-xs font-semibold text-orange-500 hover:bg-orange-500/10"
                                  >
                                    + Dodaj własną specjalizację: {row.specialization_query.trim()}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" disabled={readOnly} checked={row.is_active} onChange={(e) => patchEmployeeRow(row, { is_active: e.target.checked })} />
                            Aktywny
                          </label>
                        </div>
                      )})}
                      {employeeDraftRows.length === 0 ? (
                        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Brak pracowników. Dodaj pierwszy rekord.</p>
                      ) : null}
                    </div>
                    <button type="button" disabled={readOnly || savingEmployees} onClick={() => void saveEmployees()} className="mt-4 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      {savingEmployees ? "Zapisywanie..." : "Zapisz pracowników"}
                    </button>
                  </section>
                ) : null}

                {activeSection === "Ustawienia" ? (
                  <section className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h2 className="text-lg font-semibold">Ustawienia</h2>
                    <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Sekcja techniczna pod kolejne konfiguracje panelu warsztatu.</p>
                  </section>
                ) : null}
              </>
            ) : null}
          </section>
        </div>

        {selectedBooking ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <button type="button" className="absolute inset-0 bg-zinc-950/70" onClick={() => setSelectedBooking(null)} aria-label="Zamknij" />
            <div className={`relative z-[1] w-full max-w-lg rounded-2xl border p-5 ${isDark ? "border-blue-500/35 bg-zinc-900" : "border-blue-200 bg-white"}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold">Szczegóły rezerwacji</h3>
                <button type="button" onClick={() => setSelectedBooking(null)} className="rounded-lg border px-2 py-1 text-xs">Zamknij</button>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div><dt className="text-xs text-zinc-500">Klient</dt><dd>{selectedBooking.clientLabel}</dd></div>
                <div><dt className="text-xs text-zinc-500">Kontakt</dt><dd>{selectedBooking.clientPhone} · {selectedBooking.clientEmail}</dd></div>
                <div><dt className="text-xs text-zinc-500">Usługa</dt><dd>{selectedBooking.service_name}</dd></div>
                <div><dt className="text-xs text-zinc-500">Auto</dt><dd>{selectedBooking.carLabel}</dd></div>
                <div><dt className="text-xs text-zinc-500">Termin</dt><dd>{selectedBooking.date} {selectedBooking.time}</dd></div>
                <div><dt className="text-xs text-zinc-500">Status</dt><dd>{formatBookingStatus(selectedBooking.status)}</dd></div>
              </dl>
            </div>
          </div>
        ) : null}
        {isVehiclePricingModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-5">
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Zamknij panel cen aut"
              onClick={() => setIsVehiclePricingModalOpen(false)}
            />
            <div className={`relative z-[1] h-[94vh] w-full overflow-hidden border sm:h-auto sm:max-h-[90vh] sm:max-w-6xl sm:rounded-2xl ${
              isDark ? "border-blue-500/35 bg-zinc-950 text-zinc-100" : "border-blue-200 bg-white text-zinc-900"
            }`}>
              <div className={`sticky top-0 z-10 border-b px-4 py-3 sm:px-5 ${isDark ? "border-zinc-800 bg-zinc-950" : "border-blue-100 bg-white"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {selectedServiceForVehiclePricing
                        ? `${selectedServiceForVehiclePricing} — ceny dla konkretnych aut`
                        : "Ceny dla konkretnych aut"}
                    </h3>
                    <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                      Ustawiasz tutaj ceny i czas tylko dla wybranego auta.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={readOnly || !selectedServiceForVehiclePricing}
                      onClick={() => addServiceVehiclePriceRow(selectedServiceForVehiclePricing)}
                      className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-600 disabled:opacity-50"
                    >
                      Dodaj cenę dla auta
                    </button>
                    <button type="button" onClick={() => setIsVehiclePricingModalOpen(false)} className="rounded-lg border px-3 py-2 text-xs font-semibold">
                      Zamknij
                    </button>
                  </div>
                </div>
              </div>

              <div className="max-h-[calc(94vh-116px)] overflow-auto p-4 sm:max-h-[calc(90vh-120px)] sm:p-5">
                {selectedServiceVehicleRows.length === 0 ? (
                  <p className={`rounded-xl border px-3 py-2 text-sm ${isDark ? "border-zinc-700 text-zinc-400" : "border-blue-100 text-zinc-600"}`}>
                    Brak cen aut dla tej usługi. Dodaj pierwszy wariant.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[1080px] w-full text-sm">
                      <thead className={isDark ? "text-zinc-400" : "text-zinc-600"}>
                        <tr>
                          <th className="px-2 py-2 text-left">Pojazd</th>
                          <th className="px-2 py-2 text-left">Szczegóły</th>
                          <th className="px-2 py-2 text-left">Rok produkcji</th>
                          <th className="px-2 py-2 text-left">Cena od</th>
                          <th className="px-2 py-2 text-left">Cena do</th>
                          <th className="px-2 py-2 text-left">Czas (min)</th>
                          <th className="px-2 py-2 text-left">Aktywne</th>
                          <th className="px-2 py-2 text-left">Akcje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedServiceVehicleRows.map((row, idx) => {
                          const brands = row.vehicle_type ? getVehicleBrands(row.vehicle_type) : [];
                          const models = row.vehicle_type && row.brand ? getVehicleModels(row.vehicle_type, row.brand) : [];
                          const fuels = row.vehicle_type ? getVehicleFuels(row.vehicle_type) : [];
                          return (
                            <tr key={row.id ?? `vehicle-row-modal-${idx}`} className={`border-t ${isDark ? "border-zinc-800" : "border-blue-100"}`}>
                              <td className="px-2 py-2">
                                <div className="space-y-1">
                                  <select disabled={readOnly} value={row.vehicle_type} onChange={(e) => patchServiceVehiclePriceRow(row, { vehicle_type: e.target.value as VehicleTypeKey, brand: "", model: "", fuel: "" })} className={formInputClassName}>
                                    {vehicleTypeOptions.map((option) => <option key={`${row.id ?? idx}-${option.key}`} value={option.key}>{option.label}</option>)}
                                  </select>
                                  <select disabled={readOnly} value={row.brand} onChange={(e) => patchServiceVehiclePriceRow(row, { brand: e.target.value, model: "" })} className={formInputClassName}>
                                    <option value="">Marka</option>
                                    {brands.map((brand) => <option key={`${row.id ?? idx}-brand-${brand}`} value={brand}>{brand}</option>)}
                                  </select>
                                  <select disabled={readOnly || !row.brand} value={row.model} onChange={(e) => patchServiceVehiclePriceRow(row, { model: e.target.value })} className={formInputClassName}>
                                    <option value="">Model</option>
                                    {models.map((model) => <option key={`${row.id ?? idx}-model-${model}`} value={model}>{model}</option>)}
                                  </select>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <div className="space-y-1">
                                  <input disabled={readOnly} value={row.engine} onChange={(e) => patchServiceVehiclePriceRow(row, { engine: e.target.value })} placeholder="Silnik" className={formInputClassName} />
                                  <select disabled={readOnly} value={row.fuel} onChange={(e) => patchServiceVehiclePriceRow(row, { fuel: e.target.value })} className={formInputClassName}>
                                    <option value="">Paliwo</option>
                                    {fuels.map((fuel) => <option key={`${row.id ?? idx}-fuel-${fuel}`} value={fuel}>{fuel}</option>)}
                                  </select>
                                  <input disabled={readOnly} value={row.transmission} onChange={(e) => patchServiceVehiclePriceRow(row, { transmission: e.target.value })} placeholder="Skrzynia (opcjonalnie)" className={formInputClassName} />
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <div className="grid grid-cols-2 gap-1">
                                  <select disabled={readOnly} value={row.year_from} onChange={(e) => patchServiceVehiclePriceRow(row, { year_from: e.target.value })} className={formInputClassName}>
                                    <option value="">Od</option>
                                    {vehicleYearOptions.map((year) => <option key={`${row.id ?? idx}-yf-${year}`} value={year}>{year}</option>)}
                                  </select>
                                  <select disabled={readOnly} value={row.year_to} onChange={(e) => patchServiceVehiclePriceRow(row, { year_to: e.target.value })} className={formInputClassName}>
                                    <option value="">Do</option>
                                    {vehicleYearOptions.map((year) => <option key={`${row.id ?? idx}-yt-${year}`} value={year}>{year}</option>)}
                                  </select>
                                </div>
                              </td>
                              <td className="px-2 py-2"><input disabled={readOnly} value={row.price_from} onChange={(e) => patchServiceVehiclePriceRow(row, { price_from: e.target.value })} placeholder="Cena od" className={formInputClassName} /></td>
                              <td className="px-2 py-2"><input disabled={readOnly} value={row.price_to} onChange={(e) => patchServiceVehiclePriceRow(row, { price_to: e.target.value })} placeholder="Cena do" className={formInputClassName} /></td>
                              <td className="px-2 py-2"><input disabled={readOnly} value={row.duration_minutes} onChange={(e) => patchServiceVehiclePriceRow(row, { duration_minutes: e.target.value })} placeholder="Czas" className={formInputClassName} /></td>
                              <td className="px-2 py-2">
                                <label className="inline-flex items-center gap-2 text-xs">
                                  <input className="accent-blue-600" type="checkbox" disabled={readOnly} checked={row.is_active} onChange={(e) => patchServiceVehiclePriceRow(row, { is_active: e.target.checked })} />
                                  {row.is_active ? "Aktywna" : "Nieaktywna"}
                                </label>
                              </td>
                              <td className="px-2 py-2">
                                <button type="button" disabled={readOnly} onClick={() => removeServiceVehiclePriceRow(row)} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-500 disabled:opacity-50">
                                  Usuń
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className={`mt-4 rounded-xl border px-3 py-2 text-xs ${isDark ? "border-blue-500/40 bg-blue-950/30 text-blue-100" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                  Ceny ustawione tutaj mają pierwszeństwo dla wybranego auta.
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={readOnly || savingVehiclePrices}
                    onClick={() => void saveServiceVehiclePrices()}
                    className="rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {savingVehiclePrices ? "Zapisywanie…" : "Zapisz ceny dla konkretnych aut"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {showAddCustomServiceModal ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <button type="button" className="absolute inset-0 bg-zinc-950/70" onClick={() => setShowAddCustomServiceModal(false)} aria-label="Zamknij" />
            <div className={`relative z-[1] w-full max-w-xl rounded-2xl border p-5 ${isDark ? "border-blue-500/35 bg-zinc-900" : "border-blue-200 bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">Dodaj własną usługę</h3>
                <button type="button" onClick={() => setShowAddCustomServiceModal(false)} className="rounded-lg border px-2 py-1 text-xs">Zamknij</button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input disabled={readOnly} placeholder="Nazwa usługi" value={customServiceDraft.service_name} onChange={(e) => setCustomServiceDraft((d) => ({ ...d, service_name: e.target.value }))} className="sm:col-span-2 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600 disabled:opacity-50" />
                <input disabled={readOnly} placeholder="Kategoria" value={customServiceDraft.category} onChange={(e) => setCustomServiceDraft((d) => ({ ...d, category: e.target.value }))} className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600 disabled:opacity-50" />
                <input disabled={readOnly} placeholder="Cena od" value={customServiceDraft.price_from} onChange={(e) => setCustomServiceDraft((d) => ({ ...d, price_from: e.target.value }))} className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600 disabled:opacity-50" />
                <input disabled={readOnly} placeholder="Cena do" value={customServiceDraft.price_to} onChange={(e) => setCustomServiceDraft((d) => ({ ...d, price_to: e.target.value }))} className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600 disabled:opacity-50" />
                <input disabled={readOnly} placeholder="Czas (min)" value={customServiceDraft.duration_minutes} onChange={(e) => setCustomServiceDraft((d) => ({ ...d, duration_minutes: e.target.value }))} className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600 disabled:opacity-50" />
                <label className="sm:col-span-2 text-sm">
                  <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Opis</span>
                  <textarea disabled={readOnly} rows={3} value={customServiceDraft.description} onChange={(e) => setCustomServiceDraft((d) => ({ ...d, description: e.target.value }))} className="mt-1 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600 disabled:opacity-50" />
                </label>
                <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled={readOnly} checked={customServiceDraft.is_active} onChange={(e) => setCustomServiceDraft((d) => ({ ...d, is_active: e.target.checked }))} />
                  Aktywna usługa
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    if (!customServiceDraft.service_name.trim()) return;
                    setServiceDraftRows((prev) => [
                      ...prev,
                      {
                        service_key: null,
                        service_name: customServiceDraft.service_name.trim(),
                        category: customServiceDraft.category.trim() || "Inne",
                        description: customServiceDraft.description.trim(),
                        price_from: customServiceDraft.price_from.trim(),
                        price_to: customServiceDraft.price_to.trim(),
                        duration_minutes: customServiceDraft.duration_minutes.trim(),
                        is_active: customServiceDraft.is_active,
                        is_custom: true,
                      },
                    ]);
                    setCustomServiceDraft({
                      service_name: "",
                      category: "Inne",
                      description: "",
                      price_from: "",
                      price_to: "",
                      duration_minutes: "",
                      is_active: true,
                    });
                    setShowAddCustomServiceModal(false);
                  }}
                  className="rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Dodaj usługę
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </ServyGoPageShell>
  );
}

export default function WorkshopPanelPage() {
  return (
    <Suspense fallback={null}>
      <WorkshopPanelPageContent />
    </Suspense>
  );
}
