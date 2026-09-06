const WEEKDAYS = [
  'Niedziela', 'Poniedziałek', 'Wtorek', 'Środa',
  'Czwartek', 'Piątek', 'Sobota',
];

const MONTHS_GENITIVE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

const MONTHS_NOMINATIVE = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

const WEEKDAYS_ABBR = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];

const MONTHS_SHORT = [
  'sty', 'lut', 'mar', 'kwi', 'maj', 'cze',
  'lip', 'sie', 'wrz', 'paź', 'lis', 'gru',
];

/** Skróty dni tygodnia w nagłówku kalendarza, od poniedziałku. */
export const WEEKDAYS_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

/** np. „Niedziela, 12 lipca". Ręcznie, bo Intl bywa okrojony w Hermesie. */
export function formatLongDate(date: Date = new Date()): string {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** np. „Lipiec 2026". */
export function formatMonth(date: Date): string {
  return `${MONTHS_NOMINATIVE[date.getMonth()]} ${date.getFullYear()}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** np. „22:40". Doba 24-godzinna, bez sekund. */
export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** np. „śr., 15 lip.". */
export function formatShortDate(date: Date): string {
  return `${WEEKDAYS_ABBR[date.getDay()]}, ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}.`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Nagłówek dnia na liście eventów: „Dziś", „Jutro", dalej data.
 * Liczony względem `now`, więc lista nie zastyga na dacie builda.
 */
export function dayBucket(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, now)) return 'Dziś';
  if (isSameDay(date, addDays(now, 1))) return 'Jutro';
  return formatShortDate(date);
}
