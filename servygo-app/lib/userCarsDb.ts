import type { SupabaseClient } from "@supabase/supabase-js";

export type UserCarRow = {
  id: string;
  user_id: string;
  vehicle_type: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  fuel: string | null;
  plate_number: string | null;
  vin: string | null;
  city: string | null;
  is_primary: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type StoredVehicle = {
  id: string;
  vehicleType: string;
  brand: string;
  model: string;
  year: string;
  registration: string;
  fuel: string;
  vin: string;
  city: string;
  isPrimary: boolean;
};

export function mapCarToStored(car: UserCarRow): StoredVehicle {
  return {
    id: car.id,
    vehicleType: car.vehicle_type ?? "",
    brand: car.brand ?? "",
    model: car.model ?? "",
    year: car.year ? String(car.year) : "",
    registration: car.plate_number ?? "",
    fuel: car.fuel ?? "",
    vin: car.vin ?? "",
    city: car.city ?? "",
    isPrimary: Boolean(car.is_primary),
  };
}

export async function fetchUserCars(supabase: SupabaseClient, userId: string): Promise<UserCarRow[]> {
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<UserCarRow[]>();
  if (error) throw error;
  return (data as UserCarRow[] | null) ?? [];
}

export async function insertUserCar(
  supabase: SupabaseClient,
  userId: string,
  vehicle: Omit<UserCarRow, "id" | "user_id" | "created_at" | "updated_at">,
): Promise<UserCarRow> {
  const { data, error } = await supabase
    .from("cars")
    .insert({
      user_id: userId,
      vehicle_type: vehicle.vehicle_type,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      fuel: vehicle.fuel,
      plate_number: vehicle.plate_number,
      vin: vehicle.vin,
      city: vehicle.city,
      is_primary: vehicle.is_primary ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as UserCarRow;
}

export async function deleteUserCarRow(supabase: SupabaseClient, carId: string) {
  const { error } = await supabase.from("cars").delete().eq("id", carId);
  if (error) throw error;
}

export async function updateUserCarRow(
  supabase: SupabaseClient,
  userId: string,
  carId: string,
  vehicle: Omit<UserCarRow, "id" | "user_id" | "created_at" | "updated_at">,
): Promise<UserCarRow> {
  const { data, error } = await supabase
    .from("cars")
    .update({
      vehicle_type: vehicle.vehicle_type,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      fuel: vehicle.fuel,
      plate_number: vehicle.plate_number,
      vin: vehicle.vin,
      city: vehicle.city,
      is_primary: vehicle.is_primary ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", carId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as UserCarRow;
}

export async function setUserPrimaryCar(supabase: SupabaseClient, userId: string, carId: string) {
  const { error: clearError } = await supabase
    .from("cars")
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (clearError) throw clearError;

  const { error: setError } = await supabase
    .from("cars")
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq("id", carId)
    .eq("user_id", userId);
  if (setError) throw setError;
}
