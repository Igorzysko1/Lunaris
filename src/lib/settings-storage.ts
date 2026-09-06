import AsyncStorage from '@react-native-async-storage/async-storage';

import { findPlaceById } from '@/data/places';
import { DEFAULT_CONFIG, mergeConfig, type LunarisConfig } from '@/lib/config';

/**
 * Klucz jest wersjonowany, więc zmiana kształtu stanu nie wywraca aplikacji po
 * aktualizacji: nieznana wersja przechodzi przez migrację, a gdy się nie da —
 * po prostu wraca do wartości domyślnych.
 */
const STORAGE_KEY = 'lunaris.settings';

/**
 * v2 dołożyła optykę, v3 przeniosła ją do pełnej konfiguracji użytkownika.
 * Starsze zapisy przechodzą przez migrację, nie przez reset — wybór miejscowości
 * ma przeżyć aktualizację aplikacji.
 */
const CURRENT_VERSION = 3;

/** Wersje, z których umiemy odczytać dane. Wszystko inne to reset do domyślnych. */
const READABLE_VERSIONS = [1, 2, 3];

export type LeadTime = '1h' | '2h' | '6h' | '12h';

export const LEAD_TIMES: LeadTime[] = ['1h', '2h', '6h', '12h'];

/** To, co naprawdę trafia na dysk — bez pól wyliczanych i bez akcji. */
export type PersistedSettings = {
  placeId: string;
  autoLocation: boolean;
  notifications: boolean;
  leadTime: LeadTime;
  /** Konfiguracja obserwatora: profil, optyka, tryb sesji, progi. Patrz src/lib/config.ts. */
  config: LunarisConfig;
};

type StoredEnvelope = { version: number } & Partial<PersistedSettings>;

function isLeadTime(value: unknown): value is LeadTime {
  return typeof value === 'string' && (LEAD_TIMES as string[]).includes(value);
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
