import { useEffect, useState } from 'react';

import { useBookingSite } from '@/hooks/use-booking-site';
import type { NightCard } from '@/hooks/use-night-verdicts';
import { bookingCalendar, googleAccessToken } from '@/lib/google-account';
import { deleteBooking, fetchBooking, upsertBooking } from '@/lib/google-calendar';
import { bookingFor, bookingId, type Booking } from '@/lib/session-booking';
import { useGoogle } from '@/store/google';
import { useSettings } from '@/store/settings';

/** Stan wpisu w kalendarzu; `unknown`, gdy nie udało się tego sprawdzić. */
type Presence = 'booked' | 'absent' | 'unknown';

export type BookingView = ReturnType<typeof useBooking>;

/**
 * Rezerwacja nocy w Kalendarzu Google — zawsze na przycisk, nigdy sama.
 *
 * Wpis zasłania termin w kalendarzu, który widzą inni, więc powstaje dopiero
 * po świadomym naciśnięciu. Obejmuje cały wyjazd (`bookingFor`), a cele w opisie
 * idą z listy Nieba — z celami dopisanymi ręcznie do planu tej nocy.
 *
 * Noc bez werdyktu „jedź" nie ma rezerwacji do zbudowania, ale wpis sprzed
 * zmiany prognozy może dalej wisieć — i wtedy odwołanie jest najbardziej
 * potrzebne, więc stan wpisu sprawdzamy także dla takiej nocy.
 *
 * Wpis trafia do kalendarza wybranego w Ustawieniach i tam jest szukany.
 */
export function useBooking(card: NightCard, targets: string[]) {
  const google = useGoogle();
  const { config } = useSettings();
  const site = useBookingSite();
  const { verdict, rating } = card.session;

  const id = bookingId(verdict.night, site.id);
  const booking = bookingFor({ verdict, site, rating, targets });
  const connected = google.connected === true;
  const target = config.calendar.bookingCalendarId;

  // Stany niosą klucz nocy i kalendarza, którego dotyczą: po przełączeniu nocy
  // albo zmianie kalendarza docelowego nic nie może odziedziczyć „zapisano".
  const key = `${id}|${target ?? ''}`;
  const [presence, setPresence] = useState<{ key: string; value: Presence } | null>(null);
  const [message, setMessage] = useState<{ key: string; text: string; error: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!connected) return;

    let active = true;
    void (async () => {
      const auth = await googleAccessToken();
      const found =
        auth.status === 'ok'
          ? await fetchBooking(auth.token, id, await bookingCalendar(target))
          : null;
      if (!active) return;

      setPresence({ key, value: found === null ? 'unknown' : found.exists ? 'booked' : 'absent' });
    })();

    return () => {
      active = false;
    };
    // `key` składa się z `id` i `target`, więc wystarczy zamiast nich.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, key]);

  const current = presence?.key === key ? presence.value : null;
  const note = message?.key === key ? message : null;

  async function run(action: (token: string, calendarId: string) => Promise<string | null>) {
    setBusy(true);
    try {
      const auth = await googleAccessToken();
      const done =
        auth.status === 'ok' ? await action(auth.token, await bookingCalendar(target)) : null;

      setMessage(
        done
          ? { key, text: done, error: false }
          : {
              key,
              text:
                auth.status === 'disconnected'
                  ? 'Konto Google jest odłączone — połącz je ponownie w Ustawieniach.'
                  : 'Nie udało się. Sprawdź połączenie i spróbuj ponownie.',
              error: true,
            },
      );
    } finally {
      setBusy(false);
    }
  }

  function book(confirmed: Booking) {
    void run(async (token, calendarId) => {
      const result = await upsertBooking(token, confirmed, calendarId);
      if (!result) return null;

      setPresence({ key, value: 'booked' });
      return result.replaced
        ? 'Wpis zaktualizowany do bieżącej prognozy.'
        : 'Zapisano w kalendarzu.';
    });
  }

  return {
    id,
    /** Logowanie Google nie działa w tym środowisku albo stan konta jeszcze się czyta. */
    hidden: !google.available || google.connected === null,
    connected,
    connecting: google.busy,
    connect: () => void google.connect(),
    canBook: booking !== null,
    booked: current === 'booked',
    checking: connected && current === null,
    busy,
    /** Noc odpadła, a wpis został. */
    stale: booking === null && current === 'booked',
    // Przy nieznanym stanie też: usunięcie nieistniejącego wpisu jest nieszkodliwe,
    // a ukryty przycisk przy wiszącym wpisie — nie.
    canCancel: current === 'booked' || current === 'unknown',
    message: note ? { text: note.text, error: note.error } : null,
    book: () => {
      if (booking) book(booking);
    },
    cancel: () =>
      void run(async (token, calendarId) => {
        const result = await deleteBooking(token, id, calendarId);
        if (!result) return null;

        setPresence({ key, value: 'absent' });
        return 'Sesja odwołana — wpis usunięty z kalendarza.';
      }),
  };
}
