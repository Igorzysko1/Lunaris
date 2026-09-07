/**
 * Brief — werdykt na najbliższe noce w postaci nadającej się do wysłania dalej.
 *
 * Ten sam rachunek, który napędza ekran: `planNights` liczy werdykty,
 * `reviewEvents` wybiera zjawiska warte zgłoszenia. Brief niczego nie liczy po
 * swojemu — gdyby liczył, po pierwszej korekcie progu pokazywałby co innego niż
 * aplikacja, a to właśnie on ma być testem regresyjnym silnika.
 *
 * Wynik jest **czystym JSON-em**: żadnych obiektów `Date`, tylko napisy ISO.
 * Odbiorcą jest cron na maszynie i przyszła warstwa narracyjna, a nie React —
 * kontrakt musi być czytelny dla programu, który nie zna typów TypeScriptu.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { AstroEvent } from '../data/events.ts';
import type { Coords } from '../data/places.ts';
import type { LunarisConfig } from './config.ts';
import { formatTime } from './date.ts';
import { reviewEvents, type NoticeLog } from './event-review.ts';
import { planNights } from './night-plan.ts';
import { rankedTargets } from './sky-targets.ts';
import type { Rejection, SessionPlan, Warning } from './session-engine.ts';
import type { NightSlice } from './weather.ts';

/**
 * Wersja kontraktu. Brief przechodzi przez granicę procesu — zmiana kształtu bez
 * podbicia wersji byłaby cichą awarią po stronie odbiorcy.
 */
export const BRIEF_VERSION = 1;

const iso = (date: Date) => date.toISOString();
const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null);

export type BriefTarget = {
  id: string;
  name: string;
  detail: string;
  kind: 'planet' | 'dso';
  bestAt: string;
  maxAltitude: number;
  bestAzimuth: number;
  magnitude: number;
};

export type BriefNight = {
  from: string;
  to: string;
  status: 'go' | 'no-go';
  /** Prognoza na tę dobę jest już orientacyjna. */
  uncertain: boolean;
  rejection: Record<string, unknown> | null;
  warnings: Record<string, unknown>[];
  window: { from: string; to: string; durationMinutes: number; moonLimited: boolean } | null;
  plan: {
    departAt: string;
    returnAt: string;
    wakeAt: string | null;
    sleepHours: number | null;
    travelMinutes: number;
  } | null;
  minTemperature: number | null;
  /** Spokój atmosfery: 1–5 i to, co go psuje. `null`, gdy nocy nie ma. */
  seeing: { index: number; label: string; driver: string; usableMagnification: number } | null;
  /** Tylko cele w zasięgu — brief ma mówić, co robić, a nie czego się nie da. */
  targets: BriefTarget[];
};

export type BriefNotice = {
  eventId: string;
  title: string;
  body: string;
  reason: string;
  notifyAt: string;
  /** `false` znaczy zapowiedź bez prognozy — nie wolno jej czytać jak obietnicy. */
  withVerdict: boolean;
};

export type Brief = {
  version: number;
  generatedAt: string;
  site: {
    id: string;
    name: string;
    lat: number;
    lon: number;
    bortle: number;
    walkMinutes: number;
  };
  summary: {
    /** Jedno zdanie do wysłania — reszta briefu jest dla programu. */
    headline: string;
    nights: number;
    go: number;
    firstGo: string | null;
  };
  nights: BriefNight[];
  notices: BriefNotice[];
};

export type BriefInput = {
  now: Date;
  site: { id: string; name: string; lat: number; lon: number; bortle: number; walkMinutes: number };
  home: Coords | null;
  nights: NightSlice[];
  events: AstroEvent[];
  config: LunarisConfig;
  leadHours: number;
  /** Pamięć poprzednich przebiegów; pusta, gdy cron uruchamia się pierwszy raz. */
  previousNotices?: NoticeLog;
};

/** Daty w powodzie odrzucenia i w ostrzeżeniach też muszą wyjść jako ISO. */
function plainRejection(rejection: Rejection | null): Record<string, unknown> | null {
  if (!rejection) return null;
  return rejection.kind === 'early-calendar'
    ? { ...rejection, firstEventAt: iso(rejection.firstEventAt) }
    : { ...rejection };
}

function plainWarning(warning: Warning): Record<string, unknown> {
  return warning.kind === 'home-only'
    ? { ...warning, firstEventAt: iso(warning.firstEventAt) }
    : { ...warning };
}

