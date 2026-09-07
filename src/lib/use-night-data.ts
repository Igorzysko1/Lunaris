import { useCallback, useEffect, useState } from 'react';

import type { Coords } from '@/data/places';
import { computeNightRating } from '@/lib/astro';
import { loadForecast, saveForecast } from '@/lib/forecast-cache';
import { moonAt, type Moon } from '@/lib/moon';
import { ForecastError, fetchNightForecast, type NightForecast } from '@/lib/weather';

export type NightStatus = 'loading' | 'ready' | 'error';

/** Dlaczego prognoza nie przyszła — użytkownik reaguje inaczej na jedno i drugie. */
export type NightFailure = 'offline' | 'api';

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
  /** Ustawione tylko wtedy, gdy pokazujemy dane z zapisu — UI musi to powiedzieć wprost. */
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [failure, setFailure] = useState<NightFailure | null>(null);
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  const { lat, lon } = coords;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    // Reset stanu przy zmianie wejścia jest tu celowy: zanim odpowie sieć, widok ma
    // pokazywać ładowanie dla NOWEJ lokalizacji, a nie dane dla poprzedniej.
    setStatus('loading');

    // Prognoza i jej interpretacja idą razem: ocena nocy zależy od Bortle, więc
    // z zapisu bierzemy surową prognozę, a resztę liczymy na nowo.
    const present = (forecast: NightForecast) => {
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
    };

    fetchNightForecast(lat, lon, controller.signal)
      .then((forecast) => {
        if (!active) return;
        setSavedAt(null);
        setFailure(null);
        present(forecast);
        void saveForecast('night', { lat, lon }, forecast);
      })
      .catch(async (error: unknown) => {
        if (!active || (error instanceof Error && error.name === 'AbortError')) return;

        const kind = error instanceof ForecastError ? error.kind : 'api';
        const cached = await loadForecast<NightForecast>('night', { lat, lon });
        if (!active) return;

        setFailure(kind);

        // Dane sprzed kilku godzin są lepsze niż pusty ekran — pod warunkiem,
        // że widać, iż są stare.
        if (cached) {
          setSavedAt(cached.savedAt);
          present(cached.payload);
          return;
        }

        setSavedAt(null);
        setStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [lat, lon, bortle, attempt]);

  return { status, data, savedAt, failure, refresh, refreshing: status === 'loading' };
}
