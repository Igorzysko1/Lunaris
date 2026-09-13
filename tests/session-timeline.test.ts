/**
 * Przebieg sesji na żywo.
 *
 * Te godziny mają zasilić kalibrację prędkości dojazdu i czasu zwijania, więc
 * najgroźniejsza jest tu cicha pomyłka w danych: dotknięcie w złym momencie,
 * godzina przesunięta wbrew kolejności, plan nadpisany nowszą prognozą albo
 * przebieg skasowany przez zapis celów z ekranu dziennika.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EMPTY_JOURNAL,
  nightLogId,
  parseJournal,
  upsertLog,
  withTimeline,
  type NightLog,
} from '../src/lib/journal.ts';
import {
  adjustStep,
  calendarWindow,
  lastStep,
  liveNightIndex,
  markSynced,
  needsCalendarSync,
  nextStep,
  parseTimeline,
  plannedFrom,
  plannedWindow,
  recordStep,
  segmentMinutes,
  undoLastStep,
  type SessionTimeline,
} from '../src/lib/session-timeline.ts';

const at = (h: number, m = 0, day = 15) => new Date(2026, 8, day, h, m);

const PLAN = plannedFrom(
  { departAt: at(20, 30), returnAt: at(2, 45, 16) },
  { from: at(21, 30), to: at(1, 30, 16) },
);

/** Pełna noc: wyjazd 20:40, na miejscu 21:25, zwijanie 1:50, w domu 2:55. */
function fullNight(): SessionTimeline {
  let timeline = recordStep(null, at(20, 40), PLAN);
  timeline = recordStep(timeline, at(21, 25), null);
  timeline = recordStep(timeline, at(1, 50, 16), null);
  return recordStep(timeline, at(2, 55, 16), null);
}

describe('kolejne kroki', () => {
  it('idą w ustalonej kolejności i kończą się na powrocie', () => {
    let timeline: SessionTimeline | null = null;
    const seen: (string | null)[] = [];

    for (let i = 0; i < 5; i++) {
      seen.push(nextStep(timeline));
      timeline = recordStep(timeline, at(20 + i), PLAN);
    }

    assert.deepEqual(seen, ['departed', 'arrived', 'packing', 'home', null]);
  });

  it('plan zamraża się przy wyjeździe i nie zmienia przy kolejnych krokach', () => {
    // Cykl przelicza noc codziennie — porównanie ma być z planem z chwili wyjazdu.
    const departed = recordStep(null, at(20, 40), PLAN);
    const arrived = recordStep(
      departed,
      at(21, 25),
      plannedFrom({ departAt: at(19), returnAt: at(4, 0, 16) }, null),
    );

    assert.deepEqual(arrived.planned, PLAN);
  });

  it('zamknięta noc nie przyjmuje kolejnego kroku', () => {
    const closed = fullNight();

    assert.deepEqual(recordStep(closed, at(5, 0, 16), null), closed);
  });
});

describe('pomyłki', () => {
  it('cofnięcie zdejmuje ostatni krok', () => {
    const undone = undoLastStep(fullNight(), at(3, 0, 16));

    assert.equal(undone.home, null);
    assert.equal(lastStep(undone), 'packing');
  });

  it('cofnięty wyjazd zabiera zamrożony plan', () => {
    const undone = undoLastStep(recordStep(null, at(12, 0), PLAN), at(12, 1));

    assert.equal(undone.departed, null);
    assert.equal(undone.planned, null);
  });

  it('poprawka godziny w granicach kolejności przechodzi', () => {
    const moved = adjustStep(fullNight(), 'arrived', -10, at(9, 0, 16));

    assert.equal(moved?.arrived, at(21, 15).toISOString());
  });

  it('poprawka wbrew kolejności kroków jest odrzucona', () => {
    // Dojazd przed wyjazdem zatrułby rachunek prędkości.
    assert.equal(adjustStep(fullNight(), 'arrived', -60, at(9, 0, 16)), null);
    assert.equal(adjustStep(fullNight(), 'packing', 120, at(9, 0, 16)), null);
  });

  it('godziny nie da się przesunąć w przyszłość ani poprawić niezapisanego kroku', () => {
    const departed = recordStep(null, at(20, 40), PLAN);

    assert.equal(adjustStep(departed, 'departed', 30, at(20, 50)), null);
    assert.equal(adjustStep(departed, 'arrived', 5, at(23, 0)), null);
  });
});

describe('odcinki nocy', () => {
  it('liczy dojazd, obserwację, zwijanie z powrotem i całość', () => {
    assert.deepEqual(segmentMinutes(fullNight()), {
      travel: 45,
      observing: 265,
      packAndReturn: 65,
      total: 375,
    });
  });

  it('brakujący krok daje brak liczby, a nie zero', () => {
    const partial = recordStep(null, at(20, 40), PLAN);

    assert.equal(segmentMinutes(partial).travel, null);
  });
});

