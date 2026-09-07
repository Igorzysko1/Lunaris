/**
 * Generator eventów astronomicznych dla konkretnego miejsca i okna czasu.
 *
 * Wcześniej ekran Eventy pokazywał cztery wpisane ręcznie pozycje — te same
 * niezależnie od daty i lokalizacji. Tu wszystko wynika z rachunku: momenty faz
 * Księżyca z suncalc, maksima rojów z katalogu, a widoczność z wysokości obiektu
 * nad horyzontem w oknie nocy astronomicznej.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import * as SunCalc from 'suncalc';

import type { AstroEvent } from '../data/events.ts';
import { METEOR_SHOWERS, type MeteorShower } from '../data/meteor-showers.ts';
import type { Coords } from '../data/places.ts';
import { nightWindow, sampleNight, type NightWindow } from './night-window.ts';
import { eclipseEvents, conjunctionEvents, oppositionEvents } from './planetary-events.ts';

/** Ile dni w przód pokazujemy. Dwa miesiące łapią 2 nowie, 2 pełnie i kilka rojów. */
const EVENT_HORIZON_DAYS = 60;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Czas gwiazdowy lokalny w stopniach. Standardowy wzór na GMST z epoki J2000
 * (dokładność rzędu sekund kątowych — dla pytania „czy radiant jest nad horyzontem"
 * to o wiele więcej, niż potrzeba).
 */
function localSiderealTime(date: Date, lon: number): number {
  const jd = date.getTime() / DAY_MS + 2440587.5;
  const d = jd - 2451545.0;
  const t = d / 36525;
  const gmst = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38710000;
  return (((gmst + lon) % 360) + 360) % 360;
}

/** Wysokość obiektu o stałych współrzędnych równikowych nad horyzontem, w stopniach. */
function equatorialAltitude(ra: number, dec: number, date: Date, coords: Coords): number {
  const hourAngle = toRad(localSiderealTime(date, coords.lon) - ra);
  const decRad = toRad(dec);
  const latRad = toRad(coords.lat);

  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(hourAngle);

  return toDeg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
}

/** Najwyższe położenie radiantu tej nocy i moment, w którym wypada. */
function bestRadiantMoment(
  shower: MeteorShower,
  window: NightWindow,
  coords: Coords,
): { at: Date; altitude: number } {
  let best = { at: window.from, altitude: -90 };
  for (const at of sampleNight(window)) {
    const altitude = equatorialAltitude(shower.ra, shower.dec, at, coords);
    if (altitude > best.altitude) best = { at, altitude };
  }
  return best;
}

/**
 * Radiant nad 15° — poniżej tej wysokości większość zjawisk ginie za horyzontem
 * i realna liczba meteorów spada do ułamka ZHR.
 */
const MIN_RADIANT_ALTITUDE = 15;

/** Czy Księżyc jest nad horyzontem w którymkolwiek momencie nocy. */
function moonUpAtNight(window: NightWindow, coords: Coords): boolean {
  return sampleNight(window).some(
    (at) => SunCalc.getMoonPosition(at, coords.lat, coords.lon).altitude > 0,
  );
}

const phaseAt = (date: Date) => SunCalc.getMoonIllumination(date).phase;

/**
 * Odległość fazy od celu, przeskalowana do (-0.5, 0.5].
 *
 * Faza jest cykliczna, więc zwykłe odejmowanie ma skok na granicy 1 → 0 i psuje
 * wykrywanie nowiu. Po przesunięciu funkcja przechodzi przez zero rosnąco
 * dokładnie w momencie fazy.
 */
function phaseOffset(date: Date, target: number): number {
  return ((phaseAt(date) - target + 1.5) % 1) - 0.5;
}

/** Moment przejścia fazy przez cel, uściślony bisekcją do pełnej minuty. */
function refinePhaseCrossing(before: Date, after: Date, target: number): Date {
  let lo = before.getTime();
  let hi = after.getTime();

  while (hi - lo > 60_000) {
    const mid = (lo + hi) / 2;
    if (phaseOffset(new Date(mid), target) < 0) lo = mid;
    else hi = mid;
  }

  return new Date(Math.round(hi / 60_000) * 60_000);
}

const MOON_PHASE_TARGETS = [
  { target: 0, event: 'new' as const, title: 'Nów Księżyca' },
  { target: 0.5, event: 'full' as const, title: 'Pełnia Księżyca' },
];

