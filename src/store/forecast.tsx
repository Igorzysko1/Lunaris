import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { findPlaceById, type Coords } from '@/data/places';
import type { LunarisConfig } from '@/lib/config';
import {
  EMPTY_CYCLE_STATE,
  decideRefresh,
  markAttempt,
  markFailure,
  markSuccess,
  planAppFetch,
  type CycleState,
} from '@/lib/daily-cycle';
import { reviewEvents } from '@/lib/event-review';
import { upcomingEvents } from '@/lib/events';
import { planNights } from '@/lib/night-plan';
import {
  loadNoticeLog,
  loadNoticePlan,
  saveNoticeLog,
  saveNoticePlan,
  type StoredNotice,
} from '@/lib/notice-store';
import { leadHours, type LeadTime } from '@/lib/settings-storage';
import {
  loadCycleState,
  loadForecast,
  pruneExpired,
  saveCycleState,
  saveForecast,
} from '@/lib/forecast-cache';
import { ForecastError, fetchForecastBundle, type ForecastBundle } from '@/lib/weather';
import { useSettings } from '@/store/settings';

/** Ile nocy naprzód pobieramy. Dalej prognoza jest zgadywanką, a werdykt obietnicą bez pokrycia. */
const CYCLE_NIGHTS = 3;

/** Klucz zapisu dla kompletu danych aktywnego punktu. */
const SCOPE = 'bundle';

export type ForecastStatus = 'loading' | 'ready' | 'error';

export type ForecastState = {
  bundle: ForecastBundle | null;
  status: ForecastStatus;
  /** Ustawione, gdy dane pochodzą z zapisu — UI ma podać ich wiek, a nie udawać świeżości. */
  savedAt: Date | null;
  /** Zapis starszy niż jeden cykl: dane wciąż użyteczne, ale coś nie zadziałało. */
  stale: boolean;
  failure: 'offline' | 'api' | null;
};

type ForecastStore = ForecastState & {
  /** Plan powiadomień o zjawiskach z ostatniego przebiegu cyklu. */
  notices: StoredNotice[];
  /** Wymuszone pobranie — dla użytkownika, który wie, że coś się zmieniło. */
  refresh: () => void;
  refreshing: boolean;
  /** Znaczniki próby i sukcesu — widoczne w ustawieniach, żeby cichy zastój było widać. */
  cycle: CycleState;
};

const ForecastContext = createContext<ForecastStore | null>(null);

/**
 * Przegląd zjawisk — krok, którym kończy się cykl.
 *
 * Pobranie danych nie jest celem samym w sobie: celem jest to, żeby wieczorem
 * było wiadomo, czy jechać, bez otwierania aplikacji. Dlatego po zapisie
 * prognozy cykl przechodzi po horyzoncie zjawisk i rozstrzyga, o czym warto
 * powiadomić — z werdyktem nocy, w którą zjawisko wypada.
 */
async function runEventReview(input: {
  bundle: ForecastBundle;
  coords: Coords;
  bortle: number;
  walkMinutes: number;
  config: LunarisConfig;
  leadTime: LeadTime;
}): Promise<StoredNotice[]> {
  const { bundle, coords, bortle, walkMinutes, config, leadTime } = input;
  const now = new Date();

  const homePlace = config.observer.homePlaceId ? findPlaceById(config.observer.homePlaceId) : null;

  const events = upcomingEvents(now, coords);

  const verdicts = planNights({
    nights: bundle.nights,
    target: coords,
    home: homePlace ? { lat: homePlace.lat, lon: homePlace.lon } : null,
    config,
    bortle,
    walkMinutes,
    events,
  }).map((planned) => planned.verdict);

  const { notices, log } = reviewEvents({
    now,
    events,
    verdicts,
    leadHours: leadHours(leadTime),
    refreshHour: config.refresh.hourOfDay,
    previous: await loadNoticeLog(),
  });

  await saveNoticeLog(log);
  await saveNoticePlan(notices);

  return loadNoticePlan();
}

/**
 * Cykl dobowy dla aktywnego punktu.
 *
 * Ekran nigdy nie czeka na sieć przy wejściu: najpierw czytamy zapis i od razu
 * go pokazujemy, a dopiero potem — i tylko jeśli termin odświeżenia minął —
 * pobieramy. Brak zapisu to jedyny przypadek, w którym pobieranie blokuje widok.
 *
 * Provider, a nie hook w ekranie, bo pobranie ma być **jedno na cykl**: ekran
 * Noc i sekcja sesji potrzebują tych samych godzin w dwóch różnych oknach,
 * a dotąd każde z nich odpytywało Open-Meteo osobno.
 */
