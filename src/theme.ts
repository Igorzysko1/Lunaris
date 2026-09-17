/**
 * Paleta. Ciemna nie dla efektu, tylko dlatego, że ekran ogląda się w nocy
 * obok teleskopu — jasne tło kasuje adaptację wzroku na kilkanaście minut.
 *
 * Każdy kolor tekstu ma kontrast **co najmniej 4.5:1** względem najjaśniejszego
 * z teł (`surfaceRaised`), czyli próg WCAG AA dla zwykłego tekstu. Nie jest to
 * ozdobnik: pisma jest tu dużo w rozmiarach 11–12 px, a czyta się je nocą,
 * w mrozie i często przez zaparowane okulary. Progi pilnuje test — patrz
 * tests/theme.test.ts — bo kolor dobrany „na oko" na monitorze w dzień zawsze
 * wychodzi za ciemny na telefonie w polu.
 */
export type PaletteMode = 'dark' | 'red';

export type Palette = {
  purple: string;
  teal: string;
  green: string;
  amber: string;
  coral: string;

  bg: string;
  surface: string;
  surfaceRaised: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  border: string;
  borderStrong: string;
  /** Obrys przerywany: zapowiedź, propozycja, rzecz do dopisania. */
  borderDashed: string;
  /**
   * Włączony przełącznik i jego gałka. Osobne kolory, bo to jedyny element,
   * w którym dwie jasne powierzchnie leżą na sobie: w ciemnej palecie dzieli
   * je barwa (biała gałka na fiolecie), a w czerwonej barwy nie ma — więc
   * dzielić je musi jasność, inaczej przełącznik jest jedną plamą.
   */
  switchFill: string;
  switchKnob: string;
  /** Tło toru, słupka i innych rzeczy, na których coś się odkłada. */
  fill: string;
  /** To samo, ale ledwo widoczne: wyróżnienie komórki, tło obojętnego znacznika. */
  fillSoft: string;
  grid: string;
  skeleton: string;
};

const darkPalette: Palette = {
  purple: '#7F77DD',
  teal: '#1D9E75',
  green: '#639922',
  amber: '#EF9F27',
  coral: '#D85A30',

  bg: '#0A0A14',
  surface: '#0F0F1E',
  surfaceRaised: '#12121F',

  textPrimary: '#F0EFE8',
  /** Podpisy i wartości drugiego planu. */
  textSecondary: '#A6A6B9',
  /**
   * Najcichszy stopień hierarchii — i zarazem podłoga czytelności, nie zejście
   * poniżej niej. Poprzednia wartość (#4A4A5A) dawała 2.2:1, czyli mniej niż
   * próg nawet dla dużego tekstu: godziny i jednostki pod wykresami były
   * ozdobą, a nie informacją.
   */
  textMuted: '#7E7E99',

  border: 'rgba(255,255,255,0.08)',
  /**
   * Obrys elementu sterującego, nie ozdoba — wyłączony przełącznik poznaje się
   * po nim, więc obowiązuje go próg 3:1 dla elementów nietekstowych.
   */
  borderStrong: 'rgba(255,255,255,0.35)',
  borderDashed: 'rgba(255,255,255,0.16)',
  switchFill: '#7F77DD',
  switchKnob: '#FFFFFF',
  fill: 'rgba(255,255,255,0.10)',
  fillSoft: 'rgba(255,255,255,0.03)',
  grid: 'rgba(255,255,255,0.06)',
  skeleton: 'rgba(255,255,255,0.06)',
};

/**
 * Paleta trybu czerwonego z projektu „Lunaris tryb czerwony": trzy poziomy
 * jasności jednej barwy na tle #0A0303 (7,9:1 · 6,0:1 · 4,6:1).
 *
 * Kolory znaczeniowe zlewają się tu w jeden — i tak ma być. Czerwone światło
 * o tej jasności wzrok rozróżnia po jasności, nie po barwie, więc „zielony"
 * i „bursztynowy" byłyby tą samą plamą udającą dwie różne. Stan niesie zamiast
 * nich wypełnienie, obrys i znak przed treścią (✓ ! ×) — patrz `toneMark`
 * w src/ui/kit.tsx.
 */
