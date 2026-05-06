"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ServiceCategory } from "@/lib/serviceCatalog";
import { normalizeServiceTextForMatch } from "@/lib/serviceCategoryClassifier";
import MobileBottomSheet from "@/components/MobileBottomSheet";

type FinalServiceAvailability = {
  available: boolean;
  priceHint?: string;
};

type ServiceCategoryPickerProps = {
  value: string;
  onChange: (value: string) => void;
  categories: ServiceCategory[];
  disabled?: boolean;
  isDark?: boolean;
  inputClassName?: string;
  placeholder?: string;
  noResultsText?: string;
  /** Gdy zwraca obiekt: `available: false` = usługa niedostępna w wybranym warsztacie (wyszarzenie, brak wyboru). */
  getFinalServiceAvailability?: (serviceName: string) => FinalServiceAvailability | null;
  /** Ukrywa „Inna usługa / wpisz ręcznie” na mobile (np. gdy własna usługa jest osobnym przyciskiem). */
  hideManualServiceEntry?: boolean;
  rootClassName?: string;
  toggleButtonClassName?: string;
};

type SearchResult = {
  type: "category" | "subcategory" | "service";
  label: string;
  categoryName: string;
  subcategoryName?: string;
  serviceName?: string;
};

type BrowseRow =
  | { kind: "back"; variant: "from-services" | "from-subcats" }
  | { kind: "category"; category: ServiceCategory }
  | { kind: "subcategory"; subcategoryName: string }
  | { kind: "service"; serviceName: string }
  | { kind: "search"; result: SearchResult };

type BrowseHighlightState = { sig: string; idx: number };

function normalizeSearchText(value: string) {
  return normalizeServiceTextForMatch(value);
}

function rankSearchMatch(label: string, query: string) {
  const normalizedLabel = normalizeSearchText(label);
  if (normalizedLabel === query) return 0;
  if (normalizedLabel.startsWith(query)) return 1;
  if (normalizedLabel.includes(query)) return 2;
  return Number.POSITIVE_INFINITY;
}

function sortByLabel<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "pl", { sensitivity: "base" }));
}

