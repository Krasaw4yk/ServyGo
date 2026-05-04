"use client";

import type { MouseEvent, ReactNode } from "react";

type Variant = "row" | "block";

function activateMobileSearchControl(event: MouseEvent<HTMLDivElement>) {
  if (typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches) return;
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, select, button, a, label")) return;
  const root = event.currentTarget;
  const combobox = root.querySelector<HTMLInputElement>('input[role="combobox"]');
  if (combobox && !combobox.disabled) {
    combobox.focus({ preventScroll: true });
    combobox.click();
    return;
  }
  const plain = root.querySelector<HTMLInputElement | HTMLTextAreaElement>("input:not([type='hidden']), textarea");
  if (plain && !(plain as HTMLInputElement).disabled) {
    plain.focus({ preventScroll: true });
    plain.click();
  }
}

function focusMobileTextareaCard(event: MouseEvent<HTMLDivElement>) {
  if (typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches) return;
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, button, a")) return;
  event.currentTarget.querySelector("textarea")?.focus({ preventScroll: true });
}

type MobileCompactSearchFieldProps = {
  label: string;
  isDark: boolean;
  icon: ReactNode;
  children: ReactNode;
  error?: ReactNode;
  variant?: Variant;
  className?: string;
};

export function MobileCompactSearchField({
  label,
  isDark,
  icon,
  children,
  error,
  variant = "row",
  className = "",
}: MobileCompactSearchFieldProps) {
  const muted = isDark ? "text-zinc-400" : "text-zinc-500";
  const heading = isDark ? "text-zinc-100" : "text-zinc-900";
  const card = isDark
    ? "max-md:border-zinc-600/75 max-md:bg-zinc-900/80"
    : "max-md:border-blue-200/90 max-md:bg-white";

  if (variant === "block") {
    return (
      <div
        className={`flex w-full flex-col gap-1.5 max-md:gap-1.5 md:col-span-2 md:gap-2 xl:col-span-3 ${className}`}
      >
        <span className={`hidden text-sm font-medium md:block ${heading}`}>{label}</span>
        <div
          role="presentation"
          onClick={focusMobileTextareaCard}
          className={`max-md:cursor-pointer max-md:rounded-xl max-md:border max-md:p-3 ${card} md:cursor-default md:border-0 md:bg-transparent md:p-0`}
        >
          <div className={`mb-2 flex items-center gap-2 md:hidden`}>
            <span
              className={`pointer-events-none flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                isDark ? "bg-zinc-800 text-blue-300" : "bg-blue-50 text-blue-600"
              }`}
            >
              {icon}
            </span>
            <span className={`pointer-events-none text-[12px] font-medium leading-tight ${muted}`}>{label}</span>
          </div>
          <div className="w-full">{children}</div>
        </div>
        {error}
      </div>
    );
  }

  return (
    <div className={`flex w-full flex-col gap-1.5 md:gap-2 ${className}`}>
      <span className={`hidden text-sm font-medium md:block ${heading}`}>{label}</span>
      <div
        role="presentation"
        onClick={activateMobileSearchControl}
        className={`flex w-full min-w-0 cursor-default items-center gap-2.5 max-md:min-h-[52px] max-md:cursor-pointer max-md:rounded-xl max-md:border max-md:px-3 max-md:py-2 ${card} md:block md:min-h-0 md:cursor-default md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none`}
      >
        <span
          className={`pointer-events-none hidden h-5 w-5 shrink-0 max-md:block ${isDark ? "text-blue-300" : "text-blue-600"}`}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 md:w-full">
          <span className={`pointer-events-none mb-0.5 text-[12px] font-medium leading-snug max-md:block md:hidden ${muted}`}>
            {label}
          </span>
          <div className="w-full">{children}</div>
        </div>
      </div>
      {error}
    </div>
  );
}

const iconClass = "h-5 w-5";

export const searchFormFieldIconMap = {
  vehicleType: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <path d="M4 13h16l-1-4H5L4 13Z" />
      <path d="M6 17h2M16 17h2" />
      <circle cx="7.5" cy="17" r="1.5" />
      <circle cx="16.5" cy="17" r="1.5" />
      <path d="M5 13 6 8h12l1 5" />
    </svg>
  ),
  brand: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <path d="M4 7h6v10H4V7Z" />
      <path d="M14 7h6v6h-6V7Z" />
      <path d="M14 15h6v2h-6v-2Z" />
    </svg>
  ),
  model: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <path d="M4 6h16v12H4V6Z" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  ),
  year: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 11h16" />
    </svg>
  ),
  fuel: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <path d="M6 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14" />
      <path d="M16 10h2l2 3v5a1 1 0 0 1-1 1h-1" />
      <path d="M6 14h8" />
    </svg>
  ),
  service: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <path d="M14.7 6.3a6 6 0 0 1 0 8.485l-4.95 4.95a6 6 0 0 1-8.485-8.485l1.768-1.768" />
      <path d="M9.3 17.7a6 6 0 0 1 0-8.485l4.95-4.95a6 6 0 0 1 8.485 8.485l-1.768 1.768" />
    </svg>
  ),
  problem: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
      <path d="M8 14h8" />
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  ),
  city: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  vin: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <path d="M4 7h4v10H4V7Z" />
      <path d="M10 7h4v10h-4V7Z" />
      <path d="M16 7h4v10h-4V7Z" />
    </svg>
  ),
} as const;
