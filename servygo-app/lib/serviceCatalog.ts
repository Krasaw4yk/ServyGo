import type { VehicleTypeKey } from "@/lib/vehicleData";
import {
  classifyServiceCategory,
  SERVICE_MAIN_CATEGORIES,
  slugifyServiceKey,
  type ServiceMainCategory,
} from "@/lib/serviceCategoryClassifier";

export type ServiceLeaf = {
  name: string;
};

export type ServiceSubcategory = {
  name: string;
  services: ServiceLeaf[];
};

export type ServiceCategory = {
  name: string;
  subcategories: ServiceSubcategory[];
};

function createCategory(name: string, subcategories: Array<{ name: string; services: string[] }>): ServiceCategory {
  return {
    name,
    subcategories: subcategories.map((subcategory) => ({
      name: subcategory.name,
      services: subcategory.services.map((serviceName) => ({ name: serviceName })),
    })),
  };
}

/**
 * Kolejność kategorii głównych wg listy `usługi.txt` (22 tematy osobowe) oraz na końcu dodatki moto/van.
 */
export const SERVICE_CATALOG_MAIN_ORDER: readonly string[] = [
  "Kontrole i przeglądy okresowe",
  "Olej i filtry",
  "Opony i koła",
  "Hamulce",
  "Diagnostyka",
  "Silnik",
  "Elektryka pojazdu",
  "Akumulator i rozruch",
  "Klimatyzacja",
  "Zawieszenie",
  "Układ kierowniczy",
  "Skrzynia biegów i napęd",
  "Układ wydechowy",
  "Płyny eksploatacyjne",
  "Przeglądy flotowe i kontrole układów",
  "Auto przed zakupem",
  "Blacharstwo i lakiernictwo",
  "Szyby i widoczność",
  "Oświetlenie",
  "Objawy i pomoc drogowa",
  "Turbo i doładowanie",
  "Serwis hybryd i elektryków",
  "Motocykl - serwis",
  "Dostawczy - serwis flotowy",
] as const;

