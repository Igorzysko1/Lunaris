/**
 * Zdarzenia planetarne liczone offline przez Astronomy Engine: koniunkcje,
 * opozycje i zaćmienia.
 *
 * Astronomy Engine, a nie suncalc: ten drugi zna wyłącznie Słońce i Księżyc.
 * Rachunki idą z efemeryd (VSOP87/skrócony ELP), więc nie potrzebujemy sieci —
 * cała warstwa eventów działa bez połączenia.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import {
  AngleBetween,
  Body,
  Equator,
  GeoVector,
  Horizon,
  Illumination,
  NextLunarEclipse,
  Observer,
  SearchLocalSolarEclipse,
  SearchLunarEclipse,
  SearchRelativeLongitude,
  type Vector,
} from 'astronomy-engine';

import type { AstroEvent } from '../data/events.ts';
import type { Coords } from '../data/places.ts';
import { nightWindow, sampleNight } from './night-window.ts';

const HOUR_MS = 3_600_000;

/** Nazwy dopełniaczowe — tytuły eventów budujemy jako „Koniunkcja Księżyca i Jowisza". */
const GENITIVE: Partial<Record<Body, string>> = {
  [Body.Moon]: 'Księżyca',
  [Body.Mercury]: 'Merkurego',
  [Body.Venus]: 'Wenus',
  [Body.Mars]: 'Marsa',
  [Body.Jupiter]: 'Jowisza',
  [Body.Saturn]: 'Saturna',
  [Body.Uranus]: 'Urana',
  [Body.Neptune]: 'Neptuna',
};

const NOMINATIVE: Partial<Record<Body, string>> = {
  [Body.Moon]: 'Księżyc',
  [Body.Mercury]: 'Merkury',
  [Body.Venus]: 'Wenus',
  [Body.Mars]: 'Mars',
  [Body.Jupiter]: 'Jowisz',
  [Body.Saturn]: 'Saturn',
  [Body.Uranus]: 'Uran',
  [Body.Neptune]: 'Neptun',
};

/**
 * Ciała brane pod uwagę w koniunkcjach: Księżyc i planety widoczne gołym okiem.
 * Uran i Neptun odpadają — ich koniunkcje nie są zdarzeniem, które da się zobaczyć
 * bez teleskopu, a zaśmiecałyby listę.
 */
const CONJUNCTION_BODIES: Body[] = [
  Body.Moon,
  Body.Mercury,
  Body.Venus,
  Body.Mars,
  Body.Jupiter,
  Body.Saturn,
];

/** Planety zewnętrzne — tylko one wchodzą w opozycję do Słońca. */
const OUTER_PLANETS: Body[] = [
  Body.Mars,
  Body.Jupiter,
  Body.Saturn,
  Body.Uranus,
  Body.Neptune,
];

/** Próg koniunkcji: separacja poniżej 5° to zbliżenie widoczne gołym okiem jako para. */
const CONJUNCTION_MAX_SEPARATION = 5;

/** Krok skanowania separacji. Sześć godzin wystarcza — nawet Księżyc przebiega w tym czasie ~3°. */
const SCAN_STEP_MS = 6 * HOUR_MS;

const observerOf = (coords: Coords) => new Observer(coords.lat, coords.lon, 0);

/** Wysokość ciała nad horyzontem w danym momencie, w stopniach. */
function altitudeOf(body: Body, at: Date, coords: Coords): number {
  const observer = observerOf(coords);
  const equator = Equator(body, at, observer, true, true);
  return Horizon(at, observer, equator.ra, equator.dec, 'normal').altitude;
}

/** Największa wysokość ciała nad horyzontem tej nocy — do opisu eventu. */
function peakAltitudeAtNight(body: Body, at: Date, coords: Coords): number {
  return Math.max(
    ...sampleNight(nightWindow(at, coords)).map((sample) =>
      altitudeOf(body, sample, coords),
    ),
  );
}

const DAY_MS = 86_400_000;

/**
 * Najlepszy moment na zobaczenie pary — najwyższe wspólne położenie nad horyzontem.
 *
 * Ścisła koniunkcja często wypada w środku dnia, a wtedy godzina na karcie byłaby
 * dla obserwatora bezużyteczna. Sprawdzamy obie sąsiednie noce (przed i po
 * zbliżeniu) i bierzemy tę, w której para wznosi się wyżej — tak samo jak przy
 * rojach meteorów, gdzie liczy się moment najwyższego radiantu.
 *
 * Pod uwagę biorą się tylko chwile, w których para wciąż mieści się w progu
 * koniunkcji: Księżyc przemierza pół stopnia na godzinę, więc kilkanaście godzin
 * po zbliżeniu byłby od planety dalej niż o 5° i „koniunkcja" przestałaby nią być.
 *
 * Wysokość to minimum z obu ciał — parę widać dopiero wtedy, gdy nad horyzontem
 * jest jej słabszy składnik.
 */
