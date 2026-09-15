import type { Tone } from '@/ui/kit';

/**
 * Dane zakładki Noc przepisane z projektu „Lunaris Noc — werdykt" (tury 2–9, 13)
 * dla nocy 14/15 września w Zawoi. Zdania ostrzeżeń i nagłówki są cytatami
 * z `session-text.ts` i `night-plan.ts` — przy podpinaniu mają przyjść stamtąd.
 */

/** Oś profilu wysokości w panelu celu (etap 4): godziny 20:00–07:00, jedenaście slotów. */
export const HOUR_AXIS = [
  { slot: 0, label: '20' },
  { slot: 3, label: '23' },
  { slot: 6, label: '02' },
  { slot: 9, label: '05' },
];

export const OPTICS = [
  { id: 'sct', label: 'SCT 8″ · 203/2032', reach: 'SCT 8″' },
  { id: 'bino', label: 'Lornetka 15x70', reach: 'lornetki 15x70' },
];

export const NEXT_EVENT = 'Neptun w opozycji za 6 dni';

export type NightTarget = {
  id: string;
  name: string;
  meta: string;
  window: string;
  altitude: number;
  /** Zachodzi pierwszy albo wschodzi późno — bursztyn, bo wymaga decyzji. */
  urgent: boolean;
  firstTime: boolean;
};

/** Cele posortowane oknem widoczności, nie jasnością: pierwszy zachodzi najszybciej. */
export const TARGETS: NightTarget[] = [
  {
    id: 'saturn',
    name: 'Saturn',
    meta: 'planeta · opozycja za 3 tyg.',
    window: 'do 01:05',
    altitude: 31,
    urgent: true,
    firstTime: false,
  },
  {
    id: 'm13',
    name: 'M13 Gromada Herkulesa',
    meta: 'gromada kulista, 5.8 mag',
    window: 'do 00:40',
    altitude: 44,
    urgent: false,
    firstTime: true,
  },
  {
    id: 'm57',
    name: 'M57 Mgławica Pierścień',
    meta: 'mgławica, 8.8 mag',
    window: 'do 03:20',
    altitude: 71,
    urgent: false,
    firstTime: false,
  },
  {
    id: 'm31',
    name: 'M31 Galaktyka Andromedy',
    meta: 'galaktyka, 3.4 mag',
    window: 'całe okno',
    altitude: 41,
    urgent: false,
    firstTime: false,
  },
  {
    id: 'hchi',
    name: 'h+χ Persei Podwójna Gromada',
    meta: 'gromada otwarta, 4.3 mag',
    window: 'od 23:30',
    altitude: 22,
    urgent: true,
    firstTime: false,
  },
];

export const OUT_OF_REACH = 3;

/** Wysokość teraz; poniżej 20° pominięte, bo kształtu nie da się wtedy rozpoznać. */
export const SKY_CONSTELLATIONS = [
  { id: 'cyg', label: 'Cygnus', altitude: 78 },
  { id: 'lyr', label: 'Lyra', altitude: 71 },
  { id: 'cas', label: 'Cassiopeia', altitude: 54 },
  { id: 'and', label: 'Andromeda', altitude: 41 },
  { id: 'peg', label: 'Pegasus', altitude: 33 },
  { id: 'per', label: 'Perseus', altitude: 22 },
];

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

/** Noc w trakcie (9b): Plan zamienia się w listę odhaczeń. */
export const LIVE: {
  checked: string;
  targets: { id: string; name: string; seenAt?: string; warning?: string }[];
  next: [string, string][];
} = {
  checked: '2 z 5 odhaczone w panelach celów',
  targets: [
    { id: 'm31', name: 'M31 Galaktyka Andromedy', seenAt: '23:04' },
    { id: 'm13', name: 'M13 Gromada Herkulesa', seenAt: '22:31' },
    { id: 'saturn', name: 'Saturn', warning: 'zachodzi za 2 h 01 min — teraz albo nigdy' },
    { id: 'm57', name: 'M57 Mgławica Pierścień' },
  ],
  next: [
    ['02:40', 'koniec sesji · zwijanie'],
    ['02:51', 'wschód Księżyca'],
    ['03:25', 'powrót · zostanie 4,6 h snu'],
  ],
};

