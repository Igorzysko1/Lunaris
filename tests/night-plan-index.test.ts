/**
 * Noc liczona pojedynczo daje to samo, co w komplecie.
 *
 * Każda noc ma teraz swoje miejsce — zwycięzcę własnego rankingu — więc noce
 * liczy się po jednej, każdą dla innego punktu. `planNights` wiąże noce ze sobą
 * w jednym miejscu: noce dalsze niż kilka dni są „orientacyjne". Bez numeru
 * nocy przekazanego z zewnątrz każda liczona pojedynczo byłaby pierwszą —
 * i prognoza na pojutrze przestałaby być oznaczona jako niepewna.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_CONFIG } from '../src/lib/config.ts';
import { planNights, type NightPlanInput } from '../src/lib/night-plan.ts';
import type { NightHour, NightSlice } from '../src/lib/weather.ts';

const NIGHT = { from: new Date(2026, 0, 15, 18, 0), to: new Date(2026, 0, 16, 5, 0) };

function hours(): NightHour[] {
  return Array.from({ length: 11 }, (_, i) => ({
    at: new Date(NIGHT.from.getTime() + i * 3_600_000),
    cloud: 0,
    cloudLow: 0,
    cloudMid: 0,
    cloudHigh: 0,
    humidity: 60,
    temperature: 5,
    dewSpread: 6,
    precipitation: 0,
    windGust: 8,
    windSpeed: 5,
    windJet: 20,
    windMid: 20,
    temp850: 0,
    temp500: -20,
    cape: 0,
    boundaryLayerM: 60,
  }));
}

const slice: NightSlice = { night: NIGHT, hours: hours() };

const base: NightPlanInput = {
  nights: [slice],
  target: { lat: 50.35, lon: 19.53 },
  home: null,
  config: DEFAULT_CONFIG,
  bortle: 4,
  walkMinutes: 0,
  nextDay: () => ({ firstEventAt: null, dayOff: true }),
};

describe('numer nocy przy liczeniu pojedynczo', () => {
  it('bez numeru noc jest pierwsza, więc pewna', () => {
    assert.equal(planNights(base)[0].uncertain, false);
  });

  it('noc liczona pojedynczo ma tę samą niepewność, co na swoim miejscu w komplecie', () => {
    const together = planNights({ ...base, nights: [slice, slice, slice] });

    together.forEach((night, index) => {
      assert.equal(
        planNights({ ...base, startIndex: index })[0].uncertain,
        night.uncertain,
        `noc ${index}`,
      );
    });
    // I żeby ten test w ogóle coś sprawdzał: w komplecie jest choć jedna niepewna.
    assert.ok(together.some((night) => night.uncertain));
  });
});
