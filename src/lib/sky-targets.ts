/**
 * Co da się obejrzeć danej nocy: planety i obiekty głębokiego nieba, każde
 * z godziną górowania, najwyższym położeniem w oknie nocy oraz wschodem i zachodem.
 *
 * Planety i DSO idą jedną ścieżką: obiekty katalogowe rejestrujemy w Astronomy
 * Engine przez `DefineStar` i dalej pytamy o nie tak samo jak o planety. Dzięki temu
 * refrakcja, precesja i szukanie wschodu są liczone w jeden sposób, a nie dwoma
 * równoległymi kawałkami matematyki.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import {
  Body,
  DefineStar,
  Equator,
  Horizon,
  Illumination,
  Observer,
  SearchHourAngle,
} from 'astronomy-engine';

import { DEEP_SKY_OBJECTS, type DeepSkyObject } from '../data/deep-sky.ts';
import type { Coords } from '../data/places.ts';
import { sampleNight, type NightWindow } from './night-window.ts';
import {
  limitingMagnitude,
  minimumAngularSize,
  profileLabel,
  surfaceBrightness,
  surfaceBrightnessLimit,
  type Optics,
  type OpticsProfile,
} from './optics.ts';

/**
 * Poniżej tej wysokości obserwacja lornetkowa traci sens: ekstynkcja atmosferyczna
 * zjada obiekty mgławicowe, a nisko nad horyzontem prawie zawsze stoi las, dom
 * albo łuna miasta.
 */
const USEFUL_ALTITUDE = 15;

/**
 * Planety brane pod uwagę. Które z nich trafią na listę, rozstrzyga graniczna
 * jasność policzona ze sprzętu — Uran i Neptun wchodzą same, gdy apertura
 * i niebo na to pozwalają.
 */
const PLANETS: { body: Body; name: string }[] = [
  { body: Body.Mercury, name: 'Merkury' },
  { body: Body.Venus, name: 'Wenus' },
  { body: Body.Mars, name: 'Mars' },
  { body: Body.Jupiter, name: 'Jowisz' },
  { body: Body.Saturn, name: 'Saturn' },
  { body: Body.Uranus, name: 'Uran' },
  { body: Body.Neptune, name: 'Neptun' },
];

/**
 * Slot na obiekt katalogowy. Astronomy Engine daje osiem gwiazd użytkownika, ale
 * wystarczy jedna: definicja jest globalna, a rachunek dla obiektu kończy się,
 * zanim slot dostanie kolejny wpis. Dzięki temu długość katalogu nie jest niczym
 * ograniczona — przy slocie na obiekt szósta pozycja w DEEP_SKY_OBJECTS zaczęłaby
 * sięgać poza tablicę.
 */
const STAR_SLOT: Body = Body.Star1;

export type SkyTarget = {
  id: string;
  name: string;
  /** Krótki opis pod nazwą: typ obiektu i jasność. */
  detail: string;
  kind: 'planet' | 'dso';
  /** Górowanie — najwyższe położenie w ogóle, niezależnie od pory doby. */
  transitAt: Date;
  transitAltitude: number;
  /** Najwyższe położenie w samym oknie nocy i moment, w którym wypada. */
  bestAt: Date;
  maxAltitude: number;
  /** Jasność obiektu w magnitudo — dla planet liczona na moment okna. */
  magnitude: number;
  /**
   * Czy obiekt jest tej nocy w zasięgu: dość wysoko nad horyzontem i w granicach
   * tego, co pokazuje posiadany sprzęt pod tym niebem.
   */
  visible: boolean;
  /** Powód, dla którego obiekt odpada — `null`, gdy jest w zasięgu. */
  outOfReach: 'too-low' | 'too-faint' | 'too-diffuse' | 'too-small' | null;
  /** Zestaw sprzętu, z którego zasięgu wynika ten wpis. */
  profileId: string;
  profileLabel: string;
};

