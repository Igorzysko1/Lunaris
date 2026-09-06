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
export type Blocker = 'cloud-total' | 'cloud-low' | 'wind' | 'precipitation';

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
  | { kind: 'tight-sleep'; sleepHours: number };

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
  config: LunarisConfig;
};

/** Pierwszy próg, którego godzina nie spełnia. Kolejność od najcięższego powodu. */
function blockerFor(hour: NightHour, config: LunarisConfig): Blocker | null {
  const { conditions } = config;

  if (hour.precipitation > 0) return 'precipitation';
  if (hour.cloudLow > conditions.maxCloudLow) return 'cloud-low';
  if (hour.cloud > conditions.maxCloudTotal) return 'cloud-total';
  if (hour.windGust >= conditions.maxWindGustKmh) return 'wind';
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
    const blocker = blockerFor(hour, config);

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
  const blocker =
    [...blockers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  if (!best || longestMinutes < config.conditions.minWindowMinutes) {
    return { window: null, longestMinutes, blocker };
  }

  return { window: { ...best, durationMinutes: longestMinutes, moonLimited: false }, longestMinutes, blocker };
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
  const returnAt = new Date(
    window.to.getTime() + (config.observer.packUpMin + travel) * MINUTE_MS,
  );

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

  const { window, longestMinutes, blocker } = longestBlock(hours, night, config);

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

  const minSpread = Math.min(...inWindow.map((h) => h.dewSpread));
  if (minSpread < config.conditions.dewWarningSpreadC) {
    warnings.push({ kind: 'dew', minSpreadC: minSpread });
  }

  const maxHigh = Math.max(...inWindow.map((h) => h.cloudHigh));
  if (maxHigh > 0 && maxHigh <= config.conditions.maxCloudHigh) {
    warnings.push({ kind: 'high-clouds', maxPercent: maxHigh });
  }

  // Ostrzeżenie o marszu od parkingu wnosi katalog lokalizacji, gdy pozna dojście
  // do stanowiska — silnik nie ma skąd wziąć tej informacji z prognozy.

  const observing: ObservingWindow = { ...window, moonLimited };
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

  if (plan.sleepHours !== null && plan.sleepHours < config.observer.minSleepHours) {
    return {
      ...withPlan,
      status: 'no-go',
      rejection: { kind: 'not-enough-sleep', sleepHours: plan.sleepHours },
    };
  }

  // Sen „na styk" musi być widoczny — to jedyny moment, w którym użytkownik
  // może sam odpuścić, zanim wyjedzie.
  if (
    plan.sleepHours !== null &&
    plan.sleepHours < config.observer.minSleepHours + 0.5
  ) {
    warnings.push({ kind: 'tight-sleep', sleepHours: plan.sleepHours });
  }

  return { ...withPlan, status: 'go', rejection: null };
}
