/**
 * Noc w liczbach do pokazania — to, czego sam werdykt nie niesie, a karta nocy potrzebuje.
 *
 * Werdykt mówi „jedź od 22:10 do 02:40" i dlaczego nie inaczej. Karta pokazuje
 * więcej: gdzie w tej nocy leży okno, kiedy wschodzi Księżyc, jak nisko schodzą
 * chmury. To rachunek na tych samych godzinach prognozy, więc mieszka tutaj,
 * a nie w widoku — zdania z `session-text` cytują te liczby dosłownie.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import * as SunCalc from 'suncalc';

import type { Coords } from '../data/places.ts';
import type { LunarisConfig } from './config.ts';
import { formatTime } from './date.ts';
import { nightWindLimit, type PlannedNight } from './night-plan.ts';
import type { NightWindow } from './night-window.ts';
import { cloudBelowHigh, type NightVerdict } from './session-engine.ts';
import type { NightHour, NightSlice } from './weather.ts';

export type MoonOverNight = {
  /** Oświetlenie tarczy (%) — liczone tak samo jak w `planNights`, od początku nocy. */
  illumination: number;
  /**
   * Kiedy jest nad horyzontem w obrębie osi nocy; `null`, gdy ani na chwilę.
   *
   * Jeden przedział, nie lista: zachód wieczorem i ponowny wschód przed świtem
   * zdarzają się zimą, ale karta i tak zaznacza tylko pierwszy — to on
   * rozstrzyga, czy Księżyc przeszkodzi sesji, która zaczyna się po zmierzchu.
   */
  up: NightWindow | null;
  rise: Date | null;
  set: Date | null;
};

export type CloudSummary = {
  average: number;
  min: number;
  /** Pierwsza godzina z najmniejszym zachmurzeniem. */
  minAt: Date;
  max: number;
};

export type NightSummary = {
  /** Oś karty: od zachodu do wschodu Słońca. */
  axis: NightWindow;
  /** Noc astronomiczna — dopiero w niej niebo jest naprawdę ciemne. */
  dark: NightWindow;
  moon: MoonOverNight;
  /** Chmury w oknie sesji przy „jedź", w całej nocy przy „odpuść". `null` bez godzin. */
  clouds: CloudSummary | null;
  /** Najmniejszy zapas temperatury nad punktem rosy w oknie sesji (K). */
  minDewSpread: number | null;
  /**
   * Wielkość, która odrzuciła noc, w jej najlepszej godzinie — razem z progiem.
   *
   * Wypełnione tylko wtedy, gdy przekracza próg w **każdej** godzinie nocy.
   * Silnik podaje najczęstszą przeszkodę, a nie jedyną: noc może odpaść raz
   * przez chmury, raz przez wiatr. Wtedy zdanie „chmury nie schodzą poniżej
   * X% ani na godzinę" byłoby nieprawdą, więc go nie budujemy.
   */
  blocking: { value: number; limit: number } | null;
};

const isValid = (date: Date | null | undefined): date is Date =>
  date instanceof Date && !Number.isNaN(date.getTime());

const byTime = (a: Date, b: Date) => a.getTime() - b.getTime();

function noonOf(date: Date): Date {
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);
  return noon;
}

/**
 * Oś nocy od zachodu do wschodu Słońca.
 *
 * Noc astronomiczna jest węższa niż to, co widać na niebie: po zachodzie jest
 * jeszcze jasno, i to właśnie ma pokazać kreskowanie na początku paska. Gdy
 * efemerydy nie dają zachodu (koło podbiegunowe), oś zwęża się do nocy.
 */
export function sunAxis(dark: NightWindow, coords: Coords): NightWindow {
  const sunset = SunCalc.getTimes(noonOf(dark.from), coords.lat, coords.lon).sunset;
  const sunrise = SunCalc.getTimes(noonOf(dark.to), coords.lat, coords.lon).sunrise;

  return {
    from: isValid(sunset) && sunset <= dark.from ? sunset : dark.from,
    to: isValid(sunrise) && sunrise >= dark.to ? sunrise : dark.to,
  };
}

/** Księżyc w obrębie osi nocy: wschód, zachód i to, kiedy stoi nad horyzontem. */
export function moonOverNight(axis: NightWindow, coords: Coords, nightFrom: Date): MoonOverNight {
  const inAxis = (date: Date | undefined): date is Date =>
    isValid(date) && date >= axis.from && date <= axis.to;

  // `getMoonTimes` szuka w dobie kalendarzowej, a noc przechodzi przez północ.
  const days = [axis.from, axis.to].map((day) => SunCalc.getMoonTimes(day, coords.lat, coords.lon));
  const rise =
    days
      .map((d) => d.rise)
      .filter(inAxis)
      .sort(byTime)[0] ?? null;
  const set =
    days
      .map((d) => d.set)
      .filter(inAxis)
      .sort(byTime)[0] ?? null;

  const upAtStart = SunCalc.getMoonPosition(axis.from, coords.lat, coords.lon).altitude > 0;

  let up: NightWindow | null = null;
  if (upAtStart) up = { from: axis.from, to: set ?? axis.to };
  else if (rise) up = { from: rise, to: set && set > rise ? set : axis.to };

  return {
    illumination: Math.round(SunCalc.getMoonIllumination(nightFrom).fraction * 100),
    up,
    rise,
    set,
  };
}

