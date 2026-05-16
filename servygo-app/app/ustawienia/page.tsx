"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { isAdmin } from "@/lib/adminApi";
import { getUserActiveWorkshop } from "@/lib/workshopApi";
import { useServyGoLanguage, useServyGoTranslator } from "@/lib/useServyGoLanguage";
import { recordUserConsentEvent } from "@/lib/userConsentsApi";
import LegalReacceptanceModal from "@/components/legal/LegalReacceptanceModal";
import { useIsClient } from "@/lib/useIsClient";

type ToggleKey = "email" | "sms" | "reminders" | "promotions";

type SidebarNavItem =
  | { type: "scroll"; navKey: string; sectionId: string }
  | { type: "link"; navKey: string; href: string };

const SIDEBAR_NAV: SidebarNavItem[] = [
  { type: "scroll", navKey: "settingsPage.sidebar.accountSettings", sectionId: "sec-konto" },
  { type: "link", navKey: "settingsPage.sidebar.myBookings", href: "/moje-rezerwacje" },
  { type: "link", navKey: "settingsPage.sidebar.myVehicles", href: "/moje-auta" },
  { type: "scroll", navKey: "settingsPage.sidebar.security", sectionId: "sec-bezpieczenstwo" },
  { type: "link", navKey: "settingsPage.sidebar.messages", href: "/moje-wiadomosci" },
  { type: "link", navKey: "settingsPage.sidebar.calendar", href: "/moj-kalendarz" },
  { type: "scroll", navKey: "settingsPage.sidebar.privacyNav", sectionId: "sec-prywatnosc" },
  { type: "scroll", navKey: "settingsPage.sidebar.deleteAccountNav", sectionId: "sec-usun-konto" },
  { type: "scroll", navKey: "settingsPage.sidebar.helpContact", sectionId: "sec-aplikacji" },
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

const IcUser = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" />
  </svg>
);
const IcLock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IcCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IcCar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3v-5l2-5h14l2 5v5h-2" />
    <circle cx="7.5" cy="17.5" r="1.5" />
    <circle cx="16.5" cy="17.5" r="1.5" />
  </svg>
);
const IcMessage = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const IcMail = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <polyline points="2,4 12,13 22,4" />
  </svg>
);
const IcPhone = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <line x1="12" y1="18" x2="12" y2="18.01" />
  </svg>
);
const IcBell = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const IcShield = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const IcFile = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="13" y2="17" />
  </svg>
);
const IcHelp = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12" y2="17.01" />
  </svg>
);
const IcAlert = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12" y2="16.01" />
  </svg>
);
const IcTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

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
  const language = useServyGoLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roleKind, setRoleKind] = useState<"user" | "admin" | "workshop">("user");
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [activeMenuNavKey, setActiveMenuNavKey] = useState("settingsPage.sidebar.accountSettings");
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
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileEditDraft, setProfileEditDraft] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [savingProfileEdit, setSavingProfileEdit] = useState(false);
  const [profileEditError, setProfileEditError] = useState("");
  const [profileEditSuccess, setProfileEditSuccess] = useState("");
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [passwordResetBusy, setPasswordResetBusy] = useState(false);
  const [signOutAllBusy, setSignOutAllBusy] = useState(false);
  const [mobileDetailView, setMobileDetailView] = useState<null | "konto" | "bezpieczenstwo" | "zgody" | "prywatnosc">(null);

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
        setRoleKind("admin");
      } else if (activeWorkshop) {
        setRoleKind("workshop");
      } else {
        setRoleKind("user");
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
    return full || user?.email || "";
  }, [profile?.first_name, profile?.last_name, user?.email]);
  const { t } = useServyGoTranslator();
  const displayNameResolved = displayName.trim() ? displayName.trim() : t("settingsPage.fallbackDisplayName");
  const roleLabel =
    roleKind === "admin" ? t("settingsPage.roleAdmin") : roleKind === "workshop" ? t("settingsPage.roleWorkshop") : t("settingsPage.roleUser");

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
      setDeleteError(t("settingsPage.deleteErrorAckRequired"));
      return;
    }
    const confirm = deleteEmailConfirm.trim().toLowerCase();
    if (confirm !== user.email.trim().toLowerCase()) {
      setDeleteError(t("settingsPage.deleteErrorEmailMismatch"));
      return;
    }
    setDeleteBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      if (!token) {
        setDeleteError(t("settingsPage.deleteErrorNoSession"));
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
        setDeleteError(json?.error ?? t("settingsPage.deleteErrorGeneric"));
        setDeleteBusy(false);
        return;
      }
      await supabase.auth.signOut();
      router.replace("/?accountDeleted=1");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : t("settingsPage.deleteErrorRequest"));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleSaveProfileEdit() {
    if (!supabase || !user) return;
    setSavingProfileEdit(true);
    setProfileEditError("");
    setProfileEditSuccess("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: profileEditDraft.first_name.trim() || null,
          last_name: profileEditDraft.last_name.trim() || null,
          phone: profileEditDraft.phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              first_name: profileEditDraft.first_name.trim() || null,
              last_name: profileEditDraft.last_name.trim() || null,
              phone: profileEditDraft.phone.trim() || null,
            }
          : prev,
      );
      setProfileEditSuccess("Dane zostały zapisane.");
      setEditingProfile(false);
    } catch (e) {
      setProfileEditError(e instanceof Error ? e.message : "Nie udało się zapisać danych.");
    } finally {
      setSavingProfileEdit(false);
    }
  }

  async function handleSendPasswordReset() {
    if (!supabase || !user?.email) return;
    setPasswordResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setPasswordResetSent(true);
    } catch (e) {
      console.error("Password reset error:", e);
    } finally {
      setPasswordResetBusy(false);
    }
  }

  async function handleSignOutAllSessions() {
    if (!supabase) return;
    setSignOutAllBusy(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      router.replace("/");
    } catch (e) {
      console.error("Sign out all error:", e);
    } finally {
      setSignOutAllBusy(false);
    }
  }

  function scrollToSection(sectionId: string, menuNavKey: string) {
    setActiveMenuNavKey(menuNavKey);
    window.history.replaceState(null, "", `#${sectionId}`);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!mounted || !user) return null;
  const isDark = theme === "dark";

  const SectionHeader = ({ label }: { label: string }) => (
    <p className={`px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
      {label}
    </p>
  );

  const RowGroup = ({ children }: { children: ReactNode }) => (
    <div className={`overflow-hidden rounded-2xl border ${isDark ? "border-zinc-700/80 bg-zinc-900" : "border-zinc-200 bg-white"}`}>
      {children}
    </div>
  );

  type SettingsRowProps = {
    icon: ReactNode;
    iconBg: string;
    label: string;
    sub?: string;
    right?: ReactNode;
    onClick?: () => void;
    isLast?: boolean;
  };

  const SettingsRow = ({ icon, iconBg, label, sub, right, onClick, isLast }: SettingsRowProps) => (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={`flex min-h-[44px] items-center justify-between gap-3 px-3 py-2.5 transition-colors ${
        !isLast ? (isDark ? "border-b border-zinc-700/80" : "border-b border-zinc-100") : ""
      } ${
        onClick
          ? isDark
            ? "cursor-pointer hover:bg-zinc-800/60 active:bg-zinc-800"
            : "cursor-pointer hover:bg-zinc-50 active:bg-zinc-100"
          : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[15px] ${iconBg}`}>{icon}</div>
        <div className="min-w-0">
          <p className={`text-[13px] leading-snug ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{label}</p>
          {sub ? <p className={`mt-0.5 text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{sub}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{right}</div>
    </div>
  );

  const Chevron = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDark ? "text-zinc-600" : "text-zinc-300"}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );

  const Badge = ({ label, color }: { label: string; color: "blue" | "green" | "gray" }) => {
    const cls = {
      blue: isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-700",
      green: isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-700",
      gray: isDark ? "bg-zinc-700 text-zinc-400" : "bg-zinc-100 text-zinc-500",
    }[color];
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
  };

  const InlineToggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${checked ? "bg-blue-600" : isDark ? "bg-zinc-600" : "bg-zinc-300"}`}
    >
      <span className={`mt-[2px] inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[17px]" : "translate-x-[2px]"}`} />
    </button>
  );

  const accountSub = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || profile?.email || "—";

  const mobileDetailTitles: Record<NonNullable<typeof mobileDetailView>, string> = {
    konto: "Dane konta",
    bezpieczenstwo: "Bezpieczeństwo",
    zgody: "Zgody i dokumenty",
    prywatnosc: "Prywatność",
  };

  const mobileDetailCardClass = `rounded-2xl border p-4 ${isDark ? "border-zinc-700/80 bg-zinc-900" : "border-zinc-200 bg-white"}`;

  const accountSectionContent = (
    <>
      {editingProfile ? (
        <>
          <div className="mt-3 space-y-2">
            <label className="block text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("settingsPage.firstNameLabel")}</span>
              <input
                value={profileEditDraft.first_name}
                onChange={(e) => setProfileEditDraft((p) => ({ ...p, first_name: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("settingsPage.lastNameLabel")}</span>
              <input
                value={profileEditDraft.last_name}
                onChange={(e) => setProfileEditDraft((p) => ({ ...p, last_name: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("settingsPage.phoneLabelShort")}</span>
              <input
                type="tel"
                value={profileEditDraft.phone}
                onChange={(e) => setProfileEditDraft((p) => ({ ...p, phone: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
          </div>
          {profileEditError ? <p className="mt-2 text-xs text-rose-700">{profileEditError}</p> : null}
          {profileEditSuccess ? <p className="mt-2 text-xs text-emerald-700">{profileEditSuccess}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600"
            >
              Anuluj
            </button>
            <button
              type="button"
              disabled={savingProfileEdit}
              onClick={() => void handleSaveProfileEdit()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingProfileEdit ? "Zapisuję..." : "Zapisz"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 space-y-2 text-sm text-zinc-700">
            <p>
              <span className="font-semibold">{t("settingsPage.firstNameLabel")}</span> {profile?.first_name?.trim() || "—"}
            </p>
            <p>
              <span className="font-semibold">{t("settingsPage.lastNameLabel")}</span>{" "}
              {profile?.last_name?.trim() ? profile.last_name.trim() : <span className="text-zinc-500">{t("settingsPage.lastNameOptional")}</span>}
            </p>
            <p>
              <span className="font-semibold">{t("settingsPage.emailLabelShort")}</span> {profile?.email ?? user.email ?? "—"}
            </p>
            <p>
              <span className="font-semibold">{t("settingsPage.phoneLabelShort")}</span> {profile?.phone ?? t("settingsPage.phoneNotSet")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setProfileEditDraft({
                first_name: profile?.first_name ?? "",
                last_name: profile?.last_name ?? "",
                phone: profile?.phone ?? "",
              });
              setEditingProfile(true);
              setProfileEditError("");
              setProfileEditSuccess("");
            }}
            className="mt-4 rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400"
          >
            {t("settingsPage.editData")}
          </button>
        </>
      )}
    </>
  );

  const securitySectionContent = (
    <div className="mt-3 space-y-2 text-sm text-zinc-700">
      <div className="rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("settingsPage.securityPassword")}</p>
        {passwordResetSent ? (
          <p className="mt-1 text-xs text-emerald-700">Link do zmiany hasła wysłany na {user?.email}</p>
        ) : (
          <button
            type="button"
            disabled={passwordResetBusy}
            onClick={() => void handleSendPasswordReset()}
            className="mt-2 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-500 disabled:opacity-50"
          >
            {passwordResetBusy ? "Wysyłam..." : "Wyślij link resetujący"}
          </button>
        )}
      </div>
      <div className="rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("settingsPage.security2fa")}</p>
        <p className="mt-1 text-xs text-zinc-500">
          Weryfikacja dwuetapowa jest dostępna przez aplikację uwierzytelniającą. Skontaktuj się z pomocą techniczną.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("settingsPage.securitySessions")}</p>
        <button
          type="button"
          disabled={signOutAllBusy}
          onClick={() => void handleSignOutAllSessions()}
          className="mt-2 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-500 disabled:opacity-50"
        >
          {signOutAllBusy ? "Wylogowuję..." : "Wyloguj ze wszystkich urządzeń"}
        </button>
      </div>
    </div>
  );

  const privacySectionContent = (
    <ul className="mt-3 space-y-2 text-sm text-zinc-700">
      <li className="rounded-xl border border-zinc-200 px-3 py-2">
        <Link href="/polityka-prywatnosci" className="font-medium text-blue-700 hover:text-orange-600 hover:underline">
          {t("settingsPage.privacyPolicyLink")}
        </Link>
      </li>
      <li className="rounded-xl border border-zinc-200 px-3 py-2">
        <Link href="/moje-rezerwacje" className="text-sm font-medium text-blue-700 hover:underline">
          Historia moich danych i rezerwacji →
        </Link>
      </li>
      <li className="rounded-xl border border-zinc-200 px-3 py-2 text-zinc-600">
        Twoje dane osobowe są przetwarzane zgodnie z RODO. W razie pytań skontaktuj się z nami przez formularz pomocy.
      </li>
    </ul>
  );

  const zgodySectionContent = (
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
  );

  return (
    <ServyGoPageShell isDark={isDark}>
      <main className="min-h-screen">
        <div className={`md:hidden space-y-1 px-4 py-4 ${isDark ? "min-h-screen bg-zinc-950" : "min-h-screen bg-[#F4F4F6]"}`}>
          <div className="mb-4 flex items-center justify-between">
            <Link href="/">
              <Image
                src={isDark ? "/servygo-logo-dark-cropped.png" : "/servygo-logo-light-cropped.png"}
                alt="ServyGo"
                width={120}
                height={45}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <Link
              href="/"
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-medium transition ${
                isDark ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Strona główna
            </Link>
          </div>

          {mobileDetailView !== null ? (
            <div className="mb-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileDetailView(null)}
                aria-label="Wróć"
                className={`flex h-9 w-9 items-center justify-center rounded-xl border ${isDark ? "border-zinc-700" : "border-zinc-200"}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <h2 className={`text-[15px] font-semibold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{mobileDetailTitles[mobileDetailView]}</h2>
            </div>
          ) : null}

          {mobileDetailView === null ? (
            <>
          <div className={`mb-4 flex items-center gap-3 rounded-2xl border p-3 ${isDark ? "border-zinc-700/80 bg-zinc-900" : "border-zinc-200 bg-white"}`}>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold ${isDark ? "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30" : "bg-blue-50 text-blue-700 ring-1 ring-blue-200"}`}>
              {displayNameResolved[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <p className={`truncate text-[14px] font-medium ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{displayNameResolved}</p>
              <p className={`mt-0.5 truncate text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{profile?.email ?? user.email ?? "—"}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-700"}`}>{roleLabel}</span>
            </div>
          </div>

          <SectionHeader label={t("settingsPage.sidebar.accountSettings")} />
          <RowGroup>
            <SettingsRow icon={<IcUser />} iconBg={isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-700"} label={t("settingsPage.sectionAccountTitle")} sub={accountSub} right={<Chevron />} onClick={() => setMobileDetailView("konto")} />
            <SettingsRow icon={<IcLock />} iconBg={isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-700"} label={t("settingsPage.sectionSecurity")} sub={t("settingsPage.security2fa")} right={<Chevron />} onClick={() => setMobileDetailView("bezpieczenstwo")} isLast />
          </RowGroup>

          <SectionHeader label="Aktywność" />
          <RowGroup>
            <SettingsRow icon={<IcCalendar />} iconBg={isDark ? "bg-amber-500/15 text-amber-400" : "bg-amber-50 text-amber-700"} label={t("settingsPage.sectionBookingsHeading")} sub={t("settingsPage.bookingsLead").replace("{count}", String(bookingsCount))} right={<><Badge label={String(bookingsCount)} color="blue" /><Chevron /></>} onClick={() => router.push("/moje-rezerwacje")} />
            <SettingsRow icon={<IcCar />} iconBg={isDark ? "bg-purple-500/15 text-purple-400" : "bg-purple-50 text-purple-700"} label={t("settingsPage.sectionMyVehicles")} sub={t("settingsPage.myVehiclesLead").replace("{count}", String(vehiclesCount))} right={<><Badge label={String(vehiclesCount)} color="gray" /><Chevron /></>} onClick={() => router.push("/moje-auta")} />
            <SettingsRow icon={<IcCalendar />} iconBg={isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-700"} label={t("settingsPage.sectionCalendarHeading")} right={<Chevron />} onClick={() => router.push("/moj-kalendarz")} />
            <SettingsRow icon={<IcMessage />} iconBg={isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-700"} label={t("settingsPage.sidebar.messages")} right={<Chevron />} onClick={() => router.push("/moje-wiadomosci")} isLast />
          </RowGroup>

          <SectionHeader label={t("settingsPage.sectionNotifications")} />
          <RowGroup>
            <SettingsRow icon={<IcMail />} iconBg={isDark ? "bg-red-500/15 text-red-400" : "bg-red-50 text-red-600"} label={t("settingsPage.toggleEmailLabel")} sub={t("settingsPage.toggleEmailDesc")} right={<InlineToggle checked={toggles.email} onChange={() => setToggles((p) => ({ ...p, email: !p.email }))} />} />
            <SettingsRow icon={<IcPhone />} iconBg={isDark ? "bg-purple-500/15 text-purple-400" : "bg-purple-50 text-purple-700"} label={t("settingsPage.toggleSmsLabel")} sub={t("settingsPage.toggleSmsDesc")} right={<InlineToggle checked={toggles.sms} onChange={() => setToggles((p) => ({ ...p, sms: !p.sms }))} />} />
            <SettingsRow icon={<IcBell />} iconBg={isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-700"} label={t("settingsPage.toggleRemindersLabel")} sub={t("settingsPage.toggleRemindersDesc")} right={<InlineToggle checked={toggles.reminders} onChange={() => setToggles((p) => ({ ...p, reminders: !p.reminders }))} />} />
            <SettingsRow icon={<IcBell />} iconBg={isDark ? "bg-zinc-700 text-zinc-400" : "bg-zinc-100 text-zinc-500"} label={t("settingsPage.togglePromoLabel")} sub={t("settingsPage.togglePromoDesc")} right={<InlineToggle checked={toggles.promotions} onChange={() => setToggles((p) => ({ ...p, promotions: !p.promotions }))} />} isLast />
          </RowGroup>

          <SectionHeader label={t("settingsPage.sectionPrivacyHeading")} />
          <RowGroup>
            <SettingsRow icon={<IcFile />} iconBg={isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-700"} label={t("legal.accountSettings.sectionTitle")} sub="Regulamin, polityka, RODO" right={<><Badge label="OK" color="green" /><Chevron /></>} onClick={() => setMobileDetailView("zgody")} />
            <SettingsRow
              icon={<IcShield />}
              iconBg={isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-700"}
              label={t("settingsPage.privacySettings")}
              sub="Zarządzanie danymi, eksport"
              right={<Chevron />}
              onClick={() => setMobileDetailView("prywatnosc")}
              isLast
            />
          </RowGroup>

          <SectionHeader label={t("settingsPage.helpTitle")} />
          <RowGroup>
            <SettingsRow icon={<IcHelp />} iconBg={isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-700"} label={t("settingsPage.helpFaq")} right={<Chevron />} onClick={() => router.push("/#kontakt")} />
            <SettingsRow icon={<IcAlert />} iconBg={isDark ? "bg-red-500/15 text-red-400" : "bg-red-50 text-red-600"} label={t("settingsPage.reportProblem")} right={<Chevron />} onClick={() => router.push("/zglos-problem")} isLast />
          </RowGroup>

          <SectionHeader label={t("settingsPage.sectionDeleteTitle")} />
          <div className={`overflow-hidden rounded-2xl border ${isDark ? "border-red-900/60 bg-zinc-900/50" : "border-red-200 bg-red-50/80"}`}>
            <SettingsRow icon={<IcTrash />} iconBg={isDark ? "bg-red-500/15 text-red-400" : "bg-red-100 text-red-600"} label={t("settingsPage.deleteAccountButton")} sub={`${t("settingsPage.sectionDeleteBody").slice(0, 55)}…`} right={<Chevron />} onClick={() => { setDeleteModalOpen(true); setDeleteError(""); }} isLast />
          </div>

          <button type="button" onClick={() => void handleLogout()} className={`mt-3 w-full rounded-2xl border py-3 text-[13px] font-semibold transition ${isDark ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
            {t("settingsPage.logout")}
          </button>
            </>
          ) : null}

          {mobileDetailView === "konto" ? <div className={mobileDetailCardClass}>{accountSectionContent}</div> : null}
          {mobileDetailView === "bezpieczenstwo" ? <div className={mobileDetailCardClass}>{securitySectionContent}</div> : null}
          {mobileDetailView === "zgody" ? <div className={mobileDetailCardClass}>{zgodySectionContent}</div> : null}
          {mobileDetailView === "prywatnosc" ? <div className={mobileDetailCardClass}>{privacySectionContent}</div> : null}
        </div>
                <div className="hidden min-h-screen bg-[radial-gradient(1200px_500px_at_85%_-10%,rgba(37,99,235,0.16),transparent_65%),radial-gradient(900px_420px_at_-8%_105%,rgba(251,146,60,0.16),transparent_70%)] px-3 py-4 sm:px-6 sm:py-7 md:block">
        <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-4 lg:flex-row">
          <aside className="w-full rounded-3xl border border-blue-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(37,99,235,0.12)] backdrop-blur-md lg:sticky lg:top-4 lg:w-[330px] lg:self-start">
            <Link href="/" className="inline-flex">
              <Image src="/servygo-logo-light-cropped.png" alt="ServyGo" width={186} height={70} className="h-10 w-auto object-contain" />
            </Link>
            <div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-orange-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                  {displayNameResolved[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">{displayNameResolved}</p>
                  <p className="truncate text-xs text-zinc-500">{profile?.email ?? user.email ?? "—"}</p>
                </div>
              </div>
              <span className="mt-3 inline-flex rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                {roleLabel}
              </span>
            </div>

            <nav className="mt-5 space-y-2">
              {SIDEBAR_NAV.map((entry) => {
                if (entry.type === "link") {
                  return (
                    <Link key={entry.navKey} href={entry.href} className={sidebarEntryClass(false)}>
                      {t(entry.navKey)}
                    </Link>
                  );
                }
                const active = activeMenuNavKey === entry.navKey;
                return (
                  <button
                    key={entry.navKey}
                    type="button"
                    onClick={() => scrollToSection(entry.sectionId, entry.navKey)}
                    className={sidebarEntryClass(active)}
                  >
                    {t(entry.navKey)}
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {t("settingsPage.logout")}
            </button>
          </aside>

          <section className="w-full rounded-3xl border border-blue-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(37,99,235,0.12)] backdrop-blur-md sm:p-7">
            <header className="mb-6">
              <div>
                <h1 className="text-3xl font-bold text-zinc-900">{t("settingsPage.pageTitle")}</h1>
                <p className="mt-1 text-sm text-zinc-600">{t("settingsPage.pageSubtitle")}</p>
              </div>
            </header>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article id="sec-konto" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">{t("settingsPage.sectionAccountTitle")}</h2>
                {editingProfile ? (
                  <>
                    <div className="mt-3 space-y-2">
                      <label className="block text-sm">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("settingsPage.firstNameLabel")}</span>
                        <input
                          value={profileEditDraft.first_name}
                          onChange={(e) => setProfileEditDraft((p) => ({ ...p, first_name: e.target.value }))}
                          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("settingsPage.lastNameLabel")}</span>
                        <input
                          value={profileEditDraft.last_name}
                          onChange={(e) => setProfileEditDraft((p) => ({ ...p, last_name: e.target.value }))}
                          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("settingsPage.phoneLabelShort")}</span>
                        <input
                          type="tel"
                          value={profileEditDraft.phone}
                          onChange={(e) => setProfileEditDraft((p) => ({ ...p, phone: e.target.value }))}
                          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                        />
                      </label>
                    </div>
                    {profileEditError ? <p className="mt-2 text-xs text-rose-700">{profileEditError}</p> : null}
                    {profileEditSuccess ? <p className="mt-2 text-xs text-emerald-700">{profileEditSuccess}</p> : null}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingProfile(false)}
                        className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600"
                      >
                        Anuluj
                      </button>
                      <button
                        type="button"
                        disabled={savingProfileEdit}
                        onClick={() => void handleSaveProfileEdit()}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {savingProfileEdit ? "Zapisuję..." : "Zapisz"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-3 space-y-2 text-sm text-zinc-700">
                      <p>
                        <span className="font-semibold">{t("settingsPage.firstNameLabel")}</span> {profile?.first_name?.trim() || "—"}
                      </p>
                      <p>
                        <span className="font-semibold">{t("settingsPage.lastNameLabel")}</span>{" "}
                        {profile?.last_name?.trim() ? profile.last_name.trim() : <span className="text-zinc-500">{t("settingsPage.lastNameOptional")}</span>}
                      </p>
                      <p>
                        <span className="font-semibold">{t("settingsPage.emailLabelShort")}</span> {profile?.email ?? user.email ?? "—"}
                      </p>
                      <p>
                        <span className="font-semibold">{t("settingsPage.phoneLabelShort")}</span> {profile?.phone ?? t("settingsPage.phoneNotSet")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileEditDraft({
                          first_name: profile?.first_name ?? "",
                          last_name: profile?.last_name ?? "",
                          phone: profile?.phone ?? "",
                        });
                        setEditingProfile(true);
                        setProfileEditError("");
                        setProfileEditSuccess("");
                      }}
                      className="mt-4 rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400"
                    >
                      {t("settingsPage.editData")}
                    </button>
                  </>
                )}
              </article>

              <article id="sec-powiadomienia" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">{t("settingsPage.sectionNotifications")}</h2>
                <div className="mt-3 space-y-2">
                  <SettingToggle checked={toggles.email} onChange={() => setToggles((p) => ({ ...p, email: !p.email }))} label={t("settingsPage.toggleEmailLabel")} description={t("settingsPage.toggleEmailDesc")} />
                  <SettingToggle checked={toggles.sms} onChange={() => setToggles((p) => ({ ...p, sms: !p.sms }))} label={t("settingsPage.toggleSmsLabel")} description={t("settingsPage.toggleSmsDesc")} />
                  <SettingToggle checked={toggles.reminders} onChange={() => setToggles((p) => ({ ...p, reminders: !p.reminders }))} label={t("settingsPage.toggleRemindersLabel")} description={t("settingsPage.toggleRemindersDesc")} />
                  <SettingToggle checked={toggles.promotions} onChange={() => setToggles((p) => ({ ...p, promotions: !p.promotions }))} label={t("settingsPage.togglePromoLabel")} description={t("settingsPage.togglePromoDesc")} />
                </div>
              </article>

              <article id="sec-bezpieczenstwo" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">{t("settingsPage.sectionSecurity")}</h2>
                <div className="mt-3 space-y-2 text-sm text-zinc-700">
                  <div className="rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("settingsPage.securityPassword")}</p>
                    {passwordResetSent ? (
                      <p className="mt-1 text-xs text-emerald-700">
                        Link do zmiany hasła wysłany na {user?.email}
                      </p>
                    ) : (
                      <button
                        type="button"
                        disabled={passwordResetBusy}
                        onClick={() => void handleSendPasswordReset()}
                        className="mt-2 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-500 disabled:opacity-50"
                      >
                        {passwordResetBusy ? "Wysyłam..." : "Wyślij link resetujący"}
                      </button>
                    )}
                  </div>
                  <div className="rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("settingsPage.security2fa")}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Weryfikacja dwuetapowa jest dostępna przez aplikację uwierzytelniającą. Skontaktuj się z pomocą techniczną.
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("settingsPage.securitySessions")}</p>
                    <button
                      type="button"
                      disabled={signOutAllBusy}
                      onClick={() => void handleSignOutAllSessions()}
                      className="mt-2 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-500 disabled:opacity-50"
                    >
                      {signOutAllBusy ? "Wylogowuję..." : "Wyloguj ze wszystkich urządzeń"}
                    </button>
                  </div>
                </div>
              </article>

              <article id="sec-prywatnosc" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">{t("settingsPage.sectionPrivacyHeading")}</h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">
                    <Link href="/polityka-prywatnosci" className="font-medium text-blue-700 hover:text-orange-600 hover:underline">
                      {t("settingsPage.privacyPolicyLink")}
                    </Link>
                  </li>
                  <li className="rounded-xl border border-zinc-200 px-3 py-2">
                    <Link href="/moje-rezerwacje" className="text-sm font-medium text-blue-700 hover:underline">
                      Historia moich danych i rezerwacji →
                    </Link>
                  </li>
                  <li className="rounded-xl border border-zinc-200 px-3 py-2 text-zinc-600">
                    Twoje dane osobowe są przetwarzane zgodnie z RODO. W razie pytań skontaktuj się z nami przez formularz
                    pomocy.
                  </li>
                </ul>
              </article>

              <article id="sec-zgody" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
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
                <h2 className="text-lg font-semibold text-zinc-900">{t("settingsPage.sectionMyVehicles")}</h2>
                <p className="mt-2 text-sm text-zinc-600">{t("settingsPage.myVehiclesLead").replace("{count}", String(vehiclesCount))}</p>
                <Link href="/moje-auta" className="mt-4 inline-flex rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                  {t("settingsPage.manageVehiclesCta")}
                </Link>
              </article>

              <article id="sec-rezerwacje" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">{t("settingsPage.sectionBookingsHeading")}</h2>
                <p className="mt-2 text-sm text-zinc-600">{t("settingsPage.bookingsLead").replace("{count}", String(bookingsCount))}</p>
                <Link href="/moje-rezerwacje" className="mt-4 inline-flex rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                  {t("settingsPage.viewBookingsCta")}
                </Link>
              </article>

              <article id="sec-kalendarz" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-zinc-900">{t("settingsPage.sectionCalendarHeading")}</h2>
                <p className="mt-2 text-sm text-zinc-600">{t("settingsPage.calendarLead")}</p>
                <Link href="/moj-kalendarz" className="mt-4 inline-flex rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-orange-400">
                  {t("settingsPage.openCalendarCta")}
                </Link>
              </article>

              <article id="sec-usun-konto" className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 shadow-sm scroll-mt-28">
                <h2 className="text-lg font-semibold text-rose-900">{t("settingsPage.sectionDeleteTitle")}</h2>
                <p className="mt-2 text-sm leading-relaxed text-rose-950/90">{t("settingsPage.sectionDeleteBody")}</p>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteModalOpen(true);
                    setDeleteError("");
                  }}
                  className="mt-4 rounded-xl border border-rose-600 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                >
                  {t("settingsPage.deleteAccountButton")}
                </button>
              </article>
            </div>

            <article id="sec-aplikacji" className="mt-5 scroll-mt-28 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 p-5 text-white shadow-[0_18px_38px_rgba(37,99,235,0.35)]">
              <h3 className="text-lg font-semibold">{t("settingsPage.helpTitle")}</h3>
              <p className="mt-1 text-sm text-blue-50">{t("settingsPage.helpSubtitle")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/#kontakt"
                  className="rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/30"
                  title={t("settingsPage.helpFaqTitle")}
                >
                  {t("settingsPage.helpFaq")}
                </Link>
                <Link
                  href="/#kontakt"
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  title={t("settingsPage.helpContactTitle")}
                >
                  {t("settingsPage.helpContact")}
                </Link>
                <Link href="/zglos-problem" className="rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-white">
                  {t("settingsPage.reportProblem")}
                </Link>
              </div>
            </article>


          </section>
        </div>
        </div>
        {deleteModalOpen ? (
          <div className="fixed inset-0 z-[10060] flex items-end justify-center sm:items-center sm:p-6">
            <button
              type="button"
              aria-label={t("settingsPage.deleteModalCloseAria")}
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
              onClick={() => !deleteBusy && setDeleteModalOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              className="relative z-[1] w-full max-w-md rounded-t-2xl border border-rose-200 bg-white p-5 shadow-2xl sm:rounded-2xl"
            >
              <h3 className="text-lg font-bold text-zinc-900">{t("settingsPage.deleteModalTitle")}</h3>
              <p className="mt-2 text-sm text-zinc-600">
                {(() => {
                  const segs = t("settingsPage.deleteModalEmailInstr").split("{email}");
                  return (
                    <>
                      {segs[0]}
                      <span className="font-mono font-semibold">{user.email}</span>
                      {segs[1] ?? ""}
                    </>
                  );
                })()}
              </p>
              <input
                value={deleteEmailConfirm}
                onChange={(e) => setDeleteEmailConfirm(e.target.value)}
                placeholder={t("settingsPage.deletePlaceholderEmail")}
                className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
              <label className="mt-3 flex gap-2 text-sm text-zinc-700">
                <input type="checkbox" checked={deleteAck} onChange={(e) => setDeleteAck(e.target.checked)} className="mt-1 h-4 w-4" />
                {t("settingsPage.deleteAckCheckbox")}
              </label>
              {deleteError ? <p className="mt-2 text-sm text-rose-700">{deleteError}</p> : null}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => setDeleteModalOpen(false)}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold"
                >
                  {t("settingsPage.deleteCancel")}
                </button>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => void handleConfirmDeleteAccount()}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {deleteBusy ? t("settingsPage.deleteBusy") : t("settingsPage.deleteConfirm")}
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
      </main>
    </ServyGoPageShell>
  );
}
