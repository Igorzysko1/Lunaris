import { useMemo } from 'react';

import { ratingScore } from '@/lib/astro';
import {
  describeForecastFailure,
  rateLimitCooldown,
  type ForecastFailure,
} from '@/lib/daily-cycle';
import { formatLongDate, formatNightSpan, formatTime } from '@/lib/date';
import { formatAge } from '@/lib/forecast-cache';
import { nightBar, summarizeNight, type NightBar, type NightSummary } from '@/lib/night-summary';
import {
  formatDuration,
  narrateVerdict,
  nightRelative,
  rejectionLabels,
  verdictChips,
  type Narration,
  type VerdictChip,
} from '@/lib/session-text';
import { liveNightIndex } from '@/lib/session-timeline';
import type { NightSlice } from '@/lib/weather';
import { useNow } from '@/hooks/use-now';
import { useSessions, type Session } from '@/hooks/use-sessions';
import { useForecast, type ForecastStatus } from '@/store/forecast';
import { ACTIVE_SITE_ID } from '@/lib/where-text';
import { useNightPlace, type NightPlace } from '@/store/night-place';
import { useSettings } from '@/store/settings';

const MINUTE_MS = 60_000;

/** Jedna noc z prognozy, gotowa do karty werdyktu i selektora nocy. */
export type NightCard = {
  key: string;
  /** Miejsce tej nocy — zwycięzca jej rankingu albo przypięte. */
  place: NightPlace;
  /** „noc 14/15 września" */
  title: string;
  /** „dziś · Zawoja · Bortle 4" */
  subtitle: string;
  /** „dziś", „jutro", „czwartek" — także do żetonu najbliższej dobrej nocy. */
  relative: string;
  go: boolean;
  /** Ocena 1–5. */
  score: number;
  session: Session;
  summary: NightSummary;
  /** Godziny prognozy tej nocy — z nich liczy się segment Warunki. */
  slice: NightSlice;
  /** Tylko przy „jedź". */
  window: { from: string; to: string; duration: string; bar: NightBar } | null;
  narrative: Narration;
  chips: VerdictChip[];
  rejection: { bar: string; meta: string } | null;
};

/** Część karty zależna od zegara. */
export type NightMoment = {
  /** Noc w trakcie: licznik zamiast werdyktu. */
  live: { now: string; remaining: string; progress: number } | null;
};

export type NightVerdicts = {
  status: ForecastStatus;
  nights: NightCard[];
  moments: NightMoment[];
  /** Najbliższa dobra noc inna niż wskazana — do żetonu przy „odpuść". */
  bestNight: (index: number) => number | null;
  /** Noc, której przebieg zapisuje się na żywo (`liveNightIndex`); `-1`, gdy żadna. */
  liveIndex: number;
  place: string;
  /** „Bortle 4 · policzone dla tego punktu" */
  placeNote: string;
  /** „poniedziałek, 14 września" */
  date: string;
  /** Pasek nad danymi z zapisu; `null`, gdy zapis nie wymaga ostrzeżenia. */
  stale: string | null;
  failure: ForecastFailure | null;
  failureMessage: string;
  /** Prawdziwy powód ostatniej porażki, np. „Open-Meteo: limit zapytań (429)". */
  lastError: string | null;
  refresh: () => void;
  refreshing: boolean;
  /** „prognoza sprzed 2 godzin" — wiek danych, z których liczy się miejsce nocy. */
  updated: string;
  /**
   * Godzina, od której wolno odświeżyć ręcznie — po odpowiedzi 429 przycisk
   * czeka 30 min. `null`, gdy nic nie blokuje.
   */
  refreshAfter: string | null;
};

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Zakładka Noc: werdykt każdej nocy z prognozy, ubrany w zdania i pasek.
 *
 * Rachunek jest ten sam co w cyklu dobowym i przeglądzie zjawisk — `planNights`
 * przez `useSessions` — więc karta nie może powiedzieć „jedź" tam, gdzie
 * powiadomienie powiedziało „odpuść". Część zależną od zegara („teraz",
 * „zostało", noc w trakcie) liczymy osobno co minutę, żeby tyknięcie nie
 * przeliczało efemeryd Księżyca.
 */
