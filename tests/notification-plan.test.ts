/**
 * Plan powiadomień.
 *
 * To jedyna część powiadomień, którą da się sprawdzić bez telefonu — i zarazem
 * ta, w której mieszkają wszystkie decyzje. Warstwa systemowa obok tylko
 * wykonuje, co ten moduł postanowi.
 *
 * Dwie reguły są tu ważniejsze od reszty, bo obie psują się cicho i obie kończą
 * się telefonem brzęczącym o rzeczach nieprawdziwych:
 *
 * - **plan jest kompletem**, więc wyłączenie powiadomień znaczy „skasuj
 *   wszystko", a nie „przestań dokładać";
 * - **nic z przeszłości**, bo powiadomienie z minioną godziną nie jest
 *   spóźnione — na części systemów odpala się natychmiast.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_PENDING,
  planNotifications,
  reconcile,
  type NightInput,
  type NoticeInput,
  type NotificationPlanInput,
} from '../src/lib/notification-plan.ts';

const NOW = new Date(2026, 0, 16, 17, 0);

const night = (over: Partial<NightInput> = {}): NightInput => ({
  from: new Date(2026, 0, 16, 16, 0),
  to: new Date(2026, 0, 17, 7, 0),
  status: 'go',
  rating: 80,
  windowFrom: new Date(2026, 0, 16, 22, 0),
  windowTo: new Date(2026, 0, 17, 4, 0),
  ...over,
});

const notice = (over: Partial<NoticeInput> = {}): NoticeInput => ({
  eventId: 'eclipse-1',
  reason: 'new',
  title: 'Zaćmienie Księżyca',
  body: 'Maksimum o 21:04.',
  notifyAt: new Date(2026, 0, 16, 19, 0),
  eventAt: new Date(2026, 0, 16, 21, 4),
  ...over,
});

const input = (over: Partial<NotificationPlanInput> = {}): NotificationPlanInput => ({
  now: NOW,
  enabled: true,
  leadHours: 2,
  notices: [],
  nights: [],
  minRating: 70,
  siteName: 'Pustynia Błędowska',
  ...over,
});

describe('plan jest kompletem, nie przyrostem', () => {
  it('wyłączone powiadomienia dają pusty plan', () => {
    // Pusty plan w połączeniu z `reconcile` kasuje wszystko, co wisi
    // w systemie. Gdyby funkcja zwracała tu „nie wiem", wyłączenie przełącznika
    // zostawiłoby wczorajsze obietnice.
    const plan = planNotifications(
      input({ enabled: false, notices: [notice()], nights: [night()] }),
    );

    assert.deepEqual(plan, []);
  });

  it('bez bodźców plan jest pusty, a nie niezdefiniowany', () => {
    assert.deepEqual(planNotifications(input()), []);
  });
});

describe('nic z przeszłości', () => {
  it('zgłoszenie z minioną godziną wypada', () => {
    const plan = planNotifications(
      input({ notices: [notice({ notifyAt: new Date(2026, 0, 16, 16, 59) })] }),
    );

    assert.deepEqual(plan, []);
  });

  it('noc, której okno już się otworzyło, nie dostaje zapowiedzi', () => {
    // Zapowiedź po fakcie to nie zapowiedź.
    const plan = planNotifications(
      input({
        now: new Date(2026, 0, 16, 22, 30),
        nights: [night()],
      }),
    );

    assert.deepEqual(plan, []);
  });
});

describe('zapowiedź dobrej nocy', () => {
  it('wypada o wyprzedzenie przed otwarciem okna', () => {
    const [plan] = planNotifications(input({ nights: [night()] }));

    assert.deepEqual(plan.at, new Date(2026, 0, 16, 20, 0));
    assert.match(plan.title, /Pustynia Błędowska/);
    assert.match(plan.body, /80\/100/);
    assert.match(plan.body, /22:00–04:00/);
  });

  it('noc poniżej progu milczy', () => {
    assert.deepEqual(planNotifications(input({ nights: [night({ rating: 69 })] })), []);
  });

  it('noc odrzucona milczy niezależnie od oceny', () => {
    // Ocena mówi o niebie, werdykt o wyjeździe — powiadamiamy o drugim.
    const plan = planNotifications(
      input({ nights: [night({ status: 'no-go', rating: 95, windowFrom: null })] }),
    );

    assert.deepEqual(plan, []);
  });

  it('gdy właściwa chwila minęła, ostrzega krócej zamiast milczeć', () => {
    // Cykl odświeżania chodzi po siedemnastej, więc przy wyprzedzeniu 6 h
    // idealny moment na noc z oknem od 22:00 zawsze już minął. Reguła „tylko
    // punktualnie" znaczyłaby, że ta zapowiedź nigdy nie zabrzmi.
    const [plan] = planNotifications(input({ leadHours: 6, nights: [night()] }));

    assert.ok(plan, 'brak zapowiedzi mimo otwartego okna w przyszłości');
    assert.deepEqual(plan.at, new Date(2026, 0, 16, 17, 5));
    assert.ok(plan.at < night().windowFrom!);
  });
});

describe('pierwszeństwo zjawisk', () => {
  it('zjawisko tej samej nocy zastępuje zapowiedź nocy', () => {
    // Dwa brzęknięcia o tej samej nocy to o jedno za dużo, a konkret
    // („zaćmienie o 21:04") niesie więcej niż „ładnie się zapowiada".
    const plan = planNotifications(input({ notices: [notice()], nights: [night()] }));

    assert.equal(plan.length, 1);
    assert.match(plan[0].id, /^event:/);
  });

  it('zjawisko innej nocy nie zabiera zapowiedzi', () => {
    const plan = planNotifications(
      input({
        notices: [
          notice({ eventAt: new Date(2026, 0, 20, 21, 0), notifyAt: new Date(2026, 0, 20, 19, 0) }),
        ],
        nights: [night()],
      }),
    );

    assert.deepEqual(plan.map((n) => n.id.split(':')[0]).sort(), ['event', 'night']);
  });
});

describe('identyfikatory i limit', () => {
  it('ten sam bodziec daje ten sam identyfikator', () => {
    // Na tym stoi całe uzgadnianie stanu: identyfikator losowy znaczyłby, że
    // każdy przebieg cyklu kasuje i planuje wszystko od nowa.
    const first = planNotifications(input({ notices: [notice()], nights: [] }));
    const second = planNotifications(input({ notices: [notice()], nights: [] }));

    assert.deepEqual(
      first.map((n) => n.id),
      second.map((n) => n.id),
    );
  });

  it('zmiana powodu zgłoszenia zmienia identyfikator', () => {
    // Zapowiedź i potwierdzenie to dwie różne wiadomości o tym samym zjawisku,
    // więc druga ma zastąpić pierwszą, a nie stanąć obok niej.
    const preview = planNotifications(input({ notices: [notice({ reason: 'preview' })] }))[0];
    const confirmed = planNotifications(input({ notices: [notice({ reason: 'confirmed' })] }))[0];

    assert.notEqual(preview.id, confirmed.id);
  });

  it('przycina do limitu systemu, zostawiając najbliższe', () => {
    // iOS trzyma 64 oczekujące i nadmiar odrzuca po cichu — bez limitu część
    // powiadomień nigdy by nie zabrzmiała i nikt by się nie dowiedział.
    const many = Array.from({ length: MAX_PENDING + 10 }, (_, i) =>
      notice({
        eventId: `e${i}`,
        notifyAt: new Date(NOW.getTime() + (i + 1) * 3_600_000),
        eventAt: new Date(NOW.getTime() + (i + 1) * 3_600_000 + 60_000),
      }),
    );

    const plan = planNotifications(input({ notices: many }));

    assert.equal(plan.length, MAX_PENDING);
    assert.deepEqual(plan[0].at, new Date(NOW.getTime() + 3_600_000));
  });

  it('plan jest uporządkowany chronologicznie', () => {
    const plan = planNotifications(
      input({
        notices: [
          notice({
            eventId: 'a',
            notifyAt: new Date(2026, 0, 18, 20, 0),
            eventAt: new Date(2026, 0, 18, 22, 0),
          }),
          notice({
            eventId: 'b',
            notifyAt: new Date(2026, 0, 17, 20, 0),
            eventAt: new Date(2026, 0, 17, 22, 0),
          }),
        ],
      }),
    );

    assert.deepEqual(
      plan.map((n) => n.at),
      [new Date(2026, 0, 17, 20, 0), new Date(2026, 0, 18, 20, 0)],
    );
  });
});

describe('uzgadnianie ze stanem systemu', () => {
  const a = { id: 'event:a:new', at: new Date(2026, 0, 17, 20, 0), title: 'A', body: '' };
  const b = { id: 'night:2026-01-18', at: new Date(2026, 0, 18, 20, 0), title: 'B', body: '' };

  it('planuje brakujące, kasuje nieaktualne', () => {
    const { schedule, cancel } = reconcile([a, b], ['event:a:new', 'night:2026-01-01']);

    assert.deepEqual(
      schedule.map((n) => n.id),
      ['night:2026-01-18'],
    );
    assert.deepEqual(cancel, ['night:2026-01-01']);
  });

  it('nie rusza wpisów, które już są', () => {
    // Odwołanie i ponowne zaplanowanie tego samego wygląda w kodzie identycznie,
    // a na telefonie potrafi zgubić powiadomienie przy wyłączonym ekranie.
    const { schedule, cancel } = reconcile([a], ['event:a:new']);

    assert.deepEqual(schedule, []);
    assert.deepEqual(cancel, []);
  });

  it('pusty plan kasuje wszystko', () => {
    const { schedule, cancel } = reconcile([], ['event:a:new', 'night:2026-01-18']);

    assert.deepEqual(schedule, []);
    assert.deepEqual(cancel, ['event:a:new', 'night:2026-01-18']);
  });

  it('pusty system planuje wszystko', () => {
    const { schedule, cancel } = reconcile([a, b], []);

    assert.equal(schedule.length, 2);
    assert.deepEqual(cancel, []);
  });
});
