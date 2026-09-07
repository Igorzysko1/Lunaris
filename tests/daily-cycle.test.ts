/**
 * Cykl dobowy — decyzja „pobierać czy nie".
 *
 * Testujemy to, co po cichu psuje cały mechanizm: termin liczony milisekundami
 * zamiast kalendarzowo (doba zmiany czasu ma 23 albo 25 godzin), dwie próby
 * naraz z zadania w tle i z nadrobienia przy starcie, oraz dobijanie się do
 * serwera bez sieci. Każdy z tych przypadków kończy się złym werdyktem, a nie
 * wyjątkiem, więc nie zobaczy go nikt poza testem.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ATTEMPT_LOCK_MINUTES,
  EMPTY_CYCLE_STATE,
  MAX_ATTEMPTS_PER_TERM,
  RETRY_DELAY_MINUTES,
  decideRefresh,
  lastScheduledRefresh,
  markAttempt,
  markFailure,
  markSuccess,
  type CycleState,
} from '../src/lib/daily-cycle.ts';

const HOUR = 17;
const minutesBefore = (at: Date, m: number) => new Date(at.getTime() - m * 60_000);

describe('lastScheduledRefresh', () => {
  it('po godzinie odświeżenia termin jest dzisiejszy', () => {
    const term = lastScheduledRefresh(new Date(2026, 4, 12, 20, 30), HOUR);

    assert.equal(term.getDate(), 12);
    assert.equal(term.getHours(), HOUR);
    assert.equal(term.getMinutes(), 0);
  });

  it('przed godziną odświeżenia termin jest wczorajszy', () => {
    const term = lastScheduledRefresh(new Date(2026, 4, 12, 9, 0), HOUR);

    assert.equal(term.getDate(), 11);
    assert.equal(term.getHours(), HOUR);
  });

  it('doba zmiany czasu nie przesuwa terminu o godzinę', () => {
    // 25 października 2026 zegar cofa się o 3:00 — ta doba ma 25 godzin.
    // Odejmowanie 86 400 000 ms wskazałoby 16:00 zamiast 17:00.
    const term = lastScheduledRefresh(new Date(2026, 9, 25, 9, 0), HOUR);

    assert.equal(term.getDate(), 24);
    assert.equal(term.getHours(), HOUR);
  });

  it('termin nigdy nie wypada w przyszłości', () => {
    const now = new Date(2026, 4, 12, 16, 59);
    assert.ok(lastScheduledRefresh(now, HOUR) <= now);
  });
});

describe('decideRefresh', () => {
  const now = new Date(2026, 4, 12, 20, 0);
  const term = lastScheduledRefresh(now, HOUR);

  it('bez żadnej historii pobieramy', () => {
    const decision = decideRefresh(now, EMPTY_CYCLE_STATE, HOUR);

    assert.equal(decision.run, true);
    assert.equal(decision.reason, 'due');
  });

  it('sukces z bieżącego terminu zamyka sprawę', () => {
    const state: CycleState = {
      ...EMPTY_CYCLE_STATE,
      lastSuccessAt: new Date(term.getTime() + 60_000),
    };

    assert.deepEqual(decideRefresh(now, state, HOUR).reason, 'fresh');
  });

  it('sukces sprzed terminu znaczy, że termin czeka', () => {
    const state: CycleState = { ...EMPTY_CYCLE_STATE, lastSuccessAt: minutesBefore(term, 30) };

    assert.equal(decideRefresh(now, state, HOUR).run, true);
  });

  it('próba sprzed chwili blokuje drugie uruchomienie', () => {
    // Zadanie w tle i nadrobienie przy starcie mogą wypaść w tej samej minucie.
    const state = markAttempt(
      EMPTY_CYCLE_STATE,
      minutesBefore(now, ATTEMPT_LOCK_MINUTES - 1),
      term,
    );

    assert.equal(decideRefresh(now, state, HOUR).reason, 'in-flight');
  });

  it('po nieudanej próbie czekamy przed kolejną', () => {
    const attempted = markAttempt(
      EMPTY_CYCLE_STATE,
      minutesBefore(now, RETRY_DELAY_MINUTES - 1),
      term,
    );
    const state = markFailure(attempted, 'Brak połączenia z siecią');

    assert.equal(decideRefresh(now, state, HOUR).reason, 'backoff');
  });

  it('po odczekaniu ponawiamy', () => {
    const attempted = markAttempt(
      EMPTY_CYCLE_STATE,
      minutesBefore(now, RETRY_DELAY_MINUTES + 1),
      term,
    );
    const state = markFailure(attempted, 'Brak połączenia z siecią');

    assert.equal(decideRefresh(now, state, HOUR).run, true);
  });

  it('po wyczerpaniu prób milkniemy do następnego terminu', () => {
    let state = EMPTY_CYCLE_STATE;
    for (let i = MAX_ATTEMPTS_PER_TERM; i > 0; i--) {
      state = markFailure(markAttempt(state, minutesBefore(now, i * 30), term), 'offline');
    }

    assert.equal(decideRefresh(now, state, HOUR).reason, 'exhausted');

    // Następnego dnia licznik zeruje się sam, bo termin jest już inny.
    const tomorrow = new Date(2026, 4, 13, 20, 0);
    assert.equal(decideRefresh(tomorrow, state, HOUR).run, true);
  });

  it('zegar cofnięty w tył nie wywołuje lawiny pobrań', () => {
    const state = markAttempt(EMPTY_CYCLE_STATE, new Date(now.getTime() + 3_600_000), term);

    assert.equal(decideRefresh(now, state, HOUR).run, false);
  });
});

describe('znaczniki stanu', () => {
  const now = new Date(2026, 4, 12, 20, 0);
  const term = lastScheduledRefresh(now, HOUR);

  it('kolejne próby w tym samym terminie sumują się', () => {
    const first = markAttempt(EMPTY_CYCLE_STATE, now, term);
    const second = markAttempt(first, now, term);

    assert.equal(second.attemptsThisTerm, 2);
  });

  it('próba w nowym terminie zaczyna liczenie od nowa', () => {
    const yesterday = markAttempt(EMPTY_CYCLE_STATE, now, new Date(2026, 4, 11, HOUR));
    const today = markAttempt(yesterday, now, term);

    assert.equal(today.attemptsThisTerm, 1);
  });

  it('niepowodzenie nie unieważnia poprzedniego sukcesu', () => {
    // Cykl, który po awarii kasuje dane, jest gorszy niż jego brak.
    const success = markSuccess(markAttempt(EMPTY_CYCLE_STATE, now, term), now);
    const failed = markFailure(success, 'Open-Meteo: 503');

    assert.deepEqual(failed.lastSuccessAt, success.lastSuccessAt);
    assert.equal(failed.lastError, 'Open-Meteo: 503');
  });

  it('sukces kasuje powód poprzedniego niepowodzenia', () => {
    const failed = markFailure(markAttempt(EMPTY_CYCLE_STATE, now, term), 'offline');

    assert.equal(markSuccess(failed, now).lastError, null);
  });
});
