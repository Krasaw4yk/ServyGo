export type WorkshopServiceOffer = {
  id?: string;
  service_name: string;
  workshopId?: string;
  service_key?: string | null;
  vehicle_type: string;
  brand: string;
  model: string;
  year_from: number;
  year_to: number;
  engine: string;
  fuelType?: string;
  price: number;
  duration_minutes: number;
  next_available: string;
  required_roles?: string[];
};

export type WorkshopAvailabilityConfig = {
  openingHours: {
    start: string;
    end: string;
  };
  workingDays: number[];
  availableTimeSlots: Record<string, string[]>;
  blockedDates: string[];
  customAvailability: Record<string, string[]>;
};

export type MockWorkshop = {
  id: string;
  supabaseId: string;
  googlePlaceId: string;
  googleMapsUrl: string;
  /** Z `workshops.google_maps_url` — używaj m.in. do przycisku „Zostaw opinię”. */
  workshopGoogleMapsUrl?: string | null;
  name: string;
  city: string;
  address: string;
  rating: number;
  reviewsCount: number;
  lat: number;
  lng: number;
  description: string;
  imagePlaceholder: string;
  availability: WorkshopAvailabilityConfig;
  workingDays: string;
  workingHours: string;
  closedDates: string[];
  bufferMinutes: number;
  arrivalBeforeMinutes: number;
  bookedSlots: string[];
  services: WorkshopServiceOffer[];
};

type MockWorkshopBase = Omit<
  MockWorkshop,
  "supabaseId"
  | "googlePlaceId"
  | "googleMapsUrl"
  | "description"
  | "imagePlaceholder"
  | "availability"
  | "workingDays"
  | "workingHours"
  | "closedDates"
  | "bufferMinutes"
  | "arrivalBeforeMinutes"
  | "bookedSlots"
>;

