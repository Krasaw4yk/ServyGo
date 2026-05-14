import type { ServiceCategory } from "@/lib/serviceCatalog";
import { slugifyServiceKey } from "@/lib/serviceCategoryClassifier";
import type { WorkshopServiceOffer } from "@/lib/mockWorkshops";
import { matchWorkshopServicesForVehicle, type VehicleSearchCriteria } from "@/lib/publicWorkshopsFromDb";

/** Jedna pozycja z katalogu / koszyka usług klienta. */
export type SelectedServiceItem = {
  id: string;
  name: string;
  source?: "catalog" | "custom";
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  groupId?: string;
  groupName?: string;
  description?: string;
  estimatedDurationMinutes?: number | null;
  priceFrom?: number | null;
  priceTo?: number | null;
};

/** Etykieta kategorii dla wpisów własnych (UI + JSON). */
export const CUSTOM_SERVICE_CATEGORY_LABEL = "Własny opis";

export type SearchMode = "best_match" | "separate";

export type WorkshopServiceMatchResult = {
  selectedCount: number;
  matchedCount: number;
  score: number;
  matchedServices: SelectedServiceItem[];
  missingServices: SelectedServiceItem[];
  isFullMatch: boolean;
};

export function stableSelectedServiceId(
  categoryName: string,
  subcategoryName: string,
  serviceName: string,
): string {
  const raw = `${categoryName.trim()}|${subcategoryName.trim()}|${serviceName.trim()}`;
  let id = slugifyServiceKey(raw);
  if (!id) id = slugifyServiceKey(serviceName.trim() || "usluga");
  return id;
}

export function buildSelectedServiceItem(partial: {
  categoryName: string;
  subcategoryName: string;
  name: string;
  source?: "catalog" | "custom";
  description?: string;
  estimatedDurationMinutes?: number | null;
  priceFrom?: number | null;
  priceTo?: number | null;
}): SelectedServiceItem {
  const id = stableSelectedServiceId(partial.categoryName, partial.subcategoryName, partial.name);
  return {
    id,
    name: partial.name.trim(),
    source: partial.source ?? "catalog",
    categoryName: partial.categoryName.trim() || undefined,
    subcategoryName: partial.subcategoryName.trim() || undefined,
    description: partial.description,
    estimatedDurationMinutes: partial.estimatedDurationMinutes ?? null,
    priceFrom: partial.priceFrom ?? null,
    priceTo: partial.priceTo ?? null,
  };
}

/** Klucz do deduplikacji nazw (bez diakrytyków, małe litery, spacje). */
export function normalizeSelectedServiceNameKey(name: string): string {
  return slugifyServiceKey(name.trim().replace(/\s+/g, " "));
}

/** Własny opis klienta — stabilne id `custom-…` (bezpieczne w URL jako token). */
export function buildCustomSelectedServiceItem(rawName: string): SelectedServiceItem {
  const name = rawName.trim().replace(/\s+/g, " ");
  let slug = normalizeSelectedServiceNameKey(name);
  if (!slug) slug = "wpis";
  const id = `custom-${slug}`;
  return {
    id,
    name,
    source: "custom",
    categoryName: CUSTOM_SERVICE_CATEGORY_LABEL,
  };
}

/** Dopasowanie pozycji katalogowej po nazwie (bez rozróżniania wielkości liter). */
export function findCatalogSelectedItemInsensitive(
  categories: ServiceCategory[],
  raw: string,
): SelectedServiceItem | null {
  const key = normalizeSelectedServiceNameKey(raw);
  if (!key) return null;
  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      for (const leaf of sub.services) {
        if (normalizeSelectedServiceNameKey(leaf.name) === key) {
          return buildSelectedServiceItem({
            categoryName: cat.name,
            subcategoryName: sub.name,
            name: leaf.name,
            source: "catalog",
          });
        }
      }
    }
  }
  return null;
}

