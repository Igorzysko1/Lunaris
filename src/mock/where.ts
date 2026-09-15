import type { Tone } from '@/ui/kit';

/**
 * Dane zakładki Gdzie przepisane z projektu (tury 11 i 13). Liczby pochodzą
 * z `site-review.ts` i `observing-sites.ts` dla nocy 14/15 września, dojazd
 * z Jaworzna przy 50 km/h — tak jak w `app/sites.tsx`.
 */

export type RankedSite = {
  id: string;
  name: string;
  bortle: number;
  score: string;
  explain: string;
  verdict: string;
  window: string;
  travel: string;
  walk: string;
  walkWarn: boolean;
  unique?: string;
};

export const GO_SITES: RankedSite[] = [
  {
    id: 'bledowska',
    name: 'Pustynia Błędowska',
    bortle: 4,
    score: '66',
    explain: 'niebo 72/100, minus 6 za 30 min drogi',
    verdict: 'JEDŹ · 4/5',
    window: '22:10 – 02:40',
    travel: '25 km · 30 min',
    walk: '15 min od parkingu',
    walkWarn: false,
  },
  {
    id: 'hala-lipowska',
    name: 'Hala Lipowska / Korbielów',
    bortle: 3,
    score: '64',
    explain: 'niebo 81/100, minus 17 za 84 min drogi',
    verdict: 'JEDŹ · 5/5',
    window: '22:05 – 02:45',
    travel: '70 km · 84 min',
    walk: '60 min od parkingu — powyżej tolerancji 30 min',
    walkWarn: true,
    unique: 'Tylko stąd: M33, NGC 7000',
  },
  {
    id: 'gora-zborow',
    name: 'Góra Zborów / Podlesice',
    bortle: 4,
    score: '63',
    explain: 'niebo 74/100, minus 11 za 53 min drogi',
    verdict: 'JEDŹ · 4/5',
    window: '22:08 – 02:42',
    travel: '44 km · 53 min',
    walk: '10 min od parkingu',
    walkWarn: false,
  },
];

export const DOMINATED = [
  {
    id: 'zloty-potok',
    name: 'Złoty Potok / Janów',
    explain: 'niebo 70/100, minus 14 za 68 min drogi',
    why: 'Bliżej i lepiej: Góra Zborów. Nic, czego nie widać stamtąd.',
  },
];

export const REJECTED = [
  {
    id: 'salmopolska',
    name: 'Przełęcz Salmopolska',
    reason: 'Chmury 80% przez całe okno. Nie ma czego ratować dojazdem.',
  },
];

/** Ranking częściowy (13c): policzone tylko miejsca z pobraną prognozą. */
export const PARTIAL_SITES = [
  {
    id: 'bledowska',
    name: 'Pustynia Błędowska',
    score: '66',
    explain: 'niebo 72/100, minus 6 za 30 min drogi',
  },
  {
    id: 'gora-zborow',
    name: 'Góra Zborów / Podlesice',
    score: '63',
    explain: 'niebo 74/100, minus 11 za 53 min drogi',
  },
];

export const MISSING = [
  { id: 'hala-lipowska', name: 'Hala Lipowska / Korbielów', distance: '70 km' },
  { id: 'salmopolska', name: 'Przełęcz Salmopolska', distance: '56 km' },
];

export const CATALOG = [
  {
    id: 'bledowska',
    name: 'Pustynia Błędowska',
    bortle: 4,
    travel: '25 km · ok. 30 min jazdy',
    walk: '15 min od parkingu',
    walkWarn: false,
  },
  {
    id: 'gora-zborow',
    name: 'Góra Zborów / Podlesice',
    bortle: 4,
    travel: '44 km · ok. 53 min jazdy',
    walk: '10 min od parkingu',
    walkWarn: false,
  },
  {
    id: 'zloty-potok',
    name: 'Złoty Potok / Janów',
    bortle: 4,
    travel: '57 km · ok. 68 min jazdy',
    walk: '5 min od parkingu',
    walkWarn: false,
  },
  {
    id: 'salmopolska',
    name: 'Przełęcz Salmopolska',
    bortle: 4,
    travel: '56 km · ok. 67 min jazdy',
    walk: '5 min od parkingu',
    walkWarn: false,
  },
  {
    id: 'hala-lipowska',
    name: 'Hala Lipowska / Korbielów',
    bortle: 3,
    travel: '70 km · ok. 84 min jazdy',
    walk: '60 min od parkingu — powyżej tolerancji 30 min',
    walkWarn: true,
  },
];

