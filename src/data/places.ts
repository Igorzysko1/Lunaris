import { distanceKm } from '../lib/astro.ts';
import { CITIES, GMINY } from './places.generated.ts';

export { CITIES, GMINY };

export type Place = {
  /**
   * Klucz stabilny między buildami. Nazwa NIE wystarcza: „Andrychów" to
   * jednocześnie miasto i gmina w tym samym województwie, a „Bolesławiec"
   * występuje w kraju pięć razy.
   */
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  /** Skala Bortle'a: 1 (niebo pierwotnie ciemne) – 9 (centrum wielkiego miasta). */
  bortle: number;
};

export type Coords = { lat: number; lon: number };

/**
 * Pozycja używana, **gdy GPS jest niedostępny** (brak zgody, wyłączona lokalizacja).
 * Prawdziwą pozycję czyta expo-location — patrz src/lib/use-device-location.ts.
 */
export const FALLBACK_POSITION: Coords = { lat: 50.259, lon: 19.021 };

const ALL_PLACES: Place[] = [...CITIES, ...GMINY];

export function findPlaceById(id: string): Place | undefined {
  return ALL_PLACES.find((p) => p.id === id);
}

/**
 * Najbliższa znana miejscowość dla dowolnego punktu.
 * Potrzebna, bo GPS może wskazać dowolne miejsce, a Bortle mamy tylko dla
 * miejscowości z listy.
 */
export function nearestPlace(coords: Coords): Place {
  return ALL_PLACES.reduce((best, place) =>
    distanceKm(coords, place) < distanceKm(coords, best) ? place : best,
  );
}
