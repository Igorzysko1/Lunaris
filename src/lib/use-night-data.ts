import { useCallback, useEffect, useState } from 'react';

import type { Coords } from '@/data/places';
import { computeNightRating } from '@/lib/astro';
import { moonAt, type Moon } from '@/lib/moon';
import { fetchNightForecast, type NightForecast } from '@/lib/weather';

export type NightStatus = 'loading' | 'ready' | 'error';

export type NightData = {
  forecast: NightForecast;
  moon: Moon;
  /** Ocena nocy 0–100 — patrz computeNightRating(). */
  rating: number;
  bortle: number;
};

/**
 * Prognoza na najbliższą noc dla podanego punktu.
 * Przeładowuje się przy zmianie lokalizacji i na żądanie (przycisk odświeżania).
 */
export function useNightData(coords: Coords, bortle: number) {
  const [status, setStatus] = useState<NightStatus>('loading');
  const [data, setData] = useState<NightData | null>(null);
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  const { lat, lon } = coords;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    // Reset stanu przy zmianie wejścia jest tu celowy: zanim odpowie sieć, widok ma
    // pokazywać ładowanie dla NOWEJ lokalizacji, a nie dane dla poprzedniej.
    setStatus('loading');

    fetchNightForecast(lat, lon, controller.signal)
      .then((forecast) => {
        if (!active) return;
        // Wschód i zachód Księżyca zależą od miejsca — liczymy dla doby, w której
        // zaczyna się noc (czyli tej z zachodem Słońca), nie dla „dziś".
        const moon = moonAt(forecast.from, lat, lon);
        setData({
          forecast,
          moon,
          bortle,
          rating: computeNightRating({
            avgCloud: forecast.avgCloud,
            avgHumidity: forecast.avgHumidity,
            precipitation: forecast.totalPrecipitation,
            moonIllumination: moon.illumination,
            bortle,
          }),
        });
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [lat, lon, bortle, attempt]);

  return { status, data, refresh, refreshing: status === 'loading' };
}
