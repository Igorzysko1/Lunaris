/**
 * Katalog obiektów głębokiego nieba.
 *
 * Wpis opisuje sam obiekt — jasność i rozmiar kątowy — i nie zakłada niczego
 * o sprzęcie. To, czy dany obiekt da się zobaczyć, liczy filtr celów z parametrów
 * optyki i jakości nieba (patrz src/lib/optics.ts); dopisanie pozycji wymagającej
 * teleskopu nie psuje więc listy dla lornetki i odwrotnie.
 *
 * Współrzędne równikowe J2000.
 */
export type DeepSkyObject = {
  id: string;
  /** Oznaczenie katalogowe, np. „M31". */
  designation: string;
  name: string;
  kind: 'galaktyka' | 'mgławica' | 'gromada otwarta' | 'gromada kulista';
  /** Jasność wizualna w magnitudo. */
  magnitude: number;
  /** Rozmiar kątowy w minutach kątowych (dłuższa oś). */
  sizeArcmin: number;
  /** Rektascensja w godzinach (0–24) i deklinacja w stopniach, J2000. */
  raHours: number;
  dec: number;
  /** Odległość w latach świetlnych — potrzebna efemerydom do paralaksy. */
  distanceLy: number;
};

export const DEEP_SKY_OBJECTS: DeepSkyObject[] = [
  {
    id: 'm31',
    designation: 'M31',
    name: 'Galaktyka Andromedy',
    kind: 'galaktyka',
    magnitude: 3.4,
    sizeArcmin: 178,
    raHours: 0.712,
    dec: 41.269,
    distanceLy: 2_500_000,
  },
  {
    id: 'm42',
    designation: 'M42',
    name: 'Wielka Mgławica w Orionie',
    kind: 'mgławica',
    magnitude: 4.0,
    sizeArcmin: 85,
    raHours: 5.588,
    dec: -5.391,
    distanceLy: 1_344,
  },
  {
    id: 'm45',
    designation: 'M45',
    name: 'Plejady',
    kind: 'gromada otwarta',
    magnitude: 1.6,
    sizeArcmin: 110,
    raHours: 3.783,
    dec: 24.117,
    distanceLy: 444,
  },
  {
    id: 'hchi',
    designation: 'h+χ Persei',
    name: 'Podwójna Gromada w Perseuszu',
    kind: 'gromada otwarta',
    magnitude: 4.3,
    sizeArcmin: 60,
    raHours: 2.333,
    dec: 57.133,
    distanceLy: 7_500,
  },
  {
    id: 'm13',
    designation: 'M13',
    name: 'Gromada Herkulesa',
    kind: 'gromada kulista',
    magnitude: 5.8,
    sizeArcmin: 20,
    raHours: 16.695,
    dec: 36.462,
    distanceLy: 22_200,
  },
];
