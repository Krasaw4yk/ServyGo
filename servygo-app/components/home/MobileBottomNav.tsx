"use client";

import Link from "next/link";
import { useState, type FC } from "react";

export type MobileBottomNavTab = "start" | "search" | "bookings" | "favorites" | "account";

type MobileBottomNavProps = {
  isDark: boolean;
  onStart: () => void;
  onSearch: () => void;
  onAccount: () => void;
};

function IconHome({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12L3 12L12 3L21 12L19 12" />
      <path d="M5 12V19C5 19.5523 5.44772 20 6 20H9V15C9 14.4477 9.44772 14 10 14H14C14.5523 14 15 14.4477 15 15V20H18C18.5523 20 19 19.5523 19 19V12" />
    </svg>
  );
}

function IconSearch({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="10" cy="10" r="7" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" />
    </svg>
  );
}

function IconCalendar({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="4" y1="11" x2="20" y2="11" />
    </svg>
  );
}

function IconHeart({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19.5 12.572L12 20L4.5 12.572C3.209 11.268 3.209 9.136 4.5 7.832C5.79 6.527 7.9 6.527 9.19 7.832L12 10.668L14.81 7.832C16.1 6.527 18.21 6.527 19.5 7.832C20.791 9.136 20.791 11.268 19.5 12.572Z" />
    </svg>
  );
}

function IconUser({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20" />
    </svg>
  );
}

type NavItem =
  | { id: MobileBottomNavTab; label: string; Icon: FC<{ size?: number }>; type: "button"; onClick: () => void }
  | { id: MobileBottomNavTab; label: string; Icon: FC<{ size?: number }>; type: "link"; href: string };

export default function MobileBottomNav({ isDark, onStart, onSearch, onAccount }: MobileBottomNavProps) {
  const [activeTab, setActiveTab] = useState<MobileBottomNavTab>("start");

  const items: NavItem[] = [
    { id: "start", label: "Start", Icon: IconHome, type: "button", onClick: () => { setActiveTab("start"); onStart(); } },
    { id: "search", label: "Szukaj", Icon: IconSearch, type: "button", onClick: () => { setActiveTab("search"); onSearch(); } },
    { id: "bookings", label: "Wizyty", Icon: IconCalendar, type: "link", href: "/moje-rezerwacje" },
    { id: "favorites", label: "Ulubione", Icon: IconHeart, type: "link", href: "/ulubione-warsztaty" },
    { id: "account", label: "Konto", Icon: IconUser, type: "button", onClick: () => { setActiveTab("account"); onAccount(); } },
  ];

  const shellClass = isDark
    ? "border-zinc-700/80 bg-zinc-950/95 text-zinc-300"
    : "border-blue-200/90 bg-white/95 text-zinc-600";
  const activeClass = isDark ? "text-blue-400" : "text-blue-600";
  const inactiveClass = isDark ? "text-zinc-500" : "text-zinc-500";
  const itemClass =
    "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-semibold leading-tight transition-colors";

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl ${shellClass}`} aria-label="Nawigacja mobilna">
      <div className="mx-auto grid max-w-lg grid-cols-5 pb-[env(safe-area-inset-bottom,0px)]">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const colorClass = isActive ? activeClass : inactiveClass;

          if (item.type === "link") {
            return (
              <Link key={item.id} href={item.href} onClick={() => setActiveTab(item.id)} className={`${itemClass} ${colorClass}`}>
                <item.Icon size={22} />
                <span>{item.label}</span>
              </Link>
            );
          }

          return (
            <button key={item.id} type="button" onClick={item.onClick} className={`${itemClass} ${colorClass}`}>
              <item.Icon size={22} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
