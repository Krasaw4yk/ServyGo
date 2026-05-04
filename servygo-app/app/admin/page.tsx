"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import {
  useBookingsRealtimeSync,
  useSupportReportsAdminRealtime,
  useWorkshopLeadsAdminRealtime,
} from "@/lib/useServyGoRealtime";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import ServyGoSubpageNavBar from "@/components/ServyGoSubpageNavBar";
import AdminServyGoMapSection from "@/components/admin/AdminServyGoMapSection";
import InternalInbox from "@/components/InternalInbox";
import { sendSystemMessage } from "@/lib/messagesApi";
import { getUnifiedUnreadCount } from "@/lib/notificationsApi";
import { runExpirePendingBookingsWorkshopTimeout } from "@/lib/bookingWorkshopResponseExpiry";
import {
  listSupportReportsForAdmin,
  updateSupportReportStatus,
  type SupportReportRow,
  type SupportReportStatus,
} from "@/lib/supportReportsApi";
import {
  listServygoReviewsForAdmin,
  updateServygoReviewStatusAdmin,
  type ServygoReviewStatus,
  type WorkshopServygoReviewRow,
} from "@/lib/workshopServygoReviewsApi";
import WorkshopPhotosManager from "@/components/workshop/WorkshopPhotosManager";
import {
  type AdminBookingListRow,
  type AdminSidebarNotificationCounts,
  type AdminWorkshopDetail,
  type AdminWorkshopEntityStatus,
  type AdminWorkshopListRow,
  type AdminWorkshopUpdatePayload,
  type WorkshopMonthlyLeadMetricsRow,
  AdminWorkshopStatus,
  WorkshopLeadRow,
  approveWorkshopLeadWithOwnerEmail,
  formatAdminWorkshopEntityStatusLabel,
  formatWorkshopLeadStatusLabel,
  getAdminSidebarNotificationCounts,
  getAdminRecord,
  getWorkshopDetailForAdmin,
  listBookingsWithLeadSettlementForAdmin,
  listWorkshopLeadsForAdmin,
  listWorkshopMonthlyLeadMetricsForAdmin,
  listWorkshopsForAdmin,
  markBookingSettlementDisputedAsAdmin,
  normalizeWorkshopStatus,
  replaceWorkshopServicesAsAdmin,
  resendWorkshopOwnerAccessEmail,
  seedTestWorkshopLeadAsAdmin,
  setWorkshopStatusAsAdmin,
  setWorkshopLeadBillingSettingsAsAdmin,
  updateWorkshopAsAdmin,
  updateWorkshopLeadStatusAsAdmin,
} from "@/lib/adminApi";
import { isValidWorkshopGoogleMapsUrl } from "@/lib/workshopApi";
import { getAdminDashboardStats, type AdminDashboardStats } from "@/lib/adminStatsApi";

const SIDEBAR_ITEMS = [
  "Dashboard",
  "Moje wiadomości",
  "Zgłoszenia problemów",
  "Zgłoszenia warsztatów",
  "Warsztaty",
  "Mapa ServyGo",
  "Rezerwacje",
  "Rozliczenie leadów MVP",
  "Użytkownicy",
  "Usługi i ceny",
  "Opinie / Google Maps",
  "Statystyki strony",
  "Ustawienia",
] as const;
type SidebarItem = (typeof SIDEBAR_ITEMS)[number];
type SidebarBadgeState = Record<SidebarItem, number>;

const EMPTY_SIDEBAR_BADGES: SidebarBadgeState = {
  Dashboard: 0,
  "Moje wiadomości": 0,
  "Zgłoszenia problemów": 0,
  "Zgłoszenia warsztatów": 0,
  Warsztaty: 0,
  "Mapa ServyGo": 0,
  Rezerwacje: 0,
  "Rozliczenie leadów MVP": 0,
  Użytkownicy: 0,
  "Usługi i ceny": 0,
  "Opinie / Google Maps": 0,
  "Statystyki strony": 0,
  Ustawienia: 0,
};

function formatBadgeNumber(count: number) {
  if (count > 99) return "99+";
  return String(count);
}

function formatAdminLeadSettlementLine(row: {
  settlement_status: string | null;
  lead_fee_amount: number | null;
  test_mode: boolean | null;
}): string {
  const st = (row.settlement_status ?? "").trim().toLowerCase();
  const fee = row.lead_fee_amount != null && Number.isFinite(Number(row.lead_fee_amount)) ? Number(row.lead_fee_amount).toFixed(2) : "5.00";
  const test = row.test_mode !== false;
  const labels: Record<string, string> = {
    pending: "Oczekuje na rozliczenie",
    billable: `Rozliczalny (${fee} PLN)`,
    not_billable: "Nie rozliczalny",
    disputed: "Spór",
    invoiced: "W rozliczeniu / faktura (plan)",
    waived_test: test ? `Test (${fee} PLN wartość, bez opłaty)` : `Zwolniony test (${fee} PLN)`,
  };
  return labels[st] ?? (st ? `${st} · ${fee} PLN` : "—");
}

function formatMetricMonth(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
}

