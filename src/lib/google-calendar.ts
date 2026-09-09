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
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import { toCalendarEntries, type CalendarEntry } from './calendar.ts';
import type { Booking } from './session-booking.ts';

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/** Ile czekamy na odpowiedź. Brief ma się skończyć, nawet gdy Google milczy. */
const TIMEOUT_MS = 10_000;

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
): Promise<CalendarEntry[] | null> {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);

  const url = new URL(API);
  url.search = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  }).toString();

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });

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
  };
}

/**
 * Zapisuje rezerwację, nadpisując wcześniejszą wersję tej samej nocy.
 *
 * Dwa kroki, bo Google rozdziela te operacje: wstawienie z własnym
 * identyfikatorem to `POST`, a nadpisanie istniejącego — `PUT`. Sam `PUT`
 * zwróciłby 404 przy pierwszej rezerwacji, a sam `POST` — 409 przy drugiej.
 * Konflikt jest tu stanem **oczekiwanym**: znaczy tyle, że tę noc już raz
 * rezerwowaliśmy, a prognoza od tego czasu się zmieniła.
 *
 * Zwraca `null` przy niepowodzeniu — wywołujący ma powiedzieć, że nie zapisał,
 * a nie udawać, że zapisał.
 */
export async function upsertBooking(
  accessToken: string,
  booking: Booking,
  signal?: AbortSignal,
): Promise<{ htmlLink: string; replaced: boolean } | null> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  const timeout = () => signal ?? AbortSignal.timeout(TIMEOUT_MS);

  try {
    const inserted = await fetch(API, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: booking.id, ...payload(booking) }),
      signal: timeout(),
    });

    if (inserted.ok) {
      const created = (await inserted.json()) as { htmlLink?: unknown };
      return {
        htmlLink: typeof created.htmlLink === 'string' ? created.htmlLink : '',
        replaced: false,
      };
    }

    if (inserted.status !== 409) return null;

    const updated = await fetch(`${API}/${encodeURIComponent(booking.id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload(booking)),
      signal: timeout(),
    });

    if (!updated.ok) return null;

    const event = (await updated.json()) as { htmlLink?: unknown };
    return { htmlLink: typeof event.htmlLink === 'string' ? event.htmlLink : '', replaced: true };
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
    const response = await fetch(`${API}/${encodeURIComponent(bookingId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.ok) return { existed: true };
    if (response.status === 404 || response.status === 410) return { existed: false };

    return null;
  } catch {
    return null;
  }
}
