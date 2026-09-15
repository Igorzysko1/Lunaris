/**
 * Gdzie po ludzku: podpisy rankingu i katalogu, fix GPS, horyzont miejsca
 * i to, jak miejsce wybrane w Nocy staje w rankingu obok katalogu.
 *
 * Rachunek jest w `site-review` (ranking), `sky-map` (niebo) i `astro`
 * (odległość); tu tylko zdania i sprawdzenie tego, co wpisano ręcznie.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { ObservingSite } from '../data/observing-sites.ts';
import type { Coords } from '../data/places.ts';
import { formatDistance } from './astro.ts';
import { formatTime } from './date.ts';
import {
  DEFAULT_HORIZON,
  compassLabel,
  isValidMask,
  type HorizonMask,
  type HorizonOverride,
} from './horizon.ts';
import { plural } from './journal-text.ts';
import type { SkyQuality } from './sky-map.ts';

/** Identyfikator wiersza rankingu dla miejsca wybranego w Nocy spoza katalogu. */
export const ACTIVE_SITE_ID = 'wybrane-w-nocy';

/** Fix gorszy niż tyle metrów warto powtórzyć, zanim zostanie zapisany na stałe. */
const WEAK_FIX_M = 30;

const decimal = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');

/**
 * Miejsce wybrane w Nocy jako wiersz rankingu. Miejscowość nie zna dojścia od
 * parkingu ani notatek — to wie tylko katalog — więc zostają puste, a Bortle,
 * maska i korekty idą z aktywnej lokalizacji.
 */
export function activeAsSite(active: {
  label: string;
  coords: Coords;
  bortle: number;
  walkMinutes: number;
  horizonMask: HorizonMask | null;
  horizonOverrides: HorizonOverride[];
}): ObservingSite {
  return {
    id: ACTIVE_SITE_ID,
    name: active.label,
    region: '',
    lat: active.coords.lat,
    lon: active.coords.lon,
    bortle: active.bortle,
    walkMinutes: active.walkMinutes,
    notes: '',
    accuracyM: null,
    horizonMask: active.horizonMask,
    horizonOverrides: active.horizonOverrides,
  };
}

/** Pod nagłówkiem rankingu: skąd liczony dojazd i co ustala kolejność. */
export function rankingNote(home: string | null, penaltyPerHour: number): string {
  const order = home && penaltyPerHour > 0 ? 'ocena nieba minus kara za drogę' : 'sama ocena nieba';
  return home
    ? `Dojazd z: ${home} · kolejność: ${order}`
    : `Bez punktu startowego · kolejność: ${order}`;
}

/** Ranking częściowy (13c): „Policzone 3 z 5 miejsc · dojazd z: Jaworzno". */
export function partialNote(done: number, total: number, home: string | null): string {
  return `Policzone ${done} z ${total} miejsc${home ? ` · dojazd z: ${home}` : ''}`;
}

export function missingTitle(count: number): string {
  return `Bez prognozy · ${count} ${plural(count, ['miejsce', 'miejsca', 'miejsc'])}`;
}

export function missingAction(count: number): string {
  return count === 1
    ? 'Pobierz prognozę dla tego miejsca'
    : `Pobierz prognozę dla tych ${count} miejsc`;
}

/** Przycisk nocy w nagłówku: „noc: dziś ▾". */
export function nightChoice(relative: string): string {
  return `noc: ${relative} ▾`;
}

/** „22:10 – 02:40" */
export function windowText(window: { from: Date; to: Date }): string {
  return `${formatTime(window.from)} – ${formatTime(window.to)}`;
}

/** Czas jazdy z odległości i średniej prędkości z profilu — nie zapisany przy miejscu. */
export function driveMinutes(km: number, speedKmh: number): number {
  return Math.round((km / speedKmh) * 60);
}

/** W wierszu rankingu: „25 km · 30 min". */
export function travelShort(km: number, minutes: number): string {
  return `${formatDistance(km)} · ${Math.round(minutes)} min`;
}

/** W katalogu i szczególe: „70 km · ok. 84 min jazdy". */
export function travelLong(km: number, minutes: number): string {
  return `${formatDistance(km)} · ok. ${Math.round(minutes)} min jazdy`;
}

