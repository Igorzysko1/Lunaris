/**
 * Silnik okien obserwacyjnych — decyduje, czy i kiedy tej nocy jechać.
 *
 * W pełni deterministyczny: te same dane wejściowe zawsze dają ten sam wynik.
 * Żadnego modelu językowego w tej ścieżce — warstwa narracyjna może opisać
 * werdykt, ale nie ma prawa go zmienić.
 *
 * Wszystkie progi pochodzą z konfiguracji użytkownika. Silnik nie zna ani jednej
 * własnej liczby, bo progi mają być strojone po tygodniach porównywania werdyktów
 * z rzeczywistością, a strojenie nie może wymagać zmiany kodu.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { Coords } from '../data/places.ts';
import { distanceKm } from './astro.ts';
import type { LunarisConfig } from './config.ts';
import type { NightWindow } from './night-window.ts';
import type { NightHour } from './weather.ts';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/** Dlaczego dana godzina nie nadaje się na obserwację. */
export type Blocker = 'cloud-total' | 'cloud-low' | 'cloud-high' | 'wind' | 'precipitation';

/** Dlaczego cała noc odpada. */
export type Rejection =
  | { kind: 'no-forecast' }
  | { kind: 'conditions'; blocker: Blocker }
  | { kind: 'window-too-short'; longestMinutes: number }
  | { kind: 'not-enough-sleep'; sleepHours: number }
  | { kind: 'early-calendar'; firstEventAt: Date };

export type Warning =
  | { kind: 'dew'; minSpreadC: number }
  | { kind: 'high-clouds'; maxPercent: number }
  | { kind: 'moon'; illumination: number }
  | { kind: 'home-only'; firstEventAt: Date }
  | { kind: 'walk-too-long'; walkMinutes: number }
  | { kind: 'tight-sleep'; sleepHours: number }
  /** Wiatr mieści się w progu dla statywu, ale nie dla sprzętu trzymanego z ręki. */
  | { kind: 'handheld-wind'; maxGustKmh: number; handheldLimitKmh: number }
  /**
   * Sesja została skrócona, żeby zmieścić sen albo własny limit długości.
   * Nie jest to powód do rezygnacji, ale użytkownik musi wiedzieć, że jedzie
   * na krócej, niż pozwala pogoda — inaczej zdziwi się na miejscu.
   */
  | { kind: 'session-trimmed'; reason: 'sleep' | 'max-duration'; droppedMinutes: number }
  /**
   * Noc na tyle dobra, że nie skracamy jej dla snu — użytkownik ma o niej
   * wiedzieć mimo wszystko, razem z ceną, którą za nią zapłaci.
   */
  | { kind: 'sleep-sacrifice'; sleepHours: number; reason: 'rating' | 'phenomenon' };

/** Ciągły blok godzin spełniających kryteria. */
export type ObservingWindow = {
  from: Date;
  to: Date;
  durationMinutes: number;
  /**
   * Księżyc świeci powyżej progu przez cały blok — okno zostaje ważne, ale tylko
   * dla celów księżycowych i planetarnych, nie dla obiektów mgławicowych.
   */
  moonLimited: boolean;
};

/** Plan wyjazdu wynikający z okna: kiedy wyjechać, wrócić i wstać. */
export type SessionPlan = {
  departAt: Date;
  returnAt: Date;
  wakeAt: Date | null;
  sleepHours: number | null;
  travelMinutes: number;
};

export type NightVerdict = {
  /** Noc zaczynająca się tego wieczora. */
  night: NightWindow;
  status: 'go' | 'no-go';
  window: ObservingWindow | null;
  plan: SessionPlan | null;
  rejection: Rejection | null;
  warnings: Warning[];
};

/** Kalendarz następnego dnia. Silnik go nie pobiera — dostaje gotowy. */
export type NextDay = {
  /** Pierwsze wydarzenie następnego dnia; `null`, gdy kalendarz jest pusty. */
  firstEventAt: Date | null;
  dayOff: boolean;
};

