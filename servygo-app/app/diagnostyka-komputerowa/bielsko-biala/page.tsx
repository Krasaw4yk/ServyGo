import type { Metadata } from "next";
import Link from "next/link";

const canonicalPath = "/diagnostyka-komputerowa/bielsko-biala";
const offersHref = `/oferty?city=${encodeURIComponent("bielsko-biała")}&service=${encodeURIComponent("diagnostyka komputerowa")}`;

export const metadata: Metadata = {
  title: "Diagnostyka komputerowa Bielsko-Biała — ServyGo",
  description:
    "Diagnostyka komputerowa w Bielsku-Białej: znajdź warsztat z odpowiednim sprzętem, porównaj oferty i terminy na ServyGo.",
  alternates: { canonical: canonicalPath },
  openGraph: {
    title: "Diagnostyka komputerowa Bielsko-Biała — ServyGo",
    description: "Porównaj warsztaty pod diagnostykę OBD / komputerową w regionie — ServyGo.",
    url: `https://servygo.pl${canonicalPath}`,
    siteName: "ServyGo",
    locale: "pl_PL",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function DiagnostykaKomputerowaBielskoPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-800 dark:text-zinc-100">
      <article className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Diagnostyka komputerowa — Bielsko-Biała</h1>
        <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
          Odczyt kodów usterek, testy parametrów i przygotowanie planu naprawy często zaczynają się od diagnostyki
          komputerowej. Na ServyGo wybierzesz warsztat z Bielska-Białej i okolic i porównasz dostępność terminów.
        </p>
        {/* TODO: Rozbudowa — opis procesu, kiedy jechać, JSON-LD Service. */}
        <p>
          <Link
            href={offersHref}
            className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Oferty: diagnostyka w Bielsku-Białej
          </Link>
        </p>
      </article>
    </main>
  );
}
