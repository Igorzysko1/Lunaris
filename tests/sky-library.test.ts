/**
 * Biblioteki: gwiazdozbiór obiektu z granic IAU, zasięg zestawu wspólny
 * z listą celów, najlepszy miesiąc, górowanie, obrót figury i lista prognoz
 * w pamięci.
 *
 * Najważniejsza jest zgodność zasięgu: biblioteka i Niebo muszą mówić to samo
 * o tym samym obiekcie i zestawie — inaczej „w zasięgu" w bibliotece
 * i „poza zasięgiem" w Niebie przeczyłyby sobie przy tym samym sprzęcie.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEEP_SKY_OBJECTS } from '../src/data/deep-sky.ts';
import { serialize, summarizeForecasts } from '../src/lib/forecast-cache.ts';
import { DEFAULT_OPTICS } from '../src/lib/optics.ts';
import {
  bestMonth,
  constellationOf,
  culminationAltitude,
  describeBestMonth,
  describeCulmination,
  describeFieldShare,
  describeLibraryReach,
  fieldShare,
  foldForSearch,
  objectsInConstellation,
  skyOrientation,
} from '../src/lib/sky-library.ts';
import {
  libraryReach,
  libraryReachLevel,
  nightTargetsForProfiles,
  type ReachLevel,
} from '../src/lib/sky-targets.ts';

const dso = (id: string) => DEEP_SKY_OBJECTS.find((o) => o.id === id)!;

describe('gwiazdozbiór obiektu', () => {
  it('z granic IAU, a nie z wpisu w katalogu', () => {
    assert.equal(constellationOf(dso('m31'))?.id, 'and');
    assert.equal(constellationOf(dso('m42'))?.id, 'ori');
    assert.equal(constellationOf(dso('m13'))?.id, 'her');
  });

  it('biblioteki linkują się nawzajem: M31 stoi wśród obiektów Andromedy', () => {
    assert.ok(objectsInConstellation('and').some((o) => o.id === 'm31'));
  });

  it('szukanie bez ogonków', () => {
    assert.equal(foldForSearch('Łabędź'), 'labedz');
  });
});

describe('zasięg zestawu', () => {
  it('biblioteka mówi o sprzęcie to samo co lista celów w Niebie', () => {
    const night = { from: new Date(2026, 0, 16, 18, 0), to: new Date(2026, 0, 17, 6, 0) };
    const coords = { lat: 50.35, lon: 19.53 };
    const optics = DEFAULT_OPTICS;

    const targets = nightTargetsForProfiles(night, coords, [{ id: 't', label: '', optics }], 5);
    const compared = targets.filter((t) => t.kind === 'dso' && t.outOfReach !== 'too-low');

    assert.ok(compared.length > 20);
    for (const target of compared) {
      assert.equal(libraryReach(dso(target.id), optics, 5), target.outOfReach, target.id);
    }
  });

  it('powód z liczbą, od której zależy', () => {
    assert.match(
      describeLibraryReach(null, DEFAULT_OPTICS, 4),
      /^w zasięgu — ten zestaw sięga \d+,\d mag$/,
    );
    assert.match(
      describeLibraryReach('too-small', DEFAULT_OPTICS, 4),
      /^za mały przy powiększeniu 15×/,
    );
  });
});

describe('zasięg trzystanowy', () => {
  const WORSE: Record<ReachLevel, number> = { in: 0, marginal: 1, out: 2 };

  it('„poza" znaczy dokładnie to, co werdykt dwustanowy', () => {
    // Trzeci stan jest doróbką w środku, a nie nową granicą: gdyby przesuwał
    // brzeg, biblioteka i lista celów przestałyby mówić o sprzęcie jedno.
    for (const object of DEEP_SKY_OBJECTS) {
      assert.equal(
        libraryReachLevel(object, DEFAULT_OPTICS, 5) === 'out',
        libraryReach(object, DEFAULT_OPTICS, 5) !== null,
        object.id,
      );
    }
  });

  it('pogorszenie nieba nigdy nie poprawia zasięgu', () => {
    for (const object of DEEP_SKY_OBJECTS) {
      let worst = 0;

      for (let bortle = 1; bortle <= 9; bortle++) {
        const level = WORSE[libraryReachLevel(object, DEFAULT_OPTICS, bortle)];
        assert.ok(level >= worst, `${object.id} pod Bortle ${bortle}`);
        worst = level;
      }
    }
  });

  it('stan graniczny w ogóle występuje', () => {
    // Bez tego próg mógłby być tak ciasny albo tak szeroki, że trzeci stan
    // byłby martwy, a oba testy wyżej i tak by przeszły.
    const marginal = DEEP_SKY_OBJECTS.filter((o) =>
      [4, 5, 6].some((bortle) => libraryReachLevel(o, DEFAULT_OPTICS, bortle) === 'marginal'),
    );

    assert.ok(marginal.length > 0);
  });
});

describe('kiedy i jak wysoko', () => {
  it('najlepszy miesiąc: M42 w grudniu, M31 w październiku', () => {
    assert.equal(bestMonth(dso('m42').raHours, 2026), 11);
    assert.equal(bestMonth(dso('m31').raHours, 2026), 9);
    assert.equal(
      describeBestMonth(9),
      'Najlepszy miesiąc: październik — wtedy góruje około północy.',
    );
  });

  it('górowanie i obiekt, który stąd nie wschodzi', () => {
    assert.equal(Math.round(culminationAltitude(41.27, 50)), 81);
    assert.equal(
      describeCulmination(culminationAltitude(-60, 50), 'Zawoja'),
      'Stąd nie wschodzi nad horyzont — liczone dla: Zawoja.',
    );
  });

  it('rozmiar w polu widzenia', () => {
    assert.equal(
      describeFieldShare(fieldShare(300, 4.4), 4.4, 'Lornetka'),
      'Nie mieści się w polu 4,4° (Lornetka).',
    );
    assert.equal(
      describeFieldShare(fieldShare(20, 4.4), 4.4, 'Lornetka'),
      '8% średnicy pola 4,4° (Lornetka).',
    );
  });

  it('w górowaniu figura stoi bez obrotu, a wysokość równa się górowaniu', () => {
    const coords = { lat: 50, lon: 19.5 };
    const vega = { raHours: 18.62, dec: 38.78 };
    const day = new Date(2026, 8, 15, 12, 0);

    let highest = { altitude: -90, rotation: 0 };
    for (let minute = 0; minute < 24 * 60; minute += 5) {
      const sample = skyOrientation(vega, coords, new Date(day.getTime() + minute * 60_000));
      if (sample.altitude > highest.altitude) highest = sample;
    }

    assert.ok(Math.abs(highest.altitude - culminationAltitude(vega.dec, coords.lat)) < 1);
    assert.ok(Math.abs(highest.rotation) < 3, String(highest.rotation));
  });
});

describe('prognozy w pamięci', () => {
  it('lista z kluczy zapisu: miejsce, wiek, bez przeterminowanych, najnowsze pierwsze', () => {
    const now = new Date(2026, 8, 15, 20, 0);
    const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

    const list = summarizeForecasts(
      [
        ['lunaris.forecast.night.49.65,19.55', serialize({ a: 1 }, hoursAgo(3))],
        ['lunaris.forecast.site.50.35,19.53', serialize({ a: 1 }, hoursAgo(30))],
        ['lunaris.forecast.site.50.10,19.00', serialize({ a: 1 }, hoursAgo(90))],
        ['lunaris.settings', '{}'],
      ],
      now,
    );

    assert.deepEqual(
      list.map((f) => [f.scope, f.coords.lat, f.stale]),
      [
        ['night', 49.65, false],
        ['site', 50.35, true],
      ],
    );
  });
});
