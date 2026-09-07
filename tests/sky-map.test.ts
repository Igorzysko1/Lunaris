/**
 * Mapa jasności nieba. Najważniejsze jest jedno: aplikacja i generator bazy
 * miejscowości muszą dawać dla tego samego punktu ten sam wynik. Rozjechanie
 * się ich znaczyłoby, że dwa ekrany tej samej aplikacji mówią o tym samym
 * miejscu co innego — a takiej różnicy nie widać, dopóki ktoś nie porówna.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CITIES, GMINY } from '../src/data/places.generated.ts';
import { bortleFromSkyBrightness, skyBrightnessAt, skyQualityAt } from '../src/lib/sky-map.ts';
import { bortleFromSkyBrightness as referenceThresholds } from '../scripts/world-atlas.ts';

const BLEDOWSKA = { lat: 50.35, lon: 19.53 };

describe('skyBrightnessAt', () => {
  it('zwraca jasność dla punktu wewnątrz obszaru', () => {
    const mpsas = skyBrightnessAt(BLEDOWSKA.lat, BLEDOWSKA.lon);

    assert.ok(mpsas !== null);
    // Cała Polska mieści się między niebem miejskim a niemal naturalnym.
    assert.ok(mpsas > 17 && mpsas < 22, `mpsas = ${mpsas}`);
  });

  it('poza obszarem mówi „nie wiem", zamiast zmyślać', () => {
    assert.equal(skyBrightnessAt(52.23, 21.01), null, 'Warszawa jest poza wgraną mapą');
    assert.equal(skyBrightnessAt(0, 0), null);
  });

  it('sąsiednie punkty różnią się niewiele — siatka nie jest przesunięta', () => {
    // Przesunięcie siatki o komórkę objawiłoby się skokami między sąsiadami.
    const step = 1 / 120;
    let maxJump = 0;

    for (let i = 0; i < 200; i++) {
      const lat = 49.5 + i * step;
      const a = skyBrightnessAt(lat, 19.5);
      const b = skyBrightnessAt(lat + step, 19.5);
      if (a === null || b === null) continue;
      maxJump = Math.max(maxJump, Math.abs(a - b));
    }

    assert.ok(maxJump < 1, `największy skok między sąsiadami: ${maxJump.toFixed(2)} mag`);
  });
});

describe('zgodność z generatorem bazy miejscowości', () => {
  it('progi Bortle są identyczne po obu stronach', () => {
    // Obie listy są przepisane osobno, bo generator korzysta z node:zlib
    // i nie da się go zaimportować w aplikacji.
    for (let mpsas = 16; mpsas <= 23; mpsas += 0.01) {
      const value = Math.round(mpsas * 100) / 100;
      assert.equal(
        bortleFromSkyBrightness(value),
        referenceThresholds(value),
        `próg rozjechał się przy ${value} mag`,
      );
    }
  });

  it('każda miejscowość w obszarze mapy dostaje to samo Bortle co w bazie', () => {
    const all = [...CITIES, ...GMINY];
    const checked = all.filter((p) => skyBrightnessAt(p.lat, p.lon) !== null);
    const wrong = checked.filter((p) => skyQualityAt(p.lat, p.lon, -1).bortle !== p.bortle);

    assert.ok(checked.length > 500, `w obszarze mapy jest tylko ${checked.length} miejscowości`);
    assert.deepEqual(
      wrong.map((p) => `${p.name}: mapa ≠ baza`),
      [],
    );
  });
});

describe('skyQualityAt', () => {
  it('punkt z mapy ma pierwszeństwo przed wartością zapasową', () => {
    const quality = skyQualityAt(BLEDOWSKA.lat, BLEDOWSKA.lon, 9);

    assert.equal(quality.source, 'map');
    assert.notEqual(quality.bortle, 9);
    assert.ok(quality.mpsas !== null);
  });

  it('poza mapą dziedziczy podaną wartość i mówi o tym wprost', () => {
    const quality = skyQualityAt(52.23, 21.01, 6);

    assert.equal(quality.source, 'nearest');
    assert.equal(quality.bortle, 6);
    assert.equal(quality.mpsas, null);
  });

  it('Bortle mieści się w skali', () => {
    for (const lat of [49.2, 50.0, 50.9]) {
      for (const lon of [17.2, 19.5, 21.8]) {
        const { bortle } = skyQualityAt(lat, lon, 4);
        assert.ok(bortle >= 1 && bortle <= 9, `${lat},${lon} -> ${bortle}`);
      }
    }
  });

  it('pustynia jest ciemniejsza niż środek Katowic', () => {
    const desert = skyQualityAt(BLEDOWSKA.lat, BLEDOWSKA.lon, 4);
    const city = skyQualityAt(50.2649, 19.0238, 4);

    assert.ok(desert.bortle < city.bortle, `pustynia ${desert.bortle}, miasto ${city.bortle}`);
  });
});