function moonPhaseDescription(event: 'new' | 'full', at: Date, coords: Coords): string {
  const illumination = Math.round(SunCalc.getMoonIllumination(at).fraction * 100);

  if (event === 'new') {
    return `Księżyc nieoświetlony (${illumination}%) — najciemniejsze niebo w miesiącu, najlepszy moment na obiekty mgławicowe i Drogę Mleczną.`;
  }

  const up = moonUpAtNight(nightWindow(at, coords), coords);
  return up
    ? `Tarcza oświetlona w ${illumination}% — Księżyc rozświetla niebo przez większość nocy, słaba widoczność obiektów mgławicowych.`
    : `Tarcza oświetlona w ${illumination}%, ale Księżyc nie wschodzi nad horyzont w oknie nocy — niebo pozostaje ciemne.`;
}

/** Nowie i pełnie w zadanym oknie. Skan co godzinę, potem bisekcja do minuty. */
function moonPhaseEvents(from: Date, to: Date, coords: Coords): AstroEvent[] {
  const events: AstroEvent[] = [];

  for (const { target, event, title } of MOON_PHASE_TARGETS) {
    let previous = new Date(from);
    let previousOffset = phaseOffset(previous, target);

    for (let t = from.getTime() + HOUR_MS; t <= to.getTime(); t += HOUR_MS) {
      const current = new Date(t);
      const offset = phaseOffset(current, target);

      if (previousOffset < 0 && offset >= 0) {
        const at = refinePhaseCrossing(previous, current, target);
        events.push({
          id: `moon-${event}-${at.toISOString().slice(0, 10)}`,
          cat: 'moon',
          type: 'moon_phase',
          at,
          title,
          desc: moonPhaseDescription(event, at, coords),
          // Nów to brak Księżyca na niebie — „widoczny" znaczy tu: sprzyja obserwacjom.
          visible: event === 'new' ? true : moonUpAtNight(nightWindow(at, coords), coords),
        });
      }

      previous = current;
      previousOffset = offset;
    }
  }

  return events;
}

function meteorDescription(
  shower: MeteorShower,
  altitude: number,
  moonIllumination: number,
): string {
  const radiant =
    altitude >= MIN_RADIANT_ALTITUDE
      ? `Radiant w gwiazdozbiorze ${shower.constellation} wznosi się na ${Math.round(altitude)}° nad horyzont`
      : `Radiant w gwiazdozbiorze ${shower.constellation} ledwie wystaje ponad horyzont (${Math.round(altitude)}°)`;

  const moon =
    moonIllumination > 60
      ? `, ale Księżyc oświetlony w ${moonIllumination}% zabierze słabsze zjawiska`
      : moonIllumination < 25
        ? ', a ciemny Księżyc nie będzie przeszkadzał'
        : '';

  return `Maksimum roju, ZHR do ${shower.zhr}. ${radiant}${moon}.`;
}

/** Maksima rojów wypadające w zadanym oknie, z godziną najwyższego położenia radiantu. */
function meteorShowerEvents(from: Date, to: Date, coords: Coords): AstroEvent[] {
  const events: AstroEvent[] = [];
  const years = [from.getFullYear(), to.getFullYear()];

  for (const year of [...new Set(years)]) {
    for (const shower of METEOR_SHOWERS) {
      const peakDay = new Date(year, shower.peakMonth - 1, shower.peakDay);
      const window = nightWindow(peakDay, coords);
      const best = bestRadiantMoment(shower, window, coords);

      if (best.at < from || best.at > to) continue;

      const moonIllumination = Math.round(SunCalc.getMoonIllumination(best.at).fraction * 100);

      events.push({
        id: `meteor-${shower.id}-${year}`,
        cat: 'meteor',
        type: 'meteor_shower',
        at: best.at,
        title: shower.name,
        desc: meteorDescription(shower, best.altitude, moonIllumination),
        visible: best.altitude >= MIN_RADIANT_ALTITUDE,
      });
    }
  }

  return events;
}

/**
 * Generatory planetarne opierają się na iteracyjnym wyszukiwaniu w efemerydach,
 * które dla skrajnych szerokości geograficznych potrafi zgłosić brak rozwiązania.
 * Pojedynczy taki przypadek ma kosztować jedną kategorię eventów, a nie cały ekran.
 */
function safely(generate: () => AstroEvent[]): AstroEvent[] {
  try {
    return generate();
  } catch {
    return [];
  }
}

/** Wszystkie eventy od `from` przez `days` dni, posortowane chronologicznie. */
export function upcomingEvents(
  from: Date,
  coords: Coords,
  days: number = EVENT_HORIZON_DAYS,
): AstroEvent[] {
  const to = new Date(from.getTime() + days * DAY_MS);

  return [
    ...moonPhaseEvents(from, to, coords),
    ...meteorShowerEvents(from, to, coords),
    ...safely(() => conjunctionEvents(from, to, coords)),
    ...safely(() => oppositionEvents(from, to, coords)),
    ...safely(() => eclipseEvents(from, to, coords)),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}
