/**
 * Przebieg sesji na żywo — kiedy naprawdę wyjechałem, dojechałem, zwinąłem się
 * i wróciłem.
 *
 * Plan sesji stoi na dwóch założeniach, których nic nie sprawdza: średniej
 * prędkości dojazdu i czasie zwijania sprzętu. Z nich wynika godzina powrotu,
 * a z niej ilość snu, która skraca albo odrzuca noc. Cztery godziny zapisane
 * dotknięciem to jedyne dane, które mogą te założenia zweryfikować — dlatego
 * trafiają do dziennika obok planu, a nie tylko do kalendarza.
 *
 * Cztery kroki, a nie dwa, bo dopiero cztery rozdzielają dojazd, obserwację,
 * zwijanie i powrót. Z samego „wyjechałem" i „wróciłem" nie da się powiedzieć,
 * czy zawiodła prędkość, czy czas na miejscu.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export type TimelineStep = 'departed' | 'arrived' | 'packing' | 'home';

export const TIMELINE_STEPS: readonly TimelineStep[] = ['departed', 'arrived', 'packing', 'home'];

/** Napis na przycisku i podpis zapisanej godziny. */
export const STEP_LABELS: Record<TimelineStep, { action: string; done: string }> = {
  departed: { action: 'Wyjeżdżam', done: 'Wyjazd' },
  arrived: { action: 'Jestem na miejscu', done: 'Na miejscu' },
  packing: { action: 'Zbieram się', done: 'Zwijanie' },
  home: { action: 'W domu', done: 'Powrót' },
};

/** Plan z chwili wyjazdu — punkt odniesienia dla kalibracji. */
export type PlannedTimes = {
  departAt: string;
  returnAt: string;
  windowFrom: string | null;
  windowTo: string | null;
};

export type SessionTimeline = {
  departed: string | null;
  arrived: string | null;
  packing: string | null;
  home: string | null;
  /**
   * Plan zamrożony przy wyjeździe. Cykl przelicza noc codziennie, a porównanie
   * ma być z tym, co obowiązywało, gdy się wyjeżdżało — nie z prognozą z rana.
   */
  planned: PlannedTimes | null;
  /** Wersja zapisu; kalendarz jest aktualny, gdy `calendarSyncedAt` jej dorównuje. */
  updatedAt: string;
  calendarSyncedAt: string | null;
};

const blank = (): SessionTimeline => ({
  departed: null,
  arrived: null,
  packing: null,
  home: null,
  planned: null,
  updatedAt: '',
  calendarSyncedAt: null,
});

/** Kolejny krok do zapisania; `null`, gdy noc jest już zamknięta. */
export function nextStep(timeline: SessionTimeline | null): TimelineStep | null {
  return TIMELINE_STEPS.find((step) => !timeline?.[step]) ?? null;
}

/** Ostatni zapisany krok — ten, który da się cofnąć. */
export function lastStep(timeline: SessionTimeline | null): TimelineStep | null {
  const done = TIMELINE_STEPS.filter((step) => timeline?.[step]);
  return done[done.length - 1] ?? null;
}

/** Zapisane godziny nie cofają się między kolejnymi krokami. */
function inOrder(timeline: SessionTimeline): boolean {
  let previous = -Infinity;
  for (const step of TIMELINE_STEPS) {
    const value = timeline[step];
    if (!value) continue;
    const at = Date.parse(value);
    if (at < previous) return false;
    previous = at;
  }
  return true;
}

/** Plan nocy w postaci do zapisu. `null`, gdy noc nie ma planu wyjazdu. */
export function plannedFrom(
  plan: { departAt: Date; returnAt: Date } | null,
  window: { from: Date; to: Date } | null,
): PlannedTimes | null {
  if (!plan) return null;
  return {
    departAt: plan.departAt.toISOString(),
    returnAt: plan.returnAt.toISOString(),
    windowFrom: window?.from.toISOString() ?? null,
    windowTo: window?.to.toISOString() ?? null,
  };
}

