import AsyncStorage from '@react-native-async-storage/async-storage';

import { findPlaceById } from '@/data/places';
import { mergeConfig, type LunarisConfig } from '@/lib/config';
import { NOTIFY_CATEGORIES, type NotifyCategory } from '@/lib/event-review';
import type { PaletteMode } from '@/theme';

/**
 * Klucz jest wersjonowany, więc zmiana kształtu stanu nie wywraca aplikacji po
 * aktualizacji: nieznana wersja przechodzi przez migrację, a gdy się nie da —
 * po prostu wraca do wartości domyślnych.
 */
const STORAGE_KEY = 'lunaris.settings';

/**
 * v2 dołożyła optykę, v3 przeniosła ją do pełnej konfiguracji użytkownika,
 * v4 dołożyła motyw. Starsze zapisy przechodzą przez migrację, nie przez reset —
 * wybór miejscowości ma przeżyć aktualizację aplikacji.
 */
const CURRENT_VERSION = 4;

/** Wersje, z których umiemy odczytać dane. Wszystko inne to reset do domyślnych. */
const READABLE_VERSIONS = [1, 2, 3, 4];

export type LeadTime = '1h' | '2h' | '6h' | '12h';

export const LEAD_TIMES: LeadTime[] = ['1h', '2h', '6h', '12h'];

/** Wyprzedzenie w godzinach — etykieta jest tekstem, a rachunek potrzebuje liczby. */
export function leadHours(value: LeadTime): number {
  return Number(value.slice(0, -1));
}

/**
 * Motyw: paleta, automat po zmierzchu i jasność ekranu w trybie czerwonym.
 *
 * Jasność siedzi razem z paletą, bo w terenie to jedno ustawienie w dwóch
 * polach — sam kolor bez zjazdu jasności adaptacji wzroku nie ratuje.
 */
export type ThemeSettings = {
  mode: PaletteMode;
  /** Czy tryb czerwony ma się włączać sam między zmierzchem a świtem. */
  auto: boolean;
  /** Jasność ekranu w procentach, stosowana tylko w trybie czerwonym. */
  brightness: number;
};

export const DEFAULT_THEME: ThemeSettings = { mode: 'dark', auto: false, brightness: 8 };

/**
 * Gotowe poziomy jasności zamiast suwaka: suwak w rękawicach, po ciemku,
 * przy 2% jasności ekranu jest nietrafialny, a pomyłka oślepia na kwadrans.
 */
export const BRIGHTNESS_STEPS = [2, 8, 20, 50];

/** To, co naprawdę trafia na dysk — bez pól wyliczanych i bez akcji. */
export type PersistedSettings = {
  placeId: string;
  autoLocation: boolean;
  notifications: boolean;
  leadTime: LeadTime;
  /** Kategorie powiadomień o zjawiskach — patrz `event-review.categoryOf`. */
  notifyCategories: NotifyCategory[];
  theme: ThemeSettings;
  /** Konfiguracja obserwatora: profil, optyka, tryb sesji, progi. Patrz src/lib/config.ts. */
  config: LunarisConfig;
};

type StoredEnvelope = { version: number } & Partial<PersistedSettings>;

function isLeadTime(value: unknown): value is LeadTime {
  return typeof value === 'string' && (LEAD_TIMES as string[]).includes(value);
}

function migrateTheme(raw: unknown, defaults: ThemeSettings): ThemeSettings {
  if (typeof raw !== 'object' || raw === null) return defaults;

  const stored = raw as Partial<ThemeSettings>;
  const brightness = Number(stored.brightness);

  return {
    mode: stored.mode === 'red' || stored.mode === 'dark' ? stored.mode : defaults.mode,
    auto: typeof stored.auto === 'boolean' ? stored.auto : defaults.auto,
    // Zero zgasiłoby ekran do niewidoczności, a zapisu nikt by nie cofnął —
    // aplikacja wstałaby z czarnym ekranem i bez sposobu, żeby to naprawić.
    brightness: Number.isFinite(brightness)
      ? Math.min(100, Math.max(1, brightness))
      : defaults.brightness,
  };
}

/**
 * Sprowadza dowolny zapis do aktualnego kształtu. Każde pole walidujemy osobno,
 * żeby jedna zepsuta wartość nie kasowała reszty ustawień.
 */
function migrate(raw: unknown, defaults: PersistedSettings): PersistedSettings {
  if (typeof raw !== 'object' || raw === null) return defaults;

  const stored = raw as StoredEnvelope & { optics?: unknown };

  if (typeof stored.version !== 'number' || !READABLE_VERSIONS.includes(stored.version)) {
    return defaults;
  }

  // v2 trzymała optykę na wierzchu koperty, a nie w konfiguracji. Przenosimy ją
  // w nowe miejsce zamiast gubić — reszta konfiguracji dostaje wartości domyślne.
  const configSource =
    stored.config ?? (stored.optics !== undefined ? { optics: stored.optics } : undefined);

  return {
    // Baza miejscowości może się zmienić między wydaniami — id sprzed migracji
    // danych nie ma prawa zostawić aplikacji bez lokalizacji.
    placeId:
      typeof stored.placeId === 'string' && findPlaceById(stored.placeId)
        ? stored.placeId
        : defaults.placeId,
    autoLocation:
      typeof stored.autoLocation === 'boolean' ? stored.autoLocation : defaults.autoLocation,
    notifications:
      typeof stored.notifications === 'boolean' ? stored.notifications : defaults.notifications,
    leadTime: isLeadTime(stored.leadTime) ? stored.leadTime : defaults.leadTime,
    notifyCategories: Array.isArray(stored.notifyCategories)
      ? stored.notifyCategories.filter((c): c is NotifyCategory =>
          (NOTIFY_CATEGORIES as readonly unknown[]).includes(c),
        )
      : defaults.notifyCategories,
    theme: migrateTheme(stored.theme, defaults.theme),
    config: mergeConfig(configSource),
  };
}

export async function loadSettings(defaults: PersistedSettings): Promise<PersistedSettings> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return defaults;
    return migrate(JSON.parse(json), defaults);
  } catch {
    // Uszkodzony JSON albo niedostępny storage — start na domyślnych jest lepszy
    // niż crash przy uruchomieniu.
    return defaults;
  }
}

export async function saveSettings(settings: PersistedSettings): Promise<void> {
  try {
    const envelope: StoredEnvelope = { version: CURRENT_VERSION, ...settings };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Zapis ustawień nie jest wart wywrócenia ekranu — przy następnej zmianie
    // spróbujemy ponownie.
  }
}
