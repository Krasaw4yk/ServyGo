/** Parsowanie vehicle_data z bookings (JSON zapisany przy rezerwacji). */

export type ParsedBookingVehicle = {
  vehicleType: string;
  brand: string;
  model: string;
  year: string;
  engine: string;
  fuel: string;
  vin: string;
  plate: string;
  city: string;
};

export function parseBookingVehicleData(raw: unknown): ParsedBookingVehicle {
  const empty: ParsedBookingVehicle = {
    vehicleType: "",
    brand: "",
    model: "",
    year: "",
    engine: "",
    fuel: "",
    vin: "",
    plate: "",
    city: "",
  };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const yearRaw = o.year;
  const yearStr =
    yearRaw === null || yearRaw === undefined || String(yearRaw).trim() === ""
      ? ""
      : String(yearRaw).trim();
  return {
    vehicleType: String(o.vehicle_type_label ?? o.vehicle_type ?? "").trim(),
    brand: String(o.brand ?? "").trim(),
    model: String(o.model ?? "").trim(),
    year: yearStr,
    engine: String(o.engine ?? "").trim(),
    fuel: String(o.fuel ?? "").trim(),
    vin: String(o.vin ?? "").trim().toUpperCase(),
    plate: String(o.plate_number ?? "").trim(),
    city: String(o.city ?? "").trim(),
  };
}

export function dash(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  return t.length ? t : "—";
}
