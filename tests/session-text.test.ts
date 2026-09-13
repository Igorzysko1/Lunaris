/**
 * Werdykt po ludzku — odrzucenie przez sen.
 *
 * Z samej liczby godzin snu nie wynika, co z nią zrobić. Godzina, od której
 * sen jest liczony, i to, skąd pochodzi, mówią więcej: spotkanie z kalendarza
 * da się przełożyć, a założenie — poprawić w ustawieniach.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeRejection } from '../src/lib/session-text.ts';

describe('odrzucenie przez sen', () => {
  it('wskazuje godzinę pierwszego wydarzenia z kalendarza', () => {
    const text = describeRejection({
      kind: 'not-enough-sleep',
      sleepHours: 3.2,
      firstEventAt: new Date(2026, 0, 16, 8, 30),
      fromCalendar: true,
    });

    assert.match(text, /^Zostałoby 3\.2 h snu/);
    assert.match(text, /pierwsze wydarzenie w kalendarzu o 0?8:30\.$/);
  });

  it('przy założeniu nie udaje, że to kalendarz', () => {
    const text = describeRejection({
      kind: 'not-enough-sleep',
      sleepHours: 4,
      firstEventAt: new Date(2026, 0, 16, 8, 0),
      fromCalendar: false,
    });

    assert.match(text, /zakładany początek dnia o 0?8:00\.$/);
    assert.doesNotMatch(text, /kalendarz/);
  });

  it('bez godziny zostaje sama liczba', () => {
    const text = describeRejection({
      kind: 'not-enough-sleep',
      sleepHours: 2,
      firstEventAt: null,
      fromCalendar: false,
    });

    assert.equal(text, 'Zostałoby 2.0 h snu przed pobudką.');
  });
});
