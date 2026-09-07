/**
 * Przegląd zjawisk — co zgłosić, a o czym milczeć.
 *
 * Testujemy reguły, których błąd nie objawia się wyjątkiem, tylko szumem albo
 * ciszą: powiadomienie o zjawisku niewidocznym z tego miejsca, powtórka tego
 * samego roju każdego dnia przez dwa tygodnie, albo przemilczana noc, która
 * właśnie przeszła przez progi.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AstroEvent, EventType } from '../src/data/events.ts';
import { PREVIEW_LEAD_DAYS, reviewEvents, type NoticeLog } from '../src/lib/event-review.ts';
import type { NightVerdict } from '../src/lib/session-engine.ts';

const NOW = new Date(2026, 6, 10, 12, 0);
const DAY = 86_400_000;
const inDays = (d: number, hour = 23, minute = 0) =>
  new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + d, hour, minute);

function event(id: string, at: Date, over: Partial<AstroEvent> = {}): AstroEvent {
  return {
    id,
    cat: 'meteor',
    type: 'meteor_shower' as EventType,
    at,
    title: `Zjawisko ${id}`,
    desc: '',
    visible: true,
    ...over,
  };
}

/** Werdykt jest tu atrapą: przegląd czyta z niego okno nocy i status, nic więcej. */
function verdict(from: Date, to: Date, status: 'go' | 'no-go'): NightVerdict {
  return {
    night: { from, to },
    status,
    window: status === 'go' ? { from, to } : null,
    plan: null,
    rejection: null,
    warnings: [],
  } as unknown as NightVerdict;
}

const tonight = verdict(inDays(0, 22), inDays(1, 3), 'go');
const tonightRejected = verdict(inDays(0, 22), inDays(1, 3), 'no-go');

describe('filtr istotności', () => {
  it('zjawisko niewidoczne z tego miejsca nie generuje zgłoszenia w ogóle', () => {
    const hidden = event('hidden', inDays(0, 23), { visible: false });
    const { notices } = reviewEvents({
      now: NOW,
      events: [hidden],
      verdicts: [tonight],
      leadHours: 6,
      refreshHour: 17,
      previous: {},
    });

    assert.deepEqual(notices, []);
  });

  it('zjawisko w noc odrzuconą przez progi nie budzi nikogo', () => {
    // Za pełnym zachmurzeniem nawet zaćmienie nie jest powodem do wyjazdu.
    const { notices } = reviewEvents({
      now: NOW,
      events: [event('rain', inDays(0, 23))],
      verdicts: [tonightRejected],
      leadHours: 6,
      refreshHour: 17,
      previous: {},
    });

    assert.deepEqual(notices, []);
  });

  it('zjawisko, które już minęło, nie wraca', () => {
    const past = event('past', new Date(NOW.getTime() - DAY));
    const { notices, log } = reviewEvents({
      now: NOW,
      events: [past],
      verdicts: [tonight],
      leadHours: 6,
      refreshHour: 17,
      previous: {},
    });

    assert.deepEqual(notices, []);
    // Wypada też z pamięci — nie ma po co jej rozdymać.
    assert.equal(log.past, undefined);
  });

  it('poza prognozą zapowiadamy tylko to, co się planuje z wyprzedzeniem', () => {
    const eclipse = event('eclipse', inDays(30), { type: 'eclipse', cat: 'moon' });
    const conjunction = event('conj', inDays(30), { type: 'conjunction', cat: 'planets' });

    const { notices } = reviewEvents({
      now: NOW,
      events: [eclipse, conjunction],
      verdicts: [tonight],
      leadHours: 6,
      refreshHour: 17,
      previous: {},
    });

    assert.deepEqual(
      notices.map((n) => n.event.id),
      ['eclipse'],
    );
  });
});

describe('zapowiedź kontra zgłoszenie', () => {
  it('zjawisko spoza prognozy idzie bez werdyktu i tydzień wcześniej', () => {
    const eclipse = event('eclipse', inDays(30), { type: 'eclipse' });
    const { notices } = reviewEvents({
      now: NOW,
      events: [eclipse],
      verdicts: [tonight],
      leadHours: 6,
      refreshHour: 17,
      previous: {},
    });

    assert.equal(notices.length, 1);
    assert.equal(notices[0].verdict, null);
    assert.equal(notices[0].reason, 'preview');
    const expected = new Date(eclipse.at);
    expected.setDate(expected.getDate() - PREVIEW_LEAD_DAYS);
    expected.setHours(17, 0, 0, 0);
    assert.deepEqual(notices[0].notifyAt, expected);
  });

  it('zjawisko z prognozy idzie z werdyktem i wyprzedzeniem z ustawień', () => {
    const at = inDays(0, 23);
    const { notices } = reviewEvents({
      now: NOW,
      events: [event('tonight', at)],
      verdicts: [tonight],
      leadHours: 6,
      refreshHour: 17,
      previous: {},
    });

    assert.equal(notices.length, 1);
    assert.ok(notices[0].verdict);
    assert.equal(notices[0].notifyAt.getTime(), at.getTime() - 6 * 3_600_000);
  });

  it('zjawisko bliższe niż wyprzedzenie zgłaszamy natychmiast, a nie w przeszłości', () => {
    const at = new Date(NOW.getTime() + 3_600_000);
    const { notices } = reviewEvents({
      now: NOW,
      events: [event('soon', at)],
      verdicts: [verdict(NOW, new Date(NOW.getTime() + 6 * 3_600_000), 'go')],
      leadHours: 12,
      refreshHour: 17,
      previous: {},
    });

    assert.equal(notices[0].notifyAt.getTime(), NOW.getTime());
  });
});

