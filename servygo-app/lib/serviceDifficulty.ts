export type ServiceDifficultyLevel = "low" | "medium" | "high";

/** Zgodność ze starymi rekordami i wartościami spoza CHECK — zawsze zwraca jeden z trzech poziomów. */
export function normalizeServiceDifficultyLevel(raw: string | null | undefined): ServiceDifficultyLevel {
  const v = (raw ?? "").toLowerCase().trim();
  if (v === "low" || v === "high" || v === "medium") return v;
  return "medium";
}

export const difficultyConfig: Record<
  ServiceDifficultyLevel,
  { label: string; tooltip: string; pillClass: string; dotClass: string }
> = {
  low: {
    label: "Niski",
    tooltip: "Poziom trudności: niski. Prosta usługa.",
    pillClass:
      "border border-emerald-600/35 bg-emerald-500/15 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-100",
    dotClass: "bg-emerald-500 dark:bg-emerald-400",
  },
  medium: {
    label: "Średni",
    tooltip: "Poziom trudności: średni. Usługa może wymagać więcej czasu.",
    pillClass:
      "border border-amber-500/45 bg-amber-400/25 text-amber-950 dark:border-amber-400/50 dark:bg-amber-500/20 dark:text-amber-50",
    dotClass: "bg-amber-500 dark:bg-amber-400",
  },
  high: {
    label: "Wysoki",
    tooltip: "Poziom trudności: wysoki. Usługa bardziej skomplikowana.",
    pillClass:
      "border border-rose-600/40 bg-rose-500/15 text-rose-900 dark:border-rose-400/45 dark:bg-rose-600/25 dark:text-rose-50",
    dotClass: "bg-rose-600 dark:bg-rose-500",
  },
};
