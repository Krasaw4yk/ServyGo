"use client";

import { supabase } from "@/lib/supabaseClient";

export async function sendBookingEmailNotification(payload: {
  bookingId: string;
  workshopId: string;
  recipientId: string;
  subject: string;
  message: string;
}): Promise<void> {
  if (!supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return;
  await fetch("/api/notifications/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}
