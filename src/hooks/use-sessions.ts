import { useMemo } from 'react';

import { findPlaceById, type Coords } from '@/data/places';
import { nextDayWith } from '@/lib/calendar';
import type { LunarisConfig } from '@/lib/config';
import { upcomingEvents } from '@/lib/events';
import { planNights, type PlannedNight } from '@/lib/night-plan';
import type { NightSlice } from '@/lib/weather';
import { assumedNextDay } from '@/lib/session-engine';
import { useCalendarDays } from '@/hooks/use-calendar-days';
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
 *
 * Pobudka pochodzi z Kalendarza Google, gdy konto jest połączone i poranek
 * udało się pobrać; w każdym innym przypadku — z założenia w konfiguracji.
 */
export function useSessions(
  coords: Coords,
  bortle: number,
  config: LunarisConfig,
  walkMinutes = 0,
  /**
   * Noce innego miejsca niż to z cyklu dobowego. Zakładka Noc liczy werdykt dla
   * **miejsca nocy**, które bywa miejscówką z katalogu, a nie punktem, w którym
   * stoisz — a prognozy miejscówek przynosi przegląd, nie ten cykl.
   */
  nights: NightSlice[] | null = null,
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

  const slices = nights ?? bundle?.nights ?? null;
  const mornings = useMemo(() => slices?.map((slice) => slice.night.to) ?? [], [slices]);
  const calendar = useCalendarDays(mornings, config.calendar.calendarIds);

  const sessions = useMemo<Session[]>(() => {
    if (!slices) return [];

    return planNights({
      nights: slices,
      target: { lat, lon },
      home,
      config,
      bortle,
      walkMinutes,
      events,
      nextDay: nextDayWith(calendar, (night) => assumedNextDay(night, config)),
    });
    // Werdykt jest funkcją danych, konfiguracji i efemeryd — nie sieci. Zmiana
    // progu albo apertury przelicza go natychmiast, bez pobierania czegokolwiek.
    // `home` rozbite na współrzędne, bo obiekt dostaje nową tożsamość przy każdym
    // renderze store'u, a liczy się sama pozycja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slices, events, lat, lon, bortle, config, home?.lat, home?.lon, walkMinutes, calendar]);

  return {
    status,
    sessions,
    savedAt,
    refresh,
    refreshing,
    /** Czy choć jeden poranek policzono z prawdziwego kalendarza. */
    calendar: calendar !== null && calendar.size > 0,
  };
}
