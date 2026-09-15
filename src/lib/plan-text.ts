/**
 * Noc › Plan po ludzku: przebieg doby od wyjazdu do pobudki, to, co z niego
 * wynika, ostrzeżenia i to, co w nocy w trakcie jeszcze czeka.
 *
 * Rachunek jest w `planNights` i `evaluateNight`; tu tylko układ pod ekran —
 * bloki paska, kroki z godzinami i zdania. Ostrzeżenia idą dosłownie
 * z `describeWarning`.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import { formatTime } from './date.ts';
import type { PlannedNight } from './night-plan.ts';
import type { Warning } from './session-engine.ts';
import { describeWarning, formatDuration } from './session-text.ts';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const decimal = (value: number) => value.toFixed(1).replace('.', ',');
const minutesBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / MINUTE_MS);

export type PlanBlock = { label: string; minutes: number; tone: 'neutral' | 'go' | 'accent' };
export type PlanStep = { time: string; text: string; session: boolean };
export type PlanOutcome = { label: string; value: string; tone?: 'warn' };
export type PlanWarning = { mark: string; tone: 'warn' | 'neutral'; text: string };

export type PlanSchedule = {
  /** „wyjazd 21:05 · powrót 03:25" */
  summary: string;
  /** Dojazd, sesja, powrót, sen — szerokości w minutach. */
  blocks: PlanBlock[];
  /** Podpisy pod paskiem: wyjazd, koniec sesji, pobudka — jako ułamek szerokości. */
  axis: { at: number; label: string }[];
  steps: PlanStep[];
  outcomes: PlanOutcome[];
  warnings: PlanWarning[];
  bookingNote: string;
};

/**
 * Ostrzeżenia, które zmieniają decyzję albo to, co spakować. Pozostałe —
 * dojście, zjawisko w oknie, przedłużona sesja — są informacją.
 */
const WARN_KINDS: Warning['kind'][] = [
  'dew',
  'high-clouds',
  'moon',
  'home-only',
  'tight-sleep',
  'handheld-wind',
  'session-trimmed',
  'sleep-sacrifice',
  'event-after-window',
];

export const UNCERTAIN_NIGHT =
  'Trzecia doba — prognoza jeszcze orientacyjna, sprawdź ponownie jutro.';

/** Zamiast Planu, gdy noc nie ma werdyktu „jedź". */
export const NO_PLAN =
  'Plan wyjazdu liczy się tylko dla nocy z werdyktem „jedź" — ta go nie ma, więc nie ma czego rozpisać na godziny.';

/** Wpis w kalendarzu przetrwał zmianę prognozy, a noc już nie przechodzi progów. */
export const STALE_BOOKING =
  'Ta noc nie przechodzi już progów, a jej rezerwacja wciąż jest w kalendarzu.';

/**
 * Plan nocy z werdyktem „jedź" rozpisany na godziny. `null`, gdy noc nie ma
 * planu wyjazdu albo okna.
 *
 * Sen kończy się pobudką z planu; bez niej — po `sleepHours` od powrotu.
 */
