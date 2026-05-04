import type { Metadata } from "next";
import Link from "next/link";

const canonicalPath = "/warsztat-samochodowy/bielsko-biala";
const offersHref = `/oferty?city=${encodeURIComponent("bielsko-biała")}`;

export const metadata: Metadata = {
  title: "Warsztat samochodowy Bielsko-Biała — ServyGo",
  description:
    "Szukasz warsztatu samochodowego w Bielsku-Białej i okolicach? Na ServyGo porównasz oferty, ceny i terminy oraz umówisz wizytę online.",
  alternates: { canonical: canonicalPath },
  openGraph: {
    title: "Warsztat samochodowy Bielsko-Biała — ServyGo",
    description:
      "Lokalne warsztaty w Bielsku-Białej: porównanie ofert i rezerwacja online przez ServyGo.",
    url: `https://servygo.pl${canonicalPath}`,
    siteName: "ServyGo",
    locale: "pl_PL",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function WarsztatSamochodowyBielskoPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-800 dark:text-zinc-100">
      <article className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Warsztat samochodowy — Bielsko-Biała</h1>
        <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
          ServyGo zbiera oferty warsztatów z regionu, żebyś mógł porównać zakres prac, orientacyjne ceny i dostępne
          terminy w jednym miejscu.
        </p>
        {/* TODO: Rozbudowa pod SEO lokalne — treści unikalne per usługa, FAQ, dane strukturalne BreadcrumbList. */}
        <p>
          <Link
            href={offersHref}
            className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Zobacz oferty w Bielsku-Białej
          </Link>
        </p>
      </article>
    </main>
  );
}
