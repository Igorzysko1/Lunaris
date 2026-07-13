/**
 * Sprawdza realną prognozę na najbliższą noc w danej miejscowości (Open-Meteo).
 *
 * Skrypt deweloperski: służy do oceny, czy Open-Meteo nadaje się jako źródło danych
 * dla ekranu Noc, zanim zostanie podpięty do aplikacji. Nie liczy oceny nocy —
 * wzór nie jest jeszcze ustalony. Wypisuje surowe dane wejściowe.
 *
 *   npm run weather -- Zawoja
 *   npm run weather -- --lat 49.63 --lon 19.53
 */

import { CITIES, GMINY, type Place } from '../src/data/places.ts';
import { computeNightRating, ratingMeta } from '../src/lib/astro.ts';
import { moonAt } from '../src/lib/moon.ts';

const API = 'https://api.open-meteo.com/v1/forecast';

/** Progi kolorów zachmurzenia — lustro cloudBarColor() z src/lib/astro.ts. */
const CLOUD_STEPS = [
  { max: 20, ansi: '\x1b[36m' }, // teal
  { max: 40, ansi: '\x1b[32m' }, // zielony
  { max: 70, ansi: '\x1b[33m' }, // amber
  { max: Infinity, ansi: '\x1b[31m' }, // koral
];
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

type Forecast = {
  hourly: {
    time: string[];
    cloud_cover: (number | null)[];
    relative_humidity_2m: (number | null)[];
    visibility: (number | null)[];
    precipitation: (number | null)[];
  };
  daily: { time: string[]; sunrise: string[]; sunset: string[] };
  timezone: string;
};

/** „Żywiec" i „zywiec" mają trafiać w to samo — polskie znaki nie mogą blokować wyszukiwania. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');
}

function findPlace(query: string): Place | undefined {
  const q = normalize(query);
  const all = [...CITIES, ...GMINY];
  return (
    all.find((p) => normalize(p.name) === q) ?? all.find((p) => normalize(p.name).startsWith(q))
  );
}

function parseArgs(argv: string[]) {
  let lat: number | undefined;
  let lon: number | undefined;
  const words: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lat') lat = Number(argv[++i]);
    else if (argv[i] === '--lon') lon = Number(argv[++i]);
    else words.push(argv[i]);
  }

  return { lat, lon, name: words.join(' ') };
}

async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  const url = new URL(API);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('hourly', 'cloud_cover,relative_humidity_2m,visibility,precipitation');
  url.searchParams.set('daily', 'sunrise,sunset');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('past_days', '1');
  url.searchParams.set('forecast_days', '2');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo zwróciło ${res.status} ${res.statusText}`);
  return res.json() as Promise<Forecast>;
}

/** Okno obserwacyjne: od zachodu Słońca do najbliższego wschodu. */
function nightWindow(daily: Forecast['daily'], now: Date) {
  // daily = [wczoraj, dziś, jutro] (past_days=1, forecast_days=2)
  const beforeSunrise = now < new Date(daily.sunrise[1]);
  return beforeSunrise
    ? { from: new Date(daily.sunset[0]), to: new Date(daily.sunrise[1]), label: 'trwająca noc' }
    : { from: new Date(daily.sunset[1]), to: new Date(daily.sunrise[2]), label: 'najbliższa noc' };
}

function hhmm(d: Date): string {
  return d.toTimeString().slice(0, 5);
}

function cloudColor(pct: number): string {
  return CLOUD_STEPS.find((s) => pct < s.max)!.ansi;
}

function bar(pct: number): string {
  const filled = Math.round((pct / 100) * 24);
  return `${cloudColor(pct)}${'█'.repeat(filled)}${DIM}${'·'.repeat(24 - filled)}${RESET}`;
}

