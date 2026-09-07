import { useCallback, useEffect, useState } from 'react';
import * as SunCalc from 'suncalc';

import { findPlaceById, type Coords } from '@/data/places';
import type { LunarisConfig } from '@/lib/config';
import { loadForecast, saveForecast } from '@/lib/forecast-cache';
import { assumedNextDay } from '@/lib/session-engine';
import { reviewNights, type NightReview } from '@/lib/site-review';
import { fetchUpcomingNightsForPoints, type NightSlice } from '@/lib/weather';

/** Tyle nocy naprzód, ile ma sens porównywać — dalej prognoza jest zgadywanką. */
export const REVIEW_NIGHTS = 3;

export type ReviewStatus = 'loading' | 'ready' | 'error';

/**
 * Przegląd katalogu miejscówek na najbliższe noce.
 *
 * Jedno żądanie na cały katalog: Open-Meteo przyjmuje wiele punktów naraz.
 * Zapis jest **per miejsce**, nie jednym rekordem — dzięki temu nieudane
 * pobranie nie kasuje tego, co już mamy, a przegląd potrafi pokazać część
 * miejsc z prognozą i resztę jako brakujące, zamiast nie pokazać niczego.
 */
export function useSiteReview(config: LunarisConfig) {
  const [status, setStatus] = useState<ReviewStatus>('loading');
  const [reviews, setReviews] = useState<NightReview[]>([]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  const { sites } = config;
  // Sam identyfikator listy: obiekt konfiguracji zmienia tożsamość przy każdym
  // renderze store'u, a pobierać trzeba na nowo tylko po zmianie zestawu miejsc.
  const siteKey = sites.map((s) => `${s.id}:${s.lat},${s.lon}`).join('|');

  const homePlace = config.observer.homePlaceId ? findPlaceById(config.observer.homePlaceId) : null;
  const home: Coords | null = homePlace ? { lat: homePlace.lat, lon: homePlace.lon } : null;

  const [forecasts, setForecasts] = useState<Map<string, NightSlice[]>>(new Map());

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setStatus('loading');

    if (sites.length === 0) {
      setForecasts(new Map());
      setSavedAt(null);
      setStatus('ready');
      return;
    }

    const points = sites.map((s) => ({ lat: s.lat, lon: s.lon }));

    fetchUpcomingNightsForPoints(points, REVIEW_NIGHTS, controller.signal)
      .then((perPoint) => {
        if (!active) return;

        const fresh = new Map<string, NightSlice[]>();
        sites.forEach((site, i) => {
          fresh.set(site.id, perPoint[i]);
          void saveForecast('site', { lat: site.lat, lon: site.lon }, perPoint[i]);
        });

        setForecasts(fresh);
        setSavedAt(null);
        setStatus('ready');
      })
      .catch(async (error: unknown) => {
        if (!active || (error instanceof Error && error.name === 'AbortError')) return;

        // Częściowy wynik jest lepszy niż żaden: bierzemy z dysku, co jest,
        // a miejsca bez zapisu przegląd pokaże jako brakujące.
        const entries = await Promise.all(
          sites.map(async (site) => {
            const hit = await loadForecast<NightSlice[]>('site', { lat: site.lat, lon: site.lon });
            return hit ? ([site.id, hit] as const) : null;
          }),
        );
        if (!active) return;

        const cached = new Map<string, NightSlice[]>();
        let oldest: Date | null = null;

        for (const entry of entries) {
          if (!entry) continue;
          const [id, hit] = entry;
          cached.set(id, hit.payload);
          // Wiek przeglądu to wiek jego najstarszej części — inaczej etykieta
          // obiecywałaby świeżość, której nie ma cała lista.
          if (!oldest || hit.savedAt < oldest) oldest = hit.savedAt;
        }

        setForecasts(cached);
        setSavedAt(oldest);
        setStatus(cached.size > 0 ? 'ready' : 'error');
      });

    return () => {
      active = false;
      controller.abort();
    };
    // Pobranie zależy tylko od zestawu miejsc; progi zmieniają werdykt, a nie dane.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, attempt]);

  useEffect(() => {
    if (status === 'loading') return;

    setReviews(
      reviewNights({
        sites,
        forecasts,
        home,
        config,
        moon: (night, coords) => ({
          illumination: Math.round(SunCalc.getMoonIllumination(night.from).fraction * 100),
          upAt: (at) => SunCalc.getMoonPosition(at, coords.lat, coords.lon).altitude > 0,
        }),
        nextDay: (night) => assumedNextDay(night, config),
      }),
    );
    // Werdykty liczą się z danych z pamięci, więc zmiana progu przestawia ranking
    // natychmiast — bez pobierania czegokolwiek.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecasts, config, home?.lat, home?.lon, status]);

  return { status, reviews, savedAt, refresh, refreshing: status === 'loading' };
}