const baseCatalog: ServiceCategory[] = [
  createCategory("Kontrole i przeglądy okresowe", [
    {
      name: "Kontrole sezonowe",
      services: [
        "Przegląd podstawowy auta",
        "Kontrola auta przed trasą",
        "Kontrola auta przed zimą",
        "Kontrola auta przed wakacjami",
        "Kontrola auta po długim postoju",
      ],
    },
    {
      name: "Przeglądy techniczne",
      services: [
        "Przegląd okresowy",
        "Przygotowanie auta do przeglądu (ITV)",
        "Kontrola układów bezpieczeństwa",
        "Sprawdzenie stanu opon",
        "Kontrola stanu technicznego",
        "Przegląd przed dłuższą trasą",
        "Przegląd auta przed wakacjami",
        "Przegląd auta przed zimą",
      ],
    },
    {
      name: "Kontrola stanu eksploatacyjnego",
      services: [
        "Sprawdzenie luzów zawieszenia",
        "Sprawdzenie układu kierowniczego",
        "Sprawdzenie układu hamulcowego",
        "Sprawdzenie poziomu wszystkich płynów",
      ],
    },
  ]),
  createCategory("Olej i filtry", [
    {
      name: "Wymiany okresowe",
      services: [
        "Wymiana oleju",
        "Wymiana filtra oleju",
        "Wymiana filtra powietrza",
        "Wymiana filtra kabinowego",
        "Wymiana filtra paliwa",
        "Kompleksowa wymiana oleju i wszystkich filtrów",
      ],
    },
    {
      name: "Filtry dodatkowe",
      services: ["Wymiana filtra LPG/CNG", "Wymiana filtra DPF/FAP (elementu wymienialnego)"],
    },
    {
      name: "Czyszczenie",
      services: ["Czyszczenie filtra DPF/EGR", "Płukanie układu olejowego", "Czyszczenie układu dolotowego"],
    },
  ]),
  createCategory("Opony i koła", [
    {
      name: "Serwis opon",
      services: [
        "Wymiana opon (komplet)",
        "Wymiana opon run-flat",
        "Wyważanie kół",
        "Naprawa opony",
        "Wulkanizacja",
        "Przechowywanie opon",
        "Wymiana wentyla",
      ],
    },
    {
      name: "Felgi i geometria",
      services: [
        "Prostowanie felgi",
        "Regeneracja felg",
        "Malowanie felg",
        "Geometria kół",
        "Zbieżność kół",
        "Ustawienie geometrii 3D",
      ],
    },
    {
      name: "Koła kompletne",
      services: ["Montaż/demontaż kół", "Wymiana kół na felgach aluminiowych/stalowych"],
    },
  ]),
  createCategory("Hamulce", [
    {
      name: "Wymiany elementów",
      services: [
        "Wymiana klocków hamulcowych (przednie/tylne)",
        "Wymiana tarcz hamulcowych (przednie/tylne)",
        "Wymiana klocków i tarcz hamulcowych",
        "Wymiana bębnów i szczęk",
        "Wymiana szczęk hamulca ręcznego",
      ],
    },
    {
      name: "Obsługa i naprawy",
      services: [
        "Wymiana płynu hamulcowego",
        "Odpowietrzanie układu hamulcowego",
        "Regeneracja zacisku hamulcowego",
        "Naprawa hamulca ręcznego",
        "Wymiana przewodów hamulcowych",
        "Wymiana cylinderków hamulcowych",
      ],
    },
    {
      name: "Diagnostyka hamulców",
      services: ["Kontrola układu hamulcowego", "Diagnostyka ABS/ESP", "Diagnostyka zużycia tarcz i klocków"],
    },
  ]),
  createCategory("Diagnostyka", [
    {
      name: "Diagnostyka komputerowa",
      services: [
        "Odczyt błędów",
        "Kasowanie błędów",
        "Diagnostyka kontrolki check engine",
        "Diagnostyka komputerowa pełna",
        "Diagnostyka systemów ABS/ESP/SRS",
        "Diagnostyka DPF/EGR",
      ],
    },
    {
      name: "Diagnostyka specjalistyczna",
      services: [
        "Diagnostyka silnika (kompresja, zapłon)",
        "Diagnostyka układu paliwowego",
        "Diagnostyka układu chłodzenia",
        "Diagnostyka układu ładowania",
        "Diagnostyka układu start-stop",
        "Diagnostyka elektryczna",
        "Diagnostyka problemów z odpalaniem",
      ],
    },
  ]),
  createCategory("Silnik", [
    {
      name: "Naprawy główne",
      services: [
        "Naprawa/rewizja silnika",
        "Wymiana rozrządu (pasek/łańcuch)",
        "Wymiana uszczelki pod głowicą",
        "Wymiana pierścieni",
        "Szlifowanie wału korbowego",
        "Wymiana panewek",
        "Wymiana pompy oleju",
      ],
    },
    {
      name: "Układ spalania",
      services: [
        "Wymiana świec zapłonowych",
        "Wymiana świec żarowych",
        "Wymiana cewek zapłonowych",
        "Regulacja zaworów",
        "Wymiana kabli zapłonowych",
      ],
    },
    {
      name: "Czyszczenie układów",
      services: [
        "Czyszczenie przepustnicy",
        "Czyszczenie zaworu EGR",
        "Czyszczenie wtryskiwaczy",
        "Dekarbonizacja silnika (hydrogenizacja)",
      ],
    },
    {
      name: "Chłodzenie",
      services: [
        "Wymiana chłodnicy",
        "Wymiana termostatu",
        "Wymiana pompy wody",
        "Sprawdzenie szczelności układu chłodzenia",
        "Płukanie układu chłodzenia",
      ],
    },
  ]),
  createCategory("Elektryka pojazdu", [
    {
      name: "Instalacja i osprzęt",
      services: [
        "Naprawa instalacji elektrycznej",
        "Wymiana alternatora",
        "Naprawa alternatora",
        "Wymiana rozrusznika",
        "Naprawa rozrusznika",
        "Wymiana regulatora napięcia",
      ],
    },
    {
      name: "Komfort i czujniki",
      services: [
        "Naprawa centralnego zamka",
        "Naprawa elektrycznych szyb/luster",
        "Naprawa czujników parkowania",
        "Wymiana czujnika temperatury",
        "Wymiana czujnika ABS",
        "Wymiana czujnika poziomu paliwa",
        "Wymiana czujnika położenia wału",
        "Naprawa czujnika deszczu i zmierzchu",
      ],
    },
    {
      name: "Elektronika i kodowanie",
      services: [
        "Kodowanie kluczy",
        "Programowanie sterowników",
        "Aktualizacja oprogramowania ECU",
        "Adaptacja przepustnicy",
        "Programowanie modułów komfortu",
        "Kodowanie modułu start-stop",
        "Kalibracja kamer i radarów",
        "Naprawa immobilizera",
      ],
    },
  ]),
  createCategory("Akumulator i rozruch", [
    {
      name: "Akumulator",
      services: [
        "Wymiana akumulatora",
        "Sprawdzenie akumulatora",
        "Ładowanie akumulatora",
        "Test obciążeniowy akumulatora",
        "Regeneracja akumulatora",
        "Montaż akumulatora AGM/EFB",
      ],
    },
    {
      name: "Problemy z odpalaniem",
      services: [
        "Sprawdzenie świec żarowych",
        "Sprawdzenie rozrusznika",
        "Sprawdzenie układu start-stop",
      ],
    },
  ]),
  createCategory("Klimatyzacja", [
    {
      name: "Serwis klimatyzacji",
      services: [
        "Nabijanie klimatyzacji",
        "Odgrzybianie klimatyzacji",
        "Ozonowanie klimatyzacji",
        "Diagnostyka klimatyzacji",
        "Sprawdzenie szczelności klimatyzacji",
        "Naprawa klimatyzacji",
        "Wymiana filtra kabinowego",
        "Wymiana zaworu rozprężnego",
        "Wymiana czujnika ciśnienia",
      ],
    },
    {
      name: "Naprawy układu A/C",
      services: [
        "Wymiana kompresora klimatyzacji",
        "Wymiana skraplacza (chłodnica klimatyzacji)",
        "Wymiana parownika",
        "Wymiana osuszacza",
        "Wymiana przewodów klimatyzacji",
        "Regeneracja kompresora",
      ],
    },
    {
      name: "Ogrzewanie i wentylacja",
      services: [
        "Naprawa nagrzewnicy",
        "Wymiana rezystora dmuchawy",
        "Naprawa dmuchawy",
        "Czyszczenie kanałów wentylacyjnych",
      ],
    },
  ]),
  createCategory("Zawieszenie", [
    {
      name: "Elementy zawieszenia",
      services: [
        "Wymiana amortyzatorów",
        "Wymiana sprężyn",
        "Wymiana wahacza",
        "Wymiana tulei wahacza",
        "Wymiana łącznika stabilizatora",
        "Wymiana sworznia wahacza",
        "Wymiana poduszek amortyzatora",
        "Wymiana łożysk amortyzatora",
        "Wymiana drążka reakcyjnego",
      ],
    },
    {
      name: "Diagnostyka zawieszenia",
      services: [
        "Diagnostyka zawieszenia",
        "Diagnostyka amortyzatorów",
        "Diagnostyka zużycia tulei",
        "Test siłowników zawieszenia (hydropneumatyka)",
      ],
    },
  ]),
  createCategory("Układ kierowniczy", [
    {
      name: "Naprawy i ustawienia",
      services: [
        "Wymiana drążka kierowniczego",
        "Wymiana końcówki drążka",
        "Wymiana przekładni kierowniczej (maglownicy)",
        "Regeneracja maglownicy",
        "Naprawa wspomagania kierownicy",
        "Naprawa pompy wspomagania",
        "Ustawienie zbieżności",
        "Regulacja luzów przekładni",
        "Diagnostyka układu kierowniczego",
      ],
    },
  ]),
  createCategory("Skrzynia biegów i napęd", [
    {
      name: "Obsługa i naprawy skrzyni",
      services: [
        "Wymiana oleju w skrzyni biegów (manual/automat)",
        "Diagnostyka skrzyni biegów",
        "Naprawa skrzyni manualnej",
        "Naprawa skrzyni automatycznej",
        "Regeneracja konwertera",
        "Wymiana sprzęgła hydrokinetycznego",
        "Wymiana uszczelniacza półosi",
        "Aktualizacja oprogramowania skrzyni biegów",
      ],
    },
    {
      name: "Napęd i sprzęgło",
      services: [
        "Wymiana sprzęgła",
        "Wymiana dwumasowego koła zamachowego",
        "Wymiana wysprzęglika",
        "Naprawa sprzęgła",
        "Naprawa mechanizmu różnicowego",
        "Wymiana półosi",
        "Wymiana przegubów",
        "Wymiana podpory wału napędowego",
        "Wymiana wału napędowego",
      ],
    },
  ]),
  createCategory("Układ wydechowy", [
    {
      name: "Naprawy wydechu",
      services: [
        "Naprawa układu wydechowego",
        "Wymiana tłumika",
        "Spawanie tłumika",
        "Wymiana katalizatora",
        "Regeneracja katalizatora",
        "Wymiana sondy lambda",
        "Regeneracja sondy lambda",
        "Usuwanie nieszczelności wydechu",
        "Wymiana elastycznego łącznika",
      ],
    },
    {
      name: "Systemy oczyszczania spalin",
      services: [
        "Diagnostyka DPF/FAP",
        "Czyszczenie DPF",
        "Wymiana DPF",
        "Regeneracja DPF",
        "Diagnostyka EGR",
        "Czyszczenie zaworu EGR",
        "Wymiana EGR",
        "Diagnostyka układu AdBlue",
        "Wymiana pompy AdBlue",
        "Wymiana zbiornika AdBlue",
        "Wymiana wtryskiwacza AdBlue",
        "Wymiana filtra AdBlue",
        "Uzupełnienie AdBlue",
        "Programowanie systemu AdBlue",
        "Diagnostyka i regeneracja DPF/FAP",
      ],
    },
  ]),
  createCategory("Płyny eksploatacyjne", [
    {
      name: "Wymiany i uzupełnianie",
      services: [
        "Wymiana płynu chłodniczego",
        "Wymiana płynu hamulcowego",
        "Wymiana płynu wspomagania",
        "Wymiana płynu do spryskiwaczy",
        "Wymiana oleju w przekładni kierowniczej",
        "Sprawdzenie/uzupełnienie płynów eksploatacyjnych",
      ],
    },
  ]),
  createCategory("Przeglądy flotowe i kontrole układów", [
    {
      name: "Przeglądy flotowe",
      services: [
        "Przegląd floty pojazdów",
        "Przegląd ciężarówek",
        "Przegląd busów",
        "Kontrola urządzeń tachografu",
        "Kontrola stanu opon całej floty",
      ],
    },
    {
      name: "Kontrole układów",
      services: [
        "Kontrola układu hamulcowego",
        "Kontrola układu kierowniczego",
        "Kontrola układu zawieszenia",
        "Kontrola układu wydechowego",
        "Kontrola systemów bezpieczeństwa",
      ],
    },
  ]),
  createCategory("Auto przed zakupem", [
    {
      name: "Weryfikacja przed zakupem",
      services: [
        "Sprawdzenie auta przed zakupem",
        "Diagnostyka komputerowa przed zakupem",
        "Kontrola lakieru i nadwozia",
        "Kontrola zawieszenia",
        "Kontrola silnika i skrzyni biegów",
        "Oględziny karoserii",
        "Jazda próbna z mechanikiem",
        "Sprawdzenie stanu akumulatora",
        "Weryfikacja historii serwisowej",
      ],
    },
  ]),
  createCategory("Blacharstwo i lakiernictwo", [
    {
      name: "Naprawy karoserii",
      services: [
        "Naprawa blacharska",
        "Naprawa zderzaka",
        "Spawanie elementów karoserii",
        "Wymiana progów",
        "Wymiana błotnika",
        "Naprawa skorodowanej karoserii",
      ],
    },
    {
      name: "Lakierowanie",
      services: [
        "Lakierowanie elementu",
        "Całkowite lakierowanie nadwozia",
        "Lakierowanie plastików",
        "Lakierowanie zderzaka",
        "Lakierowanie felg",
        "Lakierowanie klamek",
      ],
    },
    {
      name: "Usuwanie uszkodzeń",
      services: [
        "Usuwanie wgniotek (PDR)",
        "Usuwanie rys i zadrapań",
        "Polerowanie lakieru",
        "Renowacja lakieru",
        "Usuwanie odprysków",
      ],
    },
    {
      name: "Detailing",
      services: [
        "Pełny detailing zewnętrzny",
        "Detailing wnętrza",
        "Ceramiczne zabezpieczenie lakieru",
        "Powłoka kwarcowa",
        "Pranie tapicerki",
        "Impregnacja skóry",
      ],
    },
  ]),
  createCategory("Szyby i widoczność", [
    {
      name: "Szyby, wycieraczki i osłony",
      services: [
        "Wymiana przedniej szyby",
        "Wymiana tylnej szyby",
        "Wymiana szyb bocznych",
        "Naprawa odprysku szyby",
        "Regeneracja reflektorów",
        "Przyciemnianie szyb",
        "Montaż osłon przeciwsłonecznych",
        "Naprawa mechanizmu szyb",
        "Wymiana wycieraczek",
        "Naprawa spryskiwaczy",
        "Wymiana pompki spryskiwaczy",
        "Demontaż i montaż uszczelek",
      ],
    },
  ]),
  createCategory("Oświetlenie", [
    {
      name: "Oświetlenie",
      services: [
        "Wymiana żarówki (halogen, LED, xenon)",
        "Wymiana lampy reflektora",
        "Wymiana lampy tylnej",
        "Naprawa lampy",
        "Regeneracja odbłyśników",
        "Regulacja świateł",
        "Montaż lamp dodatkowych (światła do jazdy dziennej)",
        "Kodowanie świateł LED",
        "Polerowanie kloszy lamp",
      ],
    },
  ]),
  createCategory("Objawy i pomoc drogowa", [
    {
      name: "Objawy",
      services: [
        "Auto nie odpala",
        "Auto gaśnie",
        "Auto szarpie",
        "Auto traci moc",
        "Auto nierówno pracuje",
        "Auto się przegrzewa",
        "Coś stuka",
        "Coś piszczy",
        "Wycieka płyn",
        "Pali się kontrolka",
        "Auto dymi",
        "Auto wydziela zapach spalenizny",
        "Nie wiem, co się dzieje",
      ],
    },
    {
      name: "Pomoc drogowa",
      services: [
        "Awaryjne uruchomienie pojazdu",
        "Wymiana koła w trasie",
        "Holowanie",
        "Dowóz paliwa",
        "Transport lawetą",
        "Zabezpieczenie miejsca wypadku",
      ],
    },
  ]),
  createCategory("Turbo i doładowanie", [
    {
      name: "Turbo i doładowanie",
      services: [
        "Diagnostyka turbo",
        "Regeneracja turbosprężarki",
        "Wymiana turbosprężarki",
        "Czyszczenie turbiny",
        "Wymiana zaworu upustowego (wastegate)",
        "Wymiana intercoolera",
        "Diagnostyka i naprawa kompresora mechanicznego",
      ],
    },
  ]),
  createCategory("Serwis hybryd i elektryków", [
    {
      name: "Serwis pojazdów hybrydowych",
      services: [
        "Diagnostyka układu hybrydowego",
        "Diagnostyka systemów hybrydowych/elektrycznych",
        "Diagnostyka i naprawa inwertera",
        "Wymiana pakietu akumulatorów wysokonapięciowych",
        "Kalibracja układu hybrydowego",
        "Regeneracja baterii hybrydowej",
        "Wymiana wentylatora baterii",
        "Bezpieczeństwo HV",
      ],
    },
    {
      name: "Serwis pojazdów elektrycznych",
      services: [
        "Diagnostyka układu napędowego EV",
        "Diagnostyka ładowarki pokładowej",
        "Wymiana gniazda ładowania",
        "Wymiana pakietu baterii",
        "Diagnostyka systemu chłodzenia baterii",
        "Kalibracja systemu odzyskiwania energii",
        "Naprawa układu HV",
        "Obsługa systemów rekuperacyjnych",
      ],
    },
  ]),
];

