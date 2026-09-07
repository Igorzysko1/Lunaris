/**
 * Rdzeń cache'u prognozy — bez AsyncStorage, który istnieje tylko w aplikacji.
 *
 * Testujemy to, co może zawieść po cichu: daty, które po zapisie wracają jako
 * napisy, zapis z nieznanej wersji i dane na tyle stare, że lepiej ich nie
 * pokazywać. Każdy z tych przypadków ma kończyć się brakiem trafienia, a nie
 * wyjątkiem — cache jest udogodnieniem, nie warunkiem działania ekranu.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_AGE_HOURS,
  STALE_AFTER_HOURS,
  expiredKeys,
  formatAge,
  parse,
  serialize,
} from '../src/lib/forecast-cache.ts';

const NOW = new Date(2026, 0, 15, 20, 0);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

type Payload = { from: Date; hours: { at: Date; cloud: number }[] };

const payload: Payload = {
  from: new Date(2026, 0, 15, 18, 0),
  hours: [
    { at: new Date(2026, 0, 15, 18, 0), cloud: 10 },
    { at: new Date(2026, 0, 15, 19, 0), cloud: 40 },
  ],
};

describe('serialize / parse', () => {
  it('daty wracają jako Date, a nie jako napisy', () => {
    const hit = parse<Payload>(serialize(payload, hoursAgo(1)), NOW);

    assert.ok(hit);
    assert.ok(hit.payload.from instanceof Date);
    assert.equal(hit.payload.from.getTime(), payload.from.getTime());
    assert.ok(hit.payload.hours[1].at instanceof Date);
    assert.equal(hit.payload.hours[1].at.getTime(), payload.hours[1].at.getTime());
  });

  it('liczby zostają liczbami', () => {
    const hit = parse<Payload>(serialize(payload, hoursAgo(1)), NOW);
    assert.equal(hit?.payload.hours[1].cloud, 40);
  });

  it('podaje moment zapisu', () => {
    const savedAt = hoursAgo(3);
    const hit = parse<Payload>(serialize(payload, savedAt), NOW);
    assert.equal(hit?.savedAt.getTime(), savedAt.getTime());
  });

  it('brak zapisu to brak trafienia', () => {
    assert.equal(parse<Payload>(null, NOW), null);
  });

  it('uszkodzony zapis nie rzuca wyjątkiem', () => {
    assert.equal(parse<Payload>('{ to nie jest json', NOW), null);
  });

  it('zapis z nieznanej wersji jest pomijany', () => {
    const raw = JSON.stringify({ version: 99, savedAt: NOW.toISOString(), payload });
    assert.equal(parse<Payload>(raw, NOW), null);
  });

  it('dane starsze niż dopuszczalny wiek nie wracają', () => {
    const fresh = parse<Payload>(serialize(payload, hoursAgo(MAX_AGE_HOURS - 1)), NOW);
    const stale = parse<Payload>(serialize(payload, hoursAgo(MAX_AGE_HOURS + 1)), NOW);

    assert.ok(fresh);
    assert.equal(stale, null);
  });

  it('zapis z przyszłości jest odrzucany — to przestawiony zegar', () => {
    const future = serialize(payload, new Date(NOW.getTime() + 3_600_000));
    assert.equal(parse<Payload>(future, NOW), null);
  });
});

describe('formatAge', () => {
  it('mówi po polsku, z odmianą godzin', () => {
    assert.equal(formatAge(NOW, NOW), 'sprzed chwili');
    assert.equal(formatAge(hoursAgo(0.5), NOW), 'sprzed 30 min');
    assert.equal(formatAge(hoursAgo(1), NOW), 'sprzed godziny');
    assert.equal(formatAge(hoursAgo(3), NOW), 'sprzed 3 godziny');
    assert.equal(formatAge(hoursAgo(8), NOW), 'sprzed 8 godzin');
  });

  it('nie pokazuje ujemnego wieku', () => {
    const future = new Date(NOW.getTime() + 60_000);
    assert.equal(formatAge(future, NOW), 'sprzed chwili');
  });
});

describe('dwa progi wieku', () => {
  it('zapis z bieżącego cyklu nie jest oznaczony jako stary', () => {
    // Przy odświeżaniu raz na dobę dane tuż przed kolejnym terminem mają prawie
    // 24 godziny i są zupełnie normalne — ostrzeżenie byłoby fałszywym alarmem.
    const hit = parse<Payload>(serialize(payload, hoursAgo(STALE_AFTER_HOURS - 1)), NOW);

    assert.ok(hit);
    assert.equal(hit.stale, false);
  });

  it('zapis, który przetrwał termin, jest oznaczony, ale nadal czytelny', () => {
    const hit = parse<Payload>(serialize(payload, hoursAgo(STALE_AFTER_HOURS + 1)), NOW);

    assert.ok(hit);
    assert.equal(hit.stale, true);
    assert.deepEqual(hit.payload.from, payload.from);
  });

  it('powyżej twardego progu nie pokazujemy nawet z etykietą', () => {
    assert.equal(parse<Payload>(serialize(payload, hoursAgo(MAX_AGE_HOURS + 1)), NOW), null);
  });
});

describe('expiredKeys', () => {
  const fresh = serialize(payload, hoursAgo(1));
  const ancient = serialize(payload, hoursAgo(MAX_AGE_HOURS + 5));

  it('kasuje tylko przeterminowane klucze prognozy', () => {
    const keys = expiredKeys(
      [
        ['lunaris.forecast.bundle.50.35,19.53', fresh],
        ['lunaris.forecast.site.49.62,19.03', ancient],
      ],
      NOW,
    );

    assert.deepEqual(keys, ['lunaris.forecast.site.49.62,19.03']);
  });

  it('nie rusza cudzych kluczy, choćby były stare', () => {
    // W AsyncStorage leżą też ustawienia i stan cyklu — sprzątanie prognozy nie
    // może ich dotknąć, bo nie mają terminu ważności.
    const keys = expiredKeys(
      [
        ['lunaris.settings', ancient],
        ['lunaris.cycle.bundle', ancient],
        // Dziennik obserwacji jest przyrostowy i nieodtwarzalny: sprzątanie
        // cache'u nie może go dotknąć, choćby był sprzed roku.
        ['lunaris.journal', ancient],
      ],
      NOW,
    );

    assert.deepEqual(keys, []);
  });

  it('uszkodzony zapis też idzie do skasowania', () => {
    const keys = expiredKeys([['lunaris.forecast.bundle.50.00,19.00', '{nie json']], NOW);

    assert.deepEqual(keys, ['lunaris.forecast.bundle.50.00,19.00']);
  });
});
