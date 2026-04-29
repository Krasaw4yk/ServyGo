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
};

function normalizeOption(option: string | AutocompleteOption): AutocompleteOption {
  if (typeof option === "string") {
    return { value: option, label: option };
  }
  return option;
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
}: AutocompleteSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);

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
      return aLabel.localeCompare(bLabel, "pl");
    });
  }, [normalizedOptions, query]);

  useEffect(() => {
    function updateViewportMode() {
      setIsMobile(window.innerWidth < 640);
    }
    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue = isOpen ? query : selectedOption?.label ?? value;

  return (
    <div ref={rootRef} className="relative flex w-full flex-col gap-2">
      {label ? <span className="text-sm font-medium">{label}</span> : null}
      <div className="relative w-full">
        <input
          name={name}
          value={displayValue}
          required={required}
          readOnly={isMobile}
          disabled={disabled}
          onFocus={() => {
            if (disabled) return;
            setQuery(selectedOption?.label ?? value);
            setIsOpen(true);
          }}
          onChange={(event) => {
            if (isMobile) return;
            const nextValue = event.target.value;
            setQuery(nextValue);
            onChange(nextValue);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setIsOpen(false);
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
          }}
          className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform ${
            isOpen ? "rotate-180" : ""
          } ${isDark ? "text-zinc-300" : "text-zinc-500"}`}
          aria-label="Toggle options"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m5 7 5 6 5-6" />
          </svg>
        </button>
      </div>
      {isMobile ? (
        <MobileBottomSheet
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            setQuery("");
          }}
          title={label ?? placeholder ?? "Wybierz"}
          isDark={isDark}
        >
          <div className="space-y-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder ?? "Szukaj..."}
              className={`w-full rounded-xl border px-3 py-2 text-sm ${
                isDark
                  ? "border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                  : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-500"
              }`}
            />
            {selectedOption ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
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
            <div className="space-y-1 overflow-y-auto" style={{ maxHeight: "calc(70vh - 140px)" }}>
              {filteredOptions.length === 0 ? (
                <p className={`px-2 py-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{noResultsText}</p>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setQuery("");
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm ${
                      isDark ? "text-zinc-200 hover:bg-zinc-800/90" : "text-zinc-700 hover:bg-blue-50"
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
          className={`absolute left-0 top-full z-20 mt-1 max-h-56 w-full max-w-[min(100%,92vw)] overflow-auto rounded-xl border p-1 shadow-xl backdrop-blur sm:right-0 sm:max-w-none ${
            isDark
              ? "border-blue-400/20 bg-zinc-900/95 shadow-[0_14px_34px_rgba(2,6,23,0.72),0_0_24px_rgba(59,130,246,0.28)]"
              : "border-blue-200/60 bg-white/95 shadow-[0_18px_40px_rgba(37,99,235,0.2),0_0_22px_rgba(249,115,22,0.18)]"
          } ${panelClassName}`}
        >
          {filteredOptions.length === 0 ? (
            <p className={`px-3 py-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{noResultsText}</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setQuery("");
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  isDark
                    ? "text-zinc-200 hover:bg-zinc-800/90"
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