const rawWorkshops: MockWorkshopBase[] = [
  {
    id: "bb-1",
    name: "AutoSerwis Beskid Premium",
    city: "Bielsko-Biała",
    address: "ul. Cieszyńska 45, Bielsko-Biała",
    rating: 4.8,
    reviewsCount: 214,
    lat: 49.8187,
    lng: 19.0399,
    services: [
      {
        service_name: "Wymiana oleju",
        vehicle_type: "Osobowy",
        brand: "Fiat",
        model: "Croma",
        year_from: 2007,
        year_to: 2010,
        engine: "1.9 Diesel",
        price: 249,
        duration_minutes: 60,
        next_available: "Dziś 17:10",
      },
      {
        service_name: "Diagnostyka komputerowa",
        vehicle_type: "Osobowy",
        brand: "Volkswagen",
        model: "Golf",
        year_from: 2010,
        year_to: 2014,
        engine: "1.6 Diesel",
        price: 159,
        duration_minutes: 45,
        next_available: "Jutro 09:20",
      },
      {
        service_name: "Wymiana klocków hamulcowych",
        vehicle_type: "Osobowy",
        brand: "Opel",
        model: "Astra",
        year_from: 2008,
        year_to: 2012,
        engine: "1.7 Diesel",
        price: 329,
        duration_minutes: 110,
        next_available: "Jutro 13:40",
      },
    ],
  },
  {
    id: "bb-2",
    name: "Moto Klinik Lipnik",
    city: "Bielsko-Biała",
    address: "ul. Lwowska 88, Bielsko-Biała",
    rating: 4.6,
    reviewsCount: 167,
    lat: 49.8094,
    lng: 19.0734,
    services: [
      {
        service_name: "Wymiana rozrządu",
        vehicle_type: "Osobowy",
        brand: "BMW",
        model: "3",
        year_from: 2012,
        year_to: 2016,
        engine: "2.0 Diesel",
        price: 1249,
        duration_minutes: 340,
        next_available: "Pojutrze 08:00",
      },
      {
        service_name: "Serwis klimatyzacji",
        vehicle_type: "Osobowy",
        brand: "Toyota",
        model: "Corolla",
        year_from: 2013,
        year_to: 2017,
        engine: "1.6 Benzyna",
        price: 279,
        duration_minutes: 75,
        next_available: "Dziś 18:00",
      },
      {
        service_name: "Wymiana opon",
        vehicle_type: "Osobowy",
        brand: "Volkswagen",
        model: "Golf",
        year_from: 2011,
        year_to: 2015,
        engine: "1.6 Diesel",
        price: 189,
        duration_minutes: 55,
        next_available: "Jutro 11:10",
      },
    ],
  },
  {
    id: "bb-3",
    name: "Serwis Pod Szyndzielnią",
    city: "Bielsko-Biała",
    address: "ul. Partyzantów 62, Bielsko-Biała",
    rating: 4.9,
    reviewsCount: 301,
    lat: 49.8035,
    lng: 19.0041,
    services: [
      {
        service_name: "Diagnostyka komputerowa",
        vehicle_type: "Osobowy",
        brand: "Toyota",
        model: "Corolla",
        year_from: 2014,
        year_to: 2018,
        engine: "1.6 Benzyna",
        price: 149,
        duration_minutes: 40,
        next_available: "Dziś 15:30",
      },
      {
        service_name: "Wymiana oleju",
        vehicle_type: "Osobowy",
        brand: "Opel",
        model: "Astra",
        year_from: 2009,
        year_to: 2011,
        engine: "1.7 Diesel",
        price: 229,
        duration_minutes: 55,
        next_available: "Jutro 10:00",
      },
      {
        service_name: "Wymiana klocków hamulcowych",
        vehicle_type: "Osobowy",
        brand: "BMW",
        model: "3",
        year_from: 2013,
        year_to: 2015,
        engine: "2.0 Diesel",
        price: 369,
        duration_minutes: 125,
        next_available: "Jutro 16:20",
      },
    ],
  },
  {
    id: "bb-4",
    name: "Auto Punkt Karpacka",
    city: "Bielsko-Biała",
    address: "ul. Karpacka 24, Bielsko-Biała",
    rating: 4.5,
    reviewsCount: 122,
    lat: 49.7902,
    lng: 19.0386,
    services: [
      {
        service_name: "Wymiana opon",
        vehicle_type: "Osobowy",
        brand: "Fiat",
        model: "Croma",
        year_from: 2007,
        year_to: 2009,
        engine: "1.9 Diesel",
        price: 179,
        duration_minutes: 50,
        next_available: "Dziś 19:00",
      },
      {
        service_name: "Serwis klimatyzacji",
        vehicle_type: "Osobowy",
        brand: "Volkswagen",
        model: "Golf",
        year_from: 2011,
        year_to: 2013,
        engine: "1.6 Diesel",
        price: 289,
        duration_minutes: 80,
        next_available: "Jutro 14:10",
      },
      {
        service_name: "Wymiana rozrządu",
        vehicle_type: "Osobowy",
        brand: "Opel",
        model: "Astra",
        year_from: 2009,
        year_to: 2011,
        engine: "1.7 Diesel",
        price: 1099,
        duration_minutes: 300,
        next_available: "Pojutrze 10:30",
      },
    ],
  },
  {
    id: "bb-5",
    name: "Beskid Auto Care",
    city: "Bielsko-Biała",
    address: "ul. Żywiecka 190, Bielsko-Biała",
    rating: 4.7,
    reviewsCount: 198,
    lat: 49.7721,
    lng: 19.0512,
    services: [
      {
        service_name: "Wymiana oleju",
        vehicle_type: "Osobowy",
        brand: "BMW",
        model: "3",
        year_from: 2013,
        year_to: 2015,
        engine: "2.0 Diesel",
        price: 269,
        duration_minutes: 60,
        next_available: "Jutro 08:40",
      },
      {
        service_name: "Diagnostyka komputerowa",
        vehicle_type: "Osobowy",
        brand: "Fiat",
        model: "Croma",
        year_from: 2007,
        year_to: 2010,
        engine: "1.9 Diesel",
        price: 169,
        duration_minutes: 50,
        next_available: "Dziś 16:10",
      },
      {
        service_name: "Wymiana klocków hamulcowych",
        vehicle_type: "Osobowy",
        brand: "Toyota",
        model: "Corolla",
        year_from: 2014,
        year_to: 2016,
        engine: "1.6 Benzyna",
        price: 349,
        duration_minutes: 115,
        next_available: "Jutro 12:30",
      },
    ],
  },
  {
    id: "kr-1",
    name: "Kraków Moto Expert",
    city: "Kraków",
    address: "ul. Zakopiańska 112, Kraków",
    rating: 4.7,
    reviewsCount: 240,
    lat: 50.0121,
    lng: 19.9368,
    services: [
      {
        service_name: "Wymiana rozrządu",
        vehicle_type: "Osobowy",
        brand: "Volkswagen",
        model: "Golf",
        year_from: 2011,
        year_to: 2013,
        engine: "1.6 Diesel",
        price: 1149,
        duration_minutes: 320,
        next_available: "Pojutrze 09:00",
      },
      {
        service_name: "Serwis klimatyzacji",
        vehicle_type: "Osobowy",
        brand: "Toyota",
        model: "Corolla",
        year_from: 2014,
        year_to: 2016,
        engine: "1.6 Benzyna",
        price: 299,
        duration_minutes: 85,
        next_available: "Jutro 15:50",
      },
      {
        service_name: "Wymiana opon",
        vehicle_type: "Osobowy",
        brand: "BMW",
        model: "3",
        year_from: 2013,
        year_to: 2015,
        engine: "2.0 Diesel",
        price: 209,
        duration_minutes: 60,
        next_available: "Dziś 18:20",
      },
    ],
  },
  {
    id: "kr-2",
    name: "Nowa Huta Auto Serwis",
    city: "Kraków",
    address: "ul. Ujastek 9, Kraków",
    rating: 4.4,
    reviewsCount: 134,
    lat: 50.0809,
    lng: 20.0538,
    services: [
      {
        service_name: "Wymiana oleju",
        vehicle_type: "Osobowy",
        brand: "Opel",
        model: "Astra",
        year_from: 2009,
        year_to: 2011,
        engine: "1.7 Diesel",
        price: 219,
        duration_minutes: 55,
        next_available: "Jutro 10:45",
      },
      {
        service_name: "Diagnostyka komputerowa",
        vehicle_type: "Osobowy",
        brand: "BMW",
        model: "3",
        year_from: 2013,
        year_to: 2016,
        engine: "2.0 Diesel",
        price: 179,
        duration_minutes: 45,
        next_available: "Dziś 17:40",
      },
      {
        service_name: "Wymiana klocków hamulcowych",
        vehicle_type: "Osobowy",
        brand: "Fiat",
        model: "Croma",
        year_from: 2007,
        year_to: 2010,
        engine: "1.9 Diesel",
        price: 309,
        duration_minutes: 105,
        next_available: "Jutro 13:00",
      },
    ],
  },
  {
    id: "wa-1",
    name: "Warszawski Serwis Premium",
    city: "Warszawa",
    address: "ul. Puławska 301, Warszawa",
    rating: 4.9,
    reviewsCount: 412,
    lat: 52.1862,
    lng: 21.0291,
    services: [
      {
        service_name: "Wymiana rozrządu",
        vehicle_type: "Osobowy",
        brand: "BMW",
        model: "3",
        year_from: 2012,
        year_to: 2016,
        engine: "2.0 Diesel",
        price: 1399,
        duration_minutes: 360,
        next_available: "Pojutrze 11:20",
      },
      {
        service_name: "Serwis klimatyzacji",
        vehicle_type: "Osobowy",
        brand: "Volkswagen",
        model: "Golf",
        year_from: 2011,
        year_to: 2014,
        engine: "1.6 Diesel",
        price: 329,
        duration_minutes: 90,
        next_available: "Jutro 14:40",
      },
      {
        service_name: "Wymiana opon",
        vehicle_type: "Osobowy",
        brand: "Toyota",
        model: "Corolla",
        year_from: 2014,
        year_to: 2016,
        engine: "1.6 Benzyna",
        price: 219,
        duration_minutes: 65,
        next_available: "Dziś 19:10",
      },
    ],
  },
  {
    id: "wa-2",
    name: "Auto Klinika Centrum",
    city: "Warszawa",
    address: "ul. Grochowska 88, Warszawa",
    rating: 4.6,
    reviewsCount: 189,
    lat: 52.2442,
    lng: 21.0834,
    services: [
      {
        service_name: "Wymiana oleju",
        vehicle_type: "Osobowy",
        brand: "Toyota",
        model: "Corolla",
        year_from: 2014,
        year_to: 2016,
        engine: "1.6 Benzyna",
        price: 239,
        duration_minutes: 60,
        next_available: "Jutro 09:50",
      },
      {
        service_name: "Diagnostyka komputerowa",
        vehicle_type: "Osobowy",
        brand: "Opel",
        model: "Astra",
        year_from: 2009,
        year_to: 2012,
        engine: "1.7 Diesel",
        price: 169,
        duration_minutes: 50,
        next_available: "Dziś 16:40",
      },
      {
        service_name: "Wymiana klocków hamulcowych",
        vehicle_type: "Osobowy",
        brand: "Volkswagen",
        model: "Golf",
        year_from: 2011,
        year_to: 2013,
        engine: "1.6 Diesel",
        price: 359,
        duration_minutes: 120,
        next_available: "Jutro 12:20",
      },
    ],
  },
  {
    id: "wr-1",
    name: "Wrocław Auto Hub",
    city: "Wrocław",
    address: "ul. Legnicka 54, Wrocław",
    rating: 4.7,
    reviewsCount: 176,
    lat: 51.1184,
    lng: 16.9922,
    services: [
      {
        service_name: "Serwis klimatyzacji",
        vehicle_type: "Osobowy",
        brand: "Fiat",
        model: "Croma",
        year_from: 2007,
        year_to: 2010,
        engine: "1.9 Diesel",
        price: 269,
        duration_minutes: 80,
        next_available: "Jutro 11:30",
      },
      {
        service_name: "Wymiana rozrządu",
        vehicle_type: "Osobowy",
        brand: "Opel",
        model: "Astra",
        year_from: 2009,
        year_to: 2011,
        engine: "1.7 Diesel",
        price: 1129,
        duration_minutes: 315,
        next_available: "Pojutrze 08:40",
      },
      {
        service_name: "Diagnostyka komputerowa",
        vehicle_type: "Osobowy",
        brand: "BMW",
        model: "3",
        year_from: 2013,
        year_to: 2015,
        engine: "2.0 Diesel",
        price: 189,
        duration_minutes: 45,
        next_available: "Dziś 18:50",
      },
    ],
  },
];

