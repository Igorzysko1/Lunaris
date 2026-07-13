/**
 * Faza Księżyca liczona lokalnie — Open-Meteo nie zwraca danych o Księżycu,
 * a oświetlenie tarczy wchodzi do oceny nocy (jasny Księżyc rozświetla niebo).
 *
 * Przybliżenie oparte o średni miesiąc synodyczny. Wystarcza do oceny warunków
 * (błąd rzędu godzin), nie nadaje się do efemeryd.
 */

const SYNODIC_MONTH = 29.530588853;
/** Nów z 6 stycznia 2000, 18:14 UTC — punkt odniesienia cyklu. */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) / 86_400_000;

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

const MONTHS_SHORT = [
  'sty', 'lut', 'mar', 'kwi', 'maj', 'cze',
  'lip', 'sie', 'wrz', 'paź', 'lis', 'gru',
];

export type Moon = {
  /** Dni od ostatniego nowiu (0 – 29.53). */
  age: number;
  /** Procent oświetlonej tarczy, 0 (nów) – 100 (pełnia). */
  illumination: number;
  name: string;
  glyph: string;
  /** np. „Pełnia za 3 dni · 15 lip." */
  detail: string;
};

function moonAge(date: Date): number {
  const days = date.getTime() / 86_400_000 - KNOWN_NEW_MOON;
  const age = days % SYNODIC_MONTH;
  return age < 0 ? age + SYNODIC_MONTH : age;
}

function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}.`;
}

/** Ile dni do najbliższego przesilenia fazy (nowiu albo pełni) i kiedy ono wypada. */
function nextMilestone(age: number, now: Date) {
  const full = SYNODIC_MONTH / 2;
  const isBeforeFull = age < full;
  const daysAway = isBeforeFull ? full - age : SYNODIC_MONTH - age;
  const when = new Date(now.getTime() + daysAway * 86_400_000);
  return { label: isBeforeFull ? 'Pełnia' : 'Nów', daysAway, when };
}

function plural(days: number): string {
  if (days === 0) return 'dziś';
  if (days === 1) return 'za 1 dzień';
  return `za ${days} dni`;
}

export function moonAt(date: Date = new Date()): Moon {
  const age = moonAge(date);
  const illumination = Math.round(((1 - Math.cos((2 * Math.PI * age) / SYNODIC_MONTH)) / 2) * 100);

  const index = Math.floor((age / SYNODIC_MONTH) * 8 + 0.5) % 8;
  const phase = PHASES[index];

  const milestone = nextMilestone(age, date);
  const detail = `${milestone.label} ${plural(Math.round(milestone.daysAway))} · ${formatDate(milestone.when)}`;

  return { age, illumination, name: phase.name, glyph: phase.glyph, detail };
}
