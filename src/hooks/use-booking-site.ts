import { useMemo } from 'react';

import { useSettings } from '@/store/settings';

/**
 * Miejsce, pod którym zapisuje się rezerwacja nocy.
 *
 * Wspólne dla karty nocy i zakładki kalendarza, bo z niego liczy się
 * identyfikator wpisu. Dwa ekrany liczące go po swojemu rozjechałyby się przy
 * pierwszej zmianie — i ta sama noc dostałaby w kalendarzu dwa wpisy.
 */
export function useBookingSite() {
  const { active, placeId } = useSettings();
  const { lat, lon } = active.coords;

  return useMemo(
    () => ({
      // Pozycja z GPS nie ma stałego id, więc wszystkie dzielą jeden klucz —
      // ta sama noc z dwóch punktów GPS to i tak jeden wyjazd.
      id: active.source === 'gps' ? 'gps' : placeId,
      name: active.label,
      lat,
      lon,
    }),
    [active.source, active.label, placeId, lat, lon],
  );
}
