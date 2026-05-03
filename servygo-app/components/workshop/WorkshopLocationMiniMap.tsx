"use client";

import dynamic from "next/dynamic";

const OffersLeafletMap = dynamic(() => import("@/components/offers/OffersLeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-blue-200/50 bg-white/40 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
      …
    </div>
  ),
});

type WorkshopLocationMiniMapProps = {
  workshopId: string;
  name: string;
  addressLine: string;
  lat: number;
  lng: number;
  detailsHref: string;
  rating?: number;
  reviewsCount?: number;
};

/** Jedna pinezka — te same kafelki OSM co /oferty; bez stałych kart nad markerem. */
export default function WorkshopLocationMiniMap({
  workshopId,
  name,
  addressLine,
  lat,
  lng,
  detailsHref,
  rating = 0,
  reviewsCount = 0,
}: WorkshopLocationMiniMapProps) {
  return (
    <OffersLeafletMap
      markers={[
        {
          id: workshopId,
          lat,
          lng,
          name,
          address: addressLine,
          rating,
          reviewsCount,
          priceLabel: "",
          nearestSlot: "—",
          detailsHref,
          selected: true,
        },
      ]}
      selectedId={workshopId}
      onMarkerClick={() => {}}
      compactCardsOnMap={false}
    />
  );
}
