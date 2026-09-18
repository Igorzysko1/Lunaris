import { useMemo } from 'react';

import { ratingScore } from '@/lib/astro';
import {
  describeForecastFailure,
  rateLimitCooldown,
  type ForecastFailure,
} from '@/lib/daily-cycle';
import { formatLongDate, formatNightSpan, formatTime } from '@/lib/date';
import { formatAge } from '@/lib/forecast-cache';
import {
  nightBar,
  positionOnAxis,
  summarizeNight,
  type NightBar,
  type NightSummary,
} from '@/lib/night-summary';
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
import { useNightPlace } from '@/store/night-place';
import { useSettings } from '@/store/settings';

const MINUTE_MS = 60_000;

/** Jedna noc z prognozy, gotowa do karty werdyktu i selektora nocy. */
export type NightCard = {
  key: string;
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
  /** „Teraz" na pasku nocy; `null`, gdy chwila leży poza osią tej nocy. */
  nowOnBar: number | null;
  /** „zostało 4 h 04 min" — tylko w trakcie okna. */
  remaining: string | null;
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
  const { config } = useSettings();
  // Werdykt jest o **miejscu nocy**, nie o punkcie, w którym stoisz: „odpuść"
  // ma znaczyć „nigdzie w zasięgu nie warto", a nie „nie warto stąd".
  const { place, review } = useNightPlace();
  const { status, savedAt, stale, failure, refresh, refreshing, cycle } = useForecast();
  const { sessions } = useSessions(
    place.coords,
    place.bortle,
    config,
    place.walkMinutes,
    place.nights,
  );
  const now = useNow();
  const { lat, lon } = place.coords;

  // „Dziś" i „jutro" zmieniają znaczenie o północy, a nie co minutę.
  const today = now.toDateString();

  const nights = useMemo<NightCard[]>(() => {
    const slices = place.nights;
    if (!slices) return [];

    const where = `${place.label} · Bortle ${place.bortle}`;

    return sessions.flatMap((session, index) => {
      const slice = slices[index];
      if (!slice) return [];

      const { verdict } = session;
      const summary = summarizeNight({ slice, planned: session, coords: { lat, lon }, config });
      const relative = nightRelative(verdict.night, now);
      const span = formatNightSpan(verdict.night.from, verdict.night.to);
      const observing = verdict.window;

      return [
        {
          key: verdict.night.from.toISOString(),
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
  }, [place, sessions, lat, lon, config, today]);

  const liveIndex = liveNightIndex(
    nights.map((card) => card.session.verdict.night),
    now,
  );

  const moments = nights.map((card, index): NightMoment => {
    const observing = card.session.verdict.window;
    const nowOnBar = card.go ? positionOnAxis(card.summary.axis, now) : null;

    if (!card.go || !observing || now < observing.from || now > observing.to) {
      return { nowOnBar, remaining: null, live: null };
    }

    const left = Math.floor((observing.to.getTime() - now.getTime()) / MINUTE_MS);
    const remaining = `zostało ${formatDuration(left)}`;
    const progress =
      (now.getTime() - observing.from.getTime()) /
      (observing.to.getTime() - observing.from.getTime());

    return {
      nowOnBar,
      remaining,
      live: index === liveIndex ? { now: formatTime(now), remaining, progress } : null,
    };
  });

  const bestNight = (index: number) => {
    const found = nights.findIndex((card, i) => i !== index && card.go);
    return found < 0 ? null : found;
  };

  const failureText = describeForecastFailure(failure);
  const cooldown = rateLimitCooldown(cycle, now);

  // Wiek danych **miejsca nocy**: twoja pozycja ma prognozę z cyklu Nocy,
  // miejscówka z katalogu — z przeglądu. Pokazanie wieku cyklu przy miejscówce
  // obiecywałoby świeżość prognozy, której nikt nie pobrał.
  const placeSavedAt =
    place.id === ACTIVE_SITE_ID ? (savedAt ?? cycle.lastSuccessAt ?? null) : review.savedAt;

  return {
    status: place.nights ? 'ready' : status,
    nights,
    moments,
    bestNight,
    liveIndex,
    place: place.label,
    // Skąd się to miejsce wzięło jest częścią werdyktu: bez tego „Złoty Potok"
    // wyglądałby na ustawienie, które ktoś kiedyś wybrał i zapomniał zmienić.
    placeNote: `Bortle ${place.bortle} · ${place.pinned ? 'wybrane ręcznie' : 'najlepsze z rankingu'}`,
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
