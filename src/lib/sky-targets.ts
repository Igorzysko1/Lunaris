/**
 * Co da się obejrzeć danej nocy: planety i obiekty głębokiego nieba, każde
 * z godziną górowania, najwyższym położeniem w oknie nocy oraz odcinkiem nocy,
 * w którym obiekt stoi ponad horyzontem tego miejsca.
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
import { DEFAULT_HORIZON, compassLabel, type HorizonPoint } from './horizon.ts';
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
 * Wysokość horyzontu dla danego azymutu — przeszkoda terenowa albo próg zapasowy.
 * Wstrzykiwana, bo zależy od miejsca, a nie od nieba: ten sam obiekt widać
 * z pustyni i nie widać zza ściany lasu.
 */
export type SiteHorizon = (azimuth: number) => HorizonPoint;

/** Gdy miejsce nie ma maski, obowiązuje jeden próg dla całego nieba. */
const FLAT_HORIZON: SiteHorizon = () => ({ altitude: DEFAULT_HORIZON, fromTerrain: false });

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

/**
 * Odcinek nocy, w którym obiekt stoi ponad horyzontem **tego miejsca** — czyli
 * ponad maską terenu, a nie ponad matematycznym horyzontem.
 *
 * To rozróżnienie jest całym sensem tego pola. Wschód geometryczny Oriona
 * o 21:14 jest prawdziwy i bezużyteczny, jeśli w tym azymucie stoi ściana lasu
 * do 18° — realnie obiekt wychodzi zza niej godzinę później. Maska zna wysokość
 * przeszkody dla każdego azymutu, więc odcinek liczymy względem niej.
 *
 * `rises` i `sets` odróżniają faktyczne przejście przez horyzont od obcięcia
 * krawędzią nocy: bez nich „od 18:00" znaczyłoby raz „wtedy wzeszedł", a raz
 * „wtedy zrobiło się ciemno", a to dwie różne informacje dla planującego.
 */
export type UpSpan = {
  from: Date;
  to: Date;
  /** `from` to przejście ponad horyzont, a nie początek okna nocy. */
  rises: boolean;
  /** `to` to zejście za horyzont, a nie koniec okna nocy. */
  sets: boolean;
};

/**
 * Nazwa obiektu po samym identyfikatorze.
 *
 * Potrzebna wszędzie tam, gdzie zapis przeżył sesję i został sam klucz: dziennik
 * pamięta `m57`, a nie „M57 — Mgławica Pierścień". Mieszka tutaj, bo to ten
 * moduł identyfikatory nadaje — trzymanie odwrotnego przekształcenia gdzie
 * indziej znaczyłoby, że przy zmianie kształtu klucza psuje się coś w drugim
 * pliku i nikt tego nie łączy.
 *
 * Nieznany identyfikator wraca bez zmian. Katalog rośnie i bywa przycinany,
 * a zapis sprzed roku ma się nadal czytać — choćby surowo.
 */
export function targetLabel(id: string): string {
  const planet = PLANETS.find((p) => `planet-${p.body}` === id);
  if (planet) return planet.name;

  const dso = DEEP_SKY_OBJECTS.find((o) => o.id === id);
  return dso ? `${dso.designation} — ${dso.name}` : id;
}

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
  /** Azymut w tym właśnie momencie — po nim sprawdzamy przeszkodę terenową. */
  bestAzimuth: number;
  /**
   * Od kiedy do kiedy tej nocy obiekt jest ponad horyzontem miejsca.
   * `null`, gdy nie wychodzi ponad niego ani na chwilę.
   */
  up: UpSpan | null;
  /** Jasność obiektu w magnitudo — dla planet liczona na moment okna. */
  magnitude: number;
  /**
   * Czy obiekt jest tej nocy w zasięgu: dość wysoko nad horyzontem i w granicach
   * tego, co pokazuje posiadany sprzęt pod tym niebem.
   */
  visible: boolean;
  /**
   * Powód, dla którego obiekt odpada — `null`, gdy jest w zasięgu.
   * `behind-horizon` znaczy co innego niż `too-low`: obiekt jest dość wysoko,
   * ale w tym kierunku stoi teren.
   */
  outOfReach: 'too-low' | 'behind-horizon' | 'too-faint' | 'too-diffuse' | 'too-small' | null;
  /** Wypełnione dla `behind-horizon`: wysokość przeszkody w tym kierunku. */
  horizonAltitude: number | null;
  /**
   * Zapas w magnitudo do granicy zasięgu sprzętu: ile zostało, zanim obiekt
   * zniknie. Diagnostyczny, nie prezentacyjny.
   *
   * **Nie nadaje się na miarę trudności** i to nie jest wada rachunku, tylko
   * braku danych. Jasność powierzchniowa liczona jest ze średniej po całej
   * powierzchni, więc M31 — rozlana na trzy stopnie, ale z jasnym jądrem —
   * wypada w nim tak samo słabo jak dowolna galaktyka w Pannie. Odróżnienie
   * jednej od drugiej wymaga pola, którego katalog nie ma: koncentracji światła
   * albo gotowej klasyfikacji lornetkowej z publikowanej listy.
   */
  margin: number;
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
  bestAzimuth: number;
  up: UpSpan | null;
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

