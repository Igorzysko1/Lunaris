import type { Tone } from '@/ui/kit';

/**
 * Dane Dziennika z projektu (tury 4 i 14): podsumowanie sezonu, wpisy
 * pogrupowane miesiącami, wpis z przebiegiem nocy i arkusz zamknięcia nocy.
 */

export const SUMMARY = { year: 2026, nights: 14, seen: 38, failed: 6 };

export const BETTER_TODAY = 'Dziś lepiej niż wtedy: M33 czeka na drugie podejście';

export type JournalEntrySummary = {
  id: string;
  date: string;
  ratings: string;
  place: string;
  chips: [string, Tone][];
  note: string;
};

export const JOURNAL_MONTHS: { label: string; entries: JournalEntrySummary[] }[] = [
  {
    label: 'Wrzesień',
    entries: [
      {
        id: '2026-09-14',
        date: '14/15 września',
        ratings: 'przej. 4 · see. 3',
        place: 'Zawoja',
        chips: [
          ['4 widziane', 'go'],
          ['1 nie wyszło', 'warn'],
        ],
        note: 'Hantle wyraźne już przy 15x. M33 rozmyta, straciłem ją w łunie od Suchej.',
      },
      {
        id: '2026-09-06',
        date: '6/7 września',
        ratings: 'przej. 5 · see. 4',
        place: 'Pustynia Błędowska',
        chips: [['6 widzianych', 'go']],
        note: 'Najlepsza noc sezonu. Podwójna Gromada mieści się w polu w całości.',
      },
    ],
  },
  {
    label: 'Sierpień',
    entries: [
      {
        id: '2026-08-29',
        date: '29/30 sierpnia',
        ratings: 'bez ocen',
        place: 'Góra Zborów / Podlesice',
        chips: [['zwinąłem — rosa', 'bad']],
        note: 'Obiektywy zaszły po czterdziestu minutach. Następnym razem opaski.',
      },
    ],
  },
];

export type JournalEntry = {
  date: string;
  subtitle: string;
  transparency: string;
  seeing: string;
  targets: { name: string; seen: boolean; why?: string }[];
  timeline: { label: string; actual: string | null; plan: string }[];
  timelineNote: string;
  note: string;
};

const ENTRY: JournalEntry = {
  date: '14/15 września',
  subtitle: 'Zawoja · Bortle 4 · Lornetka 15x70',
  transparency: '4 / 5',
  seeing: '3 / 5',
  targets: [
    { name: 'M31 Galaktyka Andromedy', seen: true },
    { name: 'M13 Gromada Herkulesa', seen: true },
    { name: 'M27 Mgławica Hantle', seen: true },
    { name: 'M57 Mgławica Pierścień', seen: true },
    {
      name: 'M33 Galaktyka Trójkąta',
      seen: false,
      why: 'nie wyszło przy Bortle 4, 58°, Księżyc 12%',
    },
  ],
  timeline: [
    { label: 'wyjazd', actual: '20:52', plan: 'plan 20:40' },
    { label: 'na miejscu', actual: '21:48', plan: 'plan 21:35' },
    { label: 'zwijanie', actual: '02:50', plan: 'plan 02:40' },
    { label: 'w domu', actual: null, plan: 'nie zmierzono' },
  ],
  timelineNote:
    'Zmierzone godziny stroją czas dojazdu i zwijania w planie następnych nocy — dlatego dopisana z pamięci godzina liczy się tak samo jak złapana w terenie.',
  note: 'Hantle wyraźne już przy 15x. M33 rozmyta, straciłem ją w łunie od Suchej. Następnym razem zacząć od niej, zanim wejdzie niżej.',
};

export function journalEntry(id: string | undefined): JournalEntry {
  const summary = JOURNAL_MONTHS.flatMap((month) => month.entries).find((e) => e.id === id);
  if (!summary || summary.id === '2026-09-14') return ENTRY;

  return {
    ...ENTRY,
    date: summary.date,
    subtitle: `${summary.place} · Lornetka 15x70`,
    note: summary.note,
  };
}

/** Arkusz zamknięcia nocy (4a): cele, miejsce i sprzęt wpisane już z planu. */
export const CLOSE_NIGHT: {
  subtitle: string;
  targets: {
    name: string;
    time: string;
    firstTime?: boolean;
    initial: 'none' | 'seen' | 'failed';
    reason?: string;
  }[];
  more: string;
  thresholdSuggestion: string;
} = {
  subtitle: 'noc 14/15 września · Zawoja · SCT 8″',
  targets: [
    { name: 'M31 Galaktyka Andromedy', time: '22:40', initial: 'none' },
    { name: 'M13 Gromada Herkulesa', time: '23:15', firstTime: true, initial: 'none' },
    { name: 'Saturn', time: '00:20', initial: 'none' },
    { name: 'Albireo', time: '01:10', initial: 'none' },
    { name: 'h+χ Persei', time: '01:45', initial: 'none' },
  ],
  more: 'dopisz, co doszło',
  thresholdSuggestion: 'Rosa wyprzedziła prognozę o godzinę. Podnieść próg zapasu do 3 K?',
};

/**
 * Powody nieudanego celu (4b): pięć wracających w progach i „inne" z polem.
 * Klawiatura otwiera się dopiero po „inne" — w rękawicach to dwa dotknięcia.
 */
export const FAILURE_REASONS = ['rosa', 'chmury', 'zmęczenie', 'sprzęt', 'zwinąłem', 'inne'];
