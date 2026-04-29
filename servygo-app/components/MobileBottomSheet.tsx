"use client";

import { useEffect } from "react";

type MobileBottomSheetProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  isDark?: boolean;
};

export default function MobileBottomSheet({
  isOpen,
  title,
  onClose,
  children,
  isDark = false,
}: MobileBottomSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] sm:hidden">
      <button
        type="button"
        aria-label="Zamknij panel"
        className="absolute inset-0 bg-zinc-950/55 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        className={`absolute bottom-0 left-0 right-0 max-h-[85vh] w-screen overflow-y-auto rounded-t-3xl border-t p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl ${
          isDark
            ? "border-zinc-700 bg-zinc-900 text-zinc-100"
            : "border-blue-200 bg-white text-zinc-900"
        }`}
      >
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
        {children}
      </section>
    </div>
  );
}