export default function ServiceCategoryPicker({
  value,
  onChange,
  categories,
  disabled = false,
  isDark = false,
  inputClassName = "",
  placeholder = "Wybierz kategorię",
  noResultsText = "Brak wyników",
  getFinalServiceAvailability,
  hideManualServiceEntry = false,
  rootClassName = "",
  toggleButtonClassName = "",
}: ServiceCategoryPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileCustomOpen, setMobileCustomOpen] = useState(false);
  const [customServiceDraft, setCustomServiceDraft] = useState("");
  const [browseHighlight, setBrowseHighlight] = useState<BrowseHighlightState>({ sig: "", idx: -1 });
  const prevSheetOpenRef = useRef(false);
  /** Zapobiega „ghost click” po zamknięciu MobileBottomSheet (klik wpada w pole pod spodem). */
  const suppressOpenUntilRef = useRef(0);

  function markSuppressTapThroughFromSheet() {
    if (!isMobile) return;
    suppressOpenUntilRef.current = Date.now() + 480;
  }

  function shouldIgnoreOpenTrigger() {
    return isMobile && Date.now() < suppressOpenUntilRef.current;
  }

  /** Document outside-click may fire in the same gesture as drilling into categories; reinforce stay-open while navigating */
  function keepPickerOpen() {
    queueMicrotask(() => setIsOpen(true));
  }

  function closePicker(blurInput = false) {
    markSuppressTapThroughFromSheet();
    setIsOpen(false);
    setQuery("");
    if (blurInput) {
      inputRef.current?.blur();
    }
  }

  function finalAvailability(name: string): FinalServiceAvailability | null {
    return getFinalServiceAvailability?.(name) ?? null;
  }

  function handleFinalServiceSelection(serviceName: string) {
    const av = finalAvailability(serviceName);
    if (av && !av.available) return;
    onChange(serviceName);
    closePicker(true);
  }

  function handleCategoryDrill(categoryName: string, subcategories: { name: string }[]) {
    setActiveCategory(categoryName);
    setActiveSubcategory(subcategories.length === 1 ? (subcategories[0]?.name ?? null) : null);
    keepPickerOpen();
  }

  function handleSubcategoryDrill(subcategoryName: string) {
    setActiveSubcategory(subcategoryName);
    keepPickerOpen();
  }

  const displayValue = isOpen ? query : value;
  const sortedCategories = useMemo(
    () =>
      sortByLabel(categories).map((category) => ({
        ...category,
        subcategories: sortByLabel(category.subcategories).map((subcategory) => ({
          ...subcategory,
          services: sortByLabel(subcategory.services),
        })),
      })),
    [categories],
  );

  useEffect(() => {
    function updateViewportMode() {
      setIsMobile(window.innerWidth < 640);
    }
    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    function handleOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) {
      prevSheetOpenRef.current = isOpen;
      return;
    }
    if (isOpen && !prevSheetOpenRef.current) {
      setActiveCategory(null);
      setActiveSubcategory(null);
      setMobileCustomOpen(false);
      setCustomServiceDraft("");
    }
    prevSheetOpenRef.current = isOpen;
  }, [isOpen, isMobile]);

  const selectedCategory = useMemo(
    () => sortedCategories.find((category) => category.name === activeCategory) ?? null,
    [activeCategory, sortedCategories],
  );
  const selectedSubcategory = useMemo(
    () =>
      selectedCategory?.subcategories.find((subcategory) => subcategory.name === activeSubcategory) ??
      null,
    [activeSubcategory, selectedCategory],
  );

  const hasSingleSubcategory = Boolean(selectedCategory && selectedCategory.subcategories.length === 1);

  const searchResults = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return [];

    const flattened: SearchResult[] = [];
    for (const category of sortedCategories) {
      flattened.push({
        type: "category",
        label: category.name,
        categoryName: category.name,
      });
      for (const subcategory of category.subcategories) {
        flattened.push({
          type: "subcategory",
          label: subcategory.name,
          categoryName: category.name,
          subcategoryName: subcategory.name,
        });
        for (const service of subcategory.services) {
          flattened.push({
            type: "service",
            label: service.name,
            categoryName: category.name,
            subcategoryName: subcategory.name,
            serviceName: service.name,
          });
        }
      }
    }

    return flattened
      .map((item) => ({ ...item, rank: rankSearchMatch(item.label, normalizedQuery) }))
      .filter((item) => Number.isFinite(item.rank))
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.label.localeCompare(b.label, "pl", { sensitivity: "base" });
      });
  }, [query, sortedCategories]);

  const normalizedBrowseQuery = useMemo(() => normalizeSearchText(query), [query]);
  const browseNavSig = useMemo(
    () => `${normalizedBrowseQuery}\u0000${activeCategory ?? ""}\u0000${activeSubcategory ?? ""}`,
    [normalizedBrowseQuery, activeCategory, activeSubcategory],
  );

  function applySearchResult(result: SearchResult) {
    if (result.type === "category") {
      const cat = sortedCategories.find((c) => c.name === result.categoryName);
      if (cat) {
        handleCategoryDrill(cat.name, cat.subcategories);
      } else {
        setActiveCategory(result.categoryName);
        setActiveSubcategory(null);
        keepPickerOpen();
      }
      setQuery("");
      return;
    }
    if (result.type === "subcategory") {
      setActiveCategory(result.categoryName);
      setActiveSubcategory(result.subcategoryName ?? null);
      setQuery("");
      keepPickerOpen();
      return;
    }
    const name = result.serviceName ?? "";
    const av = finalAvailability(name);
    if (av && !av.available) return;
    handleFinalServiceSelection(name);
  }

  const browseRows = useMemo((): BrowseRow[] => {
    if (normalizedBrowseQuery) {
      return searchResults.map((r) => ({ kind: "search" as const, result: r }));
    }
    if (selectedSubcategory) {
      const rows: BrowseRow[] = [
        { kind: "back", variant: "from-services" },
        ...selectedSubcategory.services.map((s) => ({ kind: "service" as const, serviceName: s.name })),
      ];
      return rows;
    }
    if (selectedCategory) {
      return [
        { kind: "back", variant: "from-subcats" },
        ...selectedCategory.subcategories.map((sub) => ({
          kind: "subcategory" as const,
          subcategoryName: sub.name,
        })),
      ];
    }
    return sortedCategories.map((c) => ({ kind: "category" as const, category: c }));
  }, [
    normalizedBrowseQuery,
    searchResults,
    selectedCategory,
    selectedSubcategory,
    sortedCategories,
  ]);

  function activateBrowseRow(row: BrowseRow) {
    switch (row.kind) {
      case "back":
        if (row.variant === "from-services") {
          if (hasSingleSubcategory) {
            setActiveSubcategory(null);
            setActiveCategory(null);
          } else {
            setActiveSubcategory(null);
          }
          keepPickerOpen();
          return;
        }
        setActiveCategory(null);
        keepPickerOpen();
        return;
      case "category":
        handleCategoryDrill(row.category.name, row.category.subcategories);
        return;
      case "subcategory":
        handleSubcategoryDrill(row.subcategoryName);
        return;
      case "service":
        handleFinalServiceSelection(row.serviceName);
        return;
      case "search":
        applySearchResult(row.result);
        return;
      default:
        return;
    }
  }

  const effectiveBrowseHighlightIdx = useMemo(() => {
    if (browseHighlight.sig !== browseNavSig) return -1;
    if (browseHighlight.idx < 0 || browseRows.length === 0) return -1;
    return Math.min(browseHighlight.idx, browseRows.length - 1);
  }, [browseHighlight.sig, browseHighlight.idx, browseNavSig, browseRows.length]);

  useEffect(() => {
    if (isMobile || !isOpen || effectiveBrowseHighlightIdx < 0) return;
    const rowEl = rootRef.current?.querySelector<HTMLElement>(
      `[data-browse-row-index="${effectiveBrowseHighlightIdx}"]`,
    );
    rowEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [effectiveBrowseHighlightIdx, isOpen, isMobile, normalizedBrowseQuery, activeCategory, activeSubcategory]);

  return (
    <div ref={rootRef} className={`relative w-full ${rootClassName}`}>
      <div className="relative flex w-full items-center">
      <input
        ref={inputRef}
        value={displayValue}
        readOnly={isMobile}
        disabled={disabled}
        onFocus={() => {
          // Keep focus neutral. Open picker on explicit click/tap.
        }}
        onClick={() => {
          if (disabled) return;
          if (shouldIgnoreOpenTrigger()) return;
          if (!query) {
            setQuery(value);
          }
          setIsOpen(true);
        }}
        onChange={(event) => {
          if (isMobile) return;
          const nextValue = event.target.value;
          setQuery(nextValue);
          onChange(nextValue);
          setActiveCategory(null);
          setActiveSubcategory(null);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closePicker(true);
            return;
          }
          if (event.key === "Enter") {
            if (event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (isMobile) return;
            if (!isOpen) return;
            if (effectiveBrowseHighlightIdx < 0 || effectiveBrowseHighlightIdx >= browseRows.length) return;
            activateBrowseRow(browseRows[effectiveBrowseHighlightIdx]);
            return;
          }
          if (isMobile) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
              if (!query) {
                setQuery(value);
              }
            }
            setBrowseHighlight((prev) => {
              const max = browseRows.length - 1;
              if (max < 0) return { sig: browseNavSig, idx: -1 };
              const aligned = prev.sig === browseNavSig ? prev.idx : -1;
              if (aligned < 0) return { sig: browseNavSig, idx: 0 };
              return { sig: browseNavSig, idx: aligned >= max ? 0 : aligned + 1 };
            });
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!isOpen) return;
            setBrowseHighlight((prev) => {
              const max = browseRows.length - 1;
              if (max < 0) return { sig: browseNavSig, idx: -1 };
              const aligned = prev.sig === browseNavSig ? prev.idx : -1;
              if (aligned < 0) return { sig: browseNavSig, idx: max };
              return { sig: browseNavSig, idx: aligned <= 0 ? max : aligned - 1 };
            });
          }
        }}
        placeholder={placeholder}
        className={`block min-h-[48px] w-full min-w-0 flex-1 py-2 sm:min-h-0 sm:py-3 ${inputClassName} pr-2 sm:pr-10`}
        autoComplete="off"
      />
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (disabled) return;
          if (shouldIgnoreOpenTrigger()) return;
          if (isMobile) {
            if (!query) {
              setQuery(value);
            }
            setIsOpen(true);
            return;
          }
          setIsOpen((prev) => !prev);
          setQuery((prev) => (prev ? prev : value));
        }}
        className={`shrink-0 transition-transform sm:absolute sm:right-3 sm:top-1/2 sm:-translate-y-1/2 ${
          isOpen ? "rotate-180" : ""
        } ${isDark ? "text-zinc-300" : "text-zinc-500"} ${toggleButtonClassName}`}
      >
        <svg viewBox="0 0 20 20" className="pointer-events-none h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m5 7 5 6 5-6" />
        </svg>
      </button>
      </div>

      {isOpen && isMobile ? (
        <MobileBottomSheet
          isOpen={isOpen}
          onClose={() => {
            closePicker();
            setMobileCustomOpen(false);
            setCustomServiceDraft("");
          }}
          title={placeholder}
          isDark={isDark}
          tallList
        >
          <div className="flex flex-col gap-3">
            <div className="shrink-0 space-y-3">
              {!mobileCustomOpen ? (
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                  placeholder={placeholder}
                  className={`min-h-[48px] w-full rounded-xl border px-3 py-2 text-base ${
                    isDark
                      ? "border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                      : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-500"
                  }`}
                />
              ) : null}
            {mobileCustomOpen ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileCustomOpen(false);
                    setCustomServiceDraft("");
                  }}
                  className={`w-full rounded-xl px-3 py-2 text-left text-base font-semibold ${isDark ? "text-blue-300 hover:bg-zinc-800/90" : "text-blue-700 hover:bg-blue-50"}`}
                >
                  ← Wróć
                </button>
                <input
                  value={customServiceDraft}
                  onChange={(event) => setCustomServiceDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                  placeholder="Opisz usługę..."
                  className={`min-h-[48px] w-full rounded-xl border px-3 py-2 text-base ${
                    isDark
                      ? "border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                      : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-500"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = customServiceDraft.trim();
                    if (!next) return;
                    onChange(next);
                    closePicker(true);
                    setMobileCustomOpen(false);
                    setCustomServiceDraft("");
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-base font-medium ${
                    isDark ? "border-blue-500/40 bg-blue-950/40 text-blue-200" : "border-blue-300 bg-blue-50 text-blue-900"
                  }`}
                >
                  Zatwierdź
                </button>
              </div>
            ) : (
              <>
                {value ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      setActiveCategory(null);
                      setActiveSubcategory(null);
                      closePicker(true);
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-base font-medium ${
                      isDark ? "border-zinc-700 text-zinc-200" : "border-zinc-300 text-zinc-700"
                    }`}
                  >
                    Wyczyść
                  </button>
                ) : null}
                {!hideManualServiceEntry && !normalizeSearchText(query) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory(null);
                      setActiveSubcategory(null);
                      setQuery("");
                      setCustomServiceDraft(value);
                      setMobileCustomOpen(true);
                    }}
                    className={`w-full rounded-xl border border-dashed px-3 py-2 text-left text-base font-medium ${
                      isDark ? "border-zinc-600 text-zinc-300" : "border-zinc-400 text-zinc-700"
                    }`}
                  >
                    Inna usługa / wpisz ręcznie
                  </button>
                ) : null}
              </>
            )}
            </div>
            {!mobileCustomOpen ? (
              <div className="space-y-1">
                  {normalizeSearchText(query) ? (
                    searchResults.length === 0 ? (
                      <p className={`px-2 py-2 text-base ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{noResultsText}</p>
                    ) : (
                      searchResults.map((result) => {
                        const svcName = result.type === "service" ? (result.serviceName ?? result.label) : "";
                        const av = result.type === "service" ? finalAvailability(svcName) : null;
                        const blocked = Boolean(result.type === "service" && av && !av.available);
                        return (
                          <button
                            key={`${result.type}-${result.categoryName}-${result.subcategoryName ?? ""}-${result.label}`}
                            type="button"
                            disabled={blocked}
                            onClick={() => {
                              if (blocked) return;
                              applySearchResult(result);
                            }}
                            className={`min-h-[48px] w-full rounded-xl px-3 py-3 text-left text-base ${
                              blocked
                                ? isDark
                                  ? "cursor-not-allowed text-zinc-500 opacity-60"
                                  : "cursor-not-allowed text-zinc-500 opacity-65"
                                : isDark
                                  ? "text-zinc-200 hover:bg-zinc-800/90"
                                  : "text-zinc-700 hover:bg-blue-50"
                            }`}
                          >
                            <span className="block font-medium">{result.label}</span>
                            {blocked ? (
                              <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">
                                Niedostępne w tym warsztacie
                              </span>
                            ) : null}
                          </button>
                        );
                      })
                    )
                  ) : selectedSubcategory ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          activateBrowseRow({ kind: "back", variant: "from-services" });
                        }}
                        className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-base font-semibold ${isDark ? "text-blue-300 hover:bg-zinc-800/90" : "text-blue-700 hover:bg-blue-50"}`}
                      >
                        ← Wróć
                      </button>
                      {selectedSubcategory.services.map((service) => {
                        const av = finalAvailability(service.name);
                        const blocked = Boolean(av && !av.available);
                        return (
                          <button
                            key={`${selectedSubcategory.name}-${service.name}`}
                            type="button"
                            disabled={blocked}
                            onClick={() => {
                              if (blocked) return;
                              handleFinalServiceSelection(service.name);
                            }}
                            className={`flex min-h-[48px] w-full flex-col items-stretch gap-0.5 rounded-xl px-3 py-3 text-left text-base ${
                              blocked
                                ? isDark
                                  ? "cursor-not-allowed text-zinc-500 opacity-60"
                                  : "cursor-not-allowed text-zinc-500 opacity-65"
                                : isDark
                                  ? "text-zinc-200 hover:bg-zinc-800/90"
                                  : "text-zinc-700 hover:bg-blue-50"
                            }`}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span>{service.name}</span>
                              {value === service.name ? <span>✓</span> : null}
                            </span>
                            {blocked ? (
                              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                Niedostępne w tym warsztacie
                              </span>
                            ) : av?.priceHint ? (
                              <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{av.priceHint}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </>
                  ) : selectedCategory ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          activateBrowseRow({ kind: "back", variant: "from-subcats" });
                        }}
                        className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-base font-semibold ${isDark ? "text-blue-300 hover:bg-zinc-800/90" : "text-blue-700 hover:bg-blue-50"}`}
                      >
                        ← Wróć
                      </button>
                      {selectedCategory.subcategories.map((subcategory) => (
                        <button
                          key={`${selectedCategory.name}-${subcategory.name}`}
                          type="button"
                          onClick={() => {
                            handleSubcategoryDrill(subcategory.name);
                          }}
                          className={`min-h-[48px] w-full rounded-xl px-3 py-3 text-left text-base ${isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"}`}
                        >
                          {subcategory.name}
                        </button>
                      ))}
                    </>
                  ) : (
                    sortedCategories.map((category) => (
                      <button
                        key={category.name}
                        type="button"
                        onClick={() => {
                          handleCategoryDrill(category.name, category.subcategories);
                        }}
                        className={`min-h-[48px] w-full rounded-xl px-3 py-3 text-left text-base ${isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"}`}
                      >
                        {category.name}
                      </button>
                    ))
                  )}
              </div>
            ) : null}
          </div>
        </MobileBottomSheet>
      ) : null}

      {isOpen && !isMobile ? (
        <div
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className={`absolute left-0 top-full z-30 mt-2 max-h-[min(260px,60vh)] w-full max-w-[min(100%,92vw)] overflow-y-auto overscroll-contain rounded-xl border p-1 backdrop-blur-xl [-webkit-overflow-scrolling:touch] [touch-action:pan-y] sm:right-0 sm:max-w-none ${
            isDark
              ? "border-blue-400/25 bg-zinc-900/95 shadow-[0_14px_34px_rgba(2,6,23,0.72),0_0_24px_rgba(59,130,246,0.28)]"
              : "border-blue-200/70 bg-white/95 shadow-[0_18px_40px_rgba(37,99,235,0.2),0_0_22px_rgba(249,115,22,0.18)]"
          }`}
        >
          {normalizedBrowseQuery && searchResults.length === 0 ? (
            <p className={`px-3 py-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{noResultsText}</p>
          ) : (
            browseRows.map((row, idx) => {
              const hi = effectiveBrowseHighlightIdx === idx;
              const hiCls = hi
                ? isDark
                  ? "bg-zinc-800/90 ring-2 ring-inset ring-blue-400/55"
                  : "bg-blue-50 ring-2 ring-inset ring-blue-500/45"
                : "";

              if (row.kind === "search") {
                const result = row.result;
                const svcName = result.type === "service" ? (result.serviceName ?? result.label) : "";
                const av = result.type === "service" ? finalAvailability(svcName) : null;
                const blocked = Boolean(result.type === "service" && av && !av.available);
                return (
                  <button
                    key={`${result.type}-${result.categoryName}-${result.subcategoryName ?? ""}-${result.label}`}
                    type="button"
                    data-browse-row-index={idx}
                    disabled={blocked}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      if (blocked) return;
                      activateBrowseRow(row);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      blocked
                        ? isDark
                          ? "cursor-not-allowed text-zinc-500 opacity-60"
                          : "cursor-not-allowed text-zinc-500 opacity-65"
                        : isDark
                          ? "text-zinc-200 hover:bg-zinc-800/90"
                          : "text-zinc-700 hover:bg-blue-50"
                    } ${hiCls}`}
                  >
                    <span className="block font-medium">{result.label}</span>
                    <span className={`block text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                      {result.type === "category"
                        ? "Kategoria"
                        : result.type === "subcategory"
                          ? `${result.categoryName} -> podkategoria`
                          : `${result.categoryName} -> ${result.subcategoryName ?? ""}`}
                    </span>
                    {blocked ? (
                      <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">
                        Niedostępne w tym warsztacie
                      </span>
                    ) : null}
                  </button>
                );
              }

              if (row.kind === "back") {
                const label =
                  row.variant === "from-services"
                    ? `← ${hasSingleSubcategory ? "Kategorie" : "Podkategorie"}`
                    : "← Kategorie";
                return (
                  <button
                    key={`back-desktop-${row.variant}-${idx}`}
                    type="button"
                    data-browse-row-index={idx}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      activateBrowseRow(row);
                    }}
                    className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
                      isDark ? "text-blue-300 hover:bg-zinc-800/90" : "text-blue-700 hover:bg-blue-50"
                    } ${hiCls}`}
                  >
                    {label}
                  </button>
                );
              }

              if (row.kind === "service") {
                const av = finalAvailability(row.serviceName);
                const blocked = Boolean(av && !av.available);
                return (
                  <button
                    key={`${selectedSubcategory?.name ?? "sub"}-${row.serviceName}-${idx}`}
                    type="button"
                    data-browse-row-index={idx}
                    disabled={blocked}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      if (blocked) return;
                      activateBrowseRow(row);
                    }}
                    className={`flex w-full flex-col items-stretch gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                      blocked
                        ? isDark
                          ? "cursor-not-allowed text-zinc-500 opacity-60"
                          : "cursor-not-allowed text-zinc-500 opacity-65"
                        : isDark
                          ? "text-zinc-200 hover:bg-zinc-800/90"
                          : "text-zinc-700 hover:bg-blue-50"
                    } ${hiCls}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{row.serviceName}</span>
                      {value === row.serviceName ? (
                        <svg
                          viewBox="0 0 20 20"
                          className={`h-4 w-4 shrink-0 ${isDark ? "text-blue-300" : "text-blue-600"}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="m4 10 4 4 8-8" />
                        </svg>
                      ) : null}
                    </span>
                    {blocked ? (
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">
                        Niedostępne w tym warsztacie
                      </span>
                    ) : av?.priceHint ? (
                      <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{av.priceHint}</span>
                    ) : null}
                  </button>
                );
              }

              if (row.kind === "subcategory") {
                return (
                  <button
                    key={`${selectedCategory?.name ?? "cat"}-${row.subcategoryName}-${idx}`}
                    type="button"
                    data-browse-row-index={idx}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      activateBrowseRow(row);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"
                    } ${hiCls}`}
                  >
                    {row.subcategoryName}
                  </button>
                );
              }

              return (
                <button
                  key={`cat-desktop-${row.category.name}-${idx}`}
                  type="button"
                  data-browse-row-index={idx}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    activateBrowseRow(row);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"
                  } ${hiCls}`}
                >
                  {row.category.name}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