/** Ręczny wpis: preferuj katalog; inaczej custom. */
export function resolveManualEntryToSelectedItem(raw: string, categories: ServiceCategory[]): SelectedServiceItem {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  const fromCatalog = findCatalogSelectedItemInsensitive(categories, trimmed);
  if (fromCatalog) return fromCatalog;
  return buildCustomSelectedServiceItem(trimmed);
}

export function getCatalogSelectedItems(items: SelectedServiceItem[]): SelectedServiceItem[] {
  return items.filter((i) => i.source !== "custom");
}

export function getCustomSelectedItems(items: SelectedServiceItem[]): SelectedServiceItem[] {
  return items.filter((i) => i.source === "custom");
}

export function hasOnlyCustomSelectedItems(items: SelectedServiceItem[]): boolean {
  return items.length > 0 && items.every((i) => i.source === "custom");
}

export function selectedItemsShareSameNormalizedName(a: SelectedServiceItem, b: SelectedServiceItem): boolean {
  const ka = normalizeSelectedServiceNameKey(a.name);
  const kb = normalizeSelectedServiceNameKey(b.name);
  return Boolean(ka) && ka === kb;
}

export function findCatalogPathForServiceName(
  categories: ServiceCategory[],
  serviceName: string,
): { categoryName: string; subcategoryName: string } | null {
  const needle = serviceName.trim();
  if (!needle) return null;
  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      for (const leaf of sub.services) {
        if (leaf.name.trim() === needle) {
          return { categoryName: cat.name, subcategoryName: sub.name };
        }
      }
    }
  }
  return null;
}

export function normalizeSelectedServices(input: unknown): SelectedServiceItem[] {
  if (!input) return [];
  if (!Array.isArray(input)) return [];
  const out: SelectedServiceItem[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const id =
      typeof o.id === "string" && o.id.trim()
        ? o.id.trim()
        : stableSelectedServiceId(
            typeof o.categoryName === "string" ? o.categoryName : "",
            typeof o.subcategoryName === "string" ? o.subcategoryName : "",
            name,
          );
    const rawSource = o.source;
    const inferredSource: "catalog" | "custom" | undefined =
      rawSource === "custom" || rawSource === "catalog"
        ? rawSource
        : typeof o.categoryName === "string" && o.categoryName.trim() === CUSTOM_SERVICE_CATEGORY_LABEL
          ? "custom"
          : id.startsWith("custom-")
            ? "custom"
            : undefined;
    out.push({
      id,
      name,
      source: inferredSource,
      categoryId: typeof o.categoryId === "string" ? o.categoryId : undefined,
      categoryName: typeof o.categoryName === "string" ? o.categoryName : undefined,
      subcategoryId: typeof o.subcategoryId === "string" ? o.subcategoryId : undefined,
      subcategoryName: typeof o.subcategoryName === "string" ? o.subcategoryName : undefined,
      groupId: typeof o.groupId === "string" ? o.groupId : undefined,
      groupName: typeof o.groupName === "string" ? o.groupName : undefined,
      description: typeof o.description === "string" ? o.description : undefined,
      estimatedDurationMinutes:
        typeof o.estimatedDurationMinutes === "number"
          ? o.estimatedDurationMinutes
          : o.estimatedDurationMinutes === null
            ? null
            : undefined,
      priceFrom: typeof o.priceFrom === "number" ? o.priceFrom : o.priceFrom === null ? null : undefined,
      priceTo: typeof o.priceTo === "number" ? o.priceTo : o.priceTo === null ? null : undefined,
    });
  }
  return dedupeSelectedServices(out);
}

export function dedupeSelectedServices(items: SelectedServiceItem[]): SelectedServiceItem[] {
  const sorted = [...items].sort((a, b) => {
    const ac = a.source === "custom" ? 1 : 0;
    const bc = b.source === "custom" ? 1 : 0;
    return ac - bc;
  });
  const seenName = new Set<string>();
  const out: SelectedServiceItem[] = [];
  for (const it of sorted) {
    const nk = normalizeSelectedServiceNameKey(it.name);
    if (nk) {
      if (seenName.has(nk)) continue;
      seenName.add(nk);
    }
    out.push(it);
  }
  return out;
}

