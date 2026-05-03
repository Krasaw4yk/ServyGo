"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BuildMeta = {
  display?: string;
  semver?: string;
  build?: number;
};

type LandingCtaFooterProps = {
  isDark: boolean;
  onOpenContact: () => void;
  onOpenFaq: () => void;
};

export default function LandingCtaFooter({ isDark, onOpenContact, onOpenFaq }: LandingCtaFooterProps) {
  const [versionLine, setVersionLine] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/build-meta.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BuildMeta | null) => {
        if (cancelled || !data) return;
        const v = typeof data.display === "string" && data.display.trim() ? data.display.trim() : data.semver ?? "";
        setVersionLine(v ? `Wersja ${v}` : "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const year = new Date().getFullYear();

  return (
    <>
      <section className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className={`rounded-2xl border p-5 ${isDark ? "border-blue-500/30 bg-gradient-to-r from-blue-950/40 to-orange-950/20" : "border-orange-200/80 bg-gradient-to-r from-orange-50 via-white to-yellow-50 shadow-[0_14px_34px_rgba(249,115,22,0.12)]"}`}>
          <h3 className="text-xl font-semibold">Zaproś warsztat i zyskaj!</h3>
          <p className={`mt-2 text-sm ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>Poleć serwis z Twojej okolicy i pomóż mu dołączyć do ServyGo.</p>
          <button type="button" className="mt-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.28)]">
            Zaproś teraz
          </button>
        </article>
        <article
          id="kontakt"
          className={`scroll-mt-28 rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/75" : "border-blue-200/80 bg-gradient-to-r from-blue-50 via-white to-sky-50 shadow-[0_14px_34px_rgba(37,99,235,0.12)]"}`}
        >
          <h3 className="text-xl font-semibold">Potrzebujesz pomocy?</h3>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={onOpenFaq}
              className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "border-blue-300 text-blue-700 hover:bg-blue-50"}`}
            >
              FAQ
            </button>
            <button
              type="button"
              onClick={onOpenContact}
              className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "border-blue-300 text-blue-700 hover:bg-blue-50"}`}
            >
              Skontaktuj się z nami
            </button>
            <Link href="/zglos-problem" className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "border-blue-300 text-blue-700 hover:bg-blue-50"}`}>
              Zgłoś problem
            </Link>
          </div>
        </article>
      </section>

      <footer className={`mt-12 border-t pb-2 pt-6 ${isDark ? "border-zinc-700 text-zinc-300" : "border-blue-100/80 bg-gradient-to-r from-white via-blue-50/40 to-orange-50/30 text-zinc-600"}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap gap-4 text-sm sm:order-1">
            <a href="#" className="hover:text-blue-600">
              Regulamin
            </a>
            <a href="#" className="hover:text-blue-600">
              Polityka prywatności
            </a>
            <button type="button" onClick={onOpenContact} className="hover:text-blue-600">
              Kontakt
            </button>
          </div>
          <div className="sm:order-2 sm:ml-auto sm:min-w-[200px] sm:pl-8 sm:text-right">
            <div className="font-semibold text-blue-600">ServyGo</div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              © {year} ServyGo
              {versionLine ? <span className="text-zinc-400"> · {versionLine}</span> : null}
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
