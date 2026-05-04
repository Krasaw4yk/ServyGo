"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MobileBottomSheet from "@/components/MobileBottomSheet";

type AutocompleteOption = {
  value: string;
  label: string;
};

type AutocompleteSelectProps = {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | AutocompleteOption>;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  isDark?: boolean;
  noResultsText?: string;
  inputClassName?: string;
  panelClassName?: string;
  /** Dodatkowe klasy na kontener (np. layout mobilny). */
  rootClassName?: string;
  /** Klasy na przycisk strzałki (np. ukrycie na wąskim ekranie). */
  toggleButtonClassName?: string;
};

function normalizeOption(option: string | AutocompleteOption): AutocompleteOption {
  if (typeof option === "string") {
    return { value: option, label: option };
  }
  return option;
}

const PRIORITY_LABELS = ["Wszystkie", "Wpisz ręcznie", "Dowolne", "Inne"] as const;

function getPriorityIndex(label: string) {
  const normalized = label.trim().toLowerCase();
  return PRIORITY_LABELS.findIndex((priorityLabel) => {
    const normalizedPriorityLabel = priorityLabel.toLowerCase();
    return normalized === normalizedPriorityLabel || normalized.startsWith(`${normalizedPriorityLabel} `);
  });
}

function normalizeForMatch(text: string) {
  return text.trim().toLowerCase();
}

/** Enter: highlighted row, else exact label/value match, else single filtered option. */
function resolveEnterSelection(
  filtered: AutocompleteOption[],
  queryText: string,
  highlightedIdx: number,
): AutocompleteOption | null {
  if (filtered.length === 0) return null;
  const highlighted =
    highlightedIdx >= 0 && highlightedIdx < filtered.length ? filtered[highlightedIdx] : null;
  if (highlighted) return highlighted;
  const needle = normalizeForMatch(queryText);
  if (needle) {
    const exact = filtered.find(
      (o) => normalizeForMatch(o.label) === needle || normalizeForMatch(o.value) === needle,
    );
    if (exact) return exact;
  }
  if (filtered.length === 1) return filtered[0];
  return null;
}

function compareOptionLabels(a: AutocompleteOption, b: AutocompleteOption) {
  const isANumeric = /^\d+$/.test(a.label.trim());
  const isBNumeric = /^\d+$/.test(b.label.trim());
  if (isANumeric && isBNumeric) {
    return Number(b.label) - Number(a.label);
  }
  const aPriority = getPriorityIndex(a.label);
  const bPriority = getPriorityIndex(b.label);
  if (aPriority !== -1 || bPriority !== -1) {
    if (aPriority === -1) return 1;
    if (bPriority === -1) return -1;
    return aPriority - bPriority;
  }
  return a.label.localeCompare(b.label, "pl", { sensitivity: "base" });
}

