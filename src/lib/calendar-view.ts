/**
 * Kalendarz do oglądania — wydarzenia z nazwami, siatka miesiąca, propozycje sesji.
 *
 * Osobno od `calendar.ts`, i na tym polega cały podział. Tamten moduł odpowiada
 * silnikowi i świadomie nie zna tytułów: do rachunku snu wystarczą godziny,
 * a treść kalendarza nie ma powodu krążyć po werdyktach ani lądować w zapisie
 * na dysku. Zakładka kalendarza tytuły pokazuje — ale tylko na ekranie; nic
 * z tego modułu nie trafia do zapisu.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import { BOOKING_ID_PREFIX } from './session-booking.ts';

const DAY_MS = 86_400_000;

/** Wydarzenie w postaci do wyświetlenia. */
export type CalendarEvent = {
  id: string;
  calendarId: string;
  title: string;
  /**
   * Początek i koniec. Całodniowe mają północ pierwszego dnia i północ po
   * ostatnim — koniec jest wyłączny, tak jak podaje go Google.
   */
  start: Date;
  end: Date;
  allDay: boolean;
  /** Obserwacja zapisana przez Lunaris — jedyny rodzaj wpisu, który aplikacja zmienia. */
  observation: boolean;
  /** Opis wpisu bez zmian — potrzebny, żeby dopisanie notatki nie zgubiło reszty. */
  description: string;
  /** Notatka dopisana w aplikacji; pusta, gdy jej nie ma. */
  note: string;
};

/**
 * „2026-09-15" jako lokalna północ. `new Date('2026-09-15')` dałoby północ
 * UTC, czyli drugą w nocy w Polsce — i całodniowy wpis wchodziłby w poprzedni
 * dzień.
 */
function localDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function pointOf(value: unknown): { at: Date; allDay: boolean } | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { dateTime?: unknown; date?: unknown };

  if (typeof raw.dateTime === 'string') {
    const at = new Date(raw.dateTime);
    return Number.isNaN(at.getTime()) ? null : { at, allDay: false };
  }
  if (typeof raw.date === 'string') {
    const at = localDate(raw.date);
    return at ? { at, allDay: true } : null;
  }
  return null;
}

/**
 * Wydarzenia z odpowiedzi Google. Nigdy nie rzuca — wpis bez identyfikatora
 * albo z nieczytelną datą wypada, reszta zostaje.
 */
export function toCalendarEvents(items: unknown, calendarId: string): CalendarEvent[] {
  if (!Array.isArray(items)) return [];

  return items.flatMap((item): CalendarEvent[] => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    const id = raw.id;
    if (typeof id !== 'string' || id.length === 0 || raw.status === 'cancelled') return [];

    const start = pointOf(raw.start);
    if (!start) return [];
    const end = pointOf(raw.end);

    const extended = raw.extendedProperties as { private?: Record<string, unknown> } | undefined;
    const note = extended?.private?.lunarisNote;
    const summary = raw.summary;

    return [
      {
        id,
        calendarId,
        title: typeof summary === 'string' && summary.trim() ? summary : '(bez tytułu)',
        start: start.at,
        // Koniec przed początkiem to zepsuty wpis — pokazujemy go jako chwilę,
        // a nie jako wydarzenie cofające czas.
        end: end && end.at >= start.at ? end.at : start.at,
        allDay: start.allDay,
        observation: id.startsWith(BOOKING_ID_PREFIX),
        description: typeof raw.description === 'string' ? raw.description : '',
        note: typeof note === 'string' ? note : '',
      },
    ];
  });
}

/**
 * Ten sam wpis widziany z kilku wybranych kalendarzy — współdzielony albo
 * główny podany raz aliasem, raz adresem — ma się pokazać raz.
 */
export function uniqueEvents(events: readonly CalendarEvent[]): CalendarEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

export type MonthCell = { date: Date; inMonth: boolean };

/** Sześć tygodni od poniedziałka — ta sama siatka co w kalendarzu Księżyca. */
export function monthCells(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  // getDay(): 0 = niedziela. U nas tydzień zaczyna się w poniedziałek.
  const offset = (first.getDay() + 6) % 7;

  return Array.from({ length: 42 }, (_, i) => {
    // Dni kalendarzowe, nie doby po 24 h — zmiana czasu nie przesuwa siatki.
    const date = new Date(year, month, 1 - offset + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

/**
 * Wydarzenia zachodzące na dany dzień — całodniowe najpierw, potem po godzinie.
 *
 * Obserwacja od 21:00 do 2:15 należy do obu dni, tak jak w Google Calendar:
 * rano drugiego dnia też jest się po niej zajętym.
 */
export function eventsOnDay(events: readonly CalendarEvent[], day: Date): CalendarEvent[] {
  const from = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const to = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);

  return events
    .filter((event) =>
      event.start.getTime() === event.end.getTime()
        ? event.start >= from && event.start < to
        : event.start < to && event.end > from,
    )
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
}

/** Nagłówek sekcji notatki w opisie — widoczny także w samym Google Calendar. */
const NOTE_MARKER = '— Notatka z Lunaris —';

/**
 * Opis z notatką w wydzielonej sekcji na końcu.
 *
 * Sekcja jest podmieniana, a nie dopisywana: każda edycja notatki dokładałaby
 * inaczej kolejną kopię. Pusta notatka usuwa sekcję w całości.
 */
export function describeWithNote(description: string, note: string): string {
  const at = description.indexOf(NOTE_MARKER);
  const base = (at >= 0 ? description.slice(0, at) : description).trimEnd();
  const text = note.trim();

  if (!text) return base;
  return base ? `${base}\n\n${NOTE_MARKER}\n${text}` : `${NOTE_MARKER}\n${text}`;
}

/**
 * Czy ręcznie ustawione godziny mają sens. `null` znaczy „tak".
 *
 * Doba jako granica, bo krokiem po kwadransie łatwo przeskoczyć o dzień —
 * a wpis trwający półtorej doby blokowałby kalendarz, czego nikt nie chciał.
 */
export function checkObservationTimes(start: Date, end: Date): string | null {
  if (end.getTime() <= start.getTime()) return 'Koniec musi wypadać po początku.';
  if (end.getTime() - start.getTime() > DAY_MS) return 'Wpis nie może trwać dłużej niż doba.';
  return null;
}

/**
 * Noce „jedź" bez rezerwacji — to one stają się zarysami w kalendarzu.
 *
 * Rezerwację rozpoznajemy po identyfikatorze, więc noc zarezerwowana z karty
 * nocy znika z propozycji sama, bez żadnej dodatkowej pamięci.
 */
export function unbookedNights<T extends { bookingId: string; bookable: boolean }>(
  nights: readonly T[],
  events: readonly CalendarEvent[],
): T[] {
  const booked = new Set(events.map((event) => event.id));
  return nights.filter((night) => night.bookable && !booked.has(night.bookingId));
}
