import type { VehicleTypeKey } from "@/lib/vehicleData";

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

const baseCatalog: ServiceCategory[] = [
  createCategory("Serwis podstawowy", [
    {
      name: "Kontrole sezonowe",
      services: [
        "Przegląd podstawowy auta",
        "Kontrola auta przed trasą",
        "Kontrola auta przed zimą",
        "Kontrola auta przed wakacjami",
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
        "Wymiana oleju i wszystkich filtrów",
      ],
    },
  ]),
  createCategory("Opony i koła", [
    {
      name: "Serwis opon",
      services: [
        "Wymiana opon",
        "Wyważanie kół",
        "Naprawa opony",
        "Przechowywanie opon",
        "Wymiana wentyla",
      ],
    },
    {
      name: "Felgi i geometria",
      services: ["Prostowanie felgi", "Geometria kół", "Zbieżność kół"],
    },
  ]),
  createCategory("Hamulce", [
    {
      name: "Wymiany elementów",
      services: [
        "Wymiana klocków hamulcowych",
        "Wymiana przednich klocków hamulcowych",
        "Wymiana tylnych klocków hamulcowych",
        "Wymiana tarcz hamulcowych",
        "Wymiana klocków i tarcz hamulcowych",
      ],
    },
    {
      name: "Obsługa i naprawy",
      services: [
        "Wymiana płynu hamulcowego",
        "Regeneracja zacisku hamulcowego",
        "Naprawa hamulca ręcznego",
        "Kontrola układu hamulcowego",
      ],
    },
  ]),
  createCategory("Diagnostyka", [
    {
      name: "Diagnostyka komputerowa",
      services: [
        "Diagnostyka komputerowa",
        "Diagnostyka silnika",
        "Kasowanie błędów",
        "Odczyt błędów",
        "Diagnostyka kontrolki check engine",
      ],
    },
    {
      name: "Diagnostyka specjalistyczna",
      services: [
        "Diagnostyka elektryczna",
        "Diagnostyka układu paliwowego",
        "Diagnostyka przed zakupem auta",
      ],
    },
  ]),
  createCategory("Silnik", [
    {
      name: "Naprawy główne",
      services: ["Naprawa silnika", "Wymiana rozrządu", "Wymiana uszczelki pod głowicą"],
    },
    {
      name: "Układ spalania",
      services: [
        "Wymiana świec zapłonowych",
        "Wymiana świec żarowych",
        "Regeneracja wtryskiwaczy",
      ],
    },
    {
      name: "Czyszczenie układów",
      services: ["Czyszczenie przepustnicy", "Czyszczenie EGR", "Czyszczenie DPF"],
    },
  ]),
  createCategory("Elektryka", [
    {
      name: "Instalacja i osprzęt",
      services: [
        "Naprawa instalacji elektrycznej",
        "Wymiana alternatora",
        "Naprawa alternatora",
        "Wymiana rozrusznika",
        "Naprawa rozrusznika",
      ],
    },
    {
      name: "Komfort i czujniki",
      services: [
        "Naprawa centralnego zamka",
        "Naprawa szyb elektrycznych",
        "Naprawa czujników parkowania",
      ],
    },
  ]),
  createCategory("Akumulator i rozruch", [
    {
      name: "Akumulator",
      services: ["Wymiana akumulatora", "Sprawdzenie akumulatora", "Ładowanie akumulatora"],
    },
    {
      name: "Problemy z odpalaniem",
      services: ["Diagnostyka problemów z odpalaniem", "Awaryjne uruchomienie auta"],
    },
  ]),
  createCategory("Klimatyzacja", [
    {
      name: "Serwis klimatyzacji",
      services: [
        "Nabijanie klimatyzacji",
        "Odgrzybianie klimatyzacji",
        "Ozonowanie klimatyzacji",
        "Wymiana filtra kabinowego",
        "Diagnostyka klimatyzacji",
        "Naprawa klimatyzacji",
        "Sprawdzenie szczelności klimatyzacji",
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
        "Wymiana łączników stabilizatora",
        "Wymiana sworznia wahacza",
      ],
    },
    {
      name: "Diagnostyka",
      services: ["Diagnostyka zawieszenia"],
    },
  ]),
  createCategory("Układ kierowniczy", [
    {
      name: "Naprawy i ustawienia",
      services: [
        "Wymiana drążka kierowniczego",
        "Wymiana końcówki drążka",
        "Naprawa wspomagania kierownicy",
        "Ustawienie zbieżności",
        "Diagnostyka układu kierowniczego",
      ],
    },
  ]),
  createCategory("Skrzynia biegów", [
    {
      name: "Obsługa i naprawy",
      services: [
        "Wymiana oleju w skrzyni biegów",
        "Diagnostyka skrzyni biegów",
        "Naprawa skrzyni manualnej",
        "Naprawa skrzyni automatycznej",
      ],
    },
  ]),
  createCategory("Sprzęgło", [
    {
      name: "Naprawa sprzęgła",
      services: [
        "Wymiana sprzęgła",
        "Diagnostyka sprzęgła",
        "Wymiana koła dwumasowego",
        "Wymiana wysprzęglika",
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
        "Wymiana sondy lambda",
        "Naprawa DPF",
        "Usuwanie nieszczelności wydechu",
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
        "Uzupełnienie płynów eksploatacyjnych",
      ],
    },
  ]),
  createCategory("Przeglądy i kontrole", [
    {
      name: "Przeglądy techniczne",
      services: [
        "Przegląd okresowy",
        "Przegląd przed dłuższą trasą",
        "Kontrola stanu technicznego",
        "Kontrola układów bezpieczeństwa",
      ],
    },
  ]),
  createCategory("Auto przed zakupem", [
    {
      name: "Weryfikacja przed zakupem",
      services: [
        "Sprawdzenie auta przed zakupem",
        "Diagnostyka komputerowa przed zakupem",
        "Kontrola lakieru przed zakupem",
        "Kontrola zawieszenia przed zakupem",
        "Jazda próbna z mechanikiem",
      ],
    },
  ]),
  createCategory("Blacharstwo i lakiernictwo", [
    {
      name: "Naprawy karoserii",
      services: [
        "Naprawa blacharska",
        "Lakierowanie elementu",
        "Usuwanie wgniotek",
        "Polerowanie lakieru",
        "Naprawa po kolizji",
      ],
    },
  ]),
  createCategory("Szyby i wycieraczki", [
    {
      name: "Szyby i widoczność",
      services: [
        "Wymiana szyby",
        "Naprawa odprysku szyby",
        "Wymiana wycieraczek",
        "Naprawa spryskiwaczy",
      ],
    },
  ]),
  createCategory("Światła i żarówki", [
    {
      name: "Oświetlenie",
      services: [
        "Wymiana żarówki",
        "Regulacja świateł",
        "Naprawa lampy",
        "Wymiana lampy",
        "Wymiana świateł LED/Xenon",
      ],
    },
  ]),
  createCategory("Inne usterki", [
    {
      name: "Objawy",
      services: [
        "Auto nie odpala",
        "Coś stuka",
        "Coś piszczy",
        "Auto szarpie",
        "Auto traci moc",
        "Wycieka płyn",
        "Świeci kontrolka",
        "Nie wiem, co się dzieje",
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

export function getServiceCatalogByVehicleType(vehicleType: string): ServiceCategory[] {
  const normalizedType = vehicleType as VehicleTypeKey;
  if (normalizedType === "motorcycle") {
    return [...baseCatalog, motorcycleExtras];
  }
  if (normalizedType === "van") {
    return [...baseCatalog, vanExtras];
  }
  return baseCatalog;
}

