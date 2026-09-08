import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as SunCalc from 'suncalc';

import { findPlaceById, type Coords } from '@/data/places';
import type { LunarisConfig } from '@/lib/config';
import {
  EMPTY_CYCLE_STATE,
  decideRefresh,
  markAttempt,
  markFailure,
  markSuccess,
  planAppFetch,
} from '@/lib/daily-cycle';
import { loadCycleState, loadForecast, saveCycleState, saveForecast } from '@/lib/forecast-cache';
import { assumedNextDay } from '@/lib/session-engine';
import { reviewNights } from '@/lib/site-review';
import { skyQualityAt } from '@/lib/sky-map';
import { ForecastError, fetchUpcomingNightsForPoints, type NightSlice } from '@/lib/weather';

/** Tyle nocy naprzód, ile ma sens porównywać — dalej prognoza jest zgadywanką. */
const REVIEW_NIGHTS = 3;

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
/** Stała pustka — nowa `Map` przy każdym renderze psułaby zależności `useMemo`. */
const EMPTY_FORECASTS: Map<string, NightSlice[]> = new Map();

export function useSiteReview(config: LunarisConfig) {
  /**
   * Wynik ostatniego pobrania razem z kluczem żądania, którego dotyczy.
   *
   * Status **wyliczamy** z porównania kluczy, zamiast ustawiać `'loading'` na
   * początku efektu. Ustawienie go wprost wymusza dodatkowy render przy każdej
   * zmianie wejścia, a to samo da się odczytać z danych: skoro wczytany klucz
   * różni się od bieżącego, to znaczy, że pobranie trwa.
   */
  const [outcome, setOutcome] = useState<{ key: string; status: 'ready' | 'error' } | null>(null);
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

  /** Tożsamość pobrania: zmiana któregokolwiek składnika znaczy nowe żądanie. */
  const requestKey = `${siteKey}|${hour}|${attempt}`;

  // Pusty katalog nie ma czego pobierać ani na co czekać.
  const empty = sites.length === 0;
  const status: ReviewStatus = empty
    ? 'ready'
    : outcome?.key === requestKey
      ? outcome.status
      : 'loading';

  const homePlace = config.observer.homePlaceId ? findPlaceById(config.observer.homePlaceId) : null;
  const home: Coords | null = homePlace ? { lat: homePlace.lat, lon: homePlace.lon } : null;

  const [loaded, setLoaded] = useState<Map<string, NightSlice[]>>(new Map());
  const setForecasts = setLoaded;

  // Po skasowaniu wszystkich miejsc prognozy nie mają do czego należeć —
  // wyliczamy pustkę, zamiast czyścić stan w efekcie.
  const forecasts = empty ? EMPTY_FORECASTS : loaded;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const force = forced.current;
    forced.current = false;

    // Pusty katalog obsługuje wyliczenie `empty` powyżej — tutaj nie ma nic
    // do ustawienia, a ustawianie czegokolwiek synchronicznie kosztowałoby
    // dodatkowy render.
    if (sites.length === 0) return;

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
        setOutcome({ key: requestKey, status: 'ready' });
      }

      const stored = (await loadCycleState(SOURCE)) ?? EMPTY_CYCLE_STATE;
      if (!active) return;

      const now = new Date();
      const decision = decideRefresh(now, stored, hour);

      // Ta sama reguła co w cyklu prognozy — patrz `planAppFetch`. Przegląd
      // pobiera też wtedy, gdy zapis jest niepełny: część miejsc bez danych
      // znaczy, że porównanie i tak byłoby ułomne.
      const plan = planAppFetch(decision, complete, force);
      if (plan === 'give-up') {
        if (cached.size === 0) setOutcome({ key: requestKey, status: 'error' });
        return;
      }
      if (plan === 'skip') return;

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
        setOutcome({ key: requestKey, status: 'ready' });
        void saveCycleState(SOURCE, markSuccess(attempted, new Date()));
      } catch (error) {
        if (!active || (error instanceof Error && error.name === 'AbortError')) return;

        const reason = error instanceof Error ? error.message : 'Nieznany błąd pobierania';
        const rateLimited = error instanceof ForecastError && error.kind === 'rate-limit';
        void saveCycleState(SOURCE, markFailure(attempted, reason, rateLimited));

        // Nieudane pobranie nie kasuje tego, co już mamy z dysku.
        if (cached.size === 0) setOutcome({ key: requestKey, status: 'error' });
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

  /**
   * Werdykty są **czystą funkcją** wczytanych prognoz i konfiguracji, więc
   * liczymy je przy renderze zamiast trzymać w stanie i ustawiać w efekcie.
   * Tamten układ dawał dodatkowy render i okno, w którym widać było ranking
   * policzony ze starych progów. Zmiana progu przestawia go teraz natychmiast —
   * bez pobierania czegokolwiek.
   */
  const reviews = useMemo(
    () =>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forecasts, config, home?.lat, home?.lon],
  );

  return { status, reviews, savedAt, refresh, refreshing: status === 'loading' };
}