function positionOf(
  body: Body,
  at: Date,
  observer: Observer,
): { altitude: number; azimuth: number } {
  const equator = Equator(body, at, observer, true, true);
  const horizon = Horizon(at, observer, equator.ra, equator.dec, 'normal');
  return { altitude: horizon.altitude, azimuth: horizon.azimuth };
}

/**
 * Do jakiej dokładności zawężamy moment przejścia przez horyzont. Minuta, bo
 * dalej rachunek przestaje odpowiadać rzeczywistości: maska terenu ma jedną
 * wartość na stopień azymutu, a las nie rośnie z dokładnością do sekundy.
 */
const CROSSING_PRECISION_MS = 60_000;

/** Czy obiekt stoi w tym momencie ponad horyzontem miejsca. */
function clearsHorizon(body: Body, at: Date, observer: Observer, horizon: SiteHorizon): boolean {
  const { altitude, azimuth } = positionOf(body, at, observer);
  return altitude >= horizon(azimuth).altitude;
}

/**
 * Moment przejścia przez horyzont między dwiema próbkami, zawężony bisekcją.
 *
 * Same próbki są co kwadrans, a to za mało na godzinę wschodu: obiekt nisko nad
 * horyzontem wznosi się o kilka stopni na kwadrans, więc błąd wypadałby większy
 * niż różnica między czystym polem a linią lasu.
 *
 * Zwracany moment leży zawsze po stronie `above`, czyli **wewnątrz** odcinka
 * widoczności. Wolimy powiedzieć „od 21:15" o obiekcie widocznym od 21:14 niż
 * odwrotnie — obietnica ma być spełniona, a nie napięta.
 */
function crossingBetween(
  body: Body,
  below: Date,
  above: Date,
  observer: Observer,
  horizon: SiteHorizon,
): Date {
  let lo = below.getTime();
  let hi = above.getTime();

  while (Math.abs(hi - lo) > CROSSING_PRECISION_MS) {
    const mid = (lo + hi) / 2;
    if (clearsHorizon(body, new Date(mid), observer, horizon)) hi = mid;
    else lo = mid;
  }

  return new Date(hi);
}

/**
 * Przebieg obiektu przez noc: najwyższe położenie oraz odcinek ponad horyzontem.
 *
 * Jedno przejście po próbkach na oba pytania, bo efemerydy są tu najdroższe —
 * osobna pętla na wschód podwoiłaby koszt listy celów bez żadnego zysku.
 *
 * Azymut maksimum bierzemy z tej samej próbki co wysokość: przeszkodę
 * sprawdzamy w tym kierunku, w którym obiekt stoi najwyżej, bo to jego
 * najlepsza szansa.
 *
 * Odcinek liczymy jako pierwszą i ostatnią próbkę ponad horyzontem, a nie jako
 * ciąg odcinków. Obiekt schowany w środku nocy za pojedynczym wcięciem maski
 * wypadnie więc widoczny przez cały czas — świadome uproszczenie: takie wcięcie
 * trwa kwadranse, a lista celów przed wyjazdem ma odpowiadać na pytanie „kiedy
 * w ogóle patrzeć", nie prowadzić za rękę co pół godziny.
 */
