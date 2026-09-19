import { useMemo } from 'react';

import { ACTIVE_SITE_ID } from '@/lib/where-text';
import type { NightPlace } from '@/store/night-place';
import { useSettings, type ActiveLocation } from '@/store/settings';

export type BookingSite = { id: string; name: string; lat: number; lon: number };

/**
 * Miejsce, pod którym zapisuje się rezerwacja danej nocy.
 *
 * Z niego liczy się identyfikator wpisu, więc każdy ekran musi liczyć go tak
 * samo — inaczej ta sama noc dostałaby w kalendarzu dwa wpisy. Każda noc ma
 * swoje miejsce, więc rezerwacja idzie pod miejsce **tej** nocy. `null` —
 * noc spoza rankingu (zapowiedź zjawiska): wtedy twoja pozycja.
 */
export function bookingSiteOf(
  place: NightPlace | null,
  active: ActiveLocation,
  placeId: string,
): BookingSite {
  const { lat, lon } = place?.coords ?? active.coords;
  const name = place?.label ?? active.label;

  // Miejscówka z katalogu ma własne, stałe id.
  if (place && place.id !== ACTIVE_SITE_ID) return { id: place.id, name, lat, lon };

  // Pozycja z GPS nie ma stałego id, więc wszystkie dzielą jeden klucz —
  // ta sama noc z dwóch punktów GPS to i tak jeden wyjazd.
  return { id: active.source === 'gps' ? 'gps' : placeId, name, lat, lon };
}

export function useBookingSite(place: NightPlace | null): BookingSite {
  const { active, placeId } = useSettings();
  return useMemo(() => bookingSiteOf(place, active, placeId), [place, active, placeId]);
}
