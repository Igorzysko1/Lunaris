/**
 * Biblioteki celów i gwiazdozbiorów — „czym i kiedykolwiek", w odróżnieniu od
 * Nieba, które odpowiada „czy dziś i o której".
 *
 * Gwiazdozbiór obiektu wynika z granic IAU (`Constellation` z Astronomy Engine),
 * a nie z pola wpisanego do katalogu: sto obiektów wpisanych ręcznie to sto
 * okazji do pomyłki, a granice są jedne. Najlepszy miesiąc i wysokość
 * w górowaniu liczą się z efemeryd, tak jak cała reszta nieba w aplikacji.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import {
  Body,
  Constellation as constellationAt,
  Equator,
  Observer,
  SiderealTime,
} from 'astronomy-engine';

import type { FigureStar } from '../data/constellation-figures.ts';
import { CONSTELLATIONS, type Constellation } from '../data/constellations.ts';
import { DEEP_SKY_OBJECTS, type DeepSkyObject } from '../data/deep-sky.ts';
import type { Coords } from '../data/places.ts';
import {
  MARGINAL_MAG,
  limitingMagnitude,
  minimumAngularSize,
  surfaceBrightnessLimit,
  type Optics,
} from './optics.ts';

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;
const decimal = (value: number) => value.toFixed(1).replace('.', ',');

// prettier-ignore
const MONTHS = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
];

/** Szukanie bez ogonków: „labedz" ma znaleźć Łabędzia, „bootes" Wolarza. */
export function foldForSearch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
}

/**
 * Gwiazdozbiór, w którego granicach leży punkt — z tych, które katalog zna.
 * `null` dla gwiazdozbiorów spoza wyboru widocznego z Polski.
 */
export function constellationOf(point: { raHours: number; dec: number }): Constellation | null {
  const symbol = constellationAt(point.raHours, point.dec).symbol.toLowerCase();
  return CONSTELLATIONS.find((c) => c.id === symbol) ?? null;
}

/** Obiekty katalogu leżące w granicach gwiazdozbioru, od najjaśniejszego. */
export function objectsInConstellation(id: string): DeepSkyObject[] {
  return DEEP_SKY_OBJECTS.filter((o) => constellationOf(o)?.id === id).sort(
    (a, b) => a.magnitude - b.magnitude,
  );
}

/**
 * Podpis gwiazdy rysunku.
 *
 * Nazwę własną ma mniej niż dwie trzecie z nich i nie jest to brak w danych:
 * większość gwiazd nigdy takiej nie dostała. W atlasach występują jako litera
 * Bayera z dopełniaczem gwiazdozbioru — „η Ursae Minoris" — i to **jest** ich
 * nazwa. Dlatego podpis zawsze coś mówi, zamiast tłumaczyć się z pustego pola.
 */
export function starLabel(star: FigureStar, genitive: string): string {
  return star[3] ?? `${star[2]} ${genitive}`;
}

export type LibraryReach = 'too-faint' | 'too-diffuse' | 'too-small' | null;

/** „Czy to zobaczysz" — powód przy zestawie, z liczbą, od której zależy. */
export function describeLibraryReach(reach: LibraryReach, optics: Optics, bortle: number): string {
  switch (reach) {
    case null:
      return `w zasięgu — ten zestaw sięga ${decimal(limitingMagnitude(optics, bortle))} mag`;
    case 'too-faint':
      return `za słaby — ten zestaw sięga ${decimal(limitingMagnitude(optics, bortle))} mag`;
    case 'too-diffuse':
      return `za blady na tle nieba Bortle ${bortle} — granica ${decimal(surfaceBrightnessLimit(optics, bortle))} mag/arcsec²`;
    case 'too-small':
      return `za mały przy powiększeniu ${optics.magnification}× (od ${decimal(minimumAngularSize(optics))}′)`;
  }
}

/**
 * Powód dla celu „na styk". Nie mówimy, która granica wiąże — dla punktowych
 * jasność całkowita, dla rozmytych powierzchniowa — bo to zależy od obiektu,
 * a zdanie ma nieść jedno: zapasu nie ma i byle mgiełka go zabierze.
 */
export function describeMarginalReach(optics: Optics, bortle: number): string {
  return `w zasięgu na styk — mniej niż ${decimal(MARGINAL_MAG)} mag zapasu do granicy ${decimal(limitingMagnitude(optics, bortle))} mag`;
}

/**
 * Miesiąc, w którym obiekt góruje około północy — wtedy stoi najwyżej
 * w najciemniejszej części nocy. To dzień, w którym Słońce ma rektascensję
 * przesuniętą o 12 h względem obiektu, szukany po dniach roku.
 */
export function bestMonth(raHours: number, year: number): number {
  const target = (raHours + 12) % 24;
  const observer = new Observer(0, 0, 0);
  let best = { month: 0, gap: Infinity };

  for (let day = 0; day < 366; day++) {
    const date = new Date(year, 0, 1 + day, 12);
    const sun = Equator(Body.Sun, date, observer, false, false).ra;
    const raw = Math.abs(sun - target);
    const gap = Math.min(raw, 24 - raw);
    if (gap < best.gap) best = { month: date.getMonth(), gap };
  }

  return best.month;
}

export function describeBestMonth(month: number): string {
  return `Najlepszy miesiąc: ${MONTHS[month]} — wtedy góruje około północy.`;
}

/** Wysokość w górowaniu dla szerokości geograficznej; ujemna, gdy obiekt tu nie wschodzi. */
export function culminationAltitude(dec: number, lat: number): number {
  return 90 - Math.abs(lat - dec);
}

export function describeCulmination(altitude: number, place: string): string {
  return altitude > 0
    ? `W górowaniu ${Math.round(altitude)}° nad horyzontem — liczone dla: ${place}.`
    : `Stąd nie wschodzi nad horyzont — liczone dla: ${place}.`;
}

/** Jaką część średnicy pola widzenia zajmuje obiekt; 1 i więcej — nie mieści się. */
export function fieldShare(sizeArcmin: number, fieldOfViewDeg: number): number {
  return sizeArcmin / 60 / fieldOfViewDeg;
}

export function describeFieldShare(share: number, fieldOfViewDeg: number, profile: string): string {
  const field = `${decimal(fieldOfViewDeg)}°`;
  return share >= 1
    ? `Nie mieści się w polu ${field} (${profile}).`
    : `${Math.max(1, Math.round(share * 100))}% średnicy pola ${field} (${profile}).`;
}

/**
 * Położenie punktu nieba dla miejsca i chwili: wysokość i kąt paralaktyczny —
 * o tyle kierunek na biegun obraca się względem pionu. Rysunek z mapy nieba
 * obrócony o ten kąt stoi tak, jak widać go nad horyzontem.
 */
export function skyOrientation(
  point: { raHours: number; dec: number },
  coords: Coords,
  at: Date,
): { altitude: number; rotation: number } {
  const lst = SiderealTime(at) + coords.lon / 15;
  const hourAngle = toRad((((lst - point.raHours) * 15 + 540) % 360) - 180);
  const lat = toRad(coords.lat);
  const dec = toRad(point.dec);

  const altitude = toDeg(
    Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle)),
  );
  const rotation = toDeg(
    Math.atan2(
      Math.sin(hourAngle),
      Math.tan(lat) * Math.cos(dec) - Math.sin(dec) * Math.cos(hourAngle),
    ),
  );

  return { altitude, rotation };
}
