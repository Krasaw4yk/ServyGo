"use client";

import { FormEvent, useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import AutocompleteSelect from "@/components/AutocompleteSelect";
import ServiceCategoryPicker from "@/components/ServiceCategoryPicker";
import { MobileCompactSearchField, searchFormFieldIconMap } from "@/components/home/MobileCompactSearchField";
import { VinOptionalHint } from "@/components/VinOptionalHint";
import type { LanguageCode } from "@/lib/translations";
import {
  selectedItemsToSummary,
  toggleSelectedServiceItem,
  type SelectedServiceItem,
} from "@/lib/selectedServices";
import type { ServiceCategory } from "@/lib/serviceCatalog";
import {
  getBodyTypeForModel,
  hasMultipleBodyTypes,
  BODY_TYPE_LABELS,
  type BodyTypeKey,
} from "@/lib/bodyTypeMap";
import { vehicleTypeOptions, type VehicleTypeKey } from "@/lib/vehicleData";

const SHOW_MANUAL_MISSING_VEHICLE_UI = false;

const searchFieldErrorRingClass =
  "!border-[#ef4444] shadow-[0_0_0_2px_rgba(239,68,68,0.15)] focus:!border-[#ef4444] focus:shadow-[0_0_0_2px_rgba(239,68,68,0.2)]";
const searchFieldErrorHintClass = "text-xs font-medium text-[#dc2626]";

const submitButtonClass =
  "inline-flex h-10 w-full max-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(59,130,246,0.28),0_8px_22px_rgba(249,115,22,0.24)] transition-all duration-300 hover:scale-[1.01] hover:from-blue-500 hover:to-orange-400 hover:shadow-[0_14px_36px_rgba(59,130,246,0.35),0_10px_28px_rgba(249,115,22,0.3)] max-md:h-11 max-md:max-h-[48px] md:h-12 md:px-6 md:py-3 md:text-base disabled:opacity-60";

export type SearchFieldKey = "vehicleType" | "brand" | "model" | "year" | "fuel" | "service" | "city";

type ServiceAvailability = {
  available: boolean;
  priceHint?: string;
} | null;

export type SearchWizardProps = {
  isDark: boolean;
  isSubmitting: boolean;
  language: LanguageCode;
  t: (key: string) => string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  vehicleType: VehicleTypeKey | "";
  setVehicleType: (value: VehicleTypeKey | "") => void;
  brand: string;
  setBrand: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  year: string;
  setYear: (value: string) => void;
  fuel: string;
  setFuel: (value: string) => void;
  bodyType: BodyTypeKey | "";
  setBodyType: (value: BodyTypeKey | "") => void;
  selectedServiceItems: SelectedServiceItem[];
  setSelectedServiceItems: Dispatch<SetStateAction<SelectedServiceItem[]>>;
  searchCity: string;
  setSearchCity: (value: string) => void;
  searchVin: string;
  setSearchVin: (value: string) => void;
  searchFieldErrors: Partial<Record<SearchFieldKey, string>>;
  setSearchFieldErrors: Dispatch<SetStateAction<Partial<Record<SearchFieldKey, string>>>>;
  clearSearchFieldError: (field: SearchFieldKey) => void;
  brandsForVehicleType: string[];
  modelsForBrand: string[];
  fuelsForVehicleType: string[];
  years: string[];
  serviceCatalogForVehicleType: ServiceCategory[];
  getFinalServiceAvailabilityFromFavorite: (serviceName: string) => ServiceAvailability;
  translatedFuelLabel: string;
  translatedServiceLabel: string;
  currentFieldClassName: string;
  searchFormControlMobileStrip: string;
  searchFormAutocompleteShell: string;
  searchFormChevronToggleHide: string;
  favoriteServiceBlocked: boolean;
  selectedFavoriteWorkshopId: string | null;
  setSelectedFavoriteWorkshopId: (value: string | null) => void;
  onClearFilters: () => void;
  showManualVehicle: boolean;
  setShowManualVehicle: (value: boolean | ((prev: boolean) => boolean)) => void;
  setSelectedSavedCarId: (value: string) => void;
  manualType: string;
  setManualType: (value: string) => void;
  manualBrand: string;
  setManualBrand: (value: string) => void;
  manualModel: string;
  setManualModel: (value: string) => void;
  manualYear: string;
  setManualYear: (value: string) => void;
  manualDescription: string;
  setManualDescription: (value: string) => void;
  maxManualYear: string | undefined;
  onWizardStepChange?: (step: 1 | 2) => void;
};

function WizardProgress({ step, isDark }: { step: 1 | 2; isDark: boolean }) {
  const lineClass = isDark ? "bg-zinc-700" : "bg-blue-100";
  const activeDot = "border-blue-600 bg-blue-600 text-white";
  const inactiveDot = isDark
    ? "border-zinc-600 bg-zinc-900 text-zinc-400"
    : "border-blue-200 bg-white text-zinc-500";
  const doneDot = isDark
    ? "border-blue-500 bg-blue-600/90 text-white"
    : "border-blue-500 bg-blue-600 text-white";

  return (
    <div className="mb-5 md:hidden" aria-label={`Krok ${step} z 2`}>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
        <span className={isDark ? "text-blue-300" : "text-blue-700"}>Krok {step} z 2</span>
        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>{step === 1 ? "Twoje auto" : "Czego szukasz?"}</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
            step >= 1 ? (step === 1 ? activeDot : doneDot) : inactiveDot
          }`}
        >
          1
        </div>
        <div className={`h-0.5 flex-1 rounded-full ${lineClass}`}>
          <div
            className={`h-full rounded-full bg-gradient-to-r from-blue-600 to-orange-500 transition-all duration-300 ${
              step >= 2 ? "w-full" : "w-0"
            }`}
          />
        </div>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
            step === 2 ? activeDot : inactiveDot
          }`}
        >
          2
        </div>
      </div>
    </div>
  );
}

