import { buildHomeOrganizationJsonLd } from "@/lib/homeJsonLd";

export function HomePageJsonLd() {
  const json = buildHomeOrganizationJsonLd();
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
