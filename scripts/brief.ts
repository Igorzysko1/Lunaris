/**
 * Brief z linii poleceń — ten sam silnik, bez aplikacji.
 *
 * Dwa cele naraz. Po pierwsze daje zadaniu cyklicznemu na maszynie dostęp do tej
 * samej logiki, którą liczy telefon: cron wywołuje ten skrypt, dostaje JSON
 * i robi z nim, co ma zrobić. Po drugie jest testem regresyjnym silnika — jeśli
 * werdykt zaczyna być bzdurny, widać to od razu na stdout, a nie po miesiącu
 * nieudanych wyjazdów.
 *
 * Skrypt **niczego nie liczy po swojemu**: parsuje argumenty, pobiera prognozę
 * i woła `buildBrief`. Cały rachunek jest w warstwie domenowej, wspólnej
 * z aplikacją.
 *
 *   npm run brief -- --site=bledowska
 *   npm run brief -- --lat 50.35 --lon 19.53 --nights 3 --pretty
 *   npm run brief -- --site=bledowska --config ~/lunaris.json --notices ~/.lunaris-notices.json
 *   npm run brief -- --site=bledowska --narrative ~/Dysk/Obserwacje/propozycje/2026-01-16.json
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { findPlaceById, nearestPlace, type Coords } from '../src/data/places.ts';
import { buildBrief } from '../src/lib/brief.ts';
import {
  attachNarrative,
  narrativeMatches,
  parseNarrative,
  type Narrative,
} from '../src/lib/narrative.ts';
import { DEFAULT_CONFIG, mergeConfig, type LunarisConfig } from '../src/lib/config.ts';
import type { NoticeLog } from '../src/lib/event-review.ts';
import { upcomingEvents } from '../src/lib/events.ts';
import { skyQualityAt } from '../src/lib/sky-map.ts';
import { fetchForecastBundle } from '../src/lib/weather.ts';

/** `--klucz=wartość` i `--klucz wartość` mają działać tak samo. */
function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const [key, inline] = token.slice(2).split('=');
    if (inline !== undefined) {
      args.set(key, inline);
      continue;
    }

    const next = argv[i + 1];
    // Flaga bez wartości (np. --pretty) dostaje pusty napis, a nie nazwę
    // następnego argumentu.
    if (next === undefined || next.startsWith('--')) args.set(key, '');
    else args.set(key, argv[++i]);
  }

  return args;
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** Polskie znaki nie mogą blokować dopasowania: „bledowska" ma trafiać w „Błędowska". */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').toLowerCase();
}

