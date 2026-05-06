"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { AdminWorkshopListRow } from "@/lib/adminApi";
import { formatAdminWorkshopEntityStatusLabel, updateWorkshopShowOnMapAsAdmin } from "@/lib/adminApi";
import type { OffersMapMarker } from "@/components/offers/OffersLeafletMap";

const OffersLeafletMap = dynamic(() => import("@/components/offers/OffersLeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl border border-zinc-600/40 bg-zinc-900/40 text-sm text-zinc-400">
      Ładowanie mapy…
    </div>
  ),
});

export type AdminMapListFilter =
  | "all"
  | "on_map"
  | "hidden_map"
  | "no_coords"
  | "active"
  | "inactive";

function workshopHasCoords(w: AdminWorkshopListRow): boolean {
  const lat = w.latitude;
  const lng = w.longitude;
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng))
  );
}

function isEntityActive(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase().trim();
  return s === "active" || s === "approved" || s === "aktywny";
}

function isPublicMapPin(w: AdminWorkshopListRow): boolean {
  return isEntityActive(w.status) && w.show_on_map === true && workshopHasCoords(w);
}

function parseRating(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
}

const FILTER_OPTIONS: { id: AdminMapListFilter; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "on_map", label: "Widoczne na mapie" },
  { id: "hidden_map", label: "Ukryte z mapy" },
  { id: "no_coords", label: "Bez współrzędnych" },
  { id: "active", label: "Aktywne" },
  { id: "inactive", label: "Nieaktywne" },
];

type AdminServyGoMapSectionProps = {
  workshops: AdminWorkshopListRow[];
  isDark: boolean;
  userId: string;
  userEmail: string | null;
  onRefreshWorkshops: () => Promise<void>;
  onEditWorkshop: (workshopId: string) => void;
  onNotify: (message: string, isError?: boolean) => void;
};

