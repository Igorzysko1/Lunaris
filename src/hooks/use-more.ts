import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { CONSTELLATIONS } from '@/data/constellations';
import { DEEP_SKY_OBJECTS } from '@/data/deep-sky';
import { findPlaceById, nearestPlace } from '@/data/places';
import { useJournal } from '@/hooks/use-journal';
import { useNow } from '@/hooks/use-now';
import { hourLabel, leadLabel } from '@/lib/calendar-text';
import {
  bookingCalendarIdOf,
  effectiveCalendarIds,
  writableCalendars,
  type CalendarInfo,
} from '@/lib/calendar';
import { rateLimitCooldown } from '@/lib/daily-cycle';
import { formatTime } from '@/lib/date';
import { formatAge, listForecasts, type StoredForecast } from '@/lib/forecast-cache';
import { googleCalendars, type CalendarsResult } from '@/lib/google-account';
import { plural } from '@/lib/journal-text';
import { exportJournalToFile } from '@/lib/journal-store';
import { profileLabel } from '@/lib/optics';
import { useForecast } from '@/store/forecast';
import { useGoogle } from '@/store/google';
import { useSettings } from '@/store/settings';

/** Zapisane prognozy, czytane przy każdym wejściu na ekran. */
function useStoredForecasts(): StoredForecast[] | null {
  const [list, setList] = useState<StoredForecast[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listForecasts().then((found) => {
        if (active) setList(found);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return list;
}

/**
 * Więcej: każdy wiersz niesie bieżącą wartość w drugiej linijce — widać, co jest
 * ustawione, bez wchodzenia na podstronę.
 */
export function useMore() {
  const { config, active, autoLocation, notifications, leadTime, theme } = useSettings();
  const google = useGoogle();
  const { journal } = useJournal();
  const { cycle } = useForecast();
  const forecasts = useStoredForecasts();
  const now = useNow();
  const [exported, setExported] = useState<string | null>(null);

  const home = config.observer.homePlaceId
    ? (findPlaceById(config.observer.homePlaceId)?.name ?? null)
    : null;
  const { conditions, observer } = config;
  const nights = journal.logs.length;

  return {
    equipment: config.opticsProfiles.map(profileLabel).join(' · '),
    thresholds: `chmury ${conditions.maxCloudTotal}% · wiatr ${conditions.maxWindGustKmh} km/h · Księżyc ${conditions.maxMoonIllumination}%`,
    observer: [
      home ?? 'bez punktu startowego',
      `${observer.averageSpeedKmh} km/h`,
      `marsz do ${observer.walkToleranceMin} min`,
      `sen min. ${String(observer.minSleepHours).replace('.', ',')} h`,
    ].join(' · '),
    location: autoLocation ? `GPS · ${active.label}` : active.label,
    notifications: notifications
      ? `przegląd o ${hourLabel(config.refresh.hourOfDay)} · wyprzedzenie ${leadLabel(leadTime)}`
      : 'wyłączone',
    google: !google.available
      ? 'niedostępny w tym buildzie'
      : google.connected === null
        ? 'sprawdzam…'
        : google.connected
          ? 'połączony'
          : 'nie połączony',
    libraryTargets: String(DEEP_SKY_OBJECTS.length),
    libraryConstellations: String(CONSTELLATIONS.length),
    journal: `${nights} ${plural(nights, ['noc', 'noce', 'nocy'])} · JSON, ten sam co na dysku`,
    exported,
    exportJournal: async () => {
      const path = await exportJournalToFile();
      setExported(
        path ? `Zapisano kopię: ${path}` : 'Eksport się nie powiódł — dziennik jest nietknięty.',
      );
    },
    forecasts:
      forecasts === null
        ? 'sprawdzam…'
        : forecasts.length === 0
          ? 'pusto'
          : `${forecasts.length} ${plural(forecasts.length, ['zapis', 'zapisy', 'zapisów'])} · ostatni ${formatAge(forecasts[0].savedAt, now)}`,
    nightMode:
      theme.mode === 'red'
        ? `czerwony · jasność ${theme.brightness}%`
        : theme.auto
          ? 'zwykły ciemny · czerwony sam po zmierzchu'
          : 'zwykły ciemny',
    about: cycle.lastSuccessAt
      ? `ostatnie pobranie ${formatAge(cycle.lastSuccessAt, now)}`
      : 'źródła, wersja, stan pobierania',
  };
}

/** Więcej › Prognozy w pamięci: zapisy i stan cyklu pobierania. */
export function useForecastsInMemory() {
  const { cycle, refresh, refreshing } = useForecast();
  const forecasts = useStoredForecasts();
  const now = useNow();
  const cooldown = rateLimitCooldown(cycle, now);

  return {
    loading: forecasts === null,
    rows: (forecasts ?? []).map((f) => ({
      key: `${f.scope}-${f.coords.lat}-${f.coords.lon}`,
      place: nearestPlace(f.coords).name,
      detail: `${f.scope === 'site' ? 'katalog miejsc' : 'Noc'} · ${f.coords.lat.toFixed(2)}, ${f.coords.lon.toFixed(2)} · ${formatAge(f.savedAt, now)}`,
      stale: f.stale,
    })),
    lastSuccess: cycle.lastSuccessAt ? formatAge(cycle.lastSuccessAt, now) : 'jeszcze nie było',
    lastAttempt: cycle.lastAttemptAt ? formatAge(cycle.lastAttemptAt, now) : 'jeszcze nie było',
    lastError: cycle.lastError,
    refresh,
    refreshLabel: refreshing
      ? 'pobieram…'
      : cooldown
        ? `spróbuję po ${formatTime(cooldown)}`
        : 'Odśwież teraz',
    refreshBlocked: refreshing || cooldown !== null,
  };
}

/**
 * Kalendarz Google: które kalendarze wyznaczają pobudkę i do którego trafiają
 * rezerwacje. Ostatniego zaznaczonego nie da się odznaczyć — „żaden kalendarz"
 * to wolny poranek z definicji, czyli pomyłka, przed którą integracja ma chronić.
 */
export function useCalendarChoices(enabled: boolean) {
  const { config, updateConfig } = useSettings();
  const [result, setResult] = useState<CalendarsResult | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    void googleCalendars().then((value) => {
      if (active) setResult(value);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  if (!enabled || !result || result.status !== 'ok') {
    return {
      status: !enabled ? ('off' as const) : !result ? ('loading' as const) : result.status,
      pickedFromConfig: config.calendar.calendarIds !== null,
      calendars: [],
      writable: [],
      onlyOne: false,
    };
  }

  const chosen = new Set(effectiveCalendarIds(config.calendar.calendarIds, result.calendars));
  const bookingTarget = bookingCalendarIdOf(config.calendar.bookingCalendarId, result.calendars);

  const toggle = (calendar: CalendarInfo) => {
    const next = new Set(chosen);
    if (next.has(calendar.id)) {
      if (next.size === 1) return;
      next.delete(calendar.id);
    } else {
      next.add(calendar.id);
    }
    updateConfig('calendar', { calendarIds: [...next] });
  };

  return {
    status: 'ok' as const,
    pickedFromConfig: config.calendar.calendarIds !== null,
    onlyOne: chosen.size === 1,
    calendars: result.calendars.map((calendar) => ({
      id: calendar.id,
      name: calendar.name,
      hint: [
        calendar.primary ? 'główny' : calendar.accessRole === 'reader' ? 'subskrypcja' : 'własny',
        calendar.id === bookingTarget ? 'tu trafiają rezerwacje' : null,
      ]
        .filter(Boolean)
        .join(' · '),
      chosen: chosen.has(calendar.id),
      locked: chosen.size === 1 && chosen.has(calendar.id),
      toggle: () => toggle(calendar),
    })),
    writable: writableCalendars(result.calendars).map((calendar) => ({
      id: calendar.id,
      name: calendar.name,
      selected: calendar.id === bookingTarget,
      // Główny zapisujemy jako brak wyboru: gdyby konto zmieniło adres, `null`
      // dalej wskaże główny, a zapisany identyfikator — już nie.
      choose: () => {
        if (calendar.id !== bookingTarget) {
          updateConfig('calendar', { bookingCalendarId: calendar.primary ? null : calendar.id });
        }
      },
    })),
  };
}
