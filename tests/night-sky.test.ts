/**
 * Noc › Niebo i panel celu: wybór i kolejność listy, zdania o oknie celu,
 * odhaczenie z godziną i cele dopisane do planu nocy.
 *
 * Lista w Niebie i cele Planu są jedną listą, więc jej porządek pilnowany jest
 * tutaj, a nie w dwóch widokach. Odhaczenie pisze do dziennika w trakcie nocy —
 * i jak każdy zapis dziennika nie może zgubić tego, co już w nim jest.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  JOURNAL_VERSION,
  parseJournal,
  withSighting,
  withoutSighting,
  type Journal,
  type NightLog,
  type TargetObservation,
} from '../src/lib/journal.ts';
import { sightingsOf } from '../src/lib/journal-text.ts';
import { parseNightPicks, togglePick } from '../src/lib/night-picks.ts';
import {
  fullHours,
  isFirstTime,
  nextVisibleEvent,
  outOfReach,
  skyList,
  slotsWithin,
} from '../src/lib/night-sky.ts';
import { DEFAULT_OPTICS } from '../src/lib/optics.ts';
import {
  describeEventWhen,
  describeOpticsReach,
  describeShortOverlap,
  describeUpSpan,
  seenTitle,
} from '../src/lib/sky-text.ts';
import {
  altitudesOf,
  nightTargetsForProfiles,
  targetTonight,
  type SkyTarget,
  type UpSpan,
} from '../src/lib/sky-targets.ts';

const at = (day: number, hours: number, minutes = 0) => new Date(2026, 8, day, hours, minutes);

/** Okno sesji 22:00–02:00 — cztery godziny, połowa to dwie. */
const WINDOW = { from: at(14, 22), to: at(15, 2) };

function span(from: Date, to: Date, rises = false, sets = false): UpSpan {
  return { from, to, rises, sets };
}

function target(id: string, over: Partial<SkyTarget> = {}): SkyTarget {
  return {
    id,
    name: id,
    detail: '',
    kind: 'dso',
    transitAt: at(15, 0),
    transitAltitude: 50,
    bestAt: at(15, 0),
    maxAltitude: 50,
    bestAzimuth: 180,
    up: span(WINDOW.from, WINDOW.to),
    magnitude: 5,
    visible: true,
    outOfReach: null,
    horizonAltitude: null,
    margin: 2,
    profileId: 'sct',
    profileLabel: 'SCT 8″',
    ...over,
  };
}

describe('lista celów w Niebie', () => {
  const targets = [
    target('zachodzi', { magnitude: 6, up: span(at(14, 22), at(14, 23), false, true) }),
    target('cale-okno', { magnitude: 3 }),
    target('wschodzi', { magnitude: 4, up: span(at(15, 1), at(15, 2), true, false) }),
    target('slaby-wysoko', { magnitude: 8, maxAltitude: 70 }),
    target('inny-zestaw', { magnitude: 1, profileId: 'bino' }),
    target('poza-zasiegiem', { magnitude: 2, visible: false, outOfReach: 'too-faint' }),
  ];

  it('wybiera najjaśniejsze w zasięgu zestawu, a układa oknem: najpierw zachodzący', () => {
    const rows = skyList(targets, 'sct', WINDOW, [], 3);

    assert.deepEqual(
      rows.map((r) => [r.target.id, r.urgent]),
      [
        ['zachodzi', true],
        ['cale-okno', false],
        ['wschodzi', true],
      ],
    );
  });

  it('cel dopisany do planu wchodzi zawsze, także ponad limit', () => {
    assert.deepEqual(
      skyList(targets, 'sct', WINDOW, ['slaby-wysoko'], 3).map((r) => [r.target.id, r.picked]),
      [
        ['slaby-wysoko', true],
        ['cale-okno', false],
        ['wschodzi', false],
      ],
    );
    assert.deepEqual(
      skyList(targets, 'sct', WINDOW, ['slaby-wysoko', 'zachodzi'], 1).map((r) => r.target.id),
      ['zachodzi', 'slaby-wysoko'],
    );
  });

  it('poza zasięgiem: bez celów, które w ogóle nie wschodzą, najbliższe granicy pierwsze', () => {
    const rows = outOfReach(
      [
        target('nie-wschodzi', { visible: false, outOfReach: 'too-low', margin: 5 }),
        target('za-slaby', { visible: false, outOfReach: 'too-faint', margin: -1.5 }),
        target('za-lasem', { visible: false, outOfReach: 'behind-horizon', margin: 0.4 }),
        target('lornetka', { visible: false, outOfReach: 'too-faint', profileId: 'bino' }),
      ],
      'sct',
    );

    assert.deepEqual(
      rows.map((t) => t.id),
      ['za-lasem', 'za-slaby'],
    );
  });

  it('„1. RAZ" tylko przy obiekcie spoza historii i tylko, gdy dziennik coś ma', () => {
    const empty: Journal = { version: JOURNAL_VERSION, logs: [] };
    const some: Journal = { version: JOURNAL_VERSION, logs: [log('2026-09-06', [])] };

    assert.equal(isFirstTime({ kind: 'dso' }, undefined, empty), false);
    assert.equal(isFirstTime({ kind: 'dso' }, undefined, some), true);
    assert.equal(isFirstTime({ kind: 'planet' }, undefined, some), false);
    assert.equal(
      isFirstTime({ kind: 'dso' }, { seenCount: 1, lastSeenAt: at(6, 22), failures: [] }, some),
      false,
    );
  });
});

