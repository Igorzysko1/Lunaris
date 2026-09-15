import { useEffect, useState } from 'react';

import { togglePick, type NightPicks } from '@/lib/night-picks';
import { loadNightPicks, saveNightPicks } from '@/lib/night-picks-store';

/** Subskrybenci zmian — panel celu jest arkuszem nad Niebem, a lista ma się zmienić od razu. */
const listeners = new Set<(picks: NightPicks) => void>();

/** Dopisuje cel do planu nocy albo go zdejmuje. `false`, gdy zapis się nie udał. */
export async function togglePlanPick(nightId: string, targetId: string): Promise<boolean> {
  const next = togglePick(await loadNightPicks(), nightId, targetId, new Date());
  if (!(await saveNightPicks(next))) return false;

  for (const listener of listeners) listener(next);
  return true;
}

/** Cele dopisane ręcznie do planów nocy, odświeżane po każdym dopisaniu z tej aplikacji. */
export function useNightPicks(): NightPicks {
  const [picks, setPicks] = useState<NightPicks>({});

  useEffect(() => {
    let active = true;
    void loadNightPicks().then((loaded) => {
      if (active) setPicks(loaded);
    });
    listeners.add(setPicks);
    return () => {
      active = false;
      listeners.delete(setPicks);
    };
  }, []);

  return picks;
}
