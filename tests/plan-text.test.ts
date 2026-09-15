/**
 * Noc › Plan: przebieg doby rozpisany na bloki i kroki, sen i zimno,
 * ostrzeżenia z tonem i „co dalej dziś".
 *
 * Przykład to noc z projektu (9a): wyjazd 21:05, sesja 22:10–02:40, powrót
 * 03:25, pobudka 08:00. Bloki paska mają wyjść takie jak w projekcie —
 * 65 / 270 / 45 / 275 minut — bo projekt liczył je z tych samych godzin.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PlannedNight } from '../src/lib/night-plan.ts';
import {
  NO_PLAN,
  UNCERTAIN_NIGHT,
  describeSegments,
  planSchedule,
  tonightAhead,
} from '../src/lib/plan-text.ts';
import type { NightVerdict } from '../src/lib/session-engine.ts';
import { describeSettingSoon } from '../src/lib/sky-text.ts';

const at = (day: number, hours: number, minutes = 0) => new Date(2026, 8, day, hours, minutes);

const VERDICT: NightVerdict = {
  night: { from: at(14, 20, 46), to: at(15, 4, 28) },
  status: 'go',
  window: { from: at(14, 22, 10), to: at(15, 2, 40), durationMinutes: 270, moonLimited: false },
  plan: {
    departAt: at(14, 21, 5),
    returnAt: at(15, 3, 25),
    wakeAt: at(15, 8, 0),
    sleepHours: 4.6,
    travelMinutes: 47,
  },
  rejection: null,
  warnings: [
    { kind: 'dew', minSpreadC: 2.3 },
    { kind: 'session-trimmed', reason: 'sleep', droppedMinutes: 35 },
    { kind: 'walk-too-long', walkMinutes: 12 },
  ],
};

function planned(over: Partial<PlannedNight> = {}): PlannedNight {
  return {
    verdict: VERDICT,
    minTemperature: 4.1,
    feltTemperature: 0.8,
    targets: [],
    rating: 80,
    uncertain: false,
    seeing: null,
    ...over,
  };
}

describe('przebieg doby w Planie', () => {
  const schedule = planSchedule(planned(), { walkMinutes: 12 })!;

  it('bloki i podpisy paska jak w projekcie', () => {
    assert.equal(schedule.summary, 'wyjazd 21:05 · powrót 03:25');
    assert.deepEqual(
      schedule.blocks.map((b) => [b.label, b.minutes]),
      [
        ['dojazd', 65],
        ['sesja', 270],
        ['powrót', 45],
        ['sen', 275],
      ],
    );
    assert.deepEqual(
      schedule.axis.map((tick) => tick.label),
      ['21:05', '02:40', '08:00'],
    );
    assert.equal(schedule.axis[1].at, 0.511);
  });

  it('kroki od wyjazdu do pobudki, sesja wyróżniona', () => {
    assert.deepEqual(
      schedule.steps.map((s) => [s.time, s.text, s.session]),
      [
        ['21:05', 'wyjazd z domu · 47 min drogi', false],
        ['21:52', 'parking · 12 min dojścia', false],
        ['22:10', 'start sesji', true],
        ['02:40', 'koniec sesji · zwijanie', true],
        ['03:25', 'powrót do domu', false],
        ['08:00', 'pobudka', false],
      ],
    );
  });

  it('bez punktu startowego nie udaje drogi, której nie policzono', () => {
    const local = planSchedule(
      planned({ verdict: { ...VERDICT, plan: { ...VERDICT.plan!, travelMinutes: 0 } } }),
      { walkMinutes: 0 },
    )!;

    assert.deepEqual(
      local.steps.map((s) => s.text),
      ['wyjazd', 'start sesji', 'koniec sesji · zwijanie', 'koniec wyjazdu', 'pobudka'],
    );
  });

  it('sen, zimno i odczuwalna tylko wtedy, gdy wiatr coś zmienia', () => {
    assert.deepEqual(schedule.outcomes, [
      { label: 'sen', value: '4,6 h' },
      { label: 'min. temp.', value: '4,1 °C' },
      { label: 'w odczuciu', value: '0,8 °C', tone: 'warn' },
    ]);

    const calm = planSchedule(planned({ feltTemperature: 3.6 }), { walkMinutes: 12 })!;
    assert.deepEqual(
      calm.outcomes.map((o) => o.label),
      ['sen', 'min. temp.'],
    );
  });

  it('ostrzeżenia dosłownie z silnika, z tonem; niepewna doba na końcu', () => {
    const uncertain = planSchedule(planned({ uncertain: true }), { walkMinutes: 12 })!;

    assert.deepEqual(uncertain.warnings, [
      {
        mark: '!',
        tone: 'warn',
        text: 'Rosa: temperatura 2.3°C od punktu rosy — weź ogrzewacz na obiektyw.',
      },
      {
        mark: '!',
        tone: 'warn',
        text: 'Sesja skrócona o 35 min, żeby zostało na sen. Pogoda pozwala dłużej.',
      },
      { mark: '·', tone: 'neutral', text: 'Dojście od parkingu zajmuje 12 min.' },
      { mark: '?', tone: 'neutral', text: UNCERTAIN_NIGHT },
    ]);
    assert.equal(
      schedule.bookingNote,
      'Wpis obejmie 21:05 → 03:25, czyli cały wyjazd — tyle realnie jesteś nieosiągalny. Samo okno schodzi do opisu.',
    );
  });

  it('noc bez werdyktu „jedź" nie ma planu', () => {
    const rejected = planSchedule(
      planned({ verdict: { ...VERDICT, status: 'no-go', window: null, plan: null } }),
      { walkMinutes: 0 },
    );
    assert.equal(rejected, null);
    assert.ok(NO_PLAN.includes('jedź'));
  });
});

describe('noc w trakcie', () => {
  it('co dalej dziś: tylko to, co jeszcze przed nami, po kolei', () => {
    const ahead = tonightAhead(planned(), at(15, 2, 51), at(15, 0, 30));

    assert.deepEqual(ahead, [
      { time: '02:40', text: 'koniec sesji · zwijanie' },
      { time: '02:51', text: 'wschód Księżyca' },
      { time: '03:25', text: 'powrót · zostanie 4,6 h snu' },
    ]);
    assert.deepEqual(
      tonightAhead(planned(), null, at(15, 3, 0)).map((i) => i.text),
      ['powrót · zostanie 4,6 h snu'],
    );
  });

  it('cel, który zaraz zachodzi: teraz albo nigdy', () => {
    const setting = { from: at(14, 22, 10), to: at(15, 1, 5), rises: false, sets: true };

    assert.equal(
      describeSettingSoon(setting, at(14, 23, 4)),
      'zachodzi za 2 h 1 min — teraz albo nigdy',
    );
    assert.equal(describeSettingSoon(setting, at(14, 22, 0)), null);
    assert.equal(describeSettingSoon(setting, at(15, 1, 30)), 'zaszedł o 01:05');
    assert.equal(describeSettingSoon({ ...setting, sets: false }, at(15, 0, 50)), null);
  });

  it('przebieg zapisany w terenie w jednej linijce', () => {
    assert.equal(
      describeSegments({ travel: 47, observing: 270, packAndReturn: 45 }),
      'dojazd 47 min · na miejscu 4 h 30 min · zwijanie i powrót 45 min',
    );
    assert.equal(
      describeSegments({ travel: 47, observing: null, packAndReturn: null }),
      'dojazd 47 min',
    );
  });
});
