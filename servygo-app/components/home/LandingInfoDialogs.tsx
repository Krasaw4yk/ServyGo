"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import MobileBottomSheet from "@/components/MobileBottomSheet";
import {
  createTranslator,
  getTranslationNode,
  type LanguageCode,
} from "@/lib/translations";

export type LandingInfoPanelKey = "contact" | "about" | "workshops" | "drivers" | "howItWorks";

type StepCopy = { title: string; desc: string };

type Props = {
  panel: LandingInfoPanelKey | null;
  onClose: () => void;
  /** Z „Dla kierowców” — przełącza na pełny opis kroków. */
  onDriversSeeHow: () => void;
  language: LanguageCode;
  isDark: boolean;
};

function BulletList({ items, isDark }: { items: string[]; isDark: boolean }) {
  return (
    <ul className={`mt-2 list-disc space-y-2 pl-5 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function LandingInfoDialogs({
  panel,
  onClose,
  onDriversSeeHow,
  language,
  isDark,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const t = useMemo(() => createTranslator(language), [language]);

  const howSteps = useMemo((): StepCopy[] => {
    const raw = getTranslationNode("landing.howItWorksSteps", language);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (x): x is StepCopy =>
        Boolean(x) && typeof x === "object" && "title" in x && "desc" in x,
    ) as StepCopy[];
  }, [language]);

  const workshopBullets = useMemo((): string[] => {
    const raw = getTranslationNode("landing.workshopsBullets", language);
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [language]);

  const driverBullets = useMemo((): string[] => {
    const raw = getTranslationNode("landing.driversBullets", language);
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [language]);

  useEffect(() => {
    if (!panel) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [panel, onClose]);

  const title =
    panel === "contact"
      ? t("landing.modalContactTitle")
      : panel === "about"
        ? t("landing.modalAboutTitle")
        : panel === "workshops"
          ? t("landing.modalWorkshopsTitle")
          : panel === "drivers"
            ? t("landing.modalDriversTitle")
            : panel === "howItWorks"
              ? t("landing.modalHowTitle")
              : "";

  const cardBorder = isDark ? "border-zinc-600/80 bg-zinc-950/75" : "border-blue-100/90 bg-blue-50/40";

  const renderPanelInner = () => {
    if (!panel) return null;
    switch (panel) {
      case "contact":
        return (
          <div className="space-y-4">
            <p className={isDark ? "text-zinc-300" : "text-zinc-700"}>{t("landing.contactIntro")}</p>
            <div className={`rounded-xl border p-3 ${cardBorder}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                {t("landing.contactEmailLabel")}
              </p>
              <a
                href={`mailto:${t("landing.contactEmailValue")}`}
                className={`mt-1 inline-block break-all text-sm font-semibold underline-offset-2 hover:underline ${
                  isDark ? "text-blue-300" : "text-blue-700"
                }`}
              >
                {t("landing.contactEmailValue")}
              </a>
            </div>
            <div className={`rounded-xl border p-3 ${cardBorder}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                {t("landing.contactPhoneLabel")}
              </p>
              <p className={`mt-1 font-mono text-sm ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                {t("landing.contactPhonePlaceholder")}
              </p>
            </div>
          </div>
        );
      case "about":
        return (
          <div className={`space-y-3 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            <p>{t("landing.aboutP1")}</p>
            <p>{t("landing.aboutP2")}</p>
            <p>{t("landing.aboutP3")}</p>
          </div>
        );
      case "workshops":
        return (
          <div className="space-y-4">
            <p className={`font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{t("landing.workshopsLead")}</p>
            <BulletList items={workshopBullets} isDark={isDark} />
            <Link
              href="/dodaj-warsztat"
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-xl border border-orange-400/70 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-md transition hover:brightness-110"
            >
              {t("landing.workshopsCta")}
            </Link>
          </div>
        );
      case "drivers":
        return (
          <div className="space-y-4">
            <p className={`font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{t("landing.driversLead")}</p>
            <BulletList items={driverBullets} isDark={isDark} />
            <button
              type="button"
              onClick={onDriversSeeHow}
              className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                isDark
                  ? "border-orange-400/40 bg-orange-500/15 text-orange-100 hover:bg-orange-500/25"
                  : "border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100"
              }`}
            >
              {t("landing.driversCtaHow")}
            </button>
          </div>
        );
      case "howItWorks":
        return (
          <div className="space-y-3">
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{t("landing.howItWorksIntro")}</p>
            <div className="space-y-2">
              {howSteps.map((step, index) => (
                <div key={`${step.title}-${index}`} className={`rounded-xl border p-3 ${cardBorder}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-500 dark:text-orange-400">
                    {t("sections.stepLabel")} {index + 1}
                  </p>
                  <p className={`mt-1 font-semibold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{step.title}</p>
                  <p className={`mt-1 text-sm leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const scrollableBody = (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
      <div className="pb-1 pt-1">{renderPanelInner()}</div>
    </div>
  );

  const desktopShell = isDark
    ? "border-zinc-600 bg-zinc-900 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,.55)]"
    : "border-blue-200/90 bg-white text-zinc-900 shadow-[0_24px_80px_rgba(37,99,235,.18)]";

  if (!mounted || !panel) return null;

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[10055] hidden items-center justify-center p-4 sm:flex">
          <button
            type="button"
            aria-label="Zamknij"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-info-desktop-title"
            className={`relative z-10 flex max-h-[min(88vh,920px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border px-5 pb-5 pt-4 ${desktopShell}`}
          >
            <button
              type="button"
              aria-label="Zamknij"
              onClick={onClose}
              className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl border text-base font-semibold leading-none ${
                isDark ? "border-zinc-600 bg-zinc-800 text-zinc-100" : "border-zinc-300 bg-white text-zinc-800"
              }`}
            >
              ✕
            </button>
            <h2 id="landing-info-desktop-title" className="min-w-0 pr-12 text-lg font-bold leading-snug">
              {title}
            </h2>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
              {renderPanelInner()}
            </div>
          </div>
        </div>,
        document.body,
      )}

      <MobileBottomSheet
        isOpen={Boolean(panel)}
        title={title}
        onClose={onClose}
        isDark={isDark}
        tallList
        stackClassName="z-[10055]"
      >
        {scrollableBody}
      </MobileBottomSheet>
    </>
  );
}