describe('zdania o oknie celu', () => {
  it('okno na liście', () => {
    assert.equal(describeUpSpan(span(at(14, 20), at(15, 1, 5), false, true)), 'do 01:05');
    assert.equal(describeUpSpan(span(at(14, 23, 30), at(15, 4), true, false)), 'od 23:30');
    assert.equal(describeUpSpan(span(at(14, 23, 30), at(15, 1, 5), true, true)), '23:30–01:05');
    assert.equal(describeUpSpan(span(WINDOW.from, WINDOW.to)), 'całe okno');
  });

  it('krótkie pokrycie mówi, co zrobić', () => {
    assert.equal(
      describeShortOverlap(span(at(14, 20), at(14, 23, 30), false, true), WINDOW),
      'Pokrywa się z oknem tylko na 1 h 30 min — złap go na początku, zachodzi o 23:30.',
    );
    assert.equal(
      describeShortOverlap(span(at(15, 1, 10), at(15, 5), true, false), WINDOW),
      'Pokrywa się z oknem tylko na 50 min — zostaw go na koniec, wschodzi o 01:10.',
    );
    assert.equal(
      describeShortOverlap(span(at(14, 23), at(15, 0, 30), true, true), WINDOW),
      'Pokrywa się z oknem tylko na 1 h 30 min, od 23:00 do 00:30.',
    );
    assert.equal(
      describeShortOverlap(span(at(14, 20), at(14, 21, 30), false, true), WINDOW),
      'Nie pokrywa się z oknem — nad horyzontem od 20:00 do 21:30.',
    );
    assert.equal(describeShortOverlap(span(at(14, 21), at(15, 4)), WINDOW), null);
  });

  it('najbliższe zjawisko: pomija niewidoczne, liczy doby kalendarzowo', () => {
    const now = at(15, 12);
    const events = [
      {
        id: 'a',
        cat: 'moon',
        type: 'full_moon',
        at: at(16, 3),
        title: 'Pełnia',
        desc: '',
        visible: false,
      },
      {
        id: 'b',
        cat: 'planet',
        type: 'opposition',
        at: at(21, 3),
        title: 'Opozycja Neptuna',
        desc: '',
        visible: true,
      },
    ] as unknown as Parameters<typeof nextVisibleEvent>[0];

    const next = nextVisibleEvent(events, now)!;
    assert.equal(describeEventWhen(next, now), 'Opozycja Neptuna · za 6 dni');
    assert.equal(describeEventWhen({ title: 'Pełnia', at: at(15, 23) }, now), 'Pełnia · dziś');
    assert.equal(describeEventWhen({ title: 'Pełnia', at: at(16, 1) }, now), 'Pełnia · jutro');
  });

  it('zestaw i godzina odhaczenia', () => {
    assert.equal(
      describeOpticsReach({ magnification: 81, fieldOfView: 0.6 }),
      'pow. 81× · pole 36′',
    );
    assert.equal(describeOpticsReach(DEFAULT_OPTICS), 'pow. 15× · pole 4,4°');
    assert.equal(seenTitle(at(14, 23, 4).toISOString()), 'Widziałem — 23:04');
    assert.equal(seenTitle(undefined), 'Widziałem');
  });
});

