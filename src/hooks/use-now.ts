import { useEffect, useState } from 'react';

/**
 * Bieżąca chwila, odświeżana co minutę.
 *
 * Licznik „zostało 3 h 36 min" i znacznik „teraz" na pasku nocy mają iść
 * z zegarem, a nie zastygać na godzinie otwarcia ekranu.
 */
export function useNow(stepMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), stepMs);
    return () => clearInterval(id);
  }, [stepMs]);

  return now;
}
