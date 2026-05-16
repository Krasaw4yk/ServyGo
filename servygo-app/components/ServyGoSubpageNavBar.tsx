"use client";

import Image from "next/image";
import Link from "next/link";
import { useServyGoTranslator } from "@/lib/useServyGoLanguage";

export type ServyGoSubpageNavBarProps = {
  isDark: boolean;
  /** Domyślnie true — na stronach tylko do odczytu (np. błąd konfiguracji) można wyłączyć. Ignorowane przy wariantach `messages` / `calendar`. */
  showMojeKonto?: boolean;
  onToggleTheme?: () => void;
  /**
   * `messages` — /moje-wiadomosci · `calendar` — /moj-kalendarz: [Logo] … [Ustawienia] [Strona główna], bez „Start”.
   */
  variant?: "default" | "messages" | "calendar";
};

export default function ServyGoSubpageNavBar({
  isDark,
  showMojeKonto = true,
  onToggleTheme,
  variant = "default",
}: ServyGoSubpageNavBarProps) {
  const { t } = useServyGoTranslator();
  const isCompactNav = variant === "messages" || variant === "calendar";
  const logoSrc = isDark ? "/servygo-logo-dark-cropped.png" : "/servygo-logo-light-cropped.png";

  const barClass = isCompactNav
    ? `flex min-w-0 w-full flex-nowrap items-center justify-between gap-2 rounded-2xl border px-2 py-2 backdrop-blur-md overflow-hidden ${
        isDark
          ? "border-blue-500/25 bg-zinc-900/80 shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
          : "border-blue-200/85 bg-white/90 shadow-[0_10px_32px_rgba(37,99,235,0.08)]"
      }`
    : `flex min-w-0 w-full flex-nowrap items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 backdrop-blur-md sm:gap-4 sm:px-4 sm:py-3 ${
        isDark ? "border-blue-500/25 bg-zinc-900/80 shadow-[0_8px_30px_rgba(0,0,0,0.25)]" : "border-blue-200/85 bg-white/90 shadow-[0_10px_32px_rgba(37,99,235,0.08)]"
      }`;

  const outlineBtnDefault =
    `whitespace-nowrap rounded-xl border px-2.5 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ` +
    (isDark ? "border-blue-400/45 text-zinc-100 hover:border-orange-400/60 hover:bg-zinc-800/80" : "border-blue-300 text-blue-900 hover:border-orange-400/70 hover:bg-blue-50");

  const outlineBtnCompact =
    `inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border px-2 text-xs font-semibold transition sm:px-3 ` +
    (isDark ? "border-blue-400/45 text-zinc-100 hover:border-orange-400/60 hover:bg-zinc-800/80" : "border-blue-300 text-blue-900 hover:border-orange-400/70 hover:bg-blue-50");

  const logoCompactClass =
    "h-8 max-h-9 w-auto max-w-full object-contain object-left sm:h-9";
  const logoDefaultClass =
    "h-9 w-auto max-h-10 max-w-[min(200px,calc(100vw-108px))] object-contain object-left sm:h-10 sm:max-w-[min(220px,calc(100vw-200px))]";

  return (
    <header className={`mb-5 sm:mb-6 ${barClass}`}>
      <Link
        href="/"
        className="flex min-w-0 flex-1 items-center overflow-hidden pr-2"
        aria-label={t("subpageNav.logoHomeAria")}
      >
        <Image
          src={logoSrc}
          alt="ServyGo"
          width={256}
          height={96}
          priority
          className={isCompactNav ? logoCompactClass : logoDefaultClass}
        />
      </Link>
      <nav className={`flex shrink-0 flex-nowrap items-center ${isCompactNav ? "gap-2" : "gap-1.5 sm:gap-2"}`}>
        {isCompactNav ? (
          <>
            <Link href="/ustawienia" className={outlineBtnCompact}>
              {t("subpageNav.settings")}
            </Link>
            <Link href="/" className={outlineBtnCompact}>
              {t("subpageNav.home")}
            </Link>
          </>
        ) : (
          <>
            {showMojeKonto ? (
              <Link href="/moje-konto" className={`${outlineBtnDefault} hidden sm:inline-flex`}>
                {t("subpageNav.myAccount")}
              </Link>
            ) : null}
            {onToggleTheme ? (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={isDark ? "Przełącz na jasny" : "Przełącz na ciemny"}
                className={`${isCompactNav ? outlineBtnCompact : outlineBtnDefault} flex items-center justify-center px-2.5`}
              >
                {isDark ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            ) : null}
            <Link href="/" className={outlineBtnDefault}>
              <span className="inline sm:hidden">Strona główna</span>
              <span className="hidden sm:inline">{t("subpageNav.home")}</span>
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