describe('jeden cel tym samym rachunkiem co lista', () => {
  const ZAWOJA = { lat: 49.65, lon: 19.55 };
  const NIGHT = { from: at(14, 20, 30), to: at(15, 4, 30) };
  const PROFILES = [{ id: 'bino', label: 'Lornetka', optics: DEFAULT_OPTICS }];
  const all = nightTargetsForProfiles(NIGHT, ZAWOJA, PROFILES, 4);

  it('panel celu liczy to samo, co stało na liście', () => {
    for (const id of ['m31', 'm13', 'planet-Saturn']) {
      assert.deepEqual(targetTonight(id, NIGHT, ZAWOJA, PROFILES, 4), [
        all.find((t) => t.id === id),
      ]);
    }
    assert.deepEqual(targetTonight('nie-ma', NIGHT, ZAWOJA, PROFILES, 4), []);
  });

  it('profil wysokości co godzinę nie przekracza najwyższego położenia z listy', () => {
    const hours = fullHours(NIGHT);
    assert.deepEqual([hours[0], hours[hours.length - 1]], [at(14, 21), at(15, 4)]);

    const altitudes = altitudesOf('m31', hours, ZAWOJA)!;
    const m31 = all.find((t) => t.id === 'm31')!;
    assert.equal(altitudes.length, hours.length);
    assert.ok(Math.max(...altitudes) <= m31.maxAltitude + 1e-9);
    assert.equal(altitudesOf('nie-ma', hours, ZAWOJA), null);

    assert.deepEqual(slotsWithin(hours, { from: at(14, 22, 10), to: at(15, 2, 40) }), [2, 5]);
    assert.equal(slotsWithin(hours, null), null);
  });
});

const CONDITIONS = { bortle: 4, altitude: 58, moonIllumination: 12 };

function observation(
  targetId: string,
  outcome: 'seen' | 'failed',
  over: Partial<TargetObservation> = {},
): TargetObservation {
  return { targetId, outcome, conditions: CONDITIONS, profileId: 'default', ...over };
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
    transparency: null,
    seeing: null,
    note: '',
    savedAt: `${id}T23:00:00.000Z`,
    ...over,
  };
}

const NIGHT_REF = {
  id: '2026-09-14',
  nightFrom: '2026-09-14T19:00:00.000Z',
  siteId: null,
  siteName: 'Zawoja',
};

