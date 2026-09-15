/**
 * Zapis nocy i Dziennik: powody nieudanych podejść, zwinięta noc, propozycja
 * progu rosy i godziny przebiegu dopisane z pamięci.
 *
 * Najważniejsze jest to samo co w całym dzienniku: zapis v1 musi się wczytać
 * bez strat, a nic, co użytkownik wpisał, nie może trafić do danych w postaci,
 * której kalibracja nie umie przeczytać.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  JOURNAL_VERSION,
  customReasons,
  dewThresholdSuggestion,
  nightLogId,
  packedUp,
  parseJournal,
  parseNightId,
  yearStats,
  type Journal,
  type NightLog,
  type TargetObservation,
} from '../src/lib/journal.ts';
import {
  entryChips,
  failureWhy,
  logsByMonth,
  nightSpanOfLog,
  plural,
  ratingsLabel,
  retryLine,
  timeOnNight,
} from '../src/lib/journal-text.ts';
import { plannedStep, setStepTimes } from '../src/lib/session-timeline.ts';

const CONDITIONS = { bortle: 4, altitude: 58, moonIllumination: 12 };

function observation(
  targetId: string,
  outcome: 'seen' | 'failed',
  reason?: string,
): TargetObservation {
  return {
    targetId,
    outcome,
    conditions: CONDITIONS,
    profileId: 'default',
    ...(reason ? { reason } : {}),
  };
}

function log(
  id: string,
  observations: TargetObservation[],
  over: Partial<NightLog> = {},
): NightLog {
  return {
    id,
    nightFrom: `${id}T19:00:00.000Z`,
    siteId: null,
    siteName: 'Zawoja',
    observations,
    transparency: 4,
    seeing: 3,
    note: '',
    savedAt: `${id}T23:00:00.000Z`,
    ...over,
  };
}

const journalOf = (...logs: NightLog[]): Journal => ({ version: JOURNAL_VERSION, logs });

describe('powód nieudanego podejścia w zapisie', () => {
  it('zapis v1 wczytuje się bez zmian i dostaje bieżącą wersję', () => {
    const v1 = JSON.stringify({
      version: 1,
      logs: [log('2026-09-06', [observation('m31', 'seen'), observation('m33', 'failed')])],
    });

    const parsed = parseJournal(v1)!;
    assert.equal(parsed.version, JOURNAL_VERSION);
    assert.deepEqual(parsed.logs[0].observations, [
      observation('m31', 'seen'),
      observation('m33', 'failed'),
    ]);
  });

  it('powód zostaje tylko przy nieudanym podejściu i tylko jako tekst', () => {
    const raw = JSON.stringify({
      version: 2,
      logs: [
        log('2026-09-14', [
          { ...observation('m31', 'seen'), reason: 'rosa' },
          { ...observation('m33', 'failed'), reason: '  rosa  ' },
          { ...observation('m57', 'failed'), reason: 42 },
        ] as TargetObservation[]),
      ],
    });

    const [seen, failed, broken] = parseJournal(raw)!.logs[0].observations;
    assert.equal(seen.reason, undefined);
    assert.equal(failed.reason, 'rosa');
    assert.equal(broken.reason, undefined);
  });

  it('własne powody wracają w podpowiedziach, najświeższe pierwsze', () => {
    const journal = journalOf(
      log('2026-08-29', [observation('m33', 'failed', 'bateria w montażu')]),
      log('2026-09-14', [
        observation('m57', 'failed', 'rosa'),
        observation('m27', 'failed', 'latarka sąsiada'),
        observation('m13', 'failed', 'bateria w montażu'),
      ]),
    );

    assert.deepEqual(customReasons(journal), ['latarka sąsiada', 'bateria w montażu']);
  });
});

describe('zwinięta noc', () => {
  it('bierze przyczynę z pozostałych powodów tej nocy', () => {
    const night = log('2026-08-29', [
      observation('m31', 'failed', 'rosa'),
      observation('m33', 'failed', 'zwinąłem'),
      observation('m57', 'failed', 'zwinąłem'),
    ]);

    assert.deepEqual(packedUp(night), { reason: 'rosa' });
    assert.deepEqual(entryChips(night), [
      { label: '1 nie wyszło', tone: 'warn' },
      { label: 'zwinąłem — rosa', tone: 'bad' },
    ]);
  });

  it('bez „zwinąłem" noc nie jest zwinięta', () => {
    const night = log('2026-09-14', [
      ...['m31', 'm13', 'm27', 'm57'].map((id) => observation(id, 'seen')),
      observation('m33', 'failed', 'chmury'),
    ]);

    assert.equal(packedUp(night), null);
    assert.deepEqual(entryChips(night), [
      { label: '4 widziane', tone: 'go' },
      { label: '1 nie wyszło', tone: 'warn' },
    ]);
  });
});

describe('propozycja progu rosy', () => {
  const base = { reasons: ['rosa'], threshold: 2, max: 15 };

  it('gdy prognoza nie ostrzegała, proponuje próg, przy którym by ostrzegła', () => {
    assert.equal(dewThresholdSuggestion({ ...base, forecastMinSpread: 2.3 }), 3);
  });

  it('gdy prognoza ostrzegała, nie ma czego poprawiać', () => {
    assert.equal(dewThresholdSuggestion({ ...base, forecastMinSpread: 1.5 }), null);
  });

  it('bez rosy w powodach i bez prognozy tej nocy milczy', () => {
    assert.equal(
      dewThresholdSuggestion({ ...base, reasons: ['chmury'], forecastMinSpread: 4 }),
      null,
    );
    assert.equal(dewThresholdSuggestion({ ...base, forecastMinSpread: null }), null);
  });

  it('nie wychodzi poza zakres progu', () => {
    assert.equal(dewThresholdSuggestion({ ...base, forecastMinSpread: 20, max: 15 }), 15);
  });
});

describe('dziennik na liście', () => {
  it('identyfikator nocy odrzuca daty, których nie ma', () => {
    assert.equal(nightLogId(parseNightId('2026-09-14')!), '2026-09-14');
    assert.equal(parseNightId('2026-02-31'), null);
    assert.equal(parseNightId('wczoraj'), null);
  });

  it('liczba mnoga po polsku', () => {
    assert.deepEqual(
      [1, 2, 5, 12, 22, 25].map((n) => plural(n, ['widziany', 'widziane', 'widzianych'])),
      ['widziany', 'widziane', 'widzianych', 'widzianych', 'widziane', 'widzianych'],
    );
  });

  it('podpisy wpisu: noc, oceny, powód z warunkami', () => {
    const night = log('2026-09-30', [], { transparency: null, seeing: null });

    assert.equal(nightSpanOfLog(night), '30 września/1 października');
    assert.equal(ratingsLabel(night), 'bez ocen');
    assert.equal(ratingsLabel({ transparency: 4, seeing: null }), 'przej. 4');
    assert.equal(
      failureWhy(CONDITIONS, 'rosa'),
      'rosa · nie wyszło przy Bortle 4, 58°, Księżyc 12%',
    );
    assert.equal(
      retryLine('M33 — Galaktyka Trójkąta'),
      'Dziś lepiej niż wtedy: M33 czeka na drugie podejście',
    );
  });

  it('podsumowanie roku i miesiące od najnowszego', () => {
    const journal = journalOf(
      log('2025-12-20', [observation('m42', 'seen')]),
      log('2026-08-29', [observation('m33', 'failed')]),
      log('2026-09-06', [observation('m31', 'seen'), observation('m13', 'seen')]),
    );

    assert.deepEqual(yearStats(journal, 2026), { nights: 2, seen: 2, failed: 1 });
    assert.deepEqual(
      logsByMonth(journal.logs).map((m) => [m.heading, m.logs.map((l) => l.id)]),
      [
        ['Wrzesień 2026', ['2026-09-06']],
        ['Sierpień 2026', ['2026-08-29']],
        ['Grudzień 2025', ['2025-12-20']],
      ],
    );
  });
});

describe('godziny przebiegu z pamięci', () => {
  const NOW = new Date(2026, 8, 15, 12, 0);

  it('godzina przed południem należy do ranka po nocy', () => {
    assert.deepEqual(timeOnNight('2026-09-14', '21:48'), new Date(2026, 8, 14, 21, 48));
    assert.deepEqual(timeOnNight('2026-09-14', '02.50'), new Date(2026, 8, 15, 2, 50));
    assert.equal(timeOnNight('2026-09-14', '25:00'), null);
    assert.equal(timeOnNight('2026-09-14', 'późno'), null);
  });

  it('dopisuje niezmierzony krok do nocy bez przebiegu', () => {
    const next = setStepTimes(null, { home: new Date(2026, 8, 15, 3, 30) }, NOW)!;

    assert.equal(next.home, new Date(2026, 8, 15, 3, 30).toISOString());
    assert.equal(next.departed, null);
    assert.equal(next.updatedAt, NOW.toISOString());
  });

  it('przesuwa kilka kroków naraz, nawet gdy pojedynczo byłyby nie po kolei', () => {
    const recorded = setStepTimes(
      null,
      { departed: new Date(2026, 8, 14, 20, 52), arrived: new Date(2026, 8, 14, 21, 48) },
      NOW,
    )!;

    const moved = setStepTimes(
      recorded,
      { departed: new Date(2026, 8, 14, 22, 0), arrived: new Date(2026, 8, 14, 22, 50) },
      NOW,
    );
    assert.ok(moved);
    assert.equal(
      setStepTimes(recorded, { departed: new Date(2026, 8, 14, 22, 0) }, NOW),
      null,
      'sam wyjazd po dojeździe',
    );
  });

  it('nie przyjmuje godziny z przyszłości', () => {
    assert.equal(setStepTimes(null, { home: new Date(2026, 8, 15, 13, 0) }, NOW), null);
  });

  it('plan kroku bierze się z zamrożonego planu wyjazdu', () => {
    const planned = {
      departAt: 'a',
      returnAt: 'd',
      windowFrom: 'b',
      windowTo: 'c',
    };

    assert.deepEqual(
      (['departed', 'arrived', 'packing', 'home'] as const).map((s) => plannedStep(planned, s)),
      ['a', 'b', 'c', 'd'],
    );
    assert.equal(plannedStep(null, 'home'), null);
  });
});
