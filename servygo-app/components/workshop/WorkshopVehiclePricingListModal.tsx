"use client";

import { memo, useMemo, useState } from "react";
import ServiceDifficultyBadge from "@/components/ServiceDifficultyBadge";
import type { ServiceDifficultyLevel } from "@/lib/serviceDifficulty";

const VEHICLE_PRICE_MODAL_PAGE = 50;

export type WorkshopVehiclePricingListRow = {
  id?: string;
  workshop_service_id: string;
  service_name: string;
  vehicle_type: string;
  brand: string;
  model: string;
  year_from: string;
  year_to: string;
  engine: string;
  fuel: string;
  transmission: string;
  price_from: string;
  price_to: string;
  duration_minutes: string;
  difficulty_level: ServiceDifficultyLevel;
  is_active: boolean;
  body_types?: string[] | null;
};

const BODY_TYPE_LABELS: Record<string, string> = {
  hatchback: "Hatchback",
  sedan_liftback: "Sedan / Liftback",
  kombi: "Kombi",
  suv_crossover: "SUV / Crossover",
  mpv_van: "MPV / Van",
  coupe_cabrio: "Coupe / Cabrio",
};

type VehicleTypeOption = { key: string; label: string };

type WorkshopVehiclePricingListModalProps = {
  isDark: boolean;
  readOnly: boolean;
  selectedServiceName: string;
  rows: WorkshopVehiclePricingListRow[];
  vehicleTypeOptions: readonly VehicleTypeOption[];
  vehiclePriceActionId: string | null;
  onClose: () => void;
  onAdd: () => void;
  onToggleActive: (row: WorkshopVehiclePricingListRow, next: boolean) => void;
  onEdit: (row: WorkshopVehiclePricingListRow) => void;
  onDelete: (row: WorkshopVehiclePricingListRow) => void;
};

