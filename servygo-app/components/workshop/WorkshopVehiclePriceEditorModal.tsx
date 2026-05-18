"use client";

import { useMemo } from "react";
import { createPortal } from "react-dom";
import {
  getVehicleBrands,
  getVehicleFuels,
  getVehicleModels,
  getVehicleYears,
  sortAlphabetically,
  sortYearsDesc,
  vehicleTypeOptions,
  type VehicleTypeKey,
} from "@/lib/vehicleData";
import { normalizeServiceDifficultyLevel, type ServiceDifficultyLevel } from "@/lib/serviceDifficulty";

export type WorkshopVehiclePriceEditorDraft = {
  id?: string;
  workshop_service_id: string;
  service_name: string;
  vehicle_type: VehicleTypeKey | "";
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
  body_types: string[];
};

type WorkshopVehiclePriceEditorModalProps = {
  draft: WorkshopVehiclePriceEditorDraft;
  readOnly: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onPatch: (patch: Partial<WorkshopVehiclePriceEditorDraft>) => void;
};

const BODY_TYPE_OPTIONS: { key: string; label: string }[] = [
  { key: "hatchback", label: "Hatchback" },
  { key: "sedan_liftback", label: "Sedan / Liftback" },
  { key: "kombi", label: "Kombi" },
  { key: "suv_crossover", label: "SUV / Crossover" },
  { key: "mpv_van", label: "MPV / Van osobowy" },
  { key: "coupe_cabrio", label: "Coupe / Cabrio" },
];

const modalFieldClassName =
  "h-11 rounded-[10px] border border-gray-200 bg-gray-50 px-3 text-[14px] text-gray-900 transition duration-200 hover:border-[#cbd5f5] focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60";

const modalSmallFieldClassName =
  "h-10 rounded-[10px] border border-gray-200 bg-gray-50 px-3 text-[13px] text-gray-900 transition duration-200 hover:border-[#cbd5f5] focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60";

