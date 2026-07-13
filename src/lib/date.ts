const WEEKDAYS = [
  'Niedziela', 'Poniedziałek', 'Wtorek', 'Środa',
  'Czwartek', 'Piątek', 'Sobota',
];

const MONTHS_GENITIVE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

/** np. „Niedziela, 12 lipca". Ręcznie, bo Intl bywa okrojony w Hermesie. */
export function formatToday(date: Date = new Date()): string {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}
