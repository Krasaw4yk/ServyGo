"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ServiceCategory } from "@/lib/serviceCatalog";
import MobileBottomSheet from "@/components/MobileBottomSheet";

type ServiceCategoryPickerProps = {
  value: string;
  onChange: (value: string) => void;
  categories: ServiceCategory[];
  disabled?: boolean;
  isDark?: boolean;
  inputClassName?: string;
  placeholder?: string;
  noResultsText?: string;
};

type SearchResult = {
  type: "category" | "subcategory" | "service";
  label: string;
  categoryName: string;
  subcategoryName?: string;
  serviceName?: string;
};

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function rankSearchMatch(label: string, query: string) {
  const normalizedLabel = normalizeSearchText(label);
  if (normalizedLabel === query) return 0;
  if (normalizedLabel.startsWith(query)) return 1;
  if (normalizedLabel.includes(query)) return 2;
  return Number.POSITIVE_INFINITY;
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
}: ServiceCategoryPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileCustomOpen, setMobileCustomOpen] = useState(false);
  const [customServiceDraft, setCustomServiceDraft] = useState("");
  const prevSheetOpenRef = useRef(false);

  const displayValue = isOpen ? query : value;

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
    () => categories.find((category) => category.name === activeCategory) ?? null,
    [activeCategory, categories],
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
    for (const category of categories) {
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
        return a.label.localeCompare(b.label, "pl");
      });
  }, [categories, query]);

  return (
    <div ref={rootRef} className="relative w-full">
      <input
        value={displayValue}
        readOnly={isMobile}
        disabled={disabled}
        onFocus={() => {
          if (disabled) return;
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
            setIsOpen(false);
            setQuery("");
          }
        }}
        placeholder={placeholder}
        className={`block w-full ${inputClassName} pr-10`}
        autoComplete="off"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => !prev);
          setQuery((prev) => (prev ? prev : value));
        }}
        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform ${
          isOpen ? "rotate-180" : ""
        } ${isDark ? "text-zinc-300" : "text-zinc-500"}`}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m5 7 5 6 5-6" />
        </svg>
      </button>

      {isOpen && isMobile ? (
        <MobileBottomSheet
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            setQuery("");
            setMobileCustomOpen(false);
            setCustomServiceDraft("");
          }}
          title={placeholder}
          isDark={isDark}
          fixedHeight
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="space-y-3 pb-3">
              {!mobileCustomOpen ? (
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  placeholder={placeholder}
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${
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
                  className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold ${isDark ? "text-blue-300 hover:bg-zinc-800/90" : "text-blue-700 hover:bg-blue-50"}`}
                >
                  ← Wróć
                </button>
                <input
                  value={customServiceDraft}
                  onChange={(event) => setCustomServiceDraft(event.target.value)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  placeholder="Opisz usługę..."
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${
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
                    setIsOpen(false);
                    setQuery("");
                    setMobileCustomOpen(false);
                    setCustomServiceDraft("");
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm font-medium ${
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
                      setQuery("");
                      setIsOpen(false);
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-medium ${
                      isDark ? "border-zinc-700 text-zinc-200" : "border-zinc-300 text-zinc-700"
                    }`}
                  >
                    Wyczyść
                  </button>
                ) : null}
                {!normalizeSearchText(query) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory(null);
                      setActiveSubcategory(null);
                      setQuery("");
                      setCustomServiceDraft(value);
                      setMobileCustomOpen(true);
                    }}
                    className={`w-full rounded-xl border border-dashed px-3 py-2 text-left text-sm font-medium ${
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
              <div className="min-h-0 flex-1 overflow-y-auto pb-1">
                  {normalizeSearchText(query) ? (
                    searchResults.length === 0 ? (
                      <p className={`px-2 py-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{noResultsText}</p>
                    ) : (
                      searchResults.map((result) => (
                        <button
                          key={`${result.type}-${result.categoryName}-${result.subcategoryName ?? ""}-${result.label}`}
                          type="button"
                          onClick={() => {
                            if (result.type === "category") {
                              setActiveCategory(result.categoryName);
                              setActiveSubcategory(null);
                              setQuery("");
                              return;
                            }
                            if (result.type === "subcategory") {
                              setActiveCategory(result.categoryName);
                              setActiveSubcategory(result.subcategoryName ?? null);
                              setQuery("");
                              return;
                            }
                            onChange(result.serviceName ?? "");
                            setQuery("");
                            setIsOpen(false);
                          }}
                          className={`w-full rounded-xl px-3 py-3 text-left text-sm ${isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"}`}
                        >
                          <span className="block font-medium">{result.label}</span>
                        </button>
                      ))
                    )
                  ) : selectedSubcategory ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (hasSingleSubcategory) {
                            setActiveSubcategory(null);
                            setActiveCategory(null);
                            return;
                          }
                          setActiveSubcategory(null);
                        }}
                        className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold ${isDark ? "text-blue-300 hover:bg-zinc-800/90" : "text-blue-700 hover:bg-blue-50"}`}
                      >
                        ← Wróć
                      </button>
                      {selectedSubcategory.services.map((service) => (
                        <button
                          key={`${selectedSubcategory.name}-${service.name}`}
                          type="button"
                          onClick={() => {
                            onChange(service.name);
                            setIsOpen(false);
                            setQuery("");
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm ${isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"}`}
                        >
                          <span>{service.name}</span>
                          {value === service.name ? <span>✓</span> : null}
                        </button>
                      ))}
                    </>
                  ) : selectedCategory ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveCategory(null)}
                        className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold ${isDark ? "text-blue-300 hover:bg-zinc-800/90" : "text-blue-700 hover:bg-blue-50"}`}
                      >
                        ← Wróć
                      </button>
                      {selectedCategory.subcategories.map((subcategory) => (
                        <button
                          key={`${selectedCategory.name}-${subcategory.name}`}
                          type="button"
                          onClick={() => setActiveSubcategory(subcategory.name)}
                          className={`w-full rounded-xl px-3 py-3 text-left text-sm ${isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"}`}
                        >
                          {subcategory.name}
                        </button>
                      ))}
                    </>
                  ) : (
                    categories.map((category) => (
                      <button
                        key={category.name}
                        type="button"
                        onClick={() => {
                          setActiveCategory(category.name);
                          if (category.subcategories.length === 1) {
                            setActiveSubcategory(category.subcategories[0]?.name ?? null);
                          } else {
                            setActiveSubcategory(null);
                          }
                        }}
                        className={`w-full rounded-xl px-3 py-3 text-left text-sm ${isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"}`}
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
          className={`absolute left-0 top-full z-30 mt-2 max-h-72 w-full max-w-[min(100%,92vw)] overflow-auto rounded-xl border p-1 backdrop-blur-xl sm:right-0 sm:max-w-none ${
            isDark
              ? "border-blue-400/25 bg-zinc-900/95 shadow-[0_14px_34px_rgba(2,6,23,0.72),0_0_24px_rgba(59,130,246,0.28)]"
              : "border-blue-200/70 bg-white/95 shadow-[0_18px_40px_rgba(37,99,235,0.2),0_0_22px_rgba(249,115,22,0.18)]"
          }`}
        >
          {normalizeSearchText(query) ? (
            searchResults.length === 0 ? (
              <p className={`px-3 py-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{noResultsText}</p>
            ) : (
              searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.categoryName}-${result.subcategoryName ?? ""}-${result.label}`}
                  type="button"
                  onClick={() => {
                    if (result.type === "category") {
                      setActiveCategory(result.categoryName);
                      setActiveSubcategory(null);
                      setQuery("");
                      return;
                    }
                    if (result.type === "subcategory") {
                      setActiveCategory(result.categoryName);
                      setActiveSubcategory(result.subcategoryName ?? null);
                      setQuery("");
                      return;
                    }
                    onChange(result.serviceName ?? "");
                    setQuery("");
                    setIsOpen(false);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"
                  }`}
                >
                  <span className="block font-medium">{result.label}</span>
                  <span className={`block text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    {result.type === "category"
                      ? "Kategoria"
                      : result.type === "subcategory"
                        ? `${result.categoryName} -> podkategoria`
                        : `${result.categoryName} -> ${result.subcategoryName ?? ""}`}
                  </span>
                </button>
              ))
            )
          ) : selectedSubcategory ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (hasSingleSubcategory) {
                    setActiveSubcategory(null);
                    setActiveCategory(null);
                    return;
                  }
                  setActiveSubcategory(null);
                }}
                className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
                  isDark ? "text-blue-300 hover:bg-zinc-800/90" : "text-blue-700 hover:bg-blue-50"
                }`}
              >
                ← {hasSingleSubcategory ? "Kategorie" : "Podkategorie"}
              </button>
              {selectedSubcategory.services.map((service) => (
                <button
                  key={`${selectedSubcategory.name}-${service.name}`}
                  type="button"
                  onClick={() => {
                    onChange(service.name);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                    isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"
                  }`}
                >
                  <span>{service.name}</span>
                  {value === service.name ? (
                    <svg
                      viewBox="0 0 20 20"
                      className={`h-4 w-4 ${isDark ? "text-blue-300" : "text-blue-600"}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="m4 10 4 4 8-8" />
                    </svg>
                  ) : null}
                </button>
              ))}
            </>
          ) : selectedCategory ? (
            <>
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
                  isDark ? "text-blue-300 hover:bg-zinc-800/90" : "text-blue-700 hover:bg-blue-50"
                }`}
              >
                ← Kategorie
              </button>
              {selectedCategory.subcategories.map((subcategory) => (
                <button
                  key={`${selectedCategory.name}-${subcategory.name}`}
                  type="button"
                  onClick={() => setActiveSubcategory(subcategory.name)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"
                  }`}
                >
                  {subcategory.name}
                </button>
              ))}
            </>
          ) : (
            categories.map((category) => (
              <button
                key={category.name}
                type="button"
                onClick={() => {
                  setActiveCategory(category.name);
                  if (category.subcategories.length === 1) {
                    setActiveSubcategory(category.subcategories[0]?.name ?? null);
                  } else {
                    setActiveSubcategory(null);
                  }
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"
                }`}
              >
                {category.name}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

