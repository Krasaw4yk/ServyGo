"use client";

import {
  memo,
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
} from "react";
import ServiceCategoryPicker from "@/components/ServiceCategoryPicker";
import {
  getServiceCatalogByVehicleType,
  isWorkshopServiceCategoryOption,
  resolveWorkshopServiceCategory,
  workshopServiceCategorySortIndex,
  WORKSHOP_SERVICE_CATEGORY_OPTIONS,
} from "@/lib/serviceCatalog";
import { classifyServiceCategory, slugifyServiceKey } from "@/lib/serviceCategoryClassifier";
import { vehicleTypeOptions, type VehicleTypeKey } from "@/lib/vehicleData";

const DEV = process.env.NODE_ENV === "development";
const SERVICE_TABLE_PAGE_SIZE = 40;

export type WorkshopServiceDraftRow = {
  id?: string;
  service_key: string | null;
  service_name: string;
  category: string;
  category_manual: boolean;
  description: string;
  price_from: string;
  price_to: string;
  duration_minutes: string;
  is_active: boolean;
  is_custom: boolean;
};

function stableServiceDraftKey(row: Pick<WorkshopServiceDraftRow, "service_key" | "service_name">) {
  const sk = row.service_key?.trim();
  return sk ? sk : slugifyServiceKey(row.service_name);
}

export type WorkshopServicesPricingSectionProps = {
  isDark: boolean;
  readOnly: boolean;
  savingServices: boolean;
  mergedServiceRows: WorkshopServiceDraftRow[];
  vehiclePriceCountByService: ReadonlyMap<string, number>;
  onPatchService: (target: WorkshopServiceDraftRow, patch: Partial<WorkshopServiceDraftRow>) => void;
  onDeleteService: (row: WorkshopServiceDraftRow) => void | Promise<void>;
  onSaveServices: () => void | Promise<void>;
  onOpenVehiclePricing: (serviceName: string) => void;
  onRequestAddCustomService: () => void;
};

