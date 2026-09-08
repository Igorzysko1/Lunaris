/**
 * Zapis danych sieciowych na dysku — podstawowe źródło odczytu, nie ratunek.
 *
 * Pierwotnie ten moduł był awaryjny: gdy sieć zawiedzie, pokaż ostatnią
 * prognozę. Wraz z cyklem dobowym role się odwracają. Ekran czyta z zapisu
 * **zawsze**, a sieć odzywa się raz na dobę, o porze podejmowania decyzji —
 * patrz `daily-cycle.ts`. Powód jest ten sam co wcześniej, tylko konsekwentnie
 * doprowadzony do końca: na Pustyni Błędowskiej zasięgu bywa zero, a to właśnie
 * tam aplikacja jest potrzebna.
 *
 * Do zapisu trafia **wyłącznie to, co przychodzi z sieci**. Efemerydy, fazy
 * Księżyca, cele i werdykty liczą się na urządzeniu w kilka milisekund —
 * zapisane byłyby tylko starsze, a werdykt zapisany po zmianie progu w
 * ustawieniach pokazywałby wynik sprzed tej zmiany.
 *
 * Zapis jest per lokalizacja i per źródło: nieudane pobranie jednego miejsca
 * nie kasuje pozostałych.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CycleState } from './daily-cycle';

const KEY_PREFIX = 'lunaris.forecast.';
/**
 * Stan cyklu jest per źródło, a nie jeden na aplikację: prognoza aktywnego
 * punktu i przegląd katalogu to dwa różne pobrania. Wspólny znacznik znaczyłby,
 * że udane pobranie jednego zamyka termin drugiemu.
 */
const CYCLE_KEY_PREFIX = 'lunaris.cycle.';

/**
 * Dwa progi zamiast jednego, bo to dwa różne pytania.
 *
 * `STALE_AFTER_HOURS` — od kiedy dane trzeba opatrzyć ostrzeżeniem. Przy
 * odświeżaniu raz na dobę zapis tuż przed kolejnym terminem ma prawie 24
 * godziny i jest zupełnie normalny; dopiero pominięty cykl znaczy, że coś nie
 * działa.
 *
 * `MAX_AGE_HOURS` — od kiedy nie warto ich pokazywać nawet z etykietą. Prognoza
 * godzinowa sprzed dwóch dób dotyczy nocy, które już minęły.
 */
export const STALE_AFTER_HOURS = 26;
export const MAX_AGE_HOURS = 48;

/**
 * Zaokrąglenie współrzędnych do ~1 km. Bez niego każdy drobny ruch GPS tworzyłby
 * nowy klucz i cache nigdy by nie trafiał.
 */
function keyFor(scope: string, coords: { lat: number; lon: number }): string {
  return `${KEY_PREFIX}${scope}.${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}`;
}

type Envelope<T> = { version: number; savedAt: string; payload: T };

// 2: godziny prognozy niosą pola pod ocenę seeingu. Zapis w starym kształcie
// dawałby seeing policzony z samych zer, czyli fałszywie idealny.
const VERSION = 2;

/** Data w formacie ISO — tylko takie napisy zamieniamy z powrotem na `Date`. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * `JSON.parse` nie zna dat: `Date` wychodzi z zapisu jako napis i wracałby jako
 * napis, więc każde `.getTime()` w silniku wywaliłoby się dopiero w locie.
 * Ożywiamy je centralnie, zamiast pisać osobny konwerter dla każdego kształtu
 * danych — struktury prognozy nie mają żadnego innego pola tekstowego.
 */
function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO_DATE.test(value) ? new Date(value) : value;
}

export function serialize<T>(payload: T, savedAt: Date): string {
  return JSON.stringify({ version: VERSION, savedAt: savedAt.toISOString(), payload });
}

export type CacheHit<T> = {
  payload: T;
  savedAt: Date;
  ageHours: number;
  /** Dane wciąż użyteczne, ale starsze niż jeden cykl — UI ma to powiedzieć wprost. */
  stale: boolean;
};

/**
 * Rozpakowuje zapis. Zwraca `null` zamiast rzucać: uszkodzony albo przestarzały
 * cache ma być niewidoczny, a nie wywracać ekran, który i tak działa bez niego.
 */
export function parse<T>(
  raw: string | null,
  now: Date,
  maxAgeHours = MAX_AGE_HOURS,
): CacheHit<T> | null {
  if (!raw) return null;

  let envelope: Envelope<T>;
  try {
    envelope = JSON.parse(raw, reviveDates) as Envelope<T>;
  } catch {
    return null;
  }

  if (envelope?.version !== VERSION) return null;

  // savedAt przeszło przez reviveDates, więc jest już obiektem Date.
  const savedAt = envelope.savedAt as unknown as Date;
  if (!(savedAt instanceof Date) || Number.isNaN(savedAt.getTime())) return null;

  const ageHours = (now.getTime() - savedAt.getTime()) / 3_600_000;
  // Zapis z przyszłości znaczy przestawiony zegar — też mu nie ufamy.
  if (ageHours < 0 || ageHours > maxAgeHours) return null;

  return { payload: envelope.payload, savedAt, ageHours, stale: ageHours > STALE_AFTER_HOURS };
}

