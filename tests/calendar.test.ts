/**
 * Kalendarz następnego dnia.
 *
 * Testy pilnują trzech rozstrzygnięć, z których każde da się pomylić w stronę
 * groźną — czyli taką, gdzie aplikacja obiecuje noc, której obiecywać nie
 * powinna:
 *
 * - **wpis całodniowy nie wyznacza pobudki** (potraktowany jako północ
 *   odrzucałby każdą noc przed każdym świętem);
 * - **wydarzenia w trakcie nocy nie liczą się** do rachunku snu;
 * - **wpis nie do odczytania nie ogranicza nocy**, ale też nie wywraca całości.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  dayKey,
  nextDayFromCalendar,
  nextDayWith,
  toCalendarEntries,
  toCalendarEntry,
  type CalendarEntry,
} from '../src/lib/calendar.ts';

/** Noc kończąca się o 4:12 w piątek 16 stycznia 2026. */
const NIGHT = { to: new Date(2026, 0, 16, 4, 12) };

const timed = (at: Date, over: Partial<CalendarEntry> = {}): CalendarEntry => ({
  startsAt: at,
  allDay: false,
  blocking: true,
  ...over,
});

describe('pierwsze wydarzenie po nocy', () => {
  it('bierze najwcześniejsze tego samego dnia', () => {
    const next = nextDayFromCalendar(NIGHT, [
      timed(new Date(2026, 0, 16, 14, 0)),
      timed(new Date(2026, 0, 16, 8, 30)),
      timed(new Date(2026, 0, 16, 11, 0)),
    ]);

    assert.deepEqual(next.firstEventAt, new Date(2026, 0, 16, 8, 30));
    assert.equal(next.dayOff, false);
  });

  it('pusty dzień nic nie ogranicza', () => {
    const next = nextDayFromCalendar(NIGHT, []);

    assert.equal(next.firstEventAt, null);
    assert.equal(next.dayOff, true);
  });

  it('nie zagląda do kolejnego dnia', () => {
    // Spotkanie w sobotę nie ma nic wspólnego z nocą z czwartku na piątek.
    const next = nextDayFromCalendar(NIGHT, [timed(new Date(2026, 0, 17, 8, 0))]);

    assert.equal(next.firstEventAt, null);
  });

  it('pomija wydarzenia wypadające w trakcie nocy', () => {
    // Coś o 2:00 nie skraca snu po obserwacji — to konflikt innego rodzaju
    // i wnoszenie go do rachunku pobudki dałoby bezsensowną liczbę.
    const next = nextDayFromCalendar(NIGHT, [
      timed(new Date(2026, 0, 16, 2, 0)),
      timed(new Date(2026, 0, 16, 9, 0)),
    ]);

    assert.deepEqual(next.firstEventAt, new Date(2026, 0, 16, 9, 0));
  });

  it('wydarzenie tuż po świcie liczy się normalnie', () => {
    const next = nextDayFromCalendar(NIGHT, [timed(new Date(2026, 0, 16, 5, 0))]);

    assert.deepEqual(next.firstEventAt, new Date(2026, 0, 16, 5, 0));
  });
});

describe('co nie ogranicza nocy', () => {
  it('wpis całodniowy nie wyznacza godziny pobudki', () => {
    // Najważniejsza reguła tego modułu. Urlop, święto czy imieniny oznaczają
    // dzień, a nie porę wstawania — jako północ odrzucałyby wszystko.
    const next = nextDayFromCalendar(NIGHT, [{ startsAt: null, allDay: true, blocking: true }]);

    assert.equal(next.firstEventAt, null);
    assert.equal(next.dayOff, true);
  });

  it('wpis całodniowy nie zasłania wydarzenia godzinowego', () => {
    const next = nextDayFromCalendar(NIGHT, [
      { startsAt: null, allDay: true, blocking: true },
      timed(new Date(2026, 0, 16, 9, 0)),
    ]);

    assert.deepEqual(next.firstEventAt, new Date(2026, 0, 16, 9, 0));
  });

  it('wydarzenie oznaczone jako wolne nie liczy się', () => {
    const next = nextDayFromCalendar(NIGHT, [
      timed(new Date(2026, 0, 16, 7, 0), { blocking: false }),
      timed(new Date(2026, 0, 16, 12, 0)),
    ]);

    assert.deepEqual(next.firstEventAt, new Date(2026, 0, 16, 12, 0));
  });
});