describe('wpis w kalendarzu', () => {
  const fallback = plannedWindow(PLAN, null);

  it('przed wyjazdem obowiązuje plan', () => {
    const empty = undoLastStep(recordStep(null, at(20, 40), PLAN), at(20, 41));

    assert.deepEqual(calendarWindow(empty, fallback), fallback);
  });

  it('wyjazd przesuwa początek, powrót ustawia koniec', () => {
    const window = calendarWindow(fullNight(), fallback);

    assert.deepEqual(window, { start: at(20, 40), end: at(2, 55, 16) });
  });

  it('do czasu powrotu koniec zostaje planowany, ale nigdy przed początkiem', () => {
    const late = recordStep(null, at(3, 0, 16), PLAN);
    const window = calendarWindow(late, fallback);

    assert.ok(window && window.end > window.start);
  });

  it('bez planu i bez godzin nie ma czego wpisać', () => {
    const noPlan = undoLastStep(recordStep(null, at(20), null), at(20, 1));

    assert.equal(calendarWindow(noPlan, plannedWindow(null, null)), null);
  });

  it('zmiana bez sieci czeka na synchronizację, a nowy krok w trakcie żądania dostaje własną', () => {
    const departed = recordStep(null, at(20, 40), PLAN);
    assert.equal(needsCalendarSync(departed), true);

    const synced = markSynced(departed);
    assert.equal(needsCalendarSync(synced), false);

    const arrivedDuringRequest = recordStep(departed, at(21, 25), null);
    assert.equal(
      needsCalendarSync({ ...arrivedDuringRequest, calendarSyncedAt: departed.updatedAt }),
      true,
    );
  });
});

describe('trwająca noc', () => {
  const nights = [
    { from: at(19, 30), to: at(5, 0, 16) },
    { from: at(19, 30, 16), to: at(5, 0, 17) },
  ];

  it('wieczorem i w nocy to pierwsza noc', () => {
    assert.equal(liveNightIndex(nights, at(12, 0)), 0);
    assert.equal(liveNightIndex(nights, at(3, 0, 16)), 0);
  });

  it('powrót o świcie wciąż należy do tej nocy, po południu już do kolejnej', () => {
    assert.equal(liveNightIndex(nights, at(10, 30, 16)), 0);
    assert.equal(liveNightIndex(nights, at(11, 30, 16)), 1);
  });
});

describe('zapis w dzienniku', () => {
  const log = (over: Partial<NightLog> = {}): NightLog => ({
    id: nightLogId(at(19, 30)),
    nightFrom: at(19, 30).toISOString(),
    siteId: 'site-bledowska',
    siteName: 'Pustynia Błędowska',
    observations: [],
    transparency: null,
    seeing: null,
    note: '',
    savedAt: at(9, 0, 16).toISOString(),
    ...over,
  });

  it('zapis celów z ekranu dziennika nie kasuje przebiegu nocy', () => {
    const withRun = upsertLog(EMPTY_JOURNAL, log({ timeline: fullNight() }));
    const afterTargets = upsertLog(withRun, log({ note: 'M31 gołym okiem' }));

    assert.deepEqual(afterTargets.logs[0].timeline, fullNight());
    assert.equal(afterTargets.logs[0].note, 'M31 gołym okiem');
  });

  it('przebieg dokłada się do istniejącego wpisu, nie zastępuje celów', () => {
    const journal = upsertLog(EMPTY_JOURNAL, log({ note: 'Seeing słaby' }));
    const updated = withTimeline(journal, log(), fullNight(), at(3, 0, 16).toISOString());

    assert.equal(updated.logs.length, 1);
    assert.equal(updated.logs[0].note, 'Seeing słaby');
    assert.deepEqual(updated.logs[0].timeline, fullNight());
  });

  it('przebieg bez wpisu nocy tworzy nowy wpis', () => {
    const updated = withTimeline(EMPTY_JOURNAL, log(), fullNight(), at(3, 0, 16).toISOString());

    assert.equal(updated.logs.length, 1);
    assert.deepEqual(updated.logs[0].observations, []);
  });

  it('przebieg przeżywa zapis i odczyt dziennika', () => {
    const journal = upsertLog(EMPTY_JOURNAL, log({ timeline: fullNight() }));

    assert.deepEqual(parseJournal(JSON.stringify(journal))?.logs[0].timeline, fullNight());
  });

  it('wpis bez przebiegu nie dostaje pustego pola przy odczycie', () => {
    const journal = upsertLog(EMPTY_JOURNAL, log());

    assert.equal('timeline' in (parseJournal(JSON.stringify(journal))?.logs[0] ?? {}), false);
  });
});

describe('odczyt przebiegu z zapisu', () => {
  it('godziny w złej kolejności przepadają, reszta zostaje', () => {
    const broken = { ...fullNight(), arrived: at(19, 0).toISOString() };
    const parsed = parseTimeline(broken);

    assert.equal(parsed?.departed, null);
    assert.deepEqual(parsed?.planned, PLAN);
  });

  it('śmieci w polach dają puste godziny, a nie wyjątek', () => {
    const parsed = parseTimeline({ departed: 'wczoraj', home: 7, planned: 'plan' });

    assert.equal(parsed?.departed, null);
    assert.equal(parsed?.home, null);
    assert.equal(parsed?.planned, null);
    assert.equal(parseTimeline('x'), undefined);
  });
});
