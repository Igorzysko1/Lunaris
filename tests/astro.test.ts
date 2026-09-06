/**
 * Ocena nocy i geometria odległości.
 *
 * `computeNightRating` jest funkcją czystą o arbitralnych wagach — testy nie
 * sprawdzają, czy wagi są „dobre" (to rozstrzyga kalibracja na obserwacjach),
 * tylko czy rachunek trzyma się swoich własnych zasad: nie wychodzi poza 0–100,
 * reaguje monotonicznie i nie karze wilgotności poniżej progu.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeNightRating, distanceKm, formatDistance } from '../src/lib/astro.ts';
import { CITIES, nearestPlace } from '../src/data/places.ts';

const perfect = {
  avgCloud: 0,
  avgHumidity: 0,
  precipitation: 0,
  moonIllumination: 0,
  bortle: 1,
};

describe('computeNightRating', () => {
  it('daje 100 dla nocy bez wad', () => {
    assert.equal(computeNightRating(perfect), 100);
  });

  it('nie schodzi poniżej zera przy wszystkich karach naraz', () => {
    const worst = computeNightRating({
      avgCloud: 100,
      avgHumidity: 100,
      precipitation: 10,
      moonIllumination: 100,
      bortle: 9,
    });
    assert.equal(worst, 0);
  });

  it('samo 100% zachmurzenia zabiera 60 punktów', () => {
    assert.equal(computeNightRating({ ...perfect, avgCloud: 100 }), 40);
  });

  it('nie karze wilgotności poniżej 70%', () => {
    const dry = computeNightRating({ ...perfect, avgHumidity: 40 });
    const atThreshold = computeNightRating({ ...perfect, avgHumidity: 70 });
    assert.equal(dry, 100);
    assert.equal(atThreshold, 100);
  });

  it('kara za opad jest ograniczona — ulewa nie jest gorsza od mżawki', () => {
    const drizzle = computeNightRating({ ...perfect, precipitation: 1 });
    const downpour = computeNightRating({ ...perfect, precipitation: 50 });
    assert.equal(drizzle, downpour);
    assert.equal(drizzle, 90);
  });

  it('Bortle 9 kosztuje 16 punktów względem Bortle 1', () => {
    assert.equal(computeNightRating({ ...perfect, bortle: 9 }), 84);
  });

  it('jest monotoniczna względem zachmurzenia', () => {
    let previous = Infinity;
    for (let cloud = 0; cloud <= 100; cloud += 10) {
      const score = computeNightRating({ ...perfect, avgCloud: cloud });
      assert.ok(score <= previous, `zachmurzenie ${cloud}% podniosło ocenę`);
      previous = score;
    }
  });

  it('zwraca liczbę całkowitą', () => {
    const score = computeNightRating({ ...perfect, avgCloud: 33, avgHumidity: 81 });
    assert.equal(score, Math.round(score));
  });
});

describe('distanceKm', () => {
  it('odległość punktu od siebie samego wynosi zero', () => {
    const point = { lat: 50.259, lon: 19.021 };
    assert.equal(distanceKm(point, point), 0);
  });

  it('Warszawa – Kraków to około 252 km', () => {
    const warsaw = { lat: 52.2297, lon: 21.0122 };
    const krakow = { lat: 50.0647, lon: 19.945 };
    assert.ok(Math.abs(distanceKm(warsaw, krakow) - 252) < 2);
  });

  it('jest symetryczna', () => {
    const a = { lat: 54.352, lon: 18.6466 };
    const b = { lat: 49.6212, lon: 20.6969 };
    assert.equal(distanceKm(a, b), distanceKm(b, a));
  });

  it('stopień szerokości geograficznej to około 111 km', () => {
    const distance = distanceKm({ lat: 50, lon: 20 }, { lat: 51, lon: 20 });
    assert.ok(Math.abs(distance - 111.2) < 0.5);
  });
});

describe('formatDistance', () => {
  it('poniżej kilometra mówi „tu jesteś"', () => {
    assert.equal(formatDistance(0.4), 'tu jesteś');
  });

  it('blisko podaje dziesiąte części kilometra', () => {
    assert.equal(formatDistance(3.14), '3.1 km');
  });

  it('daleko zaokrągla do pełnych kilometrów', () => {
    assert.equal(formatDistance(42.6), '43 km');
  });
});

describe('nearestPlace', () => {
  it('dla współrzędnych miejscowości zwraca tę samą miejscowość', () => {
    const city = CITIES[0];
    assert.equal(nearestPlace({ lat: city.lat, lon: city.lon }).id, city.id);
  });

  it('dla punktu tuż obok wciąż zwraca tę miejscowość', () => {
    const city = CITIES[0];
    const nearby = { lat: city.lat + 0.002, lon: city.lon + 0.002 };
    assert.equal(nearestPlace(nearby).id, city.id);
  });

  it('zawsze coś zwraca — także dla punktu poza Polską', () => {
    const place = nearestPlace({ lat: 41.9, lon: 12.5 });
    assert.ok(place.id.length > 0);
    assert.ok(place.bortle >= 1 && place.bortle <= 9);
  });
});
