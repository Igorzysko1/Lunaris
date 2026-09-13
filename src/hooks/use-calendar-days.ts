import { useEffect, useState } from 'react';

import { dayKey, type CalendarDays } from '@/lib/calendar';
import { loadCalendarDays } from '@/lib/google-account';
import { useGoogle } from '@/store/google';

/**
 * Kalendarz poranków po podanych nocach — albo `null`, gdy go nie ma.
 *
 * `null` jest tu pełnoprawną odpowiedzią, a nie stanem przejściowym do
 * ukrycia: znaczy „licz z założenia". Werdykt pokazuje się więc od razu, a gdy
 * kalendarz dojdzie, przelicza się z prawdziwą pobudką — zamiast trzymać ekran
 * pusty do czasu odpowiedzi Google.
 *
 * `calendarIds` to wybór z konfiguracji (`null` — domyślne kalendarze konta).
 * Zmiana wyboru w Ustawieniach przelicza werdykt od razu.
 */
export function useCalendarDays(
  mornings: Date[],
  calendarIds: readonly string[] | null,
): CalendarDays | null {
  const { connected } = useGoogle();
  const key = `${mornings.map(dayKey).join(',')}|${calendarIds?.join(',') ?? ''}`;
  const empty = mornings.length === 0;
  const [loaded, setLoaded] = useState<{ key: string; days: CalendarDays | null } | null>(null);

  useEffect(() => {
    if (!connected || empty) return;

    let active = true;
    void loadCalendarDays(mornings, calendarIds).then((days) => {
      if (active) setLoaded({ key, days });
    });

    return () => {
      active = false;
    };
    // Poranki i kalendarze po kluczu: tablice dostają nową tożsamość przy każdym
    // renderze, a liczą się same dni i identyfikatory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, key]);

  // Kalendarz innego zestawu nocy albo innego wyboru kalendarzy nie może trafić
  // do werdyktu — ten przestałby wtedy być funkcją tego, co widać na ekranie.
  return connected && loaded?.key === key ? loaded.days : null;
}
