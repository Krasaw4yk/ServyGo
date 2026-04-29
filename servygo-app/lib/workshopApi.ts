import { supabase } from "@/lib/supabaseClient";

export type Workshop = {
  id: string;
  owner_id: string | null;
  owner_user_id?: string | null;
  name: string;
  nip: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  description: string | null;
  status: string | null;
  google_maps_url?: string | null;
  services_summary?: string | null;
  opening_hours?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type WorkshopLead = {
  id: string;
  workshop_name: string;
  nip: string | null;
  phone: string | null;
  email: string;
  city: string | null;
  postal_code: string | null;
  address: string | null;
  contact_person: string | null;
  description: string | null;
  message: string | null;
  services?: string | null;
  google_maps_url?: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type WorkshopService = {
  id: string;
  workshop_id: string;
  service_name: string;
  created_at: string | null;
};

export function formatSupabaseError(error: {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}) {
  const parts = [error.message];
  if (error.code) parts.push(`code: ${error.code}`);
  if (error.details) parts.push(`details: ${error.details}`);
  if (error.hint) parts.push(`hint: ${error.hint}`);
  return parts.join(" | ");
}

export async function getUserWorkshop(userId: string): Promise<Workshop | null> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshops")
    .select("*")
    .or(`owner_user_id.eq.${userId},owner_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  return (data as Workshop | null) ?? null;
}

export async function getUserActiveWorkshop(userId: string): Promise<Workshop | null> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshops")
    .select("*")
    .or(`owner_user_id.eq.${userId},owner_id.eq.${userId}`)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  return (data as Workshop | null) ?? null;
}

export async function createWorkshop(
  userId: string,
  payload: Omit<Workshop, "id" | "owner_id" | "status" | "created_at" | "updated_at">,
): Promise<Workshop> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshops")
    .insert({
      owner_id: userId,
      name: payload.name,
      nip: payload.nip,
      phone: payload.phone,
      email: payload.email,
      city: payload.city,
      address: payload.address,
      description: payload.description,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as Workshop;
}

/** Walidacja linku Google Maps z formularza zgłoszeniowego (dozwolone domeny/wzorce). */
export function isValidWorkshopGoogleMapsUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  let href: string;
  try {
    href = new URL(withProto).href.toLowerCase();
  } catch {
    const low = t.toLowerCase();
    return (
      low.includes("google.com/maps") ||
      low.includes("maps.app.goo.gl") ||
      low.includes("goo.gl/maps")
    );
  }
  return (
    href.includes("google.com/maps") ||
    href.includes("maps.app.goo.gl") ||
    href.includes("goo.gl/maps")
  );
}

export async function createWorkshopLead(
  payload: Omit<WorkshopLead, "id" | "status" | "created_at" | "updated_at">,
): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const mapsUrl = payload.google_maps_url?.trim() ?? "";
  const { error } = await supabase.from("workshop_leads").insert({
    workshop_name: payload.workshop_name,
    nip: payload.nip,
    phone: payload.phone,
    email: payload.email,
    city: payload.city,
    postal_code: payload.postal_code,
    address: payload.address,
    contact_person: payload.contact_person,
    description: payload.description,
    message: payload.message,
    services: payload.services ?? null,
    google_maps_url: mapsUrl || null,
    status: "pending",
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export const workshopLeadStatusLabelMap: Record<string, string> = {
  pending: "Oczekuje",
  nowe_zgloszenie: "Nowe zgłoszenie",
  kontakt_wykonany: "Kontakt wykonany",
  umowa_podpisana: "Umowa podpisana",
  aktywny: "Aktywny",
  wylaczony: "Wyłączony",
  odmowil: "Odmówił",
  archived: "Zarchiwizowane",
};

export const workshopLeadStatusColorMap: Record<string, string> = {
  pending: "violet",
  nowe_zgloszenie: "violet",
  kontakt_wykonany: "blue",
  umowa_podpisana: "orange",
  aktywny: "green",
  wylaczony: "gray",
  odmowil: "red",
  archived: "zinc",
};

export async function updateWorkshop(
  workshopId: string,
  payload: Partial<Pick<Workshop, "name" | "phone" | "email" | "city" | "address" | "description">>,
) {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshops")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", workshopId)
    .select("*")
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as Workshop;
}

export async function getWorkshopServices(workshopId: string): Promise<WorkshopService[]> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("workshop_services")
    .select("*")
    .eq("workshop_id", workshopId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  return (data as WorkshopService[] | null) ?? [];
}

export async function updateWorkshopServices(workshopId: string, serviceNames: string[]) {
  if (!supabase) throw new Error("Supabase client not available.");
  const normalized = Array.from(new Set(serviceNames.map((name) => name.trim()).filter(Boolean)));

  const { data: existing, error: existingError } = await supabase
    .from("workshop_services")
    .select("id, service_name")
    .eq("workshop_id", workshopId);
  if (existingError) throw new Error(formatSupabaseError(existingError));

  const existingRows = (existing as Array<{ id: string; service_name: string }> | null) ?? [];
  const existingNames = new Set(existingRows.map((row) => row.service_name));

  const toInsert = normalized.filter((name) => !existingNames.has(name));
  const toDelete = existingRows.filter((row) => !normalized.includes(row.service_name));

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from("workshop_services").insert(
      toInsert.map((serviceName) => ({
        workshop_id: workshopId,
        service_name: serviceName,
      })),
    );
    if (insertError) throw new Error(formatSupabaseError(insertError));
  }

  if (toDelete.length > 0) {
    const ids = toDelete.map((row) => row.id);
    const { error: deleteError } = await supabase.from("workshop_services").delete().in("id", ids);
    if (deleteError) throw new Error(formatSupabaseError(deleteError));
  }
}
