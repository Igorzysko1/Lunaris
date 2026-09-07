/**
 * Werdykty na kolejne noce — rachunek wspólny dla ekranu i dla cyklu dobowego.
 *
 * Dotąd żył w hooku `useSessions`, czyli był dostępny wyłącznie wtedy, gdy ktoś
 * patrzył na ekran. Przegląd zjawisk potrzebuje tych samych werdyktów raz na
 * dobę, bez udziału interfejsu: powiadomienie „jutro maksimum Perseid" ma sens
 * tylko razem z informacją, czy tej nocy w ogóle da się jechać.
 *
 * Funkcja jest czysta — dostaje prognozę i konfigurację, zwraca werdykty.
 * Dlatego zmiana progu przelicza je natychmiast i bez sieci, a ten sam rachunek
 * wykona CLI poza aplikacją.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import * as SunCalc from 'suncalc';

import type { AstroEvent, EventType } from '../data/events.ts';
import type { Coords } from '../data/places.ts';
import { computeNightRating } from './astro.ts';
import type { LunarisConfig } from './config.ts';
import { windLimitKmh } from './optics.ts';
import { seeingOver, type Seeing } from './seeing.ts';
import { assumedNextDay, evaluateNight, type NightVerdict } from './session-engine.ts';
import { nightTargetsForProfiles, type SkyTarget } from './sky-targets.ts';
import type { NightSlice } from './weather.ts';

/**
 * Od czwartej doby modele pogodowe rozjeżdżają się na tyle, że werdykt „jedź"
 * byłby obietnicą bez pokrycia. Trzeciej nocy nie ukrywamy, tylko oznaczamy.
 */
const UNCERTAIN_FROM_INDEX = 2;

export type PlannedNight = {
  verdict: NightVerdict;
  /** Najniższa temperatura w oknie obserwacyjnym — do decyzji, jak się ubrać. */
  minTemperature: number | null;
  /** Cele w zasięgu któregokolwiek z zestawów. Puste, gdy nocy nie ma. */
  targets: SkyTarget[];
  /** Prognoza na tę dobę jest już orientacyjna. */
  uncertain: boolean;
  /**
   * Spokój atmosfery w oknie obserwacyjnym. `null`, gdy okna nie ma.
   *
   * Nie wchodzi do werdyktu i nie może go zmienić: przy lornetce seeing nie ma
   * znaczenia, a przy teleskopie rozstrzyga tylko o tym, co warto oglądać —
   * nie o tym, czy jechać.
   */
  seeing: Seeing | null;
};

/**
 * Zjawiska, które w danym miesiącu się nie powtórzą.
 *
 * Fazy Księżyca wracają co miesiąc, a koniunkcje Księżyca z planetami niemal
 * równie często — nie są powodem, żeby zarywać noc. Zaćmienia, opozycje planet
 * i maksima rojów zdarzają się raz i tego się nie odrabia.
 */
const UNIQUE_TYPES: EventType[] = ['eclipse', 'opposition', 'meteor_shower'];

export type NightPlanInput = {
  nights: NightSlice[];
  target: Coords;
  /** Punkt startowy; `null`, gdy użytkownik go nie ustawił. */
  home: Coords | null;
  config: LunarisConfig;
  bortle: number;
  walkMinutes: number;
  /**
   * Zjawiska na najbliższe noce. Bez nich żadna noc nie jest „niepowtarzalna",
   * a wtedy silnik skraca dla snu nawet noc zaćmienia.
   */
  events?: AstroEvent[];
};

export function planNights({
  nights,
  target,
  home,
  config,
  bortle,
  walkMinutes,
  events = [],
}: NightPlanInput): PlannedNight[] {
  // Okno oceniamy najłagodniejszym progiem wiatru spośród zestawów — noc dobra
  // dla sprzętu na statywie nie ma przepadać przez to, że w konfiguracji stoi
  // obok niego lornetka trzymana z ręki.
  const windLimit = Math.max(
    ...config.opticsProfiles.map((p) =>
      windLimitKmh(p.optics, {
        tripod: config.conditions.maxWindGustKmh,
        handheld: config.conditions.maxWindGustHandheldKmh,
      }),
    ),
  );

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  return nights.map(({ night, hours }, index) => {
    const illumination = Math.round(SunCalc.getMoonIllumination(night.from).fraction * 100);

    // Ta sama ocena, którą użytkownik widzi na ekranie Noc. Musi być ta sama,
    // bo to ona przesądza o wyjątku od skracania sesji — gdyby silnik liczył ją
    // po swojemu, wyjątek odpalałby się przy innej liczbie, niż widać.
    const rating = computeNightRating({
      avgCloud: avg(hours.map((h) => h.cloud)),
      avgHumidity: avg(hours.map((h) => h.humidity)),
      precipitation: hours.reduce((sum, h) => sum + h.precipitation, 0),
      moonIllumination: illumination,
      bortle,
    });

    const uniquePhenomenon = events.some(
      (e) => e.visible && UNIQUE_TYPES.includes(e.type) && e.at >= night.from && e.at <= night.to,
    );

    const verdict = evaluateNight({
      night,
      hours,
      moon: {
        illumination,
        upAt: (at) => SunCalc.getMoonPosition(at, target.lat, target.lon).altitude > 0,
      },
      target,
      home,
      nextDay: assumedNextDay(night, config),
      uniquePhenomenon,
      rating,
      windLimitKmh: windLimit,
      walkMinutes,
      config,
    });

    const window = verdict.window;
    const inWindow = window ? hours.filter((h) => h.at >= window.from && h.at <= window.to) : [];

    return {
      verdict,
      seeing: seeingOver(inWindow),
      minTemperature: inWindow.length ? Math.min(...inWindow.map((h) => h.temperature)) : null,
      targets: window ? nightTargetsForProfiles(window, target, config.opticsProfiles, bortle) : [],
      uncertain: index >= UNCERTAIN_FROM_INDEX,
    };
  });
}
