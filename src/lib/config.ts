/**
 * Konfiguracja użytkownika — jedno źródło prawdy dla silnika, UI i CLI.
 *
 * Wszystkie progi i parametry obserwatora są tutaj, bo inaczej każdy moduł
 * trzymałby własną kopię tych samych liczb i po pierwszej korekcie werdykty
 * silnika rozjechałyby się z tym, co pokazuje aplikacja.
 *
 * Wartości domyślne siedzą w kodzie, ale żadna z nich nie jest założeniem
 * kodu: wszystko jest nadpisywalne i utrwalane. Progi warunków są celowo
 * ostrożne i mają być strojone po kilku tygodniach porównywania werdyktów
 * z rzeczywistością — strojenie nie może wymagać rekompilacji.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import { DEFAULT_SITES, type ObservingSite } from '../data/observing-sites.ts';
import {
  DEFAULT_OPTICS,
  clampOptics,
  defaultProfile,
  newProfileId,
  type OpticsProfile,
} from './optics.ts';

/** Parametry obserwatora niezależne od pogody i sprzętu. */
export type ObserverProfile = {
  /** Punkt startowy — miejscowość z listy, z której liczone są czasy dojazdu. */
  homePlaceId: string | null;
  /** Ile minut marszu od parkingu do stanowiska użytkownik akceptuje. */
  walkToleranceMin: number;
  /** Minimum snu liczone od powrotu do domu do pobudki. */
  minSleepHours: number;
  /** Ile przed pierwszym wydarzeniem następnego dnia trzeba wstać. */
  wakeBufferMin: number;
  /** Zwijanie sprzętu po sesji, przed drogą powrotną. */
  packUpMin: number;
  /**
   * Średnia prędkość przejazdu w km/h, liczona po odległości w linii prostej.
   * Celowo niższa od drogowej: kompensuje krętość trasy, bo aplikacja nie zna
   * przebiegu dróg i nie odpytuje żadnego routera.
   */
  averageSpeedKmh: number;
};

/**
 * Tryb sesji. `overnight: false` znaczy brak namiotu i śpiwora, czyli powrót tej
 * samej nocy — to założenie napędza całą logikę snu i pobudki, więc jest
 * przełącznikiem, a nie stałą w kodzie. Po jego wyłączeniu liczenie godziny
 * powrotu przestaje mieć sens.
 */
export type SessionMode = {
  overnight: boolean;
  minDurationHours: number;
  maxDurationHours: number;
};

/** Progi pogodowe i księżycowe decydujące o tym, czy noc w ogóle się liczy. */
export type ConditionThresholds = {
  maxCloudTotal: number;
  maxCloudLow: number;
  /** Chmury wysokie są tolerowane wyżej, ale kosztem kontrastu. */
  maxCloudHigh: number;
  /** Porywy wiatru dla sprzętu na statywie. */
  maxWindGustKmh: number;
  /** Porywy wiatru dla sprzętu trzymanego z ręki — drga wcześniej. */
  maxWindGustHandheldKmh: number;
  /** Powyżej tej fazy okno liczy się tylko dla celów księżycowych i planetarnych. */
  maxMoonIllumination: number;
  minWindowMinutes: number;
  /** Spread temperatura minus punkt rosy, poniżej którego ostrzegamy o rosie. */
  dewWarningSpreadC: number;
  /**
   * Ile punktów oceny nocy jest wart jeden pełen kwadrans... a właściwie godzina
   * jazdy — przy porównywaniu miejscówek. Bez tej wagi ranking zawsze wskazywałby
   * najciemniejsze niebo, choćby leżało dwie godziny drogi dalej.
   *
   * Wartość jest arbitralna, jak wagi w `computeNightRating`, i z założenia do
   * strojenia: 10 znaczy „pojadę godzinę dłużej, jeśli noc jest o 10 punktów
   * lepsza". Zero wyłącza karę i zostawia sam ranking jakości nieba.
   */
  travelPenaltyPerHour: number;
};

