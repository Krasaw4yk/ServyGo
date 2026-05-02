"use client";

import Image from "next/image";
import Link from "next/link";

export type ServyGoSubpageNavBarProps = {
  isDark: boolean;
  /** Domyślnie true — na stronach tylko do odczytu (np. błąd konfiguracji) można wyłączyć. Ignorowane przy wariantach `messages` / `calendar`. */
  showMojeKonto?: boolean;
  /**
   * `messages` — /moje-wiadomosci · `calendar` — /moj-kalendarz: [Logo] … [Ustawienia] [Strona główna], bez „Start”.
   */
  variant?: "default" | "messages" | "calendar";
};

export default function ServyGoSubpageNavBar({
  isDark,
  showMojeKonto = true,
  variant = "default",
}: ServyGoSubpageNavBarProps) {
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
      <Link href="/" className="flex min-w-0 flex-1 items-center overflow-hidden pr-2" aria-label="ServyGo — strona główna">
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
              Ustawienia
            </Link>
            <Link href="/" className={outlineBtnCompact}>
              Strona główna
            </Link>
          </>
        ) : (
          <>
            {showMojeKonto ? (
              <Link href="/moje-konto" className={`${outlineBtnDefault} hidden sm:inline-flex`}>
                Moje konto
              </Link>
            ) : null}
            <Link href="/" className={outlineBtnDefault}>
              <span className="inline sm:hidden">Start</span>
              <span className="hidden sm:inline">Strona główna</span>
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
