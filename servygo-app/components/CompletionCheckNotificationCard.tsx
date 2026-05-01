"use client";

import { useEffect, useState } from "react";
import {
  clientConfirmServiceCompleted,
  clientReportServiceNotCompleted,
  insertServiceReview,
  type UserNotificationRow,
} from "@/lib/notificationsApi";
import { supabase } from "@/lib/supabaseClient";

const NOT_COMPLETED_REASONS: { value: string; label: string }[] = [
  { value: "workshop_refused", label: "Warsztat odmówił wykonania usługi" },
  { value: "price_mismatch", label: "Cena była inna niż ustalona" },
  { value: "workshop_closed", label: "Warsztat był zamknięty" },
  { value: "client_no_show", label: "Nie miałem czasu / nie przyjechałem" },
  { value: "other", label: "Inny powód" },
];

function googleReviewUrl(mapsUrl: string | null | undefined, placeId: string | null | undefined): string | null {
  const u = mapsUrl?.trim();
  if (u) return u;
  const p = placeId?.trim();
  if (p) return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(p)}`;
  return null;
}

type Props = {
  notification: UserNotificationRow;
  currentUserId: string;
  isDark: boolean;
  onResolved: () => void;
};

export default function CompletionCheckNotificationCard({ notification, currentUserId, isDark, onResolved }: Props) {
  const bid = notification.booking_id;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"check" | "rate" | "report" | "done">("check");
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [workshopMapsUrl, setWorkshopMapsUrl] = useState<string | null>(null);
  const [workshopPlaceId, setWorkshopPlaceId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState(NOT_COMPLETED_REASONS[0].value);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!bid || !supabase) return;
    let cancelled = false;
    void (async () => {
      const { data: b } = await supabase.from("bookings").select("status, workshop_id").eq("id", bid).maybeSingle();
      if (cancelled) return;
      const row = b as { status?: string; workshop_id?: string } | null;
      setBookingStatus(row?.status ?? null);
      const wid = row?.workshop_id;
      if (!wid) return;
      const { data: w } = await supabase.from("workshops").select("google_maps_url, google_place_id").eq("id", wid).maybeSingle();
      if (cancelled) return;
      const wr = w as { google_maps_url?: string | null; google_place_id?: string | null } | null;
      setWorkshopMapsUrl(wr?.google_maps_url ?? null);
      setWorkshopPlaceId(wr?.google_place_id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [bid]);

  if (!bid) {
    return <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Brak powiązanej rezerwacji.</p>;
  }

  const bookingId = bid;

  async function onYes() {
    setError("");
    setBusy(true);
    try {
      await clientConfirmServiceCompleted(bookingId);
      setPhase("rate");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRating() {
    setError("");
    setBusy(true);
    try {
      const wsId = notification.workshop_id;
      if (!wsId) throw new Error("Brak warsztatu w powiadomieniu.");
      await insertServiceReview({
        bookingId,
        workshopId: wsId,
        userId: currentUserId,
        rating,
        comment: comment.trim() || null,
      });
      setPhase("done");
      onResolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie zapisano opinii.");
    } finally {
      setBusy(false);
    }
  }

  async function skipRating() {
    setBusy(true);
    try {
      if (supabase) {
        await supabase.from("bookings").update({ completion_feedback_status: "skipped" }).eq("id", bookingId).eq("user_id", currentUserId);
      }
      setPhase("done");
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    setError("");
    setBusy(true);
    try {
      await clientReportServiceNotCompleted(bookingId, reason, note);
      setPhase("done");
      onResolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie zapisano zgłoszenia.");
    } finally {
      setBusy(false);
    }
  }

  const mapsLink = googleReviewUrl(workshopMapsUrl, workshopPlaceId);

  if (bookingStatus && bookingStatus !== "confirmed" && phase === "check") {
    return (
      <div className={`rounded-xl border px-4 py-3 text-sm ${isDark ? "border-zinc-600 bg-zinc-950/40" : "border-zinc-200 bg-zinc-50"}`}>
        <p className="font-semibold">To zgłoszenie nie jest już aktualne</p>
        <p className={`mt-1 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Status rezerwacji: {bookingStatus}</p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <p className={`text-sm ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>Zapisano. Dziękujemy za informację.</p>
    );
  }

  if (phase === "report") {
    return (
      <div className={`space-y-3 rounded-xl border p-4 ${isDark ? "border-rose-500/30 bg-rose-950/20" : "border-rose-200 bg-rose-50/80"}`}>
        <p className="text-sm font-semibold">Powiedz nam, co się stało</p>
        <label className="block text-xs font-medium opacity-80">Powód</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black"
        >
          {NOT_COMPLETED_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <label className="block text-xs font-medium opacity-80">Opisz sytuację</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black"
          placeholder="Opcjonalnie dodaj szczegóły…"
        />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void submitReport()}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Wysyłanie…" : "Wyślij zgłoszenie"}
        </button>
      </div>
    );
  }

  if (phase === "rate") {
    return (
      <div className={`space-y-3 rounded-xl border p-4 ${isDark ? "border-emerald-500/30 bg-emerald-950/15" : "border-emerald-200 bg-emerald-50/70"}`}>
        <p className="text-sm font-semibold">Oceń warsztat w ServyGo</p>
        <div className="flex flex-wrap items-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRating(s)}
              className={`rounded-lg border px-2 py-1 text-sm ${rating === s ? "border-amber-500 bg-amber-100 ring-2 ring-amber-300" : "border-zinc-200 bg-white"}`}
            >
              {s}★
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black"
          placeholder="Krótki komentarz (opcjonalnie)"
        />
        {mapsLink ? (
          <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-blue-600 underline">
            Oceń w Google Maps
          </a>
        ) : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitRating()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Zapisuję…" : "Wyślij ocenę"}
          </button>
          <button type="button" disabled={busy} onClick={() => void skipRating()} className="rounded-lg border px-4 py-2 text-sm">
            Pomiń ocenę
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 rounded-xl border p-4 ${isDark ? "border-blue-500/35 bg-blue-950/25" : "border-blue-200 bg-blue-50/70"}`}>
      <p className="text-sm">{notification.body}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onYes()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Tak, usługa wykonana
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setPhase("report")}
          className="rounded-lg border border-rose-400 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
        >
          Nie, usługa nie została wykonana
        </button>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
