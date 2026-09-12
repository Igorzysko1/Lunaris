/**
 * Rezerwacja sesji w kalendarzu.
 *
 * Dwie rzeczy są tu warte pilnowania, bo obie psują się cicho i obie kończą się
 * kalendarzem, który kłamie o Twojej dostępności:
 *
 * - **blok obejmuje cały wyjazd**, a nie samo okno obserwacyjne;
 * - **identyfikator jest wyliczany**, więc powtórna rezerwacja tej samej nocy
 *   nadpisuje wpis zamiast stawiać drugi obok.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bookingFor, bookingId, type BookingInput } from '../src/lib/session-booking.ts';
import type { NightVerdict } from '../src/lib/session-engine.ts';

const SITE = { id: 'site-bledowska', name: 'Pustynia Błędowska', lat: 50.35, lon: 19.53 };

const verdict = (over: Partial<NightVerdict> = {}): NightVerdict => ({
  night: { from: new Date(2026, 0, 15, 18, 0), to: new Date(2026, 0, 16, 6, 0) },
  status: 'go',
  window: {
    from: new Date(2026, 0, 15, 22, 0),
    to: new Date(2026, 0, 16, 1, 15),
    durationMinutes: 195,
    moonLimited: false,
  },
  plan: {
    departAt: new Date(2026, 0, 15, 21, 5),
    returnAt: new Date(2026, 0, 16, 2, 10),
    wakeAt: new Date(2026, 0, 16, 7, 40),
    sleepHours: 5.5,
    travelMinutes: 40,
  },
  rejection: null,
  warnings: [],
  ...over,
});

const input = (over: Partial<BookingInput> = {}): BookingInput => ({
  verdict: verdict(),
  site: SITE,
  rating: 78,
  ...over,
});

describe('blok obejmuje wyjazd, nie samo okno', () => {
  it('zaczyna się o wyjeździe i kończy o powrocie', () => {
    // Wpis od 22:00 do 01:15 kłamałby w obie strony: sugerowałby, że o 21:05
    // jeszcze można na mnie liczyć, i że o 02:00 już można.
    const booking = bookingFor(input());

    assert.deepEqual(booking?.start, new Date(2026, 0, 15, 21, 5));
    assert.deepEqual(booking?.end, new Date(2026, 0, 16, 2, 10));
  });

  it('okno obserwacyjne nie ginie, tylko schodzi do opisu', () => {
    const booking = bookingFor(input());

    assert.match(booking!.description, /Obserwacja 22:00–01:15/);
  });

  it('opis niesie to, co przyda się przed wyjazdem', () => {
    const booking = bookingFor(input({ targets: ['M42', 'M45'] }));

    assert.match(booking!.description, /Ocena nocy: 78\/100/);
    assert.match(booking!.description, /Dojazd 40 min/);
    assert.match(booking!.description, /5\.5 h snu, pobudka 07:40/);
    assert.match(booking!.description, /Cele: M42, M45/);
  });

  it('bez punktu startowego pomija dojazd, zamiast pisać zero', () => {
    // Zero minut znaczy „nie ustawiono domu", a nie „dojazd nic nie zajmuje";
    // wypisane wyglądałoby jak zmierzona wartość.
    const noHome = verdict();
    noHome.plan!.travelMinutes = 0;

    assert.doesNotMatch(bookingFor(input({ verdict: noHome }))!.description, /Dojazd/);
  });

  it('ograniczenie księżycowe jest powiedziane wprost', () => {
    const moonlit = verdict();
    moonlit.window!.moonLimited = true;

    assert.match(bookingFor(input({ verdict: moonlit }))!.description, /tylko cele księżycowe/);
  });

  it('współrzędne zamiast nazwy — nawigacja ma dokąd prowadzić', () => {
    assert.equal(bookingFor(input())?.location, '50.35000, 19.53000');
  });
});

describe('identyfikator', () => {
  it('ta sama noc i miejsce dają ten sam wpis', () => {
    // Na tym stoi nadpisywanie: prognoza zmienia się co dobę, więc rezerwacja
    // z rana i ta z wieczora dotyczą tej samej nocy w dwóch wersjach.
    assert.equal(bookingFor(input())?.id, bookingFor(input())?.id);
  });

  it('inna noc daje inny wpis', () => {
    const later = verdict();
    later.night = { from: new Date(2026, 0, 16, 18, 0), to: new Date(2026, 0, 17, 6, 0) };

    assert.notEqual(bookingFor(input())?.id, bookingFor(input({ verdict: later }))?.id);
  });

  it('inna miejscówka tej samej nocy nie kasuje poprzedniej', () => {
    // Zdarza się przy porównywaniu wariantów wyjazdu.
    const other = { ...SITE, id: 'site-zborow', name: 'Góra Zborów' };

    assert.notEqual(bookingFor(input())?.id, bookingFor(input({ site: other }))?.id);
  });

  it('mieści się w alfabecie, którego wymaga Google', () => {
    // Dozwolone są cyfry i litery a–v; nazwa miejsca przechodzi przez filtr,
    // więc identyfikator nie wywali się na myślniku ani na polskim znaku.
    const odd = { ...SITE, id: 'Miejscówka Żółć-1' };
    const id = bookingFor(input({ site: odd }))!.id;

    assert.match(id, /^[0-9a-v]+$/);
    assert.ok(id.length >= 5 && id.length <= 1024);
  });
});

describe('czego nie rezerwujemy', () => {
  it('nocy odrzuconej', () => {
    // Wpisanie do kalendarza terminu, który aplikacja właśnie odradza, byłoby
    // sprzecznością samą w sobie.
    assert.equal(bookingFor(input({ verdict: verdict({ status: 'no-go' }) })), null);
  });

  it('nocy bez planu wyjazdu', () => {
    assert.equal(bookingFor(input({ verdict: verdict({ plan: null }) })), null);
  });
});

describe('identyfikator bez gotowej rezerwacji', () => {
  it('jest ten sam co w rezerwacji — odwołanie trafia w ten sam wpis', () => {
    const booking = bookingFor({ verdict: verdict(), site: SITE, rating: 80 });

    assert.equal(bookingId(verdict().night, SITE.id), booking?.id);
  });

  it('powstaje także dla nocy, która odpadła', () => {
    // Prognoza się zepsuła, a wpis sprzed zmiany wciąż wisi w kalendarzu:
    // rezerwacji już nie zbudujemy, ale odwołać trzeba umieć.
    const rejected = verdict({ status: 'no-go', plan: null });

    assert.equal(bookingFor({ verdict: rejected, site: SITE, rating: 20 }), null);
    assert.equal(bookingId(rejected.night, SITE.id), bookingId(verdict().night, SITE.id));
  });
});