export function useNightVerdicts(): NightVerdicts {
  const { config, active } = useSettings();
  // Werdykt każdej nocy jest o **jej** miejscu, nie o punkcie, w którym stoisz:
  // „odpuść" ma znaczyć „tej nocy nigdzie w zasięgu nie warto".
  const { review } = useNightPlace();
  const { status, savedAt, stale, failure, refresh, refreshing, cycle } = useForecast();
  const { sessions, places } = useSessions();
  const now = useNow();

  // „Dziś" i „jutro" zmieniają znaczenie o północy, a nie co minutę.
  const today = now.toDateString();

  const nights = useMemo<NightCard[]>(() => {
    return sessions.flatMap((session, index) => {
      const place = places[index];
      if (!place) return [];
      const { slice } = place;
      const where = `${place.label} · Bortle ${place.bortle}`;

      const { verdict } = session;
      const summary = summarizeNight({ slice, planned: session, coords: place.coords, config });
      const relative = nightRelative(verdict.night, now);
      const span = formatNightSpan(verdict.night.from, verdict.night.to);
      const observing = verdict.window;

      return [
        {
          key: verdict.night.from.toISOString(),
          place,
          title: `noc ${span}`,
          subtitle: `${relative} · ${where}${session.uncertain ? ' · orientacyjnie' : ''}`,
          relative,
          go: verdict.status === 'go' && observing !== null,
          score: ratingScore(session.rating),
          session,
          summary,
          slice,
          window: observing
            ? {
                from: formatTime(observing.from),
                to: formatTime(observing.to),
                duration: formatDuration(observing.durationMinutes),
                bar: nightBar(summary, observing),
              }
            : null,
          narrative: narrateVerdict(verdict, summary),
          chips: verdictChips(session, summary, config.conditions.dewWarningSpreadC),
          rejection: verdict.rejection ? rejectionLabels(verdict.rejection, summary) : null,
        },
      ];
    });
    // `now` celowo poza zależnościami: etykiety przelicza zmiana daty (`today`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, sessions, config, today]);

  const liveIndex = liveNightIndex(
    nights.map((card) => card.session.verdict.night),
    now,
  );

  const moments = nights.map((card, index): NightMoment => {
    const observing = card.session.verdict.window;

    if (!card.go || !observing || now < observing.from || now > observing.to) {
      return { live: null };
    }

    const left = Math.floor((observing.to.getTime() - now.getTime()) / MINUTE_MS);
    const remaining = `zostało ${formatDuration(left)}`;
    const progress =
      (now.getTime() - observing.from.getTime()) /
      (observing.to.getTime() - observing.from.getTime());

    return {
      live: index === liveIndex ? { now: formatTime(now), remaining, progress } : null,
    };
  });

  const bestNight = (index: number) => {
    const found = nights.findIndex((card, i) => i !== index && card.go);
    return found < 0 ? null : found;
  };

  const failureText = describeForecastFailure(failure);
  const cooldown = rateLimitCooldown(cycle, now);

  // Wiek danych, z których liczą się te noce: twoja pozycja ma prognozę z cyklu
  // Nocy, miejscówki — z przeglądu. Gdy noce biorą z obu, liczy się starsza —
  // inaczej pasek obiecywałby świeżość, której część danych nie ma.
  const ages = [
    places.some((p) => p.id === ACTIVE_SITE_ID) ? (savedAt ?? cycle.lastSuccessAt ?? null) : null,
    places.some((p) => p.id !== ACTIVE_SITE_ID) ? review.savedAt : null,
  ].filter((age): age is Date => age !== null);
  const placeSavedAt = ages.length ? new Date(Math.min(...ages.map((d) => d.getTime()))) : null;

  return {
    status: places.length ? 'ready' : status,
    nights,
    moments,
    bestNight,
    liveIndex,
    // Tylko do ekranu bez prognozy — tam nie ma jeszcze nocy, więc i miejsc nocy.
    place: active.label,
    placeNote: `Bortle ${active.bortle} · twoja pozycja — miejsca nocy wskaże ranking`,
    date: lowerFirst(formatLongDate(now)),
    // Zapis to normalne źródło odczytu. Ostrzegamy dopiero, gdy odświeżenie
    // zawiodło albo dane przetrwały termin, w którym miały się zmienić.
    stale: savedAt && (failure || stale) ? `${failureText.bar} — ${formatAge(savedAt, now)}` : null,
    failure,
    failureMessage: failureText.message,
    lastError: failure ? cycle.lastError : null,
    refresh: () => {
      if (!cooldown) refresh();
      // Miejsce nocy bywa miejscówką, a jej prognozę przynosi przegląd, nie cykl
      // Nocy — odświeżenie samego cyklu zostawiłoby ją nietkniętą.
      review.refresh();
    },
    refreshing: refreshing || review.refreshing,
    updated: placeSavedAt ? `prognoza ${formatAge(placeSavedAt, now)}` : 'prognoza świeża',
    refreshAfter: cooldown ? formatTime(cooldown) : null,
  };
}
