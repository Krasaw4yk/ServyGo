import type { MockWorkshop } from "@/lib/mockWorkshops";

const SITE = "https://servygo.pl";

function openingHoursFromWorkshop(w: MockWorkshop): string | undefined {
  const wd = w.availability?.workingDays;
  const start = w.availability?.openingHours?.start;
  const end = w.availability?.openingHours?.end;
  if (!Array.isArray(wd) || wd.length === 0 || !start || !end) return undefined;
  const dayMap: Record<number, string> = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
  };
  const days = wd
    .filter((d) => d >= 0 && d <= 6)
    .map((d) => dayMap[d])
    .filter(Boolean);
  if (days.length === 0) return undefined;
  return `${days.join(",")} ${start}-${end}`;
}

export function buildWorkshopLocalBusinessJsonLd(w: MockWorkshop) {
  const pageUrl = `${SITE}/warsztat/${encodeURIComponent(w.supabaseId)}`;
  const address = [w.address, w.city].filter((x) => x && x !== "—").join(", ");

  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    "@id": `${pageUrl}#business`,
    name: w.name,
    url: pageUrl,
    description: w.description && w.description !== "—" ? w.description : undefined,
  };

  const street = w.address && w.address !== "—" ? w.address.trim() : "";
  const locality = w.city && w.city !== "—" ? w.city.trim() : "";
  if (street || locality) {
    node.address = {
      "@type": "PostalAddress",
      ...(street ? { streetAddress: street } : {}),
      ...(locality ? { addressLocality: locality } : {}),
      addressCountry: "PL",
    };
  }

  if (Number.isFinite(w.lat) && Number.isFinite(w.lng)) {
    node.geo = {
      "@type": "GeoCoordinates",
      latitude: w.lat,
      longitude: w.lng,
    };
  }

  const hours = openingHoursFromWorkshop(w);
  if (hours) node.openingHours = hours;

  const reviewsOk =
    typeof w.reviewsCount === "number" &&
    w.reviewsCount > 0 &&
    typeof w.rating === "number" &&
    Number.isFinite(w.rating) &&
    w.rating > 0;
  if (reviewsOk) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: w.rating,
      reviewCount: w.reviewsCount,
    };
  }

  return node;
}
