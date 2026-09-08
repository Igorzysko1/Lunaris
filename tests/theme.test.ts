/**
 * Czytelność palety.
 *
 * Kontrast to jedyna rzecz w wyglądzie aplikacji, którą da się rozstrzygnąć
 * liczbą zamiast opinią — i akurat ona psuje się najciszej. Kolor dobrany na
 * monitorze w dzień wygląda dobrze; ten sam kolor na telefonie w polu, przy
 * 11 px i zaparowanych okularach, po prostu znika. Dlatego progi WCAG stoją
 * w teście, a nie w komentarzu.
 *
 * Sprawdzamy względem `surfaceRaised`, bo to najjaśniejsze z teł, czyli
 * przypadek najgorszy dla jasnego tekstu na ciemnym tle.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { colors } from '../src/theme.ts';

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

/** Najgorszy przypadek: najjaśniejsze z trzech teł. */
const WORST_BACKGROUND = parseHex(colors.surfaceRaised);

describe('kontrast palety', () => {
  it('każdy kolor tekstu spełnia AA na najjaśniejszym z teł', () => {
    const text = {
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      textMuted: colors.textMuted,
    };

    for (const [name, hex] of Object.entries(text)) {
      const ratio = contrast(parseHex(hex), WORST_BACKGROUND);
      assert.ok(ratio >= AA_TEXT, `${name} (${hex}): ${ratio.toFixed(2)}:1`);
    }
  });

  it('kolory akcentowe też niosą tekst, więc obowiązuje je ten sam próg', () => {
    // Nie są wyłącznie ozdobą: werdykt „jedź", ostrzeżenie o rosie i godziny
    // wschodu są nimi pisane. Kolor, którym pada informacja, musi być czytelny.
    const accents = {
      purple: colors.purple,
      teal: colors.teal,
      green: colors.green,
      amber: colors.amber,
      coral: colors.coral,
    };

    for (const [name, hex] of Object.entries(accents)) {
      const ratio = contrast(parseHex(hex), WORST_BACKGROUND);
      assert.ok(ratio >= AA_TEXT, `${name} (${hex}): ${ratio.toFixed(2)}:1`);
    }
  });

  it('obrys elementu sterującego jest odróżnialny od tła', () => {
    // Wyłączony przełącznik nie ma wypełnienia — poznaje się go wyłącznie po
    // obrysie, więc obrys jest tu nośnikiem stanu, a nie dekoracją.
    const ratio = contrast(flatten(colors.borderStrong, WORST_BACKGROUND), WORST_BACKGROUND);

    assert.ok(ratio >= AA_NON_TEXT, `borderStrong: ${ratio.toFixed(2)}:1`);
  });

  it('hierarchia tekstu zachowuje kolejność', () => {
    // Sam próg nie wystarczy: gdyby podniesienie najcichszego stopnia zrównało
    // go z podpisami, kontrast byłby zdany, a układ czytelniejszy nie byłby.
    const [primary, secondary, muted] = [
      colors.textPrimary,
      colors.textSecondary,
      colors.textMuted,
    ].map((hex) => contrast(parseHex(hex), WORST_BACKGROUND));

    assert.ok(primary > secondary, `${primary.toFixed(2)} vs ${secondary.toFixed(2)}`);
    assert.ok(secondary > muted, `${secondary.toFixed(2)} vs ${muted.toFixed(2)}`);
  });
});