describe('odczyt odpowiedzi Google', () => {
  const event = (over: Record<string, unknown> = {}) => ({
    status: 'confirmed',
    start: { dateTime: '2026-01-16T09:00:00+01:00' },
    ...over,
  });

  it('czyta godzinę z pola dateTime', () => {
    const entry = toCalendarEntry(event());

    assert.deepEqual(entry?.startsAt, new Date('2026-01-16T09:00:00+01:00'));
    assert.equal(entry?.allDay, false);
    assert.equal(entry?.blocking, true);
  });

  it('rozpoznaje wydarzenie całodniowe po polu date', () => {
    const entry = toCalendarEntry({ start: { date: '2026-01-16' } });

    assert.equal(entry?.allDay, true);
    assert.equal(entry?.startsAt, null);
  });

  it('odwołane wydarzenie znika', () => {
    assert.equal(toCalendarEntry(event({ status: 'cancelled' })), null);
  });

  it('odrzucone zaproszenie nie zajmuje poranka', () => {
    const entry = toCalendarEntry(
      event({ attendees: [{ self: true, responseStatus: 'declined' }] }),
    );

    assert.equal(entry?.blocking, false);
  });

  it('cudza odmowa nie zwalnia mnie z obowiązku', () => {
    const entry = toCalendarEntry(
      event({ attendees: [{ self: false, responseStatus: 'declined' }] }),
    );

    assert.equal(entry?.blocking, true);
  });

  it('własna rezerwacja nie jest porannym wydarzeniem', () => {
    // Wpis na jutrzejszy wieczór wypada po świcie tego samego dnia — policzony,
    // ustawiałby pobudkę na godzinę wyjazdu.
    assert.equal(toCalendarEntry(event({ id: 'lunaris20260116sitebledoska' })), null);
    assert.notEqual(toCalendarEntry(event({ id: 'abc123' })), null);
  });

  it('przezroczystość oznacza „wolny"', () => {
    assert.equal(toCalendarEntry(event({ transparency: 'transparent' }))?.blocking, false);
  });

  it('zepsuta data nie ogranicza nocy i niczego nie wywraca', () => {
    // Kierunek pomyłki ma znaczenie: wpis nie do odczytania daje sesję krótszą
    // albo taką samą, nigdy obietnicę dłuższej.
    const entry = toCalendarEntry(event({ start: { dateTime: 'wczoraj' } }));

    assert.equal(entry?.startsAt, null);
    assert.equal(entry?.allDay, false);
  });

  it('lista przeżywa śmieci w środku', () => {
    // Wpisy, które nie są obiektem, wypadają w całości — zostają tylko te,
    // z których da się cokolwiek odczytać.
    const entries = toCalendarEntries([event(), null, 'tekst', 42, event()]);

    assert.equal(entries.length, 2);
    assert.ok(entries.every((e) => e.startsAt !== null));
  });

  it('cokolwiek innego niż lista daje pustkę, a nie wyjątek', () => {
    for (const value of [null, undefined, {}, 'x', 7]) {
      assert.deepEqual(toCalendarEntries(value), [], String(value));
    }
  });
});

describe('kalendarz w werdykcie', () => {
  const ASSUMED = { firstEventAt: new Date(2026, 0, 16, 7, 0), dayOff: false };
  const fallback = () => ASSUMED;

  it('klucz dnia jest lokalny, nie UTC', () => {
    // 0:30 czasu polskiego to w UTC jeszcze poprzedni dzień.
    assert.equal(dayKey(new Date(2026, 0, 16, 0, 30)), '2026-01-16');
  });

  it('poranek z pobranym kalendarzem liczy się z wydarzeń', () => {
    const days = new Map([[dayKey(NIGHT.to), [timed(new Date(2026, 0, 16, 10, 0))]]]);

    assert.deepEqual(nextDayWith(days, fallback)(NIGHT).firstEventAt, new Date(2026, 0, 16, 10, 0));
  });

  it('pusty dzień to wolny poranek, a nie brak danych', () => {
    const days = new Map([[dayKey(NIGHT.to), []]]);

    assert.equal(nextDayWith(days, fallback)(NIGHT).dayOff, true);
  });

  it('dzień, którego nie udało się pobrać, wraca do założenia', () => {
    // Najgroźniejsza pomyłka tej ścieżki: brak odpowiedzi potraktowany jak pusty
    // kalendarz dałby zielone światło nocy, która powinna odpaść.
    const days = new Map([[dayKey(new Date(2026, 0, 17)), []]]);

    assert.deepEqual(nextDayWith(days, fallback)(NIGHT), ASSUMED);
  });

  it('bez konta wszystko liczy się z założenia', () => {
    assert.deepEqual(nextDayWith(null, fallback)(NIGHT), ASSUMED);
  });
});
