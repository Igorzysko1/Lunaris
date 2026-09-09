/**
 * Rezerwacja sesji w kalendarzu — jeden krok z werdyktu do zajętego bloku.
 *
 *   npm run book -- --site=bledowska            # podgląd, nic nie zapisuje
 *   npm run book -- --site=bledowska --confirm  # zapisuje do kalendarza
 *   npm run book -- --site=bledowska --cancel   # odwołuje rezerwację tej nocy
 *
 * ## Dlaczego podgląd jest domyślny
 *
 * To jedyne polecenie w tym projekcie, które **zapisuje do cudzych danych**.
 * Wszystko inne czyta albo pisze do własnych plików; tu wpis pojawia się
 * w kalendarzu, który widzą też inni, i zasłania termin. Domyślne działanie
 * pokazuje więc, co powstanie, a `--confirm` jest świadomym krokiem — nie na
 * odwrót.
 *
 * Rezerwujemy **pierwszą nadchodzącą noc z werdyktem „jedź"**, bo o to chodzi
 * w tym zadaniu: żeby nie przepisywać ręcznie tego, co silnik już policzył.
 * Konkretną noc wskazuje `--night=RRRR-MM-DD` (data wieczoru).
 */

import { findPlaceById, type Coords } from '../src/data/places.ts';
import { nextDayFromCalendar, type CalendarEntry } from '../src/lib/calendar.ts';
import { DEFAULT_CONFIG, mergeConfig, type LunarisConfig } from '../src/lib/config.ts';
import { upcomingEvents } from '../src/lib/events.ts';
import { deleteBooking, fetchDayEntries, upsertBooking } from '../src/lib/google-calendar.ts';
import { accessToken, readClient, readRefreshToken } from '../src/lib/google-oauth.ts';
import { planNights } from '../src/lib/night-plan.ts';
import { assumedNextDay } from '../src/lib/session-engine.ts';
import { bookingFor } from '../src/lib/session-booking.ts';
import { rankedTargets } from '../src/lib/sky-targets.ts';
import { skyQualityAt } from '../src/lib/sky-map.ts';
import { fetchForecastBundle } from '../src/lib/weather.ts';
import { readFileSync } from 'node:fs';

/** Ile celów wymieniamy w opisie wpisu — tyle, ile czyta się w aucie. */
const TARGETS_IN_DESCRIPTION = 5;

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
    if (next === undefined || next.startsWith('--')) args.set(key, '');
    else args.set(key, argv[++i]);
  }

  return args;
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').toLowerCase();
}

function loadConfig(path: string | undefined): LunarisConfig {
  if (!path) return DEFAULT_CONFIG;
  try {
    return mergeConfig(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    fail(`Nie mogę wczytać konfiguracji z ${path}: ${(error as Error).message}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const config = loadConfig(args.get('config'));

const siteKey = args.get('site');
if (!siteKey) fail('Podaj --site=<id albo nazwa>.');

const wanted = normalize(siteKey);
const site = config.sites.find((s) => s.id === siteKey || normalize(s.name).includes(wanted));
if (!site) {
  fail(`Nie znam miejscówki „${siteKey}". Dostępne: ${config.sites.map((s) => s.id).join(', ')}`);
}

const coords: Coords = { lat: site.lat, lon: site.lon };
const sky = skyQualityAt(site.lat, site.lon, site.bortle);
const homePlace = config.observer.homePlaceId ? findPlaceById(config.observer.homePlaceId) : null;

const client = readClient();
const refresh = readRefreshToken();
if (!client || !refresh) fail('Brak autoryzacji Google. Uruchom najpierw: npm run google:auth');

const token = await accessToken(client, refresh);
if (!token) fail('Nie udało się odświeżyć tokenu Google. Spróbuj: npm run google:auth');

let bundle;
try {
  bundle = await fetchForecastBundle(coords, 3);
} catch (error) {
  fail(`Nie udało się pobrać prognozy: ${(error as Error).message}`);
}

// Kalendarz czytamy zawsze: rezerwacja liczona z założonej ósmej mogłaby
// zająć termin, którego silnik z prawdziwymi godzinami by nie polecił.
const byDay = new Map<string, CalendarEntry[]>();
for (const { night } of bundle.nights) {
  const entries = await fetchDayEntries(token, night.to);
  if (entries) byDay.set(night.to.toDateString(), entries);
}

const now = new Date();
const planned = planNights({
  nights: bundle.nights,
  target: coords,
  home: homePlace ? { lat: homePlace.lat, lon: homePlace.lon } : null,
  config,
  bortle: sky.bortle,
  walkMinutes: site.walkMinutes,
  events: upcomingEvents(now, coords),
  nextDay: (night) => {
    const entries = byDay.get(night.to.toDateString());
    return entries ? nextDayFromCalendar(night, entries) : assumedNextDay(night, config);
  },
});

const wantedNight = args.get('night');
const chosen = wantedNight
  ? planned.find((n) => {
      const d = n.verdict.night.from;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return key === wantedNight;
    })
  : planned.find((n) => n.verdict.status === 'go');

if (!chosen) {
  fail(
    wantedNight
      ? `Nie mam werdyktu na noc ${wantedNight} — prognoza obejmuje trzy najbliższe.`
      : 'Żadna z najbliższych trzech nocy nie ma werdyktu „jedź". Nie ma czego rezerwować.',
  );
}

const booking = bookingFor({
  verdict: chosen.verdict,
  site: { id: site.id, name: site.name, lat: site.lat, lon: site.lon },
  rating: chosen.rating,
  targets: rankedTargets(chosen.targets, TARGETS_IN_DESCRIPTION).map((t) => t.name),
});

if (!booking) {
  fail(`Noc ${chosen.verdict.night.from.toDateString()} ma werdykt „nie jedź" — nie rezerwuję.`);
}

const stamp = (date: Date) =>
  date.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });

// Przy odwołaniu nie wypisujemy całego opisu — liczy się to, czy wpis zniknął,
// a nie co w nim było.
if (!args.has('cancel')) {
  process.stdout.write(
    [
      booking.title,
      `  ${stamp(booking.start)} → ${stamp(booking.end)}`,
      `  ${booking.location}`,
      '',
      booking.description.replace(/^/gm, '  '),
      '',
    ].join('\n'),
  );
}

if (args.has('cancel')) {
  const removed = await deleteBooking(token, booking.id);
  if (!removed) fail('Nie udało się odwołać rezerwacji.');

  process.stdout.write(
    removed.existed
      ? 'Rezerwacja odwołana — wpis usunięty z kalendarza.\n'
      : 'Nie było czego odwoływać — tej nocy nie ma w kalendarzu.\n',
  );
  process.exit(0);
}

if (!args.has('confirm')) {
  process.stdout.write('Podgląd — nic nie zapisano. Aby zapisać, dodaj --confirm\n');
  process.exit(0);
}

const result = await upsertBooking(token, booking);
if (!result) fail('Nie udało się zapisać wpisu w kalendarzu.');

process.stdout.write(
  `${result.replaced ? 'Nadpisano wcześniejszą rezerwację' : 'Zapisano w kalendarzu'}` +
    `${result.htmlLink ? `: ${result.htmlLink}` : '.'}\n`,
);