export default function WorkshopVehiclePriceEditorModal({
  draft,
  readOnly,
  saving,
  onClose,
  onSave,
  onPatch,
}: WorkshopVehiclePriceEditorModalProps) {
  const vt = draft.vehicle_type || "car";

  const yearOptions = useMemo(() => sortYearsDesc(getVehicleYears()).map(String), []);

  const brandOptions = useMemo(() => sortAlphabetically(getVehicleBrands(vt)), [vt]);
  const fuelOptions = useMemo(() => sortAlphabetically(getVehicleFuels(vt)), [vt]);
  const modelOptions = useMemo(() => {
    const b = draft.brand.trim();
    if (!b) return [] as string[];
    return sortAlphabetically(getVehicleModels(vt, draft.brand));
  }, [vt, draft.brand]);

  const brandOptionNodes = useMemo(
    () => brandOptions.map((brand) => <option key={`vehicle-brand-${brand}`} value={brand}>{brand}</option>),
    [brandOptions],
  );
  const modelOptionNodes = useMemo(
    () => modelOptions.map((model) => <option key={`vehicle-model-${model}`} value={model}>{model}</option>),
    [modelOptions],
  );
  const fuelOptionNodes = useMemo(
    () => fuelOptions.map((fuel) => <option key={`vehicle-fuel-${fuel}`} value={fuel}>{fuel}</option>),
    [fuelOptions],
  );
  const yearOptionNodes = useMemo(
    () => yearOptions.map((year) => <option key={`vehicle-year-opt-${year}`} value={year}>{year}</option>),
    [yearOptions],
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center bg-black/40 p-4">
      <div className="flex w-[90%] max-h-[90vh] max-w-[640px] flex-col overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-gray-200 pb-4">
          <div>
            <h4 className="text-xl font-bold text-gray-900">{draft.id ? "Edytuj cenę" : "Dodaj cenę"}</h4>
            <p className="mt-0.5 text-xs text-gray-500">Wybierz tryb, uzupełnij cenę i zapisz.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100">
            Zamknij
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={readOnly || saving}
            onClick={() =>
              onPatch({
                body_types: ["hatchback"],
                brand: "",
                model: "",
                vehicle_type: "car" as VehicleTypeKey,
                fuel: "",
                year_from: "",
                year_to: "",
                engine: "",
                transmission: "",
              })
            }
            className={`rounded-xl border p-3 text-left transition ${
              draft.body_types.length > 0
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-gray-50 hover:border-blue-300"
            }`}
          >
            <p className={`text-sm font-semibold ${draft.body_types.length > 0 ? "text-blue-800" : "text-gray-800"}`}>Typ nadwozia</p>
            <p className={`mt-0.5 text-xs ${draft.body_types.length > 0 ? "text-blue-600" : "text-gray-500"}`}>Szybko — wybierz nadwozie, wpisz cenę</p>
          </button>
          <button
            type="button"
            disabled={readOnly || saving}
            onClick={() => onPatch({ body_types: [] })}
            className={`rounded-xl border p-3 text-left transition ${
              draft.body_types.length === 0
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-gray-50 hover:border-blue-300"
            }`}
          >
            <p className={`text-sm font-semibold ${draft.body_types.length === 0 ? "text-blue-800" : "text-gray-800"}`}>Konkretne auto</p>
            <p className={`mt-0.5 text-xs ${draft.body_types.length === 0 ? "text-blue-600" : "text-gray-500"}`}>Marka + model + rok (precyzyjnie)</p>
          </button>
        </div>

        {draft.body_types.length > 0 ? (
          <>
            <p className="mb-2 text-xs font-semibold text-gray-700">Zaznacz nadwozia których dotyczy ta cena:</p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {BODY_TYPE_OPTIONS.map((opt) => {
                const selected = draft.body_types.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={readOnly || saving}
                    onClick={() => {
                      const next = selected
                        ? draft.body_types.filter((k) => k !== opt.key)
                        : [...draft.body_types, opt.key];
                      onPatch({ body_types: next.length > 0 ? next : [opt.key] });
                    }}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      selected
                        ? "border-blue-500 bg-blue-50 text-blue-800"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-blue-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mb-4 grid grid-cols-1 gap-x-5 md:grid-cols-2">
            <label className="mb-4 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Typ pojazdu</span>
              <select
                disabled={readOnly || saving}
                value={draft.vehicle_type}
                onChange={(e) => onPatch({ vehicle_type: e.target.value as VehicleTypeKey, brand: "", model: "", fuel: "" })}
                className={modalFieldClassName}
              >
                {vehicleTypeOptions.map((option) => (
                  <option key={`vehicle-type-${option.key}`} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="mb-4 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Marka</span>
              <select disabled={readOnly || saving} value={draft.brand} onChange={(e) => onPatch({ brand: e.target.value, model: "" })} className={modalFieldClassName}>
                <option value="">Wybierz markę</option>
                {brandOptionNodes}
              </select>
            </label>
            <label className="mb-4 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Model</span>
              <select disabled={readOnly || saving || !draft.brand} value={draft.model} onChange={(e) => onPatch({ model: e.target.value })} className={modalFieldClassName}>
                <option value="">Wybierz model</option>
                {modelOptionNodes}
              </select>
            </label>
            <label className="mb-4 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Paliwo</span>
              <select disabled={readOnly || saving} value={draft.fuel} onChange={(e) => onPatch({ fuel: e.target.value })} className={modalFieldClassName}>
                <option value="">Wybierz paliwo</option>
                {fuelOptionNodes}
              </select>
            </label>
            <label className="mb-4 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Rok od</span>
              <select disabled={readOnly || saving} value={draft.year_from} onChange={(e) => onPatch({ year_from: e.target.value })} className={modalFieldClassName}>
                <option value="">Od</option>
                {yearOptionNodes}
              </select>
            </label>
            <label className="mb-4 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Rok do</span>
              <select disabled={readOnly || saving} value={draft.year_to} onChange={(e) => onPatch({ year_to: e.target.value })} className={modalFieldClassName}>
                <option value="">Do</option>
                {yearOptionNodes}
              </select>
            </label>
            <label className="mb-4 flex flex-col gap-1.5 text-sm col-span-2">
              <span className="font-medium text-gray-500 text-xs">Silnik i skrzynia biegów — opcjonalne</span>
            </label>
            <label className="mb-4 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Silnik (opcjonalnie)</span>
              <input disabled={readOnly || saving} value={draft.engine} onChange={(e) => onPatch({ engine: e.target.value })} className={modalFieldClassName} />
            </label>
            <label className="mb-4 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Skrzynia (opcjonalnie)</span>
              <input disabled={readOnly || saving} value={draft.transmission} onChange={(e) => onPatch({ transmission: e.target.value })} className={modalFieldClassName} />
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-5">
          <label className="mb-4 flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-gray-900">Cena od (zł)</span>
            <input disabled={readOnly || saving} value={draft.price_from} onChange={(e) => onPatch({ price_from: e.target.value })} className={modalFieldClassName} />
          </label>
          <label className="mb-4 flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-gray-900">Cena do (zł)</span>
            <input disabled={readOnly || saving} value={draft.price_to} onChange={(e) => onPatch({ price_to: e.target.value })} className={modalFieldClassName} />
          </label>
          <label className="mb-4 flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-gray-900">Czas (min)</span>
            <input disabled={readOnly || saving} value={draft.duration_minutes} onChange={(e) => onPatch({ duration_minutes: e.target.value })} className={modalFieldClassName} />
          </label>
          <label className="mb-4 flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-gray-900">Poziom trudności</span>
            <select disabled={readOnly || saving} value={draft.difficulty_level} onChange={(e) => onPatch({ difficulty_level: normalizeServiceDifficultyLevel(e.target.value) })} className={modalSmallFieldClassName}>
              <option value="low">Niski</option>
              <option value="medium">Średni</option>
              <option value="high">Wysoki</option>
            </select>
          </label>
          <div className="mb-4 flex items-center gap-3 text-sm col-span-2">
            <button
              type="button"
              role="switch"
              aria-checked={draft.is_active}
              disabled={readOnly || saving}
              onClick={() => onPatch({ is_active: !draft.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${draft.is_active ? "bg-[#2563eb]" : "bg-zinc-400"} disabled:opacity-50`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${draft.is_active ? "translate-x-5" : "translate-x-1"}`} />
            </button>
            <span className="font-medium text-gray-900">Aktywne</span>
          </div>
        </div>

        <div className="sticky bottom-0 mt-2 flex justify-end gap-3 border-t border-gray-200 bg-white pt-4">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-gray-300 bg-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-300 disabled:opacity-50">
            Anuluj
          </button>
          <button type="button" disabled={readOnly || saving} onClick={onSave} className="rounded-xl bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Zapisywanie..." : "Zapisz"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

