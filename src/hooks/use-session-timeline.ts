import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { bookingCalendar, googleAccessToken } from '@/lib/google-account';
import { patchEventTimes } from '@/lib/google-calendar';
import { nightLogId } from '@/lib/journal';
import { loadJournal, saveTimeline } from '@/lib/journal-store';
import {
  adjustStep,
  calendarWindow,
  markSynced,
  needsCalendarSync,
  plannedFrom,
  plannedWindow,
  recordStep,
  undoLastStep,
  type SessionTimeline,
  type TimelineStep,
} from '@/lib/session-timeline';
import { useBookingSite } from '@/hooks/use-booking-site';
import { useGoogle } from '@/store/google';
import { useSettings } from '@/store/settings';

type Plan = { departAt: Date; returnAt: Date } | null;

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
}: {
  night: { from: Date; to: Date };
  plan: Plan;
  window: { from: Date; to: Date } | null;
  bookingId: string;
}) {
  const site = useBookingSite();
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
    // skutek, a zapis nie może go opóźniać.
    setState({ nightId, timeline: next });
    setFailed((await saveTimeline(nightBase, next)) === null);
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
      await saveTimeline(nightBase, synced);
    })();

    return () => {
      active = false;
    };
    // Plan i miejsce zmieniają tożsamość przy każdym renderze; o synchronizacji
    // decyduje wersja przebiegu, połączenie i kolejna próba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, timeline, attempt, bookingId, config.calendar.bookingCalendarId]);

  return {
    loaded,
    timeline,
    failed,
    record: () => void persist(recordStep(timeline, new Date(), plannedFrom(plan, window))),
    undo: () => {
      if (timeline) void persist(undoLastStep(timeline, new Date()));
    },
    adjust: (step: TimelineStep, minutes: number) => {
      if (!timeline) return;
      const next = adjustStep(timeline, step, minutes, new Date());
      if (next) void persist(next);
    },
    canAdjust: (step: TimelineStep, minutes: number) =>
      timeline !== null && adjustStep(timeline, step, minutes, new Date()) !== null,
  };
}
