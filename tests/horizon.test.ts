/**
 * Maska horyzontu. Reguła, która niesie tu najwięcej: ręczna korekta bije
 * policzoną maskę, a brak jednego i drugiego oznacza próg zapasowy — czyli
 * dokładnie to zachowanie, które obowiązywało wcześniej wszędzie.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_HORIZON,
  compassLabel,
  horizonAt,
  horizonOf,
  isValidMask,
} from '../src/lib/horizon.ts';

/** Maska „las na południu do 20°, reszta czysta do 2°". */
const forestSouth = Array.from({ length: 360 }, (_, az) => (az >= 150 && az <= 210 ? 20 : 2));

describe('horizonAt', () => {
  it('bez maski i bez korekt obowiązuje próg zapasowy', () => {
    assert.deepEqual(horizonAt(180, null), { altitude: DEFAULT_HORIZON, fromTerrain: false });
    assert.deepEqual(horizonAt(0, null), { altitude: DEFAULT_HORIZON, fromTerrain: false });
  });

  it('maska daje różne wysokości dla różnych kierunków', () => {
    assert.deepEqual(horizonAt(180, forestSouth), { altitude: 20, fromTerrain: true });
    assert.deepEqual(horizonAt(0, forestSouth), { altitude: 2, fromTerrain: true });
  });

  it('azymut jest zawijany, a nie wychodzi poza tablicę', () => {
    assert.deepEqual(horizonAt(360, forestSouth), horizonAt(0, forestSouth));
    assert.deepEqual(horizonAt(-180, forestSouth), horizonAt(180, forestSouth));
    assert.deepEqual(horizonAt(725, forestSouth), horizonAt(5, forestSouth));
  });

  it('maska niepełna jest odrzucana — częściowa byłaby gorsza od braku', () => {
    assert.deepEqual(horizonAt(10, [1, 2, 3]), { altitude: DEFAULT_HORIZON, fromTerrain: false });
  });

  it('ręczna korekta bije policzoną maskę', () => {
    const override = [{ from: 170, to: 190, altitude: 35 }];

    assert.deepEqual(horizonAt(180, forestSouth, override), { altitude: 35, fromTerrain: true });
    // Poza sektorem korekty maska obowiązuje dalej.
    assert.deepEqual(horizonAt(160, forestSouth, override), { altitude: 20, fromTerrain: true });
  });

  it('korekta działa też bez policzonej maski', () => {
    assert.deepEqual(horizonAt(180, null, [{ from: 170, to: 190, altitude: 30 }]), {
      altitude: 30,
      fromTerrain: true,
    });
    assert.deepEqual(horizonAt(0, null, [{ from: 170, to: 190, altitude: 30 }]), {
      altitude: DEFAULT_HORIZON,
      fromTerrain: false,
    });
  });

  it('korekta może przechodzić przez północ', () => {
    const override = [{ from: 350, to: 20, altitude: 25 }];

    assert.deepEqual(horizonAt(355, forestSouth, override), { altitude: 25, fromTerrain: true });
    assert.deepEqual(horizonAt(10, forestSouth, override), { altitude: 25, fromTerrain: true });
    assert.deepEqual(horizonAt(100, forestSouth, override), { altitude: 2, fromTerrain: true });
  });

  it('przy nakładających się korektach wygrywa wyższa', () => {
    const overrides = [
      { from: 100, to: 200, altitude: 10 },
      { from: 150, to: 250, altitude: 30 },
    ];

    // Przy niepewności bierzemy wartość gorszą: lepiej nie obiecać celu,
    // niż obiecać niewidoczny.
    assert.deepEqual(horizonAt(180, null, overrides), { altitude: 30, fromTerrain: true });
    assert.deepEqual(horizonAt(120, null, overrides), { altitude: 10, fromTerrain: true });
  });
});

describe('horizonOf', () => {
  it('zwraca gotową funkcję dla miejsca', () => {
    const horizon = horizonOf(forestSouth, [{ from: 0, to: 10, altitude: 40 }]);

    assert.equal(horizon(5).altitude, 40);
    assert.equal(horizon(180).altitude, 20);
    assert.equal(horizon(90).altitude, 2);
    assert.equal(horizon(90).fromTerrain, true);
  });
});

describe('isValidMask', () => {
  it('przyjmuje tylko kompletne, sensowne maski', () => {
    assert.equal(isValidMask(forestSouth), true);
    assert.equal(isValidMask(null), false);
    assert.equal(isValidMask([]), false);
    assert.equal(isValidMask(Array(359).fill(5)), false);
    assert.equal(isValidMask(Array(360).fill(NaN)), false);
    assert.equal(isValidMask(Array(360).fill(120)), false);
  });
});

describe('compassLabel', () => {
  it('nazywa kierunki świata', () => {
    assert.equal(compassLabel(0), 'N');
    assert.equal(compassLabel(90), 'E');
    assert.equal(compassLabel(180), 'S');
    assert.equal(compassLabel(225), 'SW');
    assert.equal(compassLabel(359), 'N');
  });
});