function MobileStepHeader({
  title,
  description,
  isDark,
}: {
  title: string;
  description: string;
  isDark: boolean;
}) {
  return (
    <div className="mb-4 md:hidden">
      <h3 className={`text-lg font-bold ${isDark ? "text-zinc-50" : "text-zinc-900"}`}>{title}</h3>
      <p className={`mt-1.5 text-sm leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{description}</p>
    </div>
  );
}

export default function SearchWizard({
  isDark,
  isSubmitting,
  language,
  t,
  onSubmit,
  vehicleType,
  setVehicleType,
  brand,
  setBrand,
  model,
  setModel,
  year,
  setYear,
  fuel,
  setFuel,
  bodyType,
  setBodyType,
  selectedServiceItems,
  setSelectedServiceItems,
  searchCity,
  setSearchCity,
  searchVin,
  setSearchVin,
  searchFieldErrors,
  setSearchFieldErrors,
  clearSearchFieldError,
  brandsForVehicleType,
  modelsForBrand,
  fuelsForVehicleType,
  years,
  serviceCatalogForVehicleType,
  getFinalServiceAvailabilityFromFavorite,
  translatedFuelLabel,
  translatedServiceLabel,
  currentFieldClassName,
  searchFormControlMobileStrip,
  searchFormAutocompleteShell,
  searchFormChevronToggleHide,
  favoriteServiceBlocked,
  setSelectedFavoriteWorkshopId,
  onClearFilters,
  showManualVehicle,
  setShowManualVehicle,
  setSelectedSavedCarId,
  manualType,
  setManualType,
  manualBrand,
  setManualBrand,
  manualModel,
  setManualModel,
  manualYear,
  setManualYear,
  manualDescription,
  setManualDescription,
  maxManualYear,
  onWizardStepChange,
}: SearchWizardProps) {
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [wizardStepError, setWizardStepError] = useState("");

  useEffect(() => {
    onWizardStepChange?.(wizardStep);
  }, [onWizardStepChange, wizardStep]);

  const vehicleSummary =
    brand && model && year && fuel ? `${brand} ${model} ${year} · ${fuel}` : "";

  const validateVehicleStep = useCallback(() => {
    const errs: Partial<Record<SearchFieldKey, string>> = {};
    if (!vehicleType) errs.vehicleType = "Wybierz typ auta.";
    if (!brand.trim()) errs.brand = "Wybierz markę.";
    if (!model.trim()) errs.model = "Wybierz model.";
    if (!year.trim()) errs.year = "Wybierz rocznik.";
    if (!fuel.trim()) errs.fuel = "Wybierz paliwo.";
    if (Object.keys(errs).length > 0) {
      setSearchFieldErrors((prev) => ({ ...prev, ...errs }));
      setWizardStepError("Uzupełnij wszystkie pola auta, żeby przejść dalej.");
      return false;
    }
    setWizardStepError("");
    return true;
  }, [vehicleType, brand, model, year, fuel, setSearchFieldErrors]);

  const goToStep2 = () => {
    if (validateVehicleStep()) setWizardStep(2);
  };

  const goToStep1 = () => {
    setWizardStep(1);
    setWizardStepError("");
  };

  const handleClearFilters = () => {
    setWizardStep(1);
    setWizardStepError("");
    onClearFilters();
  };

  const mobileStep1Hidden = wizardStep !== 1;
  const mobileStep2Hidden = wizardStep !== 2;

  const availableBodyTypes = ((): BodyTypeKey[] => {
    if (!brand || !model) return [];
    const val = getBodyTypeForModel(brand, model);
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return [val];
  })();

  const showBodyTypePicker = availableBodyTypes.length > 1;

  const secondaryButtonClass = `inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-[1.01] max-md:h-11 md:h-12 md:px-6 md:py-3 md:text-base ${
    isDark
      ? "border-zinc-600 bg-zinc-900/70 text-zinc-100 hover:border-blue-400/60"
      : "border-blue-200 bg-white text-zinc-800 hover:border-blue-500"
  }`;

  const vehicleFields = (
    <>
      <MobileCompactSearchField
        label={t("form.labels.vehicleType")}
        isDark={isDark}
        icon={searchFormFieldIconMap.vehicleType}
        error={
          searchFieldErrors.vehicleType ? (
            <p className={searchFieldErrorHintClass}>{searchFieldErrors.vehicleType}</p>
          ) : null
        }
      >
        <AutocompleteSelect
          value={vehicleType}
          onChange={(nextValue) => {
            clearSearchFieldError("vehicleType");
            const selectedType = nextValue as VehicleTypeKey | "";
            setVehicleType(selectedType);
            setBrand("");
            setModel("");
            setYear("");
            setSelectedServiceItems([]);
            setFuel("");
          }}
          options={vehicleTypeOptions.map((type) => ({
            value: type.key,
            label: t(`form.vehicleTypes.${type.key}`),
          }))}
          placeholder={t("form.selects.vehicleType")}
          required
          noResultsText={t("account.placeholders.noResults")}
          rootClassName={searchFormAutocompleteShell}
          toggleButtonClassName={searchFormChevronToggleHide}
          inputClassName={`${currentFieldClassName}${searchFieldErrors.vehicleType ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
          isDark={isDark}
        />
        <input type="hidden" name="vehicleType" value={vehicleType} />
      </MobileCompactSearchField>

      <MobileCompactSearchField
        label={t("form.labels.brand")}
        isDark={isDark}
        icon={searchFormFieldIconMap.brand}
        error={
          searchFieldErrors.brand ? (
            <p className={searchFieldErrorHintClass}>{searchFieldErrors.brand}</p>
          ) : null
        }
      >
        <AutocompleteSelect
          name="brand"
          value={brand}
          onChange={(nextBrand) => {
            clearSearchFieldError("brand");
            setBrand(nextBrand);
            setModel("");
            setBodyType("");
          }}
          options={brandsForVehicleType}
          placeholder={vehicleType ? t("form.selects.brand") : t("form.selects.chooseTypeFirst")}
          disabled={!vehicleType}
          required
          noResultsText={t("account.placeholders.noResults")}
          rootClassName={searchFormAutocompleteShell}
          toggleButtonClassName={searchFormChevronToggleHide}
          inputClassName={`${currentFieldClassName}${searchFieldErrors.brand ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
          isDark={isDark}
        />
      </MobileCompactSearchField>

      <MobileCompactSearchField
        label={t("form.labels.model")}
        isDark={isDark}
        icon={searchFormFieldIconMap.model}
        error={
          searchFieldErrors.model ? (
            <p className={searchFieldErrorHintClass}>{searchFieldErrors.model}</p>
          ) : null
        }
      >
        <AutocompleteSelect
          name="model"
          value={model}
          onChange={(val) => {
            clearSearchFieldError("model");
            setModel(val);
            setBodyType("");
          }}
          options={modelsForBrand}
          placeholder={brand ? t("form.selects.model") : t("form.selects.chooseBrandFirst")}
          disabled={!brand}
          required
          noResultsText={t("account.placeholders.noResults")}
          rootClassName={searchFormAutocompleteShell}
          toggleButtonClassName={searchFormChevronToggleHide}
          inputClassName={`${currentFieldClassName}${searchFieldErrors.model ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
          isDark={isDark}
        />
      </MobileCompactSearchField>

      <MobileCompactSearchField
        label={t("form.labels.year")}
        isDark={isDark}
        icon={searchFormFieldIconMap.year}
        error={
          searchFieldErrors.year ? (
            <p className={searchFieldErrorHintClass}>{searchFieldErrors.year}</p>
          ) : null
        }
      >
        <AutocompleteSelect
          name="year"
          value={year}
          onChange={(nextYear) => {
            clearSearchFieldError("year");
            setYear(nextYear);
          }}
          options={years}
          placeholder={t("form.selects.year")}
          required
          noResultsText={t("account.placeholders.noResults")}
          rootClassName={searchFormAutocompleteShell}
          toggleButtonClassName={searchFormChevronToggleHide}
          inputClassName={`${currentFieldClassName}${searchFieldErrors.year ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
          isDark={isDark}
        />
      </MobileCompactSearchField>

      {showBodyTypePicker && (
        <div className={searchFormAutocompleteShell}>
          <label
            htmlFor="bodyType"
            className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
          >
            Wersja nadwozia
          </label>
          <div className="flex flex-wrap gap-2">
            {availableBodyTypes.map((bt) => (
              <button
                key={bt}
                type="button"
                onClick={() => setBodyType(bodyType === bt ? "" : bt)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  bodyType === bt
                    ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-blue-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {BODY_TYPE_LABELS[bt]}
              </button>
            ))}
          </div>
          {showBodyTypePicker && !bodyType && (
            <p className="mt-1 text-xs text-zinc-400">
              Wybierz wersję aby zobaczyć dokładną cenę
            </p>
          )}
        </div>
      )}

      <MobileCompactSearchField
        label={translatedFuelLabel}
        isDark={isDark}
        icon={searchFormFieldIconMap.fuel}
        error={
          searchFieldErrors.fuel ? (
            <p className={searchFieldErrorHintClass}>{searchFieldErrors.fuel}</p>
          ) : null
        }
      >
        <AutocompleteSelect
          name="fuel"
          value={fuel}
          onChange={(nextFuel) => {
            clearSearchFieldError("fuel");
            setFuel(nextFuel);
          }}
          options={fuelsForVehicleType}
          placeholder={vehicleType ? t("form.selects.fuel") : t("form.selects.chooseTypeFirst")}
          disabled={!vehicleType}
          required
          noResultsText={t("account.placeholders.noResults")}
          rootClassName={searchFormAutocompleteShell}
          toggleButtonClassName={searchFormChevronToggleHide}
          inputClassName={`${currentFieldClassName}${searchFieldErrors.fuel ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
          isDark={isDark}
        />
      </MobileCompactSearchField>
    </>
  );

  const serviceFields = (
    <>
      <MobileCompactSearchField
        label={translatedServiceLabel}
        isDark={isDark}
        icon={searchFormFieldIconMap.service}
        error={
          searchFieldErrors.service ? (
            <p className={searchFieldErrorHintClass}>{searchFieldErrors.service}</p>
          ) : null
        }
      >
        <p className={`mb-2 text-xs leading-snug ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
          {language === "pl"
            ? "Możesz wybrać usługę z listy albo zacząć pisać, aby szybciej ją znaleźć."
            : "Pick a service from the list or start typing to find it faster."}
        </p>
        <ServiceCategoryPicker
          value=""
          onChange={(next) => {
            if (next === "") setSelectedServiceItems([]);
          }}
          multiSelect
          selectedItems={selectedServiceItems}
          onToggleItem={(item) => {
            clearSearchFieldError("service");
            setSelectedServiceItems((prev) => toggleSelectedServiceItem(item, prev));
          }}
          categories={serviceCatalogForVehicleType}
          disabled={serviceCatalogForVehicleType.length === 0}
          isDark={isDark}
          toggleButtonClassName={searchFormChevronToggleHide}
          inputClassName={`${currentFieldClassName}${searchFieldErrors.service ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
          placeholder="Wybierz z listy albo wpisz fragment nazwy…"
          noResultsText="Nie znaleziono usługi w katalogu."
          getFinalServiceAvailability={getFinalServiceAvailabilityFromFavorite}
        />
        <input type="hidden" name="service" value={selectedItemsToSummary(selectedServiceItems)} />
        {selectedServiceItems.length > 0 ? (
          <div
            className={`mt-3 rounded-xl border px-3 py-2.5 ${
              isDark
                ? "border-zinc-600 bg-zinc-950/90 text-zinc-50"
                : "border-slate-300/90 bg-white text-zinc-950 shadow-sm shadow-slate-200/40"
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className={`text-sm font-semibold ${isDark ? "text-zinc-50" : "text-zinc-950"}`}>
                Wybrane usługi
                <span className={`ml-2 font-normal ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  ({selectedServiceItems.length})
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedServiceItems([]);
                  clearSearchFieldError("service");
                }}
                className={`shrink-0 text-xs font-semibold underline ${isDark ? "text-blue-300" : "text-blue-800"}`}
              >
                Wyczyść wybór
              </button>
            </div>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto [-webkit-overflow-scrolling:touch]">
              {selectedServiceItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-sm ${
                    isDark ? "bg-zinc-900/90 ring-1 ring-zinc-700/80" : "bg-slate-100 ring-1 ring-slate-200/90"
                  }`}
                >
                  <span className={`min-w-0 flex-1 break-words ${isDark ? "text-zinc-50" : "text-zinc-950"}`}>
                    <span className={`font-semibold ${isDark ? "text-zinc-50" : "text-zinc-950"}`}>{item.name}</span>
                    {item.source === "custom" ? (
                      <span
                        className={`ml-2 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          isDark ? "border-zinc-500 text-zinc-300" : "border-zinc-400 text-zinc-700"
                        }`}
                      >
                        Własny opis
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedServiceItems((prev) => prev.filter((x) => x.id !== item.id))}
                    className={`shrink-0 text-xs font-semibold underline decoration-orange-700/50 underline-offset-2 hover:decoration-orange-800 ${
                      isDark ? "text-orange-300" : "text-orange-800"
                    }`}
                  >
                    Usuń
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {favoriteServiceBlocked ? (
          <div
            className={`mt-2 space-y-2 rounded-xl border px-3 py-2 text-sm ${
              isDark
                ? "border-red-500/40 bg-red-950/30 text-red-200"
                : "border-red-300/50 bg-red-500/5 text-red-700"
            }`}
          >
            <p>
              Co najmniej jedna wybrana usługa nie jest dostępna w wybranym warsztacie. Zmień wybór albo usuń filtr
              ulubionego warsztatu.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedFavoriteWorkshopId(null);
                clearSearchFieldError("service");
              }}
              className="font-semibold underline decoration-red-600/60 hover:no-underline"
            >
              Szukaj we wszystkich warsztatach
            </button>
          </div>
        ) : null}
      </MobileCompactSearchField>

      <MobileCompactSearchField
        label={t("form.labels.problem")}
        isDark={isDark}
        icon={searchFormFieldIconMap.problem}
        variant="block"
      >
        <textarea
          name="problem"
          rows={3}
          placeholder={t("form.placeholders.problem")}
          className={`${currentFieldClassName} min-h-[100px] w-full max-md:min-h-[104px] max-md:px-2 max-md:py-2 max-md:text-base md:min-h-[120px]`}
        />
      </MobileCompactSearchField>

      <div className="grid grid-cols-1 gap-2 max-md:gap-3 md:col-span-2 md:grid-cols-2 md:gap-4 xl:col-span-3">
        <MobileCompactSearchField
          label={t("form.labels.city")}
          isDark={isDark}
          icon={searchFormFieldIconMap.city}
          error={
            searchFieldErrors.city ? (
              <p className={searchFieldErrorHintClass}>{searchFieldErrors.city}</p>
            ) : null
          }
        >
          <input
            type="text"
            name="city"
            value={searchCity}
            onChange={(event) => {
              clearSearchFieldError("city");
              setSearchCity(event.target.value);
            }}
            placeholder={t("form.placeholders.city")}
            className={`${currentFieldClassName}${searchFieldErrors.city ? ` ${searchFieldErrorRingClass}` : ""} ${searchFormControlMobileStrip}`}
          />
        </MobileCompactSearchField>
        <MobileCompactSearchField label={t("form.labels.vin")} isDark={isDark} icon={searchFormFieldIconMap.vin}>
          <input
            type="text"
            name="vin"
            maxLength={17}
            value={searchVin}
            onChange={(event) => setSearchVin(event.target.value.toUpperCase().slice(0, 17))}
            placeholder={t("account.placeholders.vin")}
            className={`${currentFieldClassName} ${searchFormControlMobileStrip}`}
          />
          <VinOptionalHint text={t("account.vehicle.vinHint")} isDark={isDark} />
          {SHOW_MANUAL_MISSING_VEHICLE_UI ? (
            <div className="mt-1 flex items-center gap-2 max-md:mt-1 md:mt-1">
              <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>lub</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedSavedCarId("");
                  setShowManualVehicle((prev) => !prev);
                  setVehicleType("");
                  setBrand("");
                  setModel("");
                  setYear("");
                  setFuel("");
                  setSelectedServiceItems([]);
                  setSearchCity("");
                  setSearchVin("");
                }}
                className={`text-xs font-semibold ${isDark ? "text-blue-300 hover:text-orange-300" : "text-blue-700 hover:text-orange-600"}`}
              >
                {t("form.manual.toggleShow")}
              </button>
            </div>
          ) : null}
        </MobileCompactSearchField>
      </div>
    </>
  );

  const submitLabel =
    isSubmitting
      ? t("form.buttons.submitting")
      : language === "pl"
        ? selectedServiceItems.length > 1
          ? `Znajdź oferty (${selectedServiceItems.length} usług)`
          : "Znajdź oferty"
        : t("form.buttons.submit");

  return (
    <>
      <div className={`mt-4 flex flex-wrap gap-2 max-md:mt-2 max-md:gap-1.5 ${mobileStep1Hidden ? "max-md:hidden" : ""} md:flex`}>
        {vehicleTypeOptions.map((type) => {
          const active = vehicleType === type.key;
          return (
            <button
              key={type.key}
              type="button"
              onClick={() => {
                clearSearchFieldError("vehicleType");
                setVehicleType(type.key);
                setBrand("");
                setModel("");
                setYear("");
                setFuel("");
                setSelectedServiceItems([]);
              }}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition max-md:px-2.5 max-md:py-1.5 max-md:text-xs ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : isDark
                    ? "border-zinc-700 bg-zinc-900/70 text-zinc-200 hover:border-blue-400/60"
                    : "border-blue-200 bg-white text-zinc-700 hover:border-blue-400"
              }`}
            >
              {t(`form.vehicleTypes.${type.key}`)}
            </button>
          );
        })}
      </div>

      <form
        id="servygo-search"
        onSubmit={onSubmit}
        className="mt-6 grid grid-cols-1 gap-2 max-md:mt-4 max-md:gap-3 max-md:pb-28 md:gap-4 md:grid-cols-2 md:pb-0 xl:grid-cols-3"
      >
        <WizardProgress step={wizardStep} isDark={isDark} />

        {wizardStep === 1 ? (
          <MobileStepHeader
            title="Twoje auto"
            description="Wybierz dane pojazdu, żebyśmy mogli dopasować oferty."
            isDark={isDark}
          />
        ) : (
          <MobileStepHeader
            title="Czego szukasz?"
            description="Wybierz usługę i miasto, a my pokażemy pasujące warsztaty."
            isDark={isDark}
          />
        )}

        {wizardStep === 2 && vehicleSummary ? (
          <div
            className={`mb-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 md:hidden ${
              isDark ? "border-zinc-600/80 bg-zinc-900/80" : "border-blue-200/90 bg-white shadow-sm shadow-blue-100/50"
            }`}
          >
            <p className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{vehicleSummary}</p>
            <button
              type="button"
              onClick={goToStep1}
              className={`shrink-0 text-sm font-semibold underline underline-offset-2 ${
                isDark ? "text-blue-300 hover:text-orange-300" : "text-blue-700 hover:text-orange-600"
              }`}
            >
              Zmień
            </button>
          </div>
        ) : null}

        {wizardStepError && wizardStep === 1 ? (
          <p
            className={`rounded-xl border px-3 py-2 text-sm font-medium md:hidden ${
              isDark ? "border-orange-400/40 bg-orange-500/10 text-orange-200" : "border-orange-300 bg-orange-50 text-orange-700"
            }`}
            role="alert"
          >
            {wizardStepError}
          </p>
        ) : null}

        <div className={`contents ${mobileStep1Hidden ? "max-md:hidden" : ""}`}>{vehicleFields}</div>

        <div className={`contents ${mobileStep2Hidden ? "max-md:hidden" : ""}`}>{serviceFields}</div>

        <div
          className={`mt-1 grid grid-cols-1 gap-2 md:static md:col-span-2 md:grid md:grid-cols-2 md:gap-3 md:border-0 md:px-0 md:pb-0 md:pt-0 xl:col-span-3 ${
            isSubmitting
              ? "max-md:hidden"
              : "z-[1002] max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:mx-auto max-md:mt-0 max-md:w-full max-md:gap-2.5 max-md:border-t max-md:px-4 max-md:pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] max-md:pt-3 max-md:backdrop-blur-xl"
          } ${
            isDark
              ? "max-md:border-zinc-700/80 max-md:bg-zinc-950/95"
              : "max-md:border-blue-200/90 max-md:bg-white/95"
          }`}
        >
          {wizardStep === 1 ? (
            <button
              type="button"
              onClick={goToStep2}
              className={`max-md:col-span-1 md:hidden ${submitButtonClass}`}
            >
              Dalej — wybierz usługę
            </button>
          ) : null}

          {wizardStep === 2 ? (
            <div className="flex w-full flex-col gap-2 md:hidden">
              <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
                {submitLabel}
              </button>
              <button type="button" onClick={goToStep1} className={secondaryButtonClass}>
                Wróć
              </button>
            </div>
          ) : null}

          <div className={`contents max-md:hidden md:contents ${wizardStep === 1 ? "md:contents" : "md:contents"}`}>
            <button type="button" onClick={handleClearFilters} className={secondaryButtonClass}>
              Wyczyść filtry
            </button>
            <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
              {isSubmitting
                ? t("form.buttons.submitting")
                : language === "pl"
                  ? selectedServiceItems.length > 1
                    ? `Szukaj ofert (${selectedServiceItems.length} usług)`
                    : "Szukaj ofert"
                  : t("form.buttons.submit")}
            </button>
          </div>
        </div>

        {SHOW_MANUAL_MISSING_VEHICLE_UI && showManualVehicle ? (
          <div
            className={`md:col-span-2 rounded-2xl border p-4 sm:p-5 max-md:hidden ${
              isDark ? "border-zinc-700/70 bg-zinc-900/70" : "border-blue-200/80 bg-white/70"
            }`}
          >
            <h3 className="text-lg font-semibold">{t("form.manual.title")}</h3>
            <p className={`mt-2 text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{t("form.manual.subtitle")}</p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("form.manual.labels.type")}</span>
                <input
                  type="text"
                  name="manualType"
                  value={manualType}
                  onChange={(event) => setManualType(event.target.value)}
                  placeholder={t("form.manual.placeholders.type")}
                  className={currentFieldClassName}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("form.manual.labels.brand")}</span>
                <input
                  type="text"
                  name="manualBrand"
                  value={manualBrand}
                  onChange={(event) => setManualBrand(event.target.value)}
                  placeholder={t("form.manual.placeholders.brand")}
                  className={currentFieldClassName}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("form.manual.labels.model")}</span>
                <input
                  type="text"
                  name="manualModel"
                  value={manualModel}
                  onChange={(event) => setManualModel(event.target.value)}
                  placeholder={t("form.manual.placeholders.model")}
                  className={currentFieldClassName}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("form.manual.labels.year")}</span>
                <input
                  type="number"
                  name="manualYear"
                  min="1900"
                  max={maxManualYear}
                  value={manualYear}
                  onChange={(event) => setManualYear(event.target.value)}
                  placeholder={t("form.manual.placeholders.year")}
                  className={currentFieldClassName}
                />
              </label>
              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="text-sm font-medium">{t("form.manual.labels.description")}</span>
                <textarea
                  name="manualDescription"
                  rows={3}
                  value={manualDescription}
                  onChange={(event) => setManualDescription(event.target.value)}
                  placeholder={t("form.manual.placeholders.description")}
                  className={currentFieldClassName}
                />
              </label>
            </div>
          </div>
        ) : null}
      </form>
    </>
  );
}