export const mockWorkshops: MockWorkshop[] = rawWorkshops.map((workshop) => {
  const idSeed = workshop.id
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const closedDates = [
    `2026-05-${String((idSeed % 10) + 10).padStart(2, "0")}`,
    `2026-05-${String((idSeed % 10) + 20).padStart(2, "0")}`,
  ];
  const bookedSlots = [
    `${closedDates[0]}T09:00`,
    `${closedDates[0]}T11:30`,
    `${closedDates[1]}T10:00`,
  ];
  const baseSlots = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];
  const availability: WorkshopAvailabilityConfig = {
    openingHours: {
      start: "08:00",
      end: "17:00",
    },
    workingDays: [1, 2, 3, 4, 5],
    availableTimeSlots: {
      "1": baseSlots,
      "2": baseSlots,
      "3": baseSlots,
      "4": baseSlots,
      "5": baseSlots,
    },
    blockedDates: closedDates,
    customAvailability: {
      [closedDates[0]]: [],
      [closedDates[1]]: [],
    },
  };

  return {
    ...workshop,
    supabaseId: `00000000-0000-4000-8000-${String(idSeed).padStart(12, "0").slice(-12)}`,
    googlePlaceId: `mock-place-${workshop.id}`,
    googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(`${workshop.name}, ${workshop.address}`)}`,
    services: workshop.services.map((service) => ({
      ...service,
      workshopId: workshop.id,
      fuelType:
        service.fuelType ??
        (service.engine.toLowerCase().includes("diesel")
          ? "Diesel"
          : service.engine.toLowerCase().includes("benz")
            ? "Benzyna"
            : service.engine.toLowerCase().includes("lpg")
              ? "LPG"
              : "Nie określono"),
    })),
    description: `${workshop.name} to nowoczesny warsztat w mieście ${workshop.city}. Specjalizuje się w usługach mechanicznych, szybkiej diagnostyce i terminowej obsłudze.`,
    imagePlaceholder: `Gradientowa karta warsztatu ${workshop.name}`,
    availability,
    workingDays: "monday-friday",
    workingHours: "08:00-17:00",
    closedDates,
    bufferMinutes: 30,
    arrivalBeforeMinutes: 15,
    bookedSlots,
  };
});