function loadConfig(path: string | undefined): LunarisConfig {
  if (!path) return DEFAULT_CONFIG;

  try {
    // mergeConfig scala z domyślnymi i przycina zakresy, więc plik może zawierać
    // wyłącznie te progi, które użytkownik faktycznie zmienił.
    return mergeConfig(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    fail(`Nie mogę wczytać konfiguracji z ${path}: ${(error as Error).message}`);
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function loadNotices(path: string | undefined): NoticeLog {
  if (!path) return {};

  try {
    return JSON.parse(readFileSync(path, 'utf8'), (_k, v) =>
      typeof v === 'string' && ISO.test(v) ? new Date(v) : v,
    ) as NoticeLog;
  } catch {
    // Brak pliku przy pierwszym uruchomieniu jest normalny. Uszkodzony znaczy,
    // że przegląd zgłosi coś drugi raz — pomyłka w dobrą stronę.
    return {};
  }
}

/**
 * Komentarz agenta, jeśli jest.
 *
 * Nie przerywa niczego: brak pliku, zepsuty JSON i dokument niezgodny ze
 * schematem kończą się tak samo — brief wychodzi bez narracji. To ta sama
 * reguła, którą kieruje się aplikacja: brak warstwy narracyjnej degraduje wynik
 * do surowych okien, nie do błędu. Zastrzeżenia idą na stderr, żeby dało się
 * poznać, że agent psuje kontrakt, a cron mimo to dostał użyteczny brief na
 * stdout.
 */
function loadNarrative(path: string | undefined): Narrative | null {
  if (!path) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    process.stderr.write(`Pomijam narrację z ${path}: ${(error as Error).message}\n`);
    return null;
  }

  const { narrative, problems } = parseNarrative(raw);
  for (const problem of problems) {
    process.stderr.write(`Narracja ${path}: ${problem.path || '<korzeń>'} — ${problem.reason}\n`);
  }

  return narrative;
}

const args = parseArgs(process.argv.slice(2));
const config = loadConfig(args.get('config'));

/** Miejsce z katalogu, punkt z linii poleceń albo miejscowość z bazy. */
function resolveTarget() {
  const siteKey = args.get('site');
  if (siteKey) {
    const wanted = normalize(siteKey);
    const site = config.sites.find((s) => s.id === siteKey || normalize(s.name).includes(wanted));
    if (!site) {
      fail(
        `Nie znam miejscówki „${siteKey}". Dostępne: ${config.sites.map((s) => s.id).join(', ')}`,
      );
    }
    return {
      id: site.id,
      name: site.name,
      lat: site.lat,
      lon: site.lon,
      fallbackBortle: site.bortle,
      walkMinutes: site.walkMinutes,
    };
  }

  const lat = Number(args.get('lat'));
  const lon = Number(args.get('lon'));
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const near = nearestPlace({ lat, lon });
    return {
      id: `${lat},${lon}`,
      name: `${lat.toFixed(3)}, ${lon.toFixed(3)} (przy: ${near.name})`,
      lat,
      lon,
      fallbackBortle: near.bortle,
      // Marszu od parkingu nie znamy dla dowolnego punktu — zero, a nie zmyślona
      // wartość, bo od niej zależy plan wyjazdu.
      walkMinutes: 0,
    };
  }

  fail('Podaj --site=<id albo nazwa> albo --lat i --lon.');
}

const target = resolveTarget();
const coords: Coords = { lat: target.lat, lon: target.lon };

const nights = Math.max(1, Math.min(14, Number(args.get('nights') ?? 3) || 3));
const leadHours = Math.max(0, Number(args.get('lead') ?? 6) || 6);

const homePlace = config.observer.homePlaceId ? findPlaceById(config.observer.homePlaceId) : null;

// Bortle policzone dla dokładnych współrzędnych bije wartość wpisaną do katalogu;
// szacunek zostaje dla punktów spoza obszaru wgranej mapy jasności.
const sky = skyQualityAt(target.lat, target.lon, target.fallbackBortle);

let bundle;
try {
  bundle = await fetchForecastBundle(coords, nights);
} catch (error) {
  // Cron ma rozpoznać porażkę po kodzie wyjścia, a nie po pustym JSON-ie.
  fail(`Nie udało się pobrać prognozy: ${(error as Error).message}`);
}

const now = new Date();
const noticesPath = args.get('notices');

const { brief, noticeLog } = buildBrief({
  now,
  site: {
    id: target.id,
    name: target.name,
    lat: target.lat,
    lon: target.lon,
    bortle: sky.bortle,
    walkMinutes: target.walkMinutes,
  },
  home: homePlace ? { lat: homePlace.lat, lon: homePlace.lon } : null,
  nights: bundle.nights,
  events: upcomingEvents(now, coords),
  config,
  leadHours,
  previousNotices: loadNotices(noticesPath),
});

// Pamięć przeglądu zapisujemy dopiero po zbudowaniu briefu: gdyby rachunek padł
// w połowie, plik zostaje nietknięty i następny przebieg zgłosi to samo, zamiast
// przemilczeć. Zapisujemy to, co zwrócił przegląd — nie odtwarzamy jego decyzji
// z gotowego JSON-a, bo byłaby to druga implementacja tej samej reguły.
if (noticesPath) {
  writeFileSync(noticesPath, JSON.stringify(noticeLog, null, 2));
}

const narrative = loadNarrative(args.get('narrative'));

// Literówka w identyfikatorze miejsca kasowałaby całą narrację bez słowa —
// a to jedyny przypadek, w którym dokument jest poprawny i mimo to nieużyty.
if (narrative && !narrativeMatches(brief, narrative)) {
  process.stderr.write(
    `Narracja dotyczy miejsca „${narrative.site}", a brief liczy „${brief.site.id}" — pomijam.\n`,
  );
}

const output = attachNarrative(brief, narrative);

process.stdout.write(JSON.stringify(output, null, args.has('pretty') ? 2 : undefined) + '\n');