describe('wykrywanie zmian między cyklami', () => {
  const at = inDays(0, 23);
  const run = (previous: NoticeLog, v: NightVerdict = tonight) =>
    reviewEvents({
      now: NOW,
      events: [event('perseidy', at)],
      verdicts: [v],
      leadHours: 6,
      refreshHour: 17,
      previous,
    });

  it('to samo zjawisko nie wraca w kolejnym cyklu', () => {
    const first = run({});
    assert.equal(first.notices.length, 1);

    const second = run(first.log);
    assert.deepEqual(second.notices, []);
  });

  it('noc odrzucona, a potem przechodząca progi, jest zgłaszana', () => {
    // Jedyne naprawdę warte zgłoszenia zdarzenie: wczoraj nie, dziś tak.
    const rejected = run({}, tonightRejected);
    assert.deepEqual(rejected.notices, []);

    const opened = run(rejected.log);
    assert.equal(opened.notices.length, 1);
    assert.equal(opened.notices[0].reason, 'reopened');
  });

  it('zapowiedź potwierdzona werdyktem odzywa się drugi raz, ale tylko raz', () => {
    const eclipse = event('eclipse', at, { type: 'eclipse' });

    // Najpierw poza prognozą: sama zapowiedź.
    const previewed = reviewEvents({
      now: NOW,
      events: [eclipse],
      verdicts: [],
      leadHours: 6,
      refreshHour: 17,
      previous: {},
    });
    assert.equal(previewed.notices[0].reason, 'preview');

    // Gdy noc wchodzi w zasięg prognozy i przechodzi progi — potwierdzenie.
    const confirmed = reviewEvents({
      now: NOW,
      events: [eclipse],
      verdicts: [tonight],
      leadHours: 6,
      refreshHour: 17,
      previous: previewed.log,
    });
    assert.equal(confirmed.notices[0].reason, 'confirmed');
    assert.ok(confirmed.notices[0].verdict);

    // Trzeci cykl już milczy.
    assert.deepEqual(
      reviewEvents({
        now: NOW,
        events: [eclipse],
        verdicts: [tonight],
        leadHours: 6,
        refreshHour: 17,
        previous: confirmed.log,
      }).notices,
      [],
    );
  });

  it('noc, która wypadła z progów, nie generuje powiadomienia o odwołaniu', () => {
    // Cisza jest tu właściwa: nikogo nie budzimy po to, żeby powiedzieć,
    // że jednak nie warto jechać.
    const announced = run({});
    const worse = run(announced.log, tonightRejected);

    assert.deepEqual(worse.notices, []);
  });
});

describe('pora zapowiedzi', () => {
  it('zapowiedź nie odzywa się o porze zjawiska, tylko o porze decyzji', () => {
    // Maksima rojów wypadają nad ranem — bez wyrównania godziny zapowiedź
    // Orionidów obudziłaby użytkownika o 4:57.
    const dawn = event('orionidy', inDays(30, 4), { type: 'meteor_shower' });
    dawn.at.setMinutes(57);

    const { notices } = reviewEvents({
      now: NOW,
      events: [dawn],
      verdicts: [],
      leadHours: 6,
      refreshHour: 17,
      previous: {},
    });

    assert.equal(notices[0].notifyAt.getHours(), 17);
    assert.equal(notices[0].notifyAt.getMinutes(), 0);
  });
});

describe('kolejność i treść', () => {
  it('zgłoszenia idą w kolejności odzywania się, nie zjawisk', () => {
    const soon = event('soon', inDays(2), { type: 'eclipse' });
    const later = event('later', inDays(1), { type: 'eclipse' });

    const { notices } = reviewEvents({
      now: NOW,
      events: [soon, later],
      verdicts: [],
      leadHours: 6,
      refreshHour: 17,
      previous: {},
    });

    // Oba wypadają bliżej niż tydzień, więc oba idą natychmiast — ale kolejność
    // musi wynikać z `notifyAt`, nie z kolejności wejścia.
    const times = notices.map((n) => n.notifyAt.getTime());
    assert.deepEqual(
      [...times].sort((a, b) => a - b),
      times,
    );
  });

  it('zgłoszenie z werdyktem podaje okno obserwacyjne', () => {
    const { notices } = reviewEvents({
      now: NOW,
      events: [event('tonight', inDays(0, 23))],
      verdicts: [tonight],
      leadHours: 6,
      refreshHour: 17,
      previous: {},
    });

    assert.match(notices[0].body, /okno \d{2}:\d{2}–\d{2}:\d{2}/);
  });

  it('zjawisko poza oknem obserwacyjnym jest zgłaszane, ale bez obietnicy', () => {
    // Okno bywa krótsze niż noc: ogranicza je sen i droga powrotna.
    const night = verdict(inDays(0, 22), inDays(1, 5), 'go');
    night.window = { from: inDays(0, 22), to: inDays(1, 4) } as NightVerdict['window'];

    const { notices } = reviewEvents({
      now: NOW,
      events: [event('late', inDays(1, 4, 30))],
      verdicts: [night],
      leadHours: 6,
      refreshHour: 17,
      previous: {},
    });

    assert.match(notices[0].body, /poza oknem/);
  });

  it('zapowiedź mówi wprost, że nie ma prognozy na tę noc', () => {
    const { notices } = reviewEvents({
      now: NOW,
      events: [event('eclipse', inDays(30), { type: 'eclipse' })],
      verdicts: [],
      leadHours: 6,
      refreshHour: 17,
      previous: {},
    });

    assert.match(notices[0].body, /zapowiedź, bez prognozy/);
  });
});
