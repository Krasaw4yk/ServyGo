import type { Metadata } from "next";
import OffersPageClient from "./OffersPageClient";

const baseTitle = "Oferty warsztatów samochodowych — ServyGo";
const baseDescription =
  "Porównuj oferty warsztatów samochodowych: ceny, terminy i zakres usług. Umów wizytę online — ServyGo, startowo Bielsko-Biała i okolice.";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return (value ?? "").trim();
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const cityRaw = firstParam(sp.city);
  const serviceRaw = firstParam(sp.service);

  const city = cityRaw.replace(/\s+/g, " ");
  const service = serviceRaw.replace(/\s+/g, " ");

  const hasContext = Boolean(city || service);
  const title = hasContext
    ? [service || null, city ? `warsztaty ${city}` : null, "ServyGo"].filter(Boolean).join(" — ")
    : baseTitle;

  const description = hasContext
    ? `Porównaj oferty warsztatów${city ? ` w okolicy: ${city}` : ""}${service ? ` dla usługi: ${service}` : ""}. Ceny, terminy i rezerwacja online w ServyGo.`
    : baseDescription;

  return {
    title: title.slice(0, 70),
    description: description.slice(0, 165),
    alternates: { canonical: "/oferty" },
    openGraph: {
      title: title.slice(0, 70),
      description: description.slice(0, 165),
      url: "https://servygo.pl/oferty",
      siteName: "ServyGo",
      locale: "pl_PL",
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export default function OfertyPage() {
  return <OffersPageClient />;
}
