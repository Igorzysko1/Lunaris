/**
 * Kalendarz następnego dnia — realne godziny zamiast założenia.
 *
 * Silnik pyta o jedną rzecz: o której zaczyna się pierwsze wydarzenie rano po
 * nocy. Z niej wynika godzina pobudki, z pobudki liczba godzin snu, a z niej
 * skrócenie sesji albo jej odrzucenie. Dotąd odpowiadał na to `assumedNextDay`,
 * czyli zapisana w konfiguracji ósma — ten moduł zastępuje zgadywanie faktem.
 *
 * ## Brak danych to nie to samo co pusty kalendarz
 *
 * Najgroźniejszy błąd w tej ścieżce jest cichy: nieudane pobranie albo sięgnięcie
 * po niewłaściwy kalendarz wygląda dokładnie jak „nic nie mam zaplanowane", czyli
 * daje zielone światło na noce, które powinny odpaść. Dlatego funkcja przyjmuje
 * **listę wydarzeń, a nie ich brak** — o tym, czy dane w ogóle dotarły,
 * rozstrzyga wywołujący i przy niepowodzeniu wraca do `assumedNextDay`.
 * Reguła jest prosta: milczenie sieci nigdy nie może udawać wolnego poranka.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { NextDay } from './session-engine.ts';

/**
 * Wpis kalendarza sprowadzony do tego, co interesuje silnik.
 *
 * Celowo bez tytułu i uczestników: silnikowi nie są potrzebne, a ich brak
 * oznacza, że treść kalendarza nie krąży po module, który liczy werdykty.
 */
export type CalendarEntry = {
  /** Początek wydarzenia; `null` dla całodniowych — te nie mają godziny. */
  startsAt: Date | null;
  /**
   * Wydarzenie całodniowe: urlop, święto, termin, imieniny.
   *
   * **Nie wyznacza godziny pobudki** i to jest decyzja, nie przeoczenie.
   * Wpis całodniowy mówi, że dzień jest czymś oznaczony, a nie o której trzeba
   * wstać; potraktowany jako północ odrzucałby każdą noc przed każdym świętem,
   * a większość takich wpisów to właśnie dni, w które można sobie pospać.
   * Konferencja czy szkolenie mają zwykle także wpisy godzinowe i to one
   * zadziałają.
   */
  allDay: boolean;
  /**
   * Czy wydarzenie zajmuje czas. Wpisy oznaczone w kalendarzu jako „wolny"
   * (`transparency: transparent`) i odrzucone zaproszenia nie ograniczają nocy.
   */
  blocking: boolean;
};

/** Koniec doby kalendarzowej, w której wypada ten moment. */
function endOfDay(moment: Date): Date {
  const end = new Date(moment);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Kalendarz następnego dnia policzony z prawdziwych wydarzeń.
 *
 * Bierzemy pod uwagę wyłącznie wydarzenia zaczynające się **po końcu nocy**
 * i jeszcze tego samego dnia. Wcześniejsze odpadają, bo wydarzenie wypadające
 * w trakcie obserwacji to konflikt innego rodzaju niż niedospana noc i nie ma
 * czego wnosić do rachunku snu. Późniejsze dni nie mają związku z tą nocą.
 */
export function nextDayFromCalendar(night: { to: Date }, entries: CalendarEntry[]): NextDay {
  const morning = night.to;
  const limit = endOfDay(morning);

  const timed = entries
    .filter((entry) => entry.blocking && !entry.allDay && entry.startsAt !== null)
    .map((entry) => entry.startsAt as Date)
    .filter((at) => at >= morning && at <= limit)
    .sort((a, b) => a.getTime() - b.getTime());

  const firstEventAt = timed[0] ?? null;

  // „Dzień wolny" znaczy tu dokładnie tyle: nic nie wyznacza godziny pobudki.
  // Nie zgadujemy już weekendów — sobota z wizytą o dziewiątej ogranicza noc
  // tak samo jak wtorek, a pusta środa nie ogranicza jej wcale.
  return { firstEventAt, dayOff: firstEventAt === null };
}

/**
 * Kształt wydarzenia, jaki zwraca Google Calendar API.
 *
 * Trzymamy go osobno od `CalendarEntry`, bo to dwie różne rzeczy: tamto jest
 * pytaniem silnika, a to odpowiedzią konkretnego dostawcy. Podmiana kalendarza
 * na inny dotknie tylko tego typu i funkcji poniżej.
 */
export type GoogleEvent = {
  status?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
};

/**
 * Sprowadza odpowiedź Google do postaci, którą rozumie silnik.
 *
 * Nigdy nie rzuca: odpowiedź przychodzi z sieci, więc jej zepsucie jest stanem
 * normalnym. Wpis, którego nie da się odczytać, po prostu nie ogranicza nocy —
 * i to jest jedyny bezpieczny kierunek pomyłki, bo wynikiem jest sesja krótsza
 * albo taka sama, nigdy obietnica dłuższej.
 */
export function toCalendarEntry(event: GoogleEvent): CalendarEntry | null {
  if (!event || typeof event !== 'object') return null;
  if (event.status === 'cancelled') return null;

  // Zaproszenie, które odrzuciłem, nie zajmuje mi poranka.
  const declined = (event.attendees ?? []).some(
    (attendee) => attendee?.self && attendee.responseStatus === 'declined',
  );

  const dateTime = event.start?.dateTime;
  const parsed = typeof dateTime === 'string' ? new Date(dateTime) : null;
  const startsAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

  return {
    startsAt,
    // Całodniowe Google podaje jako `date` bez godziny.
    allDay: typeof event.start?.date === 'string' && startsAt === null,
    blocking: !declined && event.transparency !== 'transparent',
  };
}

/** Cała odpowiedź listy wydarzeń — z pominięciem wpisów nie do odczytania. */
export function toCalendarEntries(events: unknown): CalendarEntry[] {
  if (!Array.isArray(events)) return [];

  return events
    .map((event) => toCalendarEntry(event as GoogleEvent))
    .filter((entry): entry is CalendarEntry => entry !== null);
}
