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

export function moonAt(date: Date, lat: number, lon: number): Moon {
  const { fraction, phase } = SunCalc.getMoonIllumination(date);

  const index = Math.round(phase * 8) % 8;
  const { name, glyph } = PHASES[index];

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
