"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listWorkshopPhotosForManage,
  setWorkshopPhotoHidden,
  uploadWorkshopPhoto,
  type WorkshopPhotoRow,
} from "@/lib/workshopPhotosApi";

type Props = {
  workshopId: string;
  uploadedByRole: string;
  isDark: boolean;
  readOnly?: boolean;
};

export default function WorkshopPhotosManager({ workshopId, uploadedByRole, isDark, readOnly }: Props) {
  const [rows, setRows] = useState<WorkshopPhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [caption, setCaption] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listWorkshopPhotosForManage(workshopId);
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wczytać zdjęć.");
    } finally {
      setLoading(false);
    }
  }, [workshopId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void reload());
    return () => window.cancelAnimationFrame(frame);
  }, [reload]);

  async function onFile(file: File | null) {
    if (!file || readOnly) return;
    setBusy(true);
    setError("");
    try {
      await uploadWorkshopPhoto({
        workshopId,
        file,
        caption: caption.trim() || null,
        uploadedByRole,
      });
      setCaption("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload nie powiódł się.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden(row: WorkshopPhotoRow) {
    if (readOnly) return;
    setBusy(true);
    setError("");
    try {
      await setWorkshopPhotoHidden(row.id, row.status === "active");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie zapisano zmiany.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-dashed pt-4">
      <h3 className={`text-sm font-semibold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>Zdjęcia warsztatu</h3>
      <p className={`mt-2 text-xs leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
        Nie dodawaj zdjęć z widocznymi twarzami, tablicami rejestracyjnymi, dokumentami ani innymi danymi osobowymi.
      </p>
      {error ? (
        <p className={`mt-2 text-xs ${isDark ? "text-orange-300" : "text-orange-700"}`}>{error}</p>
      ) : null}
      {!readOnly ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className={`flex flex-1 flex-col gap-1 text-xs ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Podpis / uwaga (opcjonalnie)
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white"}`}
            />
          </label>
          <label className={`inline-flex cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold ${isDark ? "border-zinc-600 hover:bg-zinc-800" : "border-blue-300 hover:bg-blue-50"}`}>
            {busy ? "Przesyłanie…" : "Wybierz plik"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      ) : null}
      {loading ? <p className={`mt-3 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Ładowanie galerii…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className={`mt-3 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Brak zdjęć w galerii.</p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((row) => (
          <figure key={row.id} className={`overflow-hidden rounded-xl border ${isDark ? "border-zinc-700 bg-zinc-950" : "border-zinc-200 bg-white"}`}>
            {row.public_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.public_url} alt="" className="aspect-video w-full object-cover" />
            ) : (
              <div className={`flex aspect-video items-center justify-center text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>Brak URL</div>
            )}
            <figcaption className={`px-2 py-1 text-[10px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              {row.status === "hidden" ? (
                <span className="font-semibold text-orange-500">Ukryte </span>
              ) : null}
              {row.caption ?? row.storage_path.slice(-24)}
            </figcaption>
            {!readOnly ? (
              <div className="flex gap-1 px-2 pb-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleHidden(row)}
                  className={`flex-1 rounded-lg border px-2 py-1 text-[11px] font-semibold ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                >
                  {row.status === "active" ? "Ukryj" : "Przywróć"}
                </button>
              </div>
            ) : null}
          </figure>
        ))}
      </div>
    </div>
  );
}
