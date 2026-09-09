/**
 * Okno nocy dla danego miejsca — wspólna podstawa wszystkich pytań o widoczność.
 *
 * Osobny moduł, bo korzystają z niego zarówno generatory eventów księżycowych
 * i meteorowych, jak i planetarne. Trzymanie go w jednym z nich robiłoby cykl
 * importów.
 *
 * Import względny (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import * as SunCalc from 'suncalc';

import type { Coords } from '../data/places.ts';

const HOUR_MS = 3_600_000;

/** Okno nocy: od zmierzchu do świtu. Poza rachunkiem nie ma sensu pytać o widoczność. */
export type NightWindow = { from: Date; to: Date };

const isValidDate = (d: Date | null | undefined): d is Date =>
  d instanceof Date && !isNaN(d.getTime());

/**
 * Południe danej doby, opcjonalnie przesunięte o całe dni.
 *
 * Dni dodajemy kalendarzowo, a nie przez dorzucenie 24 godzin: w dobie zmiany
 * czasu na zimowy jest ich 25, więc `+ DAY_MS` zostawiało tę samą datę i noc
 * kończyła się nad ranem tego samego dnia, w którym się zaczynała.
 */
function noonOf(date: Date, offsetDays = 0): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

/**
 * Noc **zaczynająca się** wieczorem podanego dnia.
 *
 * Preferujemy zmierzch astronomiczny (Słońce 18° pod horyzontem), bo dopiero wtedy
 * niebo jest naprawdę ciemne. W Polsce od maja do lipca on nie zapada w ogóle —
 * wtedy schodzimy na zmierzch nawigacyjny, a w ostateczności na zachód Słońca,
 * zamiast zwracać „brak nocy" i chować event, który realnie da się zobaczyć.
 */
export function nightWindow(date: Date, coords: Coords): NightWindow {
  const evening = SunCalc.getTimes(noonOf(date), coords.lat, coords.lon);
  const morning = SunCalc.getTimes(noonOf(date, 1), coords.lat, coords.lon);

  const from = [evening.night, evening.nauticalDusk, evening.sunset].find(isValidDate);
  const to = [morning.nightEnd, morning.nauticalDawn, morning.sunrise].find(isValidDate);

  // Za kołem podbiegunowym potrafi zabraknąć obu — bierzemy wtedy umowne 22–04.
  if (!from || !to) {
    const start = noonOf(date);
    start.setHours(22, 0, 0, 0);
    return { from: start, to: new Date(start.getTime() + 6 * HOUR_MS) };
  }

  return { from, to };
}

/**
 * Noc **trwająca** w danym momencie.
 *
 * O drugiej w nocy „dziś" to wciąż noc, która zaczęła się wczoraj wieczorem —
 * `nightWindow(new Date())` pokazałoby wtedy noc oddaloną o kolejne dwadzieścia
 * godzin. Ten sam wybór robi prognoza w src/lib/weather.ts, więc karta oceny nocy
 * i lista celów mówią o tej samej nocy.
 */
export function currentNightWindow(now: Date, coords: Coords): NightWindow {
  const previous = nightWindow(noonOf(now, -1), coords);
  return now < previous.to ? previous : nightWindow(now, coords);
}

/**
 * Noc, którą warto zapisać w dzienniku: ta, która właśnie się skończyła, albo
 * ta, która właśnie trwa.
 *
 * `currentNightWindow` po świcie przeskakuje na noc **nadchodzącą** i to jest
 * właściwe dla prognozy, ale nie dla dziennika: rano po obserwacji pytanie
 * dotyczy tego, co było, a nie tego, co będzie. Zapisu można dokonać także
 * o trzeciej w nocy, przed powrotem — wtedy trwająca noc jest tą właściwą.
 */
export function lastObservedNight(now: Date, coords: Coords): NightWindow {
  const current = currentNightWindow(now, coords);
  return now < current.from ? nightWindow(noonOf(now, -1), coords) : current;
}

/**
 * Noc oddalona o zadaną liczbę dób wstecz.
 *
 * Potrzebne dziennikowi: zapis powstaje czasem dzień czy dwa po powrocie, a do
 * wczoraj nie da się już dojść przez `lastObservedNight`, bo ta po zmierzchu
 * przeskakuje na noc bieżącą. Bez tego obserwacja sprzed doby jest nie do
 * wpisania — wyszło to dopiero przy pierwszym prawdziwym wyjeździe.
 *
 * Doby odejmujemy kalendarzowo, a nie przez 24 godziny: w dobie zmiany czasu
 * jest ich 23 albo 25, więc arytmetyka na milisekundach gubiłaby albo dublowała
 * noc raz na pół roku.
 */
export function nightDaysBefore(night: NightWindow, coords: Coords, daysBack: number): NightWindow {
  if (daysBack <= 0) return night;

  const evening = new Date(night.from);
  evening.setDate(evening.getDate() - daysBack);

  return nightWindow(evening, coords);
}

/** Próbki co 15 minut w oknie nocy — gęstość wystarczająca dla pytania „czy było widać". */
export function sampleNight(window: NightWindow): Date[] {
  const STEP_MS = 15 * 60_000;
  const samples: Date[] = [];
  for (let t = window.from.getTime(); t <= window.to.getTime(); t += STEP_MS) {
    samples.push(new Date(t));
  }
  return samples;
}
