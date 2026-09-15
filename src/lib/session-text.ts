/**
 * Werdykt nocy po ludzku.
 *
 * Te zdania mieszkały w komponencie karty sesji, więc istniały wyłącznie na
 * ekranie. Są jednak czystym rachunkiem na danych werdyktu i potrzebują ich
 * także CLI, raport miesięczny i każde miejsce poza Reactem. Jedno źródło znaczy
 * też, że korekta sformułowania nie rozjedzie dwóch miejsc.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import { formatTime } from './date.ts';
import type { PlannedNight } from './night-plan.ts';
import type { CloudSummary, MoonOverNight, NightSummary } from './night-summary.ts';
import type { NightVerdict, Rejection, Warning } from './session-engine.ts';

const MINUTES_PER_HOUR = 60;

/** np. „3 h 20 min" — długość okna czyta się szybciej niż same minuty. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = Math.round(minutes % MINUTES_PER_HOUR);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Nagłówek nocy: „Dziś w nocy", „Jutro", potem dzień tygodnia. */
export function nightLabel(from: Date, now: Date): string {
  const days = ['niedzieli', 'poniedziałku', 'wtorku', 'środy', 'czwartku', 'piątku', 'soboty'];
  const sameDay =
    from.getFullYear() === now.getFullYear() &&
    from.getMonth() === now.getMonth() &&
    from.getDate() === now.getDate();

  if (sameDay) return 'Dziś w nocy';

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isTomorrow =
    from.getFullYear() === tomorrow.getFullYear() &&
    from.getMonth() === tomorrow.getMonth() &&
    from.getDate() === tomorrow.getDate();

  return isTomorrow ? 'Jutro w nocy' : `Z ${days[from.getDay()]} na następny dzień`;
}

/** Powód odrzucenia po ludzku — użytkownik ma wiedzieć, czego nie da się obejść. */
export function describeRejection(rejection: Rejection): string {
  switch (rejection.kind) {
    case 'no-forecast':
      return 'Brak prognozy na tę noc.';
    case 'conditions':
      switch (rejection.blocker) {
        case 'precipitation':
          return 'Opady przez całą noc.';
        case 'cloud-low':
          return 'Chmury niskie zasłaniają niebo.';
        case 'cloud-high':
          return 'Gęste chmury wysokie przez całą noc.';
        case 'cloud-total':
          return 'Zachmurzenie powyżej progu przez całą noc.';
        case 'wind':
          return 'Porywy wiatru powyżej progu — sprzęt nie ustoi.';
      }
    // Świadome przejście do kolejnego case: każdy blocker wyżej kończy się return.
    case 'window-too-short':
      return `Najdłuższe pogodne okno to ${formatDuration(rejection.longestMinutes)} — za krótko.`;
    case 'not-enough-sleep': {
      const sleep = `Zostałoby ${rejection.sleepHours.toFixed(1)} h snu`;
      // Godzina, od której liczony jest sen, to jedyne, co da się zmienić:
      // przełożyć spotkanie albo poprawić założenie w ustawieniach. Bez niej
      // powód brzmi jak werdykt pogody, a nie poranka.
      if (!rejection.firstEventAt) return `${sleep} przed pobudką.`;

      return rejection.fromCalendar
        ? `${sleep} — pierwsze wydarzenie w kalendarzu o ${formatTime(rejection.firstEventAt)}.`
        : `${sleep} — zakładany początek dnia o ${formatTime(rejection.firstEventAt)}.`;
    }
  }
}