function scanNight(
  body: Body,
  window: NightWindow,
  observer: Observer,
  horizon: SiteHorizon,
): { best: { at: Date; altitude: number; azimuth: number }; up: UpSpan | null } {
  const samples = sampleNight(window).map((at) => {
    const { altitude, azimuth } = positionOf(body, at, observer);
    return { at, altitude, azimuth, up: altitude >= horizon(azimuth).altitude };
  });

  let best = { at: window.from, altitude: -90, azimuth: 0 };
  for (const sample of samples) {
    if (sample.altitude > best.altitude) {
      best = { at: sample.at, altitude: sample.altitude, azimuth: sample.azimuth };
    }
  }

  const first = samples.findIndex((sample) => sample.up);
  if (first === -1) return { best, up: null };

  let last = samples.length - 1;
  while (!samples[last].up) last--;

  // Krawędź okna to nie wschód: obiekt widoczny od pierwszej próbki był już nad
  // horyzontem, zanim zrobiło się ciemno.
  const rises = first > 0;
  const sets = last < samples.length - 1;

  return {
    best,
    up: {
      from: rises
        ? crossingBetween(body, samples[first - 1].at, samples[first].at, observer, horizon)
        : window.from,
      to: sets
        ? crossingBetween(body, samples[last + 1].at, samples[last].at, observer, horizon)
        : window.to,
      rises,
      sets,
    },
  };
}

/**
 * Położenie obiektu tej nocy — część rachunku niezależna od sprzętu.
 *
 * Maska horyzontu wchodzi tutaj, a nie do warstwy sprzętowej, bo należy do
 * miejsca: ten sam las zasłania obiekt lornetce i teleskopowi tak samo. Dzięki
 * temu przy dwóch zestawach odcinek widoczności liczy się raz.
 */
function geometryOf(
  body: Body,
  base: TargetBase,
  window: NightWindow,
  observer: Observer,
  horizon: SiteHorizon,
): TargetGeometry {
  const { best, up } = scanNight(body, window, observer, horizon);
  const transit = SearchHourAngle(body, observer, 0, window.from);

  return {
    base,
    transitAt: transit.time.date,
    transitAltitude: transit.hor.altitude,
    bestAt: best.at,
    maxAltitude: best.altitude,
    bestAzimuth: best.azimuth,
    up,
  };
}

function dsoGeometry(
  dso: DeepSkyObject,
  window: NightWindow,
  observer: Observer,
  horizon: SiteHorizon,
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
    horizon,
  );
}

/**
 * Położenie wszystkich celów tej nocy, bez oglądania się na sprzęt.
 *
 * To najdroższa część rachunku — efemerydy — i jedyna, która nie zależy od
 * zestawu, więc przy wielu zestawach liczy się raz i jest współdzielona.
 */
