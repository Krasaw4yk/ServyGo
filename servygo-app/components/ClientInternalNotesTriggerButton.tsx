"use client";

import type { ButtonHTMLAttributes } from "react";
import { useServyGoTranslator } from "@/lib/useServyGoLanguage";

function IconClipboardNote({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 4h6M9 4a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V6a2 2 0 00-2-2M9 4a2 2 0 012-2h2a2 2 0 012 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const gradientBase =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-semibold " +
  "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm shadow-blue-500/20 " +
  "transition-[transform,filter,background-image] duration-150 " +
  "hover:from-blue-500 hover:to-violet-500 hover:shadow-md hover:shadow-blue-500/25 " +
  "active:scale-[0.98] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white " +
  "dark:focus-visible:ring-offset-zinc-900 " +
  "disabled:pointer-events-none disabled:opacity-40";

export type ClientInternalNotesTriggerButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & {
  /** `"compact"` — tabela / gęsty układ (`text-xs`); `"comfortable"` — modal szczegółów (`text-sm`). */
  density?: "compact" | "comfortable";
  className?: string;
};

export default function ClientInternalNotesTriggerButton({
  density = "compact",
  className = "",
  type = "button",
  ...rest
}: ClientInternalNotesTriggerButtonProps) {
  const { t } = useServyGoTranslator();
  const sizing = density === "comfortable" ? "px-3 py-2 text-sm" : "px-3 py-2 text-xs";

  return (
    <button type={type} className={`${gradientBase} ${sizing} ${className}`} {...rest}>
      <IconClipboardNote className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
      {t("clientInternalNotes.openButton")}
    </button>
  );
}
