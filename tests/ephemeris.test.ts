/**
 * Efemerydy sprawdzone drugim, niezależnym rachunkiem.
 *
 * Okno nocy i pory Księżyca liczy `suncalc` — biblioteka szybka i wystarczająca,
 * ale oparta na przybliżeniach szeregowych. Test porównuje jej wynik
 * z `astronomy-engine`, który liczy te same momenty z zupełnie innego modelu
 * (VSOP87/ELP). Zgodność dwóch niezależnych implementacji na konkretnych datach
 * jest mocniejszym dowodem niż liczby przepisane z tabeli, bo nie da się jej
 * uzyskać przez powtórzenie tego samego błędu.
 *
 * Daty są celowo rozrzucone po roku: przesilenia i równonoce to momenty,
 * w których zmierzch astronomiczny zachowuje się skrajnie różnie.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Body, Observer, SearchAltitude, SearchRiseSet } from 'astronomy-engine';

import { moonAt } from '../src/lib/moon.ts';
import { nightWindow } from '../src/lib/night-window.ts';

const BLEDOWSKA = { lat: 50.3518, lon: 19.5276 };
const observer = new Observer(BLEDOWSKA.lat, BLEDOWSKA.lon, 320);

/** Zmierzch astronomiczny: Słońce schodzące przez −18°. */
const ASTRONOMICAL_DEPRESSION = -18;

const minutesBetween = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 60_000;

/**
 * Trzy minuty tolerancji. Rozbieżność dwóch modeli na tym samym zjawisku jest
 * rzędu sekund; próg zostawia zapas na inną wysokość obserwatora i na to, że
 * suncalc nie uwzględnia refrakcji tak samo.
 */
const TOLERANCE_MIN = 3;

const DATES = [
  { label: 'przesilenie zimowe', at: new Date(2026, 11, 21, 12, 0) },
  { label: 'równonoc wiosenna', at: new Date(2026, 2, 20, 12, 0) },
  { label: 'równonoc jesienna', at: new Date(2026, 8, 22, 12, 0) },
  { label: 'zwykła noc listopadowa', at: new Date(2026, 10, 8, 12, 0) },
];

describe('zmierzch astronomiczny zgadza się z drugim modelem', () => {
  for (const { label, at } of DATES) {
    it(label, () => {
      const window = nightWindow(at, BLEDOWSKA);

      // Słońce schodzi przez −18° tego wieczora.
      const dusk = SearchAltitude(Body.Sun, observer, -1, at, 1, ASTRONOMICAL_DEPRESSION);
      assert.ok(dusk, 'astronomy-engine nie znalazł zmierzchu');

      assert.ok(
        minutesBetween(window.from, dusk.date) < TOLERANCE_MIN,
        `${label}: ${window.from.toISOString()} vs ${dusk.date.toISOString()}`,
      );
    });
  }

  it('świt wypada tam, gdzie Słońce wraca nad −18°', () => {
    const at = DATES[0].at;
    const window = nightWindow(at, BLEDOWSKA);
    const dawn = SearchAltitude(Body.Sun, observer, 1, window.from, 1, ASTRONOMICAL_DEPRESSION);

    assert.ok(dawn);
    assert.ok(minutesBetween(window.to, dawn.date) < TOLERANCE_MIN);
  });
});

describe('wschód i zachód Księżyca zgadzają się z drugim modelem', () => {
  // Księżyc rusza się po niebie najszybciej ze wszystkiego, co liczymy, więc
  // rozjazd modeli byłoby tu widać najwcześniej.
  const MOON_TOLERANCE_MIN = 5;

  for (const { label, at } of DATES) {
    it(label, () => {
      const moon = moonAt(at, BLEDOWSKA.lat, BLEDOWSKA.lon);

      // Szukamy od północy tej doby, tak samo jak suncalc.
      const midnight = new Date(at.getFullYear(), at.getMonth(), at.getDate());
      const rise = SearchRiseSet(Body.Moon, observer, 1, midnight, 1);
      const set = SearchRiseSet(Body.Moon, observer, -1, midnight, 1);

      let compared = 0;

      if (moon.rise && rise) {
        compared += 1;
        assert.ok(
          minutesBetween(moon.rise, rise.date) < MOON_TOLERANCE_MIN,
          `wschód: ${moon.rise.toISOString()} vs ${rise.date.toISOString()}`,
        );
      }
      if (moon.set && set) {
        compared += 1;
        assert.ok(
          minutesBetween(moon.set, set.date) < MOON_TOLERANCE_MIN,
          `zachód: ${moon.set.toISOString()} vs ${set.date.toISOString()}`,
        );
      }

      // Bez tego test przeszedłby pusto w dobie, w której Księżyc ani nie
      // wschodzi, ani nie zachodzi — a wtedy nie sprawdzałby niczego.
      assert.ok(compared > 0, 'nie porównano ani wschodu, ani zachodu');
    });
  }

  it('oświetlenie tarczy w pełni i w nowiu zgadza się z fazą', () => {
    // Nów 2026-01-18, pełnia 2026-01-03 — momenty z rachunku faz, nie z tabeli.
    const newMoon = moonAt(new Date(2026, 0, 18, 20, 0), BLEDOWSKA.lat, BLEDOWSKA.lon);
    const full = moonAt(new Date(2026, 0, 3, 20, 0), BLEDOWSKA.lat, BLEDOWSKA.lon);

    assert.ok(newMoon.illumination < 5, `nów: ${newMoon.illumination}%`);
    assert.ok(full.illumination > 95, `pełnia: ${full.illumination}%`);
  });
});
