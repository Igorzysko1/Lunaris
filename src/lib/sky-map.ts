/**
 * Jasność nieba dla konkretnego punktu, z mapy World Atlas.
 *
 * Dziś jasność nieba dla dowolnej pozycji dziedziczy się po najbliższej
 * skatalogowanej miejscowości — a miejscowość to z definicji zabudowa
 * i oświetlenie. Na środku Pustyni Błędowskiej znaczy to niebo zaniżone o całą
 * klasę, i to dokładnie tam, gdzie się obserwuje.
 *
 * Mapa jest wbudowana w aplikację i czyta się ją lokalnie — **działa bez sieci**.
 * To warunek, nie udogodnienie: w terenie zasięgu nie ma, a to właśnie tam
 * pytanie o jakość nieba ma sens.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import { SKY_MAP } from '../data/sky-map.generated.ts';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Własny dekoder base64: `atob` nie jest częścią standardu JS, a Hermes go nie
 * dostarcza. Rozpakowujemy raz, przy pierwszym pytaniu — 141 kB to za dużo,
 * żeby robić to przy starcie aplikacji, i o dwa rzędy za mało, żeby robić to
 * przy każdym odczycie.
 */
function decodeBase64(input: string): Uint8Array {
  const lookup = new Uint8Array(128);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;

  const padding = input.endsWith('==') ? 2 : input.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((input.length / 4) * 3 - padding);

  let out = 0;
  for (let i = 0; i < input.length; i += 4) {
    const chunk =
      (lookup[input.charCodeAt(i)] << 18) |
      (lookup[input.charCodeAt(i + 1)] << 12) |
      (lookup[input.charCodeAt(i + 2)] << 6) |
      lookup[input.charCodeAt(i + 3)];

    if (out < bytes.length) bytes[out++] = (chunk >> 16) & 0xff;
    if (out < bytes.length) bytes[out++] = (chunk >> 8) & 0xff;
    if (out < bytes.length) bytes[out++] = chunk & 0xff;
  }

  return bytes;
}

let grid: Uint8Array | null = null;

const cells = () => (grid ??= decodeBase64(SKY_MAP.data));

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Ten sam wzór na komórkę, którego używa generator bazy miejscowości.
 *
 * Indeks lokalny w kaflu World Atlas to `round(120·(lat+65) − 600·(ty−1) + ½)`,
 * a `600·(ty−1)` jest całkowite, więc po dodaniu numeru kafla zostaje samo
 * `round(120·(lat+65) + ½)`. Dzięki temu aplikacja i generator trafiają w tę
 * samą komórkę także przy krawędzi, a nie w dwie sąsiednie.
 */
const cellY = (lat: number) => Math.round(120 * (lat + 65) + 0.5);
const cellX = (lon: number) => Math.round(120 * mod(lon + 180, 360) + 0.5);

const ORIGIN_Y = cellY(SKY_MAP.lat0);
const ORIGIN_X = cellX(SKY_MAP.lon0);

/**
 * Jasność nieba w mag/arcsec² — im więcej, tym ciemniej (~22 to niebo naturalne).
 * `null` znaczy „punkt poza wgraną mapą", a nie „nie wiadomo": wtedy warstwa
 * wyżej wraca do dziedziczenia po najbliższej miejscowości.
 */
export function skyBrightnessAt(lat: number, lon: number): number | null {
  const row = cellY(lat) - ORIGIN_Y;
  const col = cellX(lon) - ORIGIN_X;

  if (row < 0 || row >= SKY_MAP.rows || col < 0 || col >= SKY_MAP.cols) return null;

  return SKY_MAP.baseMpsas + cells()[row * SKY_MAP.cols + col] * SKY_MAP.quant;
}

/**
 * Progi SQM → Bortle. Kopia progów z generatora (scripts/world-atlas.ts), bo ten
 * korzysta z `node:zlib` i nie da się go zaimportować w aplikacji. Zgodność obu
 * list pilnuje test — rozjechanie się ich znaczyłoby, że aplikacja i baza
 * miejscowości mówią o tym samym punkcie co innego.
 */
export function bortleFromSkyBrightness(mpsas: number): number {
  if (mpsas >= 21.99) return 1;
  if (mpsas >= 21.89) return 2;
  if (mpsas >= 21.69) return 3;
  if (mpsas >= 20.49) return 4;
  if (mpsas >= 19.5) return 5;
  if (mpsas >= 18.94) return 6;
  if (mpsas >= 18.38) return 7;
  if (mpsas >= 17.8) return 8;
  return 9;
}

/** Skąd wzięła się jakość nieba — dwie różne wiarygodności, więc UI ma je rozróżniać. */
export type BortleSource = 'map' | 'nearest';

export type SkyQuality = {
  bortle: number;
  source: BortleSource;
  /** Jasność w mag/arcsec², gdy pochodzi z mapy. */
  mpsas: number | null;
};

/**
 * Jakość nieba dla punktu: z mapy, a gdy punkt leży poza nią — z podanej
 * wartości zapasowej (zwykle Bortle najbliższej miejscowości).
 */
export function skyQualityAt(lat: number, lon: number, fallbackBortle: number): SkyQuality {
  const mpsas = skyBrightnessAt(lat, lon);

  if (mpsas === null) return { bortle: fallbackBortle, source: 'nearest', mpsas: null };

  return { bortle: bortleFromSkyBrightness(mpsas), source: 'map', mpsas };
}
