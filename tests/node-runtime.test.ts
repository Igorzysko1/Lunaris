/**
 * Warstwa domenowa musi dać się uruchomić pod samym Node, bez Metro i bez Babela.
 *
 * Node tylko *zdejmuje* typy — nie kompiluje ich. Składnia, która generuje kod
 * (parametry konstruktora z modyfikatorem, `enum`, przestrzenie nazw), przechodzi
 * przez `tsc --noEmit` i wywala się dopiero przy uruchomieniu. Nie łapały tego
 * pozostałe testy, bo importowały z tych modułów wyłącznie typy, a te znikają
 * przed wykonaniem. Ten plik importuje je naprawdę.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('moduły domenowe ładują się pod Node', () => {
  it('weather.ts — używa go skrypt check-weather', async () => {
    const weather = await import('../src/lib/weather.ts');
    assert.equal(typeof weather.fetchNightForecast, 'function');
    assert.equal(typeof weather.fetchUpcomingNights, 'function');

    const error = new weather.ForecastError('offline', 'test');
    assert.equal(error.kind, 'offline');
    assert.ok(error instanceof Error);
  });

  it('session-engine.ts, sky-targets.ts, events.ts', async () => {
    const engine = await import('../src/lib/session-engine.ts');
    const targets = await import('../src/lib/sky-targets.ts');
    const events = await import('../src/lib/events.ts');

    assert.equal(typeof engine.evaluateNight, 'function');
    assert.equal(typeof targets.nightTargetsForProfiles, 'function');
    assert.equal(typeof events.upcomingEvents, 'function');
  });

  it('planetary-events.ts i katalogi danych', async () => {
    const planets = await import('../src/lib/planetary-events.ts');
    const sites = await import('../src/data/observing-sites.ts');
    const deepSky = await import('../src/data/deep-sky.ts');

    assert.ok(sites.DEFAULT_SITES.length > 0);
    assert.ok(deepSky.DEEP_SKY_OBJECTS.length > 0);
    assert.equal(typeof planets, 'object');
  });
});
