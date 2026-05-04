import { getCachedPublicWorkshopById } from "@/lib/cachedPublicWorkshop";
import { buildWorkshopLocalBusinessJsonLd } from "@/lib/workshopJsonLd";

type Props = { id: string };

export async function WorkshopJsonLd({ id }: Props) {
  const workshop = await getCachedPublicWorkshopById(id);
  if (!workshop) return null;
  const json = buildWorkshopLocalBusinessJsonLd(workshop);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