function bestPairMoment(
  a: Body,
  b: Body,
  conjunction: Date,
  coords: Coords,
): { at: Date; altitude: number } {
  let best = { at: conjunction, altitude: -90 };

  for (const offset of [-DAY_MS, 0]) {
    const window = nightWindow(new Date(conjunction.getTime() + offset), coords);
    for (const sample of sampleNight(window)) {
      const gap = separation(GeoVector(a, sample, true), GeoVector(b, sample, true));
      if (gap > CONJUNCTION_MAX_SEPARATION) continue;

      const altitude = Math.min(altitudeOf(a, sample, coords), altitudeOf(b, sample, coords));
      if (altitude > best.altitude) best = { at: sample, altitude };
    }
  }

  // Para nie wychodzi nad horyzont żadnej z nocy — zostaje moment ścisłej koniunkcji.
  return best.altitude > 0 ? best : { at: conjunction, altitude: best.altitude };
}

const separation = (a: Vector, b: Vector) => AngleBetween(a, b);

/**
 * Moment najciaśniejszego zbliżenia w przedziale, przez trójpodział.
 *
 * Separacja ma w okolicy koniunkcji jedno minimum, więc wystarczy zwężać
 * przedział — bisekcja po pochodnej byłaby wrażliwa na szum numeryczny.
 */
function refineConjunction(a: Body, b: Body, from: number, to: number): Date {
  let lo = from;
  let hi = to;

  while (hi - lo > 60_000) {
    const third = (hi - lo) / 3;
    const m1 = new Date(lo + third);
    const m2 = new Date(hi - third);

    const s1 = separation(GeoVector(a, m1, true), GeoVector(b, m1, true));
    const s2 = separation(GeoVector(a, m2, true), GeoVector(b, m2, true));

    if (s1 < s2) hi = m2.getTime();
    else lo = m1.getTime();
  }

  return new Date(Math.round(((lo + hi) / 2) / 60_000) * 60_000);
}

function conjunctionDescription(
  a: Body,
  b: Body,
  gap: number,
  altitude: number,
  at: Date,
): string {
  const pair = `${NOMINATIVE[a]} i ${NOMINATIVE[b]}`;
  const where =
    altitude > 0
      ? `Para stoi wtedy na ${Math.round(altitude)}° nad horyzontem`
      : 'Para nie wychodzi nad horyzont po zmierzchu — zbliżenie wypada nad dziennym niebem';

  // Jasność ma sens tylko dla planet; dla Księżyca podajemy oświetlenie tarczy.
  const brightness =
    a === Body.Moon
      ? `Księżyc oświetlony w ${Math.round(Illumination(Body.Moon, at).phase_fraction * 100)}%`
      : `${NOMINATIVE[a]} ${Illumination(a, at).mag.toFixed(1)} mag`;

  return `${pair} w odległości ${gap.toFixed(1)}°. ${where}. ${brightness}.`;
}

/**
 * Koniunkcje w zadanym oknie: każda para z CONJUNCTION_BODIES, separacja poniżej progu.
 *
 * Wektory geocentryczne liczymy raz na krok czasowy dla wszystkich ciał i dopiero
 * z nich składamy pary — inaczej te same efemerydy liczylibyśmy piętnaście razy.
 */
export function conjunctionEvents(from: Date, to: Date, coords: Coords): AstroEvent[] {
  const pairs: [Body, Body][] = [];
  for (let i = 0; i < CONJUNCTION_BODIES.length; i++) {
    for (let j = i + 1; j < CONJUNCTION_BODIES.length; j++) {
      pairs.push([CONJUNCTION_BODIES[i], CONJUNCTION_BODIES[j]]);
    }
  }

  // Dla każdej pary: poprzednia i przedpoprzednia separacja, do wykrycia minimum.
  const history = new Map<string, { prev: number; prevPrev: number; prevTime: number }>();
  const events: AstroEvent[] = [];

  for (let t = from.getTime(); t <= to.getTime() + SCAN_STEP_MS; t += SCAN_STEP_MS) {
    const at = new Date(t);
    const vectors = new Map<Body, Vector>(
      CONJUNCTION_BODIES.map((body) => [body, GeoVector(body, at, true)]),
    );

    for (const [a, b] of pairs) {
      const key = `${a}-${b}`;
      const gap = separation(vectors.get(a)!, vectors.get(b)!);
      const past = history.get(key);

      // Minimum lokalne: separacja malała, a teraz rośnie.
      if (past && past.prev <= past.prevPrev && past.prev < gap && past.prev < CONJUNCTION_MAX_SEPARATION) {
        const peak = refineConjunction(a, b, past.prevTime - SCAN_STEP_MS, t);

        if (peak >= from && peak <= to) {
          // Godzina na karcie to moment obserwacji, nie moment ścisłego zbliżenia —
          // dlatego separację podajemy tę, którą realnie widać na niebie.
          const best = bestPairMoment(a, b, peak, coords);
          const gapThen = separation(GeoVector(a, best.at, true), GeoVector(b, best.at, true));

          events.push({
            id: `conj-${a}-${b}-${peak.toISOString().slice(0, 10)}`,
            cat: a === Body.Moon ? 'moon' : 'planets',
            type: 'conjunction',
            at: best.at,
            title: `Koniunkcja ${GENITIVE[a]} i ${GENITIVE[b]}`,
            desc: conjunctionDescription(a, b, gapThen, best.altitude, best.at),
            visible: best.altitude > 0,
          });
        }
      }

      history.set(key, {
        prev: gap,
        prevPrev: past?.prev ?? gap,
        prevTime: t,
      });
    }
  }

  return events;
}

