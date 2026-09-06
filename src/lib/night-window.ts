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
const DAY_MS = 86_400_000;

/** Okno nocy: od zmierzchu do świtu. Poza rachunkiem nie ma sensu pytać o widoczność. */
export type NightWindow = { from: Date; to: Date };

const isValidDate = (d: Date | null | undefined): d is Date =>
  d instanceof Date && !isNaN(d.getTime());

function noonOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
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
  const morning = SunCalc.getTimes(noonOf(new Date(date.getTime() + DAY_MS)), coords.lat, coords.lon);

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

/** Próbki co 15 minut w oknie nocy — gęstość wystarczająca dla pytania „czy było widać". */
export function sampleNight(window: NightWindow): Date[] {
  const STEP_MS = 15 * 60_000;
  const samples: Date[] = [];
  for (let t = window.from.getTime(); t <= window.to.getTime(); t += STEP_MS) {
    samples.push(new Date(t));
  }
  return samples;
}