const motorcycleExtras = createCategory("Motocykl - serwis", [
  {
    name: "Obsługa motocykla",
    services: [
      "Serwis łańcucha i napędu",
      "Regulacja luzów zaworowych motocykla",
      "Wymiana opon motocyklowych",
      "Przygotowanie motocykla do sezonu",
    ],
  },
]);

const vanExtras = createCategory("Dostawczy - serwis flotowy", [
  {
    name: "Obsługa flotowa",
    services: [
      "Serwis floty pojazdów",
      "Przegląd auta dostawczego przed trasą",
      "Diagnostyka auta dostawczego",
      "Serwis DPF auta dostawczego",
    ],
  },
]);

function collectLeafNamesFromCategories(categories: ServiceCategory[]): string[] {
  const names: string[] = [];
  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      for (const leaf of sub.services) {
        const t = leaf.name.trim();
        if (t) names.push(t);
      }
    }
  }
  return names;
}

/** Sortowanie etykiet katalogu (kategorie, podkategorie, usługi) — alfabet polski. */
export function comparePolishServiceLabel(a: string, b: string): number {
  return a.localeCompare(b, "pl", { sensitivity: "base" });
}

function sortServiceCatalogTree(categories: ServiceCategory[]): ServiceCategory[] {
  return [...categories]
    .sort((a, b) => comparePolishServiceLabel(a.name, b.name))
    .map((category) => ({
      ...category,
      subcategories: [...category.subcategories]
        .sort((a, b) => comparePolishServiceLabel(a.name, b.name))
        .map((subcategory) => ({
          ...subcategory,
          services: [...subcategory.services].sort((a, b) =>
            comparePolishServiceLabel(a.name, b.name),
          ),
        })),
    }));
}

