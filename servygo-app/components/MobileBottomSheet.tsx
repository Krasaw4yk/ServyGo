"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type MobileBottomSheetProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  isDark?: boolean;
  /**
   * Wysoki arkusz z przewijalną listą (Autocomplete, kategorie usług).
   * Bez tego arkusz dopasowuje się do treści (menu konta, język).
   */
  tallList?: boolean;
  /** @deprecated Użyj `tallList` — zachowane dla kompatybilności wstecznej. */
  fixedHeight?: boolean;
  /** Nadpisanie warstwy nad innymi panelami (np. modal informacyjny nad kontem). */
  stackClassName?: string;
};

export default function MobileBottomSheet({
  isOpen,
  title,
  onClose,
  children,
  isDark = false,
  tallList: tallListProp,
  fixedHeight = false,
  stackClassName,
}: MobileBottomSheetProps) {
  const tallList = tallListProp ?? fixedHeight;
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isActive, setIsActive] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const frame = window.requestAnimationFrame(() => setIsActive(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setIsActive(false);
    const timeoutId = window.setTimeout(() => setShouldRender(false), 230);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  useEffect(() => {
    if (!shouldRender) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [shouldRender, onClose]);

  useEffect(() => {
    if (!shouldRender) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [shouldRender]);

  if (!shouldRender || !portalReady) return null;

  const zLayer = stackClassName ?? "z-[9999]";
  const sheetMaxH = "max-h-[min(82dvh,calc(100dvh-env(safe-area-inset-bottom)-10px))]";

  return createPortal(
    <div
      className={`fixed inset-0 sm:hidden ${zLayer} ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <button
        type="button"
        aria-label="Zamknij panel"
        className={`absolute inset-0 z-0 bg-black/30 transition-opacity duration-200 ease-out ${isActive && isOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        className={`absolute bottom-0 left-0 right-0 z-10 flex min-h-0 w-full max-w-[100vw] flex-col overflow-hidden rounded-t-3xl border-t shadow-2xl transition-transform duration-200 ease-out ${
          isActive ? "translate-y-0" : "translate-y-full"
        } ${sheetMaxH} ${
          isDark ? "border-zinc-700 bg-zinc-900 text-zinc-100" : "border-blue-200 bg-white text-zinc-900"
        }`}
      >
        <div className="mx-auto mb-1.5 h-1 w-12 shrink-0 rounded-full bg-zinc-400/50" />
        <header
          className={`flex shrink-0 items-start justify-between gap-2 border-b px-3 pb-2 pt-0 ${
            isDark ? "border-zinc-700/90 bg-zinc-900" : "border-blue-100/90 bg-white"
          }`}
        >
          <h3 className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug">{title}</h3>
          <button
            type="button"
            aria-label="Zamknij"
            onClick={onClose}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-base font-semibold leading-none ${
              isDark ? "border-zinc-600 bg-zinc-800 text-zinc-100" : "border-zinc-300 bg-white text-zinc-800"
            }`}
          >
            ✕
          </button>
        </header>
        <div
          className={
            tallList
              ? "flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2"
              : `min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 [-webkit-overflow-scrolling:touch]`
          }
        >
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}