/** Reguły wynikające z kalendarza następnego dnia. */
export type CalendarThresholds = {
  /** Pierwsze wydarzenie przed tą godziną — sesja odrzucona poza warunkami wybitnymi. */
  rejectBeforeHour: number;
  /** Do tej godziny dopuszczona wyłącznie lokalizacja domyślna, z ostrzeżeniem. */
  homeOnlyBeforeHour: number;
  /** Zachmurzenie, przy którym noc jest na tyle wyjątkowa, że łamie regułę godzin. */
  exceptionalMaxCloud: number;
  /**
   * Zakładana godzina pierwszego obowiązku w dzień roboczy.
   *
   * Rozwiązanie zastępcze do czasu integracji z prawdziwym kalendarzem: bez
   * jakiegokolwiek założenia logika snu w ogóle się nie uruchamia, a to ona
   * decyduje o większości werdyktów. Po podpięciu kalendarza ta wartość zostaje
   * awaryjna, na dni bez wpisów.
   */
  assumedFirstEventHour: number;
  /** Czy sobota i niedziela liczą się jako dni wolne. */
  weekendDaysOff: boolean;
};

export type LunarisConfig = {
  observer: ObserverProfile;
  /**
   * Zestawy sprzętu. Lista nigdy nie jest pusta — po skasowaniu ostatniego wraca
   * zestaw domyślny, bo bez żadnego sprzętu dobór celów nie ma czego liczyć.
   */
  opticsProfiles: OpticsProfile[];
  /**
   * Katalog miejsc obserwacyjnych. W konfiguracji, a nie w kodzie, żeby dodanie
   * miejscówki po wyjeździe nie wymagało zmiany ani jednej linii silnika.
   */
  sites: ObservingSite[];
  session: SessionMode;
  conditions: ConditionThresholds;
  calendar: CalendarThresholds;
};

export const DEFAULT_CONFIG: LunarisConfig = {
  observer: {
    homePlaceId: null,
    walkToleranceMin: 20,
    minSleepHours: 5.5,
    wakeBufferMin: 40,
    packUpMin: 15,
    averageSpeedKmh: 50,
  },
  opticsProfiles: [{ id: 'default', label: 'Lornetka 15x70', optics: DEFAULT_OPTICS }],
  sites: DEFAULT_SITES,
  session: {
    overnight: false,
    minDurationHours: 3,
    maxDurationHours: 5,
  },
  conditions: {
    maxCloudTotal: 25,
    maxCloudLow: 10,
    maxCloudHigh: 40,
    maxWindGustKmh: 25,
    maxWindGustHandheldKmh: 15,
    maxMoonIllumination: 30,
    minWindowMinutes: 90,
    dewWarningSpreadC: 2,
    travelPenaltyPerHour: 10,
  },
  calendar: {
    rejectBeforeHour: 8,
    homeOnlyBeforeHour: 10,
    exceptionalMaxCloud: 10,
    assumedFirstEventHour: 8,
    weekendDaysOff: true,
  },
};

type Range = { min: number; max: number };

/**
 * Zakresy, w których wartości mają sens. Nie chodzi o gust, tylko o to, żeby
 * wpisana literówka nie wyprodukowała konfiguracji, przy której silnik odrzuca
 * albo przyjmuje każdą noc.
 */
export const CONFIG_LIMITS = {
  observer: {
    walkToleranceMin: { min: 0, max: 180 },
    minSleepHours: { min: 0, max: 12 },
    wakeBufferMin: { min: 0, max: 240 },
    packUpMin: { min: 0, max: 120 },
    averageSpeedKmh: { min: 10, max: 140 },
  },
  session: {
    minDurationHours: { min: 0.5, max: 12 },
    maxDurationHours: { min: 0.5, max: 14 },
  },
  conditions: {
    maxCloudTotal: { min: 0, max: 100 },
    maxCloudLow: { min: 0, max: 100 },
    maxCloudHigh: { min: 0, max: 100 },
    maxWindGustKmh: { min: 0, max: 120 },
    maxWindGustHandheldKmh: { min: 0, max: 120 },
    maxMoonIllumination: { min: 0, max: 100 },
    minWindowMinutes: { min: 15, max: 600 },
    dewWarningSpreadC: { min: 0, max: 15 },
    travelPenaltyPerHour: { min: 0, max: 50 },
  },
  sites: {
    bortle: { min: 1, max: 9 },
    walkMinutes: { min: 0, max: 240 },
    lat: { min: -90, max: 90 },
    lon: { min: -180, max: 180 },
  },
  calendar: {
    rejectBeforeHour: { min: 0, max: 23 },
    homeOnlyBeforeHour: { min: 0, max: 23 },
    exceptionalMaxCloud: { min: 0, max: 100 },
    assumedFirstEventHour: { min: 0, max: 23 },
  },
} as const;

/**
 * Każdy zestaw z osobna: liczby przycięte do zakresu, wpis, który nie jest
 * obiektem — pominięty. Pusta lista po walidacji wraca do zestawu domyślnego,
 * bo dobór celów musi mieć czym liczyć.
 */
