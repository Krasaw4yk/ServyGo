/** Wspólna typografia dokumentów prawnych (/regulamin, /polityka-prywatnosci). `isDark` pochodzi z motywu ServyGo (nie z klasy Tailwind `dark`). */

export function getLegalDocTypography(isDark: boolean) {
  const bodyClass = "text-sm leading-relaxed sm:text-[15px] sm:leading-relaxed";

  return {
    bodyClass,
    h2Class: `mt-10 scroll-mt-24 text-base font-bold sm:text-lg ${isDark ? "text-zinc-50" : "text-zinc-950"}`,
    /** Podsekcje numerowane (np. 3.1). */
    h3SectionClass: `mt-6 scroll-mt-20 text-[15px] font-semibold sm:text-base ${isDark ? "text-zinc-50" : "text-zinc-950"}`,
    pClass: `mt-3 ${isDark ? "text-zinc-100" : "text-zinc-900"}`,
    olClass: `mt-3 list-decimal space-y-2 pl-5 marker:font-semibold ${isDark ? "text-zinc-100" : "text-zinc-900"}`,
    introClass: `mt-0 ${isDark ? "text-zinc-200" : "text-zinc-800"}`,
    wrapClass: `${bodyClass} ${isDark ? "text-zinc-100" : "text-zinc-950"}`,
    mailLinkClass: isDark
      ? "font-semibold text-sky-300 underline decoration-sky-300/90 underline-offset-2 hover:text-orange-200"
      : "font-semibold text-blue-800 underline decoration-blue-800/80 underline-offset-2 hover:text-orange-700",
  };
}
