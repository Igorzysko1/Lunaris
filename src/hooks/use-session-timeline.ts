import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useBookingSite } from '@/hooks/use-booking-site';
import type { NightPlace } from '@/store/night-place';
import { saveEntryTimeline } from '@/hooks/use-journal';
import { formatTime } from '@/lib/date';
import { bookingCalendar, googleAccessToken } from '@/lib/google-account';
import { patchEventTimes } from '@/lib/google-calendar';
import { nightLogId } from '@/lib/journal';
import { loadJournal } from '@/lib/journal-store';
import { describeSegments } from '@/lib/plan-text';
import {
  STEP_LABELS,
  TIMELINE_STEPS,
  adjustStep,
  calendarWindow,
  lastStep,
  markSynced,
  needsCalendarSync,
  nextStep,
  plannedFrom,
  plannedWindow,
  recordStep,
  segmentMinutes,
  undoLastStep,
  type SessionTimeline,
  type TimelineStep,
} from '@/lib/session-timeline';
import { formatDuration } from '@/lib/session-text';
import { useGoogle } from '@/store/google';
import { useSettings } from '@/store/settings';

type Plan = { departAt: Date; returnAt: Date } | null;

/** Krok poprawki godziny. Pięć minut — tyle zwykle dzieli dotknięcie od faktu. */
const ADJUST_MINUTES = 5;

/**
 * Przebieg trwającej nocy: odczyt z dziennika, zapis kolejnych kroków
 * i dosyłanie godzin do kalendarza.
 *
 * Dziennik jest źródłem prawdy, a kalendarz jego odbiciem. Każdy krok ląduje
 * najpierw na dysku — bez zasięgu też — i dopiero potem próbuje trafić do
 * Google. Wersja, której kalendarz jeszcze nie dostał, czeka oznaczona
 * w zapisie i jest dosyłana przy każdym powrocie aplikacji na pierwszy plan.
 */
export function useSessionTimeline({
  night,
  plan,
  window,
  bookingId,
  place,
}: {
  night: { from: Date; to: Date };
  plan: Plan;
  window: { from: Date; to: Date } | null;
  bookingId: string;
  /** Miejsce tej nocy — pod nim wisi jej rezerwacja. */
  place: NightPlace;
}) {
  const site = useBookingSite(place);
  const { config } = useSettings();
  const { connected } = useGoogle();

  const nightId = nightLogId(night.from);
  const [state, setState] = useState<{ nightId: string; timeline: SessionTimeline | null } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void loadJournal().then(({ journal }) => {
      if (!active) return;
      setState({
        nightId,
        timeline: journal.logs.find((log) => log.id === nightId)?.timeline ?? null,
      });
    });
    return () => {
      active = false;
    };
  }, [nightId]);

  // Powrót zasięgu zwykle idzie w parze z powrotem do aplikacji — wtedy
  // próbujemy dosłać to, czego kalendarz jeszcze nie dostał.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') setAttempt((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);

  const loaded = state?.nightId === nightId;
  const timeline = loaded ? state.timeline : null;

  const nightBase = {
    id: nightId,
    nightFrom: night.from.toISOString(),
    // Tak jak ekran dziennika: identyfikator tylko dla miejscówek z katalogu.
    siteId: config.sites.find((s) => s.id === site.id)?.id ?? null,
    siteName: site.name,
  };

  const persist = async (next: SessionTimeline) => {
    // Najpierw ekran, potem dysk: dotknięcie w rękawicach ma dać natychmiastowy
    // skutek, a zapis nie może go opóźniać. Zapis powiadamia Dziennik.
    setState({ nightId, timeline: next });
    setFailed((await saveEntryTimeline(nightBase, next)) === null);
  };

  useEffect(() => {
    if (!connected || !timeline || !needsCalendarSync(timeline)) return;

    let active = true;
    void (async () => {
      const times = calendarWindow(timeline, plannedWindow(timeline.planned, plan));
      if (!times) return;

      const auth = await googleAccessToken();
      if (auth.status !== 'ok') return;

      const calendarId = await bookingCalendar(config.calendar.bookingCalendarId);
      const result = await patchEventTimes(
        auth.token,
        calendarId,
        bookingId,
        times.start,
        times.end,
      );

      // Porażka zostawia wersję niezsynchronizowaną — spróbujemy przy następnym
      // powrocie do aplikacji. Brak wpisu to nie porażka: nie ma czego poprawiać.
      if (!active || result === 'failed') return;

      const synced = markSynced(timeline);
      setState({ nightId, timeline: synced });
      await saveEntryTimeline(nightBase, synced);
    })();

    return () => {
      active = false;
    };
    // Plan i miejsce zmieniają tożsamość przy każdym renderze; o synchronizacji
    // decyduje wersja przebiegu, połączenie i kolejna próba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, timeline, attempt, bookingId, config.calendar.bookingCalendarId]);

  const now = new Date();
  const next = nextStep(timeline);
  const last = lastStep(timeline);
  const segments = timeline ? segmentMinutes(timeline) : null;

  return {
    loaded,
    failed,
    adjustMinutes: ADJUST_MINUTES,
    /** Etykieta dużego przycisku — kolejny krok; `null`, gdy noc jest zamknięta. */
    next: next ? STEP_LABELS[next].action : null,
    steps: timeline
      ? TIMELINE_STEPS.flatMap((step) => {
          const at = timeline[step];
          if (!at) return [];
          return [
            {
              step,
              label: STEP_LABELS[step].done,
              time: formatTime(new Date(at)),
              canEarlier: adjustStep(timeline, step, -ADJUST_MINUTES, now) !== null,
              canLater: adjustStep(timeline, step, ADJUST_MINUTES, now) !== null,
            },
          ];
        })
      : [],
    summary:
      !next && segments && segments.total !== null
        ? `Od wyjazdu do powrotu ${formatDuration(segments.total)}.`
        : null,
    detail: segments ? describeSegments(segments) || null : null,
    planned: timeline?.planned
      ? `Plan z chwili wyjazdu: ${formatTime(new Date(timeline.planned.departAt))} → ${formatTime(new Date(timeline.planned.returnAt))}`
      : null,
    undoLabel: last ? `Cofnij: ${STEP_LABELS[last].done.toLowerCase()}` : null,
    pendingSync: connected === true && needsCalendarSync(timeline),
    record: () => void persist(recordStep(timeline, new Date(), plannedFrom(plan, window))),
    undo: () => {
      if (timeline) void persist(undoLastStep(timeline, new Date()));
    },
    adjust: (step: TimelineStep, minutes: number) => {
      if (!timeline) return;
      const moved = adjustStep(timeline, step, minutes, new Date());
      if (moved) void persist(moved);
    },
  };
}