export function getServiceCatalogByVehicleType(vehicleType: string): ServiceCategory[] {
  const normalizedType = vehicleType as VehicleTypeKey;
  if (normalizedType === "motorcycle") {
    return sortServiceCatalogTree([...baseCatalog, motorcycleExtras]);
  }
  if (normalizedType === "van") {
    return sortServiceCatalogTree([...baseCatalog, vanExtras]);
  }
  return sortServiceCatalogTree([...baseCatalog]);
}

function normalizeCatalogServiceNameKey(name: string) {
  return name.trim().toLocaleLowerCase("pl");
}

let catalogLeafKeyToMainCategoryCache: Map<string, string> | null = null;

function getCatalogLeafKeyToMainCategoryMap(): Map<string, string> {
  if (catalogLeafKeyToMainCategoryCache) return catalogLeafKeyToMainCategoryCache;
  const m = new Map<string, string>();
  for (const vt of ["car", "motorcycle", "van"] as VehicleTypeKey[]) {
    for (const cat of getServiceCatalogByVehicleType(vt)) {
      for (const sub of cat.subcategories) {
        for (const leaf of sub.services) {
          const k = normalizeCatalogServiceNameKey(leaf.name);
          if (k && !m.has(k)) m.set(k, cat.name);
        }
      }
    }
  }
  catalogLeafKeyToMainCategoryCache = m;
  return m;
}