export type NightInput = {
  night: NightWindow;
  hours: NightHour[];
  /** Oświetlenie tarczy Księżyca (%) i to, czy jest nad horyzontem, godzina po godzinie. */
  moon: { illumination: number; upAt: (at: Date) => boolean };
  target: Coords;
  /** Punkt startowy; `null`, gdy użytkownik go nie ustawił — wtedy nie liczymy dojazdu. */
  home: Coords | null;
  nextDay: NextDay;
  /**
   * Czy tej nocy wypada zjawisko niepowtarzalne w danym miesiącu — trzeci warunek
   * nocy wybitnej. Silnik nie zna kalendarza zjawisk, więc dostaje to z zewnątrz;
   * bez tego każda czysta bezksiężycowa noc łamałaby regułę wczesnego poranka.
   */
  uniquePhenomenon: boolean;
  /**
   * Próg porywów wiatru dla tej nocy. Zależy od montażu, a ten jest per zestaw,
   * więc rozstrzygnięcie zapada wyżej — silnik dostaje jedną gotową liczbę.
   */
  windLimitKmh: number;
  /**
   * Marsz od parkingu do stanowiska w minutach. Zna go katalog miejsc; dla
   * zwykłej miejscowości z bazy jest zerem, bo nie wiemy, gdzie się stanie.
   */
  walkMinutes: number;
  /**
   * Ocena nocy 0–100 — ta sama liczba, którą widzi użytkownik na ekranie.
   * Silnik jej nie liczy, bo do rachunku potrzeba Bortle, a to własność miejsca,
   * nie nocy. Powyżej progu z konfiguracji noc przestaje być skracana dla snu.
   */
  rating: number;
  config: LunarisConfig;
};

/**
 * Pierwszy próg, którego godzina nie spełnia. Kolejność od najcięższego powodu.
 *
 * Chmury wysokie mają własny, łagodniejszy próg, więc próg całkowity stosujemy
 * do zachmurzenia **po ich odjęciu**. Inaczej tolerancja dla cirrusów byłaby
 * martwa: 40% wysokich i tak przepadłoby na progu 25% całkowitych, mimo że przez
 * cirrusy widać gwiazdy, a przez stratusy nie.
 *
 * Odejmowanie jest przybliżeniem — piętra potrafią się nakładać — ale to jedyne,
 * co da się zrobić na danych, które podają każde piętro osobno.
 */
function blockerFor(hour: NightHour, config: LunarisConfig, windLimit: number): Blocker | null {
  const { conditions } = config;
  const cloudBelowHigh = Math.max(0, hour.cloud - hour.cloudHigh);

  if (hour.precipitation > 0) return 'precipitation';
  if (hour.cloudLow > conditions.maxCloudLow) return 'cloud-low';
  if (hour.cloudHigh > conditions.maxCloudHigh) return 'cloud-high';
  if (cloudBelowHigh > conditions.maxCloudTotal) return 'cloud-total';
  if (hour.windGust >= windLimit) return 'wind';
  return null;
}

/**
 * Najdłuższy ciągły blok dobrych godzin.
 *
 * Godziny są punktami prognozy, a nie odcinkami, więc blok od 22:00 do 01:00
 * obejmuje cztery próbki i trwa trzy godziny. Blok przycinamy do okna nocy
 * astronomicznej — poza nim niebo nie jest jeszcze ciemne.
 */
