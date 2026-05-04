import type { Metadata } from "next";
import Link from "next/link";

const canonicalPath = "/wymiana-oleju/bielsko-biala";
const offersHref = `/oferty?city=${encodeURIComponent("bielsko-biała")}&service=${encodeURIComponent("wymiana oleju")}`;

export const metadata: Metadata = {
  title: "Wymiana oleju Bielsko-Biała — ServyGo",
  description:
    "Wymiana oleju w Bielsku-Białej i okolicach: porównaj oferty warsztatów, ceny i terminy na ServyGo i umów wizytę online.",
  alternates: { canonical: canonicalPath },
  openGraph: {
    title: "Wymiana oleju Bielsko-Biała — ServyGo",
    description: "Porównaj warsztaty pod wymianę oleju w Bielsku-Białej — ServyGo.",
    url: `https://servygo.pl${canonicalPath}`,
    siteName: "ServyGo",
    locale: "pl_PL",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function WymianaOlejuBielskoPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-800 dark:text-zinc-100">
      <article className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Wymiana oleju — Bielsko-Biała</h1>
        <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
          Regularna wymiana oleju silnikowego to podstawa trwałości jednostki napędowej. Na ServyGo znajdziesz
          warsztaty z Bielska-Białej i okolic, które publikują oferty i terminy — możesz je porównać przed rezerwacją.
        </p>
        {/* TODO: Rozbudowa SEO — poradnik, częstości, typy olejów, JSON-LD FAQ. */}
        <p>
          <Link
            href={offersHref}
            className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Oferty: wymiana oleju w Bielsku-Białej
          </Link>
        </p>
      </article>
    </main>
  );
}