/**
 * Jak oceniać zasięg dla danego typu obiektu.
 *
 * Gromady otwarte to zbiory osobnych gwiazd — widać je wtedy, gdy sprzęt pokazuje
 * pojedyncze składniki, więc liczy się zwykła jasność graniczna. Galaktyki,
 * mgławice i nierozdzielone gromady kuliste są plamami światła i rządzi nimi
 * kontrast z tłem nieba, czyli jasność powierzchniowa.
 */
const DIFFUSE_KINDS: DeepSkyObject['kind'][] = ['galaktyka', 'mgławica', 'gromada kulista'];

/** Zasięg sprzętu pod danym niebem — ten sam dla wszystkich obiektów tej nocy. */
type Reach = { limitPoint: number; limitSurface: number; minSize: number };

/**
 * Położenie obiektu tej nocy. Nie zależy od sprzętu, więc liczymy je raz i
 * współdzielimy między zestawami — inaczej koszt rósłby liniowo z ich liczbą,
 * a efemerydy są tu najdroższą częścią rachunku.
 */
export type TargetGeometry = {
  base: TargetBase;
  transitAt: Date;
  transitAltitude: number;
  bestAt: Date;
  maxAltitude: number;
};

type TargetBase = {
  id: string;
  name: string;
  detail: string;
  kind: 'planet' | 'dso';
  magnitude: number;
  /** Rozmiar kątowy w minutach; planety traktujemy jak punkty. */
  sizeArcmin: number | null;
  /** Czy obiekt jest plamą światła (ocena po jasności powierzchniowej). */
  diffuse: boolean;
};

const observerOf = (coords: Coords) => new Observer(coords.lat, coords.lon, 0);

function altitudeOf(body: Body, at: Date, observer: Observer): number {
  const equator = Equator(body, at, observer, true, true);
  return Horizon(at, observer, equator.ra, equator.dec, 'normal').altitude;
}

/** Najwyższe położenie obiektu w oknie nocy i moment, w którym wypada. */
function bestInWindow(
  body: Body,
  window: NightWindow,
  observer: Observer,
): { at: Date; altitude: number } {
  let best = { at: window.from, altitude: -90 };

  for (const sample of sampleNight(window)) {
    const altitude = altitudeOf(body, sample, observer);
    if (altitude > best.altitude) best = { at: sample, altitude };
  }

  return best;
}

/** Położenie obiektu tej nocy — część rachunku niezależna od sprzętu. */
function geometryOf(
  body: Body,
  base: TargetBase,
  window: NightWindow,
  observer: Observer,
): TargetGeometry {
  const best = bestInWindow(body, window, observer);
  const transit = SearchHourAngle(body, observer, 0, window.from);

  return {
    base,
    transitAt: transit.time.date,
    transitAltitude: transit.hor.altitude,
    bestAt: best.at,
    maxAltitude: best.altitude,
  };
}

function dsoGeometry(
  dso: DeepSkyObject,
  window: NightWindow,
  observer: Observer,
): TargetGeometry {
  DefineStar(STAR_SLOT, dso.raHours, dso.dec, dso.distanceLy);

  return geometryOf(
    STAR_SLOT,
    {
      id: dso.id,
      name: `${dso.designation} — ${dso.name}`,
      detail: `${dso.kind}, ${dso.magnitude.toFixed(1)} mag`,
      kind: 'dso',
      magnitude: dso.magnitude,
      sizeArcmin: dso.sizeArcmin,
      diffuse: DIFFUSE_KINDS.includes(dso.kind),
    },
    window,
    observer,
  );
}

/**
 * Położenie wszystkich celów tej nocy, bez oglądania się na sprzęt.
 *
 * To najdroższa część rachunku — efemerydy — i jedyna, która nie zależy od
 * zestawu, więc przy wielu zestawach liczy się raz i jest współdzielona.
 */
