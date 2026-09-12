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
 */
export function useCalendarDays(mornings: Date[]): CalendarDays | null {
  const { connected } = useGoogle();
  const key = mornings.map(dayKey).join(',');
  const [loaded, setLoaded] = useState<{ key: string; days: CalendarDays | null } | null>(null);

  useEffect(() => {
    if (!connected || key === '') return;

    let active = true;
    void loadCalendarDays(mornings).then((days) => {
      if (active) setLoaded({ key, days });
    });

    return () => {
      active = false;
    };
    // Poranki po kluczu: tablica dostaje nową tożsamość przy każdym renderze,
    // a liczą się same dni.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, key]);

  // Kalendarz innego zestawu nocy nie może trafić do werdyktu — ten przestałby
  // wtedy być funkcją tego, co widać na ekranie.
  return connected && loaded?.key === key ? loaded.days : null;
}
