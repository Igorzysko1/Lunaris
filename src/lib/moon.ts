/**
 * Dane o Księżycu — Open-Meteo nie zwraca o nim niczego.
 *
 * Liczone przez suncalc (algorytmy Meeusa), a nie własnym przybliżeniem cyklu
 * synodycznego: to drugie ignoruje eliptyczność orbity i myliło się o kilka godzin
 * w dacie nowiu oraz o ~1 pkt proc. w oświetleniu tarczy.
 */

import * as SunCalc from 'suncalc';

const MONTHS_SHORT = [
  'sty', 'lut', 'mar', 'kwi', 'maj', 'cze',
  'lip', 'sie', 'wrz', 'paź', 'lis', 'gru',
];

/** suncalc: phase 0 = nów, 0.25 = I kwadra, 0.5 = pełnia, 0.75 = ostatnia kwadra. */
const PHASES = [
  { name: 'Nów', glyph: '🌑' },
  { name: 'Sierp przybywający', glyph: '🌒' },
  { name: 'Pierwsza kwadra', glyph: '🌓' },
  { name: 'Przybywający garbaty', glyph: '🌔' },
  { name: 'Pełnia', glyph: '🌕' },
  { name: 'Ubywający garbaty', glyph: '🌖' },
  { name: 'Ostatnia kwadra', glyph: '🌗' },
  { name: 'Sierp ubywający', glyph: '🌘' },
];

export type Moon = {
  /** Procent oświetlonej tarczy, 0 (nów) – 100 (pełnia). */
  illumination: number;
  name: string;
  glyph: string;
  /** np. „Pełnia za 3 dni · 15 lip." */
  detail: string;
  /** Wschód i zachód Księżyca danej doby. Bywa, że któregoś nie ma. */
  rise: Date | null;
  set: Date | null;
};

const phaseOf = (date: Date) => SunCalc.getMoonIllumination(date).phase;

/** suncalc podaje fazę jako ułamek cyklu — mapujemy ją na jedną z ośmiu nazwanych faz. */
function phaseInfo(phase: number) {
  return PHASES[Math.round(phase * 8) % 8];
}

function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}.`;
}

function plural(days: number): string {
  if (days <= 0) return 'dziś';
  if (days === 1) return 'za 1 dzień';
  return `za ${days} dni`;
}

/**
 * Najbliższa pełnia albo nów — co wypadnie pierwsze.
 * Skanuje co godzinę, bo suncalc nie zwraca dat przesileń fazy.
 */
function nextMilestone(from: Date): { label: string; when: Date } {
  const HOUR = 3_600_000;
  let previous = phaseOf(from);

  for (let h = 1; h <= 24 * 32; h++) {
    const at = new Date(from.getTime() + h * HOUR);
    const phase = phaseOf(at);

    // Nów: faza przewija się z ~1 z powrotem do ~0.
    if (phase < previous) return { label: 'Nów', when: at };
    // Pełnia: faza przekracza 0.5.
    if (previous < 0.5 && phase >= 0.5) return { label: 'Pełnia', when: at };

    previous = phase;
  }

  // Nieosiągalne: cykl synodyczny trwa ~29.5 dnia, a skanujemy 32.
  throw new Error('Nie znaleziono najbliższej pełni ani nowiu');
}

/** Nów albo pełnia — jedyne zdarzenia, które wyróżniamy w kalendarzu. */
export type MoonEvent = 'new' | 'full';

export type MoonDay = {
  /** Lokalna północ tej doby. */
  date: Date;
  /** Czy dzień należy do oglądanego miesiąca (siatka dobija dni z sąsiednich). */
  inMonth: boolean;
  /** Oświetlenie tarczy zmienia się w ciągu doby — stąd przedział, a nie jedna liczba. */
  illuminationFrom: number;
  illuminationTo: number;
  illuminationMin: number;
  illuminationMax: number;
  name: string;
  glyph: string;
  /** Ustawione, gdy tej doby wypada nów albo pełnia. */
  event: MoonEvent | null;
  rise: Date | null;
  set: Date | null;
};

const HOUR_MS = 3_600_000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Dane o Księżycu dla jednej doby.
 *
 * Oświetlenie próbkujemy co godzinę, bo w ciągu doby potrafi się zmienić o kilkanaście
 * punktów procentowych, a w okolicy nowiu i pełni **zawraca** — wtedy wartości brzegowe
 * nie są jednocześnie minimum i maksimum.
 */
export function moonDay(day: Date, lat: number, lon: number, inMonth = true): MoonDay {
  const midnight = startOfDay(day);

  const illuminations: number[] = [];
  const phases: number[] = [];

  for (let h = 0; h <= 24; h++) {
    const at = new Date(midnight.getTime() + h * HOUR_MS);
    const { fraction, phase } = SunCalc.getMoonIllumination(at);
    illuminations.push(fraction * 100);
    phases.push(phase);
  }

  let event: MoonEvent | null = null;
  for (let i = 1; i < phases.length; i++) {
    // Nów: faza przewija się z ~1 z powrotem do ~0. Pełnia: przekracza 0.5.
    if (phases[i] < phases[i - 1]) event = 'new';
    else if (phases[i - 1] < 0.5 && phases[i] >= 0.5) event = 'full';
    if (event) break;
  }

  const { name, glyph } = phaseInfo(phases[12]);
  const times = SunCalc.getMoonTimes(midnight, lat, lon);

  return {
    date: midnight,
    inMonth,
    illuminationFrom: Math.round(illuminations[0]),
    illuminationTo: Math.round(illuminations[24]),
    illuminationMin: Math.round(Math.min(...illuminations)),
    illuminationMax: Math.round(Math.max(...illuminations)),
    name,
    glyph,
    event,
    rise: times.rise ?? null,
    set: times.set ?? null,
  };
}

/**
 * Pełna siatka kalendarza — 6 tygodni od poniedziałku, z dobitką dni z sąsiednich
 * miesięcy, żeby wiersze były równe.
 */
export function moonMonth(year: number, month: number, lat: number, lon: number): MoonDay[] {
  const first = new Date(year, month, 1);
  // getDay(): 0 = niedziela. U nas tydzień zaczyna się w poniedziałek.
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return moonDay(day, lat, lon, day.getMonth() === month);
  });
}

export function moonAt(date: Date, lat: number, lon: number): Moon {
  const { fraction, phase } = SunCalc.getMoonIllumination(date);
  const { name, glyph } = phaseInfo(phase);

  const milestone = nextMilestone(date);
  const daysAway = Math.round((milestone.when.getTime() - date.getTime()) / 86_400_000);
  const detail = `${milestone.label} ${plural(daysAway)} · ${formatDate(milestone.when)}`;

  const times = SunCalc.getMoonTimes(date, lat, lon);

  return {
    illumination: Math.round(fraction * 100),
    name,
    glyph,
    detail,
    rise: times.rise ?? null,
    set: times.set ?? null,
  };
}
