/**
 * Ranking miejscówek. Najważniejsze jest to, czego nie widać w kolejności:
 * że bliższe miejsce z gorszym niebem potrafi wygrać z dalszym i lepszym,
 * i że da się to uzasadnić liczbami.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ObservingSite } from '../src/data/observing-sites.ts';
import { DEFAULT_CONFIG, type LunarisConfig } from '../src/lib/config.ts';
import { explainScore, reviewNights, type ReviewInput } from '../src/lib/site-review.ts';
import type { NightHour, NightSlice } from '../src/lib/weather.ts';

const HOME = { lat: 50.205, lon: 19.275 };
const NIGHT = { from: new Date(2026, 0, 15, 18, 0), to: new Date(2026, 0, 16, 0, 0) };

function site(id: string, over: Partial<ObservingSite> = {}): ObservingSite {
  return {
    id,
    name: id,
    region: 'śląskie',
    lat: 50.35,
    lon: 19.53,
    bortle: 4,
    walkMinutes: 0,
    notes: '',
    ...over,
  };
}

function hours(cloud: number): NightHour[] {
  return Array.from({ length: 7 }, (_, i) => ({
    at: new Date(NIGHT.from.getTime() + i * 3_600_000),
    cloud,
    cloudLow: 0,
    cloudHigh: 0,
    humidity: 60,
    temperature: 5,
    dewSpread: 6,
    precipitation: 0,
    windGust: 8,
  }));
}

const slice = (cloud: number): NightSlice[] => [{ night: NIGHT, hours: hours(cloud) }];

function input(sites: ObservingSite[], clouds: number[], config = DEFAULT_CONFIG): ReviewInput {
  const forecasts = new Map<string, NightSlice[]>();
  sites.forEach((s, i) => {
    if (clouds[i] >= 0) forecasts.set(s.id, slice(clouds[i]));
  });

  return {
    sites,
    forecasts,
    home: HOME,
    config,
    moon: () => ({ illumination: 5, upAt: () => false }),
    // Dzień wolny: reguła kalendarzowa nie ma tu nic do rzeczy.
    nextDay: () => ({ firstEventAt: null, dayOff: true }),
  };
}

const clone = (): LunarisConfig => structuredClone(DEFAULT_CONFIG);

describe('reviewNights', () => {
  it('każde miejsce dostaje własny werdykt', () => {
    const sites = [site('blisko'), site('daleko', { lat: 49.57, lon: 19.35 })];
    const [review] = reviewNights(input(sites, [0, 0]));

    assert.equal(review.go.length + review.noGo.length, 2);
  });

  it('miejsce bez prognozy trafia do brakujących, a reszta i tak się liczy', () => {
    const sites = [site('z-danymi'), site('bez-danych', { lat: 49.57, lon: 19.35 })];
    const [review] = reviewNights(input(sites, [0, -1]));

    assert.equal(review.missing.length, 1);
    assert.equal(review.missing[0].id, 'bez-danych');
    assert.equal(review.go.length, 1);
  });

  it('przy równym niebie wygrywa bliższe miejsce', () => {
    const near = site('blisko', { lat: 50.35, lon: 19.53 });
    const far = site('daleko', { lat: 49.57, lon: 19.35 });
    const [review] = reviewNights(input([far, near], [0, 0]));

    assert.equal(review.go[0].site.id, 'blisko');
    assert.ok(review.go[0].travelMinutes < review.go[1].travelMinutes);
  });

  it('bliższe z gorszym niebem wygrywa z dalszym i lepszym, gdy różnica jest mała', () => {
    // 71 km różnicy to ~85 min drogi, czyli ~14 punktów kary przy domyślnej wadze.
    // 10 punktów przewagi nieba tego nie pokrywa.
    const near = site('blisko', { lat: 50.35, lon: 19.53 });
    const far = site('daleko', { lat: 49.57, lon: 19.35 });
    const [review] = reviewNights(input([near, far], [15, 0]));

    assert.equal(review.go[0].site.id, 'blisko');
    assert.ok(review.go[0].rating < review.go[1].rating, 'bliższe ma gorsze niebo');
    assert.ok(review.go[0].score > review.go[1].score, 'ale lepszy wynik po karze za dojazd');
  });

  it('przy dużej różnicy nieba dalsze miejsce jednak wygrywa', () => {
    const near = site('blisko', { lat: 50.35, lon: 19.53 });
    const far = site('daleko', { lat: 49.57, lon: 19.35 });
    const [review] = reviewNights(input([near, far], [60, 0]));

    assert.equal(review.go[0].site.id, 'daleko');
  });

  it('zerowa waga dojazdu wyłącza karę i zostawia sam ranking nieba', () => {
    const config = clone();
    config.conditions.travelPenaltyPerHour = 0;

    const near = site('blisko', { lat: 50.35, lon: 19.53 });
    const far = site('daleko', { lat: 49.57, lon: 19.35 });
    const [review] = reviewNights(input([near, far], [15, 0], config));

    assert.equal(review.go[0].site.id, 'daleko');
    assert.equal(review.go[0].score, review.go[0].rating);
  });

  it('zmiana progu przestawia ranking bez zmiany danych wejściowych', () => {
    const sites = [site('a'), site('b', { lat: 49.57, lon: 19.35 })];
    // 20% zachmurzenia mieści się w domyślnym progu 25%, ale nie w zaostrzonym.
    const base = input(sites, [20, 20]);

    const permissive = reviewNights(base);
    const strict = reviewNights({
      ...base,
      config: (() => {
        const c = clone();
        c.conditions.maxCloudTotal = 5;
        return c;
      })(),
    });

    assert.ok(permissive[0].go.length > 0);
    assert.equal(strict[0].go.length, 0);
    assert.equal(strict[0].noGo.length, 2);
  });

  it('odrzucone miejsce zachowuje powód z silnika', () => {
    const config = clone();
    config.conditions.maxCloudTotal = 5;

    const [review] = reviewNights(input([site('a')], [80], config));

    assert.equal(review.noGo.length, 1);
    assert.equal(review.noGo[0].verdict.rejection?.kind, 'conditions');
  });

  it('dopisanie miejsca do katalogu włącza je do przeglądu', () => {
    const one = reviewNights(input([site('a')], [0]));
    const two = reviewNights(input([site('a'), site('b', { lat: 50.7, lon: 19.45 })], [0, 0]));

    assert.equal(one[0].go.length + one[0].noGo.length, 1);
    assert.equal(two[0].go.length + two[0].noGo.length, 2);
  });

  it('pusty katalog nie wywraca rachunku', () => {
    assert.deepEqual(reviewNights(input([], [])), []);
  });

  it('marsz od parkingu wchodzi do werdyktu z danych miejsca', () => {
    const long = site('podejscie', { walkMinutes: 90 });
    const [review] = reviewNights(input([long], [0]));

    assert.ok(review.go[0].verdict.warnings.some((w) => w.kind === 'walk-too-long'));
  });
});

describe('dominacja i wybór', () => {
  const near = () => site('blisko', { lat: 50.35, lon: 19.53, bortle: 4 });
  const far = () => site('daleko', { lat: 49.57, lon: 19.35, bortle: 4 });

  it('dwa dobre miejsca zostają oba na liście — to alternatywy, nie werdykt', () => {
    // Dalsze ma lepsze niebo, więc nie jest zdominowane: jest po co jechać dalej.
    const [review] = reviewNights(input([near(), far()], [20, 0]));

    assert.equal(review.go.length, 2);
    assert.equal(review.dominated.length, 0);
  });

  it('miejsce dalsze ORAZ gorsze jest składane, z podaniem lepszego', () => {
    const [review] = reviewNights(input([near(), far()], [0, 20]));

    assert.equal(review.go.length, 1);
    assert.equal(review.go[0].site.id, 'blisko');
    assert.equal(review.dominated.length, 1);
    assert.equal(review.dominated[0].site.id, 'daleko');
    assert.equal(review.dominated[0].dominatedBy, 'blisko');
  });

  it('samo gorsze niebo nie wystarczy do złożenia, gdy miejsce jest bliżej', () => {
    // Bliższe ma gorsze niebo — nie jest zdominowane, bo wygrywa odległością.
    const [review] = reviewNights(input([near(), far()], [20, 0]));
    assert.ok(review.go.some((o) => o.site.id === 'blisko'));
  });

  it('zdominowane wraca na listę, gdy tylko stamtąd widać jakiś cel', () => {
    // Dalsze ma gorszą pogodę, ale znacznie ciemniejsze niebo, więc pokazuje
    // obiekty, których bliżej nie widać — ocena nocy tego nie mierzy.
    const dark = site('ciemne', { lat: 49.57, lon: 19.35, bortle: 2 });
    const bright = site('jasne', { lat: 50.35, lon: 19.53, bortle: 8 });

    // 24% mieści się jeszcze w progu, ale wystarczy, żeby ocena nieba spadła
    // poniżej bliższego miejsca — inaczej dominacji w ogóle by nie było.
    const [review] = reviewNights(input([bright, dark], [0, 24]));

    const promoted = review.go.find((o) => o.site.id === 'ciemne');
    assert.ok(promoted, 'ciemne miejsce ma zostać pokazane mimo dominacji');
    assert.ok(promoted.uniqueTargets.length > 0, 'z podaniem celów widocznych tylko stamtąd');
    assert.equal(review.dominated.length, 0);
  });

  it('jedno miejsce nigdy nie jest zdominowane', () => {
    const [review] = reviewNights(input([far()], [0]));
    assert.equal(review.go.length, 1);
    assert.equal(review.dominated.length, 0);
  });
});

describe('explainScore', () => {
  it('podaje ocenę nieba i karę za dojazd osobno', () => {
    const far = site('daleko', { lat: 49.57, lon: 19.35 });
    const [review] = reviewNights(input([far], [0]));

    const text = explainScore(review.go[0], DEFAULT_CONFIG);
    assert.match(text, /niebo \d+\/100/);
    assert.match(text, /minus \d+ za \d+ min drogi/);
  });

  it('bez kary mówi tylko o niebie', () => {
    const config = clone();
    config.conditions.travelPenaltyPerHour = 0;

    const [review] = reviewNights(input([site('a')], [0], config));
    assert.match(explainScore(review.go[0], config), /^niebo \d+\/100$/);
  });
});
