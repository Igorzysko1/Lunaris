/**
 * Kalendarz, Eventy i powiadomienia: kategorie i wyciszenia w przeglądzie
 * zjawisk, zgłoszenia czekające między przeglądami, wstępna rezerwacja nocy
 * zjawiska i zdania, którymi ekrany o tym mówią.
 *
 * Najważniejsze jest `pending`: plan powiadomień liczy się od zera przy każdym
 * przeglądzie, więc zapowiedź zaplanowana tydzień naprzód musi wracać w każdym
 * kolejnym — inaczej uzgadnianie z systemem odwoła ją dzień po zaplanowaniu.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AstroEvent, EventType } from '../src/data/events.ts';
import { METEOR_SHOWERS } from '../src/data/meteor-showers.ts';
import {
  dayVerdictLine,
  eventChips,
  eventStatus,
  eventSubtitle,
  hourLabel,
  leadLabel,
  notifyText,
  reasonBadge,
  scheduledWhen,
  showTargetFor,
  silenceText,
} from '../src/lib/calendar-text.ts';
import { categoryOf, eventOutlook, reviewEvents } from '../src/lib/event-review.ts';
import { bookingId, previewBookingFor } from '../src/lib/session-booking.ts';
import type { NightVerdict } from '../src/lib/session-engine.ts';

const NOW = new Date(2026, 8, 15, 12, 0);
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

function verdict(from: Date, to: Date, status: 'go' | 'no-go'): NightVerdict {
  return {
    night: { from, to },
    status,
    window: status === 'go' ? { from, to, durationMinutes: 300, moonLimited: false } : null,
    plan: null,
    rejection: status === 'go' ? null : { kind: 'conditions', blocker: 'cloud-total' },
    warnings: [],
  } as unknown as NightVerdict;
}

const tonight = verdict(inDays(0, 22), inDays(1, 3), 'go');
const tonightRejected = verdict(inDays(0, 22), inDays(1, 3), 'no-go');

const review = (
  events: AstroEvent[],
  verdicts: NightVerdict[],
  previous = {},
  over: Partial<Parameters<typeof reviewEvents>[0]> = {},
) =>
  reviewEvents({
    now: NOW,
    events,
    verdicts,
    leadHours: 6,
    refreshHour: 18,
    previous,
    ...over,
  });

describe('kategorie i wyciszenia', () => {
  it('kategoria zjawiska', () => {
    assert.deepEqual(
      (['eclipse', 'meteor_shower', 'conjunction', 'opposition', 'moon_phase'] as EventType[]).map(
        (type) => categoryOf({ type }),
      ),
      ['eclipses', 'meteors', 'planets', 'planets', 'moon'],
    );
  });

  it('wyłączona kategoria i wyciszone zjawisko milczą, ale pamięć stanu zostaje', () => {
    const shower = event('perseidy', inDays(0));

    const off = review([shower], [tonight], {}, { categories: ['eclipses'] });
    assert.deepEqual(off.notices, []);
    assert.equal(off.log.perseidy.seen, 'go');

    const muted = review([shower], [tonight], {}, { muted: ['perseidy'] });
    assert.deepEqual(muted.notices, []);
  });

  it('powód milczenia na ekranie jest tym samym rozstrzygnięciem co przegląd', () => {
    const outlook = (e: AstroEvent, v: NightVerdict[], options = {}) =>
      eventOutlook(e, v, options).silence;

    assert.equal(outlook(event('a', inDays(0), { visible: false }), [tonight]), 'invisible');
    assert.equal(outlook(event('b', inDays(0)), [tonight], { muted: ['b'] }), 'muted');
    assert.equal(
      outlook(event('c', inDays(0)), [tonight], { categories: ['moon'] }),
      'category-off',
    );
    assert.equal(outlook(event('d', inDays(0)), [tonightRejected]), 'no-go');
    assert.equal(
      outlook(event('e', inDays(20), { type: 'conjunction', cat: 'planets' }), [tonight]),
      'not-notable',
    );
    assert.equal(outlook(event('f', inDays(20), { type: 'eclipse' }), [tonight]), null);
  });
});

describe('zgłoszenia czekające między przeglądami', () => {
  it('zapowiedź sprzed przeglądu wraca w następnym jako czekająca, nie jako nowa', () => {
    const eclipse = event('eclipse', inDays(30), { type: 'eclipse' });

    const first = review([eclipse], []);
    assert.equal(first.notices.length, 1);

    const second = review([eclipse], [], first.log);
    assert.deepEqual(second.notices, []);
    assert.equal(second.pending.length, 1);
    assert.equal(second.pending[0].reason, 'preview');
    assert.deepEqual(second.pending[0].notifyAt, first.notices[0].notifyAt);
  });

  it('noc, która wypadła z progów, zabiera czekające zgłoszenie', () => {
    const shower = event('perseidy', inDays(0));
    const announced = review([shower], [tonight]);

    assert.deepEqual(review([shower], [tonightRejected], announced.log).pending, []);
  });

  it('zgłoszenie, które już się odezwało, nie czeka dalej', () => {
    const shower = event('perseidy', inDays(0));
    const announced = review([shower], [tonight]);
    const later = new Date(announced.notices[0].notifyAt.getTime() + 60_000);

    assert.deepEqual(review([shower], [tonight], announced.log, { now: later }).pending, []);
  });

  it('wyciszenie zabiera czekające zgłoszenie z planu', () => {
    const eclipse = event('eclipse', inDays(30), { type: 'eclipse' });
    const first = review([eclipse], []);

    assert.deepEqual(review([eclipse], [], first.log, { muted: ['eclipse'] }).pending, []);
  });
});

describe('wstępna rezerwacja nocy zjawiska', () => {
  it('cała noc, ten sam identyfikator co rezerwacja z planu', () => {
    const night = { from: new Date(2026, 9, 20, 18, 40), to: new Date(2026, 9, 21, 5, 20) };
    const site = { id: 'site-bledowska', name: 'Pustynia Błędowska', lat: 50.35, lon: 19.53 };
    const booking = previewBookingFor({
      night,
      site,
      event: { title: 'Orionidy', at: new Date(2026, 9, 21, 4, 57) },
    });

    assert.equal(booking.id, bookingId(night, site.id));
    assert.equal(booking.title, 'Obserwacja (wstępnie) — Pustynia Błędowska');
    assert.deepEqual([booking.start, booking.end], [night.from, night.to]);
    assert.match(booking.description, /^Zapowiedź: Orionidy, 04:57\./);
  });
});

describe('zdania Kalendarza i powiadomień', () => {
  it('żetony zjawiska: werdykt w prognozie, zapowiedź poza nią', () => {
    const go = eventOutlook(event('a', inDays(0)), [tonight]);
    assert.deepEqual(
      eventChips(go, 82, inDays(0), NOW).map((c) => [c.label, c.tone]),
      [
        ['noc się nadaje · 5/5', 'go'],
        ['okno 22:00 – 03:00', 'neutral'],
      ],
    );

    const rejected = eventOutlook(event('b', inDays(0)), [tonightRejected]);
    assert.deepEqual(eventChips(rejected, 30, inDays(0), NOW), [
      { label: 'noc odrzucona', tone: 'bad' },
    ]);

    const ahead = eventOutlook(event('c', inDays(36, 4)), []);
    assert.deepEqual(eventChips(ahead, null, inDays(36, 4), NOW), [
      { label: 'zapowiedź · za 36 dni', tone: 'accent' },
    ]);
  });

  it('stan w arkuszu i powód milczenia', () => {
    const ahead = eventOutlook(event('c', inDays(36, 4)), []);
    assert.equal(
      eventStatus(ahead, null, event('c', inDays(36, 4)), NOW).label,
      'Zapowiedź, nie obietnica',
    );
    assert.match(eventStatus(ahead, null, event('c', inDays(36, 4)), NOW).text, /^Za 36 dni — /);
    assert.equal(
      silenceText('no-go', tonightRejected),
      'Noc odrzucona — zachmurzenie powyżej progu przez całą noc.',
    );
    assert.equal(
      eventSubtitle({ at: new Date(2026, 9, 21, 4, 57), type: 'meteor_shower' }),
      'środa 21 października, 04:57 · maksimum roju',
    );
  });

  it('kiedy się odezwie', () => {
    const outlook = eventOutlook(event('c', inDays(36, 4)), []);
    const notifyAt = new Date(2026, 9, 14, 18, 0);

    assert.equal(
      notifyText({
        outlook,
        planned: { notifyAt, reason: 'preview' },
        eventAt: inDays(36, 4),
        enabled: true,
      }).text,
      'Odezwie się 14 października o 18:00 — tydzień wcześniej, o porze przeglądu.',
    );
    assert.equal(
      notifyText({ outlook, planned: null, eventAt: inDays(36, 4), enabled: false }).text,
      'Powiadomienia są wyłączone — nic się nie odezwie.',
    );
    assert.equal(
      scheduledWhen(new Date(2026, 8, 19, 13, 20), 'reopened', new Date(2026, 8, 20, 1, 20)),
      '19 września, 13:20 · 12 h przed',
    );
    assert.equal(
      scheduledWhen(notifyAt, 'preview', new Date(2026, 9, 21, 4, 57)),
      '14 października, 18:00 · 7 dni przed',
    );
    assert.deepEqual(reasonBadge('reopened'), { label: 'wróciło', tone: 'go' });
    assert.equal(leadLabel('12h'), '12 h');
    assert.equal(hourLabel(8), '08:00');
  });

  it('dzień w siatce miesiąca', () => {
    assert.equal(dayVerdictLine(tonight), 'Noc: jedź · okno 22:00–03:00');
    assert.equal(
      dayVerdictLine(tonightRejected),
      'Noc: odpuść — Zachmurzenie powyżej progu przez całą noc.',
    );
  });

  it('„Pokaż na niebie": radiant roju, planeta w opozycji, Księżyc', () => {
    const orionids = METEOR_SHOWERS.find((shower) => shower.constellation === 'Orion')!;

    assert.deepEqual(
      showTargetFor({ id: `meteor-${orionids.id}-2026`, type: 'meteor_shower' })?.label,
      'Pokaż: Orion',
    );
    assert.deepEqual(showTargetFor({ id: 'opp-Neptune-2026-09-20', type: 'opposition' }), {
      label: 'Pokaż: Neptun',
      kind: 'target',
      id: 'planet-Neptune',
    });
    assert.equal(showTargetFor({ id: 'moon-full-2026-09-26', type: 'moon_phase' })?.kind, 'moon');
    assert.equal(showTargetFor({ id: 'conj-Moon-Mars-2026-09-17', type: 'conjunction' }), null);
  });
});
