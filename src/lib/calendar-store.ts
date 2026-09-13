/**
 * Zapis kalendarza na dysku — ostatnie udane pobranie każdego poranka.
 *
 * Cienka warstwa nad AsyncStorage. Wszystkie decyzje — co jest dość świeże, co
 * wypada z zapisu, jak ożywić daty — podejmuje `calendar.ts` i są pokryte
 * testami; tutaj zostaje samo wejście i wyjście.
 *
 * W zapisie nie ma treści kalendarza: tylko godziny i to, czy wpis zajmuje
 * czas, czyli dokładnie tyle, ile zna `CalendarEntry`. Tytuły, uczestnicy
 * i opisy nigdy nie opuszczają odpowiedzi Google.
 *
 * ## Zapis per zestaw kalendarzy
 *
 * Poranek policzony z trzech kalendarzy to co innego niż ten sam poranek
 * z jednego. Po zmianie wyboru w Ustawieniach stary zapis nie może udawać
 * nowego, więc klucz zawiera zestaw, a zapisanie nowego kasuje pozostałe.
 *
 * Nic tu nie rzuca. Zapis jest udogodnieniem na brak zasięgu, nie warunkiem
 * działania — bez niego silnik po prostu wraca do założenia.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  parseStore,
  serializeStore,
  updateStore,
  type CalendarEntry,
  type StoredCalendarDay,
} from './calendar';

const KEY_PREFIX = 'lunaris.calendar.days.';

/** Klucz z wersji bez wyboru kalendarzy — kasowany przy sprzątaniu. */
const LEGACY_KEY = 'lunaris.calendar.days';

const keyFor = (scope: string) => `${KEY_PREFIX}${scope}`;

const isCalendarKey = (key: string) => key === LEGACY_KEY || key.startsWith(KEY_PREFIX);

export async function loadStoredDays(scope: string): Promise<Map<string, StoredCalendarDay>> {
  try {
    return parseStore(await AsyncStorage.getItem(keyFor(scope)));
  } catch {
    return new Map();
  }
}

/** Dopisuje świeżo pobrane dni; przeterminowane i zapisy innych zestawów wypadają. */
export async function saveFreshDays(
  scope: string,
  fresh: ReadonlyMap<string, CalendarEntry[]>,
  now: Date = new Date(),
): Promise<void> {
  if (fresh.size === 0) return;

  try {
    const stored = await loadStoredDays(scope);
    await AsyncStorage.setItem(keyFor(scope), serializeStore(updateStore(stored, fresh, now)));

    const others = (await AsyncStorage.getAllKeys()).filter(
      (key) => isCalendarKey(key) && key !== keyFor(scope),
    );
    if (others.length > 0) await AsyncStorage.multiRemove(others);
  } catch {
    // Brak miejsca albo odmowa zapisu: następnym razem bez sieci zadziała
    // założenie, tak jak przed wprowadzeniem zapisu.
  }
}

/** Kasuje wszystkie zapisy — przy odłączeniu konta godziny jego wydarzeń nie mają zostać. */
export async function clearStoredDays(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(isCalendarKey);
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  } catch {
    // Nic do skasowania to ten sam stan, do którego dążymy.
  }
}
