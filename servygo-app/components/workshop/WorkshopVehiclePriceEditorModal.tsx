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
};

type WorkshopVehiclePriceEditorModalProps = {
  draft: WorkshopVehiclePriceEditorDraft;
  readOnly: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onPatch: (patch: Partial<WorkshopVehiclePriceEditorDraft>) => void;
};

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
      <div className="flex w-[90%] max-h-[90vh] max-w-[1000px] flex-col overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-gray-200 pb-4">
          <h4 className="text-2xl font-bold text-gray-900">{draft.id ? "Edytuj cenę auta" : "Dodaj cenę dla auta"}</h4>
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-100">
            Zamknij
          </button>
        </div>
        <div className="mt-1">
          <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
            <label className="mb-5 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Typ pojazdu</span>
              <select
                disabled={readOnly || saving}
                value={draft.vehicle_type}
                onChange={(e) =>
                  onPatch({
                    vehicle_type: e.target.value as VehicleTypeKey,
                    brand: "",
                    model: "",
                    fuel: "",
                  })
                }
                className={modalFieldClassName}
              >
                {vehicleTypeOptions.map((option) => (
                  <option key={`vehicle-type-${option.key}`} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="mb-5 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Marka</span>
              <select
                disabled={readOnly || saving}
                value={draft.brand}
                onChange={(e) => onPatch({ brand: e.target.value, model: "" })}
                className={modalFieldClassName}
              >
                <option value="">Wybierz markę</option>
                {brandOptionNodes}
              </select>
            </label>
            <label className="mb-5 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Model</span>
              <select
                disabled={readOnly || saving || !draft.brand}
                value={draft.model}
                onChange={(e) => onPatch({ model: e.target.value })}
                className={modalFieldClassName}
              >
                <option value="">Wybierz model</option>
                {modelOptionNodes}
              </select>
            </label>
            <label className="mb-5 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Silnik</span>
              <input
                disabled={readOnly || saving}
                value={draft.engine}
                onChange={(e) => onPatch({ engine: e.target.value })}
                className={modalFieldClassName}
              />
            </label>
            <label className="mb-5 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Paliwo</span>
              <select
                disabled={readOnly || saving}
                value={draft.fuel}
                onChange={(e) => onPatch({ fuel: e.target.value })}
                className={modalFieldClassName}
              >
                <option value="">Wybierz paliwo</option>
                {fuelOptionNodes}
              </select>
            </label>
            <label className="mb-5 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Skrzynia biegów (opcjonalnie)</span>
              <input
                disabled={readOnly || saving}
                value={draft.transmission}
                onChange={(e) => onPatch({ transmission: e.target.value })}
                className={modalFieldClassName}
              />
            </label>
            <label className="mb-5 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Rok od</span>
              <select
                disabled={readOnly || saving}
                value={draft.year_from}
                onChange={(e) => onPatch({ year_from: e.target.value })}
                className={modalFieldClassName}
              >
                <option value="">Od</option>
                {yearOptionNodes}
              </select>
            </label>
            <label className="mb-5 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Rok do</span>
              <select
                disabled={readOnly || saving}
                value={draft.year_to}
                onChange={(e) => onPatch({ year_to: e.target.value })}
                className={modalFieldClassName}
              >
                <option value="">Do</option>
                {yearOptionNodes}
              </select>
            </label>
            <label className="mb-5 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Cena od</span>
              <input
                disabled={readOnly || saving}
                value={draft.price_from}
                onChange={(e) => onPatch({ price_from: e.target.value })}
                className={modalFieldClassName}
              />
            </label>
            <label className="mb-5 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Cena do</span>
              <input
                disabled={readOnly || saving}
                value={draft.price_to}
                onChange={(e) => onPatch({ price_to: e.target.value })}
                className={modalFieldClassName}
              />
            </label>
            <label className="mb-5 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Czas (min)</span>
              <input
                disabled={readOnly || saving}
                value={draft.duration_minutes}
                onChange={(e) => onPatch({ duration_minutes: e.target.value })}
                className={modalFieldClassName}
              />
            </label>
            <label className="mb-5 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-gray-900">Poziom trudności</span>
              <span className="text-[12px] text-gray-600">Dotyczy tylko tego wariantu auta.</span>
              <select
                disabled={readOnly || saving}
                value={draft.difficulty_level}
                onChange={(e) =>
                  onPatch({ difficulty_level: normalizeServiceDifficultyLevel(e.target.value) })
                }
                className={modalSmallFieldClassName}
              >
                <option value="low">Niski</option>
                <option value="medium">Średni</option>
                <option value="high">Wysoki</option>
              </select>
            </label>
            <div className="mb-5 flex items-center gap-3 text-sm md:pt-6">
              <button
                type="button"
                role="switch"
                aria-checked={draft.is_active}
                disabled={readOnly || saving}
                onClick={() => onPatch({ is_active: !draft.is_active })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition duration-200 ${draft.is_active ? "bg-[#2563eb]" : "bg-zinc-400"} disabled:opacity-50`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ${draft.is_active ? "translate-x-5" : "translate-x-1"}`} />
              </button>
              <span className="font-medium text-gray-900">Aktywne</span>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 mt-5 flex justify-end gap-3 border-t border-gray-200 bg-white pt-4">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-gray-300 bg-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-300 disabled:opacity-50">
            Anuluj
          </button>
          <button type="button" disabled={readOnly || saving} onClick={onSave} className="rounded-xl bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Zapisywanie..." : "Zapisz"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
