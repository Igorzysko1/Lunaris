import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { EMPTY_JOURNAL, type Journal, type NightLog } from '@/lib/journal';
import { loadJournal, saveNightLog, saveTimeline } from '@/lib/journal-store';
import type { SessionTimeline } from '@/lib/session-timeline';

type JournalState = { journal: Journal; readable: boolean; loaded: boolean };

/**
 * Subskrybenci zapisów. Arkusz zamknięcia nocy jest formSheetem nad zakładką,
 * a zakładka pod nim nie zawsze dostaje focus po jego zamknięciu — lista nocy
 * ma się zmienić od razu, a nie dopiero po przełączeniu zakładek.
 */
const listeners = new Set<(journal: Journal) => void>();

function publish(journal: Journal) {
  for (const listener of listeners) listener(journal);
}

/** Zapis nocy z powiadomieniem ekranów. `null`, gdy dziennika nie dało się bezpiecznie nadpisać. */
export async function saveLog(log: NightLog): Promise<Journal | null> {
  const updated = await saveNightLog(log);
  if (updated) publish(updated);
  return updated;
}

/** Zapis przebiegu nocy poprawionego we wpisie. */
export async function saveEntryTimeline(
  night: Parameters<typeof saveTimeline>[0],
  timeline: SessionTimeline,
): Promise<Journal | null> {
  const updated = await saveTimeline(night, timeline);
  if (updated) publish(updated);
  return updated;
}

/**
 * Dziennik z dysku, odświeżany przy każdym wejściu na ekran i po każdym
 * zapisie z tej aplikacji. `readable: false` znaczy, że zapisu nie dało się
 * odczytać — wtedy nic go nie nadpisze.
 */
export function useJournal(): JournalState {
  const [state, setState] = useState<JournalState>({
    journal: EMPTY_JOURNAL,
    readable: true,
    loaded: false,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadJournal().then(({ journal, readable }) => {
        if (active) setState({ journal, readable, loaded: true });
      });
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    const listener = (journal: Journal) => setState({ journal, readable: true, loaded: true });
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}
