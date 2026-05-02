"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addFavoriteWorkshop,
  isWorkshopFavorited,
  removeFavoriteWorkshop,
} from "@/lib/favoriteWorkshopsDb";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type WorkshopFavoriteToggleProps = {
  workshopId: string;
  isDark: boolean;
  isLoggedIn: boolean;
  userId: string | null;
  onRequireAuth: () => void;
};

export default function WorkshopFavoriteToggle({
  workshopId,
  isDark,
  isLoggedIn,
  userId,
  onRequireAuth,
}: WorkshopFavoriteToggleProps) {
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !userId || !workshopId) {
      setFavorited(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const v = await isWorkshopFavorited(supabase, userId, workshopId);
      setFavorited(v);
    } catch {
      setFavorited(false);
    } finally {
      setLoading(false);
    }
  }, [userId, workshopId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggle() {
    if (!isLoggedIn || !userId) {
      onRequireAuth();
      return;
    }
    if (!supabase || !workshopId || busy) return;
    setBusy(true);
    try {
      if (favorited) {
        await removeFavoriteWorkshop(supabase, userId, workshopId);
        setFavorited(false);
      } else {
        await addFavoriteWorkshop(supabase, userId, workshopId);
        setFavorited(true);
      }
    } catch {
      /* unique violation / network — stan odświeżamy */
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const outline = isDark
    ? "border-zinc-600 bg-zinc-900/80 text-zinc-100 hover:border-orange-400/60"
    : "border-blue-200 bg-white/90 text-zinc-800 hover:border-orange-300";

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={loading || busy || !workshopId}
      className={`inline-flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${outline}`}
      aria-pressed={favorited}
      aria-label={favorited ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
    >
      <span className="text-lg leading-none">{favorited ? "♥" : "♡"}</span>
      <span className="max-w-[140px] text-center text-[11px] font-medium leading-tight">
        {favorited ? "W ulubionych" : "Dodaj do ulubionych"}
      </span>
    </button>
  );
}
