import type { Metadata } from "next";
import { getCachedPublicWorkshopById } from "@/lib/cachedPublicWorkshop";
import WorkshopDetailsClient from "./WorkshopDetailsClient";
import { WorkshopJsonLd } from "./WorkshopJsonLd";
import { WorkshopServerSeoBlock } from "./WorkshopServerSeoBlock";

const SITE = "https://servygo.pl";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const workshop = await getCachedPublicWorkshopById(id);

  if (!workshop) {
    return {
      title: "Warsztat niedostępny — ServyGo",
      description:
        "Nie znaleziono aktywnego warsztatu. Przeglądaj oferty warsztatów samochodowych w ServyGo — porównaj ceny i terminy.",
      alternates: { canonical: `/warsztat/${id}` },
      robots: { index: false, follow: true },
    };
  }

  const serviceNames = workshop.services
    .map((s) => s.service_name)
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");
  const rawDesc = workshop.description && workshop.description !== "—" ? workshop.description.trim() : "";
  const description = (
    rawDesc
      ? `${rawDesc.slice(0, 100)}${rawDesc.length > 100 ? "…" : ""} ${serviceNames ? `Usługi: ${serviceNames}.` : ""}`
      : `${workshop.name} — warsztat samochodowy w ${workshop.city}. ${serviceNames ? `Usługi: ${serviceNames}.` : ""} Porównaj ofertę i umów wizytę przez ServyGo.`
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 165);

  return {
    title: `${workshop.name} — ${workshop.city} | ServyGo`,
    description: description || `${workshop.name} w ${workshop.city} — ServyGo`,
    alternates: { canonical: `/warsztat/${workshop.supabaseId}` },
    openGraph: {
      title: `${workshop.name} — ServyGo`,
      description: description || `${workshop.name} w ${workshop.city}`,
      url: `${SITE}/warsztat/${workshop.supabaseId}`,
      type: "website",
      locale: "pl_PL",
      siteName: "ServyGo",
    },
  };
}

export default async function WorkshopPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <>
      <WorkshopJsonLd id={id} />
      <WorkshopServerSeoBlock id={id} />
      <WorkshopDetailsClient />
    </>
  );
}