export function buildServiceSummary(names: string[]): string {
  const list = names.map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} + ${list[1]}`;
  if (list.length === 3) return `3 usługi: ${list.join(", ")}`;
  return `${list.length} usługi: ${list.slice(0, 3).join(", ")}…`;
}

export function selectedItemsToSummary(items: SelectedServiceItem[]): string {
  return buildServiceSummary(items.map((i) => i.name));
}

export function isSelectedServiceItem(item: SelectedServiceItem, selected: SelectedServiceItem[]): boolean {
  return selected.some((s) => s.id === item.id || selectedItemsShareSameNormalizedName(s, item));
}

export function toggleSelectedServiceItem(
  item: SelectedServiceItem,
  selected: SelectedServiceItem[],
): SelectedServiceItem[] {
  if (isSelectedServiceItem(item, selected)) {
    return selected.filter((s) => !(s.id === item.id || selectedItemsShareSameNormalizedName(s, item)));
  }
  const withoutNameDupes = selected.filter((s) => !selectedItemsShareSameNormalizedName(s, item));
  return dedupeSelectedServices([...withoutNameDupes, item]);
}

function decodeServicesQueryToken(token: string, categories: ServiceCategory[]): SelectedServiceItem | null {
  const t = token.trim();
  if (!t) return null;
  if (t.startsWith("c_")) {
    try {
      const decoded = decodeURIComponent(t.slice(2));
      return resolveManualEntryToSelectedItem(decoded, categories);
    } catch {
      return null;
    }
  }
  return findServiceByStableId(categories, t);
}

export function decodeSelectedServicesFromQuery(params: URLSearchParams, categories: ServiceCategory[]): SelectedServiceItem[] {
  const rawServices = (params.get("services") ?? "").trim();
  const legacy = (params.get("service") ?? "").trim();
  const ids = rawServices
    ? rawServices
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (ids.length === 0) {
    if (!legacy) return [];
    return dedupeSelectedServices([resolveManualEntryToSelectedItem(legacy, categories)]);
  }
  const out: SelectedServiceItem[] = [];
  for (const id of ids) {
    const found = decodeServicesQueryToken(id, categories);
    if (found) {
      out.push(found);
    }
  }
  if (out.length === 0 && legacy) {
    return dedupeSelectedServices([resolveManualEntryToSelectedItem(legacy, categories)]);
  }
  return dedupeSelectedServices(out);
}

function findServiceByStableId(categories: ServiceCategory[], id: string): SelectedServiceItem | null {
  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      for (const leaf of sub.services) {
        const sid = stableSelectedServiceId(cat.name, sub.name, leaf.name);
        if (sid === id) {
          return buildSelectedServiceItem({
            categoryName: cat.name,
            subcategoryName: sub.name,
            name: leaf.name,
            source: "catalog",
          });
        }
      }
    }
  }
  return null;
}

export function encodeSelectedServicesToQuery(items: SelectedServiceItem[]): string {
  return items
    .map((i) => {
      if (i.source === "custom") {
        return `c_${encodeURIComponent(i.name.trim())}`;
      }
      return i.id;
    })
    .join(",");
}

export function getSelectedServiceNames(items: SelectedServiceItem[]): string[] {
  return items.map((i) => i.name.trim()).filter(Boolean);
}

type CriteriaNoService = Omit<VehicleSearchCriteria, "service">;

export function collectWorkshopOffersMatchingAnySelected(
  workshopServices: WorkshopServiceOffer[],
  criteria: CriteriaNoService,
  selectedNames: string[],
): WorkshopServiceOffer[] {
  if (selectedNames.length === 0) {
    return matchWorkshopServicesForVehicle(workshopServices, { ...criteria, service: "" });
  }
  const seen = new Set<string>();
  const out: WorkshopServiceOffer[] = [];
  for (const name of selectedNames) {
    const chunk = matchWorkshopServicesForVehicle(workshopServices, { ...criteria, service: name });
    for (const row of chunk) {
      const key = `${row.service_name}\u0000${row.brand}\u0000${row.model}\u0000${row.engine}\u0000${row.year_from}\u0000${row.year_to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

export function getMatchedAndMissingServices(
  workshopServices: WorkshopServiceOffer[],
  criteria: CriteriaNoService,
  selectedItems: SelectedServiceItem[],
): WorkshopServiceMatchResult {
  const selectedCount = selectedItems.length;
  if (selectedCount === 0) {
    return {
      selectedCount: 0,
      matchedCount: 0,
      score: 0,
      matchedServices: [],
      missingServices: [],
      isFullMatch: false,
    };
  }
  const matched: SelectedServiceItem[] = [];
  for (const item of selectedItems) {
    const m = matchWorkshopServicesForVehicle(workshopServices, { ...criteria, service: item.name });
    if (m.length > 0) matched.push(item);
  }
  const matchedIds = new Set(matched.map((m) => m.id));
  const missing = selectedItems.filter((s) => !matchedIds.has(s.id));
  const matchedCount = matched.length;
  return {
    selectedCount,
    matchedCount,
    score: matchedCount / selectedCount,
    matchedServices: matched,
    missingServices: missing,
    isFullMatch: matchedCount === selectedCount,
  };
}

export function calculateWorkshopMatch(
  workshopServices: WorkshopServiceOffer[],
  criteria: CriteriaNoService,
  selectedItems: SelectedServiceItem[],
): WorkshopServiceMatchResult {
  const catalogOnly = getCatalogSelectedItems(selectedItems);
  if (catalogOnly.length === 0) {
    if (selectedItems.length === 0) {
      return {
        selectedCount: 0,
        matchedCount: 0,
        score: 0,
        matchedServices: [],
        missingServices: [],
        isFullMatch: false,
      };
    }
    /* Tylko wpisy własne — nie zeruj listy warsztatów; dopasowanie katalogowe w tym trybie nie ma sensu. */
    return {
      selectedCount: 0,
      matchedCount: 0,
      score: 1,
      matchedServices: [],
      missingServices: [],
      isFullMatch: true,
    };
  }
  return getMatchedAndMissingServices(workshopServices, criteria, catalogOnly);
}

const LS_KEY = "servygo-selected-services-v1";

export function persistSelectedServicesToSession(items: SelectedServiceItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function readSelectedServicesFromSession(): SelectedServiceItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(LS_KEY);
    if (!raw) return [];
    return normalizeSelectedServices(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function resolveBookingDurationAndRoles(
  workshopServices: WorkshopServiceOffer[],
  criteria: CriteriaNoService,
  selectedNames: string[],
): { durationMinutes: number; requiredRoles: string[]; primaryServiceId: string | null; firstMatchedName: string | null } {
  if (selectedNames.length === 0) {
    return { durationMinutes: 60, requiredRoles: [], primaryServiceId: null, firstMatchedName: null };
  }
  let total = 0;
  const roles = new Set<string>();
  let primaryServiceId: string | null = null;
  let firstMatchedName: string | null = null;
  for (const name of selectedNames) {
    const matches = matchWorkshopServicesForVehicle(workshopServices, { ...criteria, service: name });
    const pick = matches[0];
    if (!pick) continue;
    if (!firstMatchedName) firstMatchedName = pick.service_name;
    if (!primaryServiceId && pick.id) primaryServiceId = String(pick.id);
    total += pick.duration_minutes ?? 60;
    for (const r of pick.required_roles ?? []) {
      roles.add(String(r));
    }
  }
  return {
    durationMinutes: Math.max(60, total),
    requiredRoles: Array.from(roles),
    primaryServiceId,
    firstMatchedName,
  };
}
