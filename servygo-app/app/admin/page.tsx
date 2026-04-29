"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import {
  type AdminSidebarNotificationCounts,
  type AdminWorkshopDetail,
  type AdminWorkshopEntityStatus,
  type AdminWorkshopListRow,
  type AdminWorkshopUpdatePayload,
  AdminWorkshopStatus,
  WorkshopLeadRow,
  approveWorkshopLeadWithOwnerEmail,
  bootstrapFirstAdmin,
  formatAdminWorkshopEntityStatusLabel,
  formatWorkshopLeadStatusLabel,
  getAdminSidebarNotificationCounts,
  getAdminRecord,
  getWorkshopDetailForAdmin,
  listWorkshopLeadsForAdmin,
  listWorkshopsForAdmin,
  normalizeWorkshopStatus,
  replaceWorkshopServicesAsAdmin,
  resendWorkshopOwnerAccessEmail,
  seedTestWorkshopLeadAsAdmin,
  setWorkshopStatusAsAdmin,
  updateWorkshopAsAdmin,
  updateWorkshopLeadStatusAsAdmin,
} from "@/lib/adminApi";
import { isValidWorkshopGoogleMapsUrl } from "@/lib/workshopApi";

const SIDEBAR_ITEMS = [
  "Dashboard",
  "Zgłoszenia warsztatów",
  "Warsztaty",
  "Rezerwacje",
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
  "Zgłoszenia warsztatów": 0,
  Warsztaty: 0,
  Rezerwacje: 0,
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
  city: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  google_maps_url: string;
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
  const [showNotifications, setShowNotifications] = useState(false);

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

  const refreshSidebarBadges = useCallback(async () => {
    if (!currentUser) return;
    try {
      const counts: AdminSidebarNotificationCounts = await getAdminSidebarNotificationCounts(currentUser.id, currentUser.email);
      setLiveSidebarBadges((prev) => ({
        ...prev,
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

  useEffect(() => {
    if (!workshopEditId || !workshopPanelDetail || workshopPanelDetail.id !== workshopEditId) {
      if (!workshopEditId) setEditDraft(null);
      return;
    }
    setEditDraft({
      name: workshopPanelDetail.name,
      city: workshopPanelDetail.city ?? "",
      address: workshopPanelDetail.address ?? "",
      phone: workshopPanelDetail.phone ?? "",
      email: workshopPanelDetail.email ?? "",
      description: workshopPanelDetail.description ?? "",
      google_maps_url: workshopPanelDetail.google_maps_url ?? "",
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
        try {
          adminRecord = await bootstrapFirstAdmin();
        } catch {
          // Ignore bootstrap error, we will still deny access.
        }
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
      await refreshWorkshops();
      await refreshLeads();
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
    const ok = await updateLeadStatus(id, "rejected");
    if (ok) {
      await refreshLeads();
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
    if (!maps || !isValidWorkshopGoogleMapsUrl(maps)) {
      setWorkshopPanelError("Podaj poprawny link do Google Maps swojego warsztatu.");
      return;
    }
    setSavingWorkshopId(workshopEditId);
    setWorkshopPanelError("");
    try {
      const payload: AdminWorkshopUpdatePayload = {
        name: editDraft.name,
        city: editDraft.city || null,
        address: editDraft.address || null,
        phone: editDraft.phone || null,
        email: editDraft.email || null,
        description: editDraft.description || null,
        google_maps_url: maps,
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

  const isDark = mounted ? theme === "dark" : false;
  const pendingLeads = rows.filter((row) => normalizeWorkshopStatus(row.status) === "pending");
  const unreadSidebarBadges = useMemo<SidebarBadgeState>(() => {
    const next = { ...EMPTY_SIDEBAR_BADGES };
    for (const item of SIDEBAR_ITEMS) {
      const unseen = (liveSidebarBadges[item] ?? 0) - (seenSidebarBadges[item] ?? 0);
      next[item] = unseen > 0 ? unseen : 0;
    }
    return next;
  }, [liveSidebarBadges, seenSidebarBadges]);
  const totalUnreadCount = useMemo(
    () => Object.values(unreadSidebarBadges).reduce((sum, n) => sum + n, 0),
    [unreadSidebarBadges],
  );
  const dashboardStats = useMemo(
    () => [
      { label: "Liczba użytkowników", value: "1 284", tone: "from-blue-600 to-blue-400", icon: "👥" },
      { label: "Aktywne warsztaty", value: "142", tone: "from-cyan-600 to-blue-500", icon: "🛠️" },
      { label: "Oczekujące zgłoszenia", value: String(pendingLeads.length), tone: "from-orange-500 to-amber-400", icon: "📥" },
      { label: "Rezerwacje dzisiaj", value: "63", tone: "from-violet-600 to-blue-500", icon: "📅" },
      { label: "Rezerwacje w miesiącu", value: "1 092", tone: "from-blue-700 to-indigo-500", icon: "📈" },
      { label: "Średnia ocena warsztatów", value: "4.7", tone: "from-orange-500 to-pink-500", icon: "⭐" },
      { label: "Kliknięcia „Umów termin”", value: "3 410", tone: "from-sky-600 to-cyan-400", icon: "🖱️" },
      { label: "Wejścia na stronę", value: "24 590", tone: "from-blue-500 to-orange-400", icon: "🌐" },
    ],
    [pendingLeads.length],
  );
  const analyticsSnapshot = {
    visits: 24590,
    uniques: 13240,
    searches: 7160,
    workshopClicks: 3984,
    bookClicks: 3410,
    topCity: "Kraków",
    topService: "Wymiana oleju",
    visits7d: [1800, 2250, 2400, 2100, 2800, 3150, 3320],
    bookings7d: [74, 88, 96, 84, 109, 118, 124],
    conversion7d: [4.1, 3.9, 4.0, 4.0, 3.9, 3.7, 3.8],
  };
  const recentBookings = [
    { date: "2026-04-27", client: "Jan Kowalski", workshop: "AutoSerwis Beskid Premium", service: "Wymiana oleju", car: "Fiat Croma 1.9 Diesel", term: "2026-04-29 10:30", status: "nowe" },
    { date: "2026-04-27", client: "Anna Nowak", workshop: "Moto Klinik Lipnik", service: "Diagnostyka komputerowa", car: "VW Golf 1.6 TDI", term: "2026-04-28 14:00", status: "potwierdzone" },
    { date: "2026-04-26", client: "Marek Wiśniewski", workshop: "Serwis Pod Szyndzielnią", service: "Hamulce", car: "Opel Astra 1.7 CDTI", term: "2026-04-30 08:00", status: "anulowane" },
    { date: "2026-04-25", client: "Ewa Krawczyk", workshop: "Beskid Auto Care", service: "Klimatyzacja", car: "Toyota Corolla 1.6", term: "2026-04-28 16:30", status: "zakończone" },
  ];
  const bookingsByStatusMock = [
    { label: "Nowe", count: 186 },
    { label: "Potwierdzone", count: 312 },
    { label: "Anulowane", count: 54 },
    { label: "Zakończone", count: 528 },
  ];
  const popularServicesMock = [
    { label: "Wymiana oleju", count: 412 },
    { label: "Diagnostyka", count: 298 },
    { label: "Hamulce", count: 241 },
    { label: "Klimatyzacja", count: 176 },
  ];
  const popularCitiesMock = [
    { label: "Bielsko-Biała", count: 892 },
    { label: "Kraków", count: 654 },
    { label: "Katowice", count: 521 },
    { label: "Tychy", count: 387 },
  ];
  const conversionFunnelMock = [
    { label: "Wejścia na stronę", value: 24590 },
    { label: "Wyszukiwania", value: 7160 },
    { label: "Kliknięcia warsztatów", value: 3984 },
    { label: "Rezerwacje", value: 412 },
  ];
  const maxBookingStatusCount = Math.max(...bookingsByStatusMock.map((b) => b.count), 1);
  const maxPopularServiceCount = Math.max(...popularServicesMock.map((b) => b.count), 1);
  const maxPopularCityCount = Math.max(...popularCitiesMock.map((b) => b.count), 1);
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
        <main className={`min-h-screen w-full max-w-none px-6 py-10 sm:px-8 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
          <div className="mx-auto w-full max-w-none">
            <p className={isDark ? "text-zinc-300" : "text-zinc-700"}>Sprawdzanie uprawnień administratora...</p>
          </div>
        </main>
      </ServyGoPageShell>
    );
  }

  if (!currentUser) {
    return (
      <ServyGoPageShell isDark={isDark}>
        <main className={`min-h-screen px-4 py-10 sm:px-6 md:px-10 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
          <div className="mx-auto w-full max-w-4xl rounded-2xl border border-orange-400/30 bg-orange-500/10 p-6">
            <h1 className="text-2xl font-bold">Panel administratora</h1>
            <p className="mt-3">Przekierowanie do logowania...</p>
            <Link href="/?auth=login" className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Przejdź do logowania
            </Link>
          </div>
        </main>
      </ServyGoPageShell>
    );
  }

  if (!isAdmin) {
    return (
      <ServyGoPageShell isDark={isDark}>
        <main className={`min-h-screen px-4 py-10 sm:px-6 md:px-10 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
          <div className="mx-auto w-full max-w-4xl rounded-2xl border border-orange-400/30 bg-orange-500/10 p-6">
            <h1 className="text-2xl font-bold">Panel administratora</h1>
            <p className="mt-3">Brak dostępu.</p>
          </div>
        </main>
      </ServyGoPageShell>
    );
  }

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className={`min-h-screen w-full max-w-none px-6 py-4 sm:px-8 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
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
                      setShowNotifications(false);
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
                      <span>{item}</span>
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
                      {activeTab === "Dashboard" ? (
                        <span
                          className={`inline-flex max-w-full shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-tight sm:text-xs ${
                            isDark
                              ? "border-amber-500/35 bg-amber-500/10 text-amber-200/90"
                              : "border-amber-400/60 bg-amber-50 text-amber-900/80"
                          }`}
                          title="Liczby i wykresy na tym widoku są przykładowe"
                        >
                          Dane testowe — statystyki zostaną podłączone później
                        </span>
                      ) : null}
                    </div>
                    <p className={`mt-1 text-xs sm:text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                      Zalogowany: <strong>{currentUser.email ?? "brak e-mail"}</strong> {adminRole ? `(${adminRole})` : ""}
                    </p>
                  </div>
                </div>
                <div className="relative flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNotifications((prev) => !prev)}
                    className={`relative inline-flex rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      isDark
                        ? "border-blue-400/50 bg-zinc-900/70 text-zinc-200 hover:border-orange-300"
                        : "border-blue-200 bg-white/80 text-zinc-700 hover:border-orange-300"
                    }`}
                    aria-label="Powiadomienia"
                  >
                    🔔
                    {totalUnreadCount > 0 ? (
                      <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                        {formatBadgeNumber(totalUnreadCount)}
                      </span>
                    ) : null}
                  </button>
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
                  {showNotifications ? (
                    <div
                      className={`absolute right-0 top-12 z-30 w-80 rounded-2xl border p-3 text-xs shadow-xl ${
                        isDark ? "border-zinc-700 bg-zinc-900 text-zinc-200" : "border-blue-200 bg-white text-zinc-700"
                      }`}
                    >
                      <p className="mb-2 text-sm font-semibold">Najnowsze zdarzenia</p>
                      <div className="space-y-1.5">
                        {[
                          { tab: "Zgłoszenia warsztatów" as SidebarItem, label: "Nowe zgłoszenia warsztatów" },
                          { tab: "Rezerwacje" as SidebarItem, label: "Nowe rezerwacje" },
                          { tab: "Użytkownicy" as SidebarItem, label: "Nowi użytkownicy (24h)" },
                          { tab: "Opinie / Google Maps" as SidebarItem, label: "Nowe aktywności Google Maps" },
                        ].map((item) => (
                          <button
                            key={item.tab}
                            type="button"
                            onClick={() => {
                              setActiveTab(item.tab);
                              markTabSeen(item.tab);
                              setShowNotifications(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition ${
                              isDark ? "hover:bg-zinc-800" : "hover:bg-blue-50"
                            }`}
                          >
                            <span>{item.label}</span>
                            {unreadSidebarBadges[item.tab] > 0 ? (
                              <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-950">
                                {formatBadgeNumber(unreadSidebarBadges[item.tab])}
                              </span>
                            ) : (
                              <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>0</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </header>

            {activeTab === "Dashboard" ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4">
                  {dashboardStats.map((stat) => (
                    <article
                      key={stat.label}
                      className={`rounded-2xl border p-4 shadow-sm ${
                        isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"
                      }`}
                    >
                      <div className={`inline-flex rounded-xl bg-gradient-to-r px-2 py-1 text-xs font-semibold text-white ${stat.tone}`}>
                        {stat.icon}
                      </div>
                      <p className={`mt-2 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                    </article>
                  ))}
                </div>

                <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:gap-5">
                  <section
                    className={`shrink-0 rounded-2xl border p-4 xl:w-[min(100%,34%)] xl:max-w-[34%] ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}
                  >
                    <h2 className="text-base font-semibold leading-tight">Statystyki strony</h2>
                    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs leading-snug sm:gap-x-3">
                      <p className="min-w-0">
                        <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Wizyty:</span>{" "}
                        {analyticsSnapshot.visits.toLocaleString("pl-PL")}
                      </p>
                      <p className="min-w-0">
                        <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Unikalni:</span>{" "}
                        {analyticsSnapshot.uniques.toLocaleString("pl-PL")}
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
                      <p className={`col-span-2 min-w-0 truncate text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`} title={`${analyticsSnapshot.topCity} / ${analyticsSnapshot.topService}`}>
                        <span className={`font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Top:</span> {analyticsSnapshot.topCity} / {analyticsSnapshot.topService}
                      </p>
                    </div>
                    <div className={`mt-3 rounded-lg border px-2 py-2 ${isDark ? "border-zinc-600/60 bg-zinc-950/40" : "border-blue-200/80 bg-blue-50/50"}`}>
                      <p className={`mb-2 text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>
                        Wizyty / rezerw. 7 dni
                      </p>
                      <div className="grid h-20 grid-cols-7 items-end gap-1">
                        {analyticsSnapshot.visits7d.map((value, idx) => (
                          <div key={`${value}-${idx}`} className="flex min-h-0 flex-col items-center justify-end gap-0.5">
                            <div
                              className="w-full rounded-sm bg-gradient-to-t from-blue-600 to-orange-400"
                              style={{ height: `${Math.max(6, Math.round((value / maxVisit7d) * 56))}px` }}
                            />
                            <span className="text-[9px] tabular-nums leading-none text-zinc-500">{analyticsSnapshot.bookings7d[idx]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className={`min-w-0 flex-1 rounded-2xl border p-4 sm:p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h2 className="text-lg font-semibold">Ostatnie rezerwacje</h2>
                    <div className="mt-3 w-full min-w-0">
                      <table className="w-full table-fixed border-collapse text-sm">
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
                          {recentBookings.map((booking) => (
                            <tr key={`${booking.client}-${booking.term}`} className={isDark ? "border-t border-zinc-800" : "border-t border-blue-100"}>
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
                                <button type="button" className="rounded-lg border px-2 py-1 text-xs">
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <section className={`rounded-2xl border p-4 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h3 className="text-sm font-semibold">Rezerwacje według statusu</h3>
                    <p className={`mt-1 text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>Dane testowe</p>
                    <ul className="mt-3 space-y-2.5">
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

                  <section className={`rounded-2xl border p-4 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h3 className="text-sm font-semibold">Najpopularniejsze usługi</h3>
                    <p className={`mt-1 text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>Dane testowe</p>
                    <ul className="mt-3 space-y-2.5">
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

                  <section className={`rounded-2xl border p-4 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h3 className="text-sm font-semibold">Najpopularniejsze miasta</h3>
                    <p className={`mt-1 text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>Dane testowe</p>
                    <ul className="mt-3 space-y-2.5">
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

                  <section className={`rounded-2xl border p-4 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
                    <h3 className="text-sm font-semibold">Konwersja (lejek)</h3>
                    <p className={`mt-1 text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>Dane testowe</p>
                    <ul className="mt-3 space-y-2">
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
              </>
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
            ) : null}

            {(activeTab === "Rezerwacje" || activeTab === "Usługi i ceny" || activeTab === "Statystyki strony" || activeTab === "Ustawienia") ? (
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
                            </tr>
                          </thead>
                          <tbody>
                            {workshopPanelDetail.bookings.map((b) => (
                              <tr key={b.id} className="border-t border-zinc-700/50">
                                <td className="px-2 py-1.5">{b.date}</td>
                                <td className="px-2 py-1.5">{b.time}</td>
                                <td className="px-2 py-1.5">{b.service_name}</td>
                                <td className="px-2 py-1.5">{b.status}</td>
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
      </main>
    </ServyGoPageShell>
  );
}
