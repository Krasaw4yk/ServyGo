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
};

export default function MobileBottomSheet({
  isOpen,
  title,
  onClose,
  children,
  isDark = false,
  tallList: tallListProp,
  fixedHeight = false,
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

  return createPortal(
    <div className={`fixed inset-0 z-[9999] sm:hidden ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
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
        className={`absolute bottom-0 left-0 right-0 z-10 flex max-w-[100vw] flex-col overflow-hidden rounded-t-3xl border-t px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-200 ease-out ${
          isActive ? "translate-y-0" : "translate-y-full"
        } ${tallList ? "h-auto max-h-[85dvh] min-h-[60dvh]" : "h-auto max-h-[85dvh]"} ${
          isDark ? "border-zinc-700 bg-zinc-900 text-zinc-100" : "border-blue-200 bg-white text-zinc-900"
        }`}
      >
        <div className="mx-auto mb-2 h-1.5 w-12 shrink-0 rounded-full bg-zinc-400/50" />
        <header className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl border px-3 py-1.5 text-sm font-medium ${
              isDark ? "border-zinc-600 text-zinc-200" : "border-zinc-300 text-zinc-700"
            }`}
          >
            ✕
          </button>
        </header>
        <div
          className={
            tallList
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden overscroll-contain [-webkit-overflow-scrolling:touch]"
              : "max-h-[calc(85dvh-7.5rem)] min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
          }
        >
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}
