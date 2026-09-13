import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { monthCells, type CalendarEvent } from '@/lib/calendar-view';
import { loadRangeEvents } from '@/lib/google-account';
import { useGoogle } from '@/store/google';

export type MonthStatus = 'disconnected' | 'loading' | 'ready' | 'error';

/**
 * Wydarzenia widocznego miesiąca — całej siatki, łącznie z dniami sąsiednich
 * miesięcy, które na niej stoją.
 *
 * Przy odświeżaniu poprzednie wydarzenia tego samego miesiąca zostają na
 * ekranie: siatka nie ma migać pustką przy każdym powrocie na zakładkę.
 */
export function useCalendarMonth(
  cursor: Date,
  calendarIds: readonly string[] | null,
  bookingCalendarId: string | null,
) {
  const { connected } = useGoogle();
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const range = `${year}-${month}|${calendarIds?.join(',') ?? ''}|${bookingCalendarId ?? ''}`;

  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{
    range: string;
    revision: number;
    events: CalendarEvent[] | null;
  } | null>(null);

  const reload = useCallback(() => setRevision((r) => r + 1), []);

  // Powrót na zakładkę pobiera kalendarz od nowa: rezerwacja z karty nocy albo
  // zmiana w samym Google mają być widoczne bez ręcznego odświeżania. Pierwsze
  // wejście pomijamy, bo to samo pobranie robi już efekt poniżej.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setRevision((r) => r + 1);
    }, []),
  );

  useEffect(() => {
    if (!connected) return;

    let active = true;
    void (async () => {
      const cells = monthCells(year, month);
      const last = cells[cells.length - 1].date;
      const from = cells[0].date;
      const to = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);

      const events = await loadRangeEvents(from, to, calendarIds, bookingCalendarId);
      if (active) setLoaded({ range, revision, events });
    })();

    return () => {
      active = false;
    };
    // Kalendarze po kluczu `range`: tablica dostaje nową tożsamość przy każdym
    // renderze, a liczą się same identyfikatory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, range, revision]);

  const current = connected && loaded?.range === range ? loaded : null;
  const known = current !== null && current.events !== null;

  const status: MonthStatus = !connected
    ? 'disconnected'
    : current === null || current.revision !== revision
      ? 'loading'
      : known
        ? 'ready'
        : 'error';

  return { events: current?.events ?? [], known, status, reload };
}