export function planSchedule(
  planned: PlannedNight,
  { walkMinutes }: { walkMinutes: number },
): PlanSchedule | null {
  const { verdict, minTemperature, feltTemperature, uncertain } = planned;
  const { plan, window } = verdict;
  if (verdict.status !== 'go' || !plan || !window) return null;

  const end =
    plan.wakeAt ??
    (plan.sleepHours !== null
      ? new Date(plan.returnAt.getTime() + plan.sleepHours * HOUR_MS)
      : plan.returnAt);

  const blocks = (
    [
      { label: 'dojazd', minutes: minutesBetween(plan.departAt, window.from), tone: 'neutral' },
      { label: 'sesja', minutes: minutesBetween(window.from, window.to), tone: 'go' },
      { label: 'powrót', minutes: minutesBetween(window.to, plan.returnAt), tone: 'neutral' },
      { label: 'sen', minutes: minutesBetween(plan.returnAt, end), tone: 'accent' },
    ] satisfies PlanBlock[]
  ).filter((block) => block.minutes > 0);

  const total = minutesBetween(plan.departAt, end);
  const sessionEnd = total > 0 ? minutesBetween(plan.departAt, window.to) / total : 1;
  const axis = [
    { at: 0, label: formatTime(plan.departAt) },
    { at: Math.round(sessionEnd * 1000) / 1000, label: formatTime(window.to) },
    ...(end > window.to ? [{ at: 1, label: formatTime(end) }] : []),
  ];

  const driving = plan.travelMinutes > 0;
  const parking = new Date(plan.departAt.getTime() + plan.travelMinutes * MINUTE_MS);
  const steps: PlanStep[] = [
    {
      at: plan.departAt,
      text: driving ? `wyjazd z domu · ${plan.travelMinutes} min drogi` : 'wyjazd',
      session: false,
    },
    ...(driving
      ? [
          {
            at: parking,
            text: walkMinutes > 0 ? `parking · ${walkMinutes} min dojścia` : 'na miejscu',
            session: false,
          },
        ]
      : []),
    { at: window.from, text: 'start sesji', session: true },
    { at: window.to, text: 'koniec sesji · zwijanie', session: true },
    { at: plan.returnAt, text: driving ? 'powrót do domu' : 'koniec wyjazdu', session: false },
    ...(plan.wakeAt ? [{ at: plan.wakeAt, text: 'pobudka', session: false }] : []),
  ].map(({ at, text, session }) => ({ time: formatTime(at), text, session }));

  const sleepWarn = verdict.warnings.some(
    (w) => w.kind === 'tight-sleep' || w.kind === 'sleep-sacrifice',
  );
  // Odczuwalna dopiero wtedy, gdy wiatr faktycznie coś zmienia — inaczej to ta
  // sama liczba dwa razy.
  const colderByWind =
    minTemperature !== null && feltTemperature !== null && minTemperature - feltTemperature >= 1;

  const outcomes: PlanOutcome[] = [
    {
      label: 'sen',
      value: plan.sleepHours !== null ? `${decimal(plan.sleepHours)} h` : '—',
      ...(sleepWarn ? { tone: 'warn' as const } : {}),
    },
    {
      label: 'min. temp.',
      value: minTemperature !== null ? `${decimal(minTemperature)} °C` : '—',
    },
    ...(colderByWind
      ? [{ label: 'w odczuciu', value: `${decimal(feltTemperature)} °C`, tone: 'warn' as const }]
      : []),
  ];

  const warnings: PlanWarning[] = [
    ...verdict.warnings.map((warning): PlanWarning =>
      WARN_KINDS.includes(warning.kind)
        ? { mark: '!', tone: 'warn', text: describeWarning(warning) }
        : { mark: '·', tone: 'neutral', text: describeWarning(warning) },
    ),
    ...(uncertain ? [{ mark: '?', tone: 'neutral' as const, text: UNCERTAIN_NIGHT }] : []),
  ];

  const departure = formatTime(plan.departAt);
  const arrival = formatTime(plan.returnAt);

  return {
    summary: `wyjazd ${departure} · powrót ${arrival}`,
    blocks,
    axis,
    steps,
    outcomes,
    warnings,
    bookingNote: `Wpis obejmie ${departure} → ${arrival}, czyli cały wyjazd — tyle realnie jesteś nieosiągalny. Samo okno schodzi do opisu.`,
  };
}

/**
 * „Co dalej dziś" w nocy w trakcie (9b): koniec sesji, wschód Księżyca
 * i powrót z tym, ile zostanie snu — tylko to, co jeszcze przed nami.
 */
export function tonightAhead(
  planned: PlannedNight,
  moonRise: Date | null,
  now: Date,
): { time: string; text: string }[] {
  const { plan, window } = planned.verdict;

  const items = [
    ...(window ? [{ at: window.to, text: 'koniec sesji · zwijanie' }] : []),
    ...(moonRise ? [{ at: moonRise, text: 'wschód Księżyca' }] : []),
    ...(plan
      ? [
          {
            at: plan.returnAt,
            text:
              plan.sleepHours !== null
                ? `powrót · zostanie ${decimal(plan.sleepHours)} h snu`
                : 'powrót',
          },
        ]
      : []),
  ];

  return items
    .filter((item) => item.at > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((item) => ({ time: formatTime(item.at), text: item.text }));
}

/** „dojazd 47 min · na miejscu 4 h 30 min · zwijanie i powrót 45 min" — z zapisanego przebiegu. */
export function describeSegments(segments: {
  travel: number | null;
  observing: number | null;
  packAndReturn: number | null;
}): string {
  return [
    segments.travel !== null ? `dojazd ${formatDuration(segments.travel)}` : null,
    segments.observing !== null ? `na miejscu ${formatDuration(segments.observing)}` : null,
    segments.packAndReturn !== null
      ? `zwijanie i powrót ${formatDuration(segments.packAndReturn)}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
