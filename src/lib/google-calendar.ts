/**
 * Pobranie wydarzeń z Google Calendar.
 *
 * Cienka warstwa nad jednym punktem API. Interpretacją zajmuje się
 * `calendar.ts`, który jest czysty i pokryty testami — tutaj zostaje samo
 * żądanie, bo tego nie da się sprawdzić bez sieci i cudzego konta.
 *
 * Zwraca `null` zamiast pustej listy, gdy pobranie się nie uda. To rozróżnienie
 * jest tu najważniejsze: **brak danych nie może udawać wolnego poranka**.
 * Pusta lista znaczy „sprawdziłem, nic nie masz", `null` znaczy „nie wiem" —
 * i wtedy wywołujący wraca do założenia z konfiguracji.
 *
 * Moduł działa i w CLI, i w aplikacji, więc nie sięga po nic, czego React
 * Native nie ma: limit czasu idzie przez `timeoutSignal`, a adres składamy
 * ręcznie.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import {
  effectiveCalendarIds,
  toCalendarEntries,
  toCalendarInfos,
  type CalendarEntry,
  type CalendarInfo,
} from './calendar.ts';
import {
  describeWithNote,
  toCalendarEvents,
  uniqueEvents,
  type CalendarEvent,
} from './calendar-view.ts';
import type { Booking } from './session-booking.ts';
import { timeoutSignal } from './timeout.ts';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/** Rezerwacje trafiają zawsze do głównego kalendarza. */
const API = `${CALENDAR_API}/calendars/primary/events`;

