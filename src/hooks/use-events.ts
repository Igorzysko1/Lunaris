import { useEffect, useMemo, useState } from 'react';

import type { AstroEvent } from '@/data/events';
import { useBookingEntry } from '@/hooks/use-booking';
import { useBookingSite } from '@/hooks/use-booking-site';
import { useSessions } from '@/hooks/use-sessions';
import {
  CATEGORY_LABELS,
  PREVIEW_BOOKING_NOTE,
  REOPENED_NOTE,
  dayDot,
  eventChips,
  eventFacts,
  eventStatus,
  eventSubtitle,
  eventWhen,
  horizonNote,
  hourLabel,
  leadLabel,
  notifyText,
  reasonBadge,
  scheduledWhen,
  showTargetFor,
  silenceText,
  type EventChip,
} from '@/lib/calendar-text';
import { NOTIFY_CATEGORIES, eventOutlook } from '@/lib/event-review';
import { upcomingEvents } from '@/lib/events';
import { currentNightWindow } from '@/lib/night-window';
import { loadMutedEvents, saveMutedEvents } from '@/lib/notice-store';
import { NOTIFICATIONS_AVAILABLE } from '@/lib/notification-store';
import { bookingFor, bookingId, previewBookingFor } from '@/lib/session-booking';
import type { NightVerdict } from '@/lib/session-engine';
import { LEAD_TIMES } from '@/lib/settings-storage';
import { rankedTargets } from '@/lib/sky-targets';
import { useForecast } from '@/store/forecast';
import { useSettings } from '@/store/settings';

/** Ile celów wymieniamy w opisie rezerwacji — tyle samo co przy propozycji w Kalendarzu. */
const BOOKING_TARGETS = 5;

/** Jak daleko naprzód ekran powiadomień wymienia to, co przemilczane. */
const SILENT_DAYS = 14;
const DAY_MS = 86_400_000;

/** Subskrybenci wyciszeń — arkusz zjawiska wycisza, a lista pod nim ma to zobaczyć od razu. */
const mutedListeners = new Set<(ids: string[]) => void>();

async function toggleMuted(id: string) {
  const current = await loadMutedEvents();
  const next = current.includes(id) ? current.filter((muted) => muted !== id) : [...current, id];
  if (!(await saveMutedEvents(next))) return;
  for (const listener of mutedListeners) listener(next);
}

function useMuted(): string[] {
  const [muted, setMuted] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void loadMutedEvents().then((ids) => {
      if (active) setMuted(ids);
    });
    mutedListeners.add(setMuted);
    return () => {
      active = false;
      mutedListeners.delete(setMuted);
    };
  }, []);

  return muted;
}

/**
 * Horyzont zjawisk dla aktywnego miejsca: 60 dni z efemeryd, werdykty nocy
 * z prognozy i to, co przegląd zjawisk o nich rozstrzygnął.
 */
function useEventHorizon() {
  const { active, config, notifications, notifyCategories } = useSettings();
  const { bundle, notices, reviewAgain } = useForecast();
  const { sessions } = useSessions(active.coords, active.bortle, config, active.walkMinutes);
  const muted = useMuted();
  const [now] = useState(() => new Date());
  const { lat, lon } = active.coords;

  const events = useMemo(() => upcomingEvents(now, { lat, lon }), [now, lat, lon]);
  const verdicts = useMemo(() => sessions.map((session) => session.verdict), [sessions]);
  const nights = bundle?.nights ?? [];

  return {
    now,
    events,
    sessions,
    nights: nights.length,
    horizonEnd: nights.length ? nights[nights.length - 1].night.to : null,
    notices,
    muted,
    notifications,
    refreshHour: config.refresh.hourOfDay,
    coords: { lat, lon },
    outlookOf: (event: AstroEvent) =>
      eventOutlook(event, verdicts, { categories: notifyCategories, muted }),
    ratingOf: (verdict: NightVerdict | null) =>
      verdict ? (sessions.find((s) => s.verdict === verdict)?.rating ?? null) : null,
    toggleMute: async (id: string) => {
      await toggleMuted(id);
      reviewAgain();
    },
  };
}

export type EventRow = {
  id: string;
  title: string;
  when: string;
  chips: EventChip[];
  description: string;
  /** Nie odezwie się z powodu innego niż werdykt — wyszarzone na liście. */
  quiet: boolean;
  note: string | null;
};

/** Kalendarz › Eventy (15a): granica prognozy widoczna w układzie. */
export function useEventsList() {
  const horizon = useEventHorizon();

  const rows = horizon.events.map((event) => {
    const outlook = horizon.outlookOf(event);
    const row: EventRow = {
      id: event.id,
      title: event.title,
      when: eventWhen(event.at),
      chips: eventChips(outlook, horizon.ratingOf(outlook.verdict), event.at, horizon.now),
      description: event.desc,
      quiet: outlook.silence !== null && outlook.silence !== 'no-go',
      note: outlook.silence ? silenceText(outlook.silence, outlook.verdict) : null,
    };
    return { row, inForecast: horizon.horizonEnd !== null && event.at <= horizon.horizonEnd };
  });

  return {
    note: horizonNote(horizon.nights),
    inForecast: rows.filter((r) => r.inForecast).map((r) => r.row),
    beyond: rows.filter((r) => !r.inForecast).map((r) => r.row),
  };
}

