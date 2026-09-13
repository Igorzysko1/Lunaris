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

import { BOOKING_ID_PREFIX } from './session-booking.ts';
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
  return { firstEventAt, dayOff: firstEventAt === null, source: 'calendar' };
}

/**
 * Wydarzenia pobrane na kolejne poranki, po kluczu dnia.
 *
 * Brak klucza znaczy „nie udało się pobrać", a nie „pusty dzień" — pusty dzień
 * to klucz z pustą listą. Na tym rozróżnieniu stoi `nextDayWith`.
 */
export type CalendarDays = ReadonlyMap<string, CalendarEntry[]>;

/**
 * Klucz doby w czasie lokalnym. `toISOString` dałby dobę w UTC, czyli dla
 * chwil tuż po północy czasu polskiego — dzień poprzedni.
 */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * `nextDay` dla silnika: prawdziwy kalendarz tam, gdzie go mamy, założenie tam,
 * gdzie nie.
 *
 * Rozstrzyga **każdy poranek osobno** — nieudane pobranie jednego dnia nie
 * cofa pozostałych do założenia i nie udaje, że ten jeden jest wolny.
 */
export function nextDayWith<N extends { to: Date }>(
  days: CalendarDays | null,
  fallback: (night: N) => NextDay,
): (night: N) => NextDay {
  return (night) => {
    const entries = days?.get(dayKey(night.to));
    return entries ? nextDayFromCalendar(night, entries) : fallback(night);
  };
}

/** Poranek zapisany na dysku — ostatnie udane pobranie tego dnia. */
export type StoredCalendarDay = { savedAt: Date; entries: CalendarEntry[] };

const STORE_VERSION = 1;
const HOUR_MS = 3_600_000;

/**
 * Jak długo zapis kalendarza zastępuje brak sieci.
 *
 * Krócej niż prognoza, i celowo: stary zapis nie zna spotkań dopisanych po
 * nim, a przemilczane spotkanie daje sesję dłuższą, niż powinna być — jedyny
 * groźny kierunek pomyłki w tym module. Doba wystarcza na wyjazd bez zasięgu,
 * a nie pozwala planować z kalendarza sprzed tygodnia.
 */
export const CALENDAR_CACHE_MAX_AGE_HOURS = 24;

function isFresh(day: StoredCalendarDay, now: Date, maxAgeHours: number): boolean {
  const age = (now.getTime() - day.savedAt.getTime()) / HOUR_MS;
  // Zapis z przyszłości znaczy przestawiony zegar — też mu nie ufamy.
  return age >= 0 && age <= maxAgeHours;
}

/**
 * Świeżo pobrane dni uzupełnione zapisem tam, gdzie pobranie się nie udało.
 *
 * Świeże zawsze wygrywają. Zapis wchodzi tylko w luki i tylko dość młody.
 */
export function fillFromStore(
  fresh: ReadonlyMap<string, CalendarEntry[]>,
  stored: ReadonlyMap<string, StoredCalendarDay>,
  keys: readonly string[],
  now: Date,
  maxAgeHours = CALENDAR_CACHE_MAX_AGE_HOURS,
): Map<string, CalendarEntry[]> {
  const result = new Map(fresh);

  for (const key of keys) {
    const day = stored.get(key);
    if (!result.has(key) && day && isFresh(day, now, maxAgeHours)) {
      result.set(key, day.entries);
    }
  }

  return result;
}

/**
 * Zapis po udanym pobraniu: nowe dni nadpisują stare, a przeterminowane
 * wypadają, żeby zapis nie rósł z każdym tygodniem.
 */
export function updateStore(
  stored: ReadonlyMap<string, StoredCalendarDay>,
  fresh: ReadonlyMap<string, CalendarEntry[]>,
  now: Date,
  maxAgeHours = CALENDAR_CACHE_MAX_AGE_HOURS,
): Map<string, StoredCalendarDay> {
  const result = new Map<string, StoredCalendarDay>();

  for (const [key, day] of stored) {
    if (isFresh(day, now, maxAgeHours)) result.set(key, day);
  }
  for (const [key, entries] of fresh) result.set(key, { savedAt: now, entries });

  return result;
}

/** Zapis do tekstu. Daty jako ISO — `JSON.parse` sam ich z powrotem nie ożywi. */
export function serializeStore(store: ReadonlyMap<string, StoredCalendarDay>): string {
  const days = Object.fromEntries(
    [...store].map(([key, day]) => [
      key,
      {
        savedAt: day.savedAt.toISOString(),
        entries: day.entries.map((entry) => ({
          ...entry,
          startsAt: entry.startsAt?.toISOString() ?? null,
        })),
      },
    ]),
  );

  return JSON.stringify({ version: STORE_VERSION, days });
}

/**
 * Odczyt zapisu. Nigdy nie rzuca: uszkodzony zapis to pusty zapis, a nie
 * awaria — i tak jak przy odpowiedzi Google, wpis nie do odczytania wypada,
 * zamiast udawać wolny poranek pod inną postacią.
 */