export type TargetDetail = {
  name: string;
  meta: string;
  seenAt: string | null;
  visibility: string;
  bar: {
    darkFrom: number;
    windowFrom: number;
    windowTo: number;
    moonRise: number;
    now: number;
    labels: { start: string; moon: string; end: string };
  };
  altitude: number[];
  highest: string;
  highestAt: string;
  azimuth: string;
  sightingsSummary: string;
  sightings: { date: string; place: string; note: string; rate: string }[];
};

const M31: TargetDetail = {
  name: 'M31 Galaktyka Andromedy',
  meta: 'galaktyka, 3.4 mag · 3° × 1° · And',
  seenAt: '23:04',
  visibility: '4 h 30 min',
  bar: {
    darkFrom: 0.1,
    windowFrom: 0.22,
    windowTo: 0.63,
    moonRise: 0.66,
    now: 0.3,
    labels: { start: '21:40', moon: '02:51 ☾', end: '05:10' },
  },
  altitude: [14, 22, 29, 35, 40, 41, 39, 34, 27, 19, 11],
  highest: '41°',
  highestAt: '01:00',
  azimuth: '112° E',
  sightingsSummary: '3 razy · od 11 lipca',
  sightings: [
    {
      date: '18 sierpnia 2026',
      place: 'Zawoja · SCT 8″',
      note: 'najlepiej dotąd, widoczne M110',
      rate: '5/5',
    },
    {
      date: '2 sierpnia 2026',
      place: 'Zawoja · SCT 8″',
      note: 'mgliście, wysoka wilgotność',
      rate: '3/5',
    },
    {
      date: '11 lipca 2026',
      place: 'Babia Góra · lornetka 10×50',
      note: 'pierwszy raz',
      rate: '4/5',
    },
  ],
};

/** Panel celu (6a): pełny dla M31, pozostałe cele składane z listy Nieba. */
export type TargetPanel = TargetDetail & {
  firstTime: boolean;
  /** Krótkie pokrycie z oknem — zdanie, co z tym zrobić (6b). */
  overlapWarning: string | null;
  /** Zestaw, dla którego liczony jest zasięg — widoczny poza sesją. */
  optics: { label: string; detail: string } | null;
};

const SCT = { label: 'SCT 8″ · 203/2032', detail: 'pow. 81× okularem 25 mm · pole 36′' };

/** 6b: cel nigdy nie widziany, poza sesją, z oknem przyciętym zachodem celu o 00:40. */
const M13: TargetPanel = {
  ...M31,
  name: 'M13 Gromada Herkulesa',
  meta: 'gromada kulista, 5.8 mag · 20′ · Her',
  seenAt: null,
  visibility: '2 h 30 min',
  bar: { ...M31.bar, darkFrom: 0.157, windowFrom: 0.255, windowTo: 0.478, moonRise: 0.672 },
  altitude: [],
  firstTime: true,
  overlapWarning: 'Pokrywa się z oknem tylko na 2 h 30 min — złap zaraz po zmierzchu.',
  optics: SCT,
  sightingsSummary: '',
  sightings: [],
};

/** Panel celu: M31 w trakcie sesji (6a), M13 poza nią (6b), reszta składana z listy Nieba. */
export function targetDetail(id: string | undefined): TargetPanel {
  if (id === 'm13') return M13;

  const target = TARGETS.find((t) => t.id === id);
  if (!target || target.id === 'm31') {
    return { ...M31, firstTime: false, overlapWarning: null, optics: SCT };
  }

  return {
    ...M31,
    name: target.name,
    meta: target.meta,
    seenAt: null,
    highest: `${target.altitude}°`,
    firstTime: target.firstTime,
    overlapWarning: null,
    optics: SCT,
    sightingsSummary: '',
    sightings: [],
  };
}

/** 5: rezerwacja nocy, która nie przechodzi już progów — podpięcie w etapie 5. */
export const BOOKING_WARNING =
  'Ta noc nie przechodzi już progów, a jej rezerwacja wciąż jest w kalendarzu.';
