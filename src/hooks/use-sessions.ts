import { useMemo } from 'react';

import type { AstroEvent } from '@/data/events';
import { findPlaceById } from '@/data/places';
import { useCalendarDays } from '@/hooks/use-calendar-days';
import { nextDayWith } from '@/lib/calendar';
import { upcomingEvents } from '@/lib/events';
import { planNights, type PlannedNight } from '@/lib/night-plan';
import { assumedNextDay } from '@/lib/session-engine';
import { useForecast } from '@/store/forecast';
import { useNightPlace } from '@/store/night-place';
import { useSettings } from '@/store/settings';

export type Session = PlannedNight;

export type SessionsStatus = 'loading' | 'ready' | 'error';

/**
 * Najbliższe noce z werdyktem: jechać czy nie, a jeśli nie, to dlaczego —
 * **każda dla swojego miejsca**, zwycięzcy jej rankingu albo przypiętego.
 *
 * Sam werdykt liczy `planNights`, wspólny z cyklem: to, co widać na ekranie,
 * i to, o czym cykl powiadamia, musi być tym samym rachunkiem. Noce liczymy
 * pojedynczo, bo każda może mieć inne miejsce — z numerem nocy przekazanym
 * dalej, żeby dalekie noce nadal dostawały swoje „orientacyjnie".
 *
 * Pobudka pochodzi z Kalendarza Google, gdy konto jest połączone i poranek
 * udało się pobrać; w każdym innym przypadku — z założenia w konfiguracji.
 */
export function useSessions() {
  const { config } = useSettings();
  const { places } = useNightPlace();
  const { status, savedAt, refresh, refreshing } = useForecast();

  const homePlace = config.observer.homePlaceId ? findPlaceById(config.observer.homePlaceId) : null;
  const home = homePlace ? { lat: homePlace.lat, lon: homePlace.lon } : null;

  const mornings = useMemo(() => places.map((place) => place.slice.night.to), [places]);
  const calendar = useCalendarDays(mornings, config.calendar.calendarIds);

  const sessions = useMemo<Session[]>(() => {
    const nextDay = nextDayWith(calendar, (night) => assumedNextDay(night, config));
    // Zjawiska raz na miejsce, nie raz na noc: kilka nocy bywa w tym samym.
    const eventsAt = new Map<string, AstroEvent[]>();

    return places.map((place, index) => {
      const key = `${place.coords.lat},${place.coords.lon}`;
      let events = eventsAt.get(key);
      if (!events) {
        events = upcomingEvents(new Date(), place.coords, places.length + 1);
        eventsAt.set(key, events);
      }

      const [session] = planNights({
        nights: [place.slice],
        target: place.coords,
        home,
        config,
        bortle: place.bortle,
        walkMinutes: place.walkMinutes,
        events,
        nextDay,
        startIndex: index,
      });
      return session;
    });
    // Werdykt jest funkcją danych, konfiguracji i efemeryd — nie sieci. `home`
    // rozbite na współrzędne, bo obiekt dostaje nową tożsamość przy każdym
    // renderze store'u, a liczy się sama pozycja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, config, home?.lat, home?.lon, calendar]);

  return {
    status,
    sessions,
    /** Miejsce każdej nocy — ta sama kolejność co `sessions`. */
    places,
    savedAt,
    refresh,
    refreshing,
    /** Czy choć jeden poranek policzono z prawdziwego kalendarza. */
    calendar: calendar !== null && calendar.size > 0,
  };
}