/** Zapisuje kolejny krok. Przy wyjeździe zamraża plan. */
export function recordStep(
  timeline: SessionTimeline | null,
  at: Date,
  plan: PlannedTimes | null,
): SessionTimeline {
  const base = timeline ?? blank();
  const step = nextStep(base);
  if (!step) return base;

  return {
    ...base,
    [step]: at.toISOString(),
    planned: step === 'departed' ? plan : base.planned,
    updatedAt: at.toISOString(),
  };
}

/**
 * Cofa ostatni krok. Dotknięcie w złym momencie nie może zostać w danych do
 * kalibracji — cofnięty wyjazd zabiera ze sobą zamrożony plan.
 */
export function undoLastStep(timeline: SessionTimeline, now: Date): SessionTimeline {
  const step = lastStep(timeline);
  if (!step) return timeline;

  return {
    ...timeline,
    [step]: null,
    planned: step === 'departed' ? null : timeline.planned,
    updatedAt: now.toISOString(),
  };
}

/**
 * Poprawia godzinę zapisanego kroku. `null`, gdy poprawka nie ma sensu: krok
 * nie jest zapisany, godzina wypadłaby w przyszłości albo przed poprzednim
 * krokiem.
 */
export function adjustStep(
  timeline: SessionTimeline,
  step: TimelineStep,
  minutes: number,
  now: Date,
): SessionTimeline | null {
  const current = timeline[step];
  if (!current) return null;

  const moved = new Date(Date.parse(current) + minutes * MINUTE_MS);
  // Zapisać można tylko to, co już się stało.
  if (moved.getTime() > now.getTime()) return null;

  const next = { ...timeline, [step]: moved.toISOString(), updatedAt: now.toISOString() };
  return inOrder(next) ? next : null;
}

/**
 * Wpisuje godziny kroków z pamięci — także tych, których w terenie nie zapisano
 * („w domu: nie zmierzono"). Wszystkie zmiany naraz: przesunięcie wyjazdu
 * i dojazdu o godzinę później sprawdzane krok po kroku odbiłoby się od starej
 * godziny dojazdu. `null`, gdy któraś godzina wypada w przyszłości albo nie po kolei.
 */
export function setStepTimes(
  timeline: SessionTimeline | null,
  changes: Partial<Record<TimelineStep, Date>>,
  now: Date,
): SessionTimeline | null {
  const entries = Object.entries(changes) as [TimelineStep, Date][];
  if (entries.some(([, at]) => Number.isNaN(at.getTime()) || at.getTime() > now.getTime())) {
    return null;
  }

  const next: SessionTimeline = { ...(timeline ?? blank()), updatedAt: now.toISOString() };
  for (const [step, at] of entries) next[step] = at.toISOString();

  return inOrder(next) ? next : null;
}

/** Planowana godzina kroku z zamrożonego planu: wyjazd, start okna, koniec okna, powrót. */
export function plannedStep(planned: PlannedTimes | null, step: TimelineStep): string | null {
  if (!planned) return null;

  switch (step) {
    case 'departed':
      return planned.departAt;
    case 'arrived':
      return planned.windowFrom;
    case 'packing':
      return planned.windowTo;
    case 'home':
      return planned.returnAt;
  }
}

const minutesBetween = (from: string | null, to: string | null) =>
  from && to ? Math.round((Date.parse(to) - Date.parse(from)) / MINUTE_MS) : null;

/** Długości odcinków w minutach; `null` tam, gdzie brakuje którejś godziny. */
export function segmentMinutes(timeline: SessionTimeline) {
  return {
    travel: minutesBetween(timeline.departed, timeline.arrived),
    observing: minutesBetween(timeline.arrived, timeline.packing),
    packAndReturn: minutesBetween(timeline.packing, timeline.home),
    total: minutesBetween(timeline.departed, timeline.home),
  };
}