export function parseStore(raw: string | null): Map<string, StoredCalendarDay> {
  const result = new Map<string, StoredCalendarDay>();
  if (!raw) return result;

  let parsed: { version?: unknown; days?: unknown };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return result;
  }

  if (parsed?.version !== STORE_VERSION || !parsed.days || typeof parsed.days !== 'object') {
    return result;
  }

  for (const [key, value] of Object.entries(parsed.days as Record<string, unknown>)) {
    const day = value as { savedAt?: unknown; entries?: unknown };
    const savedAt = new Date(String(day?.savedAt));
    // Dzień z uszkodzoną listą wypada w całości: jego część byłaby pustszym
    // porankiem, niż był naprawdę.
    if (Number.isNaN(savedAt.getTime()) || !Array.isArray(day.entries)) continue;

    const entries: CalendarEntry[] = [];
    let broken = false;
    for (const item of day.entries) {
      const entry = item as { startsAt?: unknown; allDay?: unknown; blocking?: unknown };
      const startsAt = typeof entry?.startsAt === 'string' ? new Date(entry.startsAt) : null;
      if (
        typeof entry?.allDay !== 'boolean' ||
        typeof entry.blocking !== 'boolean' ||
        (startsAt !== null && Number.isNaN(startsAt.getTime()))
      ) {
        broken = true;
        break;
      }
      entries.push({ startsAt, allDay: entry.allDay, blocking: entry.blocking });
    }

    if (!broken) result.set(key, { savedAt, entries });
  }

  return result;
}

/**
 * Kształt wydarzenia, jaki zwraca Google Calendar API.
 *
 * Trzymamy go osobno od `CalendarEntry`, bo to dwie różne rzeczy: tamto jest
 * pytaniem silnika, a to odpowiedzią konkretnego dostawcy. Podmiana kalendarza
 * na inny dotknie tylko tego typu i funkcji poniżej.
 */
export type GoogleEvent = {
  id?: string;
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

  // Własna rezerwacja to noc, którą planujemy, a nie poranek po niej. Wpis na
  // jutrzejszy wieczór wypada po świcie tego samego dnia, więc policzony jako
  // wydarzenie ustawiałby pobudkę na godzinę wyjazdu.
  if (typeof event.id === 'string' && event.id.startsWith(BOOKING_ID_PREFIX)) return null;

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

/** Alias głównego kalendarza konta w API Google. */
export const PRIMARY_CALENDAR = 'primary';

/**
 * Kalendarz z listy konta — tyle, ile potrzeba do wyboru w Ustawieniach.
 *
 * Nazwa kalendarza to nie treść wydarzeń: „Praca" czy „Sport" użytkownik nadał
 * sam i bez niej nie da się niczego wybrać.
 */
export type CalendarInfo = {
  id: string;
  name: string;
  primary: boolean;
  /** Widoczny w Google Calendar — Google trzyma to per użytkownik. */
  selected: boolean;
  /** `owner` i `writer` to własne kalendarze; `reader` to subskrypcje i cudze. */
  accessRole: string;
  color: string | null;
};

/**
 * Lista kalendarzy z odpowiedzi Google. Nigdy nie rzuca; brakujące pole nie
 * daje uprawnień, których Google nie potwierdził.
 */
export function toCalendarInfos(items: unknown): CalendarInfo[] {
  if (!Array.isArray(items)) return [];

  return items.flatMap((item): CalendarInfo[] => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    const id = raw.id;
    if (typeof id !== 'string' || id.length === 0) return [];

    const name =
      [raw.summaryOverride, raw.summary].find(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ) ?? id;

    return [
      {
        id,
        name,
        primary: raw.primary === true,
        selected: raw.selected === true,
        accessRole: typeof raw.accessRole === 'string' ? raw.accessRole : 'reader',
        color: typeof raw.backgroundColor === 'string' ? raw.backgroundColor : null,
      },
    ];
  });
}

/**
 * Które kalendarze liczą się, gdy użytkownik niczego nie wybrał.
 *
 * Główny zawsze. Poza nim te widoczne w Google Calendar i należące do
 * użytkownika — `owner` albo `writer`. Subskrypcje (święta, urodziny, kalendarze
 * cudzych zespołów) mają rolę `reader` i odpadają same: urodziny znajomego nie
 * są porannym obowiązkiem, a wydarzenie, na które nikt mnie nie zaprosił, nie
 * wyznacza mojej pobudki.
 */
export function defaultCalendarIds(calendars: readonly CalendarInfo[]): string[] {
  const ids = calendars
    .filter(
      (c) => c.primary || (c.selected && (c.accessRole === 'owner' || c.accessRole === 'writer')),
    )
    .map((c) => c.id);

  return ids.length > 0 ? ids : [PRIMARY_CALENDAR];
}

/**
 * Kalendarze do czytania: wybór z konfiguracji, jeśli coś z niego wciąż
 * istnieje, w przeciwnym razie domyślne.
 *
 * Kalendarz usunięty w Google znika z wyboru po cichu. Bez listy konta (stary
 * token, brak sieci) nie ma jak sprawdzić, co istnieje — zostaje zapisany wybór
 * albo główny.
 */
export function effectiveCalendarIds(
  configured: readonly string[] | null,
  calendars: readonly CalendarInfo[] | null,
): string[] {
  if (!calendars) {
    return configured && configured.length > 0 ? [...configured] : [PRIMARY_CALENDAR];
  }

  const known = new Set(calendars.map((c) => c.id));
  const chosen = (configured ?? []).filter((id) => known.has(id) || id === PRIMARY_CALENDAR);

  return chosen.length > 0 ? chosen : defaultCalendarIds(calendars);
}
