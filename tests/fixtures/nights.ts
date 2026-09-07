/**
 * Zamrożone dane pogodowe do testów briefu.
 *
 * Prawdziwa prognoza zmienia się co kilka godzin, więc test na niej nie
 * odpowiada na pytanie „czy silnik liczy to samo, co wczoraj" — odpowiada na
 * „jaka jest dziś pogoda". Te zestawy są stałe i każdy jest osobnym przypadkiem
 * werdyktu: noc czysta, noc pod chmurami i noc wietrzna.
 */

import type { NightHour, NightSlice } from '../../src/lib/weather.ts';

type HourShape = Partial<NightHour>;

/** Godziny okna nocy co pełną godzinę, wszystkie o tych samych warunkach. */
function hours(from: Date, count: number, shape: HourShape): NightHour[] {
  return Array.from({ length: count }, (_, i) => ({
    at: new Date(from.getTime() + i * 3_600_000),
    cloud: 0,
    cloudLow: 0,
    cloudHigh: 0,
    humidity: 70,
    temperature: 8,
    dewSpread: 4,
    precipitation: 0,
    windGust: 10,
    ...shape,
  }));
}

function night(from: Date, to: Date, shape: HourShape): NightSlice {
  const count = Math.round((to.getTime() - from.getTime()) / 3_600_000) + 1;
  return { night: { from, to }, hours: hours(from, count, shape) };
}

/**
 * Styczeń, noc z piątku na sobotę. Data nie jest przypadkowa: przy pracy
 * następnego dnia silnik odrzuca całą dwunastogodzinną styczniową noc za brak
 * snu, choćby niebo było bez jednej chmury — a fikstura ma sprawdzać werdykt
 * pogodowy, nie regułę kalendarza. 16 stycznia 2026 to piątek.
 */
const at = (day: number, hour: number) => new Date(2026, 0, day, hour, 0, 0, 0);

export const CLEAR_NIGHT = night(at(16, 18), at(17, 6), { cloud: 5, cloudLow: 0, cloudHigh: 5 });

export const CLOUDY_NIGHT = night(at(17, 18), at(18, 6), {
  cloud: 90,
  cloudLow: 80,
  cloudHigh: 40,
  humidity: 95,
  dewSpread: 0.5,
});

export const WINDY_NIGHT = night(at(18, 18), at(19, 6), {
  cloud: 5,
  windGust: 55,
});

export const THREE_NIGHTS: NightSlice[] = [CLEAR_NIGHT, CLOUDY_NIGHT, WINDY_NIGHT];
