"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import { useIsClient } from "@/lib/useIsClient";

type LegalDocumentPageShellProps = {
  title: string;
  updatedLine: string;
  contentId: string;
  children: (isDark: boolean) => ReactNode;
};

export function LegalDocumentPageShell({ title, updatedLine, contentId, children }: LegalDocumentPageShellProps) {
  const mounted = useIsClient();
  const theme = useMemo<"light" | "dark">(() => {
    if (!mounted) return "light";
    const saved = window.localStorage.getItem("servygo-theme");
    return saved === "light" || saved === "dark" ? saved : "light";
  }, [mounted]);

  const isDark = theme === "dark";

  return (
    <ServyGoPageShell isDark={isDark}>
      <main
        className={`mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6 lg:max-w-[52rem] ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
      >
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex">
            <Image
              src={isDark ? "/servygo-logo-dark-cropped.png" : "/servygo-logo-light-cropped.png"}
              alt="ServyGo"
              width={186}
              height={70}
              className="h-9 w-auto object-contain sm:h-10"
            />
          </Link>
          <Link href="/" className={`text-sm font-semibold underline ${isDark ? "text-blue-300" : "text-blue-700"}`}>
            Wróć na stronę główną
          </Link>
        </header>

        <article
          className={`rounded-2xl border p-5 sm:p-8 shadow-sm ${isDark ? "border-zinc-600 bg-zinc-900/90" : "border-blue-200/90 bg-white"}`}
        >
          <h1 className={`text-2xl font-bold leading-tight sm:text-3xl ${isDark ? "text-zinc-50" : "text-zinc-950"}`}>{title}</h1>
          <p className={`mt-3 text-sm font-medium sm:text-base ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{updatedLine}</p>

          <div id={contentId} className="mt-8">
            {children(isDark)}
          </div>

          <div className={`mt-10 border-t border-dashed pt-8 ${isDark ? "border-zinc-600/60" : "border-zinc-300/80"}`}>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-6 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Wróć na stronę główną
            </Link>
          </div>
        </article>
      </main>
    </ServyGoPageShell>
  );
}