function plainPlan(plan: SessionPlan | null): BriefNight['plan'] {
  if (!plan) return null;
  return {
    departAt: iso(plan.departAt),
    returnAt: iso(plan.returnAt),
    wakeAt: isoOrNull(plan.wakeAt),
    sleepHours: plan.sleepHours,
    travelMinutes: plan.travelMinutes,
  };
}

/**
 * Jedno zdanie na górze briefu.
 *
 * Cron wyśle je jako temat wiadomości, więc musi nieść decyzję, a nie liczby:
 * „jedź dziś" i „nie ma po co" to dwa różne komunikaty, a nie dwa warianty
 * tego samego raportu.
 */
function headlineOf(nights: BriefNight[], siteName: string): string {
  const first = nights.find((n) => n.status === 'go');

  if (!first) return `Brak nocy do wyjazdu w najbliższych ${nights.length} dobach.`;

  const index = nights.indexOf(first);
  const when = index === 0 ? 'Dziś' : index === 1 ? 'Jutro' : 'Pojutrze';
  const window = first.window
    ? `, okno ${formatTime(new Date(first.window.from))}–${formatTime(new Date(first.window.to))}`
    : '';

  return `${when} można jechać na ${siteName}${window}.`;
}

/**
 * Wynik zawiera też nową pamięć przeglądu.
 *
 * Zwracamy ją stąd, a nie odtwarzamy u wywołującego: to `reviewEvents`
 * rozstrzyga, co zostało zgłoszone, i tylko on wie, w jakim stanie zjawisko
 * widziano. Odtwarzanie tego z gotowego briefu byłoby drugą implementacją tej
 * samej reguły — czyli dokładnie tym, czego brief ma pilnować.
 */
export type BriefResult = { brief: Brief; noticeLog: NoticeLog };

export function buildBrief(input: BriefInput): BriefResult {
  const { now, site, home, nights, events, config, leadHours, previousNotices = {} } = input;

  const planned = planNights({
    nights,
    target: { lat: site.lat, lon: site.lon },
    home,
    config,
    bortle: site.bortle,
    walkMinutes: site.walkMinutes,
    // Bez zjawisk żadna noc nie byłaby „niepowtarzalna", a wtedy silnik
    // skróciłby dla snu nawet noc zaćmienia.
    events,
  });

  const briefNights: BriefNight[] = planned.map(
    ({ verdict, minTemperature, targets, uncertain, seeing }) => ({
      from: iso(verdict.night.from),
      to: iso(verdict.night.to),
      status: verdict.status,
      uncertain,
      rejection: plainRejection(verdict.rejection),
      warnings: verdict.warnings.map(plainWarning),
      window: verdict.window
        ? {
            from: iso(verdict.window.from),
            to: iso(verdict.window.to),
            durationMinutes: verdict.window.durationMinutes,
            moonLimited: verdict.window.moonLimited,
          }
        : null,
      plan: plainPlan(verdict.plan),
      minTemperature,
      seeing,
      // Pełna lista, ale w kolejności od najefektowniejszych: odbiorcą jest cron,
      // który zwykle weźmie z niej kilka pierwszych pozycji.
      targets: rankedTargets(targets, targets.length).map((t) => ({
        id: t.id,
        name: t.name,
        detail: t.detail,
        kind: t.kind,
        bestAt: iso(t.bestAt),
        maxAltitude: Math.round(t.maxAltitude * 10) / 10,
        bestAzimuth: Math.round(t.bestAzimuth),
        magnitude: t.magnitude,
      })),
    }),
  );

  const { notices, log } = reviewEvents({
    now,
    events,
    verdicts: planned.map((p) => p.verdict),
    leadHours,
    refreshHour: config.refresh.hourOfDay,
    previous: previousNotices,
  });

  const brief: Brief = {
    version: BRIEF_VERSION,
    generatedAt: iso(now),
    site,
    summary: {
      headline: headlineOf(briefNights, site.name),
      nights: briefNights.length,
      go: briefNights.filter((n) => n.status === 'go').length,
      firstGo: briefNights.find((n) => n.status === 'go')?.from ?? null,
    },
    nights: briefNights,
    notices: notices.map((n) => ({
      eventId: n.event.id,
      title: n.title,
      body: n.body,
      reason: n.reason,
      notifyAt: iso(n.notifyAt),
      withVerdict: n.verdict !== null,
    })),
  };

  return { brief, noticeLog: log };
}
