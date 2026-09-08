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
export const colors = {
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
  grid: 'rgba(255,255,255,0.06)',
  skeleton: 'rgba(255,255,255,0.06)',
} as const;

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