function downloadCsv(filename: string, csvText: string) {
  const blob = new Blob([`\uFEFF${csvText}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  const escaped = s.replaceAll("\"", "\"\"");
  return /[\",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function leadMetricsToCsv(rows: WorkshopMonthlyLeadMetricsRow[]): string {
  const header = [
    "workshop_id",
    "workshop_name",
    "month",
    "total_bookings",
    "confirmed_bookings",
    "completed_bookings",
    "no_show_bookings",
    "cancelled_bookings",
    "waived_test_leads",
    "billable_leads",
    "disputed_leads",
    "not_billable_leads",
    "test_value_pln",
    "estimated_amount_pln",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const row = [
      r.workshop_id,
      r.workshop_name ?? "",
      r.month,
      r.total_bookings,
      r.confirmed_bookings,
      r.completed_bookings,
      r.no_show_bookings,
      r.cancelled_bookings,
      r.waived_test_leads,
      r.billable_leads,
      r.disputed_leads,
      r.not_billable_leads,
      r.test_value_pln,
      r.estimated_amount_pln,
    ];
    lines.push(row.map(toCsvCell).join(","));
  }
  return lines.join("\n");
}

type WorkshopLeadListFilter = "all" | "pending" | "approved" | "rejected" | "archived";

const LEAD_STATUS_FILTERS: { id: WorkshopLeadListFilter; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "pending", label: "Oczekujące" },
  { id: "approved", label: "Zaakceptowane" },
  { id: "rejected", label: "Odrzucone" },
  { id: "archived", label: "Zarchiwizowane" },
];

function isLeadModerationClosed(status: string | null) {
  const n = normalizeWorkshopStatus(status);
  return n === "approved" || n === "rejected" || n === "archived";
}

function formatDate(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleString("pl-PL");
}

function googleMapsSearchUrlForLead(row: Pick<WorkshopLeadRow, "workshop_name" | "city" | "address" | "postal_code">) {
  const parts = [row.workshop_name, row.address, row.postal_code, row.city].filter((p) => p && String(p).trim());
  const q = parts.join(", ").trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || row.workshop_name)}`;
}

function mapsUrlForLead(row: WorkshopLeadRow) {
  const direct = row.google_maps_url?.trim();
  if (direct) return direct;
  return googleMapsSearchUrlForLead(row);
}

function formatAddressBlock(row: WorkshopLeadRow) {
  const line = [row.postal_code, row.address].filter((p) => p && String(p).trim()).join(" ").trim();
  return line || "—";
}

function coerceWorkshopEntityStatus(status: string | null | undefined): AdminWorkshopEntityStatus {
  const s = (status ?? "").toLowerCase().trim();
  if (s === "suspended" || s === "wylaczony") return "suspended";
  if (s === "hidden") return "hidden";
  return "active";
}

type WorkshopEditDraft = {
  name: string;
  slug: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  google_maps_url: string;
  google_place_id: string;
  latitude: string;
  longitude: string;
  show_on_map: boolean;
  rating: string;
  reviews_count: string;
  opening_hours: string;
  status: AdminWorkshopEntityStatus;
  servicesText: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = useState<SidebarItem>("Dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [rows, setRows] = useState<WorkshopLeadRow[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [adminWorkshops, setAdminWorkshops] = useState<AdminWorkshopListRow[]>([]);
  const [loadingWorkshops, setLoadingWorkshops] = useState(true);
  const [fatalConfigError, setFatalConfigError] = useState("");
  const [leadsError, setLeadsError] = useState("");
  const [workshopsError, setWorkshopsError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [seedingTestLead, setSeedingTestLead] = useState(false);
  const [leadDetailId, setLeadDetailId] = useState<string | null>(null);
  const [leadStatusFilter, setLeadStatusFilter] = useState<WorkshopLeadListFilter>("pending");
  const [workshopViewId, setWorkshopViewId] = useState<string | null>(null);
  const [workshopEditId, setWorkshopEditId] = useState<string | null>(null);
  const [workshopPanelDetail, setWorkshopPanelDetail] = useState<AdminWorkshopDetail | null>(null);
  const [loadingWorkshopPanel, setLoadingWorkshopPanel] = useState(false);
  const [workshopPanelError, setWorkshopPanelError] = useState("");
  const [editDraft, setEditDraft] = useState<WorkshopEditDraft | null>(null);
  const [savingWorkshopId, setSavingWorkshopId] = useState<string | null>(null);
  const [pendingApproveLead, setPendingApproveLead] = useState<WorkshopLeadRow | null>(null);
  const [approveEmailMode, setApproveEmailMode] = useState<"lead" | "custom">("lead");
  const [approveOwnerEmailInput, setApproveOwnerEmailInput] = useState("");
  const [savingResendWorkshopId, setSavingResendWorkshopId] = useState<string | null>(null);
  const [liveSidebarBadges, setLiveSidebarBadges] = useState<SidebarBadgeState>(EMPTY_SIDEBAR_BADGES);
  const [seenSidebarBadges, setSeenSidebarBadges] = useState<SidebarBadgeState>(EMPTY_SIDEBAR_BADGES);
  const [dashboardStatsData, setDashboardStatsData] = useState<AdminDashboardStats | null>(null);
  const [loadingDashboardStats, setLoadingDashboardStats] = useState(false);
  const [dashboardStatsError, setDashboardStatsError] = useState("");
  const [supportReportRows, setSupportReportRows] = useState<SupportReportRow[]>([]);
  const [supportReportsLoading, setSupportReportsLoading] = useState(false);
  const [supportReportsError, setSupportReportsError] = useState("");
  const [servygoModerationRows, setServygoModerationRows] = useState<WorkshopServygoReviewRow[]>([]);
  const [servygoModerationLoading, setServygoModerationLoading] = useState(false);
  const [servygoModerationFilter, setServygoModerationFilter] = useState<"all" | ServygoReviewStatus>("all");
  const [adminBookingsRows, setAdminBookingsRows] = useState<AdminBookingListRow[]>([]);
  const [adminBookingsLoading, setAdminBookingsLoading] = useState(false);
  const [adminBookingsError, setAdminBookingsError] = useState("");
  const [leadMetricsRows, setLeadMetricsRows] = useState<WorkshopMonthlyLeadMetricsRow[]>([]);
  const [leadMetricsLoading, setLeadMetricsLoading] = useState(false);
  const [leadMetricsError, setLeadMetricsError] = useState("");
  const [disputeModalBookingId, setDisputeModalBookingId] = useState<string | null>(null);
  const [disputeModalReason, setDisputeModalReason] = useState("");
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [leadSettingsBusyWorkshopId, setLeadSettingsBusyWorkshopId] = useState<string | null>(null);

  const detailLead = useMemo(() => rows.find((r) => r.id === leadDetailId) ?? null, [rows, leadDetailId]);

  const filteredLeads = useMemo(() => {
    if (leadStatusFilter === "all") return rows;
    return rows.filter((row) => normalizeWorkshopStatus(row.status) === leadStatusFilter);
  }, [rows, leadStatusFilter]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMounted(true);
      const savedTheme = window.localStorage.getItem("servygo-theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("servygo-theme", theme);
  }, [mounted, theme]);

  useEffect(() => {
    if (!mounted || !currentUser) return;
    const key = `servygo-admin-seen-badges:${currentUser.id}`;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SidebarBadgeState>;
      setSeenSidebarBadges((prev) => ({ ...prev, ...parsed }));
    } catch {
      // Ignore malformed local storage value.
    }
  }, [mounted, currentUser]);

  useEffect(() => {
    if (!mounted || !currentUser) return;
    const key = `servygo-admin-seen-badges:${currentUser.id}`;
    window.localStorage.setItem(key, JSON.stringify(seenSidebarBadges));
  }, [mounted, currentUser, seenSidebarBadges]);

  useEffect(() => {
    if (!mounted || accessLoading) return;
    if (!currentUser) {
      router.replace("/?auth=login");
    }
  }, [accessLoading, currentUser, mounted, router]);

  useEffect(() => {
    if (!mounted || accessLoading) return;
    if (currentUser && !isAdmin) {
      router.replace("/moje-konto");
    }
  }, [accessLoading, currentUser, isAdmin, mounted, router]);

  const refreshLeads = useCallback(async () => {
    if (!currentUser) return;
    setLoadingLeads(true);
    setLeadsError("");
    try {
      const leadData = await listWorkshopLeadsForAdmin(currentUser.id, currentUser.email);
      setRows(leadData);
    } catch (err) {
      setLeadsError(err instanceof Error ? err.message : "Nie udało się pobrać zgłoszeń warsztatów.");
    } finally {
      setLoadingLeads(false);
    }
  }, [currentUser]);

  const refreshWorkshops = useCallback(async () => {
    if (!currentUser) return;
    setLoadingWorkshops(true);
    setWorkshopsError("");
    try {
      const workshopData = await listWorkshopsForAdmin(currentUser.id, currentUser.email);
      setAdminWorkshops(workshopData);
    } catch (err) {
      setWorkshopsError(err instanceof Error ? err.message : "Nie udało się pobrać listy warsztatów.");
    } finally {
      setLoadingWorkshops(false);
    }
  }, [currentUser]);

  const refreshSupportReports = useCallback(async () => {
    if (!currentUser) return;
    setSupportReportsLoading(true);
    setSupportReportsError("");
    try {
      const rows = await listSupportReportsForAdmin();
      setSupportReportRows(rows);
    } catch (err) {
      setSupportReportsError(err instanceof Error ? err.message : "Nie udało się pobrać zgłoszeń.");
    } finally {
      setSupportReportsLoading(false);
    }
  }, [currentUser]);

  const refreshServygoModeration = useCallback(async () => {
    if (!currentUser) return;
    setServygoModerationLoading(true);
    try {
      const rows = await listServygoReviewsForAdmin();
      setServygoModerationRows(rows);
    } catch {
      setServygoModerationRows([]);
    } finally {
      setServygoModerationLoading(false);
    }
  }, [currentUser]);

  const refreshAdminBookings = useCallback(async () => {
    if (!currentUser) return;
    setAdminBookingsLoading(true);
    setAdminBookingsError("");
    try {
      const rows = await listBookingsWithLeadSettlementForAdmin(currentUser.id, currentUser.email);
      setAdminBookingsRows(rows);
    } catch (err) {
      setAdminBookingsError(err instanceof Error ? err.message : "Nie udało się pobrać rezerwacji.");
      setAdminBookingsRows([]);
    } finally {
      setAdminBookingsLoading(false);
    }
  }, [currentUser]);

  const refreshLeadMetrics = useCallback(async () => {
    if (!currentUser) return;
    setLeadMetricsLoading(true);
    setLeadMetricsError("");
    try {
      const rows = await listWorkshopMonthlyLeadMetricsForAdmin(currentUser.id, currentUser.email);
      setLeadMetricsRows(rows);
    } catch (err) {
      setLeadMetricsError(err instanceof Error ? err.message : "Nie udało się pobrać raportu leadów.");
      setLeadMetricsRows([]);
    } finally {
      setLeadMetricsLoading(false);
    }
  }, [currentUser]);

  const openDisputeModal = useCallback((bookingId: string) => {
    setDisputeModalBookingId(bookingId);
    setDisputeModalReason("");
  }, []);

  const closeDisputeModal = useCallback(() => {
    if (disputeBusy) return;
    setDisputeModalBookingId(null);
    setDisputeModalReason("");
  }, [disputeBusy]);

  const confirmDisputeModal = useCallback(async () => {
    if (!currentUser || !disputeModalBookingId) return;
    const reason = disputeModalReason.trim();
    if (!reason) {
      setSuccessMessage("");
      setWorkshopsError("");
      setLeadsError("");
      return;
    }
    setDisputeBusy(true);
    try {
      await markBookingSettlementDisputedAsAdmin(currentUser.id, currentUser.email ?? null, disputeModalBookingId, reason);
      setSuccessMessage("Spór został oznaczony.");
      await refreshAdminBookings();
      await refreshLeadMetrics();
    } catch (err) {
      setSuccessMessage("");
      setWorkshopsError(err instanceof Error ? err.message : "Nie udało się oznaczyć sporu.");
    } finally {
      setDisputeBusy(false);
      setDisputeModalBookingId(null);
      setDisputeModalReason("");
    }
  }, [currentUser, disputeModalBookingId, disputeModalReason, refreshAdminBookings, refreshLeadMetrics]);

  const endWorkshopLeadTest = useCallback(async (workshopId: string) => {
    if (!currentUser) return;
    const target = adminWorkshops.find((w) => w.id === workshopId);
    const currentFee = target?.lead_fee_amount != null ? Number(target.lead_fee_amount) : 5;
    const input = window.prompt("Zakończyć test dla warsztatu?\n\nOpcjonalnie wpisz nową stawkę leada (PLN), np. 5.00.\nZostaw puste, aby nie zmieniać stawki.", String(currentFee));
    if (input == null) return;
    const trimmed = input.trim();
    const fee = trimmed ? Number(trimmed.replace(",", ".")) : null;
    if (trimmed && !Number.isFinite(fee)) {
      setWorkshopsError("Nieprawidłowa stawka.");
      return;
    }
    setLeadSettingsBusyWorkshopId(workshopId);
    setWorkshopsError("");
    try {
      await setWorkshopLeadBillingSettingsAsAdmin(currentUser.id, currentUser.email ?? null, workshopId, false, fee);
      setSuccessMessage("Okres testowy zakończony dla warsztatu (dla nowych leadów).");
      await refreshWorkshops();
    } catch (err) {
      setWorkshopsError(err instanceof Error ? err.message : "Nie udało się zakończyć testu.");
    } finally {
      setLeadSettingsBusyWorkshopId(null);
    }
  }, [adminWorkshops, currentUser, refreshWorkshops]);

  const refreshSidebarBadges = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [counts, unreadMessages]: [AdminSidebarNotificationCounts, number] = await Promise.all([
        getAdminSidebarNotificationCounts(currentUser.id, currentUser.email),
        getUnifiedUnreadCount(currentUser.id, true),
      ]);
      setLiveSidebarBadges((prev) => ({
        ...prev,
        "Moje wiadomości": unreadMessages,
        "Zgłoszenia warsztatów": counts.pendingLeads,
        Rezerwacje: counts.newBookings,
        Użytkownicy: counts.newUsers24h,
        "Opinie / Google Maps": counts.newReviews,
        "Usługi i ceny": counts.servicesChanges,
      }));
    } catch {
      // Nie blokujemy panelu, jeśli licznik nie może się odświeżyć.
    }
  }, [currentUser]);

  const handleAdminInboxUnreadChange = useCallback((count: number) => {
    setLiveSidebarBadges((prev) => ({ ...prev, "Moje wiadomości": count }));
  }, []);

  const markTabSeen = useCallback(
    (tab: SidebarItem) => {
      setSeenSidebarBadges((prev) => ({ ...prev, [tab]: liveSidebarBadges[tab] }));
    },
    [liveSidebarBadges],
  );

  useEffect(() => {
    if (!currentUser) return;
    void refreshSidebarBadges();
  }, [currentUser, refreshSidebarBadges]);

  useEffect(() => {
    if (!currentUser) return;
    markTabSeen(activeTab);
  }, [activeTab, currentUser, markTabSeen]);

  useEffect(() => {
    const pendingCount = rows.filter((row) => normalizeWorkshopStatus(row.status) === "pending").length;
    setLiveSidebarBadges((prev) => ({ ...prev, "Zgłoszenia warsztatów": pendingCount }));
  }, [rows]);

  useEffect(() => {
    if (!currentUser) return;
    if (activeTab === "Rezerwacje" || activeTab === "Użytkownicy" || activeTab === "Opinie / Google Maps") {
      void refreshSidebarBadges();
    }
  }, [activeTab, currentUser, refreshSidebarBadges]);

  useEffect(() => {
    if (!currentUser || activeTab !== "Zgłoszenia problemów") return;
    void refreshSupportReports();
  }, [activeTab, currentUser, refreshSupportReports]);

  useEffect(() => {
    if (!currentUser || activeTab !== "Opinie / Google Maps") return;
    void refreshServygoModeration();
  }, [activeTab, currentUser, refreshServygoModeration]);

  useEffect(() => {
    if (!currentUser || activeTab !== "Rezerwacje") return;
    void refreshAdminBookings();
  }, [activeTab, currentUser, refreshAdminBookings]);

  useEffect(() => {
    if (!currentUser || activeTab !== "Rozliczenie leadów MVP") return;
    void refreshLeadMetrics();
  }, [activeTab, currentUser, refreshLeadMetrics]);

  const activeWorkshopPanelId = workshopViewId ?? workshopEditId;

  useEffect(() => {
    if (!currentUser || !activeWorkshopPanelId) {
      setWorkshopPanelDetail(null);
      setLoadingWorkshopPanel(false);
      setWorkshopPanelError("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingWorkshopPanel(true);
      setWorkshopPanelError("");
      try {
        const detail = await getWorkshopDetailForAdmin(currentUser.id, currentUser.email, activeWorkshopPanelId);
        if (!cancelled) setWorkshopPanelDetail(detail);
      } catch (err) {
        if (!cancelled) {
          setWorkshopPanelError(err instanceof Error ? err.message : "Nie udało się wczytać warsztatu.");
          setWorkshopPanelDetail(null);
        }
      } finally {
        if (!cancelled) setLoadingWorkshopPanel(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkshopPanelId, currentUser]);

  const refreshWorkshopPanelBookingsQuietRef = useRef<() => void>(() => {});
  useEffect(() => {
    refreshWorkshopPanelBookingsQuietRef.current = () => {
      if (!currentUser || !activeWorkshopPanelId) return;
      void (async () => {
        try {
          const detail = await getWorkshopDetailForAdmin(currentUser.id, currentUser.email, activeWorkshopPanelId);
          setWorkshopPanelDetail(detail);
          void refreshSidebarBadges();
        } catch {
          /* realtime: nie blokujemy panelu */
        }
      })();
    };
  }, [currentUser, activeWorkshopPanelId, refreshSidebarBadges]);

  useBookingsRealtimeSync({
    enabled: Boolean(isSupabaseConfigured && supabase && currentUser && activeWorkshopPanelId),
    workshopId: activeWorkshopPanelId,
    onRefresh: () => refreshWorkshopPanelBookingsQuietRef.current(),
  });

  useWorkshopLeadsAdminRealtime(
    Boolean(isSupabaseConfigured && supabase && currentUser && activeTab === "Zgłoszenia warsztatów"),
    () => void refreshLeads(),
  );

  useSupportReportsAdminRealtime(
    Boolean(isSupabaseConfigured && supabase && currentUser && activeTab === "Zgłoszenia problemów"),
    () => void refreshSupportReports(),
  );

  useEffect(() => {
    if (!workshopEditId || !workshopPanelDetail || workshopPanelDetail.id !== workshopEditId) {
      if (!workshopEditId) setEditDraft(null);
      return;
    }
    setEditDraft({
      name: workshopPanelDetail.name,
      slug: workshopPanelDetail.slug ?? "",
      city: workshopPanelDetail.city ?? "",
      address: workshopPanelDetail.address ?? "",
      phone: workshopPanelDetail.phone ?? "",
      email: workshopPanelDetail.email ?? "",
      description: workshopPanelDetail.description ?? "",
      google_maps_url: workshopPanelDetail.google_maps_url ?? "",
      google_place_id: workshopPanelDetail.google_place_id ?? "",
      latitude:
        workshopPanelDetail.latitude != null && Number.isFinite(Number(workshopPanelDetail.latitude))
          ? String(workshopPanelDetail.latitude)
          : "",
      longitude:
        workshopPanelDetail.longitude != null && Number.isFinite(Number(workshopPanelDetail.longitude))
          ? String(workshopPanelDetail.longitude)
          : "",
      show_on_map: workshopPanelDetail.show_on_map === true,
      rating:
        workshopPanelDetail.rating != null && String(workshopPanelDetail.rating).trim() !== ""
          ? String(workshopPanelDetail.rating)
          : "",
      reviews_count:
        workshopPanelDetail.reviews_count != null && Number.isFinite(Number(workshopPanelDetail.reviews_count))
          ? String(workshopPanelDetail.reviews_count)
          : "",
      opening_hours: workshopPanelDetail.opening_hours ?? "",
      status: coerceWorkshopEntityStatus(workshopPanelDetail.status),
      servicesText: workshopPanelDetail.services.map((s) => s.service_name).join("\n"),
    });
  }, [workshopEditId, workshopPanelDetail]);

  useEffect(() => {
    async function verifyAccess() {
      if (!isSupabaseConfigured || !supabase) {
        setFatalConfigError(
          "Brak konfiguracji Supabase. Ustaw NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
        setAccessLoading(false);
        setLoadingLeads(false);
        setLoadingWorkshops(false);
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user ?? null;
      setCurrentUser(user);
      if (!user) {
        setAccessLoading(false);
        setLoadingLeads(false);
        setLoadingWorkshops(false);
        return;
      }

      const email = user.email?.trim() ?? "";

      let adminRecord;
      try {
        adminRecord = await getAdminRecord(user.id, email);
      } catch (err) {
        setFatalConfigError(err instanceof Error ? err.message : "Nie udało się zweryfikować uprawnień administratora.");
        setAccessLoading(false);
        setLoadingLeads(false);
        setLoadingWorkshops(false);
        return;
      }

      if (!adminRecord) {
        setAccessLoading(false);
        setLoadingLeads(false);
        setLoadingWorkshops(false);
        return;
      }

      setIsAdmin(true);
      setAdminRole(adminRecord.role ?? null);
      setAccessLoading(false);

      try {
        await runExpirePendingBookingsWorkshopTimeout();
      } catch {
        /* migracja RPC opcjonalna */
      }

      try {
        const leadData = await listWorkshopLeadsForAdmin(user.id, email);
        setRows(leadData);
      } catch (err) {
        setLeadsError(err instanceof Error ? err.message : "Nie udało się pobrać zgłoszeń warsztatów.");
      } finally {
        setLoadingLeads(false);
      }

      try {
        const workshopData = await listWorkshopsForAdmin(user.id, email);
        setAdminWorkshops(workshopData);
      } catch (err) {
        setWorkshopsError(err instanceof Error ? err.message : "Nie udało się pobrać listy warsztatów.");
      } finally {
        setLoadingWorkshops(false);
      }
    }

    verifyAccess();
  }, []);

  async function updateLeadStatus(id: string, newStatus: AdminWorkshopStatus): Promise<boolean> {
    if (!currentUser) return false;
    setSavingId(id);
    setLeadsError("");

    try {
      await updateWorkshopLeadStatusAsAdmin(currentUser.id, currentUser.email, id, newStatus);
    } catch (err) {
      setLeadsError(err instanceof Error ? err.message : "Nie udało się zaktualizować statusu zgłoszenia.");
      setSavingId(null);
      return false;
    }

    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, status: newStatus } : row)),
    );
    setSavingId(null);
    return true;
  }

  function openApproveModal(lead: WorkshopLeadRow) {
    setPendingApproveLead(lead);
    setApproveEmailMode("lead");
    setApproveOwnerEmailInput((lead.email ?? "").trim());
    setLeadsError("");
  }

  function closeApproveModal() {
    setPendingApproveLead(null);
    setLeadsError("");
  }

  async function submitApproveLead() {
    if (!currentUser || !supabase || !pendingApproveLead) return;
    const emailRaw =
      approveEmailMode === "lead" ? (pendingApproveLead.email ?? "").trim() : approveOwnerEmailInput.trim();
    if (approveEmailMode === "lead" && !(pendingApproveLead.email ?? "").trim()) {
      setLeadsError("Brak e-maila w zgłoszeniu — wybierz „Inny e-mail” i wpisz adres.");
      return;
    }
    if (!emailRaw || !emailRaw.includes("@")) {
      setLeadsError("Podaj prawidłowy adres e-mail właściciela (logowanie do panelu warsztatu).");
      return;
    }
    setSavingId(pendingApproveLead.id);
    setLeadsError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Brak sesji — zaloguj się ponownie.");
      const { invited } = await approveWorkshopLeadWithOwnerEmail(token, pendingApproveLead.id, emailRaw);
      setRows((prev) => prev.map((row) => (row.id === pendingApproveLead.id ? { ...row, status: "approved" } : row)));
      await sendSystemMessage({
        recipientId: null,
        recipientRole: "workshop",
        subject: `Zgłoszenie warsztatu zaakceptowane: ${pendingApproveLead.workshop_name}`,
        body: `Administrator zaakceptował zgłoszenie warsztatu "${pendingApproveLead.workshop_name}" (${pendingApproveLead.city ?? "miasto nieznane"}).`,
      });
      await refreshWorkshops();
      await refreshLeads();
      await refreshSidebarBadges();
      setLeadDetailId(null);
      closeApproveModal();
      setSuccessMessage(
        invited
          ? "Warsztat zaakceptowany. Wysłano zaproszenie na e-mail — właściciel ustawi hasło z linku."
          : "Warsztat zaakceptowany. Na e-mail właściciela wysłano link resetu hasła (konto już istniało).",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nie udało się zaakceptować zgłoszenia.";
      setLeadsError(
        `${msg} W Supabase uruchom m.in. supabase-15-workshop-owner-access.sql oraz ustaw zmienną SUPABASE_SERVICE_ROLE_KEY na serwerze aplikacji (bez prefiksu NEXT_PUBLIC).`,
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleResendWorkshopAccess(workshopId: string) {
    if (!currentUser || !supabase) return;
    setSavingResendWorkshopId(workshopId);
    setWorkshopsError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Brak sesji.");
      await resendWorkshopOwnerAccessEmail(token, workshopId);
      setSuccessMessage("Wysłano ponownie e-mail z linkiem do ustawienia hasła.");
    } catch (err) {
      setWorkshopsError(err instanceof Error ? err.message : "Nie udało się wysłać maila.");
    } finally {
      setSavingResendWorkshopId(null);
    }
  }

  async function rejectLeadFromList(id: string) {
    const target = rows.find((row) => row.id === id) ?? null;
    const ok = await updateLeadStatus(id, "rejected");
    if (ok) {
      if (target) {
        await sendSystemMessage({
          recipientId: null,
          recipientRole: "workshop",
          subject: `Zgłoszenie warsztatu odrzucone: ${target.workshop_name}`,
          body: `Administrator odrzucił zgłoszenie warsztatu "${target.workshop_name}".`,
        });
      }
      await refreshLeads();
      await refreshSidebarBadges();
      setSuccessMessage("Zgłoszenie odrzucone.");
    }
  }

  async function archiveLead(id: string, options?: { closeModal?: boolean }) {
    const ok = await updateLeadStatus(id, "archived");
    if (ok) {
      await refreshLeads();
      setSuccessMessage("Zgłoszenie zarchiwizowane.");
      if (options?.closeModal) setLeadDetailId(null);
    }
  }

  function closeWorkshopPanel() {
    setWorkshopViewId(null);
    setWorkshopEditId(null);
    setWorkshopPanelDetail(null);
    setEditDraft(null);
    setWorkshopPanelError("");
    setLoadingWorkshopPanel(false);
  }

  async function handleSetWorkshopStatus(id: string, status: AdminWorkshopEntityStatus) {
    if (!currentUser) return;
    setSavingWorkshopId(id);
    setWorkshopsError("");
    setWorkshopPanelError("");
    try {
      await setWorkshopStatusAsAdmin(currentUser.id, currentUser.email, id, status);
      await refreshWorkshops();
      setSuccessMessage(
        status === "active" ? "Warsztat aktywowany." : status === "suspended" ? "Warsztat zawieszony." : "Warsztat ukryty.",
      );
      if (workshopPanelDetail?.id === id) {
        const d = await getWorkshopDetailForAdmin(currentUser.id, currentUser.email, id);
        setWorkshopPanelDetail(d);
      }
    } catch (err) {
      setWorkshopsError(err instanceof Error ? err.message : "Nie udało się zmienić statusu warsztatu.");
    } finally {
      setSavingWorkshopId(null);
    }
  }

  async function handleSaveWorkshopEdit() {
    if (!currentUser || !workshopEditId || !editDraft) return;
    const maps = editDraft.google_maps_url.trim();
    if (maps && !isValidWorkshopGoogleMapsUrl(maps)) {
      setWorkshopPanelError("Podaj poprawny link do Google Maps albo zostaw pole puste.");
      return;
    }
    if (editDraft.show_on_map) {
      const latN = Number(editDraft.latitude.replace(",", "."));
      const lngN = Number(editDraft.longitude.replace(",", "."));
      if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
        setWorkshopPanelError('Włączenie „Pokaż na mapie ServyGo” wymaga poprawnych pól „Szerokość” i „Długość”.');
        return;
      }
      if (latN < -90 || latN > 90 || lngN < -180 || lngN > 180) {
        setWorkshopPanelError("Współrzędne geograficzne są poza dopuszczalnym zakresem.");
        return;
      }
    }
    setSavingWorkshopId(workshopEditId);
    setWorkshopPanelError("");
    try {
      const latStr = editDraft.latitude.replace(",", ".").trim();
      const lngStr = editDraft.longitude.replace(",", ".").trim();
      const ratingStr = editDraft.rating.replace(",", ".").trim();
      const reviewsStr = editDraft.reviews_count.trim();
      const payload: AdminWorkshopUpdatePayload = {
        name: editDraft.name,
        slug: editDraft.slug.trim() || null,
        city: editDraft.city || null,
        address: editDraft.address || null,
        phone: editDraft.phone || null,
        email: editDraft.email || null,
        description: editDraft.description || null,
        google_maps_url: maps || null,
        google_place_id: editDraft.google_place_id.trim() || null,
        latitude: latStr === "" ? null : Number(latStr),
        longitude: lngStr === "" ? null : Number(lngStr),
        rating: ratingStr === "" ? null : Number(ratingStr),
        reviews_count: reviewsStr === "" ? null : Number(reviewsStr),
        show_on_map: editDraft.show_on_map,
        opening_hours: editDraft.opening_hours || null,
        status: editDraft.status,
      };
      await updateWorkshopAsAdmin(currentUser.id, currentUser.email, workshopEditId, payload);
      const servicesLines = editDraft.servicesText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      await replaceWorkshopServicesAsAdmin(currentUser.id, currentUser.email, workshopEditId, servicesLines);
      await refreshWorkshops();
      setSuccessMessage("Warsztat zapisany.");
      closeWorkshopPanel();
    } catch (err) {
      setWorkshopPanelError(err instanceof Error ? err.message : "Nie udało się zapisać warsztatu.");
    } finally {
      setSavingWorkshopId(null);
    }
  }

  async function handleSeedTestLead() {
    if (!currentUser) return;
    setSeedingTestLead(true);
    setLeadsError("");
    try {
      await seedTestWorkshopLeadAsAdmin(currentUser.id, currentUser.email);
      await refreshLeads();
      setSuccessMessage("Dodano testowe zgłoszenie.");
    } catch (err) {
      setLeadsError(
        err instanceof Error
          ? err.message
          : "Nie udało się dodać testowego zgłoszenia. Uruchom supabase-admin-approve-lead.sql (funkcja admin_seed_test_workshop_lead).",
      );
    } finally {
      setSeedingTestLead(false);
    }
  }

  useEffect(() => {
    if (!leadDetailId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLeadDetailId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leadDetailId]);

  useEffect(() => {
    if (!workshopViewId && !workshopEditId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWorkshopPanel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [workshopViewId, workshopEditId]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const refreshDashboardStats = useCallback(async () => {
    if (!currentUser) return;
    setLoadingDashboardStats(true);
    setDashboardStatsError("");
    try {
      const stats = await getAdminDashboardStats(currentUser.id, currentUser.email);
      setDashboardStatsData(stats);
    } catch (err) {
      setDashboardStatsData(null);
      setDashboardStatsError(err instanceof Error ? err.message : "Nie udało się pobrać statystyk.");
    } finally {
      setLoadingDashboardStats(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !isAdmin) return;
    void refreshDashboardStats();
  }, [currentUser, isAdmin, refreshDashboardStats]);

  const isDark = mounted ? theme === "dark" : false;
  const unreadSidebarBadges = useMemo<SidebarBadgeState>(() => {
    const next = { ...EMPTY_SIDEBAR_BADGES };
    for (const item of SIDEBAR_ITEMS) {
      const unseen = (liveSidebarBadges[item] ?? 0) - (seenSidebarBadges[item] ?? 0);
      next[item] = unseen > 0 ? unseen : 0;
    }
    return next;
  }, [liveSidebarBadges, seenSidebarBadges]);
  const stats = dashboardStatsData;
  const dashboardStats = useMemo(
    () => [
      { label: "Liczba użytkowników", value: String(stats?.usersCount ?? 0), tone: "from-blue-600 to-blue-400", icon: "👥" },
      { label: "Aktywne warsztaty", value: String(stats?.workshopsCount ?? 0), tone: "from-cyan-600 to-blue-500", icon: "🛠️" },
      { label: "Oczekujące zgłoszenia", value: String(stats?.pendingLeadsCount ?? 0), tone: "from-orange-500 to-amber-400", icon: "📥" },
      { label: "Rezerwacje dzisiaj", value: String(stats?.bookingsTodayCount ?? 0), tone: "from-violet-600 to-blue-500", icon: "📅" },
      { label: "Rezerwacje w miesiącu", value: String(stats?.bookingsMonthCount ?? 0), tone: "from-blue-700 to-indigo-500", icon: "📈" },
      { label: "Średnia ocena warsztatów", value: (stats?.avgWorkshopRating ?? 0).toFixed(1), tone: "from-orange-500 to-pink-500", icon: "⭐" },
      { label: "Kliknięcia „Umów termin”", value: String(stats?.bookingStartClicks ?? 0), tone: "from-sky-600 to-cyan-400", icon: "🖱️" },
      { label: "Wejścia na stronę", value: String(stats?.pageViewsCount ?? 0), tone: "from-blue-500 to-orange-400", icon: "🌐" },
    ],
    [stats],
  );
  const recentBookings = stats?.recentBookings ?? [];
  const bookingsByStatusMock = stats?.bookingsByStatus ?? [];
  const popularServicesMock = stats?.popularServices ?? [];
  const popularCitiesMock = stats?.popularCities ?? [];
  const topPages = stats?.topPages ?? [];
  const trafficSources = stats?.trafficSources ?? [];
  const trafficDevices = stats?.devices ?? [];
  const trafficBrowsers = stats?.browsers ?? [];
  const trafficOs = stats?.osList ?? [];
  const recentEvents = stats?.recentEvents ?? [];
  const conversionFunnelMock = stats?.funnel ?? [];
  const analyticsSnapshot = {
    visits: stats?.pageViewsCount ?? 0,
    searches: conversionFunnelMock.find((x) => x.label === "Wyszukiwania")?.value ?? 0,
    workshopClicks: conversionFunnelMock.find((x) => x.label === "Kliknięcia warsztatów")?.value ?? 0,
    bookClicks: stats?.bookingStartClicks ?? 0,
    visits7d: stats?.visits7d ?? [0, 0, 0, 0, 0, 0, 0],
    bookings7d: stats?.bookings7d ?? [0, 0, 0, 0, 0, 0, 0],
  };
  const maxBookingStatusCount = Math.max(...bookingsByStatusMock.map((b) => b.count), 1);
  const maxPopularServiceCount = Math.max(...popularServicesMock.map((b) => b.count), 1);
  const maxPopularCityCount = Math.max(...popularCitiesMock.map((b) => b.count), 1);
  const maxTopPagesCount = Math.max(...topPages.map((b) => b.count), 1);
  const maxTrafficSourcesCount = Math.max(...trafficSources.map((b) => b.count), 1);
  const maxDeviceCount = Math.max(...trafficDevices.map((b) => b.count), 1);
  const maxVisit7d = Math.max(...analyticsSnapshot.visits7d, 1);
  const funnelBase = conversionFunnelMock[0]?.value ?? 1;
  const usersOverview = [
    { email: "jan@example.com", role: "klient", registeredAt: "2026-03-12", bookings: 4, status: "aktywny" },
    { email: "kontakt@autoservice.pl", role: "warsztat", registeredAt: "2026-02-01", bookings: 89, status: "aktywny" },
    { email: currentUser?.email ?? "admin@servygo.pl", role: "admin", registeredAt: "2026-01-18", bookings: 0, status: "aktywny" },
  ];
  const reviewsOverview = [
    { workshop: "AutoSerwis Beskid Premium", rating: 4.8, reviewCount: 214, mapsUrl: "https://maps.google.com", googlePlaceId: "mock-place-bb-1", photosCount: 27, connectionStatus: "connected" },
    { workshop: "Moto Klinik Lipnik", rating: 4.6, reviewCount: 167, mapsUrl: "https://maps.google.com", googlePlaceId: "mock-place-bb-2", photosCount: 19, connectionStatus: "connected" },
    { workshop: "Nowy Serwis Podmiejski", rating: 0, reviewCount: 0, mapsUrl: "-", googlePlaceId: "-", photosCount: 0, connectionStatus: "pending" },
  ];

  if (accessLoading) {
    return (
      <ServyGoPageShell isDark={isDark}>
        <main className={`min-h-screen w-full max-w-none px-6 py-6 sm:px-8 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
          <ServyGoSubpageNavBar isDark={isDark} showMojeKonto={false} />
          <div className="mx-auto mt-6 w-full max-w-none">
            <p className={isDark ? "text-zinc-300" : "text-zinc-700"}>Sprawdzanie uprawnień administratora...</p>
          </div>
        </main>
      </ServyGoPageShell>
    );
  }

  if (!currentUser) {
    return (
      <ServyGoPageShell isDark={isDark}>
        <main className={`min-h-screen px-4 py-6 sm:px-6 md:px-10 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
          <div className="mx-auto max-w-4xl">
            <ServyGoSubpageNavBar isDark={isDark} showMojeKonto={false} />
            <div className="mx-auto mt-6 w-full max-w-4xl rounded-2xl border border-orange-400/30 bg-orange-500/10 p-6">
              <h1 className="text-2xl font-bold">Panel administratora</h1>
              <p className="mt-3">Przekierowanie do logowania...</p>
              <Link href="/?auth=login" className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                Przejdź do logowania
              </Link>
            </div>
          </div>
        </main>
      </ServyGoPageShell>
    );
  }

  if (!isAdmin) {
    return (
      <ServyGoPageShell isDark={isDark}>
        <main className={`min-h-screen px-4 py-6 sm:px-6 md:px-10 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
          <div className="mx-auto max-w-4xl">
            <ServyGoSubpageNavBar isDark={isDark} />
            <div className="mx-auto mt-6 w-full rounded-2xl border border-orange-400/30 bg-orange-500/10 p-6">
              <h1 className="text-2xl font-bold">Panel administratora</h1>
              <p className="mt-3">Brak dostępu.</p>
            </div>
          </div>
        </main>
      </ServyGoPageShell>
    );
  }

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className={`min-h-screen w-full max-w-none px-6 py-4 sm:px-8 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
        <ServyGoSubpageNavBar isDark={isDark} />
        <div className="mx-auto flex w-full max-w-none gap-4 lg:gap-6">
          <aside
            className={`${
              mobileMenuOpen ? "fixed inset-0 z-40 p-4" : "hidden"
            } lg:static lg:z-auto lg:block lg:w-64 lg:min-w-[16rem] lg:max-w-[16rem] lg:flex-shrink-0 lg:p-0`}
          >
            <div className={`${mobileMenuOpen ? "absolute inset-0 bg-zinc-950/70 lg:hidden" : ""}`} onClick={() => setMobileMenuOpen(false)} />
            <div
              className={`relative h-full rounded-3xl border p-4 backdrop-blur-xl lg:h-[calc(100vh-2rem)] lg:sticky lg:top-4 ${
                isDark
                  ? "border-blue-500/25 bg-zinc-900/92"
                  : "border-blue-200/85 bg-white/85"
              }`}
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold uppercase tracking-wider text-blue-400">ServyGo Admin</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg border px-2 py-1 text-xs lg:hidden"
                >
                  Zamknij
                </button>
              </div>
              <nav className="space-y-1.5">
                {SIDEBAR_ITEMS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setActiveTab(item);
                      markTabSeen(item);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                      activeTab === item
                        ? isDark
                          ? "bg-gradient-to-r from-blue-600/80 to-orange-500/80 text-white"
                          : "bg-gradient-to-r from-blue-600 to-orange-500 text-white"
                        : isDark
                          ? "text-zinc-200 hover:bg-zinc-800/80"
                          : "text-zinc-700 hover:bg-blue-50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2">
                        {item === "Moje wiadomości" ? (
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="3" y="5" width="18" height="14" rx="2" />
                            <path d="m4 7 8 6 8-6" />
                          </svg>
                        ) : null}
                        <span>{item}</span>
                      </span>
                      {unreadSidebarBadges[item] > 0 ? (
                        <span
                          className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${
                            isDark ? "bg-orange-500 text-zinc-950" : "bg-rose-600 text-white"
                          }`}
                        >
                          {formatBadgeNumber(unreadSidebarBadges[item])}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <section className="min-w-0 flex-1 space-y-4">
            {fatalConfigError ? (
              <p
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  isDark ? "border-red-500/40 bg-red-950/50 text-red-100" : "border-red-300 bg-red-50 text-red-900"
                }`}
              >
                {fatalConfigError}
              </p>
            ) : null}
            {successMessage ? (
              <p
                role="status"
                className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                  isDark ? "border-emerald-500/40 bg-emerald-950/45 text-emerald-100" : "border-emerald-300 bg-emerald-50 text-emerald-900"
                }`}
              >
                {successMessage}
              </p>
            ) : null}
            <header
              className={`rounded-3xl border px-4 py-3 backdrop-blur-xl sm:px-5 ${
                isDark ? "border-blue-500/25 bg-zinc-900/88" : "border-blue-200/85 bg-white/86"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="inline-flex rounded-xl border px-3 py-2 text-sm font-semibold lg:hidden"
                  >
                    ☰ Menu
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
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <h1 className="text-2xl font-bold sm:text-3xl">Panel administratora ServyGo</h1>
                      {activeTab === "Dashboard" && loadingDashboardStats ? (
                        <span className={`inline-flex max-w-full shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-tight sm:text-xs ${
                          isDark ? "border-blue-500/35 bg-blue-500/10 text-blue-200/90" : "border-blue-400/60 bg-blue-50 text-blue-900/80"
                        }`}>
                          Ładowanie statystyk…
                        </span>
                      ) : null}
                    </div>
                    <p className={`mt-1 text-xs sm:text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                      Zalogowany: <strong>{currentUser.email ?? "brak e-mail"}</strong> {adminRole ? `(${adminRole})` : ""}
                    </p>
                  </div>
                </div>
                <div className="relative flex items-center gap-2">
                  <Link
                    href="/moje-wiadomosci"
                    className={`relative inline-flex rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      isDark
                        ? "border-blue-400/50 bg-zinc-900/70 text-zinc-200 hover:border-orange-300"
                        : "border-blue-200 bg-white/80 text-zinc-700 hover:border-orange-300"
                    }`}
                    aria-label="Moje wiadomości — otwórz skrzynkę"
                  >
                    🔔
                    {(liveSidebarBadges["Moje wiadomości"] ?? 0) > 0 ? (
                      <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                        {formatBadgeNumber(liveSidebarBadges["Moje wiadomości"] ?? 0)}
                      </span>
                    ) : null}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                    className={`inline-flex rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      isDark
                        ? "border-blue-400/50 bg-zinc-900/70 text-zinc-200 hover:border-orange-300"
                        : "border-blue-200 bg-white/80 text-zinc-700 hover:border-orange-300"
                    }`}
                  >
                    {theme === "dark" ? "☀️ Jasny" : "🌙 Ciemny"}
                  </button>
                </div>
              </div>
            </header>

            {activeTab === "Dashboard" ? (
              <>
                {dashboardStatsError ? (
                  <p className={`rounded-xl border px-3 py-2 text-sm ${isDark ? "border-orange-400/40 bg-orange-500/10 text-orange-200" : "border-orange-200 bg-orange-50 text-orange-800"}`}>
                    {dashboardStatsError}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                  {dashboardStats.map((stat) => (
                    <article
                      key={stat.label}
                      className={`rounded-xl border px-3 py-2 shadow-sm ${
                        isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"
                      }`}
                    >
                      <div className={`inline-flex rounded-lg bg-gradient-to-r px-1.5 py-0.5 text-[10px] font-semibold text-white ${stat.tone}`}>
                        {stat.icon}
                      </div>
                      <p className={`mt-1 text-[11px] leading-tight ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{stat.label}</p>
                      <p className="mt-0.5 text-lg font-bold">{stat.value}</p>
                    </article>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
                  <section
                    className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}
                  >
                    <h2 className="text-sm font-semibold leading-tight">Ruch na stronie</h2>
                    {stats && !stats.hasAnalytics ? (
                      <p className={`mt-1 text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>
                        Brak tabeli analytics_events lub brak danych - pokazano wartości 0.
                      </p>
                    ) : null}
                    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] leading-snug">
                      <p className="min-w-0">
                        <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Dzisiaj:</span>{" "}
                        {(stats?.trafficTodayCount ?? 0).toLocaleString("pl-PL")}
                      </p>
                      <p className="min-w-0">
                        <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Miesiąc:</span>{" "}
                        {(stats?.trafficMonthCount ?? 0).toLocaleString("pl-PL")}
                      </p>
                      <p className="min-w-0">
                        <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Łącznie:</span>{" "}
                        {(stats?.trafficTotalCount ?? 0).toLocaleString("pl-PL")}
                      </p>
                      <p className="min-w-0">
                        <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Unikalni:</span>{" "}
                        {(stats?.uniqueVisitorsCount ?? 0).toLocaleString("pl-PL")}
                      </p>
                      <p className="col-span-2 min-w-0">
                        <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Sesje unikalne:</span>{" "}
                        {(stats?.uniqueSessionsCount ?? 0).toLocaleString("pl-PL")}
                      </p>
                      <p className="min-w-0">
                        <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Wizyty:</span>{" "}
                        {analyticsSnapshot.visits.toLocaleString("pl-PL")}
                      </p>
                      <p className="min-w-0">
                        <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Wyszukiwania:</span>{" "}
                        {analyticsSnapshot.searches.toLocaleString("pl-PL")}
                      </p>
                      <p className="min-w-0">
                        <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Klik. warsztatów:</span>{" "}
                        {analyticsSnapshot.workshopClicks.toLocaleString("pl-PL")}
                      </p>
                      <p className="col-span-2 min-w-0">
                        <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Klik. „Umów termin”:</span>{" "}
                        {analyticsSnapshot.bookClicks.toLocaleString("pl-PL")}
                      </p>
                    </div>
                    <div className={`mt-2 rounded-lg border px-2 py-1.5 ${isDark ? "border-zinc-600/60 bg-zinc-950/40" : "border-blue-200/80 bg-blue-50/50"}`}>
                      <p className={`mb-2 text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>
                        Wizyty / rezerw. 7 dni
                      </p>
                      <div className="grid h-16 grid-cols-7 items-end gap-1">
                        {analyticsSnapshot.visits7d.map((value, idx) => (
                          <div key={`${value}-${idx}`} className="flex min-h-0 flex-col items-center justify-end gap-0.5">
                            <div
                              className="w-full rounded-sm bg-gradient-to-t from-blue-600 to-orange-400"
                              style={{ height: `${Math.max(5, Math.round((value / maxVisit7d) * 42))}px` }}
                            />
                            <span className="text-[9px] tabular-nums leading-none text-zinc-500">{analyticsSnapshot.bookings7d[idx]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className={`min-w-0 rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h2 className="text-sm font-semibold">Ostatnie rezerwacje</h2>
                    <div className="mt-2 w-full min-w-0">
                      <table className="w-full table-fixed border-collapse text-xs">
                        <colgroup>
                          <col style={{ width: "9%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "21%" }} />
                          <col style={{ width: "14%" }} />
                          <col style={{ width: "17%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "8%" }} />
                          <col style={{ width: "7%" }} />
                        </colgroup>
                        <thead className={isDark ? "text-zinc-300" : "text-zinc-600"}>
                          <tr>
                            <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold sm:px-3 sm:text-sm">Data</th>
                            <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold sm:px-3 sm:text-sm">Klient</th>
                            <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold sm:px-3 sm:text-sm">Warsztat</th>
                            <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold sm:px-3 sm:text-sm">Usługa</th>
                            <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold sm:px-3 sm:text-sm">Auto</th>
                            <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold sm:px-3 sm:text-sm">Termin</th>
                            <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold sm:px-3 sm:text-sm">Status</th>
                            <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold sm:px-3 sm:text-sm">Akcje</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentBookings.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-3 py-4 text-center text-xs">Brak danych do wyświetlenia</td>
                            </tr>
                          ) : recentBookings.map((booking, index) => (
                            <tr key={`${booking.workshop}-${booking.term}-${index}`} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
                              <td className="whitespace-nowrap px-2 py-2 align-middle tabular-nums sm:px-3 sm:py-2.5">{booking.date}</td>
                              <td className="max-w-0 px-2 py-2 align-middle sm:px-3 sm:py-2.5">
                                <span className="block truncate" title={booking.client}>
                                  {booking.client}
                                </span>
                              </td>
                              <td className="max-w-0 px-2 py-2 align-middle sm:px-3 sm:py-2.5">
                                <span className="block truncate" title={booking.workshop}>
                                  {booking.workshop}
                                </span>
                              </td>
                              <td className="max-w-0 px-2 py-2 align-middle sm:px-3 sm:py-2.5">
                                <span className="block truncate" title={booking.service}>
                                  {booking.service}
                                </span>
                              </td>
                              <td className="max-w-0 px-2 py-2 align-middle sm:px-3 sm:py-2.5">
                                <span className="block truncate" title={booking.car}>
                                  {booking.car}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 align-middle tabular-nums sm:px-3 sm:py-2.5">{booking.term}</td>
                              <td className="whitespace-nowrap px-2 py-2 align-middle sm:px-3 sm:py-2.5">{booking.status}</td>
                              <td className="whitespace-nowrap px-2 py-2 align-middle sm:px-3 sm:py-2.5">
                                <button type="button" className="rounded-lg border px-2 py-0.5 text-[11px]">
                                  Zobacz
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <section className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h3 className="text-sm font-semibold">Rezerwacje wg statusu</h3>
                    <ul className="mt-2 space-y-2">
                      {bookingsByStatusMock.length === 0 ? <li className="text-xs text-zinc-500">Brak danych do wyświetlenia</li> : null}
                      {bookingsByStatusMock.map((row) => (
                        <li key={row.label}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="shrink-0 text-zinc-400">{row.label}</span>
                            <span className="tabular-nums font-semibold">{row.count}</span>
                          </div>
                          <div className={`mt-1 h-2 overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-blue-100"}`}>
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-orange-400"
                              style={{ width: `${Math.round((row.count / maxBookingStatusCount) * 100)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h3 className="text-sm font-semibold">Najpopularniejsze usługi</h3>
                    <ul className="mt-2 space-y-2">
                      {popularServicesMock.length === 0 ? <li className="text-xs text-zinc-500">Brak danych do wyświetlenia</li> : null}
                      {popularServicesMock.map((row) => (
                        <li key={row.label}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate text-zinc-400" title={row.label}>
                              {row.label}
                            </span>
                            <span className="shrink-0 tabular-nums font-semibold">{row.count}</span>
                          </div>
                          <div className={`mt-1 h-2 overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-blue-100"}`}>
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-blue-500"
                              style={{ width: `${Math.round((row.count / maxPopularServiceCount) * 100)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h3 className="text-sm font-semibold">Najpopularniejsze miasta</h3>
                    <ul className="mt-2 space-y-2">
                      {popularCitiesMock.length === 0 ? <li className="text-xs text-zinc-500">Brak danych do wyświetlenia</li> : null}
                      {popularCitiesMock.map((row) => (
                        <li key={row.label}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate text-zinc-400" title={row.label}>
                              {row.label}
                            </span>
                            <span className="shrink-0 tabular-nums font-semibold">{row.count}</span>
                          </div>
                          <div className={`mt-1 h-2 overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-blue-100"}`}>
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-orange-400"
                              style={{ width: `${Math.round((row.count / maxPopularCityCount) * 100)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h3 className="text-sm font-semibold">Konwersja (lejek)</h3>
                    <ul className="mt-2 space-y-2">
                      {conversionFunnelMock.length === 0 ? <li className="text-xs text-zinc-500">Brak danych do wyświetlenia</li> : null}
                      {conversionFunnelMock.map((step) => (
                        <li key={step.label}>
                          <div className="flex items-center justify-between gap-2 text-[11px] leading-tight">
                            <span className="min-w-0 text-zinc-400">{step.label}</span>
                            <span className="shrink-0 tabular-nums font-semibold text-xs">{step.value.toLocaleString("pl-PL")}</span>
                          </div>
                          <div className={`mt-1 h-2.5 overflow-hidden rounded-md ${isDark ? "bg-zinc-800" : "bg-blue-100"}`}>
                            <div
                              className="h-full rounded-md bg-gradient-to-r from-blue-700 to-blue-400"
                              style={{ width: `${Math.max(6, Math.round((step.value / funnelBase) * 100))}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                  <section className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h3 className="text-sm font-semibold">Najczęściej odwiedzane strony</h3>
                    <ul className="mt-2 space-y-2">
                      {topPages.length === 0 ? <li className="text-xs text-zinc-500">Brak danych do wyświetlenia</li> : null}
                      {topPages.map((row) => (
                        <li key={row.label}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate text-zinc-400" title={row.label}>{row.label}</span>
                            <span className="tabular-nums font-semibold">{row.count}</span>
                          </div>
                          <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-blue-100"}`}>
                            <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${Math.round((row.count / maxTopPagesCount) * 100)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h3 className="text-sm font-semibold">Źródła ruchu</h3>
                    <ul className="mt-2 space-y-2">
                      {trafficSources.length === 0 ? <li className="text-xs text-zinc-500">Brak danych do wyświetlenia</li> : null}
                      {trafficSources.map((row) => (
                        <li key={row.label}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate text-zinc-400" title={row.label}>{row.label}</span>
                            <span className="tabular-nums font-semibold">{row.count}</span>
                          </div>
                          <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-blue-100"}`}>
                            <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500" style={{ width: `${Math.round((row.count / maxTrafficSourcesCount) * 100)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h3 className="text-sm font-semibold">Urządzenia</h3>
                    <ul className="mt-2 space-y-2">
                      {trafficDevices.length === 0 ? <li className="text-xs text-zinc-500">Brak danych do wyświetlenia</li> : null}
                      {trafficDevices.map((row) => (
                        <li key={row.label}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate text-zinc-400" title={row.label}>{row.label}</span>
                            <span className="tabular-nums font-semibold">{row.count}</span>
                          </div>
                          <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-blue-100"}`}>
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-cyan-500" style={{ width: `${Math.round((row.count / maxDeviceCount) * 100)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-zinc-400">Top przeglądarki</p>
                        <ul className="mt-1 space-y-1">
                          {trafficBrowsers.slice(0, 4).map((row) => (
                            <li key={row.label} className="flex items-center justify-between text-[11px]">
                              <span className="truncate text-zinc-400">{row.label}</span>
                              <span className="tabular-nums font-semibold">{row.count}</span>
                            </li>
                          ))}
                          {trafficBrowsers.length === 0 ? <li className="text-[11px] text-zinc-500">Brak danych</li> : null}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-zinc-400">Top systemy</p>
                        <ul className="mt-1 space-y-1">
                          {trafficOs.slice(0, 4).map((row) => (
                            <li key={row.label} className="flex items-center justify-between text-[11px]">
                              <span className="truncate text-zinc-400">{row.label}</span>
                              <span className="tabular-nums font-semibold">{row.count}</span>
                            </li>
                          ))}
                          {trafficOs.length === 0 ? <li className="text-[11px] text-zinc-500">Brak danych</li> : null}
                        </ul>
                      </div>
                    </div>
                  </section>
                </div>

                <section className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                  <h3 className="text-sm font-semibold">Ostatnie zdarzenia</h3>
                  <div className="mt-2 min-w-0 overflow-x-auto">
                    <table className="w-full min-w-[680px] text-xs">
                      <thead className={isDark ? "text-zinc-400" : "text-zinc-600"}>
                        <tr>
                          <th className="px-2 py-1.5 text-left">Czas</th>
                          <th className="px-2 py-1.5 text-left">Event</th>
                          <th className="px-2 py-1.5 text-left">Ścieżka</th>
                          <th className="px-2 py-1.5 text-left">Źródło</th>
                          <th className="px-2 py-1.5 text-left">Urządzenie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentEvents.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-2 py-3 text-center text-xs text-zinc-500">Brak danych do wyświetlenia</td>
                          </tr>
                        ) : recentEvents.map((event, index) => (
                          <tr key={`${event.createdAt}-${event.eventName}-${index}`} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
                            <td className="px-2 py-1.5 tabular-nums">{formatDate(event.createdAt)}</td>
                            <td className="px-2 py-1.5">{event.eventName}</td>
                            <td className="max-w-[260px] truncate px-2 py-1.5" title={event.path}>{event.path}</td>
                            <td className="px-2 py-1.5">{event.source}</td>
                            <td className="px-2 py-1.5">{event.deviceType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}

            {activeTab === "Moje wiadomości" && currentUser ? (
              <InternalInbox
                currentUserId={currentUser.id}
                isDark={isDark}
                viewerRole="admin"
                includeAllForAdmin
                onUnreadCountChange={handleAdminInboxUnreadChange}
              />
            ) : null}

            {activeTab === "Zgłoszenia problemów" ? (
              <section className={`rounded-2xl border p-5 lg:p-6 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Zgłoszenia problemów (support)</h2>
                  <button
                    type="button"
                    onClick={() => void refreshSupportReports()}
                    disabled={supportReportsLoading}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                  >
                    Odśwież
                  </button>
                </div>
                {supportReportsError ? (
                  <p className={`mt-3 text-sm ${isDark ? "text-orange-200" : "text-orange-800"}`}>{supportReportsError}</p>
                ) : null}
                {supportReportsLoading ? <p className="mt-3 text-sm">Ładowanie…</p> : null}
                {!supportReportsLoading ? (
                  <div className="mt-4 min-w-0 overflow-x-auto">
                    <table className="w-full min-w-[960px] text-sm">
                      <thead className={isDark ? "text-zinc-400" : "text-zinc-600"}>
                        <tr>
                          <th className="px-2 py-2 text-left">Data</th>
                          <th className="px-2 py-2 text-left">Typ</th>
                          <th className="px-2 py-2 text-left">Temat</th>
                          <th className="px-2 py-2 text-left">E-mail</th>
                          <th className="px-2 py-2 text-left">Status</th>
                          <th className="px-2 py-2 text-left">Treść</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supportReportRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className={`px-2 py-6 text-center ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>
                              Brak zgłoszeń.
                            </td>
                          </tr>
                        ) : (
                          supportReportRows.map((row) => (
                            <tr key={row.id} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
                              <td className="whitespace-nowrap px-2 py-2 align-top">{formatDate(row.created_at)}</td>
                              <td className="px-2 py-2 align-top">{row.report_type}</td>
                              <td className="max-w-[180px] px-2 py-2 align-top">{row.subject}</td>
                              <td className="max-w-[160px] truncate px-2 py-2 align-top" title={row.email}>
                                {row.email}
                              </td>
                              <td className="px-2 py-2 align-top">
                                <select
                                  value={row.status}
                                  onChange={(e) => {
                                    const next = e.target.value as SupportReportStatus;
                                    void (async () => {
                                      try {
                                        await updateSupportReportStatus(row.id, next);
                                        await refreshSupportReports();
                                      } catch {
                                        /* toast minimal */
                                      }
                                    })();
                                  }}
                                  className={`rounded-lg border px-2 py-1 text-xs ${isDark ? "border-zinc-600 bg-zinc-950" : "border-zinc-300 bg-white"}`}
                                >
                                  <option value="new">new</option>
                                  <option value="in_progress">in_progress</option>
                                  <option value="closed">closed</option>
                                </select>
                              </td>
                              <td className="max-w-[320px] px-2 py-2 align-top text-xs whitespace-pre-wrap">{row.message}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            ) : null}

            {activeTab === "Zgłoszenia warsztatów" ? (
              <section className={`rounded-2xl border p-5 lg:p-6 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold">Zgłoszenia warsztatów</h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void refreshLeads()}
                      disabled={loadingLeads}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                        isDark ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "border-zinc-300 hover:bg-zinc-50"
                      }`}
                    >
                      Odśwież listę
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSeedTestLead()}
                      disabled={seedingTestLead || loadingLeads}
                      className="rounded-xl border border-violet-400/50 bg-violet-600/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {seedingTestLead ? "Dodawanie…" : "Dodaj testowe zgłoszenie"}
                    </button>
                  </div>
                </div>
                <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  Przegląd i moderacja zgłoszeń z formularza{" "}
                  <Link href="/dodaj-warsztat" className="font-semibold text-blue-500 underline hover:text-orange-400">
                    Dołącz jako warsztat
                  </Link>
                  . Domyślnie widać tylko oczekujące; zarchiwizowane znajdziesz po wyborze filtru „Zarchiwizowane”.
                </p>
                <div className={`mt-3 flex flex-wrap gap-2 ${loadingLeads ? "pointer-events-none opacity-60" : ""}`}>
                  {LEAD_STATUS_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setLeadStatusFilter(f.id)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        leadStatusFilter === f.id
                          ? isDark
                            ? "border-blue-400 bg-blue-950/60 text-blue-100"
                            : "border-blue-500 bg-blue-50 text-blue-900"
                          : isDark
                            ? "border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                            : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {loadingLeads ? <p className="mt-3 text-sm">Ładowanie zgłoszeń warsztatów...</p> : null}
                {leadsError ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-xl border border-orange-400/50 bg-orange-500/10 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <p className={`text-sm ${isDark ? "text-orange-100" : "text-orange-950"}`}>{leadsError}</p>
                    <button
                      type="button"
                      onClick={() => setLeadsError("")}
                      className={`shrink-0 text-xs font-semibold underline ${isDark ? "text-orange-200" : "text-orange-900"}`}
                    >
                      Ukryj
                    </button>
                  </div>
                ) : null}
                {!loadingLeads ? (
                  <div
                    className={`mt-4 min-w-0 overflow-x-auto rounded-xl border ${isDark ? "border-zinc-600/50" : "border-blue-200"}`}
                  >
                    <table className="w-full min-w-[1100px] table-auto text-sm">
                      <thead className={isDark ? "bg-zinc-800/80 text-zinc-300" : "bg-blue-50/90 text-zinc-700"}>
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Data zgłoszenia</th>
                          <th className="px-3 py-2.5 text-left lg:px-4 lg:py-3">Warsztat</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Miasto</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Telefon</th>
                          <th className="px-3 py-2.5 text-left lg:px-4 lg:py-3">Email</th>
                          <th className="px-3 py-2.5 text-left lg:px-4 lg:py-3">Kontakt</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Status</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Akcje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className={`px-4 py-10 text-center text-sm leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                              Brak zgłoszeń warsztatów. Dodaj testowe zgłoszenie przyciskiem powyżej albo wyślij formularz{" "}
                              <Link href="/dodaj-warsztat" className="font-semibold text-blue-500 underline hover:text-orange-400">
                                Dołącz jako warsztat
                              </Link>
                              .
                            </td>
                          </tr>
                        ) : filteredLeads.length === 0 ? (
                          <tr>
                            <td colSpan={8} className={`px-4 py-10 text-center text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                              Brak zgłoszeń dla wybranego filtru statusu.
                            </td>
                          </tr>
                        ) : (
                          filteredLeads.map((row) => {
                            const resolved = isLeadModerationClosed(row.status);
                            const isArchived = normalizeWorkshopStatus(row.status) === "archived";
                            return (
                              <tr key={row.id} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
                                <td className="whitespace-nowrap px-3 py-2.5 lg:px-4 lg:py-3">{formatDate(row.created_at)}</td>
                                <td className="px-3 py-2.5 lg:px-4 lg:py-3">{row.workshop_name}</td>
                                <td className="px-3 py-2.5 lg:px-4 lg:py-3">{row.city ?? "-"}</td>
                                <td className="px-3 py-2.5 lg:px-4 lg:py-3">{row.phone ?? "-"}</td>
                                <td className="px-3 py-2.5 lg:px-4 lg:py-3">{row.email ?? "-"}</td>
                                <td className="max-w-[160px] px-3 py-2.5 lg:px-4 lg:py-3">
                                  <span className="line-clamp-2">{row.contact_person?.trim() || "—"}</span>
                                </td>
                                <td className="px-3 py-2.5 lg:px-4 lg:py-3">{formatWorkshopLeadStatusLabel(row.status)}</td>
                                <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                                  <div className="flex flex-wrap gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setLeadDetailId(row.id)}
                                      className="rounded-lg border border-blue-400/40 px-2.5 py-1 text-xs font-semibold transition hover:border-orange-300"
                                    >
                                      Zobacz szczegóły
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openApproveModal(row)}
                                      disabled={savingId === row.id || resolved}
                                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Akceptuj
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void rejectLeadFromList(row.id)}
                                      disabled={savingId === row.id || resolved}
                                      className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Odrzuć
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void archiveLead(row.id)}
                                      disabled={savingId === row.id || isArchived}
                                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                        isDark
                                          ? "border-zinc-500 text-zinc-200 hover:bg-zinc-800"
                                          : "border-zinc-400 text-zinc-800 hover:bg-zinc-100"
                                      }`}
                                    >
                                      Zarchiwizuj
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            ) : null}

            {activeTab === "Warsztaty" ? (
              <section className={`rounded-2xl border p-5 lg:p-6 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                <h2 className="text-lg font-semibold">Warsztaty</h2>
                <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  Lista z tabeli <code className="rounded bg-black/10 px-1 py-0.5 text-xs">workshops</code> w Supabase. Po akceptacji zgłoszenia warsztat trafia tutaj. Statusy:{" "}
                  <strong>active</strong> (widoczny publicznie), <strong>suspended</strong>, <strong>hidden</strong> (ukryty).
                </p>
                {workshopsError ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-xl border border-orange-400/50 bg-orange-500/10 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <p className={`text-sm ${isDark ? "text-orange-100" : "text-orange-950"}`}>{workshopsError}</p>
                    <button
                      type="button"
                      onClick={() => void refreshWorkshops()}
                      className={`shrink-0 text-xs font-semibold underline ${isDark ? "text-orange-200" : "text-orange-900"}`}
                    >
                      Spróbuj ponownie
                    </button>
                  </div>
                ) : null}
                {loadingWorkshops ? <p className="mt-3 text-sm">Ładowanie warsztatów...</p> : null}
                {!loadingWorkshops ? (
                  <div className="mt-3 min-w-0 overflow-x-auto">
                    <table className="w-full min-w-[1280px] table-auto text-sm">
                      <thead className={isDark ? "text-zinc-300" : "text-zinc-600"}>
                        <tr>
                          <th className="px-3 py-2.5 text-left lg:px-4 lg:py-3">Nazwa</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Miasto</th>
                          <th className="px-3 py-2.5 text-left lg:px-4 lg:py-3">Adres</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Telefon</th>
                          <th className="px-3 py-2.5 text-left lg:px-4 lg:py-3">E-mail</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Google Maps</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Status</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Usługi</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Akcje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminWorkshops.length === 0 ? (
                          <tr>
                            <td colSpan={9} className={`px-3 py-6 text-center text-sm ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>
                              Brak warsztatów w bazie. Zaakceptuj zgłoszenie w zakładce „Zgłoszenia warsztatów”, aby utworzyć wpis.
                            </td>
                          </tr>
                        ) : (
                          adminWorkshops.map((workshop) => {
                            const st = (workshop.status ?? "").toLowerCase().trim();
                            const isSuspended = st === "suspended" || st === "wylaczony";
                            const isActive = st === "active" || st === "approved" || st === "aktywny";
                            const mapsHref = (workshop.google_maps_url ?? "").trim();
                            return (
                              <tr key={workshop.id} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
                                <td className="px-3 py-2.5 font-medium lg:px-4 lg:py-3">{workshop.name}</td>
                                <td className="px-3 py-2.5 lg:px-4 lg:py-3">{workshop.city ?? "—"}</td>
                                <td className="max-w-[200px] px-3 py-2.5 lg:px-4 lg:py-3">
                                  <span className="line-clamp-2">{workshop.address?.trim() || "—"}</span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 lg:px-4 lg:py-3">{workshop.phone ?? "—"}</td>
                                <td className="max-w-[180px] truncate px-3 py-2.5 lg:px-4 lg:py-3">{workshop.email ?? "—"}</td>
                                <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                                  {mapsHref ? (
                                    <a
                                      href={mapsHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 underline"
                                    >
                                      Otwórz
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 lg:px-4 lg:py-3">
                                  {formatAdminWorkshopEntityStatusLabel(workshop.status)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 text-center lg:px-4 lg:py-3">
                                  {workshop.service_count ?? 0}
                                </td>
                                <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                                  <div className="flex flex-wrap gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setWorkshopEditId(null);
                                        setWorkshopViewId(workshop.id);
                                      }}
                                      className="rounded-lg border border-blue-400/40 px-2 py-1 text-xs font-semibold"
                                    >
                                      Zobacz
                                    </button>
                                    <Link
                                      href={`/admin/workshops/${workshop.id}/preview`}
                                      className="rounded-lg border border-violet-400/50 px-2 py-1 text-xs font-semibold"
                                    >
                                      Podgląd
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setWorkshopViewId(null);
                                        setWorkshopEditId(workshop.id);
                                      }}
                                      className="rounded-lg border border-zinc-400/50 px-2 py-1 text-xs font-semibold"
                                    >
                                      Edytuj
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingWorkshopId === workshop.id || isSuspended}
                                      onClick={() => void handleSetWorkshopStatus(workshop.id, "suspended")}
                                      className="rounded-lg border border-amber-500/50 px-2 py-1 text-xs font-semibold disabled:opacity-50"
                                    >
                                      Zawieś
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingWorkshopId === workshop.id || isActive}
                                      onClick={() => void handleSetWorkshopStatus(workshop.id, "active")}
                                      className="rounded-lg border border-emerald-500/50 px-2 py-1 text-xs font-semibold disabled:opacity-50"
                                    >
                                      Aktywuj
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        savingResendWorkshopId === workshop.id ||
                                        !(workshop.owner_id ?? workshop.owner_user_id)
                                      }
                                      title={
                                        workshop.owner_id || workshop.owner_user_id
                                          ? "Wyślij ponownie e-mail resetu hasła do właściciela"
                                          : "Brak przypisanego właściciela"
                                      }
                                      onClick={() => void handleResendWorkshopAccess(workshop.id)}
                                      className="rounded-lg border border-sky-500/50 px-2 py-1 text-xs font-semibold disabled:opacity-50"
                                    >
                                      {savingResendWorkshopId === workshop.id ? "…" : "Dostęp"}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            ) : null}

            {activeTab === "Mapa ServyGo" ? (
              <section className={`rounded-2xl border p-5 lg:p-6 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                {workshopsError && !loadingWorkshops ? (
                  <div className="mb-3 flex flex-col gap-2 rounded-xl border border-orange-400/50 bg-orange-500/10 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <p className={`text-sm ${isDark ? "text-orange-100" : "text-orange-950"}`}>{workshopsError}</p>
                    <button
                      type="button"
                      onClick={() => void refreshWorkshops()}
                      className={`shrink-0 text-xs font-semibold underline ${isDark ? "text-orange-200" : "text-orange-900"}`}
                    >
                      Spróbuj ponownie
                    </button>
                  </div>
                ) : null}
                {loadingWorkshops ? (
                  <p className="text-sm">Ładowanie warsztatów…</p>
                ) : (
                  <AdminServyGoMapSection
                    workshops={adminWorkshops}
                    isDark={isDark}
                    userId={currentUser.id}
                    userEmail={currentUser.email ?? null}
                    onRefreshWorkshops={refreshWorkshops}
                    onEditWorkshop={(id) => {
                      setWorkshopViewId(null);
                      setWorkshopEditId(id);
                    }}
                    onNotify={(msg, isError) => {
                      if (isError) {
                        setWorkshopsError(msg);
                        setSuccessMessage("");
                      } else {
                        setWorkshopsError("");
                        setSuccessMessage(msg);
                      }
                    }}
                  />
                )}
              </section>
            ) : null}

            {activeTab === "Użytkownicy" ? (
              <section className={`rounded-2xl border p-5 lg:p-6 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                <h2 className="text-lg font-semibold">Użytkownicy</h2>
                <div className="mt-3 min-w-0 overflow-x-auto">
                  <table className="w-full min-w-0 table-auto text-sm">
                    <thead className={isDark ? "text-zinc-300" : "text-zinc-600"}>
                      <tr>
                        <th className="px-3 py-2.5 text-left lg:px-4 lg:py-3">Email</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Rola</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Data rejestracji</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Liczba rezerwacji</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Status</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersOverview.map((user) => (
                        <tr key={user.email} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
                          <td className="px-3 py-2.5 lg:px-4 lg:py-3">{user.email}</td>
                          <td className="px-3 py-2.5 lg:px-4 lg:py-3">{user.role}</td>
                          <td className="px-3 py-2.5 lg:px-4 lg:py-3">{user.registeredAt}</td>
                          <td className="px-3 py-2.5 lg:px-4 lg:py-3">{user.bookings}</td>
                          <td className="px-3 py-2.5 lg:px-4 lg:py-3">{user.status}</td>
                          <td className="px-3 py-2.5 lg:px-4 lg:py-3"><button type="button" className="rounded-lg border px-2 py-1 text-xs">Zobacz</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {activeTab === "Opinie / Google Maps" ? (
              <>
                <section className={`rounded-2xl border p-5 lg:p-6 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                  <h2 className="text-lg font-semibold">Opinie / Google Maps</h2>
                  <div className="mt-3 min-w-0 overflow-x-auto">
                    <table className="w-full min-w-0 table-auto text-sm">
                      <thead className={isDark ? "text-zinc-300" : "text-zinc-600"}>
                        <tr>
                          <th className="px-3 py-2.5 text-left lg:px-4 lg:py-3">Warsztat</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Śr. ocena</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Liczba opinii</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Google Maps</th>
                          <th className="px-3 py-2.5 text-left lg:px-4 lg:py-3">googlePlaceId</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Liczba zdjęć</th>
                          <th className="whitespace-nowrap px-3 py-2.5 text-left lg:px-4 lg:py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewsOverview.map((item) => (
                          <tr key={item.workshop} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
                            <td className="px-3 py-2.5 lg:px-4 lg:py-3">{item.workshop}</td>
                            <td className="px-3 py-2.5 lg:px-4 lg:py-3">{item.rating ? item.rating.toFixed(1) : "—"}</td>
                            <td className="px-3 py-2.5 lg:px-4 lg:py-3">{item.reviewCount}</td>
                            <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                              {item.mapsUrl === "-" ? "—" : <a href={item.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Otwórz</a>}
                            </td>
                            <td className="px-3 py-2.5 lg:px-4 lg:py-3">{item.googlePlaceId}</td>
                            <td className="px-3 py-2.5 lg:px-4 lg:py-3">{item.photosCount}</td>
                            <td className="px-3 py-2.5 lg:px-4 lg:py-3">{item.connectionStatus}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={`mt-6 rounded-2xl border p-5 lg:p-6 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">Moderacja opinii ServyGo</h3>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={servygoModerationFilter}
                        onChange={(e) => setServygoModerationFilter(e.target.value as "all" | ServygoReviewStatus)}
                        className={`rounded-lg border px-2 py-2 text-xs ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
                      >
                        <option value="all">Wszystkie statusy</option>
                        <option value="pending">pending</option>
                        <option value="published">published</option>
                        <option value="hidden">hidden</option>
                        <option value="reported">reported</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void refreshServygoModeration()}
                        disabled={servygoModerationLoading}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                      >
                        Odśwież
                      </button>
                    </div>
                  </div>
                  {servygoModerationLoading ? <p className="mt-3 text-sm">Ładowanie…</p> : null}
                  {!servygoModerationLoading ? (
                    <div className="mt-4 min-w-0 overflow-x-auto">
                      <table className="w-full min-w-[920px] text-sm">
                        <thead className={isDark ? "text-zinc-400" : "text-zinc-600"}>
                          <tr>
                            <th className="px-2 py-2 text-left">Data</th>
                            <th className="px-2 py-2 text-left">Warsztat</th>
                            <th className="px-2 py-2 text-left">Podpis</th>
                            <th className="px-2 py-2 text-left">Ocena</th>
                            <th className="px-2 py-2 text-left">Status</th>
                            <th className="px-2 py-2 text-left">Treść</th>
                          </tr>
                        </thead>
                        <tbody>
                          {servygoModerationRows
                            .filter((r) => servygoModerationFilter === "all" || r.status === servygoModerationFilter)
                            .map((r) => (
                              <tr key={r.id} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
                                <td className="whitespace-nowrap px-2 py-2 align-top">{formatDate(r.created_at)}</td>
                                <td className="max-w-[120px] truncate px-2 py-2 align-top font-mono text-xs" title={r.workshop_id}>
                                  {r.workshop_id.slice(0, 8)}…
                                </td>
                                <td className="px-2 py-2 align-top">{r.display_name_snapshot}</td>
                                <td className="px-2 py-2 align-top">{r.rating}</td>
                                <td className="px-2 py-2 align-top">
                                  <select
                                    value={r.status}
                                    onChange={(e) => {
                                      const next = e.target.value as ServygoReviewStatus;
                                      void (async () => {
                                        try {
                                          await updateServygoReviewStatusAdmin(r.id, next);
                                          await refreshServygoModeration();
                                        } catch {
                                          /* ignore */
                                        }
                                      })();
                                    }}
                                    className={`rounded-lg border px-2 py-1 text-xs ${isDark ? "border-zinc-600 bg-zinc-950" : "border-zinc-300 bg-white"}`}
                                  >
                                    <option value="pending">pending</option>
                                    <option value="published">published</option>
                                    <option value="hidden">hidden</option>
                                    <option value="reported">reported</option>
                                  </select>
                                </td>
                                <td className="max-w-[360px] px-2 py-2 align-top text-xs whitespace-pre-wrap">{r.comment}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}

            {activeTab === "Rezerwacje" ? (
              <section className={`rounded-2xl border p-5 lg:p-6 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Rezerwacje</h2>
                  <button
                    type="button"
                    onClick={() => void refreshAdminBookings()}
                    disabled={adminBookingsLoading}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                  >
                    {adminBookingsLoading ? "Ładowanie…" : "Odśwież"}
                  </button>
                </div>
                {adminBookingsError ? (
                  <p className={`mt-3 text-sm ${isDark ? "text-orange-200" : "text-orange-800"}`}>{adminBookingsError}</p>
                ) : null}
                <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  Podstawowa lista z polem rozliczenia leada (MVP). Szczegóły warsztatu — w podglądzie warsztatu.
                </p>
                <div className="mt-4 min-w-0 overflow-x-auto">
                  <table className="w-full min-w-[920px] table-auto text-sm">
                    <thead className={isDark ? "text-zinc-300" : "text-zinc-600"}>
                      <tr>
                        <th className="px-3 py-2 text-left">Utworzono</th>
                        <th className="px-3 py-2 text-left">Warsztat</th>
                        <th className="px-3 py-2 text-left">Usługa</th>
                        <th className="px-3 py-2 text-left">Termin</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Rozliczenie leada</th>
                        <th className="px-3 py-2 text-left">Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminBookingsRows.length === 0 && !adminBookingsLoading ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                            Brak rezerwacji lub brak dostępu do widoku.
                          </td>
                        </tr>
                      ) : (
                        adminBookingsRows.map((b) => (
                          <tr key={b.id} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
                            <td className="whitespace-nowrap px-3 py-2">{b.created_at?.slice(0, 19)?.replace("T", " ") ?? "—"}</td>
                            <td className="max-w-[160px] truncate px-3 py-2" title={b.workshop_name}>
                              {b.workshop_name}
                            </td>
                            <td className="max-w-[200px] truncate px-3 py-2">{b.service_name}</td>
                            <td className="whitespace-nowrap px-3 py-2">
                              {(b.booking_date ?? "").trim() || "—"}
                              {b.time ? ` · ${b.time}` : ""}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{b.status}</td>
                            <td className="max-w-[280px] px-3 py-2 text-xs leading-snug">
                              <span className="font-semibold">{b.settlement_status ?? "—"}</span>
                              <span className={`${isDark ? "text-zinc-400" : "text-zinc-600"} block`}>
                                {formatAdminLeadSettlementLine(b)}
                                {b.test_mode === false ? " · produkcja (test_mode off)" : ""}
                              </span>
                              {(b.dispute_reason ?? "").trim() ? (
                                <span className={`mt-1 block whitespace-pre-wrap text-[10px] ${isDark ? "text-rose-200" : "text-rose-800"}`}>
                                  Powód sporu: {b.dispute_reason}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <button
                                type="button"
                                disabled={!b.settlement_status || (b.settlement_status ?? "").toLowerCase() === "disputed"}
                                onClick={() => openDisputeModal(b.id)}
                                className="rounded-lg border border-rose-500/50 px-2 py-1 text-xs font-semibold disabled:opacity-40"
                              >
                                Oznacz jako sporne
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {activeTab === "Rozliczenie leadów MVP" ? (
              <section className={`rounded-2xl border p-5 lg:p-6 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Rozliczenie leadów MVP</h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const csv = leadMetricsToCsv(leadMetricsRows);
                        downloadCsv(`servygo_leady_mvp_${new Date().toISOString().slice(0, 10)}.csv`, csv);
                      }}
                      disabled={leadMetricsRows.length === 0}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                    >
                      Eksport CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => void refreshLeadMetrics()}
                      disabled={leadMetricsLoading}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                    >
                      {leadMetricsLoading ? "Ładowanie…" : "Odśwież"}
                    </button>
                  </div>
                </div>
                <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  Zliczenia wg miesiąca kalendarzowego (rezerwacje po dacie wizyt / utworzenia; leady po dacie zdarzenia rozliczenia). Kwoty szacunkowe — bez faktur.
                </p>
                <div className={`mt-3 rounded-xl border px-4 py-3 text-xs ${isDark ? "border-zinc-700 bg-zinc-950/40 text-zinc-300" : "border-blue-100 bg-blue-50/40 text-zinc-700"}`}>
                  <span className="font-semibold">Wskazówki:</span> wartość testowa = ile leady byłyby warte poza testem; kwota do zapłaty = tylko leady <span className="font-mono">billable</span>.
                </div>
                {leadMetricsError ? (
                  <p className={`mt-3 text-sm ${isDark ? "text-orange-200" : "text-orange-800"}`}>{leadMetricsError}</p>
                ) : null}
                <div className="mt-4 min-w-0 overflow-x-auto">
                  <table className="w-full min-w-[1100px] table-auto text-xs sm:text-sm">
                    <thead className={isDark ? "text-zinc-300" : "text-zinc-600"}>
                      <tr>
                        <th className="px-2 py-2 text-left">Warsztat</th>
                        <th className="px-2 py-2 text-left">Miesiąc</th>
                        <th className="px-2 py-2 text-right">Rezerw.</th>
                        <th className="px-2 py-2 text-right">Potw.</th>
                        <th className="px-2 py-2 text-right">Zakończ.</th>
                        <th className="px-2 py-2 text-right">No-show</th>
                        <th className="px-2 py-2 text-right">Anul.</th>
                        <th className="px-2 py-2 text-right">Ledy test.</th>
                        <th className="px-2 py-2 text-right">Ledy płat.</th>
                        <th className="px-2 py-2 text-right">Spory</th>
                        <th className="px-2 py-2 text-right">Niepłatne</th>
                        <th className="px-2 py-2 text-right">Wart. test PLN</th>
                        <th className="px-2 py-2 text-right">Do zapłaty PLN</th>
                        <th className="px-2 py-2 text-left">Test warsztatu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadMetricsRows.length === 0 && !leadMetricsLoading ? (
                        <tr>
                          <td colSpan={14} className="px-3 py-8 text-center text-zinc-500">
                            Brak danych (uruchom migrację SQL lub odśwież po czasie).
                          </td>
                        </tr>
                      ) : (
                        leadMetricsRows.map((r) => (
                          <tr key={`${r.workshop_id}-${r.month}`} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
                            <td className="max-w-[180px] truncate px-2 py-2 font-medium" title={r.workshop_id}>
                              {r.workshop_name?.trim() || r.workshop_id.slice(0, 8) + "…"}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2">{formatMetricMonth(r.month)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{r.total_bookings}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{r.confirmed_bookings}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{r.completed_bookings}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{r.no_show_bookings}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{r.cancelled_bookings}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{r.waived_test_leads}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{r.billable_leads}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{r.disputed_leads}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{r.not_billable_leads}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{r.test_value_pln.toFixed(2)}</td>
                            <td className="px-2 py-2 text-right tabular-nums font-semibold">{r.estimated_amount_pln.toFixed(2)}</td>
                            <td className="px-2 py-2 align-top">
                              {(() => {
                                const ws = adminWorkshops.find((w) => w.id === r.workshop_id);
                                const inTest = ws?.lead_test_mode !== false;
                                const fee = ws?.lead_fee_amount != null ? Number(ws.lead_fee_amount).toFixed(2) : "5.00";
                                return (
                                  <div className="min-w-[170px]">
                                    <div className={`text-xs font-semibold ${inTest ? (isDark ? "text-sky-200" : "text-sky-900") : (isDark ? "text-emerald-200" : "text-emerald-900")}`}>
                                      {inTest ? "test aktywny" : "test zakończony"}
                                    </div>
                                    <div className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Stawka: {fee} PLN</div>
                                    {inTest ? (
                                      <button
                                        type="button"
                                        disabled={leadSettingsBusyWorkshopId === r.workshop_id}
                                        onClick={() => void endWorkshopLeadTest(r.workshop_id)}
                                        className="mt-1 rounded-lg border border-orange-500/50 px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                                      >
                                        {leadSettingsBusyWorkshopId === r.workshop_id ? "…" : "Zakończ okres testowy"}
                                      </button>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {(activeTab === "Usługi i ceny" || activeTab === "Statystyki strony" || activeTab === "Ustawienia") ? (
              <section className={`rounded-2xl border p-5 lg:p-6 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                <h2 className="text-lg font-semibold">{activeTab}</h2>
                <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  Sekcja gotowa pod podpięcie danych z Supabase i/lub analytics_events.
                </p>
              </section>
            ) : null}
          </section>
        </div>

        {detailLead ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <button
              type="button"
              className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[2px]"
              aria-label="Zamknij podgląd"
              onClick={() => setLeadDetailId(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="lead-detail-title"
              className={`relative z-[1] max-h-[min(92vh,900px)] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-b-0 p-5 shadow-2xl sm:rounded-2xl sm:border-b sm:p-6 ${
                isDark ? "border-blue-500/35 bg-zinc-900" : "border-blue-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                    Zgłoszenie warsztatu
                  </p>
                  <h2 id="lead-detail-title" className="mt-1 break-words text-xl font-bold sm:text-2xl">
                    {detailLead.workshop_name}
                  </h2>
                  <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    <span className={`font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Status:</span>{" "}
                    {formatWorkshopLeadStatusLabel(detailLead.status)}
                    <span className={`mx-2 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>·</span>
                    <span className={`font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Zgłoszono:</span>{" "}
                    {formatDate(detailLead.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLeadDetailId(null)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    isDark ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "border-zinc-300 text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  Zamknij
                </button>
              </div>

              <div className="mt-5">
                <a
                  href={mapsUrlForLead(detailLead)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    isDark
                      ? "border-blue-500/40 bg-blue-950/40 text-blue-200 hover:border-orange-400/60"
                      : "border-blue-200 bg-blue-50/90 text-blue-800 hover:border-orange-300"
                  }`}
                >
                  Otwórz w Google Maps
                </a>
                <p className={`mt-2 text-xs ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>
                  {detailLead.google_maps_url?.trim()
                    ? "Link podany w zgłoszeniu."
                    : "Jeśli nie podano linku, wyszukujemy lokalizację po nazwie, adresie i mieście zgłoszenia."}
                </p>
              </div>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className={`rounded-xl border p-3 sm:col-span-2 ${isDark ? "border-zinc-700 bg-zinc-950/40" : "border-blue-100 bg-slate-50/90"}`}>
                  <dt className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Adres</dt>
                  <dd className={`mt-1 text-sm leading-relaxed ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                    {formatAddressBlock(detailLead)}
                  </dd>
                </div>
                <div className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-950/40" : "border-blue-100 bg-slate-50/90"}`}>
                  <dt className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Miasto</dt>
                  <dd className={`mt-1 text-sm ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{detailLead.city?.trim() || "—"}</dd>
                </div>
                <div className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-950/40" : "border-blue-100 bg-slate-50/90"}`}>
                  <dt className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Telefon</dt>
                  <dd className={`mt-1 text-sm ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{detailLead.phone?.trim() || "—"}</dd>
                </div>
                <div className={`rounded-xl border p-3 sm:col-span-2 ${isDark ? "border-zinc-700 bg-zinc-950/40" : "border-blue-100 bg-slate-50/90"}`}>
                  <dt className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>E-mail</dt>
                  <dd className={`mt-1 break-all text-sm ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{detailLead.email?.trim() || "—"}</dd>
                </div>
                <div className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-950/40" : "border-blue-100 bg-slate-50/90"}`}>
                  <dt className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Osoba kontaktowa</dt>
                  <dd className={`mt-1 text-sm ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{detailLead.contact_person?.trim() || "—"}</dd>
                </div>
                <div className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-950/40" : "border-blue-100 bg-slate-50/90"}`}>
                  <dt className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>NIP</dt>
                  <dd className={`mt-1 text-sm ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{detailLead.nip?.trim() || "—"}</dd>
                </div>
                <div className={`rounded-xl border p-3 sm:col-span-2 ${isDark ? "border-zinc-700 bg-zinc-950/40" : "border-blue-100 bg-slate-50/90"}`}>
                  <dt className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Opis warsztatu</dt>
                  <dd className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                    {detailLead.description?.trim() || "—"}
                  </dd>
                </div>
                <div className={`rounded-xl border p-3 sm:col-span-2 ${isDark ? "border-zinc-700 bg-zinc-950/40" : "border-blue-100 bg-slate-50/90"}`}>
                  <dt className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Wiadomość / uwagi</dt>
                  <dd className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                    {detailLead.message?.trim() || "—"}
                  </dd>
                </div>
                <div className={`rounded-xl border p-3 sm:col-span-2 ${isDark ? "border-zinc-700 bg-zinc-950/40" : "border-blue-100 bg-slate-50/90"}`}>
                  <dt className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Usługi (zgłoszenie)</dt>
                  <dd className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                    {detailLead.services?.trim() || "—"}
                  </dd>
                </div>
              </dl>

              <div
                className={`mt-6 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                  isDark ? "border-amber-500/30 bg-amber-500/10 text-amber-100/90" : "border-amber-200 bg-amber-50 text-amber-950/90"
                }`}
              >
                <strong>Akceptacja</strong> tworzy warsztat w <code className="mx-0.5 rounded bg-black/10 px-1">workshops</code>, przypisuje właściciela
                (konto Supabase Auth) i wysyła e-mail z linkiem do ustawienia hasła — bez ujawniania hasła w wiadomości.{" "}
                <strong>Odrzucenie</strong> ustawia status na odrzucony. <strong>Archiwizacja</strong> ustawia status{" "}
                <code className="mx-0.5 rounded bg-black/10 px-1">archived</code> bez usuwania rekordu.
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={() => setLeadDetailId(null)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${isDark ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "border-zinc-300 hover:bg-zinc-50"}`}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  disabled={savingId === detailLead.id || normalizeWorkshopStatus(detailLead.status) === "archived"}
                  onClick={() => void archiveLead(detailLead.id, { closeModal: true })}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isDark ? "border-zinc-500 text-zinc-200 hover:bg-zinc-800" : "border-zinc-400 text-zinc-800 hover:bg-zinc-100"
                  }`}
                >
                  Zarchiwizuj
                </button>
                <button
                  type="button"
                  disabled={savingId === detailLead.id || isLeadModerationClosed(detailLead.status)}
                  onClick={async () => {
                    const ok = await updateLeadStatus(detailLead.id, "rejected");
                    if (ok) {
                      await refreshLeads();
                      setSuccessMessage("Zgłoszenie odrzucone.");
                      setLeadDetailId(null);
                    }
                  }}
                  className="rounded-xl border border-rose-400/50 bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Odrzuć zgłoszenie
                </button>
                <button
                  type="button"
                  disabled={savingId === detailLead.id || isLeadModerationClosed(detailLead.status)}
                  onClick={() => openApproveModal(detailLead)}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Akceptuj warsztat
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingApproveLead ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <button
              type="button"
              className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[2px]"
              aria-label="Zamknij"
              onClick={closeApproveModal}
            />
            <div
              role="dialog"
              aria-modal="true"
              className={`relative z-[1] w-full max-w-lg rounded-t-2xl border border-b-0 p-5 shadow-2xl sm:rounded-2xl sm:border-b sm:p-6 ${
                isDark ? "border-emerald-500/35 bg-zinc-900" : "border-emerald-200 bg-white"
              }`}
            >
              <h2 className="text-lg font-bold">Akceptacja — konto właściciela</h2>
              <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                Warsztat: <strong>{pendingApproveLead.workshop_name}</strong>. Utworzymy lub użyjemy konta Supabase Auth i wyślemy link do ustawienia hasła
                (zaproszenie lub reset — bez hasła w treści maila).
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${isDark ? "border-zinc-600" : "border-zinc-200"}`}>
                  <input
                    type="radio"
                    name="approve-email-mode"
                    checked={approveEmailMode === "lead"}
                    onChange={() => {
                      setApproveEmailMode("lead");
                      setApproveOwnerEmailInput((pendingApproveLead.email ?? "").trim());
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold">A) E-mail ze zgłoszenia</span>
                    <span className={`mt-1 block text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                      {(pendingApproveLead.email ?? "").trim() || "— (brak w zgłoszeniu — wybierz B)"}
                    </span>
                  </span>
                </label>
                <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${isDark ? "border-zinc-600" : "border-zinc-200"}`}>
                  <input
                    type="radio"
                    name="approve-email-mode"
                    checked={approveEmailMode === "custom"}
                    onChange={() => setApproveEmailMode("custom")}
                    className="mt-1"
                  />
                  <span className="font-semibold">B) Inny e-mail (logowanie właściciela)</span>
                </label>
                {approveEmailMode === "custom" ? (
                  <input
                    type="email"
                    value={approveOwnerEmailInput}
                    onChange={(e) => setApproveOwnerEmailInput(e.target.value)}
                    placeholder="np. biuro@warsztat.pl"
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                ) : null}
              </div>
              {leadsError ? (
                <p className={`mt-3 text-sm ${isDark ? "text-orange-200" : "text-orange-800"}`}>{leadsError}</p>
              ) : null}
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeApproveModal}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  disabled={
                    savingId === pendingApproveLead.id ||
                    (approveEmailMode === "lead" && !(pendingApproveLead.email ?? "").trim())
                  }
                  onClick={() => void submitApproveLead()}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingId === pendingApproveLead.id ? "Przetwarzanie…" : "Akceptuj i wyślij dostęp"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {workshopViewId ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <button
              type="button"
              className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[2px]"
              aria-label="Zamknij"
              onClick={closeWorkshopPanel}
            />
            <div
              role="dialog"
              aria-modal="true"
              className={`relative z-[1] max-h-[min(92vh,900px)] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-b-0 p-5 shadow-2xl sm:rounded-2xl sm:border-b sm:p-6 ${
                isDark ? "border-blue-500/35 bg-zinc-900" : "border-blue-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                    Warsztat
                  </p>
                  <h2 className="mt-1 text-xl font-bold sm:text-2xl">{workshopPanelDetail?.name ?? "…"}</h2>
                  <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    Status:{" "}
                    <span className={`font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                      {workshopPanelDetail ? formatAdminWorkshopEntityStatusLabel(workshopPanelDetail.status) : "—"}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeWorkshopPanel}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold ${isDark ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "border-zinc-300 hover:bg-zinc-50"}`}
                >
                  Zamknij
                </button>
              </div>
              {workshopPanelError ? (
                <p className={`mt-4 text-sm ${isDark ? "text-orange-200" : "text-orange-800"}`}>{workshopPanelError}</p>
              ) : null}
              {loadingWorkshopPanel ? (
                <p className="mt-6 text-sm">Ładowanie…</p>
              ) : workshopPanelDetail ? (
                <div className="mt-6 space-y-5 text-sm">
                  <div>
                    <h3 className={`text-xs font-semibold uppercase ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Dane podstawowe</h3>
                    <dl className={`mt-2 grid gap-2 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                      <div>
                        <dt className="text-xs text-zinc-500">Miasto</dt>
                        <dd>{workshopPanelDetail.city ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-zinc-500">Adres</dt>
                        <dd>{workshopPanelDetail.address ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-zinc-500">Telefon</dt>
                        <dd>{workshopPanelDetail.phone ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-zinc-500">E-mail</dt>
                        <dd className="break-all">{workshopPanelDetail.email ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-zinc-500">NIP</dt>
                        <dd>{workshopPanelDetail.nip ?? "—"}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h3 className={`text-xs font-semibold uppercase ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Opis</h3>
                    <p className={`mt-2 whitespace-pre-wrap ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                      {workshopPanelDetail.description?.trim() || "—"}
                    </p>
                  </div>
                  <div>
                    <h3 className={`text-xs font-semibold uppercase ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Google Maps</h3>
                    {(workshopPanelDetail.google_maps_url ?? "").trim() ? (
                      <a
                        href={(workshopPanelDetail.google_maps_url ?? "").trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex text-blue-500 underline"
                      >
                        Otwórz w Google Maps
                      </a>
                    ) : (
                      <p className={`mt-2 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>—</p>
                    )}
                  </div>
                  <div>
                    <h3 className={`text-xs font-semibold uppercase ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Usługi</h3>
                    <ul className={`mt-2 list-inside list-disc ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                      {workshopPanelDetail.services.length === 0 ? (
                        <li>Brak zapisanych usług</li>
                      ) : (
                        workshopPanelDetail.services.map((s) => <li key={s.id}>{s.service_name}</li>)
                      )}
                    </ul>
                  </div>
                  <div>
                    <h3 className={`text-xs font-semibold uppercase ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Godziny pracy</h3>
                    <p className={`mt-2 whitespace-pre-wrap ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                      {workshopPanelDetail.opening_hours?.trim() || "—"}
                    </p>
                  </div>
                  <div>
                    <h3 className={`text-xs font-semibold uppercase ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Rezerwacje</h3>
                    {workshopPanelDetail.bookings.length === 0 ? (
                      <p className={`mt-2 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Brak rezerwacji.</p>
                    ) : (
                      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-600/30">
                        <table className="w-full text-xs">
                          <thead className={isDark ? "bg-zinc-800" : "bg-zinc-100"}>
                            <tr>
                              <th className="px-2 py-1.5 text-left">Data</th>
                              <th className="px-2 py-1.5 text-left">Godz.</th>
                              <th className="px-2 py-1.5 text-left">Usługa</th>
                              <th className="px-2 py-1.5 text-left">Status</th>
                              <th className="px-2 py-1.5 text-left">Lead</th>
                            </tr>
                          </thead>
                          <tbody>
                            {workshopPanelDetail.bookings.map((b) => (
                              <tr key={b.id} className="border-t border-zinc-700/50">
                                <td className="px-2 py-1.5">{b.date}</td>
                                <td className="px-2 py-1.5">{b.time}</td>
                                <td className="px-2 py-1.5">{b.service_name}</td>
                                <td className="px-2 py-1.5 font-mono">{b.status}</td>
                                <td className="max-w-[200px] px-2 py-1.5 align-top leading-snug">
                                  <span className="font-semibold">{b.settlement_status ?? "—"}</span>
                                  <span className={`block ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                                    {formatAdminLeadSettlementLine({
                                      settlement_status: b.settlement_status ?? null,
                                      lead_fee_amount: b.lead_fee_amount ?? null,
                                      test_mode: b.test_mode ?? null,
                                    })}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {workshopEditId ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <button
              type="button"
              className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[2px]"
              aria-label="Zamknij"
              onClick={closeWorkshopPanel}
            />
            <div
              role="dialog"
              aria-modal="true"
              className={`relative z-[1] max-h-[min(92vh,900px)] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-b-0 p-5 shadow-2xl sm:rounded-2xl sm:border-b sm:p-6 ${
                isDark ? "border-blue-500/35 bg-zinc-900" : "border-blue-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-xl font-bold">Edycja warsztatu</h2>
                <button
                  type="button"
                  onClick={closeWorkshopPanel}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold ${isDark ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "border-zinc-300 hover:bg-zinc-50"}`}
                >
                  Zamknij
                </button>
              </div>
              {workshopPanelError ? (
                <p className={`mt-4 text-sm ${isDark ? "text-orange-200" : "text-orange-800"}`}>{workshopPanelError}</p>
              ) : null}
              {loadingWorkshopPanel || !editDraft ? (
                <p className="mt-6 text-sm">Ładowanie formularza…</p>
              ) : (
                <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium">Nazwa</span>
                  <input
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">Miasto</span>
                  <input
                    value={editDraft.city}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, city: e.target.value } : d))}
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium">Adres</span>
                  <input
                    value={editDraft.address}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, address: e.target.value } : d))}
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">Telefon</span>
                  <input
                    value={editDraft.phone}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, phone: e.target.value } : d))}
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">E-mail</span>
                  <input
                    type="email"
                    value={editDraft.email}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, email: e.target.value } : d))}
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium">Opis</span>
                  <textarea
                    value={editDraft.description}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                    rows={3}
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium">Usługi (jedna na linię)</span>
                  <textarea
                    value={editDraft.servicesText}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, servicesText: e.target.value } : d))}
                    rows={5}
                    className={`rounded-lg border px-3 py-2 font-mono text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium">Link Google Maps</span>
                  <input
                    value={editDraft.google_maps_url}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, google_maps_url: e.target.value } : d))}
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium">Google Place ID (opcjonalnie)</span>
                  <input
                    value={editDraft.google_place_id}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, google_place_id: e.target.value } : d))}
                    placeholder="np. ChIJ..."
                    className={`rounded-lg border px-3 py-2 font-mono text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <div className="sm:col-span-2">
                  <p className={`text-xs font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Mapa ServyGo (OpenStreetMap)</p>
                  <p className={`mt-1 text-[11px] leading-snug ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>
                    Warsztat nie pojawi się na mapie w ofertach, dopóki nie wpiszesz współrzędnych i nie włączysz przełącznika poniżej.
                  </p>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">Szerokość (latitude)</span>
                  <input
                    inputMode="decimal"
                    value={editDraft.latitude}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, latitude: e.target.value } : d))}
                    placeholder="np. 49.8225"
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">Długość (longitude)</span>
                  <input
                    inputMode="decimal"
                    value={editDraft.longitude}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, longitude: e.target.value } : d))}
                    placeholder="np. 19.0444"
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="inline-flex items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={editDraft.show_on_map}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, show_on_map: e.target.checked } : d))}
                      className="h-4 w-4 rounded border-zinc-400"
                    />
                    Pokaż na mapie ServyGo (/oferty)
                  </span>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">Slug (opcjonalnie)</span>
                  <input
                    value={editDraft.slug}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, slug: e.target.value } : d))}
                    placeholder="np. fix-auto-bielsko"
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">Ocena (0–5)</span>
                  <input
                    inputMode="decimal"
                    value={editDraft.rating}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, rating: e.target.value } : d))}
                    placeholder="np. 4.8"
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">Liczba opinii</span>
                  <input
                    inputMode="numeric"
                    value={editDraft.reviews_count}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, reviews_count: e.target.value } : d))}
                    placeholder="np. 120"
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium">Godziny pracy</span>
                  <textarea
                    value={editDraft.opening_hours}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, opening_hours: e.target.value } : d))}
                    rows={3}
                    placeholder="np. Pn–Pt 8:00–17:00"
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium">Status</span>
                  <select
                    value={editDraft.status}
                    onChange={(e) =>
                      setEditDraft((d) =>
                        d ? { ...d, status: e.target.value as AdminWorkshopEntityStatus } : d,
                      )
                    }
                    className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"}`}
                  >
                    <option value="active">active (publiczny)</option>
                    <option value="suspended">suspended (zawieszony)</option>
                    <option value="hidden">hidden (ukryty)</option>
                  </select>
                </label>
              </div>
              {workshopEditId ? (
                <WorkshopPhotosManager workshopId={workshopEditId} uploadedByRole="admin" isDark={isDark} />
              ) : null}
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeWorkshopPanel}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  disabled={savingWorkshopId === workshopEditId}
                  onClick={() => void handleSaveWorkshopEdit()}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingWorkshopId === workshopEditId ? "Zapisywanie…" : "Zapisz"}
                </button>
              </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {disputeModalBookingId ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <button
              type="button"
              className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[2px]"
              aria-label="Zamknij"
              onClick={closeDisputeModal}
            />
            <div
              role="dialog"
              aria-modal="true"
              className={`relative z-[1] w-full max-w-lg rounded-t-2xl border border-b-0 p-5 shadow-2xl sm:rounded-2xl sm:border-b sm:p-6 ${
                isDark ? "border-rose-500/35 bg-zinc-900" : "border-rose-200 bg-white"
              }`}
            >
              <h2 className="text-lg font-bold">Oznacz lead jako sporny</h2>
              <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                Podaj powód sporu. Warsztat zobaczy status <span className="font-mono">disputed</span> i komunikat.
              </p>
              <textarea
                rows={4}
                value={disputeModalReason}
                onChange={(e) => setDisputeModalReason(e.target.value)}
                placeholder="Np. klient twierdzi, że anulował poza systemem / dane błędne / usługa się nie odbyła…"
                className={`mt-4 w-full resize-y rounded-xl border px-3 py-2 text-sm ${
                  isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300"
                }`}
              />
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDisputeModal}
                  disabled={disputeBusy}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDisputeModal()}
                  disabled={disputeBusy || !disputeModalReason.trim()}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {disputeBusy ? "Zapisywanie…" : "Oznacz spór"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </ServyGoPageShell>
  );
}
