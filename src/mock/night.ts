import type { Tone } from '@/ui/kit';

/**
 * Dane Planu przepisane z projektu „Lunaris Noc — werdykt" (tury 5, 9, 13) dla
 * nocy 14/15 września w Zawoi. Znikają w etapie 5, gdy Plan dostanie
 * `planNights`, rezerwację i odhaczenia z panelu celu.
 */

export const PLAN: {
  summary: string;
  blocks: { label: string; minutes: number; tone: Tone }[];
  axis: { at: number; label: string }[];
  steps: { time: string; text: string; session?: boolean }[];
  outcomes: { label: string; value: string; tone?: Tone }[];
  warnings: { mark: string; tone: Tone; text: string }[];
  bookingNote: string;
} = {
  summary: 'wyjazd 21:05 · powrót 03:25',
  blocks: [
    { label: 'dojazd', minutes: 65, tone: 'neutral' },
    { label: 'sesja', minutes: 270, tone: 'go' },
    { label: 'powrót', minutes: 45, tone: 'neutral' },
    { label: 'sen', minutes: 275, tone: 'accent' },
  ],
  axis: [
    { at: 0, label: '21:05' },
    { at: 0.511, label: '02:40' },
    { at: 1, label: '08:00' },
  ],
  steps: [
    { time: '21:05', text: 'wyjazd z domu · 47 min drogi' },
    { time: '21:52', text: 'parking · 12 min dojścia' },
    { time: '22:10', text: 'start sesji', session: true },
    { time: '02:40', text: 'koniec sesji · zwijanie', session: true },
    { time: '03:25', text: 'powrót do domu' },
    { time: '08:00', text: 'zakładany początek dnia' },
  ],
  outcomes: [
    { label: 'sen', value: '4,6 h' },
    { label: 'min. temp.', value: '4,1 °C' },
    { label: 'w odczuciu', value: '0,8 °C', tone: 'warn' },
  ],
  warnings: [
    {
      mark: '!',
      tone: 'warn',
      text: 'Rosa: temperatura 2.3°C od punktu rosy — weź ogrzewacz na obiektyw.',
    },
    {
      mark: '!',
      tone: 'warn',
      text: 'Sesja skrócona o 35 min, żeby zostało na sen. Pogoda pozwala dłużej.',
    },
    { mark: '·', tone: 'neutral', text: 'Dojście od parkingu zajmuje 12 min.' },
  ],
  bookingNote:
    'Wpis obejmie 21:05 → 03:25, czyli cały wyjazd — tyle realnie jesteś nieosiągalny. Samo okno schodzi do opisu.',
};

/**
 * Noc w trakcie (9b): Plan zamienia się w listę odhaczeń. Identyfikatory są
 * prawdziwe, więc dotknięcie otwiera prawdziwy panel celu; same odhaczenia
 * przyjdą z dziennika w etapie 5.
 */
export const LIVE: {
  checked: string;
  targets: { id: string; name: string; seenAt?: string; warning?: string }[];
  next: [string, string][];
} = {
  checked: '2 z 5 odhaczone w panelach celów',
  targets: [
    { id: 'm31', name: 'M31 Galaktyka Andromedy', seenAt: '23:04' },
    { id: 'm13', name: 'M13 Gromada Herkulesa', seenAt: '22:31' },
    { id: 'planet-Saturn', name: 'Saturn', warning: 'zachodzi za 2 h 01 min — teraz albo nigdy' },
    { id: 'm57', name: 'M57 Mgławica Pierścień' },
  ],
  next: [
    ['02:40', 'koniec sesji · zwijanie'],
    ['02:51', 'wschód Księżyca'],
    ['03:25', 'powrót · zostanie 4,6 h snu'],
  ],
};

/** 5: rezerwacja nocy, która nie przechodzi już progów — podpięcie w etapie 5. */
export const BOOKING_WARNING =
  'Ta noc nie przechodzi już progów, a jej rezerwacja wciąż jest w kalendarzu.';