function clampProfiles(profiles: OpticsProfile[]): OpticsProfile[] {
  const valid = (Array.isArray(profiles) ? profiles : [])
    .filter((p): p is OpticsProfile => typeof p === 'object' && p !== null)
    .map((p) => ({
      id: typeof p.id === 'string' && p.id.length > 0 ? p.id : newProfileId(),
      label: typeof p.label === 'string' ? p.label : '',
      optics: clampOptics({ ...DEFAULT_OPTICS, ...(p.optics ?? {}) }),
    }));

  return valid.length > 0 ? valid : [defaultProfile()];
}

/**
 * Każde miejsce z osobna. Wpis bez współrzędnych jest bezużyteczny — nie ma dla
 * czego liczyć pogody — więc go pomijamy, zamiast podstawiać zmyślony punkt.
 * Pusta lista jest dopuszczalna: brak własnych miejscówek to normalny stan.
 */
function clampSites(sites: ObservingSite[]): ObservingSite[] {
  const l = CONFIG_LIMITS.sites;

  return (Array.isArray(sites) ? sites : [])
    .filter((s): s is ObservingSite => typeof s === 'object' && s !== null)
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map((s) => ({
      id: typeof s.id === 'string' && s.id.length > 0 ? s.id : newProfileId(),
      name: typeof s.name === 'string' && s.name.length > 0 ? s.name : 'Bez nazwy',
      region: typeof s.region === 'string' ? s.region : '',
      lat: clampNumber(s.lat, l.lat, 0),
      lon: clampNumber(s.lon, l.lon, 0),
      bortle: Math.round(clampNumber(s.bortle, l.bortle, 4)),
      walkMinutes: clampNumber(s.walkMinutes, l.walkMinutes, 0),
      notes: typeof s.notes === 'string' ? s.notes : '',
    }));
}

/** Wartość spoza zakresu wraca do granicy, a niebędąca liczbą — do domyślnej. */
function clampNumber(value: number, range: Range, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(range.max, Math.max(range.min, value));
}

/**
 * Doprowadza konfigurację do stanu, w którym każdy rachunek na niej ma sens.
 *
 * Poza przycięciem pojedynczych liczb pilnuje też zależności między nimi:
 * sesja nie może mieć minimum dłuższego niż maksimum, a godzina „tylko dom"
 * nie może wypadać przed godziną odrzucenia — inaczej reguła kalendarzowa
 * przestałaby cokolwiek znaczyć.
 */