/** Główna kategoria z drzewa katalogu (wszystkie typy pojazdu) dla nazwy liścia. */
export function getCatalogMainCategoryForService(serviceName: string): string | null {
  const target = normalizeCatalogServiceNameKey(serviceName);
  if (!target) return null;
  return getCatalogLeafKeyToMainCategoryMap().get(target) ?? null;
}

/** Główne kategorie (jak w katalogu), alfabetycznie (pl); na końcu „Inne”. */
const WORKSHOP_MAIN_CATEGORY_NAMES_ALPHA = [...SERVICE_CATALOG_MAIN_ORDER].sort(comparePolishServiceLabel);

/** Kategorie w `<select>` panelu warsztatu — alfabetycznie + „Inne”. */
export const WORKSHOP_SERVICE_CATEGORY_OPTIONS: readonly string[] = [...WORKSHOP_MAIN_CATEGORY_NAMES_ALPHA, "Inne"];

const WORKSHOP_MAIN_CATEGORY_ALPHA_INDEX = new Map(
  WORKSHOP_MAIN_CATEGORY_NAMES_ALPHA.map((name, idx) => [name, idx]),
);

const WORKSHOP_SERVICE_CATEGORY_OPTION_SET = new Set(WORKSHOP_SERVICE_CATEGORY_OPTIONS);

