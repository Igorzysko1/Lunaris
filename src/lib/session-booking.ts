/**
 * Sesja obserwacyjna jako wpis w kalendarzu.
 *
 * Werdykt mówi „jedź, okno 22:00–01:15". Kalendarz musi z tego zrobić blok, po
 * którym inni poznają, że jesteś zajęty — i to jest cała trudność, bo **to nie
 * są te same godziny**.
 *
 * ## Blokujemy wyjazd, opisujemy obserwację
 *
 * Wpis obejmuje `departAt` → `returnAt`, czyli wyjazd, dojazd, rozstawienie,
 * obserwację, zwijanie i powrót. Tyle realnie jesteś nieosiągalny i tyle ma
 * widzieć każdy, kto szuka wolnego terminu. Samo okno obserwacyjne nie ginie —
 * schodzi do opisu, razem z resztą tego, co silnik policzył. Wpis od 22:00 do
 * 01:15 kłamałby w obie strony: sugerowałby, że o 21:30 jeszcze można na Ciebie
 * liczyć, i że o 01:20 już można.
 *
 * ## Identyfikator wyliczany, nie losowy
 *
 * Ta sama noc zarezerwowana drugi raz ma **nadpisać** poprzedni wpis, a nie
 * postawić obok drugi. Prognoza zmienia się co dobę, więc rezerwacja z rana
 * i ta z wieczora dotyczą tej samej nocy w różnych wersjach. Google przyjmuje
 * identyfikator od klienta, więc liczymy go z miejsca i daty wieczoru.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { NightVerdict } from './session-engine.ts';

/**
 * Znaki dozwolone w identyfikatorze wydarzenia Google: base32hex, czyli cyfry
 * i litery `a`–`v`. Dlatego identyfikatora nie da się złożyć wprost z nazwy
 * miejsca — trzeba go przez ten filtr przepuścić.
 */
const ID_ALPHABET = /[^0-9a-v]/g;

export type Booking = {
  /** Identyfikator wydarzenia w Google — ten sam dla tej samej nocy i miejsca. */
  id: string;
  title: string;
  /** Początek i koniec bloku: cały wyjazd, nie samo okno obserwacyjne. */
  start: Date;
  end: Date;
  description: string;
  location: string;
};

const time = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** Data wieczoru, od którego zaczyna się noc — klucz rezerwacji. */
function eveningOf(night: { from: Date }): string {
  const d = night.from;
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Opis wpisu: wszystko, co silnik policzył, w kolejności przydatności o zmierzchu.
 *
 * Bez tekstów marketingowych i bez powtarzania tytułu — to ma się czytać na
 * telefonie w aucie przed wyjazdem.
 */
function describe(verdict: NightVerdict, rating: number, targets: string[]): string {
  const { window, plan } = verdict;
  const lines: string[] = [];

  if (window) {
    lines.push(
      `Obserwacja ${time(window.from)}–${time(window.to)} (${Math.round(window.durationMinutes / 60)} h).`,
    );
    if (window.moonLimited) {
      lines.push('Księżyc nad progiem — tylko cele księżycowe i planetarne.');
    }
  }

  lines.push(`Ocena nocy: ${rating}/100.`);

  if (plan) {
    // Zero minut znaczy „nie ustawiono punktu startowego", a nie „dojazd nic nie
    // zajmuje" — wypisane wyglądałoby jak zmierzona wartość.
    if (plan.travelMinutes > 0) {
      lines.push(`Dojazd ${plan.travelMinutes} min w jedną stronę.`);
    }
    if (plan.sleepHours !== null && plan.wakeAt) {
      lines.push(`Zostanie ${plan.sleepHours.toFixed(1)} h snu, pobudka ${time(plan.wakeAt)}.`);
    }
  }

  if (targets.length > 0) {
    lines.push('', `Cele: ${targets.join(', ')}.`);
  }

  lines.push('', 'Zaplanowane przez Lunaris.');

  return lines.join('\n');
}

/** Początek identyfikatora każdej rezerwacji — po nim kalendarz poznaje własne wpisy. */
export const BOOKING_ID_PREFIX = 'lunaris';

/**
 * Identyfikator rezerwacji nocy w danym miejscu.
 *
 * Osobno od `bookingFor`, bo potrzebny jest też tam, gdzie rezerwacji już nie da
 * się zbudować: noc, która po nowej prognozie odpadła, może nadal mieć wpis
 * w kalendarzu — i właśnie wtedy trzeba umieć go odwołać.
 */
export function bookingId(night: { from: Date }, siteId: string): string {
  // Miejsce w identyfikatorze, żeby dwie miejscówki tej samej nocy nie kasowały
  // się nawzajem — zdarza się przy porównywaniu wariantów wyjazdu.
  const place = siteId.toLowerCase().replace(ID_ALPHABET, '');

  return `${BOOKING_ID_PREFIX}${eveningOf(night)}${place}`;
}

/**
 * Wstępna rezerwacja nocy zjawiska spoza prognozy (decyzja 15 września).
 *
 * Planu wyjazdu jeszcze nie ma, więc blok obejmuje całą noc. Identyfikator jest
 * ten sam co rezerwacji z planu: gdy noc wejdzie w prognozę i przejdzie progi,
 * „Zaktualizuj wpis" nadpisze ten wpis godzinami wyjazdu zamiast stawiać drugi.
 */
export function previewBookingFor({
  night,
  site,
  event,
}: {
  night: { from: Date; to: Date };
  site: BookingInput['site'];
  event: { title: string; at: Date };
}): Booking {
  return {
    id: bookingId(night, site.id),
    title: `Obserwacja (wstępnie) — ${site.name}`,
    start: night.from,
    end: night.to,
    description: [
      `Zapowiedź: ${event.title}, ${time(event.at)}.`,
      'Poza zasięgiem prognozy — zajęta cała noc. Gdy noc wejdzie w prognozę i przejdzie progi, rezerwacja z planu podmieni godziny na wyjazd.',
      '',
      'Zaplanowane przez Lunaris.',
    ].join('\n'),
    location: `${site.lat.toFixed(5)}, ${site.lon.toFixed(5)}`,
  };
}

export type BookingInput = {
  verdict: NightVerdict;
  site: { id: string; name: string; lat: number; lon: number };
  rating: number;
  /** Kilka pierwszych celów z listy; puste, gdy nie ma czego wypisać. */
  targets?: string[];
};

/**
 * Rezerwacja dla nocy z werdyktem „jedź".
 *
 * Zwraca `null` dla nocy odrzuconej albo bez planu wyjazdu — rezerwowanie
 * terminu, którego silnik nie poleca, byłoby wpisaniem do kalendarza czegoś,
 * czego aplikacja właśnie odradza.
 */
export function bookingFor({ verdict, site, rating, targets = [] }: BookingInput): Booking | null {
  if (verdict.status !== 'go' || !verdict.plan) return null;

  const { plan } = verdict;

  return {
    id: bookingId(verdict.night, site.id),
    title: `Obserwacja — ${site.name}`,
    start: plan.departAt,
    end: plan.returnAt,
    description: describe(verdict, rating, targets),
    // Współrzędne, a nie nazwa: nawigacja ma dokąd prowadzić, a miejscówki
    // bywają bez adresu.
    location: `${site.lat.toFixed(5)}, ${site.lon.toFixed(5)}`,
  };
}