/** Dojście od parkingu; powyżej tolerancji z profilu — z ostrzeżeniem. */
export function walkText(walkMinutes: number, tolerance: number): { text: string; warn: boolean } {
  if (walkMinutes <= 0) return { text: 'stanowisko przy samochodzie', warn: false };

  const warn = walkMinutes > tolerance;
  const base = `${Math.round(walkMinutes)} min od parkingu`;
  return { text: warn ? `${base} — powyżej tolerancji ${tolerance} min` : base, warn };
}

/** „Tylko stąd: M33, NGC 7000" — oznaczenia, bez nazw, żeby zmieścić się w wierszu. */
export function uniqueText(names: string[]): string {
  const designations = names.map((name) => name.split(' — ')[0]);
  const shown = designations.slice(0, 3).join(', ');
  const more = designations.length > 3 ? ` i ${designations.length - 3} więcej` : '';
  return `Tylko stąd: ${shown}${more}`;
}

/** Dlaczego miejsce złożono w „zdominowanych". */
export function dominatedText(betterSite: string): string {
  return `Bliżej i lepiej: ${betterSite}. Nic, czego nie widać stamtąd.`;
}

/** Niebo miejsca: policzone dla punktu i odziedziczone po miejscowości to dwie różne wiarygodności. */
export function skyText(sky: SkyQuality): string {
  return sky.source === 'map' && sky.mpsas !== null
    ? `Bortle ${sky.bortle} · ${decimal(sky.mpsas, 2)} mag/arcsec² policzone dla tego punktu`
    : `Bortle ${sky.bortle} — szacunek, punkt poza wgraną mapą nieba`;
}

/** Dokładność fixa GPS — pokazywana zawsze, bo pod drzewami potrafi być kilkadziesiąt metrów. */
export function gpsAccuracyText(accuracyM: number | null): { text: string; warn: boolean } {
  if (accuracyM === null) return { text: 'dokładność nieznana', warn: false };

  const warn = accuracyM > WEAK_FIX_M;
  const base = `dokładność ±${Math.round(accuracyM)} m`;
  return { text: warn ? `${base} — słaby fix, warto powtórzyć` : base, warn };
}

/** Jak daleko istniejące miejsce leży od fixa: „420 m stąd", „39 km stąd". */
export function shiftText(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m stąd` : `${formatDistance(km)} stąd`;
}

/** „49,570 N 19,350 E" */
export function coordsText(coords: Coords): string {
  const lat = `${decimal(Math.abs(coords.lat), 3)} ${coords.lat >= 0 ? 'N' : 'S'}`;
  const lon = `${decimal(Math.abs(coords.lon), 3)} ${coords.lon >= 0 ? 'E' : 'W'}`;
  return `${lat} ${lon}`;
}

/** „S–SW (180°–225°): przeszkoda do 12°" */
export function obstacleText(override: HorizonOverride): string {
  return `${compassLabel(override.from)}–${compassLabel(override.to)} (${override.from}°–${override.to}°): przeszkoda do ${override.altitude}°`;
}

export function horizonSummary(mask: HorizonMask | null): string {
  if (!isValidMask(mask)) return `Brak maski terenu — obowiązuje próg ${DEFAULT_HORIZON}°.`;
  return `Maska terenu: ${Math.round(Math.min(...mask))}–${Math.round(Math.max(...mask))}°.`;
}

const numberOf = (text: string) => {
  const trimmed = text.trim().replace(',', '.');
  return trimmed === '' ? NaN : Number(trimmed);
};

/**
 * Przeszkoda wpisana w arkuszu miejsca. Azymuty 0–360 (sektor może przechodzić
 * przez północ), wysokość 0–90. `null` dla wszystkiego innego — zła korekta
 * chowałaby cele w całym sektorze nieba.
 */
export function parseObstacle(from: string, to: string, altitude: string): HorizonOverride | null {
  const values = [numberOf(from), numberOf(to), numberOf(altitude)];
  if (values.some((value) => !Number.isFinite(value))) return null;

  const [start, end, height] = values;
  if (start < 0 || start > 360 || end < 0 || end > 360) return null;
  if (height < 0 || height > 90) return null;

  return { from: start, to: end, altitude: height };
}

/** Nawigacja do miejsca — adres map, który otwiera się w aplikacji map na obu systemach. */
export function navigationUrl(coords: Coords): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat.toFixed(5)},${coords.lon.toFixed(5)}`;
}
