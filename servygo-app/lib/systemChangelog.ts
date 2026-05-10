import type { LanguageCode } from "@/lib/translations";

export type SystemChangelogChangeType = "new" | "fix" | "important" | "info";
export type SystemChangelogAudience = "workshop" | "admin" | "all";

export type SystemChangelogEntry = {
  id: string;
  date: string;
  type: SystemChangelogChangeType;
  audience: SystemChangelogAudience;
  /** Zlokalizowany tytuł i krótki opis wpisu */
  copy: Record<LanguageCode, { title: string; description: string }>;
};

export const SYSTEM_CHANGELOG_ENTRIES: SystemChangelogEntry[] = [
  {
    id: "ws-mobile-sidebar",
    date: "2026-05-08",
    type: "new",
    audience: "workshop",
    copy: {
      pl: {
        title: "Menu boczne na urządzeniach mobilnych",
        description: "Dodano menu boczne w wersji mobilnej panelu warsztatu.",
      },
      en: {
        title: "Mobile sidebar menu",
        description: "Added a sidebar navigation pattern for mobile in the workshop panel.",
      },
      ua: {
        title: "Бічне меню на мобільних",
        description: "У мобільній версії панелі СТО з’явилося бічне меню.",
      },
    },
  },
  {
    id: "ws-languages",
    date: "2026-05-07",
    type: "new",
    audience: "workshop",
    copy: {
      pl: {
        title: "Obsługa języków PL / EN / UA",
        description: "Dodano lepszą obsługę języków w interfejsie panelu warsztatu.",
      },
      en: {
        title: "PL / EN / UA language support",
        description: "Improved language handling across the workshop panel UI.",
      },
      ua: {
        title: "Мови PL / EN / UA",
        description: "Покращено підтримку мов інтерфейсу панелі СТО.",
      },
    },
  },
  {
    id: "ws-supabase-hints",
    date: "2026-05-06",
    type: "info",
    audience: "workshop",
    copy: {
      pl: {
        title: "Komunikaty przy niepełnej konfiguracji",
        description: "Dodano komunikaty pomocnicze przy braku lub problemach z konfiguracją Supabase.",
      },
      en: {
        title: "Hints when backend is not configured",
        description: "Added helper messages when Supabase is missing or misconfigured.",
      },
      ua: {
        title: "Підказки щодо конфігурації",
        description: "Додано зрозумілі повідомлення, якщо Supabase не налаштовано або є проблеми.",
      },
    },
  },
  {
    id: "ws-system-news-scaffold",
    date: "2026-05-05",
    type: "important",
    audience: "workshop",
    copy: {
      pl: {
        title: "Pod aktualności systemowe",
        description: "Przygotowano strukturę pod przyszłe aktualności systemowe dla warsztatu.",
      },
      en: {
        title: "System news scaffold",
        description: "Prepared structure for upcoming in-app system announcements for workshops.",
      },
      ua: {
        title: "Оновлення системи (структура)",
        description: "Підготовлено структуру для майбутніх системних новин для СТО.",
      },
    },
  },
  {
    id: "adm-sidebar-i18n",
    date: "2026-05-08",
    type: "new",
    audience: "admin",
    copy: {
      pl: {
        title: "Tłumaczenia panelu administratora",
        description: "Dodano tłumaczenia etykiet menu bocznego w panelu administracyjnym.",
      },
      en: {
        title: "Admin sidebar translations",
        description: "Added translated labels for the administrator sidebar navigation.",
      },
      ua: {
        title: "Локалізація меню адміна",
        description: "Перекладено підписи бічного меню в панелі адміністратора.",
      },
    },
  },
  {
    id: "adm-stats-error-fallback",
    date: "2026-05-07",
    type: "fix",
    audience: "admin",
    copy: {
      pl: {
        title: "Komunikat błędu statystyk",
        description: "Dodano czytelny fallback komunikatu błędu przy pobieraniu statystyk pulpitu.",
      },
      en: {
        title: "Dashboard statistics error fallback",
        description: "Added a clearer fallback message when dashboard statistics fail to load.",
      },
      ua: {
        title: "Повідомлення про помилку статистики",
        description: "Додано зрозумілий запасний текст, якщо не вдається завантажити статистику.",
      },
    },
  },
  {
    id: "adm-system-messages-place",
    date: "2026-05-06",
    type: "info",
    audience: "admin",
    copy: {
      pl: {
        title: "Komunikaty systemowe dla administratora",
        description: "Przygotowano miejsce na komunikaty systemowe skierowane do administratorów.",
      },
      en: {
        title: "Space for administrator system messages",
        description: "Reserved UI space for system-level messages aimed at admins.",
      },
      ua: {
        title: "Системні повідомлення для адміна",
        description: "Підготовлено блок для системних повідомлень для адміністраторів.",
      },
    },
  },
  {
    id: "adm-languages",
    date: "2026-05-05",
    type: "new",
    audience: "admin",
    copy: {
      pl: {
        title: "Rozszerzenie obsługi języków",
        description: "Rozszerzono obsługę języków PL / EN / UA w częściach panelu administratora.",
      },
      en: {
        title: "Broader PL / EN / UA support",
        description: "Extended language handling in parts of the admin panel.",
      },
      ua: {
        title: "Розширена підтримка мов PL / EN / UA",
        description: "Розширено підтримку мов у розділах панелі адміністратора.",
      },
    },
  },
  {
    id: "all-realtime-banner",
    date: "2026-05-04",
    type: "info",
    audience: "all",
    copy: {
      pl: {
        title: "Lepszy kontekst w panelach ServyGo",
        description:
          "Dopracowywamy spójność komunikatów i języków we wszystkich rolach ServyGo (właściciel warsztatu, administrator).",
      },
      en: {
        title: "Clearer ServyGo panel messaging",
        description:
          "We're tightening consistency of messages and languages across ServyGo roles (workshop owner, administrator).",
      },
      ua: {
        title: "Узгоджені повідомлення в панелях",
        description:
          "Вирівнюємо повідомлення та мови для ролей ServyGo (власник СТО, адміністратор).",
      },
    },
  },
];

