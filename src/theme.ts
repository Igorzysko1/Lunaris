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
  textSecondary: '#8A8A9A',
  textMuted: '#4A4A5A',

  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.15)',
  grid: 'rgba(255,255,255,0.06)',
  skeleton: 'rgba(255,255,255,0.06)',
} as const;

export const fonts = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

/** Hairline borders in the design are 0.5px; RN needs a number. */
export const HAIRLINE = 0.5;

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
