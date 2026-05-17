"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { WorkshopPhotoRow } from "@/lib/workshopPhotosApi";

type Props = {
  photos: WorkshopPhotoRow[];
  workshopName: string;
  isDark: boolean;
  layout?: "desktop" | "mobile";
};

export default function WorkshopPhotoGallery({ photos, workshopName, isDark, layout = "desktop" }: Props) {
  const visible = photos.filter((ph) => ph.public_url?.trim());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const showPrev = useCallback(() => {
    setLightboxIndex((i) => (i == null || visible.length === 0 ? i : (i - 1 + visible.length) % visible.length));
  }, [visible.length]);
  const showNext = useCallback(() => {
    setLightboxIndex((i) => (i == null || visible.length === 0 ? i : (i + 1) % visible.length));
  }, [visible.length]);

  useEffect(() => {
    if (lightboxIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIndex, closeLightbox, showPrev, showNext]);

  if (visible.length === 0) {
    if (layout === "mobile") {
      return (
        <div
          className={`flex h-24 w-full items-center justify-center rounded-xl border border-dashed text-center ${
            isDark ? "border-zinc-700 bg-zinc-800/60" : "border-zinc-300 bg-zinc-50"
          }`}
        >
          <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Brak zdjęć · właściciel może je dodać w panelu
          </p>
        </div>
      );
    }
    return (
      <div
        className={`relative h-52 overflow-hidden rounded-2xl border ${
          isDark ? "border-zinc-700 bg-zinc-800/70" : "border-blue-100 bg-white/70"
        }`}
      >
        <div className="h-full bg-[linear-gradient(120deg,rgba(59,130,246,0.16),rgba(249,115,22,0.18),rgba(56,189,248,0.14))] dark:bg-[linear-gradient(120deg,rgba(59,130,246,0.22),rgba(249,115,22,0.16),rgba(2,6,23,0.22))]" />
      </div>
    );
  }

  const openBtn = (idx: number, className: string, children: ReactNode) => (
    <button type="button" onClick={() => setLightboxIndex(idx)} className={className} aria-label={`Powiększ zdjęcie ${idx + 1} z ${visible.length}`}>
      {children}
    </button>
  );

  const lightbox =
    lightboxIndex != null && visible[lightboxIndex] ? (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Podgląd zdjęcia"
        onClick={closeLightbox}
      >
        <button
          type="button"
          onClick={closeLightbox}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black/70"
        >
          Zamknij
        </button>
        {visible.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showPrev();
              }}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white hover:bg-black/70 sm:left-4"
              aria-label="Poprzednie zdjęcie"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showNext();
              }}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white hover:bg-black/70 sm:right-4"
              aria-label="Następne zdjęcie"
            >
              ›
            </button>
          </>
        ) : null}
        <div className="max-h-[90vh] max-w-[min(100%,56rem)]" onClick={(e) => e.stopPropagation()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={visible[lightboxIndex].public_url!}
            alt={visible[lightboxIndex].caption || workshopName}
            className="max-h-[85vh] w-full object-contain"
          />
          {visible[lightboxIndex].caption ? (
            <p className="mt-2 text-center text-sm text-zinc-200">{visible[lightboxIndex].caption}</p>
          ) : null}
          {visible.length > 1 ? (
            <p className="mt-1 text-center text-xs text-zinc-400">
              {lightboxIndex + 1} / {visible.length}
            </p>
          ) : null}
        </div>
      </div>
    ) : null;

  if (layout === "mobile") {
    return (
      <>
        {openBtn(
          0,
          "relative mb-1.5 block h-[100px] w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800",
          // eslint-disable-next-line @next/next/no-img-element
          <img src={visible[0]!.public_url!} alt="" className="h-full w-full object-cover" />,
        )}
        {visible.length > 1 ? (
          <div className="-mx-0.5 flex gap-1.5 overflow-x-auto pb-0.5">
            {visible.slice(1).map((ph, i) =>
              openBtn(
                i + 1,
                "relative h-14 w-20 shrink-0 overflow-hidden rounded-lg",
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ph.public_url!} alt="" className="h-full w-full object-cover" />,
              ),
            )}
          </div>
        ) : null}
        {lightbox}
      </>
    );
  }

  const morePhotos = visible.slice(1);

  return (
    <>
      <div
        className={
          morePhotos.length > 0
            ? "grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
            : "grid grid-cols-1"
        }
      >
        {openBtn(
          0,
          `relative h-52 w-full overflow-hidden rounded-2xl border text-left ${
            isDark ? "border-zinc-700 bg-zinc-800/70" : "border-blue-100 bg-white/70"
          }`,
          // eslint-disable-next-line @next/next/no-img-element
          <img src={visible[0]!.public_url!} alt={workshopName} className="h-full w-full object-cover" />,
        )}
        {morePhotos.length > 0 ? (
          <div className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-0.5 md:max-h-52">
            {morePhotos.map((ph, i) =>
              openBtn(
                i + 1,
                `relative h-[68px] w-full shrink-0 overflow-hidden rounded-xl border ${
                  isDark ? "border-zinc-700 bg-zinc-800/70" : "border-blue-100 bg-white/70"
                }`,
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ph.public_url!} alt="" className="h-full w-full object-cover" />,
              ),
            )}
          </div>
        ) : null}
      </div>
      {lightbox}
    </>
  );
}
