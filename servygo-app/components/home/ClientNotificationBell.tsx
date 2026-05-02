"use client";

import Link from "next/link";

type ClientNotificationBellProps = {
  isDark: boolean;
  unreadCount: number;
  /** Gdy podane (np. klasa przycisków język/motyw w headerze), zamiast małego kwadratu. */
  buttonClassName?: string;
};

export default function ClientNotificationBell({
  isDark,
  unreadCount,
  buttonClassName,
}: ClientNotificationBellProps) {
  const compactBellBtnClass = `relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
    isDark ? "border-zinc-600 text-zinc-100 hover:bg-zinc-800" : "border-blue-200 text-blue-800 hover:bg-blue-50"
  }`;
  const bellBtnClass = buttonClassName?.trim()
    ? `relative shrink-0 ${buttonClassName}`
    : compactBellBtnClass;
  const bellIconClass = buttonClassName?.trim() ? "h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:h-6 shrink-0" : "h-5 w-5 shrink-0";

  return (
    <Link
      href="/moje-wiadomosci"
      aria-label="Moje wiadomości"
      title="Moje wiadomości"
      className={bellBtnClass}
    >
      <svg viewBox="0 0 24 24" className={bellIconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
