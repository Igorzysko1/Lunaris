import { useMemo } from 'react';

import { ACTIVE_SITE_ID } from '@/lib/where-text';
import { useNightPlace } from '@/store/night-place';
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
  // Rezerwujemy miejsce, o którym mówi werdykt — nie punkt, w którym stoisz.
  // Inaczej wpis w kalendarzu wiózłby w inne miejsce niż karta nocy.
  const { place } = useNightPlace();
  const { lat, lon } = place.coords;

  return useMemo(() => {
    // Miejscówka z katalogu ma własne, stałe id.
    if (place.id !== ACTIVE_SITE_ID) return { id: place.id, name: place.label, lat, lon };

    // Pozycja z GPS nie ma stałego id, więc wszystkie dzielą jeden klucz —
    // ta sama noc z dwóch punktów GPS to i tak jeden wyjazd.
    return { id: active.source === 'gps' ? 'gps' : placeId, name: place.label, lat, lon };
  }, [place.id, place.label, active.source, placeId, lat, lon]);
}