export function ForecastProvider({ children }: { children: ReactNode }) {
  const { active, config, notifications, leadTime } = useSettings();
  const { lat, lon } = active.coords;
  const hour = config.refresh.hourOfDay;

  const [state, setState] = useState<ForecastState>({
    bundle: null,
    status: 'loading',
    savedAt: null,
    stale: false,
    failure: null,
  });
  const [cycle, setCycle] = useState<CycleState>(EMPTY_CYCLE_STATE);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notices, setNotices] = useState<StoredNotice[]>([]);

  /** Czy pobranie właśnie trwa — po to, żeby powrót do aplikacji go nie przerywał. */
  const fetching = useRef(false);

  /**
   * Wejście przeglądu zjawisk trzymamy w ref, a nie w zależnościach efektu:
   * zmiana Bortle, sprzętu czy wyprzedzenia zmienia to, o czym powiadamiamy,
   * ale nie jest powodem, żeby pobierać prognozę jeszcze raz.
   */
  const reviewInput = useRef({
    bortle: active.bortle,
    walkMinutes: active.walkMinutes,
    config,
    leadTime,
    notifications,
  });

  useEffect(() => {
    reviewInput.current = {
      bortle: active.bortle,
      walkMinutes: active.walkMinutes,
      config,
      leadTime,
      notifications,
    };
  }, [active.bortle, active.walkMinutes, config, leadTime, notifications]);

  /** Ręczne odświeżenie pomija terminarz — użytkownik wie więcej niż zegar. */
  const forced = useRef(false);
  const refresh = useCallback(() => {
    forced.current = true;
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const force = forced.current;
    forced.current = false;

    const run = async () => {
      const coords = { lat, lon };

      // 1. Zapis. Pokazujemy go natychmiast, jeszcze zanim spytamy o termin.
      const hit = await loadForecast<ForecastBundle>(SCOPE, coords);
      if (!active) return;

      if (hit) {
        setState({
          bundle: hit.payload,
          status: 'ready',
          savedAt: hit.savedAt,
          stale: hit.stale,
          failure: null,
        });
      } else {
        setState((s) => ({ ...s, status: 'loading', bundle: null, savedAt: null }));
      }

      // 2. Termin. Stan cyklu czytamy z dysku, bo poprzednie uruchomienie
      //    aplikacji też się liczy — inaczej każdy start byłby zaległy.
      const stored = (await loadCycleState(SCOPE)) ?? EMPTY_CYCLE_STATE;
      if (!active) return;
      setCycle(stored);

      const now = new Date();
      const decision = decideRefresh(now, stored, hour);

      // Rezygnacja z pobrania nie może zostawić ekranu w wiecznym ładowaniu.
      const giveUp = () => {
        if (!hit) setState((s) => ({ ...s, status: 'error' }));
      };

      const plan = planAppFetch(decision, hit !== null, force);
      if (plan === 'give-up') return giveUp();
      if (plan === 'skip') return;

      // 3. Pobranie. Znacznik próby zapisujemy PRZED żądaniem — to on blokuje drugie.
      const attempted = markAttempt(stored, now, decision.term);
      setCycle(attempted);
      void saveCycleState(SCOPE, attempted);
      setRefreshing(true);
      fetching.current = true;

      try {
        const bundle = await fetchForecastBundle(coords, CYCLE_NIGHTS, controller.signal);
        if (!active) return;

        setState({ bundle, status: 'ready', savedAt: null, stale: false, failure: null });
        await saveForecast(SCOPE, coords, bundle);

        const done = markSuccess(attempted, new Date());
        setCycle(done);
        void saveCycleState(SCOPE, done);

        // Klucz zapisu zawiera współrzędne, więc każdy wyjazd zostawia nowy —
        // sprzątanie raz na cykl wystarcza, żeby nie rosły w nieskończoność.
        void pruneExpired();

        // Przegląd zjawisk pomijamy przy wyłączonych powiadomieniach — inaczej
        // pamięć przeglądu zapisywałaby zgłoszenia, których nikt nie zobaczył,
        // a po włączeniu powiadomień te zjawiska byłyby już „ogłoszone".
        const review = reviewInput.current;
        if (review.notifications) {
          const planned = await runEventReview({
            bundle,
            coords,
            bortle: review.bortle,
            walkMinutes: review.walkMinutes,
            config: review.config,
            leadTime: review.leadTime,
          });
          if (active) setNotices(planned);
        }
      } catch (error) {
        if (!active || (error instanceof Error && error.name === 'AbortError')) return;

        const kind = error instanceof ForecastError ? error.kind : 'api';
        const reason = error instanceof Error ? error.message : 'Nieznany błąd pobierania prognozy';

        const failed = markFailure(attempted, reason);
        setCycle(failed);
        void saveCycleState(SCOPE, failed);

        // Nieudane pobranie nie kasuje poprzedniego zapisu: dane sprzed doby są
        // lepsze niż pusty ekran, o ile widać, że są sprzed doby.
        setState((s) => ({
          ...s,
          failure: kind,
          status: s.bundle ? 'ready' : 'error',
        }));
      } finally {
        fetching.current = false;
        if (active) setRefreshing(false);
      }
    };

    void run();

    return () => {
      active = false;
      controller.abort();
    };
    // Pobranie zależy wyłącznie od punktu, pory odświeżania i ręcznego żądania.
    // Reszta wejścia idzie przez `reviewInput`, żeby zmiana progu nie kosztowała
    // żądania sieciowego.
  }, [lat, lon, hour, attempt]);

  // Plan z poprzedniego uruchomienia: cykl mógł policzyć go wczoraj, a zgłoszenia
  // odzywają się dopiero za kilka dni.
  useEffect(() => {
    void loadNoticePlan().then(setNotices);
  }, []);

  // Nadrobienie po powrocie do aplikacji. To ta ścieżka, a nie zadanie w tle,
  // odpowiada za aktualność danych: system może pominąć zadanie, ale nie może
  // pominąć tego, że użytkownik otworzył aplikację.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      // Powrót do aplikacji w trakcie pobrania nie ma go przerywać: przerwane
      // żądanie kosztuje tyle samo co dokończone, a jego wynik i tak przepada.
      if (next === 'active' && !fetching.current) setAttempt((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<ForecastStore>(
    () => ({ ...state, notices, refresh, refreshing, cycle }),
    [state, notices, refresh, refreshing, cycle],
  );

  return <ForecastContext.Provider value={value}>{children}</ForecastContext.Provider>;
}

export function useForecast(): ForecastStore {
  const value = useContext(ForecastContext);
  if (!value) throw new Error('useForecast poza ForecastProvider');
  return value;
}
