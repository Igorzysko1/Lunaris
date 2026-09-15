import { useMemo, useState } from 'react';

import type { Constellation } from '@/data/constellations';
import { constellationsTonight, describeWhereToLook } from '@/lib/constellations';
import { parseNightId } from '@/lib/journal';
import { currentNightWindow, nightWindow } from '@/lib/night-window';
import { useSettings } from '@/store/settings';

/**
 * „Gdzie szukać" w panelu gwiazdozbioru: najwyższe położenie w nocy wybranej
 * w Niebie, a bez niej — w nocy bieżącej. Zdanie z `describeWhereToLook`.
 */
export function useConstellationTonight(constellation: Constellation, nightId?: string): string {
  const { active } = useSettings();
  const [now] = useState(() => new Date());
  const { lat, lon } = active.coords;

  return useMemo(() => {
    const coords = { lat, lon };
    const evening = nightId ? parseNightId(nightId) : null;
    const night = evening ? nightWindow(evening, coords) : currentNightWindow(now, coords);
    const [entry] = constellationsTonight(night, coords, [constellation]);

    return entry
      ? describeWhereToLook(entry)
      : 'Tej nocy nie wychodzi wyżej niż 20° — kształtu nie da się rozpoznać.';
  }, [constellation, nightId, lat, lon, now]);
}
