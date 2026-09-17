import { useMemo, useState } from 'react';

import { useBookingSite } from '@/hooks/use-booking-site';
import { useCalendarMonth } from '@/hooks/use-calendar-month';
import { useSessions } from '@/hooks/use-sessions';
import { PROPOSAL_NOTE, dayDot, dayVerdictLine, spanText } from '@/lib/calendar-text';
import {
  checkObservationTimes,
  eventsOnDay,
  monthCells,
  unbookedNights,
  type CalendarEvent,
} from '@/lib/calendar-view';
import { WEEKDAYS_SHORT, formatLongDate, formatMonth, formatTime, isSameDay } from '@/lib/date';
import { bookingCalendar, googleAccessToken } from '@/lib/google-account';
import { deleteBooking, patchObservation, upsertBooking } from '@/lib/google-calendar';
import { bookingFor, bookingId } from '@/lib/session-booking';
import { rankedTargets } from '@/lib/sky-targets';
import { useGoogle } from '@/store/google';
import { useNightPlace } from '@/store/night-place';
import { useSettings } from '@/store/settings';

/** Ile celów wymieniamy w opisie rezerwacji — tyle samo co przy karcie nocy. */
const TARGETS_IN_BOOKING = 5;

/** Krok przestawiania godzin. Kwadrans wystarcza, a nie wymaga natywnego wybieraka. */
const STEP_MINUTES = 15;
const MINUTE_MS = 60_000;

export type CalendarObservation = {
  event: CalendarEvent;
  save: (change: { start: Date; end: Date; note: string }) => Promise<boolean>;
  remove: () => Promise<boolean>;
};

/**
 * Kalendarz › Miesiąc (10a/10b): siatka z kropkami, propozycje sesji z werdyktu
 * „jedź", zapisane obserwacje do edycji i cudze wpisy tylko do odczytu.
 * Rezerwacje liczone z tego samego miejsca co w Planie — ✓ tutaj i przycisk
 * tam trafiają w jeden wpis.
 */
