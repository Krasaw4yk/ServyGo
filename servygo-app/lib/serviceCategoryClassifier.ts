/** Główne kategorie usług (ustalona lista produktowa — musi być spójna w całej aplikacji). */
export const SERVICE_MAIN_CATEGORIES = [
  "Serwis okresowy",
  "Diagnostyka",
  "Hamulce",
  "Elektryka",
  "Zawieszenie",
  "Silnik",
  "Skrzynia biegów",
  "Klimatyzacja",
  "Opony i koła",
  "Układ wydechowy",
  "Nadwozie",
  "Motocykl",
  "Inne",
] as const;

export type ServiceMainCategory = (typeof SERVICE_MAIN_CATEGORIES)[number];

/** Kolejność tie-break przy takim samym wyniku punktowym (bardziej „wiodące” kategorie wcześniej). */
const SCORE_TIEBREAK_ORDER: ServiceMainCategory[] = [
  "Diagnostyka",
  "Hamulce",
  "Elektryka",
  "Skrzynia biegów",
  "Silnik",
  "Serwis okresowy",
  "Klimatyzacja",
  "Opony i koła",
  "Zawieszenie",
  "Układ wydechowy",
  "Nadwozie",
  "Motocykl",
  "Inne",
];

const KEYWORDS: Record<ServiceMainCategory, string[]> = {
  "Serwis okresowy": [
    "serwis okresowy",
    "przegląd okresowy",
    "przeglad okresowy",
    "wymiana oleju",
    "oleju i filtrów",
    "olej i filtr",
    "wymiana oleju i",
    "olej silnikowy",
    "filtr oleju",
    "filtra oleju",
    "filtr olejowy",
    "filtr powietrza",
    "filtra powietrza",
    "filtr kabinowy",
    "filtra kabinowy",
    "filtr paliwa",
    "filtra paliwa",
    "wymiana płynów",
    "wymiana plynów",
    "wymiana plynów",
    "płyn eksploatacyjny",
    "plyn eksploatacyjny",
    "uzupełnienie płynów",
    "płynów eksploatacyjnych",
    "przegląd",
    "przegląd okresowy auta",
    "kontrola auta przed",
  ],
  Diagnostyka: [
    "diagnostyka",
    "komputerowa",
    "tester obd",
    "obd",
    "check engine",
    "blędów",
    "bledów",
    "kasowanie błędów",
    "kasowanie bledów",
    "kasowanie kodów",
    "odczyt błędów",
    "odczyt bledów",
    "kontrolka",
    "świeci kontrolka",
    "swieci kontrolka",
    "tester",
    "skaner",
  ],
  Hamulce: [
    "hamulec",
    "hamulce",
    "hamulc",
    "klocki",
    "klocków hamulcowych",
    "klockow hamulcowych",
    "tarcz hamulcowych",
    "tarcze hamulcowe",
    "płyn hamulcowy",
    "plyn hamulcowy",
    "hamulcowy",
    "zacisk",
    "zaciski",
    "przewody hamulcowe",
    "układ hamulcowy",
    "uklad hamulcowy",
    "abs",
    "hamulec ręczny",
    "hamulec reczny",
    "regeneracja zacisku",
  ],
  Elektryka: [
    "akumulator",
    "alternator",
    "rozrusznik",
    "bezpiecznik",
    "bezpieczniki",
    "światła",
    "swiatla",
    "żarów",
    "zarow",
    "czujnik",
    "czujniki",
    "instalacja elektryczna",
    "elektryka",
    "moduł",
    "modul",
    "ładowanie",
    "ladowanie",
    "ładowarka",
    "instalacja",
    "naprawa instalacji",
    "centralny zamek",
    "sonda lambda",
  ],
  Zawieszenie: [
    "zawieszenie",
    "amortyzator",
    "amortyzatory",
    "sprężyn",
    "sprezyn",
    "wahacz",
    "wahacza",
    "tulej",
    "łącznik stabilizatora",
    "lacznik stabilizatora",
    "stabilizator",
    "sworzeń",
    "sworzen",
  ],
  Silnik: [
    "silnik",
    "rozrząd",
    "rozrzad",
    "pasek rozrządu",
    "łańcuch rozrządu",
    "łańcuch",
    "lancuch",
    "uszczelka pod głowicą",
    "uszczelka pod glowica",
    "turbo",
    "turbina",
    "wtrysk",
    "wtryskiwacz",
    "wtryskiwacze",
    "świec",
    "swiec",
    "egr",
    "dpf",
    "uszczelka",
    "naprawa silnika",
  ],
  "Skrzynia biegów": [
    "skrzyni",
    "skrzynia",
    "biegów",
    "biegow",
    "sprzęgło",
    "sprzeglo",
    "sprzegla",
    "sprzegl",
    "dwumas",
    "dwumasow",
    "wysprzęglik",
    "wysprzeglik",
    "olej w skrzyni",
    "skrzyni biegów",
    "skrzyni biegow",
    "skrzynia automatyczna",
    "skrzynia manualna",
  ],
  Klimatyzacja: [
    "klimatyzacja",
    "klima",
    "odgrzybianie",
    "nabijanie klimatyzacji",
    "nabijanie klimy",
    "czynnik",
    "nabijanie",
    "odgrzyb",
    "ozonowanie klimatyzacji",
    "filtra kabinowego",
    "chłodnicz",
    "chlodnicz",
  ],
  "Opony i koła": [
    "opon",
    "koła",
    "kola",
    "koł",
    "kol",
    "wyważanie",
    "wywazanie",
    "geometria",
    "zbieżność",
    "zbieznosc",
    "felg",
    "felgi",
    "przechowywanie opon",
    "wymiana opon",
    "wymiana kół",
    "wymiana kol",
    "wentyl",
  ],
  "Układ wydechowy": [
    "wydech",
    "wydechowy",
    "tłumik",
    "tlumik",
    "spawanie tłumika",
    "katalizator",
    "rura wydechowa",
  ],
  Nadwozie: [
    "blachar",
    "lakier",
    "karoser",
    "szyb",
    "wgniot",
    "polerowanie lakieru",
    "przód po kolizji",
    "po kolizji",
  ],
  Motocykl: [
    "motocykl",
    "motocykla",
    "motocyklow",
    "skuter",
    "jednoślad",
    "jednoslad",
    "napęd motocykla",
    "naped motocykla",
  ],
  Inne: [],
};

