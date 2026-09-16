/**
 * Czytelność palet.
 *
 * Kontrast to jedyna rzecz w wyglądzie aplikacji, którą da się rozstrzygnąć
 * liczbą zamiast opinią — i akurat ona psuje się najciszej. Kolor dobrany na
 * monitorze w dzień wygląda dobrze; ten sam kolor na telefonie w polu, przy
 * 11 px i zaparowanych okularach, po prostu znika. Dlatego progi WCAG stoją
 * w teście, a nie w komentarzu.
 *
 * Obie palety przechodzą ten sam zestaw progów. Czerwona jest tu przypadkiem
 * trudniejszym: trzy poziomy jednej barwy stoją blisko siebie z założenia, więc
 * najłatwiej w niej o stopień, który wygląda na osobny, a mierzy się jak tło.
 *
 * Sprawdzamy względem `surfaceRaised`, bo to najjaśniejsze z teł, czyli
 * przypadek najgorszy dla jasnego tekstu na ciemnym tle.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PALETTES, type Palette, type PaletteMode } from '../src/theme.ts';

/** Próg AA dla zwykłego tekstu. Pisma poniżej 18 px jest tu zdecydowana większość. */
const AA_TEXT = 4.5;
/** Próg AA dla elementów nietekstowych: obrysów, ikon, wskaźników stanu. */
const AA_NON_TEXT = 3;

type Rgb = [number, number, number];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function parseHex(hex: string): Rgb {
  const n = hex.replace('#', '');
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

/**
 * Kolor półprzezroczysty sam z siebie nie ma kontrastu — ma go dopiero to, co
 * z niego wychodzi na konkretnym tle. Dlatego obrysy najpierw spłaszczamy.
 */
function flatten(rgba: string, background: Rgb): Rgb {
  const [r, g, b, alpha] = rgba.match(/[\d.]+/g)!.map(Number);
  return [r, g, b].map((c, i) => alpha * c + (1 - alpha) * background[i]) as Rgb;
}

function contrast(foreground: Rgb, background: Rgb): number {
  const [hi, lo] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const MODES = Object.keys(PALETTES) as PaletteMode[];

/** Najgorszy przypadek: najjaśniejsze z trzech teł danej palety. */
const worstBackground = (palette: Palette) => parseHex(palette.surfaceRaised);

describe('kontrast palety', () => {
  for (const mode of MODES) {
    const palette = PALETTES[mode];
    const background = worstBackground(palette);

    describe(mode, () => {
      it('każdy kolor tekstu spełnia AA na najjaśniejszym z teł', () => {
        const text = {
          textPrimary: palette.textPrimary,
          textSecondary: palette.textSecondary,
          textMuted: palette.textMuted,
        };

        for (const [name, hex] of Object.entries(text)) {
          const ratio = contrast(parseHex(hex), background);
          assert.ok(ratio >= AA_TEXT, `${name} (${hex}): ${ratio.toFixed(2)}:1`);
        }
      });

      it('kolory akcentowe też niosą tekst, więc obowiązuje je ten sam próg', () => {
        // Nie są wyłącznie ozdobą: werdykt „jedź", ostrzeżenie o rosie i godziny
        // wschodu są nimi pisane. Kolor, którym pada informacja, musi być czytelny.
        const accents = {
          purple: palette.purple,
          teal: palette.teal,
          green: palette.green,
          amber: palette.amber,
          coral: palette.coral,
        };

        for (const [name, hex] of Object.entries(accents)) {
          const ratio = contrast(parseHex(hex), background);
          assert.ok(ratio >= AA_TEXT, `${name} (${hex}): ${ratio.toFixed(2)}:1`);
        }
      });

      it('obrys elementu sterującego jest odróżnialny od tła', () => {
        // Wyłączony przełącznik nie ma wypełnienia — poznaje się go wyłącznie po
        // obrysie, więc obrys jest tu nośnikiem stanu, a nie dekoracją.
        const ratio = contrast(flatten(palette.borderStrong, background), background);

        assert.ok(ratio >= AA_NON_TEXT, `borderStrong: ${ratio.toFixed(2)}:1`);
      });

      it('hierarchia tekstu zachowuje kolejność', () => {
        // Sam próg nie wystarczy: gdyby podniesienie najcichszego stopnia zrównało
        // go z podpisami, kontrast byłby zdany, a układ czytelniejszy nie byłby.
        const [primary, secondary, muted] = [
          palette.textPrimary,
          palette.textSecondary,
          palette.textMuted,
        ].map((hex) => contrast(parseHex(hex), background));

        assert.ok(primary > secondary, `${primary.toFixed(2)} vs ${secondary.toFixed(2)}`);
        assert.ok(secondary > muted, `${secondary.toFixed(2)} vs ${muted.toFixed(2)}`);
      });
    });
  }

  it('palety mają ten sam zestaw kolorów', () => {
    // Brakujący klucz w jednej z palet to `undefined` w stylu, czyli element
    // bez tła albo bez obrysu — i to wyłącznie w tym trybie, w którym nikt nie
    // patrzy. Typ tego nie złapie, bo paleta powstaje z tego samego typu.
    const [first, ...rest] = MODES.map((mode) => Object.keys(PALETTES[mode]).sort());

    for (const keys of rest) assert.deepEqual(keys, first);
  });
});