const MAX_ENTRIES = 5;

/** localStorage — ostatnio „oglądana” sygnatura changeloga dla warsztatu */
export const SERVYGO_SEEN_CHANGELOG_STORAGE_KEY_WORKSHOP = "servygo_seen_changelog_workshop";

/** localStorage — ostatnio „oglądana” sygnatura changeloga dla admina */
export const SERVYGO_SEEN_CHANGELOG_STORAGE_KEY_ADMIN = "servygo_seen_changelog_admin";

/** Wszystkie wpisy dla audience (bez limitu wyświetlania), stabilnie posortowane — do sygnatury „czy są nowinki”. */
export function getAllSystemChangelogEntriesForAudience(audience: "workshop" | "admin"): SystemChangelogEntry[] {
  return SYSTEM_CHANGELOG_ENTRIES.filter((entry) => entry.audience === audience || entry.audience === "all")
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

/**
 * Porównywany z wartością w localStorage – zmiana przy nowym lub zmienionym wpisie dla danego panelu.
 */
export function getSystemChangelogSignatureForAudience(audience: "workshop" | "admin"): string {
  return getAllSystemChangelogEntriesForAudience(audience)
    .map((e) => `${e.id}@${e.date}`)
    .join("|");
}

export function getSeenChangelogStorageKey(audience: "workshop" | "admin"): string {
  return audience === "workshop" ? SERVYGO_SEEN_CHANGELOG_STORAGE_KEY_WORKSHOP : SERVYGO_SEEN_CHANGELOG_STORAGE_KEY_ADMIN;
}

export function getLatestSystemChangelogForAudience(audience: "workshop" | "admin"): SystemChangelogEntry[] {
  return getAllSystemChangelogEntriesForAudience(audience).slice(0, MAX_ENTRIES);
}