describe('odhaczenie w panelu celu', () => {
  it('godzina zostaje tylko przy widzianym i tylko jako prawdziwa data', () => {
    const raw = JSON.stringify({
      version: 2,
      logs: [
        log('2026-09-14', [
          observation('m31', 'seen', { seenAt: '2026-09-14T21:04:00.000Z' }),
          observation('m33', 'failed', { seenAt: '2026-09-14T21:30:00.000Z' }),
          observation('m57', 'seen', { seenAt: 'kiedyś' }),
        ]),
      ],
    });

    const parsed = parseJournal(raw)!;
    const [m31, m33, m57] = parsed.logs[0].observations;
    assert.equal(parsed.version, 3);
    assert.equal(m31.seenAt, '2026-09-14T21:04:00.000Z');
    assert.equal(m33.seenAt, undefined);
    assert.equal(m57.seenAt, undefined);
  });

  it('pierwsze odhaczenie zakłada szkic wpisu tej nocy', () => {
    const empty: Journal = { version: JOURNAL_VERSION, logs: [] };
    const seen = observation('m31', 'seen', { seenAt: '2026-09-14T21:04:00.000Z' });

    const journal = withSighting(empty, NIGHT_REF, seen, '2026-09-14T21:04:00.000Z');
    assert.equal(journal.logs.length, 1);
    assert.deepEqual(journal.logs[0].observations, [seen]);
    assert.equal(journal.logs[0].transparency, null);
  });

  it('„widziałem" zastępuje „nie wyszło", ale warunki podejścia zostają, a notatka też', () => {
    const before: Journal = {
      version: JOURNAL_VERSION,
      logs: [
        log('2026-09-14', [observation('m33', 'failed', { reason: 'rosa' })], { note: 'wiatr' }),
      ],
    };
    const later = observation('m33', 'seen', {
      seenAt: '2026-09-14T23:00:00.000Z',
      conditions: { bortle: 4, altitude: 60, moonIllumination: 13 },
    });

    const [night] = withSighting(before, NIGHT_REF, later, '2026-09-14T23:00:00.000Z').logs;
    assert.deepEqual(night.observations, [
      observation('m33', 'seen', { seenAt: '2026-09-14T23:00:00.000Z' }),
    ]);
    assert.equal(night.note, 'wiatr');
  });

  it('cofnięcie ostatniego odhaczenia usuwa pusty wpis, a wpis z oceną zostawia', () => {
    const only: Journal = {
      version: JOURNAL_VERSION,
      logs: [log('2026-09-14', [observation('m31', 'seen')])],
    };
    assert.deepEqual(withoutSighting(only, '2026-09-14', 'm31').logs, []);

    const rated: Journal = {
      version: JOURNAL_VERSION,
      logs: [log('2026-09-14', [observation('m31', 'seen')], { transparency: 4 })],
    };
    const [kept] = withoutSighting(rated, '2026-09-14', 'm31').logs;
    assert.deepEqual(kept.observations, []);
    assert.equal(kept.transparency, 4);
  });

  it('historia celu w panelu: od najnowszej nocy, z godziną i z powodem', () => {
    const journal: Journal = {
      version: JOURNAL_VERSION,
      logs: [
        log('2026-08-29', [observation('m33', 'failed', { reason: 'rosa' })]),
        log('2026-09-14', [observation('m33', 'seen', { seenAt: at(14, 23, 4).toISOString() })], {
          note: 'spiralne ramiona\nzimno',
        }),
      ],
    };

    assert.deepEqual(
      sightingsOf(journal, 'm33').map((s) => [s.date, s.detail, s.mark]),
      [
        ['14/15 września 2026', 'spiralne ramiona', '✓ 23:04'],
        ['29/30 sierpnia 2026', 'rosa · nie wyszło przy Bortle 4, 58°, Księżyc 12%', '✕'],
      ],
    );
  });
});

describe('cele dopisane do planu nocy', () => {
  const TODAY = at(15, 12);

  it('dopisanie i zdjęcie, bez pustych nocy w zapisie', () => {
    const added = togglePick({}, '2026-09-15', 'm31', TODAY);
    assert.deepEqual(added, { '2026-09-15': ['m31'] });
    assert.deepEqual(togglePick(added, '2026-09-15', 'm31', TODAY), {});
  });

  it('noce starsze niż dwie doby wypadają przy okazji', () => {
    const picks = { '2026-09-10': ['m13'], '2026-09-13': ['m57'] };
    assert.deepEqual(togglePick(picks, '2026-09-15', 'm31', TODAY), {
      '2026-09-13': ['m57'],
      '2026-09-15': ['m31'],
    });
  });

  it('nieczytelny zapis wraca do pustego zamiast psuć Niebo', () => {
    assert.deepEqual(
      parseNightPicks('{"2026-09-15":["m31","m31",4],"wczoraj":["m13"],"2026-09-16":[]}'),
      { '2026-09-15': ['m31'] },
    );
    assert.deepEqual(parseNightPicks('nie json'), {});
    assert.deepEqual(parseNightPicks('[1]'), {});
  });
});