export default function AutocompleteSelect({
  name,
  value,
  onChange,
  options,
  placeholder,
  label,
  disabled = false,
  required = false,
  isDark = false,
  noResultsText = "Brak wyników",
  inputClassName = "",
  panelClassName = "",
  rootClassName = "",
  toggleButtonClassName = "",
}: AutocompleteSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Po zamknięciu arkusza mobilnego ten sam gest potrafi „przeklikać” pole pod spodem — ignoruj krótko otwarcie. */
  const suppressOpenUntilRef = useRef(0);

  function markSuppressTapThroughFromSheet() {
    if (!isMobile) return;
    suppressOpenUntilRef.current = Date.now() + 480;
  }

  function shouldIgnoreOpenTrigger() {
    return isMobile && Date.now() < suppressOpenUntilRef.current;
  }

  function closeDropdown(blurInput = false) {
    markSuppressTapThroughFromSheet();
    setIsOpen(false);
    setQuery("");
    setHighlightedIndex(-1);
    if (blurInput) {
      inputRef.current?.blur();
    }
  }

  function handleSelectOption(option: AutocompleteOption) {
    onChange(option.value);
    setQuery("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    markSuppressTapThroughFromSheet();
    inputRef.current?.blur();
  }

  function handleClearSelection() {
    onChange("");
    setQuery("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    markSuppressTapThroughFromSheet();
    inputRef.current?.blur();
  }

  const normalizedOptions = useMemo(
    () => options.map(normalizeOption).sort(compareOptionLabels),
    [options],
  );

  const selectedOption = useMemo(
    () => normalizedOptions.find((option) => option.value === value) ?? null,
    [normalizedOptions, value],
  );

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return normalizedOptions;
    const matches = normalizedOptions.filter((option) =>
      option.label.toLowerCase().includes(needle),
    );
    return matches.sort((a, b) => {
      const aLabel = a.label.toLowerCase();
      const bLabel = b.label.toLowerCase();
      const aStartsWith = aLabel.startsWith(needle) ? 0 : 1;
      const bStartsWith = bLabel.startsWith(needle) ? 0 : 1;
      if (aStartsWith !== bStartsWith) return aStartsWith - bStartsWith;
      const aIndex = aLabel.indexOf(needle);
      const bIndex = bLabel.indexOf(needle);
      if (aIndex !== bIndex) return aIndex - bIndex;
      return aLabel.localeCompare(bLabel, "pl", { sensitivity: "base" });
    });
  }, [normalizedOptions, query]);

  useEffect(() => {
    if (highlightedIndex < 0) return;
    if (filteredOptions.length === 0) {
      setHighlightedIndex(-1);
      return;
    }
    if (highlightedIndex >= filteredOptions.length) {
      setHighlightedIndex(filteredOptions.length - 1);
    }
  }, [filteredOptions, highlightedIndex]);

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
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

  const displayValue = isOpen ? query : selectedOption?.label ?? value;

  function openMobilePicker() {
    if (disabled) return;
    if (shouldIgnoreOpenTrigger()) return;
    setQuery(selectedOption?.label ?? value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  }

  return (
    <div ref={rootRef} className={`relative flex w-full flex-col gap-2 ${rootClassName}`}>
      {label ? <span className="text-sm font-medium">{label}</span> : null}
      <div className="relative flex w-full items-center">
        <input
          ref={inputRef}
          name={name}
          value={displayValue}
          aria-required={required}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          role="combobox"
          readOnly={isMobile}
          disabled={disabled}
          onFocus={() => {
            // Keep focus neutral. Open list on explicit click/tap.
          }}
          onClick={() => {
            if (disabled) return;
            if (shouldIgnoreOpenTrigger()) return;
            setQuery(selectedOption?.label ?? value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onChange={(event) => {
            if (isMobile) return;
            const nextValue = event.target.value;
            setQuery(nextValue);
            onChange(nextValue);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeDropdown(true);
              return;
            }
            if (event.key === "Enter") {
              if (event.nativeEvent.isComposing) return;
              event.preventDefault();
              if (!isOpen || filteredOptions.length === 0) return;
              const pick = resolveEnterSelection(filteredOptions, query, highlightedIndex);
              if (pick) handleSelectOption(pick);
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!isOpen) {
                setQuery(selectedOption?.label ?? value);
                setIsOpen(true);
              }
              if (filteredOptions.length === 0) return;
              setHighlightedIndex((prev) => (prev < 0 ? 0 : Math.min(prev + 1, filteredOptions.length - 1)));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (!isOpen || filteredOptions.length === 0) return;
              setHighlightedIndex((prev) => {
                if (prev <= 0) return -1;
                return prev - 1;
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
              openMobilePicker();
              return;
            }
            setIsOpen((prev) => !prev);
            setHighlightedIndex(-1);
          }}
          className={`shrink-0 transition-transform sm:absolute sm:right-3 sm:top-1/2 sm:-translate-y-1/2 ${
            isOpen ? "rotate-180" : ""
          } ${isDark ? "text-zinc-300" : "text-zinc-500"} ${toggleButtonClassName}`}
          aria-label="Toggle options"
        >
          <svg viewBox="0 0 20 20" className="pointer-events-none h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m5 7 5 6 5-6" />
          </svg>
        </button>
      </div>
      {isMobile ? (
        <MobileBottomSheet
          isOpen={isOpen}
          onClose={() => {
            closeDropdown();
          }}
          title={label ?? placeholder ?? "Wybierz"}
          isDark={isDark}
          tallList
        >
          <div className="flex flex-col gap-3">
            <div className="shrink-0 space-y-2">
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHighlightedIndex(-1);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeDropdown(true);
                    return;
                  }
                  if (event.key === "Enter") {
                    if (event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    const pick = resolveEnterSelection(filteredOptions, query, highlightedIndex);
                    if (pick) handleSelectOption(pick);
                    return;
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    if (filteredOptions.length === 0) return;
                    setHighlightedIndex((prev) =>
                      prev < 0 ? 0 : Math.min(prev + 1, filteredOptions.length - 1),
                    );
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    if (filteredOptions.length === 0) return;
                    setHighlightedIndex((prev) => {
                      if (prev <= 0) return -1;
                      return prev - 1;
                    });
                  }
                }}
                placeholder={placeholder ?? "Szukaj..."}
                className={`min-h-[48px] w-full rounded-xl border px-3 py-2 text-base ${
                  isDark
                    ? "border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                    : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-500"
                }`}
              />
              {selectedOption ? (
                <button
                  type="button"
                  onClick={() => {
                    handleClearSelection();
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-base font-medium ${
                    isDark ? "border-zinc-700 text-zinc-200" : "border-zinc-300 text-zinc-700"
                  }`}
                >
                  Wyczyść
                </button>
              ) : null}
            </div>
            <div className="space-y-1">
              {filteredOptions.length === 0 ? (
                <p className={`px-2 py-2 text-base ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{noResultsText}</p>
              ) : (
                filteredOptions.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      handleSelectOption(option);
                    }}
                    className={`flex min-h-[48px] w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-base ${
                      isDark
                        ? highlightedIndex === index
                          ? "bg-zinc-800 text-zinc-100"
                          : "text-zinc-200 hover:bg-zinc-800/90"
                        : highlightedIndex === index
                          ? "bg-blue-100 text-zinc-900"
                          : "text-zinc-700 hover:bg-blue-50"
                    }`}
                  >
                    <span>{option.label}</span>
                    {selectedOption?.value === option.value ? <span>✓</span> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </MobileBottomSheet>
      ) : null}
      {isOpen && !isMobile ? (
        <div
          role="listbox"
          className={`absolute left-0 top-full z-20 mt-1 max-h-[min(260px,60vh)] w-full max-w-[min(100%,92vw)] overflow-y-auto overscroll-contain rounded-xl border p-1 shadow-xl backdrop-blur [-webkit-overflow-scrolling:touch] [touch-action:pan-y] sm:right-0 sm:max-w-none ${
            isDark
              ? "border-blue-400/20 bg-zinc-900/95 shadow-[0_14px_34px_rgba(2,6,23,0.72),0_0_24px_rgba(59,130,246,0.28)]"
              : "border-blue-200/60 bg-white/95 shadow-[0_18px_40px_rgba(37,99,235,0.2),0_0_22px_rgba(249,115,22,0.18)]"
          } ${panelClassName}`}
        >
          {filteredOptions.length === 0 ? (
            <p className={`px-3 py-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{noResultsText}</p>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selectedOption?.value === option.value}
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleSelectOption(option);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  isDark
                    ? highlightedIndex === index
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-200 hover:bg-zinc-800/90"
                    : highlightedIndex === index
                      ? "bg-blue-100 text-zinc-900"
                      : "text-zinc-700 hover:bg-blue-50"
                }`}
              >
                <span>{option.label}</span>
                {selectedOption?.value === option.value ? (
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
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