export function clampConfig(config: LunarisConfig): LunarisConfig {
  const d = DEFAULT_CONFIG;
  const l = CONFIG_LIMITS;

  const session = {
    overnight: config.session.overnight === true,
    minDurationHours: clampNumber(
      config.session.minDurationHours,
      l.session.minDurationHours,
      d.session.minDurationHours,
    ),
    maxDurationHours: clampNumber(
      config.session.maxDurationHours,
      l.session.maxDurationHours,
      d.session.maxDurationHours,
    ),
  };

  const calendar = {
    rejectBeforeHour: clampNumber(
      config.calendar.rejectBeforeHour,
      l.calendar.rejectBeforeHour,
      d.calendar.rejectBeforeHour,
    ),
    homeOnlyBeforeHour: clampNumber(
      config.calendar.homeOnlyBeforeHour,
      l.calendar.homeOnlyBeforeHour,
      d.calendar.homeOnlyBeforeHour,
    ),
    exceptionalMaxCloud: clampNumber(
      config.calendar.exceptionalMaxCloud,
      l.calendar.exceptionalMaxCloud,
      d.calendar.exceptionalMaxCloud,
    ),
    assumedFirstEventHour: clampNumber(
      config.calendar.assumedFirstEventHour,
      l.calendar.assumedFirstEventHour,
      d.calendar.assumedFirstEventHour,
    ),
    weekendDaysOff: config.calendar.weekendDaysOff !== false,
  };

  return {
    observer: {
      homePlaceId:
        typeof config.observer.homePlaceId === 'string' ? config.observer.homePlaceId : null,
      walkToleranceMin: clampNumber(
        config.observer.walkToleranceMin,
        l.observer.walkToleranceMin,
        d.observer.walkToleranceMin,
      ),
      minSleepHours: clampNumber(
        config.observer.minSleepHours,
        l.observer.minSleepHours,
        d.observer.minSleepHours,
      ),
      wakeBufferMin: clampNumber(
        config.observer.wakeBufferMin,
        l.observer.wakeBufferMin,
        d.observer.wakeBufferMin,
      ),
      packUpMin: clampNumber(config.observer.packUpMin, l.observer.packUpMin, d.observer.packUpMin),
      averageSpeedKmh: clampNumber(
        config.observer.averageSpeedKmh,
        l.observer.averageSpeedKmh,
        d.observer.averageSpeedKmh,
      ),
    },
    opticsProfiles: clampProfiles(config.opticsProfiles),
    sites: clampSites(config.sites),
    session: {
      ...session,
      // Minimum dłuższe od maksimum dałoby okno, którego nie da się spełnić.
      maxDurationHours: Math.max(session.maxDurationHours, session.minDurationHours),
    },
    conditions: {
      maxCloudTotal: clampNumber(
        config.conditions.maxCloudTotal,
        l.conditions.maxCloudTotal,
        d.conditions.maxCloudTotal,
      ),
      maxCloudLow: clampNumber(
        config.conditions.maxCloudLow,
        l.conditions.maxCloudLow,
        d.conditions.maxCloudLow,
      ),
      maxCloudHigh: clampNumber(
        config.conditions.maxCloudHigh,
        l.conditions.maxCloudHigh,
        d.conditions.maxCloudHigh,
      ),
      maxWindGustKmh: clampNumber(
        config.conditions.maxWindGustKmh,
        l.conditions.maxWindGustKmh,
        d.conditions.maxWindGustKmh,
      ),
      maxWindGustHandheldKmh: clampNumber(
        config.conditions.maxWindGustHandheldKmh,
        l.conditions.maxWindGustHandheldKmh,
        d.conditions.maxWindGustHandheldKmh,
      ),
      maxMoonIllumination: clampNumber(
        config.conditions.maxMoonIllumination,
        l.conditions.maxMoonIllumination,
        d.conditions.maxMoonIllumination,
      ),
      minWindowMinutes: clampNumber(
        config.conditions.minWindowMinutes,
        l.conditions.minWindowMinutes,
        d.conditions.minWindowMinutes,
      ),
      dewWarningSpreadC: clampNumber(
        config.conditions.dewWarningSpreadC,
        l.conditions.dewWarningSpreadC,
        d.conditions.dewWarningSpreadC,
      ),
      travelPenaltyPerHour: clampNumber(
        config.conditions.travelPenaltyPerHour,
        l.conditions.travelPenaltyPerHour,
        d.conditions.travelPenaltyPerHour,
      ),
    },
    calendar: {
      ...calendar,
      // „Tylko dom" jest łagodniejsze od odrzucenia, więc nie może wypadać wcześniej.
      homeOnlyBeforeHour: Math.max(calendar.homeOnlyBeforeHour, calendar.rejectBeforeHour),
    },
  };
}

/** Scala zapisane fragmenty z wartościami domyślnymi, sekcja po sekcji. */
export function mergeConfig(stored: unknown): LunarisConfig {
  if (typeof stored !== 'object' || stored === null) return DEFAULT_CONFIG;

  const raw = stored as Partial<Record<keyof LunarisConfig, object>> & { optics?: object };
  const section = <K extends keyof LunarisConfig>(key: K): LunarisConfig[K] =>
    typeof raw[key] === 'object' && raw[key] !== null
      ? ({ ...DEFAULT_CONFIG[key], ...raw[key] } as LunarisConfig[K])
      : DEFAULT_CONFIG[key];

  // Zapisy sprzed wielu zestawów trzymały jedną optykę — staje się pierwszym
  // profilem zamiast przepaść.
  const profiles: OpticsProfile[] = Array.isArray(raw.opticsProfiles)
    ? (raw.opticsProfiles as OpticsProfile[])
    : raw.optics
      ? [{ id: newProfileId(), label: '', optics: raw.optics as OpticsProfile['optics'] }]
      : DEFAULT_CONFIG.opticsProfiles;

  // Katalog miejsc: zapisy sprzed tej wersji go nie mają, więc dostają domyślny.
  // Pusta zapisana lista zostaje pusta — użytkownik mógł skasować wszystkie.
  const sites: ObservingSite[] = Array.isArray(raw.sites)
    ? (raw.sites as ObservingSite[])
    : DEFAULT_CONFIG.sites;

  return clampConfig({
    observer: section('observer'),
    opticsProfiles: profiles,
    sites,
    session: section('session'),
    conditions: section('conditions'),
    calendar: section('calendar'),
  });
}
