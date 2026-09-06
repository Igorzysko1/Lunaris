import AsyncStorage from '@react-native-async-storage/async-storage';

import { findPlaceById } from '@/data/places';
import { DEFAULT_OPTICS, clampOptics, type Optics } from '@/lib/optics';

/**
 * Klucz jest wersjonowany, więc zmiana kształtu stanu nie wywraca aplikacji po
 * aktualizacji: nieznana wersja przechodzi przez migrację, a gdy się nie da —
 * po prostu wraca do wartości domyślnych.
 */
const STORAGE_KEY = 'lunaris.settings';

/** v2 dołożyła parametry optyki. Zapisy z v1 przechodzą przez migrację, nie przez reset. */
const CURRENT_VERSION = 2;

export type LeadTime = '1h' | '2h' | '6h' | '12h';

export const LEAD_TIMES: LeadTime[] = ['1h', '2h', '6h', '12h'];

/** To, co naprawdę trafia na dysk — bez pól wyliczanych i bez akcji. */
export type PersistedSettings = {
  placeId: string;
  autoLocation: boolean;
  notifications: boolean;
  leadTime: LeadTime;
  /** Parametry sprzętu — liczby, nie nazwa modelu. Patrz src/lib/optics.ts. */
  optics: Optics;
};

type StoredEnvelope = { version: number } & Partial<PersistedSettings>;

function isLeadTime(value: unknown): value is LeadTime {
  return typeof value === 'string' && (LEAD_TIMES as string[]).includes(value);
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Optyka z zapisu. Każde pole osobno, bo zepsuta apertura nie ma powodu kasować
 * zapisanego montażu; wartości spoza fizycznego sensu przycinamy do zakresu.
 */
function readOptics(raw: unknown, fallback: Optics): Optics {
  if (typeof raw !== 'object' || raw === null) return fallback;
  const stored = raw as Partial<Record<keyof Optics, unknown>>;

  return clampOptics({
    aperture: isFiniteNumber(stored.aperture) ? stored.aperture : fallback.aperture,
    magnification: isFiniteNumber(stored.magnification)
      ? stored.magnification
      : fallback.magnification,
    fieldOfView: isFiniteNumber(stored.fieldOfView) ? stored.fieldOfView : fallback.fieldOfView,
  });
}

/**
 * Sprowadza dowolny zapis do aktualnego kształtu. Każde pole walidujemy osobno,
 * żeby jedna zepsuta wartość nie kasowała reszty ustawień.
 */
function migrate(raw: unknown, defaults: PersistedSettings): PersistedSettings {
  if (typeof raw !== 'object' || raw === null) return defaults;

  const stored = raw as StoredEnvelope;

  // v1 nie znała optyki, ale reszta pól ma ten sam kształt — wybór miejscowości
  // i powiadomień zostaje, sprzęt dostaje wartości domyślne.
  if (stored.version !== CURRENT_VERSION && stored.version !== 1) return defaults;

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
    optics: readOptics(stored.optics, defaults.optics),
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