function WorkshopServicesPricingSectionImpl({
  isDark,
  readOnly,
  savingServices,
  mergedServiceRows,
  vehiclePriceCountByService,
  onPatchService,
  onDeleteService,
  onSaveServices,
  onOpenVehiclePricing,
  onRequestAddCustomService,
}: WorkshopServicesPricingSectionProps) {
  const [workshopCatalogVehicleType, setWorkshopCatalogVehicleType] = useState<VehicleTypeKey>("car");
  const [catalogServicePickerValue, setCatalogServicePickerValue] = useState("");
  const [servicesCategoryFilter, setServicesCategoryFilter] = useState("Wszystkie");
  const [servicesActivityFilter, setServicesActivityFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryEditRowKey, setCategoryEditRowKey] = useState<string | null>(null);
  const [serviceRowDisplayLimit, setServiceRowDisplayLimit] = useState(SERVICE_TABLE_PAGE_SIZE);
  const [isFilterTransitionPending, startFilterTransition] = useTransition();


  const deferredCategory = useDeferredValue(servicesCategoryFilter);
  const deferredActivity = useDeferredValue(servicesActivityFilter);

  const workshopPickerCategories = useMemo(
    () => getServiceCatalogByVehicleType(workshopCatalogVehicleType),
    [workshopCatalogVehicleType],
  );

  const serviceCategories = useMemo(() => {
    const values = Array.from(
      new Set(
        mergedServiceRows.map((r) => resolveWorkshopServiceCategory(r.service_name, r.category, r.category_manual)),
      ),
    );
    const sorted = [...values].sort((a, b) => {
      const ai = workshopServiceCategorySortIndex(a);
      const bi = workshopServiceCategorySortIndex(b);
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b, "pl", { sensitivity: "base" });
    });
    return ["Wszystkie", ...sorted];
  }, [mergedServiceRows]);

  const visibleServiceRows = useMemo(() => {
    if (DEV) console.time("[perf] visibleServiceRows");
    try {
      return mergedServiceRows
        .filter((r) => {
          const logicalCategory = resolveWorkshopServiceCategory(r.service_name, r.category, r.category_manual);
          const categoryOk = deferredCategory === "Wszystkie" || logicalCategory === deferredCategory;
          const activityOk =
            deferredActivity === "all"
              ? true
              : deferredActivity === "active"
                ? r.is_active
                : !r.is_active;
          return categoryOk && activityOk;
        })
        .sort((a, b) => a.service_name.localeCompare(b.service_name, "pl", { sensitivity: "base" }));
    } finally {
      if (DEV) console.timeEnd("[perf] visibleServiceRows");
    }
  }, [mergedServiceRows, deferredCategory, deferredActivity]);

  const pagedServiceRows = useMemo(
    () => visibleServiceRows.slice(0, serviceRowDisplayLimit),
    [visibleServiceRows, serviceRowDisplayLimit],
  );

  const handleCatalogPick = (next: string) => {
    setCatalogServicePickerValue(next);
    const trimmed = next.trim();
    if (!trimmed) return;
    startFilterTransition(() => {
      setServicesCategoryFilter("Wszystkie");
      setServicesActivityFilter("all");
    });
    const id = `workshop-svc-${slugifyServiceKey(trimmed)}`;
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
  };

  const selectClassName = `mt-1 w-full min-w-[12rem] max-w-[min(100%,32rem)] rounded-lg border px-2 py-1 text-xs ${
    isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100" : "border-zinc-300 bg-white text-zinc-900"
  }`;

  return (
    <section className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/70" : "border-blue-200 bg-white/85"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Usługi i ceny</h2>
          <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            Lista usług jest wspólna z formularzem wyszukiwania ServyGo.
          </p>
        </div>
        <button
          type="button"
          disabled={readOnly}
          onClick={onRequestAddCustomService}
          className="mb-3 w-full rounded-xl bg-gradient-to-r from-blue-600 to-orange-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50 md:mb-0 md:w-auto md:px-4 md:py-2 md:from-blue-600 md:via-blue-500 md:to-orange-500"
        >
          Dodaj własną usługę
        </button>
      </div>
      <div className={`mt-4 rounded-2xl border p-4 ${isDark ? "border-zinc-600 bg-zinc-950/40" : "border-zinc-200 bg-zinc-50/80"}`}>
        <p className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Wybór usługi z katalogu</p>
        <p className={`mt-1 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
          Typ pojazdu, potem kategoria → podkategoria → konkretna usługa (jak na stronie głównej). Następnie ustaw cenę od–do w tabeli lub w „Ceny dla aut”.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {vehicleTypeOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              disabled={readOnly}
              onClick={() => {
                setWorkshopCatalogVehicleType(opt.key);
                setCatalogServicePickerValue("");
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                workshopCatalogVehicleType === opt.key
                  ? isDark
                    ? "border-blue-400 bg-blue-500/20 text-blue-200"
                    : "border-blue-500 bg-blue-50 text-blue-800"
                  : isDark
                    ? "border-zinc-600 text-zinc-300"
                    : "border-zinc-300 text-zinc-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative mt-3 max-w-xl">
          <ServiceCategoryPicker
            value={catalogServicePickerValue}
            onChange={handleCatalogPick}
            categories={workshopPickerCategories}
            disabled={readOnly || workshopPickerCategories.length === 0}
            isDark={isDark}
            hideManualServiceEntry
            inputClassName={`w-full rounded-xl border px-3 py-2 text-sm ${
              isDark ? "border-zinc-600 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500" : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-500"
            }`}
            placeholder="Kategoria → podkategoria → usługa"
            noResultsText="Brak wyników"
            rootClassName="w-full"
          />
        </div>
      </div>
      <div className={`mt-4 flex flex-wrap gap-2 ${isFilterTransitionPending ? "opacity-70" : ""}`}>
        {serviceCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() =>
              startFilterTransition(() => {
                setServicesCategoryFilter(cat);
                setServiceRowDisplayLimit(SERVICE_TABLE_PAGE_SIZE);
              })
            }
            className={`rounded-full border px-3 py-1 text-xs ${servicesCategoryFilter === cat ? "border-blue-500" : ""}`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(
          [
            { key: "all", label: "Wszystkie" },
            { key: "active", label: "Aktywne" },
            { key: "inactive", label: "Nieaktywne" },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() =>
              startFilterTransition(() => {
                setServicesActivityFilter(f.key);
                setServiceRowDisplayLimit(SERVICE_TABLE_PAGE_SIZE);
              })
            }
            className={`rounded-full border px-3 py-1 text-xs ${servicesActivityFilter === f.key ? "border-orange-500" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2 md:hidden">
        {pagedServiceRows.map((row) => {
          const effectiveCategory = resolveWorkshopServiceCategory(row.service_name, row.category, row.category_manual);
          const vehicleCount = vehiclePriceCountByService.get(row.service_name.trim().toLowerCase()) ?? 0;
          return (
            <div
              key={row.id ?? row.service_key ?? row.service_name}
              id={`workshop-svc-mobile-${stableServiceDraftKey(row)}`}
              className={`mb-2 rounded-xl border p-3 ${isDark ? "border-zinc-700/80 bg-zinc-900" : "border-zinc-200 bg-white shadow-sm"}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{row.service_name}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">{effectiveCategory || "—"}</div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    row.is_active
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
                  }`}
                >
                  {row.is_active ? "Aktywna" : "Nieaktywna"}
                </span>
              </div>
              <div className="mb-2 flex gap-4 text-[11px] text-zinc-500 dark:text-zinc-400">
                {(row.price_from || row.price_to) && (
                  <span>
                    💰 {row.price_from || "—"}
                    {row.price_to ? ` – ${row.price_to} zł` : " zł"}
                  </span>
                )}
                {row.duration_minutes ? <span>⏱ {row.duration_minutes} min</span> : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onOpenVehiclePricing(row.service_name)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                >
                  Ceny ({vehicleCount})
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => onPatchService(row, { is_active: !row.is_active })}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
                >
                  {row.is_active ? "Deaktywuj" : "Aktywuj"}
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => void onDeleteService(row)}
                  className="flex-1 rounded-lg border border-rose-300 px-2 py-1.5 text-[11px] font-semibold text-rose-500 disabled:opacity-50"
                >
                  Usuń
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className={isDark ? "text-zinc-400" : "text-zinc-600"}>
            <tr>
              <th className="px-2 py-2 text-left">Usługa</th>
              <th className="min-w-[min(100%,18rem)] px-2 py-2 text-left">Kategoria</th>
              <th className="px-2 py-2 text-left">Oferuję</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Auta z cenami</th>
              <th className="px-2 py-2 text-left">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {pagedServiceRows.map((row) => {
              const inferred = classifyServiceCategory(row.service_name);
              const effectiveCategory = resolveWorkshopServiceCategory(row.service_name, row.category, row.category_manual);
              const autoResolvedCategory = resolveWorkshopServiceCategory(row.service_name, row.category, false);
              const tagNote = inferred.tags.length > 0 ? `Powiązane tagi: ${inferred.tags.join(", ")}` : null;
              const rowStableKey = stableServiceDraftKey(row);
              const editingCategory = categoryEditRowKey === rowStableKey;
              return (
                <tr
                  id={`workshop-svc-${rowStableKey}`}
                  key={row.id ?? row.service_key ?? row.service_name}
                  className={`border-t ${isDark ? "border-zinc-800" : "border-zinc-100"}`}
                >
                  <td className="px-2 py-2">
                    <p className="font-medium">{row.service_name}</p>
                  </td>
                  <td className="px-2 py-2 align-top">
                    {editingCategory ? (
                      <div className="space-y-2">
                        <select
                          disabled={readOnly}
                          value={
                            isWorkshopServiceCategoryOption(effectiveCategory)
                              ? effectiveCategory
                              : effectiveCategory || "Inne"
                          }
                          onChange={(e) => {
                            onPatchService(row, { category: e.target.value, category_manual: true });
                            setCategoryEditRowKey(null);
                          }}
                          className={selectClassName}
                        >
                          {!isWorkshopServiceCategoryOption(effectiveCategory) && effectiveCategory ? (
                            <option value={effectiveCategory}>{effectiveCategory} (niestandardowa)</option>
                          ) : null}
                          {WORKSHOP_SERVICE_CATEGORY_OPTIONS.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={`text-xs font-semibold underline-offset-2 hover:underline ${isDark ? "text-zinc-300" : "text-zinc-600"}`}
                          onClick={() => setCategoryEditRowKey(null)}
                        >
                          Zamknij
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">{effectiveCategory || "—"}</p>
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => setCategoryEditRowKey(rowStableKey)}
                          className="mt-1 text-xs font-semibold text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                        >
                          Edytuj kategorię
                        </button>
                      </div>
                    )}
                    <p className={`mt-1 text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                      {row.category_manual ? (
                        <>
                          Wybrano ręcznie
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() =>
                              onPatchService(row, {
                                category_manual: false,
                                category: autoResolvedCategory,
                              })
                            }
                            className="ml-2 font-semibold text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                          >
                            Przywróć auto
                          </button>
                        </>
                      ) : (
                        <>
                          Auto: przy zapisie = <span className="font-medium">{autoResolvedCategory}</span>
                        </>
                      )}
                    </p>
                    {tagNote ? <p className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-500"}`}>{tagNote}</p> : null}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.is_active}
                      disabled={readOnly}
                      onClick={() => onPatchService(row, { is_active: !row.is_active })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${row.is_active ? "bg-blue-600" : "bg-zinc-400"} disabled:opacity-50`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${row.is_active ? "translate-x-5" : "translate-x-1"}`}
                      />
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        row.is_active
                          ? isDark
                            ? "bg-blue-500/20 text-blue-200"
                            : "bg-blue-100 text-blue-700"
                          : isDark
                            ? "bg-zinc-800 text-zinc-300"
                            : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {row.is_active ? "Aktywna" : "Nieaktywna"}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                        isDark ? "bg-zinc-800 text-zinc-200" : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      🚗 {vehiclePriceCountByService.get(row.service_name.trim().toLowerCase()) ?? 0}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (DEV) console.time("[perf] vehicle pricing modal open");
                          onOpenVehiclePricing(row.service_name);
                          requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                              if (DEV) console.timeEnd("[perf] vehicle pricing modal open");
                            });
                          });
                        }}
                        className="rounded-lg border px-2 py-1 text-xs font-semibold"
                      >
                        Ceny dla aut ({vehiclePriceCountByService.get(row.service_name.trim().toLowerCase()) ?? 0})
                      </button>
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => void onDeleteService(row)}
                        className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-500 disabled:opacity-50"
                      >
                        Usuń
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visibleServiceRows.length > pagedServiceRows.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${isDark ? "border-zinc-600" : "border-zinc-300"}`}
            onClick={() => setServiceRowDisplayLimit((n) => n + SERVICE_TABLE_PAGE_SIZE)}
          >
            Pokaż więcej ({visibleServiceRows.length - pagedServiceRows.length} pozostałych)
          </button>
        </div>
      ) : null}
      {visibleServiceRows.length > SERVICE_TABLE_PAGE_SIZE ? (
        <p className={`mt-2 text-xs ${isDark ? "text-zinc-500" : "text-zinc-600"}`}>
          Wyświetlane {pagedServiceRows.length} z {visibleServiceRows.length} usług (po filtrach).
        </p>
      ) : null}

      <button
        type="button"
        disabled={readOnly || savingServices}
        onClick={() => void onSaveServices()}
        className="mt-4 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {savingServices ? "Zapisywanie…" : "Zapisz usługi i ceny"}
      </button>

      <div className={`mt-6 rounded-2xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-900/40" : "border-blue-100 bg-blue-50/40"}`}>
        <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
          Kliknij <strong>Ceny dla aut (X)</strong>, aby otworzyć panel cen dla konkretnej usługi.
        </p>
      </div>
    </section>
  );
}

const WorkshopServicesPricingSection = memo(WorkshopServicesPricingSectionImpl);
WorkshopServicesPricingSection.displayName = "WorkshopServicesPricingSection";

export default WorkshopServicesPricingSection;