function WorkshopVehiclePricingListModalInner({
  isDark,
  readOnly,
  selectedServiceName,
  rows,
  vehicleTypeOptions,
  vehiclePriceActionId,
  onClose,
  onAdd,
  onToggleActive,
  onEdit,
  onDelete,
}: WorkshopVehiclePricingListModalProps) {
  const [rowLimit, setRowLimit] = useState(VEHICLE_PRICE_MODAL_PAGE);

  const typeLabelByKey = useMemo(
    () => new Map(vehicleTypeOptions.map((x) => [x.key, x.label])),
    [vehicleTypeOptions],
  );

  const visibleRows = useMemo(() => rows.slice(0, rowLimit), [rows, rowLimit]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-5">
      <button type="button" className="absolute inset-0" aria-label="Zamknij panel cen aut" onClick={onClose} />
      <div
        className={`relative z-[1] h-[94vh] w-full overflow-hidden border sm:h-auto sm:max-h-[90vh] sm:max-w-6xl sm:rounded-2xl ${
          isDark ? "border-blue-500/35 bg-zinc-950 text-zinc-100" : "border-blue-200 bg-white text-zinc-900"
        }`}
      >
        <div className={`sticky top-0 z-10 border-b px-4 py-3 sm:px-5 ${isDark ? "border-zinc-800 bg-zinc-950" : "border-blue-100 bg-white"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold">
                {selectedServiceName ? `${selectedServiceName} — ceny dla konkretnych aut` : "Ceny dla konkretnych aut"}
              </h3>
              <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Ustawiasz tutaj ceny i czas tylko dla wybranego auta.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={readOnly || !selectedServiceName}
                onClick={onAdd}
                className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-600 disabled:opacity-50"
              >
                Dodaj cenę dla auta
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-xs font-semibold">
                Zamknij
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[calc(94vh-116px)] overflow-auto p-4 sm:max-h-[calc(90vh-120px)] sm:p-5">
          {rows.length === 0 ? (
            <p className={`rounded-xl border px-3 py-2 text-sm ${isDark ? "border-zinc-700 text-zinc-400" : "border-blue-100 text-zinc-600"}`}>
              Brak cen aut dla tej usługi. Dodaj pierwszy wariant.
            </p>
          ) : (
            <div className="space-y-2">
              {visibleRows.map((row, idx) => {
                const isBodyType = Array.isArray(row.body_types) && row.body_types.length > 0;
                const vehicleTypeLabel = typeLabelByKey.get(row.vehicle_type) ?? "Pojazd";
                const details = [row.engine?.trim(), row.fuel?.trim(), row.transmission?.trim()].filter(Boolean).join(" · ") || null;
                const yearRange = row.year_from && row.year_to ? `${row.year_from}–${row.year_to}` : row.year_from || row.year_to || null;
                const actionKey = row.id ?? `${row.service_name}:${row.brand}:${row.model}:${row.engine}`;
                const actionBusy = vehiclePriceActionId === actionKey;

                return (
                  <div
                    key={row.id ?? `vehicle-row-${idx}`}
                    className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900" : "border-zinc-200 bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {isBodyType ? (
                          <>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {row.body_types!.map((k) => BODY_TYPE_LABELS[k] ?? k).join(", ")}
                            </p>
                            <p className={`mt-0.5 text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>typ nadwozia</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {[row.brand, row.model].filter(Boolean).join(" ") || "—"}
                            </p>
                            <p className={`mt-0.5 text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                              {[vehicleTypeLabel, yearRange, details].filter(Boolean).join(" · ")}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className={`text-sm font-semibold ${isDark ? "text-blue-300" : "text-blue-700"}`}>
                          {row.price_from ? `${row.price_from}–${row.price_to} zł` : "Brak ceny"}
                        </p>
                        <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          isBodyType
                            ? isDark ? "border-blue-500/40 bg-blue-500/15 text-blue-300" : "border-blue-300 bg-blue-50 text-blue-800"
                            : isDark ? "border-green-500/40 bg-green-500/15 text-green-300" : "border-green-300 bg-green-50 text-green-800"
                        }`}>
                          {isBodyType ? "Ogólna" : "Precyzyjna"}
                        </span>
                      </div>
                    </div>
                    <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                      {row.duration_minutes ? <span>{row.duration_minutes} min</span> : null}
                      <ServiceDifficultyBadge difficulty_level={row.difficulty_level} isDark={isDark} compact />
                      <button
                        type="button"
                        disabled={readOnly || actionBusy}
                        onClick={() => void onToggleActive(row, !row.is_active)}
                        aria-label={row.is_active ? "Deaktywuj" : "Aktywuj"}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full border transition disabled:opacity-50 ${
                          row.is_active ? "border-blue-500 bg-blue-500" : isDark ? "border-zinc-600 bg-zinc-700" : "border-zinc-300 bg-zinc-300"
                        }`}
                      >
                        <span className={`h-3.5 w-3.5 rounded-full bg-white transition ${row.is_active ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                      </button>
                      <span>{row.is_active ? "Aktywne" : "Nieaktywne"}</span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={readOnly || actionBusy}
                        onClick={() => onEdit(row)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isDark ? "border-zinc-600 text-zinc-200" : "border-zinc-300 text-zinc-800"}`}
                      >
                        Edytuj
                      </button>
                      <button
                        type="button"
                        disabled={readOnly || actionBusy}
                        onClick={() => void onDelete(row)}
                        className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-500 disabled:opacity-50"
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                );
              })}
              {rows.length > visibleRows.length ? (
                <button
                  type="button"
                  className={`mt-2 rounded-lg border px-3 py-2 text-xs font-semibold ${isDark ? "border-zinc-600 text-zinc-200" : "border-zinc-300 text-zinc-800"}`}
                  onClick={() => setRowLimit((n) => n + VEHICLE_PRICE_MODAL_PAGE)}
                >
                  Pokaż więcej ({rows.length - visibleRows.length} pozostałych)
                </button>
              ) : null}
            </div>
          )}


          <div className={`mt-4 rounded-xl border px-3 py-2 text-xs ${isDark ? "border-blue-500/40 bg-blue-950/30 text-blue-100" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
            Ceny ustawione tutaj mają pierwszeństwo dla wybranego auta.
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(WorkshopVehiclePricingListModalInner);