export function useCalendarTab() {
  const google = useGoogle();
  const { active, config } = useSettings();
  const site = useBookingSite();
  const { place } = useNightPlace();
  // Ta sama noc co w zakładce Noc: sesja i rezerwacja muszą mówić o jednym
  // miejscu, inaczej wpis w kalendarzu wiezie gdzie indziej niż werdykt.
  const { sessions } = useSessions(
    place.coords,
    place.bortle,
    config,
    place.walkMinutes,
    place.nights,
  );

  const [today] = useState(() => new Date());
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  const month = useCalendarMonth(
    cursor,
    config.calendar.calendarIds,
    config.calendar.bookingCalendarId,
  );
  const cells = useMemo(() => monthCells(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const nights = useMemo(
    () =>
      sessions.map((session) => {
        const booking = bookingFor({
          verdict: session.verdict,
          site,
          rating: session.rating,
          targets: rankedTargets(session.targets, TARGETS_IN_BOOKING).map((t) => t.name),
        });
        return {
          session,
          booking,
          bookingId: bookingId(session.verdict.night, site.id),
          bookable: booking !== null,
        };
      }),
    [sessions, site],
  );

  // Zarysy tylko wtedy, gdy wiadomo, co jest w kalendarzu — inaczej propozycja
  // stanęłaby obok rezerwacji, której jeszcze nie pobraliśmy.
  const proposals = month.known ? unbookedNights(nights, month.events) : [];

  /** Akcja na koncie Google; udana odświeża miesiąc, żeby ekran pokazał wynik. */
  async function withToken(action: (token: string) => Promise<boolean>) {
    const auth = await googleAccessToken();
    const ok = auth.status === 'ok' && (await action(auth.token));
    if (ok) month.reload();
    return ok;
  }

  /**
   * Data, pod którą stoi propozycja: wieczór, od którego zaczyna się noc — a nie
   * godzina wyjazdu.
   *
   * Okno bywa po północy: noc 19/20 z oknem 00:00–02:00 i bez dojazdu wyjeżdża
   * się już dwudziestego. Propozycja tej nocy pod datą 20 nie zgadzałaby się
   * z niczym — ani z kartą nocy w zakładce Noc, ani z kluczem w dzienniku, które
   * obie liczą noc od wieczoru.
   */
  const nightOf = (proposal: (typeof proposals)[number]) => proposal.session.verdict.night.from;

  const dayEvents = eventsOnDay(month.events, selected);
  const dayProposals = proposals.filter((p) => isSameDay(nightOf(p), selected));
  const dayNight = nights.find((n) => isSameDay(n.session.verdict.night.from, selected));

  return {
    google: !google.available
      ? ('unavailable' as const)
      : google.connected === false
        ? ('disconnected' as const)
        : ('ok' as const),
    connecting: google.busy,
    connect: () => void google.connect(),
    place: `${active.label} ▾`,
    monthLabel: formatMonth(cursor),
    prevMonth: () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1)),
    nextMonth: () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1)),
    weekdays: WEEKDAYS_SHORT,
    cells: cells.map((cell) => {
      const events = eventsOnDay(month.events, cell.date);
      const observation = events.some((e) => e.observation);
      const other = events.some((e) => !e.observation);
      const proposal = proposals.some((p) => isSameDay(nightOf(p), cell.date));
      const marks = [
        observation && 'obserwacja',
        proposal && 'propozycja sesji',
        other && 'wydarzenia',
      ]
        .filter(Boolean)
        .join(', ');

      return {
        key: cell.date.toISOString(),
        day: cell.date.getDate(),
        inMonth: cell.inMonth,
        today: isSameDay(cell.date, today),
        selected: isSameDay(cell.date, selected),
        observation,
        proposal,
        other,
        label: `${formatLongDate(cell.date)}${marks ? `: ${marks}` : ''}`,
      };
    }),
    select: (index: number) => setSelected(cells[index].date),
    loading: month.status === 'loading' && !month.known,
    error: month.status === 'error',
    reload: month.reload,
    dayLabel: formatLongDate(selected),
    isToday: isSameDay(selected, today),
    verdict: dayNight
      ? {
          text: dayVerdictLine(dayNight.session.verdict),
          go: dayNight.session.verdict.status === 'go',
        }
      : null,
    proposals: dayProposals.flatMap((proposal) =>
      proposal.booking
        ? [
            {
              id: proposal.bookingId,
              title: proposal.booking.title,
              time: spanText(proposal.booking.start, proposal.booking.end),
              note: PROPOSAL_NOTE,
              confirm: () =>
                withToken(
                  async (token) =>
                    (await upsertBooking(
                      token,
                      proposal.booking!,
                      await bookingCalendar(config.calendar.bookingCalendarId),
                    )) !== null,
                ),
            },
          ]
        : [],
    ),
    observations: dayEvents
      .filter((event) => event.observation)
      .map((event): CalendarObservation & { key: string } => ({
        // Klucz z godzinami i notatką: po zapisie edytor startuje z nowych wartości.
        key: `${event.id}-${event.start.getTime()}-${event.end.getTime()}-${event.note}`,
        event,
        save: (change) => withToken((token) => patchObservation(token, event, change)),
        remove: () =>
          withToken(
            async (token) => (await deleteBooking(token, event.id, event.calendarId)) !== null,
          ),
      })),
    others: dayEvents
      .filter((event) => !event.observation)
      .map((event) => ({
        id: event.id,
        time: event.allDay ? 'cały dzień' : formatTime(event.start),
        title: event.title,
      })),
    empty: !dayNight && dayProposals.length === 0 && dayEvents.length === 0 && month.known,
  };
}

export type CalendarView = ReturnType<typeof useCalendarTab>;

/**
 * Edycja zapisanej obserwacji: godziny krokiem po kwadransie, notatka widoczna
 * też w Google, zapis i usunięcie. Sprawdzenie godzin z `checkObservationTimes`.
 */
export function useObservationEditor({ event, save, remove }: CalendarObservation) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(event.start);
  const [end, setEnd] = useState(event.end);
  const [note, setNote] = useState(event.note);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const shift = (date: Date, steps: number) =>
    new Date(date.getTime() + steps * STEP_MINUTES * MINUTE_MS);

  function reset() {
    setStart(event.start);
    setEnd(event.end);
    setNote(event.note);
    setFailure(null);
    setOpen(false);
  }

  return {
    title: event.title,
    span: spanText(open ? start : event.start, open ? end : event.end),
    note: event.note,
    open,
    toggle: () => (open ? reset() : setOpen(true)),
    start: {
      time: formatTime(start),
      date: dayDot(start),
      earlier: () => setStart((d) => shift(d, -1)),
      later: () => setStart((d) => shift(d, 1)),
    },
    end: {
      time: formatTime(end),
      date: dayDot(end),
      earlier: () => setEnd((d) => shift(d, -1)),
      later: () => setEnd((d) => shift(d, 1)),
    },
    draftNote: note,
    setNote,
    problem: checkObservationTimes(start, end),
    busy,
    failure,
    save: async () => {
      setBusy(true);
      setFailure(null);
      const ok = await save({ start, end, note });
      setBusy(false);
      if (ok) setOpen(false);
      else setFailure('Nie udało się zapisać zmian.');
    },
    remove: async () => {
      setBusy(true);
      const ok = await remove();
      setBusy(false);
      if (!ok) setFailure('Nie udało się usunąć wpisu.');
    },
  };
}
