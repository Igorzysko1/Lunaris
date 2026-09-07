/**
 * Werdykty na kolejne noce — rachunek wspólny dla ekranu i dla cyklu dobowego.
 *
 * Dotąd żył w hooku `useSessions`, czyli był dostępny wyłącznie wtedy, gdy ktoś
 * patrzył na ekran. Przegląd zjawisk potrzebuje tych samych werdyktów raz na
 * dobę, bez udziału interfejsu: powiadomienie „jutro maksimum Perseid" ma sens
 * tylko razem z informacją, czy tej nocy w ogóle da się jechać.
 *
 * Funkcja jest czysta — dostaje prognozę i konfigurację, zwraca werdykty.
 * Dlatego zmiana progu przelicza je natychmiast i bez sieci, a ten sam rachunek
 * wykona CLI poza aplikacją.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import * as SunCalc from 'suncalc';

import type { Coords } from '../data/places.ts';
import type { LunarisConfig } from './config.ts';
import { windLimitKmh } from './optics.ts';
import { assumedNextDay, evaluateNight, type NightVerdict } from './session-engine.ts';
import { nightTargetsForProfiles, type SkyTarget } from './sky-targets.ts';
import type { NightSlice } from './weather.ts';

/**
 * Od czwartej doby modele pogodowe rozjeżdżają się na tyle, że werdykt „jedź"
 * byłby obietnicą bez pokrycia. Trzeciej nocy nie ukrywamy, tylko oznaczamy.
 */
const UNCERTAIN_FROM_INDEX = 2;

export type PlannedNight = {
  verdict: NightVerdict;
  /** Najniższa temperatura w oknie obserwacyjnym — do decyzji, jak się ubrać. */
  minTemperature: number | null;
  /** Cele w zasięgu któregokolwiek z zestawów. Puste, gdy nocy nie ma. */
  targets: SkyTarget[];
  /** Prognoza na tę dobę jest już orientacyjna. */
  uncertain: boolean;
};

export type NightPlanInput = {
  nights: NightSlice[];
  target: Coords;
  /** Punkt startowy; `null`, gdy użytkownik go nie ustawił. */
  home: Coords | null;
  config: LunarisConfig;
  bortle: number;
  walkMinutes: number;
};

export function planNights({
  nights,
  target,
  home,
  config,
  bortle,
  walkMinutes,
}: NightPlanInput): PlannedNight[] {
  // Okno oceniamy najłagodniejszym progiem wiatru spośród zestawów — noc dobra
  // dla sprzętu na statywie nie ma przepadać przez to, że w konfiguracji stoi
  // obok niego lornetka trzymana z ręki.
  const windLimit = Math.max(
    ...config.opticsProfiles.map((p) =>
      windLimitKmh(p.optics, {
        tripod: config.conditions.maxWindGustKmh,
        handheld: config.conditions.maxWindGustHandheldKmh,
      }),
    ),
  );

  return nights.map(({ night, hours }, index) => {
    const illumination = Math.round(SunCalc.getMoonIllumination(night.from).fraction * 100);

    const verdict = evaluateNight({
      night,
      hours,
      moon: {
        illumination,
        upAt: (at) => SunCalc.getMoonPosition(at, target.lat, target.lon).altitude > 0,
      },
      target,
      home,
      nextDay: assumedNextDay(night, config),
      // Kalendarz zjawisk nie jest jeszcze wpięty w silnik — dopóki nie jest,
      // żadna noc nie łamie reguły wczesnego poranka.
      uniquePhenomenon: false,
      windLimitKmh: windLimit,
      walkMinutes,
      config,
    });

    const window = verdict.window;
    const inWindow = window ? hours.filter((h) => h.at >= window.from && h.at <= window.to) : [];

    return {
      verdict,
      minTemperature: inWindow.length ? Math.min(...inWindow.map((h) => h.temperature)) : null,
      targets: window ? nightTargetsForProfiles(window, target, config.opticsProfiles, bortle) : [],
      uncertain: index >= UNCERTAIN_FROM_INDEX,
    };
  });
}