function longestBlock(
  hours: NightHour[],
  night: NightWindow,
  config: LunarisConfig,
  windLimit: number,
): { window: ObservingWindow | null; longestMinutes: number; blocker: Blocker | null } {
  const inNight = hours
    .filter((h) => h.at >= night.from && h.at <= night.to)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  // Brak próbek w oknie to brak danych, a nie za krótkie okno — rozróżnienie
  // ma znaczenie, bo pierwsze naprawia się odświeżeniem, drugie nie.
  if (inNight.length === 0) return { window: null, longestMinutes: -1, blocker: null };

  let best: { from: Date; to: Date } | null = null;
  let current: { from: Date; to: Date } | null = null;
  const blockers = new Map<Blocker, number>();

  for (const hour of inNight) {
    const blocker = blockerFor(hour, config, windLimit);

    if (blocker) {
      blockers.set(blocker, (blockers.get(blocker) ?? 0) + 1);
      current = null;
      continue;
    }

    current = current ? { from: current.from, to: hour.at } : { from: hour.at, to: hour.at };

    const currentMs = current.to.getTime() - current.from.getTime();
    if (!best || currentMs > best.to.getTime() - best.from.getTime()) best = { ...current };
  }

  const longestMinutes = best ? (best.to.getTime() - best.from.getTime()) / MINUTE_MS : 0;

  // Najczęstsza przyczyna blokowania — to ona tłumaczy, dlaczego nocy nie ma.
  const blocker = [...blockers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  if (!best || longestMinutes < config.conditions.minWindowMinutes) {
    return { window: null, longestMinutes, blocker };
  }

  return {
    window: { ...best, durationMinutes: longestMinutes, moonLimited: false },
    longestMinutes,
    blocker,
  };
}

/** Czas przejazdu w minutach. Bez punktu startowego nie ma czego liczyć. */
function travelMinutes(home: Coords | null, target: Coords, config: LunarisConfig): number {
  if (!home) return 0;
  const km = distanceKm(home, target);
  return (km / config.observer.averageSpeedKmh) * 60;
}

/**
 * Plan wyjazdu i snu.
 *
 * Przy nocleg w terenie godzina powrotu i pobudki przestaje mieć sens — wtedy
 * liczymy tylko dojazd, a sen zostaje nierozstrzygnięty.
 */
function planFor(window: ObservingWindow, input: NightInput): SessionPlan {
  const { config, nextDay } = input;
  const travel = travelMinutes(input.home, input.target, config);

  const departAt = new Date(window.from.getTime() - travel * MINUTE_MS);
  const returnAt = new Date(window.to.getTime() + (config.observer.packUpMin + travel) * MINUTE_MS);

  if (config.session.overnight || !nextDay.firstEventAt) {
    return { departAt, returnAt, wakeAt: null, sleepHours: null, travelMinutes: travel };
  }

  const wakeAt = new Date(
    nextDay.firstEventAt.getTime() - config.observer.wakeBufferMin * MINUTE_MS,
  );
  const sleepHours = (wakeAt.getTime() - returnAt.getTime()) / HOUR_MS;

  return { departAt, returnAt, wakeAt, sleepHours, travelMinutes: travel };
}

/**
 * Noc na tyle wyjątkowa, że łamie regułę wczesnego poranka: czysto, bez Księżyca
 * i ze zjawiskiem, które w tym miesiącu się nie powtórzy. Wszystkie trzy naraz —
 * sama czysta pogoda zdarza się zbyt często, żeby uzasadniać nieprzespaną noc.
 */
function isExceptional(hours: NightHour[], input: NightInput, window: ObservingWindow): boolean {
  if (!input.uniquePhenomenon) return false;

  const inWindow = hours.filter((h) => h.at >= window.from && h.at <= window.to);
  const clearEnough =
    inWindow.length > 0 &&
    inWindow.every((h) => h.cloud <= input.config.calendar.exceptionalMaxCloud);
  const moonAway = inWindow.every((h) => !input.moon.upAt(h.at));

  return clearEnough && moonAway;
}

/**
 * Czy noc jest warta nieprzespanej nocy.
 *
 * To osobne pojęcie niż `isExceptional`, i celowo łagodniejsze. Tamto rozstrzyga,
 * czy złamać regułę wczesnego poranka — decyzję ciężką, bo dotyczy obowiązków
 * następnego dnia. To rozstrzyga tylko, czy skracać sesję: noc wybitna albo
 * zjawisko, które się nie powtórzy, mają być pokazane w całości, a użytkownik
 * sam zdecyduje, ile z niej weźmie.
 */
function worthLosingSleep(input: NightInput): 'rating' | 'phenomenon' | null {
  if (input.uniquePhenomenon) return 'phenomenon';
  if (input.rating >= input.config.conditions.exceptionalRating) return 'rating';
  return null;
}

/**
 * Najpóźniejszy koniec sesji, przy którym sen jeszcze się mieści.
 *
 * Liczone wstecz od godziny pobudki: pobudka minus minimum snu daje godzinę
 * powrotu, a od niej odejmujemy zwijanie sprzętu i drogę. `null` znaczy, że nic
 * nie ogranicza — nocleg w terenie albo dzień wolny.
 */
function latestEndForSleep(input: NightInput, travel: number): Date | null {
  const { config, nextDay } = input;
  if (config.session.overnight || !nextDay.firstEventAt) return null;

  const wakeAt = nextDay.firstEventAt.getTime() - config.observer.wakeBufferMin * MINUTE_MS;
  const latestReturn = wakeAt - config.observer.minSleepHours * HOUR_MS;

  return new Date(latestReturn - (config.observer.packUpMin + travel) * MINUTE_MS);
}

/**
 * Kalendarz następnego dnia z założenia w konfiguracji.
 *
 * Rozwiązanie zastępcze do czasu podpięcia prawdziwego kalendarza, ale wspólne:
 * ekran Noc i przegląd miejscówek muszą przyjmować to samo, inaczej ta sama noc
 * dostaje dwa różne werdykty w dwóch miejscach aplikacji.
 */
export function assumedNextDay(night: { to: Date }, config: LunarisConfig): NextDay {
  const morning = night.to;
  const dayOff =
    config.calendar.weekendDaysOff && (morning.getDay() === 0 || morning.getDay() === 6);

  const firstEventAt = new Date(morning);
  firstEventAt.setHours(config.calendar.assumedFirstEventHour, 0, 0, 0);

  return { firstEventAt: dayOff ? null : firstEventAt, dayOff };
}

/**
 * Werdykt dla jednej nocy.
 *
 * Kolejność sprawdzeń jest kolejnością powodów odrzucenia: najpierw dane, potem
 * warunki, potem długość okna, na końcu kalendarz i sen. Dzięki temu powód
 * zwracany użytkownikowi jest tym, który faktycznie przesądził.
 */
export function evaluateNight(input: NightInput): NightVerdict {
  const { night, hours, config, nextDay } = input;
  const base = { night, window: null, plan: null, warnings: [] as Warning[] };

  if (hours.length === 0) {
    return { ...base, status: 'no-go', rejection: { kind: 'no-forecast' } };
  }

  const { window, longestMinutes, blocker } = longestBlock(
    hours,
    night,
    config,
    input.windLimitKmh,
  );

  if (!window) {
    if (longestMinutes < 0) {
      return { ...base, status: 'no-go', rejection: { kind: 'no-forecast' } };
    }
    return {
      ...base,
      status: 'no-go',
      rejection:
        longestMinutes > 0 || !blocker
          ? { kind: 'window-too-short', longestMinutes }
          : { kind: 'conditions', blocker },
    };
  }

  const inWindow = hours.filter((h) => h.at >= window.from && h.at <= window.to);
  const warnings: Warning[] = [];

  // Księżyc powyżej progu przez całe okno nie unieważnia nocy, tylko zawęża cele.
  const moonUpAll = inWindow.every((h) => input.moon.upAt(h.at));
  const moonTooBright = input.moon.illumination > config.conditions.maxMoonIllumination;
  const moonLimited = moonUpAll && moonTooBright;
  if (moonLimited) warnings.push({ kind: 'moon', illumination: input.moon.illumination });

  // Okno liczone jest najłagodniejszym progiem; jeśli któryś zestaw jedzie z ręki,
  // trzeba powiedzieć wprost, że dla niego ta noc jest gorsza.
  const maxGust = Math.max(...inWindow.map((h) => h.windGust));
  if (
    input.windLimitKmh > config.conditions.maxWindGustHandheldKmh &&
    maxGust >= config.conditions.maxWindGustHandheldKmh
  ) {
    warnings.push({
      kind: 'handheld-wind',
      maxGustKmh: maxGust,
      handheldLimitKmh: config.conditions.maxWindGustHandheldKmh,
    });
  }

  const minSpread = Math.min(...inWindow.map((h) => h.dewSpread));
  if (minSpread < config.conditions.dewWarningSpreadC) {
    warnings.push({ kind: 'dew', minSpreadC: minSpread });
  }

  // Ostrzegamy dopiero w paśmie, w którym tolerancja wysokich faktycznie działa:
  // powyżej progu całkowitego, ale wciąż w granicach progu dla cirrusów.
  const maxHigh = Math.max(...inWindow.map((h) => h.cloudHigh));
  if (maxHigh > config.conditions.maxCloudTotal && maxHigh <= config.conditions.maxCloudHigh) {
    warnings.push({ kind: 'high-clouds', maxPercent: maxHigh });
  }

  // Marsz od parkingu nie przekreśla wyjazdu, ale musi być widoczny: z lornetką,
  // statywem i termosem czterdzieści minut podejścia to inna wyprawa niż postój
  // przy samochodzie.
  if (input.walkMinutes > config.observer.walkToleranceMin) {
    warnings.push({ kind: 'walk-too-long', walkMinutes: input.walkMinutes });
  }

  // Sesja przycięta wstecz od godziny wymuszonej snem.
  //
  // Wcześniej pełne okno szło do planu w całości, a noc, która się w sen nie
  // mieściła, odpadała w komplecie — czysta, bezksiężycowa noc dostawała werdykt
  // „nie jedź", bo silnik zakładał obserwację do świtu. Teraz ograniczenie
  // **skraca sesję**, zamiast ją przekreślać: to użytkownik decyduje, kiedy
  // wrócić, a nie pogoda.
  const travel = travelMinutes(input.home, input.target, config);
  const sacrifice = worthLosingSleep(input);

  const limits: { at: Date; reason: 'sleep' | 'max-duration' }[] = [];

  // Noc wybitna albo zjawisko nie do powtórzenia nie są skracane — o takiej
  // nocy użytkownik ma się dowiedzieć w całości, razem z jej ceną.
  if (!sacrifice) {
    const latestEnd = latestEndForSleep(input, travel);
    if (latestEnd) limits.push({ at: latestEnd, reason: 'sleep' });

    limits.push({
      at: new Date(window.from.getTime() + config.session.maxDurationHours * HOUR_MS),
      reason: 'max-duration',
    });
  }

  const binding = limits
    .filter((l) => l.at < window.to)
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0];

  const trimmedTo = binding ? binding.at : window.to;
  const trimmedMinutes = (trimmedTo.getTime() - window.from.getTime()) / MINUTE_MS;

  // Po przycięciu obowiązuje próg z sekcji sesji: „jazda na godzinę" nie jest
  // wyprawą wartą pakowania sprzętu. `minWindowMinutes` mówi, kiedy okno pogodowe
  // w ogóle się liczy; to mówi, kiedy wyjazd ma sens.
  const worthTheDrive = Math.max(
    config.conditions.minWindowMinutes,
    config.session.minDurationHours * 60,
  );

  if (binding && trimmedMinutes < worthTheDrive) {
    // Po przycięciu nie zostaje nic sensownego. Powód podajemy ten, który
    // faktycznie przyciął — „musiałbyś wrócić przed 23:00" i „okno było za
    // krótkie" to dla użytkownika dwie różne informacje.
    if (binding.reason === 'sleep') {
      const plan = planFor({ ...window, moonLimited }, input);
      return {
        night,
        window: null,
        plan: null,
        warnings,
        status: 'no-go',
        rejection: { kind: 'not-enough-sleep', sleepHours: plan.sleepHours ?? 0 },
      };
    }

    return {
      night,
      window: null,
      plan: null,
      warnings,
      status: 'no-go',
      rejection: { kind: 'window-too-short', longestMinutes: trimmedMinutes },
    };
  }

  if (binding) {
    warnings.push({
      kind: 'session-trimmed',
      reason: binding.reason,
      droppedMinutes: Math.round((window.to.getTime() - trimmedTo.getTime()) / MINUTE_MS),
    });
  }

  const observing: ObservingWindow = {
    ...window,
    to: trimmedTo,
    durationMinutes: trimmedMinutes,
    moonLimited,
  };
  const plan = planFor(observing, input);
  const withPlan = { night, window: observing, plan, warnings };

  // Kalendarz następnego dnia: godzina pierwszego wydarzenia rządzi wyjazdem.
  const firstEvent = nextDay.firstEventAt;
  if (firstEvent && !nextDay.dayOff) {
    const hour = firstEvent.getHours() + firstEvent.getMinutes() / 60;

    if (hour < config.calendar.rejectBeforeHour && !isExceptional(hours, input, observing)) {
      return {
        ...withPlan,
        status: 'no-go',
        rejection: { kind: 'early-calendar', firstEventAt: firstEvent },
      };
    }

    if (hour < config.calendar.homeOnlyBeforeHour) {
      warnings.push({ kind: 'home-only', firstEventAt: firstEvent });
    }
  }

  // Sen poniżej minimum nie odrzuca już nocy — okno zostało przycięte tak, żeby
  // się mieścił. Zostaje tylko wtedy, gdy świadomie go poświęcamy.
  if (plan.sleepHours !== null && plan.sleepHours < config.observer.minSleepHours) {
    warnings.push({
      kind: 'sleep-sacrifice',
      sleepHours: plan.sleepHours,
      reason: sacrifice ?? 'rating',
    });
  } else if (
    // Sen „na styk" musi być widoczny — to jedyny moment, w którym użytkownik
    // może sam odpuścić, zanim wyjedzie.
    plan.sleepHours !== null &&
    plan.sleepHours < config.observer.minSleepHours + 0.5
  ) {
    warnings.push({ kind: 'tight-sleep', sleepHours: plan.sleepHours });
  }

  return { ...withPlan, status: 'go', rejection: null };
}
