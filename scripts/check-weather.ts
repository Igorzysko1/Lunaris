/**
 * Sprawdza realną prognozę na najbliższą noc w danej miejscowości (Open-Meteo).
 *
 * Skrypt deweloperski: służy do oglądania danych wejściowych gołym okiem, bez
 * uruchamiania aplikacji. **Nie ma własnego rachunku** — prognozę pobiera tym
 * samym klientem co ekran Noc, okno nocy dostaje z tego klienta, a progi bierze
 * z konfiguracji. Gdyby liczył cokolwiek po swojemu, po pierwszej korekcie progu
 * pokazywałby co innego niż aplikacja.
 *
 *   npm run weather -- Zawoja
 *   npm run weather -- --lat 49.63 --lon 19.53
 */

import { CITIES, GMINY, type Place } from '../src/data/places.ts';
import { cloudBarColor, computeNightRating, ratingMeta } from '../src/lib/astro.ts';
import { DEFAULT_CONFIG } from '../src/lib/config.ts';
import { moonAt } from '../src/lib/moon.ts';
import { fetchNightForecast } from '../src/lib/weather.ts';
import { colors } from '../src/theme.ts';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

/**
 * Kolory terminala odwzorowują paletę aplikacji. Progi zachmurzenia siedzą
 * w `cloudBarColor`, więc tutaj zostaje samo tłumaczenie barwy na sekwencję ANSI
 * — inaczej byłyby dwie listy progów do utrzymania.
 */
const ANSI_BY_COLOR: Record<string, string> = {
  [colors.teal]: '\x1b[36m',
  [colors.green]: '\x1b[32m',
  [colors.amber]: '\x1b[33m',
  [colors.coral]: '\x1b[31m',
};

const ansiFor = (cloudPct: number) => ANSI_BY_COLOR[cloudBarColor(cloudPct)] ?? RESET;

/** „Żywiec" i „zywiec" mają trafiać w to samo — polskie znaki nie mogą blokować wyszukiwania. */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
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

function hhmm(d: Date): string {
  return d.toTimeString().slice(0, 5);
}

function bar(pct: number): string {
  const filled = Math.round((pct / 100) * 24);
  return `${ansiFor(pct)}${'█'.repeat(filled)}${DIM}${'·'.repeat(24 - filled)}${RESET}`;
}

function target(argv: string[]) {
  const { lat, lon, name } = parseArgs(argv);

  if (lat !== undefined && lon !== undefined) {
    return { place: undefined, coords: { lat, lon }, title: name || `${lat}, ${lon}` };
  }

  if (!name) {
    console.error(
      'Podaj miejscowość albo --lat/--lon.\n  npm run weather -- Zawoja\n  npm run weather -- --lat 49.63 --lon 19.53',
    );
    process.exit(1);
  }

  const place = findPlace(name);
  if (!place) {
    console.error(
      `Nie znam miejscowości „${name}". Użyj --lat/--lon albo nazwy z src/data/places.ts.`,
    );
    process.exit(1);
  }

  return { place, coords: { lat: place.lat, lon: place.lon }, title: place.name };
}

const { place, coords, title } = target(process.argv.slice(2));
const { conditions } = DEFAULT_CONFIG;

const forecast = await fetchNightForecast(coords.lat, coords.lon);

const subtitle = place
  ? `Bortle ${place.bortle} · ${place.region}`
  : `${coords.lat}, ${coords.lon}`;

console.log(`\n${BOLD}${title}${RESET} ${DIM}${subtitle}${RESET}`);
console.log(`${DIM}okno nocy: ${hhmm(forecast.from)} → ${hhmm(forecast.to)}${RESET}\n`);

console.log(
  `${DIM}godz.  chmury                     razem niskie wys.  wilg.  rosa  porywy${RESET}`,
);
for (const h of forecast.hours) {
  const cloud = `${String(Math.round(h.cloud)).padStart(4)}%`;
  const low = `${String(Math.round(h.cloudLow)).padStart(5)}%`;
  const high = `${String(Math.round(h.cloudHigh)).padStart(4)}%`;
  const humidity = `${String(Math.round(h.humidity)).padStart(4)}%`;
  // Mały spread znaczy rosę na optyce — dlatego jest tu, a nie sama temperatura.
  const dew = `${h.dewSpread.toFixed(1).padStart(4)}°`;
  const gust = `${h.windGust.toFixed(0).padStart(4)} km/h`;
  console.log(`${hhmm(h.at)}  ${bar(h.cloud)} ${cloud} ${low} ${high} ${humidity} ${dew} ${gust}`);
}

// Godzina „czysta" według tego samego progu, którym mierzy ją silnik werdyktu.
const clearHours = forecast.hours.filter((h) => h.cloud <= conditions.maxCloudTotal).length;
const clouds = forecast.hours.map((h) => h.cloud);
const maxGust = Math.max(...forecast.hours.map((h) => h.windGust));

console.log(`\n${BOLD}Podsumowanie nocy${RESET}`);
console.log(
  `  zachmurzenie   śr. ${Math.round(forecast.avgCloud)}%, min ${Math.round(Math.min(...clouds))}%, maks ${Math.round(Math.max(...clouds))}%`,
);
console.log(
  `  godziny czyste ${clearHours} z ${forecast.hours.length} ${DIM}(próg ${conditions.maxCloudTotal}% z konfiguracji)${RESET}`,
);
console.log(`  wilgotność     śr. ${Math.round(forecast.avgHumidity)}%`);
console.log(
  `  rosa           min. spread ${forecast.minDewSpread.toFixed(1)}°C ${DIM}(ostrzeżenie poniżej ${conditions.dewWarningSpreadC}°C)${RESET}`,
);
console.log(
  `  porywy         maks. ${maxGust.toFixed(0)} km/h ${DIM}(próg ${conditions.maxWindGustKmh} km/h na statywie, ${conditions.maxWindGustHandheldKmh} z ręki)${RESET}`,
);
console.log(`  temperatura    min. ${forecast.minTemperature.toFixed(1)}°C`);
console.log(`  opady          ${forecast.totalPrecipitation.toFixed(1)} mm łącznie`);

if (place) {
  const moon = moonAt(forecast.from, place.lat, place.lon);
  const rating = computeNightRating({
    avgCloud: forecast.avgCloud,
    avgHumidity: forecast.avgHumidity,
    precipitation: forecast.totalPrecipitation,
    moonIllumination: moon.illumination,
    bortle: place.bortle,
  });
  const meta = ratingMeta(rating);

  const moonRise = moon.rise ? hhmm(moon.rise) : '—';
  const moonSet = moon.set ? hhmm(moon.set) : '—';

  console.log(`\n${BOLD}Ocena nocy${RESET}  ${BOLD}${rating}${RESET}/100 — ${meta.label}`);
  console.log(
    `  ${DIM}Księżyc ${moon.glyph} ${moon.name}, ${moon.illumination}% oświetlenia · Bortle ${place.bortle}${RESET}`,
  );
  console.log(`  ${DIM}wschód Ks. ${moonRise} · zachód Ks. ${moonSet} · ${moon.detail}${RESET}`);
  console.log(
    `  ${DIM}Ten sam klient prognozy, wzór oceny i progi, których używa aplikacja.${RESET}\n`,
  );
} else {
  console.log(
    `\n${DIM}Ocena nocy wymaga Bortle — podaj nazwę miejscowości zamiast --lat/--lon.${RESET}\n`,
  );
}
