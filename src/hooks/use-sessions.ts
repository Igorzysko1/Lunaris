import { useMemo } from 'react';

import { findPlaceById, type Coords } from '@/data/places';
import type { LunarisConfig } from '@/lib/config';
import { upcomingEvents } from '@/lib/events';
import { planNights, type PlannedNight } from '@/lib/night-plan';
import { useForecast } from '@/store/forecast';

export type Session = PlannedNight;

export type SessionsStatus = 'loading' | 'ready' | 'error';

/**
 * Trzy najbliższe noce z werdyktem: jechać czy nie, a jeśli nie, to dlaczego.
 *
 * Prognoza przychodzi z cyklu dobowego — ten sam komplet danych, z którego
 * korzysta ekran Noc, więc sekcja sesji nie kosztuje drugiego żądania. Sam
 * werdykt liczy `planNights`, wspólny z cyklem: to, co widać na ekranie, i to,
 * o czym cykl powiadamia, musi być tym samym rachunkiem.
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

  // Zjawiska liczymy tylko na doby objęte prognozą, a nie na cały horyzont
  // sześćdziesięciu dni: silnikowi potrzebne są wyłącznie te, które wypadają
  // w ocenianych nocach.
  const events = useMemo(
    () => upcomingEvents(new Date(), { lat, lon }, (bundle?.nights.length ?? 0) + 1),
    [lat, lon, bundle],
  );

  const sessions = useMemo<Session[]>(() => {
    if (!bundle) return [];

    return planNights({
      nights: bundle.nights,
      target: { lat, lon },
      home,
      config,
      bortle,
      walkMinutes,
      events,
    });
    // Werdykt jest funkcją danych, konfiguracji i efemeryd — nie sieci. Zmiana
    // progu albo apertury przelicza go natychmiast, bez pobierania czegokolwiek.
    // `home` rozbite na współrzędne, bo obiekt dostaje nową tożsamość przy każdym
    // renderze store'u, a liczy się sama pozycja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, events, lat, lon, bortle, config, home?.lat, home?.lon, walkMinutes]);

  return { status, sessions, savedAt, refresh, refreshing };
}