/**
 * Stare 13 kategorii z `classifyServiceCategory` → nazwy z katalogu (migracja zapisanych danych / UI).
 */
const LEGACY_CLASSIFIER_CATEGORY_TO_WORKSHOP: Record<string, string> = {
  "Serwis okresowy": "Kontrole i przeglądy okresowe",
  Diagnostyka: "Diagnostyka",
  Hamulce: "Hamulce",
  Elektryka: "Elektryka pojazdu",
  Zawieszenie: "Zawieszenie",
  Silnik: "Silnik",
  "Skrzynia biegów": "Skrzynia biegów i napęd",
  Klimatyzacja: "Klimatyzacja",
  "Opony i koła": "Opony i koła",
  "Układ wydechowy": "Układ wydechowy",
  Nadwozie: "Blacharstwo i lakiernictwo",
  Motocykl: "Motocykl - serwis",
  Inne: "Inne",
};

/**
 * Efektywna kategoria usługi w warsztacie: ręczna, albo z drzewa katalogu, albo migracja ze starej listy / „Inne”.
 */
export function resolveWorkshopServiceCategory(
  serviceName: string,
  storedCategory: string,
  categoryManual: boolean,
): string {
  const cat = storedCategory?.trim() ?? "";
  if (categoryManual && cat) return cat;
  const fromTree = getCatalogMainCategoryForService(serviceName);
  if (fromTree) return fromTree;
  if (cat && WORKSHOP_SERVICE_CATEGORY_OPTION_SET.has(cat)) return cat;
  if (cat && LEGACY_CLASSIFIER_CATEGORY_TO_WORKSHOP[cat]) return LEGACY_CLASSIFIER_CATEGORY_TO_WORKSHOP[cat]!;
  const inferred = classifyServiceCategory(serviceName).category;
  return LEGACY_CLASSIFIER_CATEGORY_TO_WORKSHOP[inferred] ?? "Inne";
}