export function describeWarning(warning: Warning): string {
  switch (warning.kind) {
    case 'dew':
      return `Rosa: temperatura ${warning.minSpreadC.toFixed(1)}°C od punktu rosy — weź ogrzewacz na obiektyw.`;
    case 'high-clouds':
      return `Chmury wysokie do ${Math.round(warning.maxPercent)}% — kontrast będzie słabszy.`;
    case 'moon':
      return `Księżyc oświetlony w ${warning.illumination}% — tylko cele księżycowe i planetarne.`;
    case 'home-only':
      return `Wydarzenie o ${formatTime(warning.firstEventAt)} — trzymaj się bliskiej lokalizacji.`;
    case 'walk-too-long':
      return `Dojście od parkingu zajmuje ${Math.round(warning.walkMinutes)} min.`;
    case 'tight-sleep':
      return `Sen na styk: ${warning.sleepHours.toFixed(1)} h. Możesz odpuścić.`;
    case 'handheld-wind':
      return `Porywy do ${Math.round(warning.maxGustKmh)} km/h — dla sprzętu z ręki (próg ${warning.handheldLimitKmh} km/h) noc będzie trudna.`;
    case 'session-trimmed':
      return warning.reason === 'sleep'
        ? `Sesja skrócona o ${formatDuration(warning.droppedMinutes)}, żeby zostało na sen. Pogoda pozwala dłużej.`
        : `Sesja skrócona o ${formatDuration(warning.droppedMinutes)} do twojego limitu długości.`;
    case 'sleep-sacrifice':
      return warning.reason === 'phenomenon'
        ? `Zjawisko, które się nie powtórzy — nie skracam nocy. Zostanie ${warning.sleepHours.toFixed(1)} h snu.`
        : `Noc wyjątkowo dobra — nie skracam jej. Zostanie ${warning.sleepHours.toFixed(1)} h snu.`;
    case 'event-in-window':
      return `${warning.title} o ${formatTime(warning.at)} — wypada w trakcie sesji.`;
    case 'session-stretched':
      return `Sesja przedłużona o ${formatDuration(warning.extraMinutes)}, żeby złapać: ${warning.title} o ${formatTime(warning.at)}.`;
    case 'event-after-window':
      return `${warning.title} o ${formatTime(warning.at)} — ${formatDuration(warning.minutesAfter)} po końcu sesji. Zostań dłużej albo odpuść świadomie.`;
  }
}

const DAY_MS = 86_400_000;

// prettier-ignore
const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

/** Biernik: „w środę", „w sobotę" — pozostałe dni brzmią jak w mianowniku. */
// prettier-ignore
const WEEKDAYS_ACCUSATIVE = ['niedzielę', 'poniedziałek', 'wtorek', 'środę', 'czwartek', 'piątek', 'sobotę'];

/** Doby kalendarzowe, nie milisekundy — doba zmiany czasu ma 23 albo 25 godzin. */
function daysFromToday(date: Date, now: Date): number {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((day - today) / DAY_MS);
}

/**
 * Noc względem dziś: „dziś", „jutro", „pojutrze", dalej dzień tygodnia.
 *
 * Po północy noc, która zaczęła się wczoraj wieczorem, nie jest ani „dziś", ani
 * „wczoraj" — to „ta noc", dopóki trwa. Inaczej o drugiej w nocy trwająca noc
 * i ta zaczynająca się wieczorem dostałyby tę samą etykietę.
 */
export function nightRelative(night: { from: Date; to: Date }, now: Date): string {
  const days = daysFromToday(night.from, now);
  if (days < 0) return now < night.to ? 'ta noc' : 'miniona noc';
  if (days === 0) return 'dziś';
  if (days === 1) return 'jutro';
  if (days === 2) return 'pojutrze';
  return WEEKDAYS[night.from.getDay()];
}

/** Nagłówek nocy nad Planem: „Dziś w nocy", „W czwartek w nocy". */
export function nightHeading(night: { from: Date; to: Date }, now: Date): string {
  const days = daysFromToday(night.from, now);
  if (days < 0) return now < night.to ? 'Ta noc' : 'Miniona noc';
  if (days === 0) return 'Dziś w nocy';
  if (days === 1) return 'Jutro w nocy';
  if (days === 2) return 'Pojutrze w nocy';
  return `W ${WEEKDAYS_ACCUSATIVE[night.from.getDay()]} w nocy`;
}

/**
 * Zdanie z wyróżnionymi liczbami: kolejne kawałki tekstu i to, czy pogrubić.
 * Liczby są pogrubione, bo to je się czyta w aucie — reszta je tylko wiąże.
 */
export type Narration = [string, boolean][];

export type VerdictChip = { label: string; warn: boolean };

const percent = (value: number) => `${Math.round(value)}%`;

/** Przecinek dziesiętny, jak w reszcie karty: „4,1 °C". */
const decimal = (value: number) => value.toFixed(1).replace('.', ',');