const eventsUrl = (calendarId: string) =>
  `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;

/** Ile czekamy na odpowiedź. Brief ma się skończyć, nawet gdy Google milczy. */
const TIMEOUT_MS = 10_000;

/**
 * Kody, które w tym module znaczą stan, a nie awarię: brak wpisu, nagrobek po
 * usunięciu i konflikt identyfikatora przy ponownej rezerwacji.
 */
const EXPECTED_STATUSES = new Set([404, 409, 410]);

/**
 * Jedno żądanie z limitem czasu; zegar sprzątany niezależnie od wyniku.
 *
 * Każda funkcja niżej zamienia porażkę w `null`, więc z zewnątrz odrzucony
 * token, brak uprawnień i zły format wpisu wyglądają identycznie. Prawdziwą
 * odpowiedź Google wypisujemy tutaj — w aplikacji ląduje w terminalu Metro,
 * w CLI na stderr.
 */
async function request(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  const timeout = timeoutSignal(TIMEOUT_MS, signal);
  const method = init.method ?? 'GET';

  try {
    const response = await fetch(url, { ...init, signal: timeout.signal });

    if (!response.ok && !EXPECTED_STATUSES.has(response.status)) {
      const body = await response
        .clone()
        .text()
        .catch(() => '');
      console.warn(`Google Calendar ${method} ${response.status}: ${body.slice(0, 500)}`);
    }

    return response;
  } catch (error) {
    console.warn(`Google Calendar ${method} nie doszło do skutku: ${String(error)}`);
    throw error;
  } finally {
    timeout.clear();
  }
}

const bearer = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

/**
 * Wydarzenia z jednej doby kalendarzowej.
 *
 * `singleEvents` rozwija cykliczne na pojedyncze wystąpienia — bez tego
 * cotygodniowe spotkanie wróciłoby jako jedna reguła powtarzania, a nie jako
 * konkretna godzina w konkretny wtorek.
 */
export async function fetchDayEntries(
  accessToken: string,
  day: Date,
  signal?: AbortSignal,
  calendarId: string = 'primary',
): Promise<CalendarEntry[] | null> {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);

  const query = Object.entries({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  try {
    const response = await request(
      `${eventsUrl(calendarId)}?${query}`,
      { headers: bearer(accessToken) },
      signal,
    );
    if (!response.ok) return null;

    const body = (await response.json()) as { items?: unknown };
    return toCalendarEntries(body.items);
  } catch {
    return null;
  }
}

/** Treść wydarzenia w kształcie, jakiego oczekuje API. */
function payload(booking: Booking) {
  return {
    summary: booking.title,
    description: booking.description,
    location: booking.location,
    start: { dateTime: booking.start.toISOString() },
    end: { dateTime: booking.end.toISOString() },
    // Wpis ma **zajmować** czas, inaczej nie zasłoniłby terminu nikomu, kto
    // szuka wolnego okna — a po to właśnie powstaje.
    transparency: 'opaque',
    // Jawnie, bo rezerwacja po odwołaniu trafia w ten sam identyfikator: Google
    // trzyma usunięty wpis jako odwołany, `POST` dostaje 409 i idzie `PATCH`.
    // Bez statusu o tym, czy wpis wróci, decydowałaby domyślna wartość po
    // stronie Google.
    status: 'confirmed',
  };
}

/**
 * Czy rezerwacja tej nocy wisi w kalendarzu.
 *
 * Odwołany wpis Google nadal zwraca — ze statusem `cancelled` — więc sam kod
 * 200 nie znaczy „jest". `null` znaczy „nie wiem", jak wszędzie w tym module.
 */
export async function fetchBooking(
  accessToken: string,
  bookingId: string,
  signal?: AbortSignal,
): Promise<{ exists: boolean } | null> {
  try {
    const response = await request(
      `${API}/${encodeURIComponent(bookingId)}`,
      { headers: bearer(accessToken) },
      signal,
    );

    if (response.status === 404 || response.status === 410) return { exists: false };
    if (!response.ok) return null;

    const event = (await response.json()) as { status?: unknown };
    return { exists: event.status !== 'cancelled' };
  } catch {
    return null;
  }
}

/**
 * Zapisuje rezerwację, nadpisując wcześniejszą wersję tej samej nocy.
 *
 * Dwa kroki, bo Google rozdziela te operacje: wstawienie z własnym
 * identyfikatorem to `POST`, a zmiana istniejącego — `PATCH`. Sam `PATCH`
 * zwróciłby 404 przy pierwszej rezerwacji, a sam `POST` — 409 przy drugiej.
 * `PATCH`, a nie `PUT`, bo zmienia tylko pola rezerwacji: notatka dopisana
 * w zakładce kalendarza leży w `extendedProperties` i ma przetrwać
 * aktualizację wpisu do nowej prognozy.
 * Konflikt jest tu stanem **oczekiwanym**: znaczy tyle, że tę noc już raz
 * rezerwowaliśmy, a prognoza od tego czasu się zmieniła.
 *
 * Zwraca `null` przy niepowodzeniu — wywołujący ma powiedzieć, że nie zapisał,
 * a nie udawać, że zapisał.
 */
/** To, co Google oddaje po zapisie — tyle, ile potrzeba do oceny wyniku. */
type SavedEvent = { status?: unknown; htmlLink?: unknown; start?: { dateTime?: unknown } };

const linkOf = (event: SavedEvent) => (typeof event.htmlLink === 'string' ? event.htmlLink : '');

/**
 * Wynik zapisu w logu. Kod 200 mówi tylko, że Google przyjął żądanie — czy wpis
 * jest widoczny i na jaki dzień trafił, widać dopiero w oddanym wydarzeniu.
 */
function reportSaved(method: string, event: SavedEvent) {
  console.info(
    `Google Calendar ${method}: status=${String(event.status)} ` +
      `start=${String(event.start?.dateTime)} ${linkOf(event)}`,
  );
}

export async function upsertBooking(
  accessToken: string,
  booking: Booking,
  signal?: AbortSignal,
): Promise<{ htmlLink: string; replaced: boolean } | null> {
  const headers = { ...bearer(accessToken), 'Content-Type': 'application/json' };

  try {
    const inserted = await request(
      API,
      { method: 'POST', headers, body: JSON.stringify({ id: booking.id, ...payload(booking) }) },
      signal,
    );

    if (inserted.ok) {
      const created = (await inserted.json()) as SavedEvent;
      reportSaved('POST', created);
      return { htmlLink: linkOf(created), replaced: false };
    }

    if (inserted.status !== 409) return null;

    const updated = await request(
      `${API}/${encodeURIComponent(booking.id)}`,
      { method: 'PATCH', headers, body: JSON.stringify(payload(booking)) },
      signal,
    );

    if (!updated.ok) return null;

    const event = (await updated.json()) as SavedEvent;
    reportSaved('PATCH', event);

    // Przyjęte nadpisanie, po którym wpis dalej jest odwołany, to nie
    // rezerwacja — zgłoszenie sukcesu byłoby tu kłamstwem.
    if (event.status === 'cancelled') return null;

    return { htmlLink: linkOf(event), replaced: true };
  } catch {
    return null;
  }
}

/**
 * Odwołuje rezerwację tej nocy.
 *
 * Identyfikator liczy się z miejsca i daty, więc odwołanie **nie musi niczego
 * pamiętać** — to główny zysk z wyliczanego klucza. Wystarczy ta sama noc i to
 * samo miejsce, żeby trafić w ten sam wpis.
 *
 * Brak wpisu (404 albo 410, gdy Google trzyma już tylko nagrobek po usunięciu)
 * traktujemy jako **sukces**: użytkownik chciał, żeby tego terminu nie było,
 * i nie ma go. Zgłaszanie tu błędu kazałoby mu się zastanawiać, czy przypadkiem
 * nie zostało coś, czego nie widzi.
 */
export async function deleteBooking(
  accessToken: string,
  bookingId: string,
  signal?: AbortSignal,
): Promise<{ existed: boolean } | null> {
  try {
    const response = await request(
      `${API}/${encodeURIComponent(bookingId)}`,
      { method: 'DELETE', headers: bearer(accessToken) },
      signal,
    );

    if (response.ok) return { existed: true };
    if (response.status === 404 || response.status === 410) return { existed: false };

    return null;
  } catch {
    return null;
  }
}

export type CalendarListResult =
  | { status: 'ok'; calendars: CalendarInfo[] }
  | { status: 'insufficient-scope' }
  | { status: 'failed' };

/**
 * Lista kalendarzy konta.
 *
 * Wymaga zakresu `calendar.calendarlist.readonly`. Token wydany przed jego
 * dodaniem dostaje 403 z brakiem uprawnień — to osobny wynik, bo naprawia go
 * ponowne połączenie konta, a nie ponowienie żądania. 403 z innego powodu
 * (limit zapytań) jest zwykłą porażką.
 */
export async function fetchCalendarList(
  accessToken: string,
  signal?: AbortSignal,
): Promise<CalendarListResult> {
  try {
    const response = await request(
      `${CALENDAR_API}/users/me/calendarList?maxResults=250`,
      { headers: bearer(accessToken) },
      signal,
    );

    if (response.status === 403) {
      const body = await response.text().catch(() => '');
      return /insufficient/i.test(body) ? { status: 'insufficient-scope' } : { status: 'failed' };
    }
    if (!response.ok) return { status: 'failed' };

    const body = (await response.json()) as { items?: unknown };
    return { status: 'ok', calendars: toCalendarInfos(body.items) };
  } catch {
    return { status: 'failed' };
  }
}

/**
 * Wydarzenia poranka ze wszystkich wybranych kalendarzy.
 *
 * Albo komplet, albo `null`. Poranek z jednego kalendarza z trzech wygląda na
 * wolniejszy, niż jest — to ta sama pomyłka co brak danych udający pusty
 * dzień, tylko częściowa.
 */
export async function fetchMorningEntries(
  accessToken: string,
  day: Date,
  calendarIds: readonly string[],
  signal?: AbortSignal,
): Promise<CalendarEntry[] | null> {
  const lists = await Promise.all(
    calendarIds.map((calendarId) => fetchDayEntries(accessToken, day, signal, calendarId)),
  );

  if (lists.some((list) => list === null)) return null;
  return (lists as CalendarEntry[][]).flat();
}

/**
 * Kalendarze do czytania — wspólne dla aplikacji i CLI: wybór z konfiguracji
 * sprawdzony z listą konta, a bez listy zapisany wybór albo główny.
 */
export async function resolveCalendarIds(
  accessToken: string,
  configured: readonly string[] | null,
): Promise<string[]> {
  const list = await fetchCalendarList(accessToken);
  return effectiveCalendarIds(configured, list.status === 'ok' ? list.calendars : null);
}

/**
 * Wydarzenia z zakresu dat do zakładki kalendarza — z tytułami.
 *
 * Tytuły trafiają wyłącznie na ekran: ten wynik nie przechodzi przez zapis na
 * dysku ani przez silnik. Albo komplet ze wszystkich kalendarzy, albo `null` —
 * z tego samego powodu co poranki: brakujący kalendarz wyglądałby na wolne dni.
 *
 * Bez stronicowania: 250 wpisów na kalendarz w sześciu tygodniach siatki to
 * więcej, niż ktokolwiek przejrzy na telefonie.
 */
export async function fetchRangeEvents(
  accessToken: string,
  from: Date,
  to: Date,
  calendarIds: readonly string[],
  signal?: AbortSignal,
): Promise<CalendarEvent[] | null> {
  const query = Object.entries({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const lists = await Promise.all(
    calendarIds.map(async (calendarId) => {
      try {
        const response = await request(
          `${eventsUrl(calendarId)}?${query}`,
          { headers: bearer(accessToken) },
          signal,
        );
        if (!response.ok) return null;

        const body = (await response.json()) as { items?: unknown };
        return toCalendarEvents(body.items, calendarId);
      } catch {
        return null;
      }
    }),
  );

  if (lists.some((list) => list === null)) return null;
  return uniqueEvents((lists as CalendarEvent[][]).flat());
}

/**
 * Ręczna zmiana zapisanej obserwacji: godziny i notatka.
 *
 * `PATCH`, więc tytuł, miejsce i reszta wpisu zostają. Notatka idzie w dwa
 * miejsca: do opisu, w wydzielonej sekcji — żeby było ją widać w samym Google
 * Calendar — i do `extendedProperties`, skąd aplikacja czyta ją bez
 * wyłuskiwania z tekstu.
 */
export async function patchObservation(
  accessToken: string,
  event: Pick<CalendarEvent, 'id' | 'description'>,
  change: { start: Date; end: Date; note: string },
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await request(
      `${API}/${encodeURIComponent(event.id)}`,
      {
        method: 'PATCH',
        headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: { dateTime: change.start.toISOString() },
          end: { dateTime: change.end.toISOString() },
          description: describeWithNote(event.description, change.note),
          extendedProperties: { private: { lunarisNote: change.note.trim() } },
        }),
      },
      signal,
    );

    return response.ok;
  } catch {
    return false;
  }
}
