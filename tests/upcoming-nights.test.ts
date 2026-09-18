/**
 * Odcinanie nocy, które już minęły.
 *
 * Zapis prognozy miejscówek żyje dłużej niż noce, które opisuje. Wczorajszy
 * zapis zaczyna się od wczorajszej nocy — i bez odcięcia zakładka Noc pokazała
 * „minioną noc" zamiast pojutrza, a ranking miejsc liczył się z nocy, której
 * nie da się już wykorzystać.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { upcomingNights, type NightSlice } from '../src/lib/weather.ts';

/** Noc zaczynająca się wieczorem danego dnia września i kończąca rano następnego. */
const nightOf = (day: number): NightSlice => ({
  night: { from: new Date(2026, 8, day, 20, 30), to: new Date(2026, 8, day + 1, 4, 30) },
  hours: [],
});

const days = (slices: NightSlice[]) => slices.map((s) => s.night.from.getDate());

describe('noce, które jeszcze się nie skończyły', () => {
  const cached = [nightOf(17), nightOf(18), nightOf(19)];

  it('wczorajszy zapis w południe: znika wczorajsza noc, zostaje dzisiejsza i dalsze', () => {
    assert.deepEqual(days(upcomingNights(cached, new Date(2026, 8, 18, 12, 0))), [18, 19]);
  });

  it('noc trwająca po północy zostaje — kończy się dopiero o świcie', () => {
    // O drugiej w nocy „dziś w nocy" to wciąż noc, która zaczęła się wczoraj.
    assert.deepEqual(days(upcomingNights(cached, new Date(2026, 8, 18, 2, 0))), [17, 18, 19]);
  });

  it('dokładnie o świcie noc już się skończyła', () => {
    assert.deepEqual(days(upcomingNights(cached, new Date(2026, 8, 18, 4, 30))), [18, 19]);
  });

  it('świeży zapis zostaje nietknięty', () => {
    assert.equal(upcomingNights(cached, new Date(2026, 8, 17, 12, 0)).length, 3);
  });
});
