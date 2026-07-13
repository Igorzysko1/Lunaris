import { useCallback, useEffect, useRef, useState } from 'react';

import { SCENARIOS, type NightData, type ScenarioKey } from '@/data/night';

export type NightStatus = 'loading' | 'ready' | 'error';

const REFRESH_MS = 1300;

/**
 * Stands in for the forecast fetch. Mock data always resolves, but the status
 * machine matches what a real request will need, so the screen already renders
 * loading and error states.
 */
export function useNightData(scenario: ScenarioKey = 'Dobra') {
  const [status, setStatus] = useState<NightStatus>('ready');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const refresh = useCallback(() => {
    if (timer.current) return;
    setStatus('loading');
    timer.current = setTimeout(() => {
      timer.current = null;
      setStatus('ready');
    }, REFRESH_MS);
  }, []);

  const data: NightData = SCENARIOS[scenario];

  return { status, data, refresh, refreshing: status === 'loading' };
}