export function isWorkshopServiceCategoryOption(value: string): boolean {
  return WORKSHOP_SERVICE_CATEGORY_OPTION_SET.has(value);
}

export function workshopServiceCategorySortIndex(name: string): number {
  if (name === "Inne") return WORKSHOP_MAIN_CATEGORY_NAMES_ALPHA.length;
  const idx = WORKSHOP_MAIN_CATEGORY_ALPHA_INDEX.get(name);
  if (idx !== undefined) return idx;
  return WORKSHOP_MAIN_CATEGORY_NAMES_ALPHA.length;
}

let allCatalogServiceLeafNamesCache: string[] | null = null;

/** Wszystkie nazwy usług z katalogu (samochód + motocykl + dostawczy), bez duplikatów — jedno źródło dla panelu warsztatu. */
export function getAllCatalogServiceLeafNames(): string[] {
  if (allCatalogServiceLeafNamesCache) return allCatalogServiceLeafNamesCache;
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (name: string) => {
    const trimmed = name.trim();
    const k = trimmed.toLocaleLowerCase("pl");
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(trimmed);
  };
  for (const vt of ["car", "motorcycle", "van"] as VehicleTypeKey[]) {
    for (const n of collectLeafNamesFromCategories(getServiceCatalogByVehicleType(vt))) {
      add(n);
    }
  }
  out.sort((a, b) => a.localeCompare(b, "pl", { sensitivity: "base" }));
  allCatalogServiceLeafNamesCache = out;
  return out;
}

