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

import {
  EMPTY_CYCLE_STATE,
  decideRefresh,
  markAttempt,
  markFailure,
  markSuccess,
  type CycleState,
} from '@/lib/daily-cycle';
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
export const CYCLE_NIGHTS = 3;

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
  /** Wymuszone pobranie — dla użytkownika, który wie, że coś się zmieniło. */
  refresh: () => void;
  refreshing: boolean;
  /** Znaczniki próby i sukcesu — widoczne w ustawieniach, żeby cichy zastój było widać. */
  cycle: CycleState;
};

const ForecastContext = createContext<ForecastStore | null>(null);

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
  const { active, config } = useSettings();
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

      // Dwa uruchomienia cyklu naraz to podwójny koszt tego samego żądania.
      // Blokady próby nie przebija nawet ręczne odświeżenie.
      if (decision.reason === 'in-flight') return giveUp();

      // Brak zapisu jest jedynym powodem, dla którego pobieramy poza terminem.
      if (!decision.run && hit && !force) return;
      if (!decision.run && !hit && !force && decision.reason === 'exhausted') return giveUp();

      // 3. Pobranie. Znacznik próby zapisujemy PRZED żądaniem — to on blokuje drugie.
      const attempted = markAttempt(stored, now, decision.term);
      setCycle(attempted);
      void saveCycleState(SCOPE, attempted);
      setRefreshing(true);

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
        if (active) setRefreshing(false);
      }
    };

    void run();

    return () => {
      active = false;
      controller.abort();
    };
  }, [lat, lon, hour, attempt]);

  // Nadrobienie po powrocie do aplikacji. To ta ścieżka, a nie zadanie w tle,
  // odpowiada za aktualność danych: system może pominąć zadanie, ale nie może
  // pominąć tego, że użytkownik otworzył aplikację.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setAttempt((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<ForecastStore>(
    () => ({ ...state, refresh, refreshing, cycle }),
    [state, refresh, refreshing, cycle],
  );

  return <ForecastContext.Provider value={value}>{children}</ForecastContext.Provider>;
}

export function useForecast(): ForecastStore {
  const value = useContext(ForecastContext);
  if (!value) throw new Error('useForecast poza ForecastProvider');
  return value;
}
