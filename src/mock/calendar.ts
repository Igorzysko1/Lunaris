import type { Tone } from '@/ui/kit';

/**
 * Dane Kalendarza z projektu: miesiąc z propozycją i rezerwacją (tura 10),
 * zjawiska w horyzoncie 60 dni i powiadomienia (tura 15).
 */

export const MONTH_LABEL = 'wrzesień 2026';
export const WEEKDAYS = ['pon', 'wto', 'śro', 'czw', 'pią', 'sob', 'nie'];
export const TODAY = 14;

export type DayMark = 'observation' | 'proposal' | 'other' | null;

/**
 * Siatka 6×7. 1 września 2026 to wtorek, więc pierwsza komórka to poniedziałek
 * 31 sierpnia i numer komórki jest zarazem numerem dnia — jak w `calendar-view.ts`.
 */
export const MONTH_CELLS: { day: number | null; mark: DayMark }[] = Array.from(
  { length: 42 },
  (_, i) => {
    if (i < 1 || i > 30) return { day: null, mark: null };

    const mark: DayMark = [15, 18, 27].includes(i)
      ? 'proposal'
      : [8, 23].includes(i)
        ? 'observation'
        : [3, 11, 21].includes(i)
          ? 'other'
          : null;

    return { day: i, mark };
  },
);

export const SELECTED_DAY = {
  day: 15,
  label: 'Wtorek, 15 września',
  proposal: {
    title: 'Obserwacja — Zawoja',
    time: '21:05 → 03:25',
    note: 'Propozycja z werdyktu „jedź" — w kalendarzu jej jeszcze nie ma.',
  },
  observation: {
    title: 'Obserwacja — Babia Góra',
    start: '20:40',
    startDate: '15.09',
    end: '02:10',
    endDate: '16.09',
    note: 'Termos i drugi akumulator do montażu.',
  },
  others: [
    { time: 'cały dzień', title: 'Imieniny mamy' },
    { time: '09:00', title: 'Stand-up zespołu' },
  ],
};

export type SkyEvent = {
  id: string;
  title: string;
  when: string;
  description: string;
  chips: [string, Tone][];
  /** Zjawisko, o którym aplikacja się nie odezwie — wyszarzone na liście. */
  quiet?: boolean;
};

export const EVENTS_IN_FORECAST: SkyEvent[] = [
  {
    id: 'neptun-opozycja',
    title: 'Neptun w opozycji',
    when: '20.09 · 01:20',
    chips: [
      ['noc się nadaje · 4/5', 'go'],
      ['okno 21:55 – 02:30', 'neutral'],
    ],
    description:
      'Najbliżej Ziemi w tym roku, 7,8 mag — w zasięgu lornetki jako zielonkawy punkt, kształt tarczy dopiero w SCT.',
  },
  {
    id: 'ksiezyc-antares',
    title: 'Koniunkcja Księżyca z Antaresem',
    when: '17.09 · 20:35',
    chips: [['noc odrzucona · chmury 85%', 'bad']],
    description: 'Zjawisko widoczne stąd, ale tej nocy nie ma po co jechać. Nie odezwie się.',
  },
];

export const EVENTS_BEYOND: SkyEvent[] = [
  {
    id: 'orionidy',
    title: 'Orionidy',
    when: '21.10 · 04:57',
    chips: [['zapowiedź · za 37 dni', 'accent']],
    description:
      'Maksimum roju, ZHR do 20. Radiant w gwiazdozbiorze Oriona wznosi się na 62° nad horyzont, a ciemny Księżyc nie będzie przeszkadzał.',
  },
  {
    id: 'now',
    title: 'Nów Księżyca',
    when: '10.10 · 04:51',
    chips: [],
    description:
      'Księżyc nieoświetlony (0%) — najciemniejsze niebo w miesiącu, najlepszy moment na obiekty mgławicowe i Drogę Mleczną.',
  },
  {
    id: 'pelnia',
    title: 'Pełnia Księżyca',
    when: '26.09 · 17:49',
    chips: [],
    quiet: true,
    description:
      'Tarcza oświetlona w 100% — Księżyc rozświetla niebo przez większość nocy, słaba widoczność obiektów mgławicowych.',
  },
];

export type EventDetail = {
  title: string;
  subtitle: string;
  status: { label: string; text: string; tone: Tone };
  meaning: string;
  facts: string[];
  notify: { text: string; note: string };
  showLabel: string;
};