/**
 * Opozycje planet zewnętrznych — planeta po przeciwnej stronie nieba niż Słońce,
 * czyli najbliżej Ziemi i widoczna przez całą noc. Najlepszy moment w roku.
 */
export function oppositionEvents(from: Date, to: Date, coords: Coords): AstroEvent[] {
  const events: AstroEvent[] = [];

  for (const planet of OUTER_PLANETS) {
    // Uwaga: „relative longitude" w Astronomy Engine to heliocentryczna długość
    // planety minus długość Ziemi. Opozycja planety zewnętrznej to 0° (Ziemia
    // dokładnie między Słońcem a planetą); 180° oznaczałoby koniunkcję ze Słońcem.
    const time = SearchRelativeLongitude(planet, 0, from);
    const at = time.date;
    if (at < from || at > to) continue;

    const altitude = peakAltitudeAtNight(planet, at, coords);
    const magnitude = Illumination(planet, at).mag;

    events.push({
      id: `opp-${planet}-${at.toISOString().slice(0, 10)}`,
      cat: 'planets',
      type: 'opposition',
      at,
      title: `Opozycja ${GENITIVE[planet]}`,
      desc:
        `${NOMINATIVE[planet]} w opozycji do Słońca — najbliżej Ziemi w tym cyklu, ` +
        `widoczny przez całą noc, jasność ${magnitude.toFixed(1)} mag. ` +
        `Kulminuje na ${Math.round(altitude)}° nad horyzontem.`,
      visible: altitude > 0,
    });
  }

  return events;
}

const LUNAR_ECLIPSE_KIND: Record<string, string> = {
  penumbral: 'półcieniowe',
  partial: 'częściowe',
  total: 'całkowite',
};

const SOLAR_ECLIPSE_KIND: Record<string, string> = {
  partial: 'częściowe',
  annular: 'obrączkowe',
  total: 'całkowite',
};

/**
 * Zaćmienia Słońca i Księżyca w oknie.
 *
 * Słoneczne szukamy w wariancie lokalnym (`SearchLocalSolarEclipse`) — globalny
 * powiedziałby tylko, że zaćmienie w ogóle jest, a nie czy widać je stąd.
 * Księżycowe są widoczne z całej półkuli nocnej, więc wystarczy sprawdzić, czy
 * Księżyc jest wtedy nad horyzontem.
 */
export function eclipseEvents(from: Date, to: Date, coords: Coords): AstroEvent[] {
  const events: AstroEvent[] = [];

  let lunar = SearchLunarEclipse(from);
  while (lunar.peak.date <= to) {
    const at = lunar.peak.date;
    if (at >= from) {
      const altitude = altitudeOf(Body.Moon, at, coords);
      events.push({
        id: `ecl-moon-${at.toISOString().slice(0, 10)}`,
        cat: 'moon',
        type: 'eclipse',
        at,
        title: `Zaćmienie Księżyca (${LUNAR_ECLIPSE_KIND[lunar.kind] ?? lunar.kind})`,
        desc:
          altitude > 0
            ? `Maksimum fazy z Księżycem na ${Math.round(altitude)}° nad horyzontem — widoczne z tej lokalizacji, bez sprzętu.`
            : 'Maksimum wypada, gdy Księżyc jest pod horyzontem — z tej lokalizacji zjawiska nie widać.',
        visible: altitude > 0,
      });
    }
    lunar = NextLunarEclipse(lunar.peak);
  }

  const solar = SearchLocalSolarEclipse(from, observerOf(coords));
  const solarPeak = solar.peak.time.date;
  if (solarPeak >= from && solarPeak <= to) {
    const obscuration = Math.round(solar.obscuration * 100);
    events.push({
      id: `ecl-sun-${solarPeak.toISOString().slice(0, 10)}`,
      cat: 'planets',
      type: 'eclipse',
      at: solarPeak,
      title: `Zaćmienie Słońca (${SOLAR_ECLIPSE_KIND[solar.kind] ?? solar.kind})`,
      desc:
        `Z tej lokalizacji tarcza Słońca zakryta w ${obscuration}%, ` +
        `maksimum przy Słońcu na ${Math.round(solar.peak.altitude)}° nad horyzontem. ` +
        'Obserwacja wyłącznie przez filtr słoneczny.',
      visible: solar.peak.altitude > 0,
    });
  }

  return events;
}
