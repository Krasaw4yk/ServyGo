import { NextResponse } from "next/server";
import { processBookingReminders } from "@/lib/bookingReminders";

/**
 * Cron / scheduler: POST z nagłówkiem x-cron-secret (jeśli ustawiono CRON_SECRET).
 * Supabase Edge Function: można wywołać ten endpoint lub przenieść logikę do Edge — patrz komentarze w lib/bookingReminders.ts
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const hdr = req.headers.get("x-cron-secret")?.trim();
    if (hdr !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await processBookingReminders();
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Błąd";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