export async function saveForecast<T>(
  scope: string,
  coords: { lat: number; lon: number },
  payload: T,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(scope, coords), serialize(payload, new Date()));
  } catch {
    // Brak miejsca albo odmowa zapisu nie może przewrócić ekranu — cache jest
    // udogodnieniem, nie warunkiem działania.
  }
}

export async function loadForecast<T>(
  scope: string,
  coords: { lat: number; lon: number },
): Promise<CacheHit<T> | null> {
  try {
    return parse<T>(await AsyncStorage.getItem(keyFor(scope, coords)), new Date());
  } catch {
    return null;
  }
}

/**
 * Które klucze zapisu są już bezużyteczne.
 *
 * Klucz zawiera zaokrąglone współrzędne, więc każdy wyjazd w nowe miejsce
 * zostawia nowy klucz — a dotąd nic ich nie kasowało. Wydzielone z operacji na
 * dysku, żeby dało się to sprawdzić testem bez AsyncStorage.
 */
export function expiredKeys(
  entries: readonly (readonly [string, string | null])[],
  now: Date,
  maxAgeHours = MAX_AGE_HOURS,
): string[] {
  return entries
    .filter(([key]) => key.startsWith(KEY_PREFIX))
    .filter(([, raw]) => parse(raw, now, maxAgeHours) === null)
    .map(([key]) => key);
}

/**
 * Kasuje przeterminowane zapisy. Wołane z cyklu, a nie przy starcie ekranu:
 * sprzątanie jest tanie, ale nie ma powodu robić go częściej niż raz na dobę.
 */
export async function pruneExpired(now: Date = new Date()): Promise<number> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(KEY_PREFIX));
    if (keys.length === 0) return 0;

    const stale = expiredKeys(await AsyncStorage.multiGet(keys), now);
    if (stale.length > 0) await AsyncStorage.multiRemove(stale);
    return stale.length;
  } catch {
    return 0;
  }
}

/** Stan cyklu przeżywa restart aplikacji — inaczej każdy start byłby zaległy. */
export async function saveCycleState(source: string, state: CycleState): Promise<void> {
  try {
    await AsyncStorage.setItem(CYCLE_KEY_PREFIX + source, JSON.stringify(state));
  } catch {
    // patrz saveForecast
  }
}

export async function loadCycleState(source: string): Promise<CycleState | null> {
  try {
    const raw = await AsyncStorage.getItem(CYCLE_KEY_PREFIX + source);
    if (!raw) return null;
    return JSON.parse(raw, reviveDates) as CycleState;
  } catch {
    return null;
  }
}

/**
 * Zdjęcie dnia NASA. Osobny klucz, bo to jedyne dane sieciowe niezwiązane
 * z miejscem: obowiązuje je ten sam zapis, ale nie ta sama współrzędna.
 */
const APOD_KEY = 'lunaris.apod';

/**
 * Zdjęcie dnia zmienia się raz na dobę, więc zapis starszy niż doba i tak nie
 * jest już „dniem dzisiejszym". Trzymamy go mimo to trochę dłużej: stare zdjęcie
 * z podpisaną datą jest lepsze niż pusta dziura po wyjeździe bez zasięgu.
 */
const APOD_MAX_AGE_HOURS = 72;

export async function saveApod<T>(payload: T): Promise<void> {
  try {
    await AsyncStorage.setItem(APOD_KEY, serialize(payload, new Date()));
  } catch {
    // patrz saveForecast
  }
}

export async function loadApod<T>(): Promise<CacheHit<T> | null> {
  try {
    return parse<T>(await AsyncStorage.getItem(APOD_KEY), new Date(), APOD_MAX_AGE_HOURS);
  } catch {
    return null;
  }
}

/** np. „sprzed 3 godzin" — do etykiety nad danymi z zapisu. */
export function formatAge(savedAt: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - savedAt.getTime()) / 60_000));

  if (minutes < 1) return 'sprzed chwili';
  if (minutes < 60) return `sprzed ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours === 1) return 'sprzed godziny';
  // 2–4 godziny, 22–24 godziny: „godziny”. Pozostałe: „godzin”.
  const lastDigit = hours % 10;
  const plural =
    lastDigit >= 2 && lastDigit <= 4 && (hours < 12 || hours > 14) ? 'godziny' : 'godzin';
  return `sprzed ${hours} ${plural}`;
}
