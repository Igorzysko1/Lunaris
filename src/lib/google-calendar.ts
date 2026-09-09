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