/** Arkusz zjawiska (15b): co to znaczy stąd, kiedy się odezwie, rezerwacja nocy. */
export function useEventDetail(id: string) {
  const horizon = useEventHorizon();
  const site = useBookingSite();

  const event = horizon.events.find((e) => e.id === id) ?? null;
  const outlook = event ? horizon.outlookOf(event) : null;
  const session = outlook?.verdict
    ? (horizon.sessions.find((s) => s.verdict === outlook.verdict) ?? null)
    : null;
  const night = event
    ? (outlook?.verdict?.night ?? currentNightWindow(event.at, horizon.coords))
    : null;

  // Noc w prognozie rezerwuje się jak z Planu; zapowiedź — wstępnie, całą noc
  // (decyzja 15 września). Noc odrzuconą i zjawisko stąd niewidoczne — wcale.
  const booking =
    !event || !outlook || !night || !event.visible
      ? null
      : session
        ? bookingFor({
            verdict: session.verdict,
            site,
            rating: session.rating,
            targets: rankedTargets(session.targets, BOOKING_TARGETS).map((t) => t.name),
          })
        : outlook.state === 'preview'
          ? previewBookingFor({ night, site, event })
          : null;

  const entry = useBookingEntry(night ? bookingId(night, site.id) : `bez-nocy-${id}`, booking);

  if (!event || !outlook) return { found: false } as const;

  const planned = horizon.notices.find((n) => n.eventId === id && n.notifyAt > horizon.now) ?? null;
  const show = showTargetFor(event);

  return {
    found: true,
    title: event.title,
    subtitle: eventSubtitle(event),
    status: eventStatus(outlook, horizon.ratingOf(outlook.verdict), event, horizon.now),
    meaning: event.desc,
    facts: eventFacts(event, horizon.coords),
    notify: notifyText({
      outlook,
      planned,
      eventAt: event.at,
      enabled: horizon.notifications,
    }),
    booking: entry,
    bookLabel: session ? 'Zarezerwuj tę noc w kalendarzu' : 'Zarezerwuj wstępnie całą noc',
    bookNote: booking
      ? session
        ? 'Wpis obejmie cały wyjazd — ten sam co rezerwacja z Planu.'
        : PREVIEW_BOOKING_NOTE
      : null,
    cannotBook: booking
      ? null
      : !event.visible
        ? 'Stąd niewidoczne — nie ma po co rezerwować nocy.'
        : outlook.state === 'no-go'
          ? 'Tej nocy silnik odradza wyjazd — nie ma czego rezerwować.'
          : 'Tej nocy nie ma planu wyjazdu — nie ma czego rezerwować.',
    show,
    muted: horizon.muted.includes(id),
    toggleMute: () => void horizon.toggleMute(id),
  } as const;
}

/** Ekran powiadomień (15c): decyzje, a nie same przełączniki. */
export function useNotificationsView() {
  const horizon = useEventHorizon();
  const {
    leadTime,
    setLeadTime,
    toggleNotifications,
    notifyCategories,
    toggleNotifyCategory,
    updateConfig,
  } = useSettings();
  const hour = horizon.refreshHour;

  const scheduled = horizon.notifications
    ? horizon.notices
        .filter((notice) => notice.notifyAt > horizon.now)
        .map((notice) => {
          const event = horizon.events.find((e) => e.id === notice.eventId) ?? null;
          return {
            id: `${notice.eventId}:${notice.reason}`,
            title: notice.title,
            badge: reasonBadge(notice.reason),
            when: scheduledWhen(notice.notifyAt, notice.reason, event?.at ?? null),
            quote: `„${notice.body}"`,
            note: notice.reason === 'reopened' ? REOPENED_NOTE : '',
          };
        })
    : [];

  const silent = horizon.events
    .filter((event) => event.at.getTime() - horizon.now.getTime() <= SILENT_DAYS * DAY_MS)
    .flatMap((event) => {
      const outlook = horizon.outlookOf(event);
      return outlook.silence
        ? [
            {
              id: event.id,
              title: event.title,
              date: dayDot(event.at),
              why: silenceText(outlook.silence, outlook.verdict),
            },
          ]
        : [];
    });

  return {
    available: NOTIFICATIONS_AVAILABLE,
    enabled: horizon.notifications,
    toggleEnabled: toggleNotifications,
    lead: leadLabel(leadTime),
    nextLead: () => setLeadTime(LEAD_TIMES[(LEAD_TIMES.indexOf(leadTime) + 1) % LEAD_TIMES.length]),
    reviewHour: hourLabel(hour),
    // Pora przeglądu to pora odświeżania prognozy (decyzja 15 września).
    earlier: () => updateConfig('refresh', { hourOfDay: (hour + 23) % 24 }),
    later: () => updateConfig('refresh', { hourOfDay: (hour + 1) % 24 }),
    categories: NOTIFY_CATEGORIES.map((category) => ({
      id: category,
      label: CATEGORY_LABELS[category],
      on: notifyCategories.includes(category),
    })),
    toggleCategory: toggleNotifyCategory,
    scheduled,
    silent,
  };
}
