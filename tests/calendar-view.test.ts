/**
 * Zakładka kalendarza — to, co da się sprawdzić bez ekranu i bez sieci.
 *
 * Najłatwiej pomylić się tu w datach: całodniowy wpis podawany przez Google
 * jako sama data, koniec wyłączny, noc przechodząca przez północ. Każda z tych
 * pomyłek przesuwa wpis na inny dzień siatki, a na ekranie wygląda wiarygodnie.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  checkObservationTimes,
  describeWithNote,
  eventsOnDay,
  monthCells,
  toCalendarEvents,
  uniqueEvents,
  unbookedNights,
  type CalendarEvent,
} from '../src/lib/calendar-view.ts';

const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e1',
  calendarId: 'primary',
  title: 'Spotkanie',
  start: new Date(2026, 8, 15, 9, 0),
  end: new Date(2026, 8, 15, 10, 0),
  allDay: false,
  observation: false,
  description: '',
  note: '',
  ...over,
});

describe('odczyt wydarzeń z Google', () => {
  it('czyta wydarzenie godzinowe', () => {
    const [first] = toCalendarEvents(
      [
        {
          id: 'abc',
          summary: 'Dentysta',
          start: { dateTime: '2026-09-15T09:00:00+02:00' },
          end: { dateTime: '2026-09-15T09:30:00+02:00' },
        },
      ],
      'primary',
    );

    assert.equal(first.title, 'Dentysta');
    assert.deepEqual(first.start, new Date('2026-09-15T09:00:00+02:00'));
    assert.equal(first.allDay, false);
    assert.equal(first.observation, false);
  });

  it('całodniowy wpis zaczyna się o lokalnej północy', () => {
    // `new Date('2026-09-15')` to północ UTC — w Polsce druga w nocy, a przy
    // strefie na zachód od Greenwich dzień wcześniej.
    const [first] = toCalendarEvents(
      [
        {
          id: 'urlop',
          summary: 'Urlop',
          start: { date: '2026-09-15' },
          end: { date: '2026-09-16' },
        },
      ],
      'primary',
    );

    assert.deepEqual(first.start, new Date(2026, 8, 15));
    assert.deepEqual(first.end, new Date(2026, 8, 16));
    assert.equal(first.allDay, true);
  });

  it('rozpoznaje obserwację i jej notatkę', () => {
    const [first] = toCalendarEvents(
      [
        {
          id: 'lunaris20260915gps',
          summary: 'Obserwacja — Jaworzno',
          description: 'Obserwacja 22:00–01:15.',
          start: { dateTime: '2026-09-15T21:00:00+02:00' },
          end: { dateTime: '2026-09-16T02:15:00+02:00' },
          extendedProperties: { private: { lunarisNote: 'Wziąć termos' } },
        },
      ],
      'primary',
    );

    assert.equal(first.observation, true);
    assert.equal(first.note, 'Wziąć termos');
    assert.equal(first.description, 'Obserwacja 22:00–01:15.');
  });

  it('odwołane, bez identyfikatora i z zepsutą datą wypadają', () => {
    const events = toCalendarEvents(
      [
        { id: 'a', status: 'cancelled', start: { dateTime: '2026-09-15T09:00:00Z' } },
        { summary: 'bez id', start: { dateTime: '2026-09-15T09:00:00Z' } },
        { id: 'b', start: { dateTime: 'wczoraj' } },
        null,
        { id: 'ok', start: { dateTime: '2026-09-15T09:00:00Z' } },
      ],
      'primary',
    );

    assert.deepEqual(
      events.map((e) => e.id),
      ['ok'],
    );
    assert.equal(events[0].title, '(bez tytułu)');
  });

  it('koniec przed początkiem nie cofa czasu', () => {
    const [first] = toCalendarEvents(
      [
        {
          id: 'x',
          start: { dateTime: '2026-09-15T10:00:00Z' },
          end: { dateTime: '2026-09-15T09:00:00Z' },
        },
      ],
      'primary',
    );

    assert.deepEqual(first.end, first.start);
  });

  it('ten sam wpis z dwóch kalendarzy pokazuje się raz', () => {
    const shared = event({ id: 'shared' });

    assert.equal(uniqueEvents([shared, { ...shared, calendarId: 'praca' }]).length, 1);
  });
});

describe('siatka miesiąca', () => {
  it('sześć tygodni od poniedziałka', () => {
    // 1 września 2026 to wtorek, więc siatka zaczyna się od 31 sierpnia.
    const cells = monthCells(2026, 8);

    assert.equal(cells.length, 42);
    assert.deepEqual(cells[0].date, new Date(2026, 7, 31));
    assert.equal(cells[0].inMonth, false);
    assert.deepEqual(cells[1].date, new Date(2026, 8, 1));
    assert.ok(cells.every((c) => c.date.getDay() === [1, 2, 3, 4, 5, 6, 0][cells.indexOf(c) % 7]));
  });

  it('zmiana czasu nie przesuwa dni', () => {
    // Październik 2026: w nocy z 24 na 25 zegar cofa się o godzinę.
    const cells = monthCells(2026, 9);

    assert.ok(cells.every((c) => c.date.getHours() === 0));
  });
});

describe('wydarzenia dnia', () => {
  const DAY = new Date(2026, 8, 15);

  it('nocna obserwacja należy do obu dni', () => {
    const night = event({
      id: 'obs',
      start: new Date(2026, 8, 15, 21, 0),
      end: new Date(2026, 8, 16, 2, 15),
    });

    assert.equal(eventsOnDay([night], DAY).length, 1);
    assert.equal(eventsOnDay([night], new Date(2026, 8, 16)).length, 1);
    assert.equal(eventsOnDay([night], new Date(2026, 8, 17)).length, 0);
  });

  it('całodniowy wpis nie wchodzi w następny dzień', () => {
    // Koniec jest wyłączny: urlop 15 września kończy się o północy 16.
    const leave = event({ allDay: true, start: DAY, end: new Date(2026, 8, 16) });

    assert.equal(eventsOnDay([leave], DAY).length, 1);
    assert.equal(eventsOnDay([leave], new Date(2026, 8, 16)).length, 0);
  });

  it('wydarzenie bez długości liczy się w dniu, w którym wypada', () => {
    const moment = event({ start: new Date(2026, 8, 15, 0, 0), end: new Date(2026, 8, 15, 0, 0) });

    assert.equal(eventsOnDay([moment], DAY).length, 1);
    assert.equal(eventsOnDay([moment], new Date(2026, 8, 14)).length, 0);
  });

  it('całodniowe najpierw, potem po godzinie', () => {
    const late = event({
      id: 'late',
      start: new Date(2026, 8, 15, 18, 0),
      end: new Date(2026, 8, 15, 19, 0),
    });
    const early = event({
      id: 'early',
      start: new Date(2026, 8, 15, 8, 0),
      end: new Date(2026, 8, 15, 9, 0),
    });
    const allDay = event({ id: 'all', allDay: true, start: DAY, end: new Date(2026, 8, 16) });

    assert.deepEqual(
      eventsOnDay([late, early, allDay], DAY).map((e) => e.id),
      ['all', 'early', 'late'],
    );
  });
});

describe('notatka w opisie', () => {
  it('dopisuje sekcję na końcu', () => {
    const text = describeWithNote('Obserwacja 22:00–01:15.', 'Wziąć termos');

    assert.match(text, /^Obserwacja 22:00–01:15\.\n\n— Notatka z Lunaris —\nWziąć termos$/);
  });

  it('kolejna edycja podmienia sekcję, a nie dokłada drugiej', () => {
    const once = describeWithNote('Opis', 'Pierwsza');
    const twice = describeWithNote(once, 'Druga');

    assert.equal(twice, describeWithNote('Opis', 'Druga'));
    assert.equal(twice.split('Notatka z Lunaris').length, 2);
  });

  it('pusta notatka usuwa sekcję', () => {
    assert.equal(describeWithNote(describeWithNote('Opis', 'X'), '   '), 'Opis');
  });

  it('działa także przy pustym opisie', () => {
    assert.equal(describeWithNote('', 'Sama notatka'), '— Notatka z Lunaris —\nSama notatka');
  });
});

describe('ręczne godziny obserwacji', () => {
  const START = new Date(2026, 8, 15, 21, 0);

  it('przyjmuje zwykłą noc', () => {
    assert.equal(checkObservationTimes(START, new Date(2026, 8, 16, 2, 0)), null);
  });

  it('koniec nie może wypaść przed początkiem ani razem z nim', () => {
    assert.ok(checkObservationTimes(START, new Date(2026, 8, 15, 20, 45)));
    assert.ok(checkObservationTimes(START, START));
  });

  it('wpis dłuższy niż doba to pomyłka przy przestawianiu', () => {
    assert.ok(checkObservationTimes(START, new Date(2026, 8, 16, 21, 15)));
  });
});

describe('propozycje sesji', () => {
  const nights = [
    { bookingId: 'lunaris20260915gps', bookable: true },
    { bookingId: 'lunaris20260916gps', bookable: true },
    { bookingId: 'lunaris20260917gps', bookable: false },
  ];

  it('zarezerwowana noc i noc bez werdyktu „jedź" nie są propozycjami', () => {
    const booked = [event({ id: 'lunaris20260915gps', observation: true })];

    assert.deepEqual(
      unbookedNights(nights, booked).map((n) => n.bookingId),
      ['lunaris20260916gps'],
    );
  });
});
