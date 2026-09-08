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
import { DEFAULT_REFRESH_HOUR } from './daily-cycle.ts';
import { isValidMask, type HorizonOverride } from './horizon.ts';
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
  /**
   * Najkrótsza sesja warta wyjazdu, w minutach.
   *
   * Jeden próg na całą długość sesji — nie dwa. Wcześniej obok siebie stały
   * „minimalne okno pogodowe" i „minimalna długość sesji", w różnych jednostkach
   * i sekcjach, sprawdzane na różnych etapach: pierwszy przed przycięciem,
   * drugi po. Ta sama noc mogła przejść jeden, a nie przejść drugiego, a
   * użytkownik nie miał jak zgadnąć, który zadziałał.
   */
  minDurationMinutes: number;
  /** Najdłuższa sesja, na jaką użytkownik ma ochotę. Przycina, a nie odrzuca. */
  maxDurationMinutes: number;
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
  /**
   * Ocena nocy, powyżej której sesja przestaje być skracana dla snu.
   *
   * Nie jest to twardy limit, tylko granica wyjątku: noc oceniona wyżej ma być
   * pokazana w całości, nawet jeśli oznacza to nieprzespaną noc — o takiej
   * użytkownik chce wiedzieć, a decyzję podejmuje sam. Sto wyłącza wyjątek.
   */
  exceptionalRating: number;
  /**
   * Ocena nocy, od której warto obudzić telefon.
   *
   * Osobna od `exceptionalRating` i wyraźnie niższa, bo odpowiada na inne
   * pytanie. Tamta znaczy „warto zarwać noc" i z definicji zdarza się rzadko;
   * ta znaczy „zapowiada się dobrze, przygotuj się". Wspólny próg oznaczałby
   * powiadomienie kilka razy w roku, czyli funkcję, o której istnieniu
   * użytkownik zdąży zapomnieć. Sto wycisza zapowiedzi nocy, zostawiając same
   * zjawiska.
   */
  notifyRating: number;
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

/**
 * Kiedy aplikacja sięga po dane z sieci.
 *
 * Godzina jest tu, a nie w kodzie, bo „pora podejmowania decyzji" to nawyk
 * użytkownika, a nie własność systemu: ktoś decyduje o wyjeździe po pracy,
 * ktoś inny w porze obiadu.
 */
