"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  fetchRecommendedWorkshopsForHome,
  type RecommendedWorkshopCard,
} from "@/lib/publicWorkshopsFromDb";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type RecommendedWorkshopsSectionProps = {
  isDark: boolean;
  city: string;
};

function formatRating(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** PL: 1 opinia, 2–4 opinie (z wyjątkami 12–14), reszta opinii */
function opinionLabelPlural(n: number): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "opinia";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "opinie";
  return "opinii";
}

function WorkshopCardShell({ isDark, children }: { isDark: boolean; children: ReactNode }) {
  return (
    <article
      className={`flex h-full min-w-0 flex-col overflow-hidden rounded-xl border p-3 transition duration-300 hover:-translate-y-1 md:rounded-2xl md:p-3 ${
        isDark
          ? "border-zinc-700 bg-zinc-900/80 hover:shadow-md"
          : "border-blue-100/90 bg-white shadow-[0_12px_30px_rgba(37,99,235,0.08),0_6px_18px_rgba(249,115,22,0.06)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.14),0_10px_30px_rgba(249,115,22,0.10)]"
      }`}
    >
      {children}
    </article>
  );
}

export default function RecommendedWorkshopsSection({ isDark, city }: RecommendedWorkshopsSectionProps) {
  const [workshops, setWorkshops] = useState<RecommendedWorkshopCard[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchRecommendedWorkshopsForHome(4);
        if (!cancelled) setWorkshops(list);
      } catch {
        if (!cancelled) setWorkshops([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="dla-warsztatow" className="scroll-mt-28 mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className={`text-xl font-bold sm:text-2xl ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>Polecane warsztaty dla Ciebie</h2>
        <Link href="/oferty" className={`shrink-0 text-xs font-semibold sm:text-sm ${isDark ? "text-blue-300" : "text-blue-600"}`}>
          Zobacz wszystkie
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4 xl:gap-5">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className={`h-[200px] animate-pulse rounded-xl border md:rounded-2xl ${
                  isDark ? "border-zinc-700 bg-zinc-900/80" : "border-blue-100/90 bg-white"
                }`}
              />
            ))
          : workshops.map((w) => (
              <WorkshopCardShell key={w.id} isDark={isDark}>
                <div className="relative mb-2 shrink-0 md:mb-3">
                  {w.coverPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.coverPhotoUrl}
                      alt={w.name}
                      className="h-[100px] w-full rounded-lg object-cover md:h-28 md:rounded-xl"
                    />
                  ) : (
                    <div
                      className={`h-[100px] rounded-lg md:h-28 md:rounded-xl ${isDark ? "bg-zinc-800" : "bg-gradient-to-br from-slate-100 to-blue-50"}`}
                    />
                  )}
                  <button
                    type="button"
                    aria-label="Dodaj do ulubionych"
                    className={`absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm leading-none transition-colors md:right-1.5 md:top-1.5 md:h-8 md:w-8 md:text-lg ${
                      isDark ? "bg-zinc-900/70 text-orange-300 hover:text-blue-300" : "bg-white/90 text-orange-400 shadow-sm hover:text-blue-500"
                    }`}
                  >
                    ♡
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <h3
                    className={`line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug md:min-h-0 md:text-base ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
                  >
                    {w.name}
                  </h3>
                  <p className={`mt-1 text-xs md:text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    {w.rating > 0 ? (
                      <>
                        <span className="text-orange-400">⭐</span> {formatRating(w.rating)} • {w.reviewsCount}{" "}
                        {opinionLabelPlural(w.reviewsCount)}
                      </>
                    ) : (
                      <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>Brak ocen Google</span>
                    )}
                  </p>
                  <p className={`mt-0.5 truncate text-xs md:text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    {w.city || city || "Twoje miasto"}
                  </p>
                  <Link
                    href={`/warsztat/${w.id}`}
                    className={`mt-auto inline-flex max-w-full shrink-0 pt-2 text-xs font-semibold md:text-sm ${isDark ? "text-blue-300" : "text-blue-600"}`}
                  >
                    <span className="md:hidden">Sprawdź</span>
                    <span className="hidden md:inline">Sprawdź warsztat</span>
                  </Link>
                </div>
              </WorkshopCardShell>
            ))}
      </div>
    </section>
  );
}