export function nightGeometry(window: NightWindow, coords: Coords): TargetGeometry[] {
  const observer = observerOf(coords);

  const planets = PLANETS.map(({ body, name }) => {
    const magnitude = Illumination(body, window.from).mag;
    return geometryOf(
      body,
      {
        id: `planet-${body}`,
        name,
        detail: `planeta, ${magnitude.toFixed(1)} mag`,
        kind: 'planet',
        magnitude,
        sizeArcmin: null,
        diffuse: false,
      },
      window,
      observer,
    );
  });

  const deepSky = DEEP_SKY_OBJECTS.map((dso) => dsoGeometry(dso, window, observer));

  return [...planets, ...deepSky];
}

/**
 * Zasięg zestawu pod danym niebem. Liczony raz na zestaw: jest ten sam dla
 * wszystkich obiektów tej nocy, a logarytm z apertury nie ma po co wykonywać się
 * dziesięć razy.
 */
function reachOf(optics: Optics, bortle: number): Reach {
  return {
    limitPoint: limitingMagnitude(optics, bortle),
    limitSurface: surfaceBrightnessLimit(optics, bortle),
    minSize: minimumAngularSize(optics),
  };
}

/** Nakłada zasięg konkretnego zestawu na policzone już położenie obiektu. */
function applyReach(
  geometry: TargetGeometry,
  reach: Reach,
  profile: { id: string; label: string },
): SkyTarget {
  const { base } = geometry;

  // Kolejność ma znaczenie: najpierw to, co zmienia się z nocy na noc, potem
  // ograniczenia sprzętu, które są tej nocy stałe.
  const outOfReach = (() => {
    if (geometry.maxAltitude < USEFUL_ALTITUDE) return 'too-low' as const;

    if (base.diffuse && base.sizeArcmin !== null) {
      if (surfaceBrightness(base.magnitude, base.sizeArcmin) > reach.limitSurface) {
        return 'too-diffuse' as const;
      }
    } else if (base.magnitude > reach.limitPoint) {
      return 'too-faint' as const;
    }

    if (base.sizeArcmin !== null && base.sizeArcmin < reach.minSize) return 'too-small' as const;
    return null;
  })();

  return {
    ...base,
    transitAt: geometry.transitAt,
    transitAltitude: geometry.transitAltitude,
    bestAt: geometry.bestAt,
    maxAltitude: geometry.maxAltitude,
    visible: outOfReach === null,
    outOfReach,
    profileId: profile.id,
    profileLabel: profile.label,
  };
}

/**
 * Cele na daną noc dla jednego zestawu i nieba, od najwyżej położonego.
 * Gotową geometrię można podać z zewnątrz, gdy liczy się cele dla wielu zestawów.
 */
export function nightTargets(
  window: NightWindow,
  coords: Coords,
  optics: Optics,
  bortle: number,
  geometry: TargetGeometry[] = nightGeometry(window, coords),
): SkyTarget[] {
  const reach = reachOf(optics, bortle);

  return geometry
    .map((g) => applyReach(g, reach, { id: 'single', label: '' }))
    .sort((a, b) => b.maxAltitude - a.maxAltitude);
}

/**
 * Cele dla każdego zestawu sprzętu naraz.
 *
 * Ten sam obiekt widoczny przez dwa zestawy pojawia się dwa razy, z różnym
 * podpisem — to nie duplikat do odfiltrowania, tylko dwie różne odpowiedzi na
 * pytanie „czym to obejrzę".
 */
export function nightTargetsForProfiles(
  window: NightWindow,
  coords: Coords,
  profiles: OpticsProfile[],
  bortle: number,
): SkyTarget[] {
  const geometry = nightGeometry(window, coords);

  return profiles
    .flatMap((profile) => {
      const reach = reachOf(profile.optics, bortle);
      const label = profileLabel(profile);
      return geometry.map((g) => applyReach(g, reach, { id: profile.id, label }));
    })
    .sort((a, b) => b.maxAltitude - a.maxAltitude);
}
