/**
 * Dziennik obserwacji.
 *
 * Dwie rzeczy są tu warte pilnowania i obie są nieodwracalne, gdy zawiodą.
 * Pierwsza: dziennik nie może zniknąć — ani przy nieczytelnym zapisie, ani przy
 * migracji, ani przez uzupełnienie wpisu tydzień później. Druga: porządkowanie
 * celów historią ma podpowiadać, ale niczego nie ukrywać.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EMPTY_JOURNAL,
  conditionsImproved,
  describeHistory,
  exportJournal,
  historyOf,
  nightLogId,
  orderByHistory,
  parseJournal,
  rankOf,
  upsertLog,
  type AttemptConditions,
  type NightLog,
} from '../src/lib/journal.ts';

const GOOD: AttemptConditions = { bortle: 4, altitude: 60, moonIllumination: 5 };
const POOR: AttemptConditions = { bortle: 6, altitude: 25, moonIllumination: 80 };

function log(over: Partial<NightLog> = {}): NightLog {
  const nightFrom = over.nightFrom ?? new Date(2026, 2, 12, 20, 0).toISOString();

  return {
    id: nightLogId(new Date(nightFrom)),
    nightFrom,
    siteId: 'site-bledowska',
    siteName: 'Pustynia Błędowska',
    observations: [],
    transparency: 4,
    seeing: 3,
    note: '',
    savedAt: new Date(2026, 2, 13, 9, 0).toISOString(),
    ...over,
  };
}

const seen = (targetId: string, conditions = GOOD) => ({
  targetId,
  outcome: 'seen' as const,
  conditions,
  profileId: 'default',
});
const failed = (targetId: string, conditions = POOR) => ({
  targetId,
  outcome: 'failed' as const,
  conditions,
  profileId: 'default',
});

describe('zapis nocy', () => {
  it('noc uzupełniona później zastępuje wpis, a nie dokłada drugiego', () => {
    // Ta sama noc to jeden wpis, także gdy ktoś wraca do niej po tygodniu.
    const first = upsertLog(EMPTY_JOURNAL, log({ observations: [seen('m31')] }));
    const second = upsertLog(
      first,
      log({ observations: [seen('m31'), seen('m42')], note: 'mgła' }),
    );

    assert.equal(second.logs.length, 1);
    assert.equal(second.logs[0].observations.length, 2);
    assert.equal(second.logs[0].note, 'mgła');
  });

  it('noce układają się chronologicznie niezależnie od kolejności zapisu', () => {
    const later = log({ nightFrom: new Date(2026, 2, 20, 20, 0).toISOString() });
    const earlier = log({ nightFrom: new Date(2026, 2, 5, 20, 0).toISOString() });

    const journal = upsertLog(upsertLog(EMPTY_JOURNAL, later), earlier);

    assert.deepEqual(
      journal.logs.map((l) => l.id),
      ['2026-03-05', '2026-03-20'],
    );
  });

  it('identyfikator nocy bierze się z wieczoru, nie z poranka', () => {
    // Noc z 12 na 13 marca to „2026-03-12", choć kończy się nazajutrz.
    assert.equal(nightLogId(new Date(2026, 2, 12, 23, 30)), '2026-03-12');
  });
});

describe('odczyt i migracja', () => {
  it('zapis nieczytelny nie daje pustego dziennika, tylko brak odpowiedzi', () => {
    // Powrót do wartości domyślnych — właściwy dla konfiguracji — skasowałby
    // tu sezon obserwacji.
    assert.equal(parseJournal('{nie json'), null);
    assert.equal(parseJournal('{"version":1}'), null);
  });

  it('brak zapisu to co innego niż zapis pusty', () => {
    assert.equal(parseJournal(null), null);
    assert.deepEqual(parseJournal('{"version":1,"logs":[]}'), EMPTY_JOURNAL);
  });

  it('migracja uzupełnia brakujące pola, zamiast odrzucać wpis', () => {
    // Zapis ze starszej wersji nie ma ocen ani notatki. Ma zostać, a nie zniknąć.
    const old = JSON.stringify({
      version: 1,
      logs: [
        { id: '2026-01-02', nightFrom: '2026-01-02T20:00:00.000Z', observations: [seen('m13')] },
      ],
    });

    const journal = parseJournal(old);

    assert.equal(journal?.logs.length, 1);
    assert.equal(journal?.logs[0].transparency, null);
    assert.equal(journal?.logs[0].note, '');
    assert.equal(journal?.logs[0].observations.length, 1);
  });

  it('eksport jest tym samym JSON-em, który da się wczytać z powrotem', () => {
    const journal = upsertLog(EMPTY_JOURNAL, log({ observations: [seen('m31'), failed('m101')] }));

    assert.deepEqual(parseJournal(exportJournal(journal)), journal);
  });
});

describe('historia celu', () => {
  it('liczy udane podejścia i pamięta ostatnie', () => {
    const journal = [
      log({ nightFrom: new Date(2026, 0, 5, 20, 0).toISOString(), observations: [seen('m31')] }),
      log({ nightFrom: new Date(2026, 1, 9, 20, 0).toISOString(), observations: [seen('m31')] }),
    ].reduce(upsertLog, EMPTY_JOURNAL);

    const entry = historyOf(journal).get('m31');

    assert.equal(entry?.seenCount, 2);
    assert.equal(entry?.lastSeenAt?.getMonth(), 1);
  });

  it('nieudane podejście pamięta warunki, w jakich się odbyło', () => {
    const journal = upsertLog(EMPTY_JOURNAL, log({ observations: [failed('m101')] }));
    const entry = historyOf(journal).get('m101');

    assert.equal(entry?.failures.length, 1);
    assert.deepEqual(entry?.failures[0].conditions, POOR);
  });

  it('podpis mówi, ile razy i kiedy', () => {
    const once = historyOf(upsertLog(EMPTY_JOURNAL, log({ observations: [seen('m31')] })));
    assert.equal(describeHistory(once.get('m31')), 'widziane 12.03');

    const failedOnce = historyOf(upsertLog(EMPTY_JOURNAL, log({ observations: [failed('m101')] })));
    assert.equal(describeHistory(failedOnce.get('m101')), 'próbowane, nie wyszło');
  });
});

describe('warunki lepsze niż wtedy', () => {
  it('ciemniejsze niebo wystarczy', () => {
    assert.equal(conditionsImproved(POOR, { ...POOR, bortle: 4 }), true);
  });

  it('wyższe położenie wystarczy', () => {
    assert.equal(conditionsImproved(POOR, { ...POOR, altitude: 60 }), true);
  });

  it('ciemniejszy Księżyc wystarczy', () => {
    assert.equal(conditionsImproved(POOR, { ...POOR, moonIllumination: 10 }), true);
  });

  it('drobna zmiana to szum, a nie druga szansa', () => {
    assert.equal(
      conditionsImproved(POOR, { bortle: 6, altitude: 28, moonIllumination: 75 }),
      false,
    );
  });
});

describe('porządkowanie celów historią', () => {
  const target = (id: string, kind: 'planet' | 'dso', maxAltitude = 60) => ({
    id,
    kind,
    maxAltitude,
  });

  it('nieudana próba wraca wyżej, gdy warunki się poprawiły', () => {
    // Jedyne miejsce, w którym dziennik sam z siebie coś podpowiada.
    const journal = upsertLog(EMPTY_JOURNAL, log({ observations: [failed('m101')] }));

    const ordered = orderByHistory([target('m31', 'dso'), target('m101', 'dso')], journal, {
      bortle: 4,
      moonIllumination: 5,
    });

    assert.equal(ordered[0].target.id, 'm101');
    assert.equal(ordered[0].rank, 'retry');
  });

  it('przy tych samych warunkach nieudana próba nie wraca na górę', () => {
    const journal = upsertLog(EMPTY_JOURNAL, log({ observations: [failed('m101')] }));

    const ordered = orderByHistory([target('m31', 'dso'), target('m101', 'dso', 25)], journal, {
      bortle: 6,
      moonIllumination: 80,
    });

    assert.equal(ordered[0].target.id, 'm31');
  });

  it('widziane schodzą niżej, ale nie znikają', () => {
    // M42 ogląda się co sezon i to nie jest błąd.
    const journal = upsertLog(EMPTY_JOURNAL, log({ observations: [seen('m42')] }));

    const ordered = orderByHistory([target('m42', 'dso'), target('m31', 'dso')], journal, {
      bortle: 4,
      moonIllumination: 5,
    });

    assert.deepEqual(
      ordered.map((o) => o.target.id),
      ['m31', 'm42'],
    );
    assert.equal(ordered.length, 2);
  });

  it('kolejność wewnątrz grupy zostaje ta, która przyszła', () => {
    // Wejście jest posortowane po jasności — historia je przestawia, a nie zastępuje.
    const ordered = orderByHistory(
      [target('a', 'dso'), target('b', 'dso'), target('c', 'dso')],
      EMPTY_JOURNAL,
      { bortle: 4, moonIllumination: 5 },
    );

    assert.deepEqual(
      ordered.map((o) => o.target.id),
      ['a', 'b', 'c'],
    );
  });

  it('planet historia nie dotyczy', () => {
    // Wracają co roku z natury; „widziałem Jowisza" nic o nich nie mówi.
    const journal = upsertLog(EMPTY_JOURNAL, log({ observations: [seen('planet-Jupiter')] }));

    const ordered = orderByHistory([target('planet-Jupiter', 'planet')], journal, {
      bortle: 4,
      moonIllumination: 5,
    });

    assert.equal(ordered[0].rank, 'new');
    assert.equal(ordered[0].history, undefined);
  });

  it('rankOf bez historii daje cel nowy', () => {
    assert.equal(rankOf(undefined, GOOD), 'new');
  });
});