/** Planowany blok w kalendarzu: zamrożony plan, a bez niego — bieżący. */
export function plannedWindow(
  planned: PlannedTimes | null,
  plan: { departAt: Date; returnAt: Date } | null,
): { start: Date; end: Date } | null {
  if (planned) return { start: new Date(planned.departAt), end: new Date(planned.returnAt) };
  return plan ? { start: plan.departAt, end: plan.returnAt } : null;
}

/**
 * Godziny wpisu w kalendarzu. Wyjazd przesuwa początek, powrót ustawia koniec;
 * do tego czasu obowiązuje plan. `null`, gdy nie ma z czego ich złożyć.
 */
export function calendarWindow(
  timeline: SessionTimeline,
  fallback: { start: Date; end: Date } | null,
): { start: Date; end: Date } | null {
  const start = timeline.departed ? new Date(timeline.departed) : fallback?.start;
  const plannedEnd = timeline.home ? new Date(timeline.home) : fallback?.end;
  if (!start || !plannedEnd) return null;

  // Wyjazd dużo później, niż planowano, nie może dać wpisu kończącego się
  // przed początkiem — do czasu powrotu blok trwa przynajmniej godzinę.
  const end = plannedEnd > start ? plannedEnd : new Date(start.getTime() + HOUR_MS);
  return { start, end };
}

/** Czy kalendarz jest za zapisem — zmiana bez sieci czeka tu na powrót zasięgu. */
export function needsCalendarSync(timeline: SessionTimeline | null): boolean {
  if (!timeline || timeline.updatedAt === '') return false;
  return timeline.calendarSyncedAt === null || timeline.calendarSyncedAt < timeline.updatedAt;
}

/**
 * Oznacza wersję jako przesłaną do kalendarza. Znacznikiem jest `updatedAt`
 * tej wersji, a nie chwila wysłania: krok zapisany w trakcie żądania ma
 * dostać własną synchronizację.
 */
export function markSynced(timeline: SessionTimeline): SessionTimeline {
  return { ...timeline, calendarSyncedAt: timeline.updatedAt };
}

/**
 * Która noc z listy jest „trwająca" — pierwsza, która nie skończyła się dawniej
 * niż sześć godzin temu. Powrót po obserwacji do rana wciąż należy do nocy,
 * a po południu następnego dnia pierwszeństwo ma już kolejna. `-1`, gdy żadna.
 */
export function liveNightIndex(nights: readonly { from: Date; to: Date }[], now: Date): number {
  return nights.findIndex((night) => now.getTime() < night.to.getTime() + 6 * HOUR_MS);
}

const iso = (value: unknown): string | null =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;

/**
 * Przebieg nocy z zapisu dziennika. `undefined`, gdy go nie ma.
 *
 * Godziny w złej kolejności to zapis, któremu nie wolno ufać przy kalibracji —
 * lepiej zgubić godziny tej jednej nocy niż zasilić rachunek pomyłką.
 */
export function parseTimeline(value: unknown): SessionTimeline | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;

  const rawPlan = raw.planned as Record<string, unknown> | null | undefined;
  const departAt = rawPlan && typeof rawPlan === 'object' ? iso(rawPlan.departAt) : null;
  const returnAt = rawPlan && typeof rawPlan === 'object' ? iso(rawPlan.returnAt) : null;

  const timeline: SessionTimeline = {
    departed: iso(raw.departed),
    arrived: iso(raw.arrived),
    packing: iso(raw.packing),
    home: iso(raw.home),
    planned:
      rawPlan && departAt && returnAt
        ? {
            departAt,
            returnAt,
            windowFrom: iso(rawPlan.windowFrom),
            windowTo: iso(rawPlan.windowTo),
          }
        : null,
    updatedAt: iso(raw.updatedAt) ?? '',
    calendarSyncedAt: iso(raw.calendarSyncedAt),
  };

  return inOrder(timeline)
    ? timeline
    : { ...timeline, departed: null, arrived: null, packing: null, home: null };
}
