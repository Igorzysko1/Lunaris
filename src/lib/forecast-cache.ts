/**
 * Ostatnia udana prognoza, zapisana na dysku.
 *
 * Powód jest terenowy: na Pustyni Błędowskiej zasięgu bywa zero, a to właśnie
 * tam aplikacja jest potrzebna. Bez zapisu ekran Noc pokazuje wtedy komunikat
 * o błędzie i nic więcej, choć dane sprzed dwóch godzin są w pełni użyteczne —
 * prognoza godzinowa nie zmienia się co kwadrans.
 *
 * Zapis jest per lokalizacja: podczas jazdy w teren zmienia się punkt, a stare
 * dane z innego miejsca byłyby gorsze niż ich brak.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'lunaris.forecast.';

/** Po tym czasie dane przestają cokolwiek znaczyć i wolimy pokazać błąd. */
export const MAX_AGE_HOURS = 12;

/**
 * Zaokrąglenie współrzędnych do ~1 km. Bez niego każdy drobny ruch GPS tworzyłby
 * nowy klucz i cache nigdy by nie trafiał.
 */
function keyFor(scope: string, coords: { lat: number; lon: number }): string {
  return `${KEY_PREFIX}${scope}.${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}`;
}

type Envelope<T> = { version: number; savedAt: string; payload: T };

const VERSION = 1;

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

export type CacheHit<T> = { payload: T; savedAt: Date };

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

  return { payload: envelope.payload, savedAt };
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
