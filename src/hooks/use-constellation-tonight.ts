import { useMemo, useState } from 'react';

import type { Constellation } from '@/data/constellations';
import { useNow } from '@/hooks/use-now';
import { constellationsTonight, describeWhereToLook } from '@/lib/constellations';
import { formatTime } from '@/lib/date';
import { parseNightId } from '@/lib/journal';
import { currentNightWindow, nightWindow } from '@/lib/night-window';
import { objectsInConstellation, skyOrientation } from '@/lib/sky-library';
import { libraryReach } from '@/lib/sky-targets';
import { useSettings } from '@/store/settings';

const decimal = (value: number) => value.toFixed(1).replace('.', ',');

/**
 * Panel gwiazdozbioru: gdzie szukać w nocy wybranej w Niebie (bez niej —
 * w bieżącej), jak figura stoi nad horyzontem teraz i które obiekty katalogu
 * leżą w jego granicach.
 *
 * Obrót to kąt paralaktyczny środka gwiazdozbioru. Gdy gwiazdozbiór jest pod
 * horyzontem, figura staje tak, jak w chwili najwyższego położenia tej nocy.
 */
export function useConstellationView(constellation: Constellation, nightId?: string) {
  const { active, config } = useSettings();
  const now = useNow();
  const [opened] = useState(() => new Date());
  const { lat, lon } = active.coords;

  const tonight = useMemo(() => {
    const coords = { lat, lon };
    const evening = nightId ? parseNightId(nightId) : null;
    const night = evening ? nightWindow(evening, coords) : currentNightWindow(opened, coords);
    return constellationsTonight(night, coords, [constellation])[0] ?? null;
  }, [constellation, nightId, lat, lon, opened]);

  const targets = useMemo(
    () =>
      objectsInConstellation(constellation.id).map((object) => ({
        id: object.id,
        designation: `${object.designation} ${object.name}`,
        detail: `${object.kind}, ${decimal(object.magnitude)} mag`,
        reach: config.opticsProfiles.some(
          (p) => libraryReach(object, p.optics, active.bortle) === null,
        ),
      })),
    [constellation.id, config.opticsProfiles, active.bortle],
  );

  const current = skyOrientation(constellation, { lat, lon }, now);
  const up = current.altitude > 0;
  const shown =
    up || !tonight ? current : skyOrientation(constellation, { lat, lon }, tonight.bestAt);

  return {
    where: tonight
      ? describeWhereToLook(tonight)
      : 'Tej nocy nie wychodzi wyżej niż 20° — kształtu nie da się rozpoznać.',
    skyRotation: Math.round(shown.rotation),
    orientation: up
      ? `jak teraz · ${Math.round(current.altitude)}° nad horyzontem`
      : tonight
        ? `pod horyzontem — ułożenie o ${formatTime(tonight.bestAt)}`
        : 'pod horyzontem',
    targets,
  };
}
