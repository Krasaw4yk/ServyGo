"use client";

import { useCallback, useEffect, useId, useState } from "react";

type InviteWorkshopCardProps = {
  isDark: boolean;
};

export default function InviteWorkshopCard({ isDark }: InviteWorkshopCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const titleId = useId();

  const close = useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, close]);

  const cardClass = isDark
    ? "border-blue-500/30 bg-gradient-to-r from-blue-950/50 to-orange-950/25 text-zinc-100"
    : "border-orange-200/80 bg-gradient-to-r from-orange-50 via-white to-yellow-50 text-zinc-900 shadow-[0_14px_34px_rgba(249,115,22,0.12)]";

  const ribbonOuter =
    "pointer-events-none absolute right-2 top-2 z-20 flex max-w-[calc(100%-4.5rem)] items-start justify-end sm:right-3 sm:top-3 sm:max-w-none";

  const ribbonInner =
    "relative whitespace-nowrap rounded-lg bg-gradient-to-r from-orange-400/92 via-pink-500/92 to-red-500/92 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white opacity-95 shadow-[0_0_18px_rgba(249,115,22,0.5),0_8px_22px_rgba(236,72,153,0.35)] ring-1 ring-white/25 backdrop-blur-md sm:px-4 sm:py-1.5 sm:text-xs sm:tracking-wide " +
    "rotate-6 sm:rotate-12";

  const btnClass = isDark
    ? "relative mt-4 inline-flex w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(249,115,22,0.35)] outline-none transition duration-300 hover:shadow-[0_12px_36px_rgba(249,115,22,0.55),0_0_28px_rgba(251,146,60,0.35)] focus-visible:ring-2 focus-visible:ring-orange-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-[0.98] sm:w-auto"
    : "relative mt-4 inline-flex w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(249,115,22,0.35)] outline-none transition duration-300 hover:shadow-[0_14px_40px_rgba(249,115,22,0.45),0_0_32px_rgba(251,146,60,0.28)] focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-50/80 active:scale-[0.98] sm:w-auto";

  const hintClass = isDark ? "text-zinc-400" : "text-zinc-600";

  return (
    <>
      <article className={`relative overflow-hidden rounded-2xl border p-5 pt-6 sm:p-5 ${cardClass}`}>
        {/* Soft glow behind ribbon corner — stays inside rounded card */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br from-orange-400/25 via-pink-500/20 to-red-500/15 blur-2xl sm:h-32 sm:w-32"
        />

        <div className={ribbonOuter}>
          <span className={ribbonInner}>JUŻ WKRÓTCE</span>
        </div>

        <div className="relative z-[1] pr-16 max-[380px]:pr-14 sm:pr-20">
          <h3 className="text-xl font-semibold">Zaproś warsztat i zyskaj!</h3>
          <p className={`mt-2 text-sm leading-relaxed ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>
            Poleć serwis z Twojej okolicy i pomóż mu dołączyć do ServyGo.
          </p>

          <button type="button" onClick={() => setModalOpen(true)} className={btnClass}>
            Zaproś teraz
          </button>

          <p className={`mt-2 max-w-md text-[11px] leading-snug opacity-70 sm:text-xs ${hintClass}`}>
            Już wkrótce będziesz mógł zapraszać warsztaty i zdobywać bonusy
          </p>
        </div>
      </article>

      {modalOpen ? (
        <div className="fixed inset-0 z-[10050] flex items-end justify-center sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Zamknij"
            className="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative z-[1] mx-4 mb-[max(1rem,env(safe-area-inset-bottom))] w-full max-w-md rounded-2xl border p-6 shadow-2xl sm:mx-0 sm:mb-0 ${
              isDark
                ? "border-zinc-600 bg-zinc-900/95 text-zinc-100 ring-1 ring-orange-500/20"
                : "border-orange-200/90 bg-white text-zinc-900 ring-1 ring-orange-300/30"
            }`}
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-orange-400/30 via-pink-500/25 to-transparent blur-2xl" />
            <h4 id={titleId} className="relative text-lg font-bold leading-snug">
              🚀 Funkcja w przygotowaniu
            </h4>
            <p className={`relative mt-3 text-sm leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
              Możliwość zapraszania warsztatów i zdobywania nagród będzie dostępna już wkrótce. Pracujemy nad tym!
            </p>
            <button
              type="button"
              onClick={close}
              className="relative mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110 focus-visible:outline focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
