import { translations } from "@/lib/translations";

const SITE = "https://servygo.pl";

function plHomeSeoFaqForSchema(): { title: string; desc: string }[] {
  const landing = translations.pl.landing;
  const raw =
    landing && typeof landing === "object" && "homeSeoFaqItems" in landing
      ? (landing as { homeSeoFaqItems?: unknown }).homeSeoFaqItems
      : undefined;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is { title: string; desc: string } =>
      Boolean(x) && typeof x === "object" && "title" in x && "desc" in x,
  ) as { title: string; desc: string }[];
}

export function buildHomeOrganizationJsonLd() {
  const faqItems = plHomeSeoFaqForSchema();
  const faqPage =
    faqItems.length > 0
      ? [
          {
            "@type": "FAQPage",
            "@id": `${SITE}/#faq`,
            url: `${SITE}/`,
            inLanguage: "pl-PL",
            isPartOf: { "@id": `${SITE}/#website` },
            mainEntity: faqItems.map((item) => ({
              "@type": "Question",
              name: item.title,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.desc,
              },
            })),
          },
        ]
      : [];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: "ServyGo",
        url: SITE,
        description:
          "ServyGo to platforma łącząca kierowców z warsztatami samochodowymi: wyszukiwanie, porównywanie ofert, cen i terminów oraz umawianie wizyt online. Startowo Bielsko-Biała i okolice.",
        areaServed: {
          "@type": "City",
          name: "Bielsko-Biała",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: SITE,
        name: "ServyGo",
        description:
          "Znajdź warsztat samochodowy, porównaj oferty i umów wizytę online. Dla kierowców i warsztatów — Bielsko-Biała i okolice na start.",
        publisher: { "@id": `${SITE}/#organization` },
        inLanguage: "pl-PL",
      },
      ...faqPage,
    ],
  };
}