function narrateClouds(clouds: CloudSummary): Narration {
  if (clouds.max <= 5) return [['Bez chmur przez całe okno.', false]];

  if (clouds.max - clouds.min < 5) {
    return [
      ['Chmury równo około ', false],
      [percent(clouds.average), true],
      [' przez całe okno.', false],
    ];
  }

  const lowest: Narration = [
    [percent(clouds.min), true],
    [' około ', false],
    [formatTime(clouds.minAt), true],
    ['.', false],
  ];

  return clouds.max <= 20
    ? [['Czysto przez całe okno — chmury schodzą do ', false], ...lowest]
    : [
        ['Chmury w oknie do ', false],
        [percent(clouds.max), true],
        [', najmniej ', false],
        ...lowest,
      ];
}

/**
 * Księżyc względem sesji, a nie względem nocy: wschód o 02:51 nie przeszkadza
 * sesji kończącej się o 02:40, a ten sam wschód o 23:00 przeszkadza.
 */
function narrateMoon(moon: MoonOverNight, window: { from: Date; to: Date }): Narration {
  if (moon.illumination <= 2) return [['Księżyc przy nowiu nie przeszkadza.', false]];

  const lit: Narration = [
    ['Księżyc w ', false],
    [percent(moon.illumination), true],
  ];
  const { up, rise, set } = moon;
  const overlaps = up !== null && up.from < window.to && up.to > window.from;

  if (!overlaps) {
    if (rise && rise >= window.to) {
      return [
        ...lit,
        [' wschodzi ', false],
        [formatTime(rise), true],
        [', już po końcu sesji.', false],
      ];
    }
    if (set && set <= window.from) {
      return [
        ...lit,
        [' zachodzi ', false],
        [formatTime(set), true],
        [', zanim zacznie się sesja.', false],
      ];
    }
    return [...lit, [' pod horyzontem przez całą noc.', false]];
  }

  if (rise && rise > window.from && rise < window.to) {
    return [
      ...lit,
      [' wschodzi ', false],
      [formatTime(rise), true],
      [' — w trakcie sesji.', false],
    ];
  }
  if (set && set > window.from && set < window.to) {
    return [...lit, [' zachodzi ', false], [formatTime(set), true], [' — w trakcie sesji.', false]];
  }
  return [...lit, [' nad horyzontem przez całe okno.', false]];
}

const CLOUD_SUBJECT = {
  'cloud-total': 'Chmury',
  'cloud-low': 'Chmury niskie',
  'cloud-high': 'Chmury wysokie',
} as const;

/**
 * Odrzucenie z liczbami — tylko wtedy, gdy liczby mówią prawdę o całej nocy.
 * W każdym innym przypadku zostaje zdanie z `describeRejection`.
 */
function narrateRejection(rejection: Rejection, summary: NightSummary): Narration {
  const { blocking } = summary;

  if (rejection.kind === 'conditions' && blocking) {
    const tail: Narration = [['. Z tej lokalizacji nie ma czego ratować.', false]];

    switch (rejection.blocker) {
      case 'cloud-total':
      case 'cloud-low':
      case 'cloud-high':
        return [
          [`${CLOUD_SUBJECT[rejection.blocker]} nie schodzą poniżej `, false],
          [percent(blocking.value), true],
          [' ani na godzinę — próg to ', false],
          [percent(blocking.limit), true],
          ...tail,
        ];
      case 'wind':
        return [
          ['Porywy nie słabną poniżej ', false],
          [`${Math.round(blocking.value)} km/h`, true],
          [' ani na godzinę — próg to ', false],
          [`${Math.round(blocking.limit)} km/h`, true],
          ...tail,
        ];
      case 'precipitation':
        return [['Pada w każdej godzinie nocy', false], ...tail];
    }
  }

  // Pojedyncza godzina, która przeszła przez progi, to okno „0 min" — liczba
  // prawdziwa dla silnika, ale jako zdanie brzmi jak błąd.
  if (rejection.kind === 'window-too-short' && rejection.longestMinutes < 60) {
    return [['Przejaśnia się najwyżej na pojedyncze godziny — za krótko na sesję.', false]];
  }

  return [[describeRejection(rejection), false]];
}

