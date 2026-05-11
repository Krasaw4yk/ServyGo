"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { difficultyConfig, normalizeServiceDifficultyLevel } from "@/lib/serviceDifficulty";

export type ServiceDifficultyBadgeProps = {
  difficulty_level?: string | null;
  isDark: boolean;
  className?: string;
  /** Mniejszy wariant w tabelach panelu */
  compact?: boolean;
};

export default function ServiceDifficultyBadge({
  difficulty_level,
  isDark,
  className = "",
  compact = false,
}: ServiceDifficultyBadgeProps) {
  const level = normalizeServiceDifficultyLevel(difficulty_level);
  const cfg = difficultyConfig[level];
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [tapOpen, setTapOpen] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarsePointer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const showTooltip = coarsePointer ? tapOpen : hoverOpen;

  const closeTap = useCallback(() => setTapOpen(false), []);

  useEffect(() => {
    if (!tapOpen || !coarsePointer) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) closeTap();
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [tapOpen, coarsePointer, closeTap]);

  const onBadgePointerDown = (e: React.PointerEvent) => {
    if (!coarsePointer) return;
    e.preventDefault();
    setTapOpen((v) => !v);
  };

  return (
    <span ref={rootRef} className={`relative inline-flex items-center ${className}`}>
      <span
        role="img"
        aria-label={cfg.label}
        aria-describedby={showTooltip ? tooltipId : undefined}
        tabIndex={-1}
        className={`inline-flex max-w-full cursor-default items-center gap-1 rounded-full px-2 py-0.5 text-left font-medium outline-none transition ${cfg.pillClass} ${compact ? "text-[10px] leading-tight" : "text-xs"}`}
        onPointerDown={(e) => {
          if (coarsePointer) e.stopPropagation();
          onBadgePointerDown(e);
        }}
        onMouseEnter={() => {
          if (!coarsePointer) setHoverOpen(true);
        }}
        onMouseLeave={() => {
          if (!coarsePointer) setHoverOpen(false);
        }}
        onFocus={() => {
          if (!coarsePointer) setHoverOpen(true);
        }}
        onBlur={() => {
          if (!coarsePointer) setHoverOpen(false);
        }}
      >
        <span className={`shrink-0 rounded-full ${compact ? "h-1.5 w-1.5" : "h-2 w-2"} ${cfg.dotClass}`} aria-hidden />
        <span className="truncate">{cfg.label}</span>
      </span>
      {showTooltip ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute left-0 top-[calc(100%+6px)] z-50 max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border px-2.5 py-2 text-xs leading-snug shadow-lg ${
            isDark ? "border-zinc-600 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-white text-zinc-800"
          }`}
        >
          {cfg.tooltip}
        </span>
      ) : null}
    </span>
  );
}
