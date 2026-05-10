"use client";

import { useCallback, useEffect, useState } from "react";
import { getAvailableSlots } from "@/lib/bookingAvailability";
import { clientProposeBookingReschedule } from "@/lib/messagesApi";
import { useServyGoTranslator } from "@/lib/useServyGoLanguage";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type ClientRescheduleModalProps = {
  bookingId: string;
  workshopId: string;
  workshopName: string;
  serviceLabel: string;
  durationMinutes: number;
  employeeId: string | null;
  defaultDateKey: string | null;
  isDark: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ClientRescheduleModal({
  bookingId,
  workshopId,
  workshopName,
  serviceLabel,
  durationMinutes,
  employeeId,
  defaultDateKey,
  isDark,
  onClose,
  onSuccess,
}: ClientRescheduleModalProps) {
  const { t } = useServyGoTranslator();
  const minDate = todayDateKey();
  const [dateKey, setDateKey] = useState(() => {
    const d = (defaultDateKey ?? "").trim();
    return d && d >= minDate ? d : minDate;
  });
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    setError("");
    setSelectedSlot(null);
    try {
      const list = await getAvailableSlots({
        workshopId,
        date: dateKey,
        serviceDurationMinutes: durationMinutes,
        employeeId: employeeId ?? undefined,
      });
      setSlots(list);
    } catch (e) {
      setSlots([]);
      setError(e instanceof Error ? e.message : t("bookingsPage.rescheduleSlotsError"));
    } finally {
      setLoadingSlots(false);
    }
  }, [workshopId, dateKey, durationMinutes, employeeId, t]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadSlots());
    return () => window.cancelAnimationFrame(frame);
  }, [loadSlots]);

  async function submit() {
    if (!selectedSlot) {
      setError(t("bookingsPage.reschedulePickTime"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await clientProposeBookingReschedule(bookingId, dateKey, selectedSlot, note);
      onSuccess();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("bookingsPage.rescheduleSaveFailed");
      if (msg.includes("SLOT_CONFLICT")) setError(t("bookingsPage.rescheduleSlotTaken"));
      else if (msg.includes("OUTSIDE_OPENING_HOURS")) setError(t("bookingsPage.rescheduleOutsideHours"));
      else setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const shell = isDark ? "border-zinc-600 bg-zinc-900 text-zinc-100" : "border-blue-200 bg-white text-zinc-900";
  const labelMuted = isDark ? "text-zinc-400" : "text-zinc-600";

  return (
    <div className="fixed inset-0 z-[10055] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label={t("commonUi.close")} onClick={onClose} />
      <div
        className={`relative z-[1] flex max-h-[min(92vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl ${shell}`}
      >
        <div className={`border-b px-5 py-4 ${isDark ? "border-zinc-700" : "border-blue-100"}`}>
          <h2 className="text-lg font-bold">{t("bookingsPage.rescheduleModalTitle")}</h2>
          <p className={`mt-1 text-sm ${labelMuted}`}>{t("bookingsPage.rescheduleModalLead")}</p>
          <p className={`mt-2 text-xs ${labelMuted}`}>
            {workshopName} · {serviceLabel} · {durationMinutes} {t("commonUi.minSuffix")}
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-sm font-semibold">
            {t("bookingsPage.rescheduleDateLabel")}
            <input
              type="date"
              min={minDate}
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm text-black ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
            />
          </label>

          <div>
            <p className="text-sm font-semibold">{t("bookingsPage.rescheduleSlotsTitle")}</p>
            {loadingSlots ? (
              <p className={`mt-2 text-sm ${labelMuted}`}>{t("commonUi.loading")}</p>
            ) : slots.length === 0 ? (
              <p className={`mt-2 text-sm ${labelMuted}`}>{t("bookingsPage.rescheduleSlotsEmpty")}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {slots.map((s) => {
                  const active = selectedSlot === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSlot(s)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        active
                          ? isDark
                            ? "border-orange-400 bg-orange-500/25 text-orange-100"
                            : "border-orange-400 bg-orange-50 text-orange-950"
                          : isDark
                            ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800"
                            : "border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="block text-sm font-semibold">
            {t("bookingsPage.rescheduleNoteLabel")}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm text-black ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
              placeholder={t("bookingsPage.rescheduleNotePlaceholder")}
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">{error}</p>
          ) : null}
        </div>

        <div className={`flex flex-wrap justify-end gap-2 border-t px-5 py-4 ${isDark ? "border-zinc-700" : "border-blue-100"}`}>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${isDark ? "border-zinc-500 text-zinc-200" : "border-zinc-300 text-zinc-800"}`}
          >
            {t("commonUi.cancel")}
          </button>
          <button
            type="button"
            disabled={busy || !selectedSlot}
            onClick={() => void submit()}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
          >
            {busy ? t("commonUi.sending") : t("bookingsPage.rescheduleProposeCta")}
          </button>
        </div>
      </div>
    </div>
  );
}
