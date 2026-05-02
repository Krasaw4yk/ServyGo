import type { WorkshopServiceOffer } from "@/lib/mockWorkshops";
import { matchWorkshopServicesForVehicle, type VehicleSearchCriteria } from "@/lib/publicWorkshopsFromDb";
import { getVehicleTypeLabel, type VehicleTypeKey } from "@/lib/vehicleData";

export function buildFavoriteMatchCriteria(
  vehicleTypeKey: string,
  brand: string,
  model: string,
  yearStr: string,
  fuel: string,
): Omit<VehicleSearchCriteria, "service"> {
  const yearNum = yearStr ? Number.parseInt(yearStr.trim(), 10) : Number.NaN;
  const vtLabel = vehicleTypeKey ? getVehicleTypeLabel(vehicleTypeKey as VehicleTypeKey) : "";
  return {
    vehicleType: vtLabel,
    brand,
    model,
    year: Number.isFinite(yearNum) ? yearNum : null,
    fuel,
    engine: fuel,
  };
}

export function isCatalogServiceAvailableInWorkshopOffers(
  offers: WorkshopServiceOffer[],
  criteria: Omit<VehicleSearchCriteria, "service">,
  catalogServiceName: string,
): boolean {
  if (!catalogServiceName.trim()) return false;
  const matches = matchWorkshopServicesForVehicle(offers, {
    ...criteria,
    service: catalogServiceName,
  });
  return matches.length > 0;
}

export function priceHintFromMatches(matches: WorkshopServiceOffer[]): string | undefined {
  const m = matches[0];
  if (!m) return undefined;
  if (m.price_from != null && m.price_to != null && m.price_to >= m.price_from) {
    return `${m.price_from}–${m.price_to} zł`;
  }
  if (m.price_from != null) return `od ${m.price_from} zł`;
  if (m.price_to != null) return `do ${m.price_to} zł`;
  if (typeof m.price === "number" && Number.isFinite(m.price) && m.price > 0) return `od ${m.price} zł`;
  return undefined;
}

export function getCatalogServiceMatchesInWorkshop(
  offers: WorkshopServiceOffer[],
  criteria: Omit<VehicleSearchCriteria, "service">,
  catalogServiceName: string,
): WorkshopServiceOffer[] {
  return matchWorkshopServicesForVehicle(offers, {
    ...criteria,
    service: catalogServiceName,
  });
}