function stripDiacritics(value: string) {
  // Ogonek itd. schodzi z NFD+M; ł/Ł to osobne znaki — mapujemy na l/L (ASCII).
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L");
}

/** Tekst do dopasowania słów kluczowych (małe litery, bez polskich znaków). */
export function normalizeServiceTextForMatch(serviceName: string) {
  return stripDiacritics(serviceName.trim().toLowerCase()).replace(/\s+/g, " ");
}

type CategoryScore = {
  category: ServiceMainCategory;
  score: number;
  bestKeywordLen: number;
};

function scoreCategory(category: ServiceMainCategory, haystack: string): CategoryScore {
  const keywords = KEYWORDS[category];
  let score = 0;
  let bestKeywordLen = 0;
  for (const kw of keywords) {
    const n = stripDiacritics(kw.toLowerCase());
    if (!n) continue;
    if (haystack.includes(n)) {
      score += 1;
      bestKeywordLen = Math.max(bestKeywordLen, n.length);
    }
  }
  return { category, score, bestKeywordLen };
}

function tiebreakIndex(c: ServiceMainCategory) {
  const i = SCORE_TIEBREAK_ORDER.indexOf(c);
  return i === -1 ? 999 : i;
}

/**
 * Klasyfikuje nazwę usługi na podstawie słów kluczowych (bez AI).
 * - `category` — główna kategoria (najwyższy wynik; remisy: dłuższe trafienie, potem tie-break).
 * - `tags` — inne kategorie z dodatnim wynikiem (np. „diagnostyka hamulców” → Diagnostyka + tag Hamulce).
 */
export function classifyServiceCategory(serviceName: string): {
  category: ServiceMainCategory;
  tags: ServiceMainCategory[];
} {
  const haystack = normalizeServiceTextForMatch(serviceName);
  if (!haystack) {
    return { category: "Inne", tags: [] };
  }

  const scored = (SERVICE_MAIN_CATEGORIES.filter((c) => c !== "Inne") as ServiceMainCategory[]).map((c) =>
    scoreCategory(c, haystack),
  );

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.bestKeywordLen !== a.bestKeywordLen) return b.bestKeywordLen - a.bestKeywordLen;
    return tiebreakIndex(a.category) - tiebreakIndex(b.category);
  });

  const top = scored[0];
  if (!top || top.score === 0) {
    return { category: "Inne", tags: [] };
  }

  const primary = top.category;
  const runnersUp = scored
    .filter((s) => s.category !== primary && s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return tiebreakIndex(a.category) - tiebreakIndex(b.category);
    })
    .map((s) => s.category);

  return { category: primary, tags: runnersUp };
}

export function slugifyServiceKey(serviceName: string) {
  return stripDiacritics(serviceName.toLowerCase()).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