export default function AdminServyGoMapSection({
  workshops,
  isDark,
  userId,
  userEmail,
  onRefreshWorkshops,
  onEditWorkshop,
  onNotify,
}: AdminServyGoMapSectionProps) {
  const [listFilter, setListFilter] = useState<AdminMapListFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const stats = useMemo(() => {
    const total = workshops.length;
    let onMap = 0;
    let noCoords = 0;
    let hiddenMap = 0;
    for (const w of workshops) {
      const coords = workshopHasCoords(w);
      if (!coords) noCoords += 1;
      if (w.show_on_map !== true) hiddenMap += 1;
      if (isPublicMapPin(w)) onMap += 1;
    }
    return { total, onMap, noCoords, hiddenMap };
  }, [workshops]);

  const filteredList = useMemo(() => {
    return workshops.filter((w) => {
      if (listFilter === "on_map") return isPublicMapPin(w);
      if (listFilter === "hidden_map") return w.show_on_map !== true;
      if (listFilter === "no_coords") return !workshopHasCoords(w);
      if (listFilter === "active") return isEntityActive(w.status);
      if (listFilter === "inactive") return !isEntityActive(w.status);
      return true;
    });
  }, [listFilter, workshops]);

  const mapMarkers: OffersMapMarker[] = useMemo(() => {
    return filteredList
      .filter((w) => workshopHasCoords(w))
      .map((w) => {
        const lat = Number(w.latitude);
        const lng = Number(w.longitude);
        const publicPin = isPublicMapPin(w);
        const maps = (w.google_maps_url ?? "").trim();
        const st = (w.status ?? "").trim() || "—";
        const show = w.show_on_map === true ? "tak" : "nie";
        const rating = parseRating(w.rating);
        const reviews = typeof w.reviews_count === "number" ? w.reviews_count : 0;

        return {
          id: w.id,
          lat,
          lng,
          name: w.name,
          address: (w.address ?? "").trim() || "—",
          rating,
          reviewsCount: reviews,
          priceLabel: "—",
          nearestSlot: "—",
          detailsHref: `/admin/workshops/${w.id}/preview`,
          selected: selectedId === w.id,
          markerTone: publicPin ? "primary" : "muted",
          adminPopup: (
            <div className="text-left text-xs">
              <p className="font-semibold leading-tight">{w.name}</p>
              <p className="mt-1 text-zinc-600">
                {(w.address ?? "").trim() || "—"}, {w.city ?? "—"}
              </p>
              <p className="mt-1">
                <span className="font-medium">Status:</span> {st}
              </p>
              <p className="mt-0.5">
                <span className="font-medium">Pokaż na mapie:</span> {show}
              </p>
              <p className="mt-0.5">
                <span className="font-medium">Ocena:</span> {rating.toFixed(1)} ({reviews})
              </p>
              {maps ? (
                <a
                  href={maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-medium text-blue-600 underline"
                >
                  Google Maps
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => onEditWorkshop(w.id)}
                className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Edytuj warsztat
              </button>
            </div>
          ),
        };
      });
  }, [filteredList, onEditWorkshop, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const row = rowRefs.current[selectedId];
    if (row) row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  const handleShowOnMap = useCallback(
    async (w: AdminWorkshopListRow, next: boolean) => {
      if (next && !workshopHasCoords(w)) {
        onNotify("Najpierw uzupełnij szerokość i długość geograficzną w edycji warsztatu.", true);
        return;
      }
      setSavingId(w.id);
      try {
        await updateWorkshopShowOnMapAsAdmin(userId, userEmail, w.id, next);
        await onRefreshWorkshops();
        onNotify(next ? "Warsztat włączony na mapie ServyGo." : "Warsztat ukryty z mapy ServyGo.");
      } catch (err) {
        onNotify(err instanceof Error ? err.message : "Nie udało się zapisać.", true);
      } finally {
        setSavingId(null);
      }
    },
    [onNotify, onRefreshWorkshops, userEmail, userId],
  );

  const tableWrap = isDark ? "border-zinc-700 bg-zinc-900/50" : "border-blue-200 bg-white/90";
  const th = isDark ? "text-zinc-300" : "text-zinc-700";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Mapa ServyGo</h2>
        <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
          Podgląd warsztatów na mapie OpenStreetMap. Publicznie (np. /oferty) widoczne są tylko: status aktywny, włączona mapa,
          ustawione współrzędne.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Wszystkie warsztaty", value: stats.total },
          { label: "Widoczne na mapie (publicznie)", value: stats.onMap },
          { label: "Bez współrzędnych", value: stats.noCoords },
          { label: "Ukryte z mapy (show_on_map ≠ tak)", value: stats.hiddenMap },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}
          >
            <p className={`text-[11px] font-medium leading-tight ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{s.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-sm font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Filtr listy:</span>
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setListFilter(opt.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              listFilter === opt.id
                ? "border-blue-500 bg-blue-600 text-white"
                : isDark
                  ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_minmax(0,420px)]">
        <div className={`min-h-[420px] overflow-hidden rounded-2xl border ${isDark ? "border-zinc-700" : "border-blue-200"}`}>
          {mapMarkers.length > 0 ? (
            <OffersLeafletMap
              markers={mapMarkers}
              selectedId={selectedId}
              onMarkerClick={(id) => setSelectedId(id)}
              compactCardsOnMap={false}
            />
          ) : (
            <div className="flex h-[420px] items-center justify-center px-4 text-center text-sm text-zinc-500">
              Brak warsztatów z współrzędnymi w bieżącym filtrze. Zmień filtr lub uzupełnij latitude/longitude w edycji warsztatu.
            </div>
          )}
        </div>

        <div className={`max-h-[min(70vh,720px)] overflow-auto rounded-2xl border ${tableWrap}`}>
          <table className="w-full min-w-[320px] border-collapse text-left text-sm">
            <thead className={`sticky top-0 z-[1] ${isDark ? "bg-zinc-900" : "bg-white"}`}>
              <tr className={isDark ? "border-b border-zinc-700" : "border-b border-zinc-200"}>
                <th className={`px-2 py-2 ${th}`}>Nazwa</th>
                <th className={`px-2 py-2 ${th}`}>Miasto</th>
                <th className={`hidden px-2 py-2 sm:table-cell ${th}`}>Adres</th>
                <th className={`px-2 py-2 ${th}`}>Status</th>
                <th className={`px-2 py-2 ${th}`}>Mapa</th>
                <th className={`px-2 py-2 ${th}`}>GPS</th>
                <th className={`px-2 py-2 ${th}`}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((w) => {
                const coords = workshopHasCoords(w);
                const isSelected = selectedId === w.id;
                return (
                  <tr
                    key={w.id}
                    ref={(el) => {
                      rowRefs.current[w.id] = el;
                    }}
                    onClick={() => setSelectedId(w.id)}
                    className={`cursor-pointer border-t ${
                      isSelected
                        ? isDark
                          ? "bg-blue-950/50 border-zinc-700"
                          : "bg-blue-50 border-blue-100"
                        : isDark
                          ? "border-zinc-800 hover:bg-zinc-800/40"
                          : "border-zinc-100 hover:bg-zinc-50"
                    }`}
                  >
                    <td className="px-2 py-2 font-medium">{w.name}</td>
                    <td className="px-2 py-2">{w.city ?? "—"}</td>
                    <td className={`hidden max-w-[140px] truncate px-2 py-2 sm:table-cell`} title={w.address ?? ""}>
                      {w.address ?? "—"}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">{formatAdminWorkshopEntityStatusLabel(w.status)}</td>
                    <td className="px-2 py-2">{w.show_on_map === true ? "tak" : "nie"}</td>
                    <td className="px-2 py-2">{coords ? "tak" : "Brak współrzędnych"}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditWorkshop(w.id);
                          }}
                          className="rounded-lg border border-blue-500/60 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-zinc-800"
                        >
                          Edytuj
                        </button>
                        {w.show_on_map !== true ? (
                          <button
                            type="button"
                            disabled={savingId === w.id || !coords}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleShowOnMap(w, true);
                            }}
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                            title={!coords ? "Uzupełnij współrzędne w edycji warsztatu" : "Włącz widoczność na mapie ServyGo"}
                          >
                            Pokaż na mapie
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={savingId === w.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleShowOnMap(w, false);
                            }}
                            className="rounded-lg border border-zinc-500 px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                          >
                            Ukryj z mapy
                          </button>
                        )}
                        <Link
                          href={`/admin/workshops/${w.id}/preview`}
                          className="text-center text-[11px] font-medium text-blue-600 underline dark:text-blue-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Podgląd
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredList.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-zinc-500">Brak pozycji dla wybranego filtru.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