const DETAILS: Record<string, EventDetail> = {
  orionidy: {
    title: 'Orionidy',
    subtitle: 'środa 21 października, 04:57 · maksimum roju',
    status: {
      label: 'Zapowiedź, nie obietnica',
      text: 'Za 37 dni — poza zasięgiem prognozy, więc nie wiem, czy noc się nada. Wiem tylko, że zjawisko wypadnie i że stąd je widać.',
      tone: 'accent',
    },
    meaning:
      'Maksimum roju, ZHR do 20. Radiant w gwiazdozbiorze Oriona wznosi się na 62° nad horyzont, a ciemny Księżyc nie będzie przeszkadzał.',
    facts: ['radiant 62° o 04:57', 'Księżyc 5%', 'ZHR 20'],
    notify: {
      text: 'Odezwie się 14 października o 18:00 — tydzień wcześniej, o porze, o której zapadają decyzje o wyjeździe.',
      note: 'Drugi raz odezwie się dopiero wtedy, gdy noc wejdzie w prognozę i przejdzie przez progi. Bez tego byłoby codzienne przypomnienie o czymś za pięć tygodni.',
    },
    showLabel: 'Pokaż Oriona',
  },
  'neptun-opozycja': {
    title: 'Neptun w opozycji',
    subtitle: 'niedziela 20 września, 01:20',
    status: {
      label: 'W zasięgu prognozy',
      text: 'Noc się nadaje · 4/5, okno 21:55 – 02:30.',
      tone: 'go',
    },
    meaning:
      'Najbliżej Ziemi w tym roku, 7,8 mag — w zasięgu lornetki jako zielonkawy punkt, kształt tarczy dopiero w SCT.',
    facts: ['7,8 mag', 'opozycja 01:20'],
    notify: {
      text: 'Odezwie się 19 września o 13:20 — 12 h przed zjawiskiem.',
      note: 'Wczoraj ta noc była odrzucona. Zmiana prognozy jest jedyną rzeczą, która wraca w powiadomieniu drugi raz.',
    },
    showLabel: 'Pokaż Neptuna',
  },
};

export function eventDetail(id: string | undefined): EventDetail {
  const known = id ? DETAILS[id] : undefined;
  if (known) return known;

  const event = [...EVENTS_IN_FORECAST, ...EVENTS_BEYOND].find((e) => e.id === id);

  return {
    title: event?.title ?? 'Zjawisko',
    subtitle: event?.when ?? '',
    status: {
      label: event?.quiet ? 'Nie odezwie się' : 'Zjawisko',
      text: event?.quiet
        ? 'Wraca co miesiąc — zapowiadamy tylko zaćmienia i maksima rojów.'
        : 'Poza zasięgiem prognozy.',
      tone: event?.quiet ? 'neutral' : 'accent',
    },
    meaning: event?.description ?? '',
    facts: [],
    notify: { text: 'Bez powiadomienia.', note: '' },
    showLabel: 'Pokaż na niebie',
  };
}

export const NOTIFICATIONS = {
  leadTime: '12 h',
  reviewTime: '18:00',
  categories: [
    { id: 'eclipses', label: 'Zaćmienia', on: true },
    { id: 'meteors', label: 'Roje meteorów', on: true },
    { id: 'conjunctions', label: 'Koniunkcje i opozycje', on: true },
    { id: 'moon', label: 'Fazy Księżyca', on: false },
  ],
  scheduled: [
    {
      title: 'Neptun w opozycji',
      badge: ['wróciło', 'go'] as [string, Tone],
      when: '19 września, 13:20 · 12 h przed',
      quote: '„jutro, 01:20 — noc się nadaje, okno 21:55–02:30."',
      note: 'Wczoraj ta noc była odrzucona. Zmiana prognozy jest jedyną rzeczą, która wraca w powiadomieniu drugi raz.',
    },
    {
      title: 'Orionidy',
      badge: ['zapowiedź', 'accent'] as [string, Tone],
      when: '14 października, 18:00 · 7 dni przed',
      quote: '„21.10, 04:57 — zapowiedź, bez prognozy na tę noc (37 dni)."',
      note: '',
    },
  ],
  silent: [
    { title: 'Koniunkcja Księżyca z Antaresem', date: '17.09', why: 'Noc odrzucona — chmury 85%.' },
    {
      title: 'Pełnia Księżyca',
      date: '26.09',
      why: 'Wraca co miesiąc — zapowiadamy tylko zaćmienia i maksima rojów.',
    },
  ],
};
