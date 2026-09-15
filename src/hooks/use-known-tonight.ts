import { useMemo } from 'react';

import { constellationsTonight } from '@/lib/constellations';
import { formatTime } from '@/lib/date';
import { horizonOf } from '@/lib/horizon';
import { moonOverNight, sunAxis } from '@/lib/night-summary';
import { currentNightWindow } from '@/lib/night-window';
import { describeMoonTonight } from '@/lib/session-text';
import { nightTargetsForProfiles, visibleOnce } from '@/lib/sky-targets';
import { useNow } from '@/hooks/use-now';
import { useSettings } from '@/store/settings';

/** Ilu celów imiennie — reszta jest liczbą, bo to ekran awaryjny, nie lista. */
const NAMED_TARGETS = 2;

/**
 * „Co i tak wiadomo" (13a): to, co nie zależy od prognozy.
 *
 * Zmierzch, świt, Księżyc, cele i gwiazdozbiory liczą się z efemeryd, miejsca
 * i sprzętu — bez sieci. Ekran bez prognozy traci werdykt i pogodę, ale nie noc.
 */
export function useKnownTonight() {
  const { active, config } = useSettings();
  const now = useNow();
  const { lat, lon } = active.coords;

  const night = currentNightWindow(now, { lat, lon });
  const nightKey = night.from.getTime();

  return useMemo(() => {
    const coords = { lat, lon };
    const moon = moonOverNight(sunAxis(night, coords), coords, night.from);

    const targets = visibleOnce(
      nightTargetsForProfiles(
        night,
        coords,
        config.opticsProfiles,
        active.bortle,
        horizonOf(active.horizonMask, active.horizonOverrides),
      ),
    );

    return {
      dusk: formatTime(night.from),
      dawn: formatTime(night.to),
      moon: describeMoonTonight(moon),
      targetsCount: targets.length,
      targets: targets.slice(0, NAMED_TARGETS).map((target) => ({
        id: target.id,
        name: target.name.replace(' — ', ' '),
        altitude: `${Math.round(target.maxAltitude)}° o ${formatTime(target.bestAt)}`,
      })),
      constellations: constellationsTonight(night, coords).length,
    };
    // Noc zmienia się o świcie, nie co minutę — wystarczy jej początek.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    nightKey,
    lat,
    lon,
    config.opticsProfiles,
    active.bortle,
    active.horizonMask,
    active.horizonOverrides,
  ]);
}
