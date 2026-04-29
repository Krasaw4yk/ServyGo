export type VehicleTypeKey = "car" | "motorcycle" | "van";

export type VehicleConfig = {
  label: string;
  brands: string[];
  models: Record<string, string[]>;
  fuels: string[];
  services: string[];
  fuelLabel: string;
  serviceLabel: string;
};

export const vehicleTypeOptions: { key: VehicleTypeKey; label: string }[] = [
  { key: "car", label: "Samochód osobowy" },
  { key: "motorcycle", label: "Motocykl" },
  { key: "van", label: "Dostawczy" },
];

export const vehicleData: Record<VehicleTypeKey, VehicleConfig> = {
  car: {
    label: "Samochód osobowy",
    brands: [
      "Audi",
      "BMW",
      "Mercedes-Benz",
      "Volkswagen",
      "Opel",
      "Toyota",
      "Skoda",
      "Ford",
      "Renault",
      "Peugeot",
      "Citroen",
      "Fiat",
      "Hyundai",
      "Kia",
      "Honda",
      "Nissan",
      "Mazda",
      "Volvo",
      "Seat",
      "Cupra",
      "Dacia",
      "Suzuki",
      "Mitsubishi",
      "Subaru",
      "Lexus",
      "Mini",
      "Alfa Romeo",
      "Jeep",
      "Land Rover",
      "Jaguar",
      "Porsche",
      "Tesla",
      "Chevrolet",
      "Chrysler",
      "Dodge",
      "Smart",
      "Saab",
      "Lancia",
      "DS Automobiles",
      "MG",
      "Isuzu",
      "Inna marka",
    ],
    models: {
      Audi: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q4 e-tron", "Q5", "Q7", "Q8", "TT", "R8"],
      BMW: ["Seria 1", "Seria 2", "Seria 3", "Seria 4", "Seria 5", "Seria 6", "Seria 7", "Seria 8", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "Z3", "Z4", "i3", "i4", "iX"],
      "Mercedes-Benz": ["Klasa A", "Klasa B", "Klasa C", "Klasa E", "Klasa S", "CLA", "CLS", "GLA", "GLB", "GLC", "GLE", "GLS", "Klasa G", "Vito", "Viano"],
      Volkswagen: ["Polo", "Golf", "Passat", "Jetta", "Bora", "Arteon", "Touran", "Sharan", "Tiguan", "T-Roc", "T-Cross", "Touareg", "Caddy", "Beetle"],
      Opel: ["Corsa", "Astra", "Vectra", "Insignia", "Meriva", "Zafira", "Mokka", "Crossland", "Grandland", "Adam", "Vivaro"],
      Toyota: ["Aygo", "Yaris", "Corolla", "Auris", "Avensis", "Camry", "Prius", "C-HR", "RAV4", "Highlander", "Land Cruiser", "Proace"],
      Skoda: ["Fabia", "Rapid", "Scala", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq", "Yeti", "Roomster"],
      Ford: ["Ka", "Fiesta", "Focus", "Mondeo", "Fusion", "C-Max", "S-Max", "Galaxy", "Puma", "Kuga", "Edge", "Mustang", "Transit", "Ranger"],
      Renault: ["Twingo", "Clio", "Megane", "Scenic", "Laguna", "Talisman", "Captur", "Kadjar", "Koleos", "Kangoo", "Trafic", "Master"],
      Peugeot: ["106", "206", "207", "208", "306", "307", "308", "407", "508", "2008", "3008", "5008", "Partner", "Boxer"],
      Citroen: ["C1", "C2", "C3", "C4", "C5", "C-Elysee", "Berlingo", "Xsara Picasso", "C4 Picasso", "C5 Aircross", "Jumper"],
      Fiat: ["500", "Panda", "Punto", "Grande Punto", "Tipo", "Bravo", "Stilo", "Doblo", "Ducato", "Freemont"],
      Hyundai: ["i10", "i20", "i30", "i40", "Elantra", "Sonata", "Kona", "Tucson", "Santa Fe", "ix35"],
      Kia: ["Picanto", "Rio", "Ceed", "ProCeed", "Stonic", "Sportage", "Sorento", "Optima", "Niro", "EV6"],
      Honda: ["Jazz", "Civic", "Accord", "HR-V", "CR-V", "CR-Z", "Insight"],
      Nissan: ["Micra", "Note", "Almera", "Primera", "Juke", "Qashqai", "X-Trail", "Navara", "Leaf"],
      Mazda: ["2", "3", "5", "6", "CX-3", "CX-5", "CX-7", "CX-30", "MX-5"],
      Volvo: ["C30", "S40", "S60", "S80", "S90", "V40", "V50", "V60", "V70", "V90", "XC40", "XC60", "XC70", "XC90"],
      Seat: ["Ibiza", "Leon", "Toledo", "Altea", "Ateca", "Arona", "Tarraco"],
      Dacia: ["Sandero", "Logan", "Duster", "Lodgy", "Dokker", "Jogger", "Spring"],
      Suzuki: ["Swift", "Baleno", "SX4", "Vitara", "Grand Vitara", "S-Cross", "Jimny", "Ignis"],
      Mitsubishi: ["Colt", "Lancer", "ASX", "Outlander", "Pajero", "Eclipse Cross", "Space Star"],
      Subaru: ["Impreza", "Legacy", "Forester", "Outback", "XV", "BRZ", "Levorg"],
      Lexus: ["CT", "IS", "ES", "GS", "LS", "UX", "NX", "RX", "LX"],
      Mini: ["One", "Cooper", "Clubman", "Countryman", "Paceman"],
      Jeep: ["Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Patriot"],
      "Land Rover": ["Freelander", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Defender"],
      Porsche: ["911", "Boxster", "Cayman", "Panamera", "Macan", "Cayenne", "Taycan"],
      Tesla: ["Model S", "Model 3", "Model X", "Model Y", "Cybertruck"],
      "Inna marka": ["Inny model"],
    },
    fuels: ["Benzyna", "Diesel", "LPG", "Hybryda", "Hybryda plug-in", "Elektryczny", "Nie wiem"],
    services: ["Wymiana oleju i filtrów", "Wymiana opon", "Hamulce", "Diagnostyka komputerowa", "Zawieszenie", "Klimatyzacja", "Rozrząd", "Sprzęgło", "Akumulator", "Układ wydechowy", "Geometria kół", "Przegląd przed zakupem", "Naprawa po awarii", "Blacharstwo / lakiernictwo", "Inna usługa"],
    fuelLabel: "Silnik / paliwo",
    serviceLabel: "Czego potrzebujesz?",
  },
  motorcycle: {
    label: "Motocykl",
    brands: ["Honda Moto", "Yamaha", "Kawasaki", "Suzuki Moto", "BMW Motorrad", "KTM", "Ducati", "Harley-Davidson", "Aprilia", "Piaggio", "Vespa", "Triumph", "Moto Guzzi", "Husqvarna", "Indian Motorcycle", "Benelli", "CF Moto", "Kymco", "Sym", "Junak", "Romet", "Zipp", "Keeway", "Malaguti", "Beta", "Sherco", "GasGas", "Royal Enfield", "MV Agusta", "Inna marka"],
    models: {
      "Honda Moto": ["CB125R", "CB500F", "CB650R", "CBR125R", "CBR500R", "CBR600RR", "CBR650R", "CBR1000RR", "Africa Twin", "NC750X", "Rebel 500", "Gold Wing", "Forza 125", "Forza 350", "PCX", "SH125"],
      Yamaha: ["MT-03", "MT-07", "MT-09", "MT-10", "YZF-R125", "YZF-R3", "YZF-R6", "YZF-R1", "Tracer 7", "Tracer 9", "Tenere 700", "XMAX 125", "XMAX 300", "NMAX", "TMAX"],
      Kawasaki: ["Ninja 125", "Ninja 400", "Ninja 650", "Ninja ZX-6R", "Ninja ZX-10R", "Z125", "Z400", "Z650", "Z900", "Z1000", "Versys 650", "Versys 1000", "Vulcan S"],
      "Suzuki Moto": ["GSX-R125", "GSX-R600", "GSX-R750", "GSX-R1000", "GSX-S125", "GSX-S750", "GSX-S1000", "SV650", "V-Strom 650", "V-Strom 1050", "Burgman 125", "Burgman 400", "Hayabusa"],
      "BMW Motorrad": ["G 310 R", "G 310 GS", "F 750 GS", "F 850 GS", "F 900 R", "F 900 XR", "R 1250 GS", "R 1250 RT", "S 1000 R", "S 1000 RR", "S 1000 XR", "K 1600 GT", "C 400 X", "C 400 GT"],
      KTM: ["Duke 125", "Duke 390", "Duke 690", "Duke 790", "Duke 890", "Duke 1290", "RC 125", "RC 390", "Adventure 390", "Adventure 790", "Adventure 890", "Adventure 1290", "EXC", "SX"],
      Ducati: ["Monster", "Panigale V2", "Panigale V4", "Multistrada", "Scrambler", "Diavel", "Hypermotard", "Streetfighter V2", "Streetfighter V4", "Supersport"],
      "Harley-Davidson": ["Sportster", "Iron 883", "Forty-Eight", "Street Bob", "Fat Bob", "Fat Boy", "Road King", "Street Glide", "Road Glide", "Pan America", "Nightster"],
      Aprilia: ["RS 125", "RS 660", "RSV4", "Tuono 125", "Tuono 660", "Tuono V4", "Tuareg 660", "SR GT", "SR 50"],
      Piaggio: ["Liberty", "Medley", "Beverly", "MP3", "Zip", "Typhoon"],
      Vespa: ["Primavera", "Sprint", "GTS", "GTV", "Elettrica"],
      Triumph: ["Trident 660", "Street Triple", "Speed Triple", "Tiger 660", "Tiger 900", "Tiger 1200", "Bonneville", "Bobber", "Rocket 3"],
      "Moto Guzzi": ["V7", "V9", "V85 TT", "California", "Audace"],
      Husqvarna: ["Svartpilen 125", "Svartpilen 401", "Vitpilen 401", "Norden 901", "TE", "FE", "TC", "FC"],
      "Indian Motorcycle": ["Scout", "Chief", "Chieftain", "Challenger", "Roadmaster", "FTR"],
      Benelli: ["BN 125", "Leoncino 500", "TRK 502", "TNT 125", "752S"],
      "CF Moto": ["300NK", "450NK", "650NK", "700CL-X", "800MT", "450SR"],
      Kymco: ["Agility", "Like", "People", "Downtown", "X-Town", "AK 550"],
      Sym: ["Symphony", "Jet", "Fiddle", "Maxsym", "Joymax"],
      Junak: ["901", "902", "905", "M11", "M12", "M16", "RS125", "RX One"],
      Romet: ["Ogar", "Pony", "ZK", "ZXT", "CRS", "ADV"],
      Zipp: ["VZ", "Pro", "Raven", "Shock", "Quantum"],
      Keeway: ["RKS", "RKF", "Superlight", "K-Light", "Fact", "Cityblade"],
      "Royal Enfield": ["Classic 350", "Meteor 350", "Himalayan", "Interceptor 650", "Continental GT", "Super Meteor 650"],
      "Inna marka": ["Inny model"],
    },
    fuels: ["Benzyna", "Elektryczny", "Nie wiem"],
    services: ["Wymiana oleju", "Wymiana filtra oleju", "Wymiana filtra powietrza", "Wymiana opon motocyklowych", "Serwis łańcucha i napędu", "Regulacja luzów zaworowych", "Hamulce motocyklowe", "Wymiana klocków hamulcowych", "Wymiana płynu hamulcowego", "Wymiana akumulatora", "Diagnostyka motocykla", "Regulacja gaźnika / wtrysku", "Serwis zawieszenia", "Serwis amortyzatorów", "Naprawa elektryki", "Przegląd przed zakupem motocykla", "Przygotowanie do sezonu", "Naprawa po awarii", "Inna usługa"],
    fuelLabel: "Silnik / rodzaj napędu",
    serviceLabel: "Jaka usługa motocyklowa?",
  },
  van: {
    label: "Dostawczy",
    brands: ["Mercedes-Benz Vans", "Volkswagen Commercial Vehicles", "Ford", "Renault", "Peugeot", "Citroen", "Fiat", "Opel", "Iveco", "MAN", "Toyota", "Nissan", "Maxus", "Inna marka"],
    models: {
      "Mercedes-Benz Vans": ["Sprinter", "Vito", "Viano", "Citan", "Klasa V"],
      "Volkswagen Commercial Vehicles": ["Caddy", "Transporter", "Caravelle", "Multivan", "Crafter", "Amarok"],
      Ford: ["Transit", "Transit Custom", "Transit Connect", "Transit Courier", "Ranger"],
      Renault: ["Kangoo", "Trafic", "Master", "Express Van"],
      Peugeot: ["Partner", "Expert", "Boxer", "Rifter"],
      Citroen: ["Berlingo", "Jumpy", "Jumper", "SpaceTourer"],
      Fiat: ["Doblo", "Scudo", "Talento", "Ducato", "Fiorino"],
      Opel: ["Combo", "Vivaro", "Movano", "Zafira Life"],
      Iveco: ["Daily", "Eurocargo"],
      MAN: ["TGE"],
      Toyota: ["Proace", "Proace City", "Hilux"],
      Nissan: ["NV200", "NV300", "NV400", "Primastar", "Interstar", "Navara"],
      Maxus: ["Deliver 3", "Deliver 9", "eDeliver 3", "eDeliver 9"],
      "Inna marka": ["Inny model"],
    },
    fuels: ["Diesel", "Benzyna", "LPG", "Hybryda", "Elektryczny", "Nie wiem"],
    services: ["Wymiana oleju i filtrów", "Diagnostyka komputerowa", "Hamulce", "Zawieszenie", "Sprzęgło", "Rozrząd", "Turbina", "Układ paliwowy", "DPF / EGR", "Akumulator", "Wymiana opon dostawczych", "Geometria kół", "Klimatyzacja", "Przegląd przed trasą", "Naprawa po awarii", "Serwis floty", "Inna usługa"],
    fuelLabel: "Silnik / paliwo",
    serviceLabel: "Jaka usługa dla pojazdu dostawczego?",
  },
};

export function getVehicleTypeLabel(vehicleType: string) {
  return vehicleTypeOptions.find((item) => item.key === vehicleType)?.label ?? vehicleType;
}

export function getVehicleBrands(vehicleType: string) {
  return vehicleData[vehicleType as VehicleTypeKey]?.brands ?? [];
}

export function getVehicleModels(vehicleType: string, brand: string) {
  const models = vehicleData[vehicleType as VehicleTypeKey]?.models[brand] ?? [];
  return models.includes("Inny model") ? models : [...models, "Inny model"];
}

export function getVehicleFuels(vehicleType: string) {
  return vehicleData[vehicleType as VehicleTypeKey]?.fuels ?? [];
}

export function getVehicleServices(vehicleType: string) {
  return vehicleData[vehicleType as VehicleTypeKey]?.services ?? [];
}

export function getAllServiceOptions() {
  const allServices = Object.values(vehicleData).flatMap((config) => config.services);
  return Array.from(new Set(allServices)).sort((a, b) => a.localeCompare(b, "pl"));
}

export function getVehicleYears(maxYear = new Date().getFullYear() + 1, minYear = 1955) {
  return Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(maxYear - i));
}