/** Gest „jestem tutaj" (11c): fix GPS i miejsca, którym można poprawić współrzędne. */
export const GPS_FIX = {
  coords: '49,57118, 19,35042',
  accuracy: 'dokładność ±38 m — słaby fix, warto powtórzyć',
  nearby: [
    { id: 'hala-lipowska', name: 'Hala Lipowska / Korbielów', distance: '420 m stąd' },
    { id: 'salmopolska', name: 'Przełęcz Salmopolska', distance: '39 km stąd' },
  ],
};

export type SiteDetail = {
  name: string;
  region: string;
  verdict: string;
  verdictTone: Tone;
  window: string;
  summary: string;
  explain: string;
  sky: string;
  travel: string;
  travelNote: string;
  walk: { text: string; note?: string; warn: boolean } | null;
  unique: string | null;
  horizonNote: string;
  obstacles: string[];
  notes: string;
};

const HALA_LIPOWSKA: SiteDetail = {
  name: 'Hala Lipowska / Korbielów',
  region: 'śląskie · 49,570 N 19,350 E',
  verdict: 'JEDŹ · 5/5',
  verdictTone: 'go',
  window: '22:05 – 02:45',
  summary: 'Najciemniejsze niebo w katalogu, ale najdroższe drogą:',
  explain: 'niebo 81/100, minus 17 za 84 min drogi',
  sky: 'Bortle 3 · 21,45 mag/arcsec² policzone dla tego punktu',
  travel: '70 km z Jaworzna · ok. 84 min jazdy',
  travelNote:
    'Czas liczony z odległości i średniej prędkości z profilu (50 km/h), nie zapisany przy miejscu.',
  walk: {
    text: '60 min od parkingu — powyżej tolerancji 30 min',
    note: 'Podejście z Korbielowa — powyżej tolerancji marszu, planować z zapasem.',
    warn: true,
  },
  unique: 'M33 Galaktyka Trójkąta · NGC 7000 Ameryka Północna',
  horizonNote: 'Brak maski terenu — obowiązuje próg 15°.',
  obstacles: ['S–SW (180°–225°): przeszkoda do 12°'],
  notes: 'Podejście z Korbielowa — powyżej tolerancji marszu, planować z zapasem.',
};

/** Szczegół miejscówki: pełny tylko dla Hali Lipowskiej, pozostałe składane z list. */
export function siteDetail(id: string | undefined): SiteDetail {
  if (id === 'hala-lipowska') return HALA_LIPOWSKA;

  const ranked = GO_SITES.find((site) => site.id === id);
  const listed = CATALOG.find((site) => site.id === id);

  return {
    ...HALA_LIPOWSKA,
    name: ranked?.name ?? listed?.name ?? 'Miejscówka',
    region: 'współrzędne z katalogu',
    verdict: ranked?.verdict ?? 'bez werdyktu tej nocy',
    verdictTone: ranked ? 'go' : 'neutral',
    window: ranked?.window ?? '—',
    summary: ranked ? 'Kolejność w rankingu:' : 'Miejsce spoza rankingu tej nocy:',
    explain: ranked?.explain ?? 'odpada albo zdominowane',
    sky: `Bortle ${ranked?.bortle ?? listed?.bortle ?? '?'} · jasność tła z mapy`,
    travel: listed?.travel ?? ranked?.travel ?? '—',
    walk: listed ? { text: listed.walk, warn: listed.walkWarn } : null,
    unique: ranked?.unique ? ranked.unique.replace('Tylko stąd: ', '') : null,
    obstacles: [],
    notes: 'Brak notatek z wyjazdów.',
  };
}