function nightGeometry(
  window: NightWindow,
  coords: Coords,
  horizon: SiteHorizon,
): TargetGeometry[] {
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
      horizon,
    );
  });

  const deepSky = DEEP_SKY_OBJECTS.map((dso) => dsoGeometry(dso, window, observer, horizon));

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
  horizon: SiteHorizon,
): SkyTarget {
  const { base } = geometry;

  // Przeszkoda w tym kierunku, w którym obiekt stoi najwyżej.
  const skyline = horizon(geometry.bestAzimuth);

  // Kolejność ma znaczenie: najpierw to, co zmienia się z nocy na noc, potem
  // ograniczenia sprzętu, które są tej nocy stałe.
  const outOfReach = (() => {
    // Jeden warunek zamiast dwóch: maska rządzi tam, gdzie jest, a próg zapasowy
    // tam, gdzie jej nie ma. Różni je tylko to, jak nazywamy powód.
    //
    // Pytamy o odcinek widoczności, a nie o samą wysokość maksimum, bo maska ma
    // inną wartość dla każdego azymutu: obiekt mógł minąć próg gdzie indziej niż
    // w punkcie górowania. Brak odcinka znaczy „ani przez chwilę tej nocy".
    if (!geometry.up) {
      return skyline.fromTerrain ? ('behind-horizon' as const) : ('too-low' as const);
    }

    // Jasność całkowita obowiązuje KAŻDY obiekt, także rozmyty. Wcześniej
    // sprawdzana była tylko dla punktowych, więc obiekt 11 mag przechodził, o ile
    // tylko jego światło rozkładało się korzystnie — a światła od rozlania na
    // większą powierzchnię nie przybywa. Przez tę lukę do listy wchodziły
    // galaktyki bez żadnych szans w lornetce.
    if (base.magnitude > reach.limitPoint) return 'too-faint' as const;

    if (base.diffuse && base.sizeArcmin !== null) {
      if (surfaceBrightness(base.magnitude, base.sizeArcmin) > reach.limitSurface) {
        return 'too-diffuse' as const;
      }
    }

    if (base.sizeArcmin !== null && base.sizeArcmin < reach.minSize) return 'too-small' as const;
    return null;
  })();

  // Zapas liczymy z tego progu, który dla tego obiektu jest ciaśniejszy.
  const pointMargin = reach.limitPoint - base.magnitude;
  const surfaceMargin =
    base.diffuse && base.sizeArcmin !== null
      ? reach.limitSurface - surfaceBrightness(base.magnitude, base.sizeArcmin)
      : Infinity;
  const margin = Math.min(pointMargin, surfaceMargin);

  return {
    ...base,
    transitAt: geometry.transitAt,
    transitAltitude: geometry.transitAltitude,
    bestAt: geometry.bestAt,
    maxAltitude: geometry.maxAltitude,
    bestAzimuth: geometry.bestAzimuth,
    up: geometry.up,
    visible: outOfReach === null,
    outOfReach,
    horizonAltitude: outOfReach === 'behind-horizon' ? skyline.altitude : null,
    margin,
    profileId: profile.id,
    profileLabel: profile.label,
  };
}

/**
 * Cele uporządkowane tak, jak warto je pokazać, i przycięte do `limit`.
 *
 * Sto obiektów w katalogu znaczy kilkadziesiąt widocznych każdej nocy, a lista
 * na siedemdziesiąt pozycji przestaje być listą — nikt nie przeczyta jej przed
 * wyjazdem. Kolejność jest po jasności całkowitej, bo to jedyne kryterium
 * „efektowności", które da się obronić na danych, jakie katalog ma: M42 i M31
 * wychodzą na górę, obiekty na granicy zasięgu na dół. Wysokość nad horyzontem
 * jest tu rozstrzygnięciem remisów, a nie głównym porządkiem — obiekt jasny
 * nisko jest wart więcej niż słaby w zenicie.
 */
export function rankedTargets(targets: SkyTarget[], limit: number): SkyTarget[] {
  return targets
    .filter((t) => t.visible)
    .sort((a, b) => a.magnitude - b.magnitude || b.maxAltitude - a.maxAltitude)
    .slice(0, limit);
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
  horizon: SiteHorizon = FLAT_HORIZON,
): SkyTarget[] {
  const geometry = nightGeometry(window, coords, horizon);

  return profiles
    .flatMap((profile) => {
      const reach = reachOf(profile.optics, bortle);
      const label = profileLabel(profile);
      return geometry.map((g) => applyReach(g, reach, { id: profile.id, label }, horizon));
    })
    .sort((a, b) => b.maxAltitude - a.maxAltitude);
}

/** np. „za terenem na SW (214°), horyzont 18°" — powód inny niż „za nisko". */
export function describeOutOfReach(target: SkyTarget): string {
  switch (target.outOfReach) {
    case 'behind-horizon':
      return `za terenem na ${compassLabel(target.bestAzimuth)} (${Math.round(target.bestAzimuth)}°), horyzont ${Math.round(target.horizonAltitude ?? 0)}°`;
    case 'too-low':
      return 'za nisko nad horyzontem';
    case 'too-faint':
      return 'za słaby dla tego sprzętu';
    case 'too-diffuse':
      return 'za słaba jasność powierzchniowa';
    case 'too-small':
      return 'za mały przy tym powiększeniu';
    default:
      return '';
  }
}
