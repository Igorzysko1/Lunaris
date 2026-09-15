/**
 * Segment Warunki: jaka będzie noc godzina po godzinie — chmury, wilgotność, rosa.
 *
 * Werdykt odpowiada na „czy jechać", Warunki pokazują, z czego ta odpowiedź
 * wynika. Liczymy na tych samych godzinach, które ocenia silnik: przy „jedź"
 * w oknie sesji, przy „odpuść" w całej nocy astronomicznej, bo okna wtedy nie ma.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { LunarisConfig } from './config.ts';
import type { OpticsProfile } from './optics.ts';
import { seeingCanLimit } from './seeing.ts';
import type { NightVerdict } from './session-engine.ts';
import type { NightSlice } from './weather.ts';

export type NightConditions = {
  /** Zachmurzenie w kolejnych godzinach nocy astronomicznej. */
  hours: { at: Date; cloud: number }[];
  /** Indeksy pierwszej i ostatniej godziny okna sesji w `hours`; `null` bez okna. */
  window: [number, number] | null;
  /** Najmniej chmur w całej nocy — podpis nad wykresem. */
  lowestCloud: { percent: number; at: Date } | null;
  /** Średnia wilgotność (%) w ocenianych godzinach. */
  humidity: number | null;
  /** Punkt rosy w najzimniejszej ocenianej godzinie (°C). */
  dewPoint: number | null;
  minTemperature: number | null;
  /** Najmniejszy zapas temperatury nad punktem rosy (K). */
  minDewSpread: number | null;
  /**
   * Suma opadów w całej nocy (mm), nie tylko w oknie: deszcz przed sesją
   * moczy sprzęt i drogę tak samo.
   */
  precipitation: number;
  /** Pierwsza oceniana godzina, w której zapas spada poniżej progu rosy. */
  dewFrom: Date | null;
};

export function nightConditions(
  slice: NightSlice,
  verdict: NightVerdict,
  config: LunarisConfig,
): NightConditions {
  const { night } = slice;
  const inNight = slice.hours
    .filter((h) => h.at >= night.from && h.at <= night.to)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const window = verdict.status === 'go' ? verdict.window : null;
  const inWindow = window ? inNight.filter((h) => h.at >= window.from && h.at <= window.to) : [];
  const rated = window ? inWindow : inNight;

  const first = window ? inNight.findIndex((h) => h.at >= window.from) : -1;
  const last = window ? inNight.map((h) => h.at <= window.to).lastIndexOf(true) : -1;

  const coldest = rated.length
    ? rated.reduce((low, h) => (h.temperature < low.temperature ? h : low))
    : null;
  const clearest = inNight.length
    ? inNight.reduce((low, h) => (h.cloud < low.cloud ? h : low))
    : null;

  return {
    hours: inNight.map((h) => ({ at: h.at, cloud: h.cloud })),
    window: first >= 0 && last >= first ? [first, last] : null,
    lowestCloud: clearest ? { percent: Math.round(clearest.cloud), at: clearest.at } : null,
    humidity: rated.length
      ? Math.round(rated.reduce((sum, h) => sum + h.humidity, 0) / rated.length)
      : null,
    dewPoint: coldest ? coldest.temperature - coldest.dewSpread : null,
    minTemperature: coldest?.temperature ?? null,
    minDewSpread: rated.length ? Math.min(...rated.map((h) => h.dewSpread)) : null,
    precipitation: inNight.reduce((sum, h) => sum + h.precipitation, 0),
    dewFrom: rated.find((h) => h.dewSpread < config.conditions.dewWarningSpreadC)?.at ?? null,
  };
}

/**
 * Zestaw, dla którego warto pokazać kartę seeingu — ten o największym
 * powiększeniu, o ile seeing w ogóle może go ograniczyć. `null`, gdy żaden:
 * przy samej lornetce seeing zostaje żetonem w werdykcie.
 */
export function seeingProfile(profiles: OpticsProfile[]): OpticsProfile | null {
  const strongest = [...profiles].sort(
    (a, b) => b.optics.magnification - a.optics.magnification,
  )[0];

  return strongest && seeingCanLimit(strongest.optics.magnification) ? strongest : null;
}