/**
 * Zdanie werdyktu pod paskiem nocy.
 *
 * Zastępuje w aplikacji narrację agenta z `narrative.ts`: tamta przychodzi
 * z Dysku i tylko do CLI, a karta nocy ma mówić pełnym zdaniem także bez sieci.
 * Każda liczba pochodzi z rachunku — zdanie niczego nie dopowiada.
 */
export function narrateVerdict(verdict: NightVerdict, summary: NightSummary): Narration {
  if (verdict.status === 'go' && verdict.window) {
    const moon = narrateMoon(summary.moon, verdict.window);
    return summary.clouds ? [...narrateClouds(summary.clouds), [' ', false], ...moon] : moon;
  }

  return verdict.rejection ? narrateRejection(verdict.rejection, summary) : [];
}

const BLOCKER_LABEL = {
  'cloud-total': 'CHMURY',
  'cloud-low': 'CHMURY NISKIE',
  'cloud-high': 'CHMURY WYSOKIE',
  wind: 'WIATR',
  precipitation: 'OPADY',
} as const;

/** Napis na zakreskowanym pasku i podpis w rogu karty nocy odrzuconej. */
export function rejectionLabels(
  rejection: Rejection,
  summary: NightSummary,
): { bar: string; meta: string } {
  switch (rejection.kind) {
    case 'conditions': {
      const what = BLOCKER_LABEL[rejection.blocker];
      if (!summary.blocking) return { bar: `BEZ OKNA · GŁÓWNIE ${what}`, meta: 'brak okna' };

      const cloud = rejection.blocker !== 'wind' && rejection.blocker !== 'precipitation';
      const value = cloud ? ` ${percent(summary.blocking.value)}` : '';
      return { bar: `${what}${value} CAŁĄ NOC`, meta: 'brak okna' };
    }
    case 'window-too-short':
      return {
        bar: 'ZA KRÓTKIE OKNO',
        meta:
          rejection.longestMinutes >= 60
            ? `najdłużej ${formatDuration(rejection.longestMinutes)}`
            : 'brak okna',
      };
    case 'not-enough-sleep':
      return { bar: 'ZA MAŁO SNU', meta: `${decimal(rejection.sleepHours)} h snu` };
    case 'no-forecast':
      return { bar: 'BRAK PROGNOZY', meta: 'brak danych' };
  }
}

/**
 * Żetony pod zdaniem werdyktu. Przy „jedź" to, co decyduje o spakowaniu się:
 * chmury, seeing, zimno i rosa. Przy „odpuść" — to, co widać bez wyjazdu.
 */
export function verdictChips(
  night: Pick<PlannedNight, 'verdict' | 'seeing' | 'minTemperature'>,
  summary: NightSummary,
  dewWarningSpreadC: number,
): VerdictChip[] {
  const chips: VerdictChip[] = [];
  if (summary.clouds)
    chips.push({ label: `chmury ${percent(summary.clouds.average)}`, warn: false });

  if (night.verdict.status !== 'go') {
    chips.push({ label: `Księżyc ${percent(summary.moon.illumination)}`, warn: false });
    return chips;
  }

  if (night.seeing) chips.push({ label: `seeing ${night.seeing.index}/5`, warn: false });
  if (night.minTemperature !== null) {
    chips.push({ label: `min. ${decimal(night.minTemperature)} °C`, warn: false });
  }
  if (summary.minDewSpread !== null) {
    const warn = summary.minDewSpread < dewWarningSpreadC;
    chips.push({ label: `${warn ? '! ' : ''}rosa ${decimal(summary.minDewSpread)} K`, warn });
  }

  return chips;
}

/** Księżyc tej nocy jednym wierszem: „Księżyc 12%, wschód 02:51". */
export function describeMoonTonight(moon: MoonOverNight): string {
  const lit = `Księżyc ${percent(moon.illumination)}`;

  if (moon.rise && moon.up?.from.getTime() === moon.rise.getTime()) {
    return `${lit}, wschód ${formatTime(moon.rise)}`;
  }
  if (moon.set && moon.up?.to.getTime() === moon.set.getTime()) {
    return `${lit}, zachód ${formatTime(moon.set)}`;
  }
  return moon.up ? `${lit}, nad horyzontem całą noc` : `${lit}, pod horyzontem całą noc`;
}
