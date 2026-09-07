import { useCallback, useEffect, useRef, useState } from 'react';
import * as SunCalc from 'suncalc';

import { findPlaceById, type Coords } from '@/data/places';
import type { LunarisConfig } from '@/lib/config';
import {
  EMPTY_CYCLE_STATE,
  decideRefresh,
  markAttempt,
  markFailure,
  markSuccess,
} from '@/lib/daily-cycle';
import { loadCycleState, loadForecast, saveCycleState, saveForecast } from '@/lib/forecast-cache';
import { assumedNextDay } from '@/lib/session-engine';
import { reviewNights, type NightReview } from '@/lib/site-review';
import { skyQualityAt } from '@/lib/sky-map';
import { fetchUpcomingNightsForPoints, type NightSlice } from '@/lib/weather';

/** Tyle nocy naprzód, ile ma sens porównywać — dalej prognoza jest zgadywanką. */
export const REVIEW_NIGHTS = 3;

/**
 * Przegląd ma własny znacznik cyklu, osobny od prognozy aktywnego punktu:
 * to inne żądanie i inne dane, więc udane pobranie jednego nie może zamykać
 * terminu drugiemu.
 */
const SOURCE = 'sites';

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

  /** Ręczne odświeżenie pomija terminarz — użytkownik wie więcej niż zegar. */
  const forced = useRef(false);
  const refresh = useCallback(() => {
    forced.current = true;
    setAttempt((n) => n + 1);
  }, []);

  const { sites } = config;
  const hour = config.refresh.hourOfDay;
  // Sam identyfikator listy: obiekt konfiguracji zmienia tożsamość przy każdym
  // renderze store'u, a pobierać trzeba na nowo tylko po zmianie zestawu miejsc.
  const siteKey = sites.map((s) => `${s.id}:${s.lat},${s.lon}`).join('|');

  const homePlace = config.observer.homePlaceId ? findPlaceById(config.observer.homePlaceId) : null;
  const home: Coords | null = homePlace ? { lat: homePlace.lat, lon: homePlace.lon } : null;

  const [forecasts, setForecasts] = useState<Map<string, NightSlice[]>>(new Map());

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const force = forced.current;
    forced.current = false;

    setStatus('loading');

    if (sites.length === 0) {
      setForecasts(new Map());
      setSavedAt(null);
      setStatus('ready');
      return;
    }

    const points = sites.map((s) => ({ lat: s.lat, lon: s.lon }));

    /**
     * Zapis czytamy zawsze i najpierw. Wynik częściowy jest lepszy niż żaden:
     * miejsca bez zapisu przegląd pokaże jako brakujące, zamiast nie pokazać nic.
     */
    const readCache = async () => {
      const entries = await Promise.all(
        sites.map(async (site) => {
          const hit = await loadForecast<NightSlice[]>('site', { lat: site.lat, lon: site.lon });
          return hit ? ([site.id, hit] as const) : null;
        }),
      );

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

      return { cached, oldest, complete: cached.size === sites.length };
    };

    const run = async () => {
      const { cached, oldest, complete } = await readCache();
      if (!active) return;

      if (cached.size > 0) {
        setForecasts(cached);
        setSavedAt(oldest);
        setStatus('ready');
      }

      const stored = (await loadCycleState(SOURCE)) ?? EMPTY_CYCLE_STATE;
      if (!active) return;

      const now = new Date();
      const decision = decideRefresh(now, stored, hour);

      // Rezygnacja z pobrania nie może zostawić ekranu w wiecznym ładowaniu:
      // bez zapisu i bez pobrania nie ma czego pokazać i trzeba to powiedzieć.
      const giveUp = () => {
        if (cached.size === 0) setStatus('error');
      };

      if (decision.reason === 'in-flight') return giveUp();
      // Poza terminem pobieramy tylko wtedy, gdy zapisu brakuje — albo brakuje
      // go dla części miejsc, bo wtedy przegląd i tak jest niepełny.
      if (!decision.run && complete && !force) return;
      if (!decision.run && !force && decision.reason !== 'due' && cached.size === 0) {
        // Próby na ten termin wyczerpane, a zapisu nie ma — dobijanie się do
        // serwera co wejście na ekran niczego nie naprawi.
        return giveUp();
      }

      const attempted = markAttempt(stored, now, decision.term);
      void saveCycleState(SOURCE, attempted);

      try {
        const perPoint = await fetchUpcomingNightsForPoints(
          points,
          REVIEW_NIGHTS,
          controller.signal,
        );
        if (!active) return;

        const fresh = new Map<string, NightSlice[]>();
        sites.forEach((site, i) => {
          fresh.set(site.id, perPoint[i]);
          void saveForecast('site', { lat: site.lat, lon: site.lon }, perPoint[i]);
        });

        setForecasts(fresh);
        setSavedAt(null);
        setStatus('ready');
        void saveCycleState(SOURCE, markSuccess(attempted, new Date()));
      } catch (error) {
        if (!active || (error instanceof Error && error.name === 'AbortError')) return;

        const reason = error instanceof Error ? error.message : 'Nieznany błąd pobierania';
        void saveCycleState(SOURCE, markFailure(attempted, reason));

        // Nieudane pobranie nie kasuje tego, co już mamy z dysku.
        if (cached.size === 0) setStatus('error');
      }
    };

    void run();

    return () => {
      active = false;
      controller.abort();
    };
    // Pobranie zależy od zestawu miejsc i pory odświeżania; progi zmieniają
    // werdykt, a nie dane.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, hour, attempt]);

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
        // Bortle policzone dla współrzędnych miejsca bije szacunek wpisany
        // do katalogu; szacunek zostaje dla punktów spoza wgranej mapy.
        bortleFor: (site) => skyQualityAt(site.lat, site.lon, site.bortle).bortle,
      }),
    );
    // Werdykty liczą się z danych z pamięci, więc zmiana progu przestawia ranking
    // natychmiast — bez pobierania czegokolwiek.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecasts, config, home?.lat, home?.lon, status]);

  return { status, reviews, savedAt, refresh, refreshing: status === 'loading' };
}
