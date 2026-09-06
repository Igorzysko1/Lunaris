/**
 * Siatka kalendarza Księżyca. Najbardziej boli tu arytmetyka dat, a nie
 * astronomia: luty, rok przestępny i miesiąc zaczynający się w niedzielę to
 * przypadki, w których offset tygodnia łatwo policzyć o dzień za daleko.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { moonAt, moonDay, moonMonth } from '../src/lib/moon.ts';

const KATOWICE = { lat: 50.259, lon: 19.021 };
const inMonthDays = (days: ReturnType<typeof moonMonth>) => days.filter((d) => d.inMonth);

describe('moonMonth', () => {
  it('zawsze zwraca pełne sześć tygodni', () => {
    for (const month of [0, 1, 5, 11]) {
      const days = moonMonth(2026, month, KATOWICE.lat, KATOWICE.lon);
      assert.equal(days.length, 42, `miesiąc ${month} ma ${days.length} pól`);
    }
  });

  it('siatka zaczyna się w poniedziałek', () => {
    for (const month of [0, 1, 5, 11]) {
      const days = moonMonth(2026, month, KATOWICE.lat, KATOWICE.lon);
      assert.equal(days[0].date.getDay(), 1, `miesiąc ${month} zaczyna się nie w poniedziałek`);
    }
  });

  it('luty roku przestępnego ma 29 dni własnych', () => {
    const days = moonMonth(2024, 1, KATOWICE.lat, KATOWICE.lon);
    assert.equal(inMonthDays(days).length, 29);
    assert.equal(inMonthDays(days).at(-1)!.date.getDate(), 29);
  });

  it('luty roku zwykłego ma 28 dni własnych', () => {
    const days = moonMonth(2025, 1, KATOWICE.lat, KATOWICE.lon);
    assert.equal(inMonthDays(days).length, 28);
  });

  it('miesiąc zaczynający się w niedzielę dobija sześć dni z poprzedniego', () => {
    // 1 lutego 2026 wypada w niedzielę — to najgorszy przypadek dla offsetu,
    // bo tydzień zaczyna się u nas w poniedziałek.
    const first = new Date(2026, 1, 1);
    assert.equal(first.getDay(), 0);

    const days = moonMonth(2026, 1, KATOWICE.lat, KATOWICE.lon);
    assert.equal(days[0].date.getMonth(), 0);
    assert.equal(days[0].date.getDate(), 26);
    assert.equal(days.filter((d) => !d.inMonth && d.date.getMonth() === 0).length, 6);
  });

  it('dni idą po kolei, bez dziur i powtórzeń', () => {
    const days = moonMonth(2026, 9, KATOWICE.lat, KATOWICE.lon);
    for (let i = 1; i < days.length; i++) {
      const previous = days[i - 1].date;
      const expected = new Date(previous.getFullYear(), previous.getMonth(), previous.getDate() + 1);
      assert.equal(days[i].date.getTime(), expected.getTime());
    }
  });

  it('każdy dzień zaczyna się o lokalnej północy — także w dobie zmiany czasu', () => {
    const days = moonMonth(2026, 9, KATOWICE.lat, KATOWICE.lon);
    for (const day of days) {
      assert.equal(day.date.getHours(), 0, `${day.date.toISOString()} nie jest północą`);
      assert.equal(day.date.getMinutes(), 0);
    }
  });

  it('grudzień dobija dni ze stycznia następnego roku', () => {
    const days = moonMonth(2026, 11, KATOWICE.lat, KATOWICE.lon);
    const spill = days.filter((d) => !d.inMonth && d.date.getMonth() === 0);
    assert.ok(spill.length > 0);
    assert.equal(spill[0].date.getFullYear(), 2027);
  });

  it('w miesiącu wypada dokładnie jeden nów i jedna pełnia', () => {
    const days = inMonthDays(moonMonth(2026, 2, KATOWICE.lat, KATOWICE.lon));
    assert.equal(days.filter((d) => d.event === 'new').length, 1);
    assert.equal(days.filter((d) => d.event === 'full').length, 1);
  });
});

describe('moonDay', () => {
  it('oświetlenie mieści się w zakresie 0–100, a minimum nie przekracza maksimum', () => {
    const day = moonDay(new Date(2026, 2, 3), KATOWICE.lat, KATOWICE.lon);

    assert.ok(day.illuminationMin >= 0 && day.illuminationMax <= 100);
    assert.ok(day.illuminationMin <= day.illuminationMax);
    assert.ok(day.illuminationMin <= Math.min(day.illuminationFrom, day.illuminationTo));
    assert.ok(day.illuminationMax >= Math.max(day.illuminationFrom, day.illuminationTo));
  });

  it('w dniu pełni tarcza jest oświetlona niemal w całości', () => {
    // Pełnia 3 marca 2026.
    const day = moonDay(new Date(2026, 2, 3), KATOWICE.lat, KATOWICE.lon);
    assert.equal(day.event, 'full');
    assert.ok(day.illuminationMax >= 99, `maks. oświetlenie ${day.illuminationMax}%`);
  });
});

describe('moonAt', () => {
  it('podaje najbliższy nów albo pełnię w opisie', () => {
    const moon = moonAt(new Date(2026, 2, 1, 22, 0), KATOWICE.lat, KATOWICE.lon);
    assert.match(moon.detail, /^(Nów|Pełnia) /);
    assert.ok(moon.illumination >= 0 && moon.illumination <= 100);
    assert.ok(moon.glyph.length > 0);
  });

  it('szuka przesilenia fazy dla dowolnej daty w roku', () => {
    for (let month = 0; month < 12; month++) {
      const moon = moonAt(new Date(2026, month, 1, 12, 0), KATOWICE.lat, KATOWICE.lon);
      assert.ok(moon.name.length > 0, `miesiąc ${month} bez nazwy fazy`);
    }
  });
});
