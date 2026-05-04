"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

const DEFAULT_DEBOUNCE_MS = 450;

function useDebouncedCallbackRef(onEvent: () => void, debounceMs: number) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpRef = useRef(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onEventRef.current();
    }, debounceMs);
  });
  return bumpRef;
}

/**
 * Odświeża skrzynkę (wiadomości + powiadomienia) po zmianach w Supabase Realtime.
 * Wymaga dodania tabel do publikacji `supabase_realtime` (patrz supabase/sql/supabase-47-realtime-publications.sql).
 */
export function useInboxRealtimeSync(enabled: boolean, userId: string | null | undefined, onRefresh: () => void) {
  const bumpRef = useDebouncedCallbackRef(onRefresh, DEFAULT_DEBOUNCE_MS);

  useEffect(() => {
    if (!enabled || !supabase || !userId) return;
    const sb = supabase;

    const channel = sb
      .channel(`servygo_inbox_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_messages" }, () => bumpRef.current())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${userId}` },
        () => bumpRef.current(),
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [enabled, userId, bumpRef]);
}

export type UseBookingsRealtimeSyncArgs = {
  enabled: boolean;
  /** Zmiany rezerwacji klienta (Moje rezerwacje). */
  clientUserId?: string | null;
  /** Zmiany rezerwacji warsztatu (panel warsztatu / admin — wybrany warsztat). */
  workshopId?: string | null;
  onRefresh: () => void;
  debounceMs?: number;
};

export function useBookingsRealtimeSync({
  enabled,
  clientUserId,
  workshopId,
  onRefresh,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseBookingsRealtimeSyncArgs) {
  const bumpRef = useDebouncedCallbackRef(onRefresh, debounceMs);

  useEffect(() => {
    if (!enabled || !supabase) return;
    const sb = supabase;
    const uid = clientUserId?.trim() || null;
    const wid = workshopId?.trim() || null;
    if (!uid && !wid) return;

    const key = `servygo_bookings_${uid ?? "none"}_${wid ?? "none"}`;
    const channel = sb.channel(key);
    if (uid) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `user_id=eq.${uid}` },
        () => bumpRef.current(),
      );
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_quotes", filter: `user_id=eq.${uid}` },
        () => bumpRef.current(),
      );
    }
    if (wid) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `workshop_id=eq.${wid}` },
        () => bumpRef.current(),
      );
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_quotes", filter: `workshop_id=eq.${wid}` },
        () => bumpRef.current(),
      );
    }
    channel.subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [enabled, clientUserId, workshopId, bumpRef]);
}

/** Nowe / zmienione zgłoszenia warsztatów (lista w panelu admina). */
export function useWorkshopLeadsAdminRealtime(enabled: boolean, onRefresh: () => void) {
  const bumpRef = useDebouncedCallbackRef(onRefresh, DEFAULT_DEBOUNCE_MS);

  useEffect(() => {
    if (!enabled || !supabase) return;
    const sb = supabase;

    const channel = sb
      .channel("servygo_admin_workshop_leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "workshop_leads" }, () => bumpRef.current())
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [enabled, bumpRef]);
}

export function useSupportReportsAdminRealtime(enabled: boolean, onRefresh: () => void) {
  const bumpRef = useDebouncedCallbackRef(onRefresh, DEFAULT_DEBOUNCE_MS);

  useEffect(() => {
    if (!enabled || !supabase) return;
    const sb = supabase;

    const channel = sb
      .channel("servygo_admin_support_reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_reports" }, () => bumpRef.current())
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [enabled, bumpRef]);
}

export type UseWorkshopLeadSettlementRealtimeArgs = {
  enabled: boolean;
  workshopId?: string | null;
  onRefresh: () => void;
  debounceMs?: number;
};

/** Odświeżenie sekcji leadów: rozliczenia + rezerwacje warsztatu (Supabase Realtime). */
export function useWorkshopLeadSettlementRealtime({
  enabled,
  workshopId,
  onRefresh,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseWorkshopLeadSettlementRealtimeArgs) {
  const bumpRef = useDebouncedCallbackRef(onRefresh, debounceMs);

  useEffect(() => {
    if (!enabled || !supabase) return;
    const wid = workshopId?.trim() || null;
    if (!wid) return;
    const sb = supabase;

    const channel = sb
      .channel(`servygo_workshop_lead_settlement_${wid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_lead_settlements", filter: `workshop_id=eq.${wid}` },
        () => bumpRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `workshop_id=eq.${wid}` },
        () => bumpRef.current(),
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [enabled, workshopId, bumpRef]);
}
