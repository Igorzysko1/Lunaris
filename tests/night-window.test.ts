/**
 * Okno nocy. Testy zakładają strefę Europe/Warsaw — ustawia ją skrypt `npm test`,
 * bo cały moduł operuje na czasie lokalnym i bez ustalonej strefy wyniki
 * zależałyby od maszyny.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  currentNightWindow,
  nightDaysBefore,
  nightWindow,
  sampleNight,
} from '../src/lib/night-window.ts';

const KATOWICE = { lat: 50.259, lon: 19.021 };
const LONGYEARBYEN = { lat: 78.22, lon: 15.65 };

const HOUR_MS = 3_600_000;
const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

describe('nightWindow', () => {
  it('noc zaczyna się wieczorem podanego dnia i kończy nad ranem następnego', () => {
    const window = nightWindow(new Date(2026, 0, 15), KATOWICE);

    assert.equal(window.from.getDate(), 15);
    assert.equal(window.to.getDate(), 16);
    assert.ok(window.from.getHours() >= 17, `zmierzch o ${window.from.getHours()}`);
    assert.ok(window.to.getHours() <= 8, `świt o ${window.to.getHours()}`);
  });

  it('przechodzi przez północ — koniec zawsze po początku', () => {
    for (let day = 1; day <= 28; day++) {
      const window = nightWindow(new Date(2026, 2, day), KATOWICE);
      assert.ok(window.to > window.from, `noc ${day} marca kończy się przed początkiem`);
      assert.ok(window.to.getTime() - window.from.getTime() < 24 * HOUR_MS);
    }
  });

  it('w czerwcu, gdy noc astronomiczna nie zapada, schodzi na zmierzch nawigacyjny', () => {
    // W Polsce od maja do lipca Słońce nie schodzi 18° pod horyzont, więc
    // suncalc nie zwraca `night` — okno musi mimo to istnieć.
    const window = nightWindow(new Date(2026, 5, 21), KATOWICE);

    assert.ok(!Number.isNaN(window.from.getTime()));
    assert.ok(window.to > window.from);
    // Zmierzch nawigacyjny późnym czerwcem wypada koło 23:00.
    assert.ok(window.from.getHours() >= 22, `zmierzch o ${window.from.getHours()}`);
  });

  it('za kołem podbiegunowym w dzień polarny bierze umowne 22–04', () => {
    const window = nightWindow(new Date(2026, 5, 21), LONGYEARBYEN);

    assert.equal(window.from.getHours(), 22);
    assert.equal(window.to.getTime() - window.from.getTime(), 6 * HOUR_MS);
  });

  it('noc ze zmianą czasu na zimowy nie gubi ani nie dokłada godziny', () => {
    // Ostatnia niedziela października 2026 wypada 25-go: nad ranem zegar cofa się
    // z 3:00 na 2:00. Okno jest liczone na czasie lokalnym, więc gdyby arytmetyka
    // dat gubiła przesunięcie, noc wyszłaby o godzinę za długa albo za krótka.
    const before = nightWindow(new Date(2026, 9, 23), KATOWICE);
    const dstNight = nightWindow(new Date(2026, 9, 24), KATOWICE);
    const after = nightWindow(new Date(2026, 9, 25), KATOWICE);

    assert.equal(dstNight.from.getDate(), 24);
    assert.equal(dstNight.to.getDate(), 25);
    assert.ok(dstNight.to > dstNight.from);

    // Rzeczywisty czas trwania nocy zmienia się z dnia na dzień o minuty, nie
    // o godzinę — przestawienie zegara nie jest zdarzeniem astronomicznym.
    const lengths = [before, dstNight, after].map((w) => w.to.getTime() - w.from.getTime());
    assert.ok(
      Math.abs(lengths[1] - lengths[0]) < 15 * 60_000,
      `noc zmiany czasu różni się o ${(lengths[1] - lengths[0]) / 60_000} min`,
    );
    assert.ok(Math.abs(lengths[2] - lengths[1]) < 15 * 60_000);

    // Noc zaczynająca się w samą dobę przestawienia zegara też ma kończyć się
    // nazajutrz. Dodawanie 24 godzin dawało tu koniec nad ranem tego samego dnia,
    // czyli okno o ujemnej długości i „brak danych" w prognozie.
    assert.equal(after.from.getDate(), 25);
    assert.equal(after.to.getDate(), 26);
    assert.ok(after.to > after.from);
  });
});

describe('currentNightWindow', () => {
  it('o drugiej w nocy zwraca noc, która zaczęła się poprzedniego wieczora', () => {
    const now = new Date(2026, 0, 16, 2, 0);
    const window = currentNightWindow(now, KATOWICE);

    assert.equal(window.from.getDate(), 15);
    assert.ok(window.from < now && now < window.to);
  });

  it('po zmierzchu zwraca noc zaczynającą się tego wieczora', () => {
    const now = new Date(2026, 0, 15, 21, 0);
    const window = currentNightWindow(now, KATOWICE);

    assert.equal(window.from.getDate(), 15);
  });

  it('po świcie, a przed zmierzchem, patrzy już na noc nadchodzącą', () => {
    const now = new Date(2026, 0, 15, 12, 0);
    const window = currentNightWindow(now, KATOWICE);

    assert.equal(window.from.getDate(), 15);
    assert.ok(window.from > now);
  });
});

describe('sampleNight', () => {
  it('próbkuje co 15 minut, z obiema granicami włącznie', () => {
    const from = new Date(2026, 0, 15, 22, 0);
    const to = new Date(2026, 0, 16, 0, 0);
    const samples = sampleNight({ from, to });

    assert.equal(samples.length, 9);
    assert.equal(samples[0].getTime(), from.getTime());
    assert.equal(samples.at(-1)!.getTime(), to.getTime());
    assert.equal(minutesBetween(samples[0], samples[1]), 15);
  });

  it('okno zerowej długości daje jedną próbkę', () => {
    const at = new Date(2026, 0, 15, 22, 0);
    assert.equal(sampleNight({ from: at, to: at }).length, 1);
  });
});

describe('nightDaysBefore', () => {
  it('cofa o zadaną liczbę dób', () => {
    const night = nightWindow(new Date(2026, 8, 9), KATOWICE);
    const earlier = nightDaysBefore(night, KATOWICE, 1);

    assert.equal(earlier.from.getDate(), 8);
    // Zmierzch przesuwa się przez rok, więc godzina nie musi być ta sama —
    // ale różnica ma być rzędu minut, nie godzin.
    assert.ok(Math.abs(minutesBetween(earlier.from, night.from) - 24 * 60) < 20);
  });

  it('zero i wartości ujemne zostawiają noc bez zmian', () => {
    const night = nightWindow(new Date(2026, 8, 9), KATOWICE);

    assert.deepEqual(nightDaysBefore(night, KATOWICE, 0), night);
    assert.deepEqual(nightDaysBefore(night, KATOWICE, -3), night);
  });

  it('doba zmiany czasu nie gubi ani nie dubluje nocy', () => {
    // W Polsce czas zmienia się w ostatnią niedzielę października — ta doba ma
    // 25 godzin. Odejmowanie 24 godzin zamiast doby kalendarzowej zostawiłoby
    // tu tę samą datę i noc przepadłaby przy cofaniu.
    const after = nightWindow(new Date(2026, 9, 26), KATOWICE);
    const dates = [1, 2, 3].map((back) => nightDaysBefore(after, KATOWICE, back).from.getDate());

    assert.deepEqual(dates, [25, 24, 23]);
  });

  it('cofanie krok po kroku daje to samo co skok o kilka dób', () => {
    const night = nightWindow(new Date(2026, 8, 9), KATOWICE);

    let stepwise = night;
    for (let i = 0; i < 3; i++) stepwise = nightDaysBefore(stepwise, KATOWICE, 1);

    assert.deepEqual(stepwise, nightDaysBefore(night, KATOWICE, 3));
  });
});