function cloudsOver(hours: NightHour[]): CloudSummary | null {
  if (hours.length === 0) return null;

  const lowest = hours.reduce((best, hour) => (hour.cloud < best.cloud ? hour : best));
  const sum = hours.reduce((total, hour) => total + hour.cloud, 0);

  return {
    average: Math.round(sum / hours.length),
    min: Math.round(lowest.cloud),
    minAt: lowest.at,
    max: Math.round(Math.max(...hours.map((h) => h.cloud))),
  };
}

/** Wielkość i próg, na których padł werdykt — te same, którymi liczy silnik. */
function blockingFor(
  verdict: NightVerdict,
  hours: NightHour[],
  config: LunarisConfig,
): NightSummary['blocking'] {
  const rejection = verdict.rejection;
  if (rejection?.kind !== 'conditions' || hours.length === 0) return null;

  const { conditions } = config;
  const measure: Record<typeof rejection.blocker, [(hour: NightHour) => number, number]> = {
    'cloud-total': [cloudBelowHigh, conditions.maxCloudTotal],
    'cloud-low': [(h) => h.cloudLow, conditions.maxCloudLow],
    'cloud-high': [(h) => h.cloudHigh, conditions.maxCloudHigh],
    wind: [(h) => h.windGust, nightWindLimit(config)],
    precipitation: [(h) => h.precipitation, 0],
  };

  const [of, limit] = measure[rejection.blocker];
  const value = Math.min(...hours.map(of));
  // Wiatr odpada już na progu, pozostałe dopiero powyżej — tak jak w silniku.
  const everyHour = rejection.blocker === 'wind' ? value >= limit : value > limit;

  return everyHour ? { value, limit } : null;
}

export function summarizeNight({
  slice,
  planned,
  coords,
  config,
}: {
  slice: NightSlice;
  planned: PlannedNight;
  coords: Coords;
  config: LunarisConfig;
}): NightSummary {
  const { verdict } = planned;
  const dark = slice.night;
  const axis = sunAxis(dark, coords);

  const inNight = slice.hours.filter((h) => h.at >= dark.from && h.at <= dark.to);
  const window = verdict.window;
  const inWindow = window ? inNight.filter((h) => h.at >= window.from && h.at <= window.to) : [];

  return {
    axis,
    dark,
    moon: moonOverNight(axis, coords, dark.from),
    clouds: cloudsOver(window ? inWindow : inNight),
    minDewSpread: inWindow.length ? Math.min(...inWindow.map((h) => h.dewSpread)) : null,
    blocking: blockingFor(verdict, inNight, config),
  };
}

/** Położenie chwili na osi nocy jako ułamek szerokości; `null` poza osią. */
export function positionOnAxis(axis: NightWindow, at: Date): number | null {
  if (at < axis.from || at > axis.to) return null;
  return (at.getTime() - axis.from.getTime()) / (axis.to.getTime() - axis.from.getTime());
}

export type NightBar = {
  darkFrom: number;
  windowFrom: number;
  windowTo: number;
  /** Księżyc nad horyzontem od–do; oba 1, gdy nie wschodzi ani na chwilę. */
  moonRise: number;
  moonSet: number;
  labels: { start: string; moon: string; end: string };
  /** Sam zachód, bez podpisu — gdy obok stoi już „teraz". */
  sunset: string;
};

/**
 * Geometria paska nocy: ułamki szerokości i podpisy osi. Karta werdyktu podaje
 * okno sesji, panel celu — odcinek, w którym cel stoi nad horyzontem.
 */
export function nightBar(
  summary: Pick<NightSummary, 'axis' | 'dark' | 'moon'>,
  window: NightWindow,
): NightBar {
  const { axis, dark, moon } = summary;
  const at = (date: Date) =>
    Math.min(1, Math.max(0, positionOnAxis(axis, date) ?? (date < axis.from ? 0 : 1)));

  const moonLabel =
    moon.rise && moon.up?.from.getTime() === moon.rise.getTime()
      ? `${formatTime(moon.rise)} ☾`
      : moon.set && moon.up?.to.getTime() === moon.set.getTime()
        ? `☾ ${formatTime(moon.set)}`
        : '';

  return {
    darkFrom: at(dark.from),
    windowFrom: at(window.from),
    windowTo: at(window.to),
    moonRise: moon.up ? at(moon.up.from) : 1,
    moonSet: moon.up ? at(moon.up.to) : 1,
    labels: {
      start: `${formatTime(axis.from)} zachód`,
      moon: moonLabel,
      end: formatTime(axis.to),
    },
    sunset: formatTime(axis.from),
  };
}
