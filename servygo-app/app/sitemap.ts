import type { MetadataRoute } from "next";
import { listPublicWorkshopIdsForSitemap } from "@/lib/sitemapWorkshops";

const base = "https://servygo.pl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/oferty`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/dodaj-warsztat`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    {
      url: `${base}/warsztat-samochodowy/bielsko-biala`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: `${base}/wymiana-oleju/bielsko-biala`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: `${base}/diagnostyka-komputerowa/bielsko-biala`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.65,
    },
  ];

  let workshopEntries: MetadataRoute.Sitemap = [];
  try {
    const ids = await listPublicWorkshopIdsForSitemap();
    workshopEntries = ids.map((id) => ({
      url: `${base}/warsztat/${id}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    }));
  } catch {
    // Brak env / błąd Supabase — tylko wpisy statyczne.
  }

  return [...staticEntries, ...workshopEntries];
}
