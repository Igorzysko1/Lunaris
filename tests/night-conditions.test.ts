/**
 * Noc › Warunki: wykres chmur, wilgotność, rosa i karta seeingu.
 *
 * Pilnujemy dwóch rzeczy. Zaznaczone okno ma leżeć dokładnie na godzinach, na
 * których padł werdykt — inaczej wykres przeczy karcie nad nim. A karta
 * seeingu ma się pokazywać tylko tam, gdzie seeing może cokolwiek ograniczyć.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_CONFIG } from '../src/lib/config.ts';
import { nightConditions, seeingProfile } from '../src/lib/night-conditions.ts';
import { planNights } from '../src/lib/night-plan.ts';
import { DEFAULT_OPTICS } from '../src/lib/optics.ts';
import { seeingCanLimit } from '../src/lib/seeing.ts';
import { describeDew, type Narration } from '../src/lib/session-text.ts';
import type { NightHour, NightSlice } from '../src/lib/weather.ts';
import { CLEAR_NIGHT, CLOUDY_NIGHT } from './fixtures/nights.ts';

const SITE = { lat: 50.35, lon: 19.53 };

const text = (narration: Narration) => narration.map(([part]) => part).join('');

function verdictOf(slice: NightSlice) {
  const [planned] = planNights({
    nights: [slice],
    target: SITE,
    home: null,
    config: DEFAULT_CONFIG,
    bortle: 4,
    walkMinutes: 0,
  });
  return planned.verdict;
}

function reshape(slice: NightSlice, shape: (hour: NightHour, index: number) => Partial<NightHour>) {
  return { ...slice, hours: slice.hours.map((hour, i) => ({ ...hour, ...shape(hour, i) })) };
}

describe('warunki nocy', () => {
  it('okno na wykresie leży na godzinach, na których padł werdykt', () => {
    const verdict = verdictOf(CLEAR_NIGHT);
    const conditions = nightConditions(CLEAR_NIGHT, verdict, DEFAULT_CONFIG);
    const [first, last] = conditions.window!;

    assert.equal(conditions.hours.length, CLEAR_NIGHT.hours.length);
    assert.equal(conditions.hours[first].at.getTime(), verdict.window!.from.getTime());
    assert.ok(conditions.hours[last].at <= verdict.window!.to);
    assert.ok(
      last === conditions.hours.length - 1 || conditions.hours[last + 1].at > verdict.window!.to,
    );
  });

  it('noc bez okna liczy wilgotność i rosę z całej nocy', () => {
    const conditions = nightConditions(CLOUDY_NIGHT, verdictOf(CLOUDY_NIGHT), DEFAULT_CONFIG);

    assert.equal(conditions.window, null);
    assert.equal(conditions.humidity, 95);
    assert.equal(conditions.dewPoint, 7.5);
    assert.equal(conditions.dewFrom?.getTime(), CLOUDY_NIGHT.hours[0].at.getTime());
  });

  it('opady liczą się z całej nocy, także przed oknem', () => {
    const wet = reshape(CLEAR_NIGHT, (_, i) => (i === 0 ? { precipitation: 0.4 } : {}));
    const conditions = nightConditions(wet, verdictOf(wet), DEFAULT_CONFIG);

    assert.equal(conditions.precipitation, 0.4);
    assert.ok(conditions.window![0] > 0, 'deszczowa godzina nie wchodzi do okna');
  });
});

describe('rosa', () => {
  it('bez przekroczenia progu nie straszy', () => {
    const conditions = nightConditions(CLEAR_NIGHT, verdictOf(CLEAR_NIGHT), DEFAULT_CONFIG);

    assert.equal(conditions.dewFrom, null);
    assert.equal(
      text(describeDew(conditions)!),
      'Zapas 4,0 K nad punktem rosy, minimum 8,0 °C — rosa nie powinna osiąść.',
    );
  });

  it('podaje godzinę, od której szkło zaparuje', () => {
    const damp = reshape(CLEAR_NIGHT, (_, i) => ({ dewSpread: i >= 3 ? 1.5 : 4 }));
    const conditions = nightConditions(damp, verdictOf(damp), DEFAULT_CONFIG);

    assert.equal(conditions.dewFrom?.getTime(), damp.hours[3].at.getTime());
    assert.match(text(describeDew(conditions)!), /szkło zaparuje około 21:00\.$/);
  });
});

describe('karta seeingu', () => {
  const binoculars = { id: 'bino', label: 'Lornetka 15x70', optics: DEFAULT_OPTICS };
  const telescope = {
    id: 'sct',
    label: 'SCT 8″',
    optics: { ...DEFAULT_OPTICS, aperture: 203, magnification: 81, fieldOfView: 0.6 },
  };

  it('lornetce seeing nie odbiera niczego', () => {
    assert.equal(seeingCanLimit(15), false);
    assert.equal(seeingCanLimit(81), true);
    assert.equal(seeingProfile([binoculars]), null);
  });

  it('przy kilku zestawach bierze ten o największym powiększeniu', () => {
    assert.equal(seeingProfile([binoculars, telescope])?.id, 'sct');
  });
});
