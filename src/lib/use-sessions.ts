import { useCallback, useEffect, useState } from 'react';
import * as SunCalc from 'suncalc';

import { findPlaceById, type Coords } from '@/data/places';
import type { LunarisConfig } from '@/lib/config';
import { windLimitKmh } from '@/lib/optics';
import { nightTargetsForProfiles, type SkyTarget } from '@/lib/sky-targets';
import { evaluateNight, type NightVerdict } from '@/lib/session-engine';
import { fetchUpcomingNights } from '@/lib/weather';

/** Ile nocy pokazuje sekcja. Trzecia doba jest już orientacyjna — patrz `uncertain`. */
export const SESSION_NIGHTS = 3;

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

/** Kalendarz nie jest jeszcze podpięty — korzystamy z założenia z konfiguracji. */
function assumedNextDay(night: { to: Date }, config: LunarisConfig) {
  const morning = night.to;
  const dayOff =
    config.calendar.weekendDaysOff && (morning.getDay() === 0 || morning.getDay() === 6);

  const firstEventAt = new Date(morning);
  firstEventAt.setHours(config.calendar.assumedFirstEventHour, 0, 0, 0);

  return { firstEventAt: dayOff ? null : firstEventAt, dayOff };
}

/**
 * Trzy najbliższe noce z werdyktem: jechać czy nie, a jeśli nie, to dlaczego.
 *
 * Prognoza idzie jednym zapytaniem, resztę liczymy lokalnie — werdykt, plan
 * wyjazdu i cele są funkcją danych, konfiguracji i efemeryd, więc zmiana progu
 * albo apertury przelicza widok bez ponownego pobierania czegokolwiek.
 */
export function useSessions(coords: Coords, bortle: number, config: LunarisConfig) {
  const [status, setStatus] = useState<SessionsStatus>('loading');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  const { lat, lon } = coords;
  const homePlace = config.observer.homePlaceId
    ? findPlaceById(config.observer.homePlaceId)
    : null;
  const home = homePlace ? { lat: homePlace.lat, lon: homePlace.lon } : null;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setStatus('loading');

    fetchUpcomingNights({ lat, lon }, SESSION_NIGHTS, controller.signal)
      .then((slices) => {
        if (!active) return;

        setSessions(
          slices.map(({ night, hours }, index) => {
            const target = { lat, lon };
            const illumination = Math.round(
              SunCalc.getMoonIllumination(night.from).fraction * 100,
            );

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
              config,
            });

            const window = verdict.window;
            const inWindow = window
              ? hours.filter((h) => h.at >= window.from && h.at <= window.to)
              : [];

            return {
              verdict,
              minTemperature: inWindow.length
                ? Math.min(...inWindow.map((h) => h.temperature))
                : null,
              targets: window
                ? nightTargetsForProfiles(window, target, config.opticsProfiles, bortle)
                : [],
              uncertain: index >= UNCERTAIN_FROM_INDEX,
            };
          }),
        );
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
    // `config` i `home` zmieniają się razem z konfiguracją — przeliczenie widoku
    // po zmianie progu jest tu zamierzone.
  }, [lat, lon, bortle, config, home?.lat, home?.lon, attempt]);

  return { status, sessions, refresh };
}
