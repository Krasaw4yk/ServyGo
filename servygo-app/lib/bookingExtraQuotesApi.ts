import { supabase } from "@/lib/supabaseClient";
import { formatSupabaseError } from "@/lib/workshopApi";

export type BookingExtraQuoteItem = { name: string; price?: number | null };

export type BookingExtraQuoteStatus = "pending" | "accepted" | "rejected";

export type BookingExtraQuoteRow = {
  id: string;
  booking_id: string;
  title: string;
  description: string | null;
  items: BookingExtraQuoteItem[];
  extra_price: number | null;
  total_price_after_accept: number | null;
  extra_time_minutes: number | null;
  status: BookingExtraQuoteStatus;
  created_at: string;
  responded_at: string | null;
};

function parseItems(raw: unknown): BookingExtraQuoteItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BookingExtraQuoteItem[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const price = typeof o.price === "number" && Number.isFinite(o.price) ? o.price : null;
    out.push({ name, price });
  }
  return out;
}

export async function createExtraQuote(input: {
  bookingId: string;
  title?: string;
  description?: string | null;
  items: BookingExtraQuoteItem[];
  extraPrice?: number | null;
  totalPriceAfterAccept?: number | null;
  extraTimeMinutes?: number | null;
}): Promise<BookingExtraQuoteRow> {
  if (!supabase) throw new Error("Supabase client not available.");
  const { data, error } = await supabase
    .from("booking_extra_quotes")
    .insert({
      booking_id: input.bookingId,
      title: input.title?.trim() || "Dodatkowe usługi",
      description: input.description?.trim() || null,
      items: input.items,
      extra_price: input.extraPrice ?? null,
      total_price_after_accept: input.totalPriceAfterAccept ?? null,
      extra_time_minutes: input.extraTimeMinutes ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    booking_id: String(row.booking_id),
    title: String(row.title ?? "Dodatkowe usługi"),
    description: row.description != null ? String(row.description) : null,
    items: parseItems(row.items),
    extra_price: row.extra_price != null ? Number(row.extra_price) : null,
    total_price_after_accept: row.total_price_after_accept != null ? Number(row.total_price_after_accept) : null,
    extra_time_minutes: row.extra_time_minutes != null ? Number(row.extra_time_minutes) : null,
    status: (String(row.status ?? "pending").toLowerCase() as BookingExtraQuoteStatus) || "pending",
    created_at: String(row.created_at ?? ""),
    responded_at: row.responded_at != null ? String(row.responded_at) : null,
  };
}

export async function acceptExtraQuote(quoteId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("booking_extra_quotes")
    .update({
      status: "accepted",
      responded_at: now,
    })
    .eq("id", quoteId)
    .eq("status", "pending");
  if (error) throw new Error(formatSupabaseError(error));
  // W przyszłości: doliczenie kosztu/czasu do rezerwacji po akceptacji.
}

export async function rejectExtraQuote(quoteId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase client not available.");
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("booking_extra_quotes")
    .update({
      status: "rejected",
      responded_at: now,
    })
    .eq("id", quoteId)
    .eq("status", "pending");
  if (error) throw new Error(formatSupabaseError(error));
  // Po odrzuceniu warsztat wykonuje tylko pierwotny zakres zlecenia — bez zmiany pierwotnej ceny rezerwacji.
}
