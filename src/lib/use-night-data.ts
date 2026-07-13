import { useCallback, useEffect, useState } from 'react';

import { findPlaceByName } from '@/data/places';
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
 * Prognoza na najbliższą noc w wybranej lokalizacji.
 * Przeładowuje się przy zmianie miejscowości i na żądanie (przycisk odświeżania).
 */
export function useNightData(placeName: string) {
  const [status, setStatus] = useState<NightStatus>('loading');
  const [data, setData] = useState<NightData | null>(null);
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const place = findPlaceByName(placeName);
    if (!place) {
      setStatus('error');
      return;
    }

    const controller = new AbortController();
    let active = true;

    setStatus('loading');

    fetchNightForecast(place.lat, place.lon, controller.signal)
      .then((forecast) => {
        if (!active) return;
        const moon = moonAt();
        setData({
          forecast,
          moon,
          bortle: place.bortle,
          rating: computeNightRating({
            avgCloud: forecast.avgCloud,
            avgHumidity: forecast.avgHumidity,
            precipitation: forecast.totalPrecipitation,
            moonIllumination: moon.illumination,
            bortle: place.bortle,
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
  }, [placeName, attempt]);

  return { status, data, refresh, refreshing: status === 'loading' };
}
