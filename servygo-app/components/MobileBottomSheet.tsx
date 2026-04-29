"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type MobileBottomSheetProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  isDark?: boolean;
  fixedHeight?: boolean;
};

export default function MobileBottomSheet({
  isOpen,
  title,
  onClose,
  children,
  isDark = false,
  fixedHeight = false,
}: MobileBottomSheetProps) {
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
    <div className="fixed inset-0 z-[9999] sm:hidden">
      <button
        type="button"
        aria-label="Zamknij panel"
        className={`absolute inset-0 z-0 bg-black/30 transition-opacity duration-200 ease-out ${isActive ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        className={`absolute bottom-0 left-0 right-0 z-10 w-full max-w-[100vw] overflow-hidden rounded-t-3xl border-t px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-200 ease-out ${
          isActive ? "translate-y-0" : "translate-y-full"
        } ${
          isDark
            ? "border-zinc-700 bg-zinc-900 text-zinc-100"
            : "border-blue-200 bg-white text-zinc-900"
        }`}
        style={{
          maxHeight: "min(70dvh, 560px)",
          height: fixedHeight ? "min(70dvh, 560px)" : undefined,
        }}
      >
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-zinc-400/50" />
        <header className="mb-3 flex items-center justify-between gap-3">
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
        <div className={`min-w-0 overflow-x-hidden ${fixedHeight ? "flex min-h-0 flex-1 flex-col" : ""}`}>
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}