export type RefreshSchedule = {
  /** Pełna godzina lokalna, o której cykl ma odświeżyć dane. */
  hourOfDay: number;
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
  refresh: RefreshSchedule;
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
    minDurationMinutes: 120,
    maxDurationMinutes: 300,
  },
  conditions: {
    maxCloudTotal: 25,
    maxCloudLow: 10,
    maxCloudHigh: 40,
    maxWindGustKmh: 25,
    maxWindGustHandheldKmh: 15,
    maxMoonIllumination: 30,
    dewWarningSpreadC: 2,
    travelPenaltyPerHour: 10,
    exceptionalRating: 85,
    notifyRating: 70,
  },
  calendar: {
    rejectBeforeHour: 8,
    homeOnlyBeforeHour: 10,
    exceptionalMaxCloud: 10,
    assumedFirstEventHour: 8,
    weekendDaysOff: true,
  },
  refresh: {
    hourOfDay: DEFAULT_REFRESH_HOUR,
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
    minDurationMinutes: { min: 30, max: 720 },
    maxDurationMinutes: { min: 30, max: 840 },
  },
  conditions: {
    maxCloudTotal: { min: 0, max: 100 },
    maxCloudLow: { min: 0, max: 100 },
    maxCloudHigh: { min: 0, max: 100 },
    maxWindGustKmh: { min: 0, max: 120 },
    maxWindGustHandheldKmh: { min: 0, max: 120 },
    maxMoonIllumination: { min: 0, max: 100 },
    dewWarningSpreadC: { min: 0, max: 15 },
    travelPenaltyPerHour: { min: 0, max: 50 },
    exceptionalRating: { min: 0, max: 100 },
    notifyRating: { min: 0, max: 100 },
  },
  sites: {
    bortle: { min: 1, max: 9 },
    walkMinutes: { min: 0, max: 240 },
    accuracyM: { min: 0, max: 10000 },
    lat: { min: -90, max: 90 },
    lon: { min: -180, max: 180 },
  },
  refresh: {
    hourOfDay: { min: 0, max: 23 },
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

/** Korekty sektorów: kąty sprowadzone do zakresu, wpisy bez sensu pominięte. */
function clampOverrides(overrides: unknown): HorizonOverride[] {
  const wrap = (v: number) => ((Math.round(v) % 360) + 360) % 360;

  return (Array.isArray(overrides) ? overrides : [])
    .filter(
      (o): o is HorizonOverride =>
        typeof o === 'object' &&
        o !== null &&
        Number.isFinite(o.from) &&
        Number.isFinite(o.to) &&
        Number.isFinite(o.altitude),
    )
    .map((o) => ({
      from: wrap(o.from),
      to: wrap(o.to),
      altitude: Math.min(90, Math.max(0, o.altitude)),
    }));
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
      // Brak pomiaru to nie zero metrów, tylko brak informacji — stąd null,
      // a nie wartość domyślna.
      accuracyM: Number.isFinite(s.accuracyM as number)
        ? clampNumber(s.accuracyM as number, l.accuracyM, 0)
        : null,
      // Maska albo jest kompletna, albo jej nie ma. Częściowa byłaby gorsza od
      // braku: milcząco chowałaby cele w kierunkach, których nikt nie policzył.
      horizonMask: isValidMask(s.horizonMask) ? s.horizonMask : null,
      horizonOverrides: clampOverrides(s.horizonOverrides),
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
    minDurationMinutes: clampNumber(
      config.session.minDurationMinutes,
      l.session.minDurationMinutes,
      d.session.minDurationMinutes,
    ),
    maxDurationMinutes: clampNumber(
      config.session.maxDurationMinutes,
      l.session.maxDurationMinutes,
      d.session.maxDurationMinutes,
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
      maxDurationMinutes: Math.max(session.maxDurationMinutes, session.minDurationMinutes),
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
      exceptionalRating: clampNumber(
        config.conditions.exceptionalRating,
        l.conditions.exceptionalRating,
        d.conditions.exceptionalRating,
      ),
      notifyRating: clampNumber(
        config.conditions.notifyRating,
        l.conditions.notifyRating,
        d.conditions.notifyRating,
      ),
    },
    calendar: {
      ...calendar,
      // „Tylko dom" jest łagodniejsze od odrzucenia, więc nie może wypadać wcześniej.
      homeOnlyBeforeHour: Math.max(calendar.homeOnlyBeforeHour, calendar.rejectBeforeHour),
    },
    refresh: {
      // Pełna godzina: cykl porównuje znaczniki z terminem, a termin z ułamkiem
      // godziny nie dałby się zapisać w interfejsie ani sensownie odczytać.
      hourOfDay: Math.round(
        clampNumber(config.refresh.hourOfDay, l.refresh.hourOfDay, d.refresh.hourOfDay),
      ),
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

  // Długość sesji trzymana była w godzinach, a próg okna pogodowego osobno,
  // w minutach. Przeliczamy stare pola zamiast je gubić — użytkownik nie ma
  // powodu ustawiać tego drugi raz tylko dlatego, że zmieniła się jednostka.
  const storedSession = (raw.session ?? {}) as Record<string, unknown>;
  const legacyHours = (key: string): number | undefined =>
    typeof storedSession[key] === 'number' ? (storedSession[key] as number) * 60 : undefined;

  const session: SessionMode = {
    ...DEFAULT_CONFIG.session,
    ...(raw.session as Partial<SessionMode>),
    minDurationMinutes:
      (raw.session as Partial<SessionMode>)?.minDurationMinutes ??
      legacyHours('minDurationHours') ??
      DEFAULT_CONFIG.session.minDurationMinutes,
    maxDurationMinutes:
      (raw.session as Partial<SessionMode>)?.maxDurationMinutes ??
      legacyHours('maxDurationHours') ??
      DEFAULT_CONFIG.session.maxDurationMinutes,
  };

  // Katalog miejsc: zapisy sprzed tej wersji go nie mają, więc dostają domyślny.
  // Pusta zapisana lista zostaje pusta — użytkownik mógł skasować wszystkie.
  const sites: ObservingSite[] = Array.isArray(raw.sites)
    ? (raw.sites as ObservingSite[])
    : DEFAULT_CONFIG.sites;

  return clampConfig({
    observer: section('observer'),
    opticsProfiles: profiles,
    sites,
    session,
    conditions: section('conditions'),
    calendar: section('calendar'),
    refresh: section('refresh'),
  });
}