const redPalette: Palette = {
  purple: '#FF7A5E',
  teal: '#FF7A5E',
  green: '#FF7A5E',
  amber: '#FF7A5E',
  coral: '#FF7A5E',

  bg: '#0A0303',
  surface: '#160606',
  surfaceRaised: '#1C0808',

  textPrimary: '#FF7A5E',
  textSecondary: '#E8604A',
  textMuted: '#CE5540',

  border: 'rgba(255,122,94,0.16)',
  // Mocniej niż w ciemnej (0,35): pod czerwonym tłem ta sama przezroczystość
  // dawała 2,4:1, czyli obrys wyłączonego przełącznika znikał.
  borderStrong: 'rgba(255,122,94,0.6)',
  borderDashed: 'rgba(255,122,94,0.3)',
  // Wypełnienie schodzi do przygaszonego, żeby jasna gałka miała się od czego
  // odciąć — inaczej włączony przełącznik świeci cały i nie widać jego stanu.
  switchFill: 'rgba(255,122,94,0.3)',
  switchKnob: '#FF7A5E',
  fill: 'rgba(255,122,94,0.14)',
  fillSoft: 'rgba(255,122,94,0.06)',
  grid: 'rgba(255,122,94,0.12)',
  skeleton: 'rgba(255,122,94,0.12)',
};

export const PALETTES: Record<PaletteMode, Palette> = { dark: darkPalette, red: redPalette };

let activeMode: PaletteMode = 'dark';
let active: Palette = darkPalette;

export function paletteMode(): PaletteMode {
  return activeMode;
}

/**
 * Przełącza paletę dla całej aplikacji.
 *
 * Kolor odczytany wcześniej już się nie zmieni — arkusze stylów powstają raz,
 * przy wczytaniu modułu. Dlatego przebudową stylów zajmuje się `themedStyles`
 * z src/ui/theme.tsx, a tu zostaje sam wybór palety.
 */
export function setPaletteMode(mode: PaletteMode): void {
  activeMode = mode;
  active = PALETTES[mode];
}

/**
 * Bieżąca paleta widziana jako zwykły obiekt kolorów.
 *
 * Podstawienie zamiast stałej, bo `colors.textPrimary` czyta kilkadziesiąt
 * miejsc — w stylach, w atrybutach ikon, w module rachunku (`astro.ts`).
 * Gdyby to była stała, tryb czerwony wymagałby przepisania każdego z nich
 * na hook; tak wystarczy, że odczyt trafia do palety wybranej w tej chwili.
 */
export const colors: Palette = new Proxy(darkPalette, {
  get: (_target, key) => active[key as keyof Palette],
});

export const fonts = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

/** Hairline borders in the design are 0.5px; RN needs a number. */
export const HAIRLINE = 0.5;

/**
 * Najmniejszy sensowny obszar dotyku w punktach — zgodnie z wytycznymi obu
 * platform.
 *
 * Tutaj to nie formalność do odhaczenia. Ekran dziennika obsługuje się
 * w rękawicach, o trzeciej w nocy, przy zgaszonym świetle — przycisk 30 pt
 * trafia się wtedy za trzecim razem albo wcale.
 */
export const MIN_TOUCH = 44;

/**
 * Zapas dotyku dopełniający element do `MIN_TOUCH`.
 *
 * Powiększamy obszar reakcji, a nie sam element: układ zaprojektowany na małe,
 * ciasno stojące ikony ma zostać taki, jaki jest. Przy elementach stojących
 * obok siebie trzeba pamiętać, że zapasy sąsiadów nie mogą na siebie nachodzić
 * — wtedy zapas zawęża się ręcznie do połowy odstępu.
 */
export function touchSlop(width: number, height: number = width) {
  const horizontal = Math.max(0, (MIN_TOUCH - width) / 2);
  const vertical = Math.max(0, (MIN_TOUCH - height) / 2);

  return { left: horizontal, right: horizontal, top: vertical, bottom: vertical };
}

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 20,
} as const;

/** Adds an alpha channel to a hex colour, as `hexA` did in the prototype. */
export function hexA(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
