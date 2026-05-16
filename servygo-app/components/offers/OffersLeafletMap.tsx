"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import Link from "next/link";

export type OffersMapMarker = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  /** Jedna linia do kompaktowej karty (np. miasto · ulica · kod). */
  mapCardAddress?: string;
  rating: number;
  reviewsCount: number;
  priceLabel: string;
  nearestSlot: string;
  /** Używane w popupie trybu „oferty”; w trybie admin z `adminPopup` może być puste. */
  detailsHref: string;
  selected: boolean;
  /** Domyślnie `primary` (niebieski / pomarańczowy przy zaznaczeniu). `muted` — szary (np. admin: poza publiczną mapą). */
  markerTone?: "primary" | "muted";
  /** Gdy ustawione, zamiast standardowego popupu ofert. */
  adminPopup?: ReactNode;
};

function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function createMarkerIcon(selected: boolean, tone: "primary" | "muted" = "primary") {
  const color = selected ? "#ea580c" : tone === "muted" ? "#71717a" : "#2563eb";
  return L.divIcon({
    className: "servygo-leaflet-divicon",
    html: `<div style="width:20px;height:20px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -8],
  });
}

function FitBoundsWhenReady({ markers }: { markers: OffersMapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = markers.filter((m) => isValidLatLng(m.lat, m.lng));
    if (valid.length === 0) return;
    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 15, { animate: false });
      return;
    }
    const b = L.latLngBounds(valid.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(b, { padding: [40, 40], maxZoom: 14, animate: false });
  }, [map, markers]);
  return null;
}

function FlyToSelected({ selectedId, markers }: { selectedId: string | null; markers: OffersMapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const m = markers.find((x) => x.id === selectedId);
    if (!m || !isValidLatLng(m.lat, m.lng)) return;
    const z = Math.max(map.getZoom(), 15);
    map.flyTo([m.lat, m.lng], z, { duration: 0.35 });
  }, [map, markers, selectedId]);
  return null;
}

type OffersLeafletMapProps = {
  markers: OffersMapMarker[];
  selectedId: string | null;
  onMarkerClick: (id: string) => void;
  /** Etykieta przycisku w popupie trybu ofert; pomijana przy `adminPopup`. */
  seeOfferLabel?: string;
  /** Stałe małe karty nad markerem (oferty). Wyłącz np. na mini-mapie warsztatu / w adminie. */
  compactCardsOnMap?: boolean;
};

export default function OffersLeafletMap({
  markers,
  selectedId,
  onMarkerClick,
  seeOfferLabel,
  compactCardsOnMap = true,
}: OffersLeafletMapProps) {
  const validMarkers = useMemo(
    () => markers.filter((m) => isValidLatLng(m.lat, m.lng)),
    [markers],
  );

  const center = useMemo((): [number, number] => {
    if (validMarkers.length === 0) return [52.23, 21.01];
    const lat = validMarkers.reduce((s, m) => s + m.lat, 0) / validMarkers.length;
    const lng = validMarkers.reduce((s, m) => s + m.lng, 0) / validMarkers.length;
    return isValidLatLng(lat, lng) ? [lat, lng] : [52.23, 21.01];
  }, [validMarkers]);

  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  return (
    <MapContainer
      key={validMarkers.map((m) => m.id).join(",")}
      center={center}
      zoom={12}
      style={{
        height: "100%",
        width: "100%",
        minHeight: "320px",
        borderRadius: "1rem",
        zIndex: 0,
      }}
      scrollWheelZoom
      preferCanvas
    >
      <TileLayer attribution={attribution} url={tileUrl} />
      <FitBoundsWhenReady markers={validMarkers} />
      <FlyToSelected selectedId={selectedId} markers={validMarkers} />
      {validMarkers.map((m) => {
        const showCompact = compactCardsOnMap && !m.adminPopup;
        const addr = (m.mapCardAddress ?? m.address).trim() || "—";
        const sel = m.selected || selectedId === m.id;
        return (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={createMarkerIcon(sel, m.markerTone ?? "primary")}
            eventHandlers={{
              click: () => onMarkerClick(m.id),
            }}
          >
            {showCompact ? (
              <Tooltip
                permanent
                direction="top"
                offset={[0, -14]}
                opacity={1}
                interactive
                className="servygo-offers-map-tooltip-wrap !rounded-xl !border !border-slate-200 !bg-white !p-0 !shadow-lg !text-zinc-900 dark:!border-zinc-600 dark:!bg-zinc-900 dark:!text-zinc-100"
              >
                <button
                  type="button"
                  className="servygo-offers-map-card block max-w-[220px] cursor-pointer rounded-xl px-2.5 py-2 text-left"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkerClick(m.id);
                  }}
                >
                  <span className="line-clamp-2 text-[11px] font-bold leading-tight">{m.name}</span>
                  <span className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-600 dark:text-zinc-400">{addr}</span>
                  <span className="mt-1 block text-[10px] font-semibold text-zinc-800 dark:text-zinc-200">
                    ⭐ {m.rating.toFixed(1)} · {m.reviewsCount}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-semibold text-orange-600 dark:text-orange-400">{m.priceLabel}</span>
                </button>
              </Tooltip>
            ) : null}
            <Popup className="servygo-offers-popup">
              <div className="min-w-[200px] max-w-[260px] text-zinc-900">
                {m.adminPopup ? (
                  m.adminPopup
                ) : (
                  <>
                    <p className="font-semibold leading-tight">{m.name}</p>
                    <p className="mt-1 text-xs text-zinc-600">{addr}</p>
                    <p className="mt-1 text-xs">
                      ⭐ {m.rating.toFixed(1)} ({m.reviewsCount})
                    </p>
                    {m.priceLabel.trim() ? (
                      <p className="mt-1 text-xs">
                        <span className="font-medium">Cena:</span> {m.priceLabel}
                      </p>
                    ) : null}
                    {seeOfferLabel ? (
                      <Link
                        href={m.detailsHref}
                        className="mt-3 inline-flex w-full items-center justify-center rounded-lg border-2 border-orange-400 bg-blue-700 px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-800"
                        style={{ color: "#ffffff" }}
                      >
                        {seeOfferLabel}
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
