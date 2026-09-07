import { useMemo } from 'react';

import type { Coords } from '@/data/places';
import { computeNightRating } from '@/lib/astro';
import { moonAt, type Moon } from '@/lib/moon';
import { seeingOver, type Seeing } from '@/lib/seeing';
import { useForecast } from '@/store/forecast';
import type { NightForecast } from '@/lib/weather';

export type NightData = {
  forecast: NightForecast;
  moon: Moon;
  /** Ocena nocy 0–100 — patrz computeNightRating(). */
  rating: number;
  bortle: number;
  /** Spokój atmosfery w oknie nocy; `null`, gdy prognoza nie ma godzin. */
  seeing: Seeing | null;
};

/**
 * Najbliższa noc dla aktywnego punktu — z danych, które przyniósł cykl dobowy.
 *
 * Hook nie pobiera niczego. Prognoza przychodzi raz na dobę z `ForecastProvider`,
 * a wszystko, co widać na ekranie Noc poza nią — faza Księżyca, jego wschód
 * i zachód, ocena nocy — jest rachunkiem lokalnym. Dlatego zmiana Bortle albo
 * progu w ustawieniach przelicza widok natychmiast, bez sieci.
 */
export function useNightData(coords: Coords, bortle: number) {
  const { bundle, status, savedAt, stale, failure, refresh, refreshing } = useForecast();
  const { lat, lon } = coords;

  const data = useMemo<NightData | null>(() => {
    if (!bundle) return null;

    const forecast = bundle.current;
    // Wschód i zachód Księżyca zależą od miejsca — liczymy dla doby, w której
    // zaczyna się noc (czyli tej z zachodem Słońca), nie dla „dziś".
    const moon = moonAt(forecast.from, lat, lon);

    return {
      forecast,
      moon,
      bortle,
      seeing: seeingOver(forecast.hours),
      rating: computeNightRating({
        avgCloud: forecast.avgCloud,
        avgHumidity: forecast.avgHumidity,
        precipitation: forecast.totalPrecipitation,
        moonIllumination: moon.illumination,
        bortle,
      }),
    };
  }, [bundle, lat, lon, bortle]);

  return { status, data, savedAt, stale, failure, refresh, refreshing };
}
