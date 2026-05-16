/** Współrzędne centrum miasta do odległości na /oferty (haversine). Klucze bez ogonków, małe litery. */
export function normalizeOffersCityKey(city: string): string {
  return (city ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l");
}

export const OFFERS_CITY_CENTER_COORDS: Record<string, { lat: number; lng: number }> = {
  "bielsko-biala": { lat: 49.8225, lng: 19.0444 },
  krakow: { lat: 50.06, lng: 19.94 },
  warszawa: { lat: 52.23, lng: 21.01 },
  wroclaw: { lat: 51.11, lng: 17.04 },
  gdansk: { lat: 54.35, lng: 18.65 },
  poznan: { lat: 52.41, lng: 16.93 },
  katowice: { lat: 50.26, lng: 19.02 },
  lodz: { lat: 51.76, lng: 19.46 },
  szczecin: { lat: 53.43, lng: 14.55 },
  bydgoszcz: { lat: 53.12, lng: 18.01 },
  lublin: { lat: 51.25, lng: 22.57 },
  rzeszow: { lat: 50.04, lng: 21.99 },
  czestochowa: { lat: 50.81, lng: 19.12 },
};

export function getApproxCityCenterCoords(city: string | null): { lat: number; lng: number } {
  const key = normalizeOffersCityKey(city ?? "");
  if (key && OFFERS_CITY_CENTER_COORDS[key]) return OFFERS_CITY_CENTER_COORDS[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return { lat: 50.2 + (h % 900) / 2500, lng: 18.5 + (h % 1100) / 2200 };
}

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
