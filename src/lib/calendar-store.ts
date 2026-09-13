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

const KEY = 'lunaris.calendar.days';

export async function loadStoredDays(): Promise<Map<string, StoredCalendarDay>> {
  try {
    return parseStore(await AsyncStorage.getItem(KEY));
  } catch {
    return new Map();
  }
}

/** Dopisuje świeżo pobrane dni; przeterminowane wypadają przy okazji. */
export async function saveFreshDays(
  fresh: ReadonlyMap<string, CalendarEntry[]>,
  now: Date = new Date(),
): Promise<void> {
  if (fresh.size === 0) return;

  try {
    const stored = await loadStoredDays();
    await AsyncStorage.setItem(KEY, serializeStore(updateStore(stored, fresh, now)));
  } catch {
    // Brak miejsca albo odmowa zapisu: następnym razem bez sieci zadziała
    // założenie, tak jak przed wprowadzeniem zapisu.
  }
}

/** Kasuje zapis — przy odłączeniu konta godziny jego wydarzeń nie mają zostać. */
export async function clearStoredDays(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nic do skasowania to ten sam stan, do którego dążymy.
  }
}