export type WorkshopServiceCatalogFlatRow = {
  key: string;
  name: string;
  category: string;
};

/**
 * Ta sama płaska lista liści co `getAllCatalogServiceLeafNames()`, zbudowana przez drzewo
 * `getServiceCatalogByVehicleType` (osobówka + motocykl + dostawczy) — dla panelu warsztatu.
 */
let workshopServiceCatalogFlatRowsCache: WorkshopServiceCatalogFlatRow[] | null = null;

export function getWorkshopServiceCatalogFlatRows(): WorkshopServiceCatalogFlatRow[] {
  if (workshopServiceCatalogFlatRowsCache) return workshopServiceCatalogFlatRowsCache;
  const seen = new Set<string>();
  const names: string[] = [];
  const addName = (name: string) => {
    const trimmed = name.trim();
    const k = trimmed.toLocaleLowerCase("pl");
    if (!k || seen.has(k)) return;
    seen.add(k);
    names.push(trimmed);
  };
  for (const vt of ["car", "motorcycle", "van"] as VehicleTypeKey[]) {
    for (const cat of getServiceCatalogByVehicleType(vt)) {
      for (const sub of cat.subcategories) {
        for (const leaf of sub.services) {
          addName(leaf.name);
        }
      }
    }
  }
  names.sort((a, b) => a.localeCompare(b, "pl", { sensitivity: "base" }));
  workshopServiceCatalogFlatRowsCache = names.map((name) => ({
    key: slugifyServiceKey(name),
    name,
    category: resolveWorkshopServiceCategory(name, "", false),
  }));
  return workshopServiceCatalogFlatRowsCache;
}

/**
 * Katalog usług pogrupowany wg głównych kategorii (klasyfikacja po słowach kluczowych —
 * bez AI), kolejność kategorii stała jak w `SERVICE_MAIN_CATEGORIES`.
 */
export function getServiceCatalogGroupedByMainCategory(vehicleType: string): ServiceCategory[] {
  const flat = getServiceCatalogByVehicleType(vehicleType);
  const dedupByLower = new Map<string, ServiceLeaf>();

  for (const cat of flat) {
    for (const sub of cat.subcategories) {
      for (const svc of sub.services) {
        const trimmed = svc.name.trim();
        if (!trimmed) continue;
        const lk = trimmed.toLocaleLowerCase("pl");
        if (!dedupByLower.has(lk)) dedupByLower.set(lk, { name: trimmed });
      }
    }
  }

  const byMain = new Map<ServiceMainCategory, ServiceLeaf[]>();
  const other: ServiceLeaf[] = [];

  for (const main of SERVICE_MAIN_CATEGORIES) {
    if (main !== "Inne") byMain.set(main, []);
  }

  for (const leaf of dedupByLower.values()) {
    const { category } = classifyServiceCategory(leaf.name);
    if (category !== "Inne") {
      byMain.get(category)?.push(leaf);
    } else {
      other.push(leaf);
    }
  }

  const plSort = (a: ServiceLeaf, b: ServiceLeaf) => a.name.localeCompare(b.name, "pl", { sensitivity: "base" });
  const out: ServiceCategory[] = [];

  for (const main of SERVICE_MAIN_CATEGORIES) {
    if (main === "Inne") continue;
    const list = byMain.get(main) ?? [];
    if (list.length === 0) continue;
    list.sort(plSort);
    out.push({
      name: main,
      subcategories: [{ name: "Wszystkie usługi", services: list }],
    });
  }

  other.sort(plSort);
  if (other.length > 0) {
    out.push({
      name: "Inne",
      subcategories: [{ name: "Wszystkie usługi", services: other }],
    });
  }

  return out;
}
