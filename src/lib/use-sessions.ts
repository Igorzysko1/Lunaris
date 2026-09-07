import { useMemo } from 'react';
import * as SunCalc from 'suncalc';

import { findPlaceById, type Coords } from '@/data/places';
import type { LunarisConfig } from '@/lib/config';
import { windLimitKmh } from '@/lib/optics';
import { nightTargetsForProfiles, type SkyTarget } from '@/lib/sky-targets';
import { assumedNextDay, evaluateNight, type NightVerdict } from '@/lib/session-engine';
import { useForecast } from '@/store/forecast';

/**
 * Od czwartej doby modele pogodowe rozjeżdżają się na tyle, że werdykt „jedź"
 * byłby obietnicą bez pokrycia. Trzecią nocy nie ukrywamy, tylko oznaczamy.
 */
const UNCERTAIN_FROM_INDEX = 2;

export type Session = {
  verdict: NightVerdict;
  /** Najniższa temperatura w oknie obserwacyjnym — do decyzji, jak się ubrać. */
  minTemperature: number | null;
  /** Cele w zasięgu któregokolwiek z zestawów. Puste, gdy nocy nie ma. */
  targets: SkyTarget[];
  /** Prognoza na tę dobę jest już orientacyjna. */
  uncertain: boolean;
};

export type SessionsStatus = 'loading' | 'ready' | 'error';

/**
 * Trzy najbliższe noce z werdyktem: jechać czy nie, a jeśli nie, to dlaczego.
 *
 * Prognoza przychodzi z cyklu dobowego — ten sam komplet danych, z którego
 * korzysta ekran Noc, więc sekcja sesji nie kosztuje drugiego żądania. Resztę
 * liczymy lokalnie.
 */
export function useSessions(
  coords: Coords,
  bortle: number,
  config: LunarisConfig,
  walkMinutes = 0,
) {
  const { bundle, status, savedAt, refresh, refreshing } = useForecast();

  const { lat, lon } = coords;
  const homePlace = config.observer.homePlaceId ? findPlaceById(config.observer.homePlaceId) : null;
  const home = homePlace ? { lat: homePlace.lat, lon: homePlace.lon } : null;

  const sessions = useMemo<Session[]>(() => {
    if (!bundle) return [];

    return bundle.nights.map(({ night, hours }, index) => {
      const target = { lat, lon };
      const illumination = Math.round(SunCalc.getMoonIllumination(night.from).fraction * 100);

      // Okno oceniamy najłagodniejszym progiem wiatru spośród zestawów —
      // noc dobra dla sprzętu na statywie nie ma przepadać przez to, że
      // w konfiguracji stoi obok niego lornetka trzymana z ręki.
      const windLimit = Math.max(
        ...config.opticsProfiles.map((p) =>
          windLimitKmh(p.optics, {
            tripod: config.conditions.maxWindGustKmh,
            handheld: config.conditions.maxWindGustHandheldKmh,
          }),
        ),
      );

      const verdict = evaluateNight({
        night,
        hours,
        moon: {
          illumination,
          upAt: (at) => SunCalc.getMoonPosition(at, lat, lon).altitude > 0,
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
        targets: window
          ? nightTargetsForProfiles(window, target, config.opticsProfiles, bortle)
          : [],
        uncertain: index >= UNCERTAIN_FROM_INDEX,
      };
    });
    // Werdykt jest funkcją danych, konfiguracji i efemeryd — nie sieci. Zmiana
    // progu albo apertury przelicza go natychmiast, bez pobierania czegokolwiek.
    // `home` rozbite na współrzędne, bo obiekt dostaje nową tożsamość przy każdym
    // renderze store'u, a liczy się sama pozycja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, lat, lon, bortle, config, home?.lat, home?.lon, walkMinutes]);

  return { status, sessions, savedAt, refresh, refreshing };
}