function main(argv: string[]) {
  const { lat, lon, name } = parseArgs(argv);

  let place: Place | undefined;
  let coords: { lat: number; lon: number };
  let title: string;

  if (lat !== undefined && lon !== undefined) {
    coords = { lat, lon };
    title = name || `${lat}, ${lon}`;
  } else if (name) {
    place = findPlace(name);
    if (!place) {
      console.error(`Nie znam miejscowości „${name}". Użyj --lat/--lon albo nazwy z src/data/places.ts.`);
      process.exit(1);
    }
    coords = { lat: place.lat, lon: place.lon };
    title = place.name;
  } else {
    console.error('Podaj miejscowość albo --lat/--lon.\n  npm run weather -- Zawoja\n  npm run weather -- --lat 49.63 --lon 19.53');
    process.exit(1);
  }

  return { place, coords, title };
}

const { place, coords, title } = main(process.argv.slice(2));
const forecast = await fetchForecast(coords.lat, coords.lon);
const now = new Date();
const night = nightWindow(forecast.daily, now);

const rows = forecast.hourly.time
  .map((t, i) => ({
    at: new Date(t),
    cloud: forecast.hourly.cloud_cover[i],
    humidity: forecast.hourly.relative_humidity_2m[i],
    visibility: forecast.hourly.visibility[i],
    precip: forecast.hourly.precipitation[i],
  }))
  .filter((r) => r.at >= night.from && r.at <= night.to);

const subtitle = place ? `Bortle ${place.bortle} · ${place.region}` : `${coords.lat}, ${coords.lon}`;
console.log(`\n${BOLD}${title}${RESET} ${DIM}${subtitle}${RESET}`);
console.log(`${DIM}${night.label}: ${hhmm(night.from)} → ${hhmm(night.to)} · ${forecast.timezone}${RESET}\n`);

console.log(`${DIM}godz.  chmury                     wilg.  widocz.  opady${RESET}`);
for (const r of rows) {
  const cloud = r.cloud ?? 0;
  const vis = r.visibility === null ? '   —  ' : `${(r.visibility / 1000).toFixed(0).padStart(3)} km`;
  const hum = r.humidity === null ? ' — ' : `${String(r.humidity).padStart(3)}%`;
  const precip = `${(r.precip ?? 0).toFixed(1).padStart(4)} mm`;
  console.log(
    `${hhmm(r.at)}  ${bar(cloud)} ${String(cloud).padStart(3)}%  ${hum}  ${vis}  ${precip}`,
  );
}

const clouds = rows.map((r) => r.cloud ?? 0);
const clearHours = clouds.filter((c) => c < 20).length;
const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
const totalPrecip = rows.reduce((sum, r) => sum + (r.precip ?? 0), 0);
const visibilities = rows.map((r) => r.visibility).filter((v): v is number => v !== null);

console.log(`\n${BOLD}Podsumowanie nocy${RESET}`);
console.log(`  zachmurzenie   śr. ${avg(clouds)}%, min ${Math.min(...clouds)}%, maks ${Math.max(...clouds)}%`);
console.log(`  godziny czyste ${clearHours} z ${rows.length} (zachmurzenie < 20%)`);
console.log(`  wilgotność     śr. ${avg(rows.map((r) => r.humidity ?? 0))}%`);
console.log(
  `  widoczność     ${visibilities.length ? `min ${(Math.min(...visibilities) / 1000).toFixed(0)} km` : 'brak danych'}`,
);
console.log(`  opady          ${totalPrecip.toFixed(1)} mm łącznie`);

if (place) {
  const moon = moonAt();
  const rating = computeNightRating({
    avgCloud: avg(clouds),
    avgHumidity: avg(rows.map((r) => r.humidity ?? 0)),
    precipitation: totalPrecip,
    moonIllumination: moon.illumination,
    bortle: place.bortle,
  });
  const meta = ratingMeta(rating);

  console.log(`\n${BOLD}Ocena nocy${RESET}  ${BOLD}${rating}${RESET}/100 — ${meta.label}`);
  console.log(
    `  ${DIM}Księżyc ${moon.glyph} ${moon.name}, ${moon.illumination}% oświetlenia · Bortle ${place.bortle}${RESET}`,
  );
  console.log(`  ${DIM}Ten sam wzór, którego używa aplikacja (src/lib/astro.ts).${RESET}\n`);
} else {
  console.log(`\n${DIM}Ocena nocy wymaga Bortle — podaj nazwę miejscowości zamiast --lat/--lon.${RESET}\n`);
}
