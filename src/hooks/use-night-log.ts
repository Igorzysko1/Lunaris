import { useMemo, useState } from 'react';

import { horizonOf } from '@/lib/horizon';
import { nightLogId, orderByHistory, parseNightId, type Journal } from '@/lib/journal';
import { moonAt } from '@/lib/moon';
import { lastObservedNight, nightDaysBefore, nightWindow } from '@/lib/night-window';
import { profileLabel } from '@/lib/optics';
import { nightTargetsForProfiles, visibleOnce } from '@/lib/sky-targets';
import { useForecast } from '@/store/forecast';
import { useSettings } from '@/store/settings';

/**
 * Jak daleko wstecz wolno cofnąć zapis. Dwa tygodnie, bo dalej pamięć o tym,
 * co było widać, przestaje być danymi — a dziennik istnieje po to, żeby stroić
 * progi, nie żeby uzupełniać kalendarz.
 */
export const MAX_DAYS_BACK = 14;

/**
 * Noc do zapisania w arkuszu „Jak było?" i to, co aplikacja o niej wiedziała:
 * cele w zasięgu uporządkowane historią, Księżyc i najmniejszy zapas nad
 * punktem rosy z prognozy — o ile ta noc jeszcze w prognozie jest.
 *
 * Bez identyfikatora to noc, która właśnie się skończyła albo trwa; z nim —
 * noc edytowanego wpisu. `daysBack` cofa od niej o kolejne doby.
 */
export function useNightLog(id: string | undefined, daysBack: number, journal: Journal) {
  const { active, config } = useSettings();
  const { bundle } = useForecast();
  const [now] = useState(() => new Date());
  const { lat, lon } = active.coords;

  const night = useMemo(() => {
    const coords = { lat, lon };
    const evening = id ? parseNightId(id) : null;
    const base = evening ? nightWindow(evening, coords) : lastObservedNight(now, coords);
    return nightDaysBefore(base, coords, daysBack);
  }, [id, daysBack, lat, lon, now]);

  const moonIllumination = useMemo(
    () => moonAt(night.from, lat, lon).illumination,
    [night, lat, lon],
  );

  const targets = useMemo(
    () =>
      orderByHistory(
        visibleOnce(
          nightTargetsForProfiles(
            night,
            { lat, lon },
            config.opticsProfiles,
            active.bortle,
            horizonOf(active.horizonMask, active.horizonOverrides),
          ),
        ),
        journal,
        { bortle: active.bortle, moonIllumination },
      ),
    [
      night,
      lat,
      lon,
      config.opticsProfiles,
      active.bortle,
      active.horizonMask,
      active.horizonOverrides,
      journal,
      moonIllumination,
    ],
  );

  const slice = bundle?.nights.find((s) => nightLogId(s.night.from) === nightLogId(night.from));
  const forecastMinSpread =
    slice && slice.hours.length > 0 ? Math.min(...slice.hours.map((h) => h.dewSpread)) : null;

  return {
    night,
    targets,
    moonIllumination,
    forecastMinSpread,
    equipment: config.opticsProfiles.map(profileLabel).join(' · '),
  };
}
