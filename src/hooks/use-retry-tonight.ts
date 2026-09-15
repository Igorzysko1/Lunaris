import { useMemo, useState } from 'react';

import { horizonOf } from '@/lib/horizon';
import { orderByHistory, type Journal } from '@/lib/journal';
import { moonAt } from '@/lib/moon';
import { currentNightWindow } from '@/lib/night-window';
import { nightTargetsForProfiles, visibleOnce } from '@/lib/sky-targets';
import { useSettings } from '@/store/settings';

/**
 * Cel, który kiedyś nie wyszedł, a dziś ma lepsze warunki — ciemniejsze niebo,
 * wyżej nad horyzontem albo słabszy Księżyc (`journal.conditionsImproved`).
 * `null`, gdy takiego nie ma. To jedyna podpowiedź, jaką dziennik daje sam.
 */
export function useRetryTonight(journal: Journal): string | null {
  const { active, config } = useSettings();
  const [now] = useState(() => new Date());
  const { lat, lon } = active.coords;

  return useMemo(() => {
    const coords = { lat, lon };
    const night = currentNightWindow(now, coords);
    const targets = visibleOnce(
      nightTargetsForProfiles(
        night,
        coords,
        config.opticsProfiles,
        active.bortle,
        horizonOf(active.horizonMask, active.horizonOverrides),
      ),
    );

    const retry = orderByHistory(targets, journal, {
      bortle: active.bortle,
      moonIllumination: moonAt(night.from, lat, lon).illumination,
    }).find((item) => item.rank === 'retry');

    return retry ? retry.target.name : null;
  }, [
    journal,
    now,
    lat,
    lon,
    config.opticsProfiles,
    active.bortle,
    active.horizonMask,
    active.horizonOverrides,
  ]);
}
