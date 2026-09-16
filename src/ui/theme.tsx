/**
 * Motyw: wybór palety dla całej aplikacji i style, które za nim nadążają.
 *
 * Problem, który ten plik rozwiązuje: `StyleSheet.create` wykonuje się raz, przy
 * wczytaniu modułu, więc kolor wpisany do arkusza zostaje w nim na zawsze.
 * Trzydzieści kilka ekranów miało arkusz zbudowany z ciemnej palety, a tryb
 * czerwony ma je wszystkie przemalować. Zamiast przepisywać każdy ekran na hook,
 * arkusz powstaje leniwie — przy pierwszym odczycie dla bieżącej palety —
 * i przebudowuje się, gdy paleta się zmieni. Dla pliku ekranu zmiana to jedna
 * linijka: `StyleSheet.create({` → `themedStyles(() => ({`.
 *
 * Drzewo ekranów jest przy przełączeniu montowane od nowa (klucz na trybie
 * w app/_layout.tsx), bo sam arkusz nie wystarczy: kolory czytane wprost
 * w JSX-ie (`color={colors.textMuted}` przy ikonach) zmieniają się dopiero
 * przy kolejnym renderze.
 */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { useNow } from '@/hooks/use-now';
import { currentNightWindow } from '@/lib/night-window';
import { applyBrightness } from '@/lib/screen-brightness';
import { useSettings } from '@/store/settings';
import { paletteMode, setPaletteMode, type PaletteMode } from '@/theme';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Arkusz stylów zbudowany dla bieżącej palety. Używa się go dokładnie tak, jak
 * wyniku `StyleSheet.create` — różnica jest tylko taka, że po zmianie motywu
 * te same `styles.coś` oddają kolory nowej palety.
 */
export function themedStyles<T extends NamedStyles<T>>(build: () => T): T {
  let made: { mode: PaletteMode; sheet: T } | null = null;

  return new Proxy({} as T, {
    get(_target, key) {
      const mode = paletteMode();
      if (!made || made.mode !== mode) made = { mode, sheet: StyleSheet.create(build()) };
      return made.sheet[key as keyof T];
    },
  });
}

type Theme = {
  mode: PaletteMode;
  /** Skrót na najczęstsze pytanie: czy jesteśmy w trybie czerwonym. */
  red: boolean;
  /** Czy tryb czerwony włącza się sam po zmierzchu. */
  auto: boolean;
  /** Jasność ekranu w trybie czerwonym, w procentach. */
  brightness: number;
  setMode: (mode: PaletteMode) => void;
  toggleAuto: () => void;
  setBrightness: (percent: number) => void;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, active, setThemeMode, toggleAutoTheme, setBrightness } = useSettings();
  const now = useNow();
  const { lat, lon } = active.coords;
  const day = now.toDateString();

  // Okno nocy liczy się raz na dobę i na miejsce, nie co tyknięcie zegara.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const night = useMemo(() => currentNightWindow(now, { lat, lon }), [day, lat, lon]);

  // Automat idzie za zmierzchem i świtem; wybór ręczny go wyłącza, więc tutaj
  // wystarczy sprawdzić, który z dwóch źródeł trybu obowiązuje.
  const afterDusk = now >= night.from && now <= night.to;
  const mode: PaletteMode = theme.auto ? (afterDusk ? 'red' : 'dark') : theme.mode;

  // Paleta musi być ustawiona, zanim cokolwiek pod spodem zbuduje swój arkusz —
  // czyli w renderze rodzica, nie w efekcie po nim. Wybór palety jest przy tym
  // podstawieniem jednej wartości, a nie stanem: powtórzony render niczego nie
  // psuje, a arkusze i tak pytają o tryb przy każdym odczycie.
  if (paletteMode() !== mode) setPaletteMode(mode);

  useEffect(() => {
    void applyBrightness(mode === 'red' ? theme.brightness : null);
  }, [mode, theme.brightness]);

  const value = useMemo<Theme>(
    () => ({
      mode,
      red: mode === 'red',
      auto: theme.auto,
      brightness: theme.brightness,
      setMode: setThemeMode,
      toggleAuto: toggleAutoTheme,
      setBrightness,
    }),
    [mode, theme.auto, theme.brightness, setThemeMode, toggleAutoTheme, setBrightness],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
