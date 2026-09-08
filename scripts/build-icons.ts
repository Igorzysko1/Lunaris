/**
 * Generuje ikony aplikacji i grafikę ekranu startowego.
 *
 *   npm run build:icons
 *
 * Rysujemy kodem, a nie w edytorze graficznym, z tego samego powodu co mapa
 * jasności nieba: wynik ma być odtwarzalny. Zmiana koloru tła w `theme.ts`
 * i ponowne uruchomienie skryptu wystarczą, żeby ikona przestała odstawać od
 * aplikacji — przy pliku z edytora trzeba by pamiętać, gdzie leży źródło i czym
 * je otworzyć.
 *
 * Bez żadnej zależności: cała grafika to okręgi, a `node:zlib` wystarczy do
 * zapisania PNG-a. Wciąganie biblioteki graficznej do projektu, który używa jej
 * raz na rok, kosztowałoby więcej niż osiemdziesiąt linijek enkodera.
 *
 * Bez poświaty i bez gradientu na samym kształcie: próbowana miękka łuna
 * świeciła we wklęsłości sierpa, czyli dokładnie tam, gdzie z definicji nie ma
 * światła, i czytała się jak smuga. Ciemne tło, cztery gwiazdy i czysty kształt
 * wystarczą, a jest o jeden zgadywany parametr mniej.
 *
 * Cztery pliki, bo każdy ma inne wymagania:
 *  - `icon.png`          — pełne tło, bez przezroczystości (wymóg iOS).
 *  - `adaptive-icon.png` — sam kształt na przezroczystym tle; Android przycina
 *                          go maską, więc treść musi zmieścić się w bezpiecznym
 *                          okręgu (66% krawędzi), a tło daje `app.json`.
 *  - `splash-icon.png`   — kształt na przezroczystym tle, skalowany `contain`.
 *  - `favicon.png`       — 48 px, czyli test czytelności całego pomysłu.
 */

import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

/** Kolory z src/theme.ts. Powtórzone liczbowo, bo skrypt nie importuje aplikacji. */
const BACKGROUND_TOP = [0x14, 0x14, 0x2a] as const;
const BACKGROUND_BOTTOM = [0x0a, 0x0a, 0x14] as const;
const MOON = [0xf0, 0xef, 0xe8] as const;

/**
 * Ile próbek na piksel w każdej osi. Krawędź okręgu bez tego jest schodkowa,
 * a ikona ogląda się głównie w rozmiarach, w których widać wyłącznie krawędzie.
 */
const SUPERSAMPLE = 4;

type Rgba = [number, number, number, number];

/**
 * Gwiazdy w tle. Współrzędne w ułamku krawędzi, promień też — dzięki temu ten
 * sam układ działa dla każdego rozmiaru. Trzymane z dala od sierpa, żeby przy
 * 48 px nie zlały się z nim w plamę.
 */
const STARS: { x: number; y: number; r: number; alpha: number }[] = [
  { x: 0.17, y: 0.21, r: 0.011, alpha: 0.85 },
  { x: 0.79, y: 0.15, r: 0.008, alpha: 0.5 },
  { x: 0.26, y: 0.8, r: 0.009, alpha: 0.65 },
  { x: 0.86, y: 0.72, r: 0.007, alpha: 0.4 },
];

/** Nakłada kolor z kanałem alfa na to, co już jest. */
function blend(base: Rgba, color: readonly [number, number, number], alpha: number): Rgba {
  if (alpha <= 0) return base;

  const outAlpha = alpha + base[3] * (1 - alpha);
  if (outAlpha <= 0) return [0, 0, 0, 0];

  const mix = (i: number) => (color[i] * alpha + base[i] * base[3] * (1 - alpha)) / outAlpha;
  return [mix(0), mix(1), mix(2), outAlpha];
}

/**
 * Przesunięcie koła cienia względem koła Księżyca, w promieniach.
 *
 * Równe promienie i to przesunięcie dają sierp z wyraźnymi rogami, który nie
 * znika przy 48 px. Cieńszy wygląda lepiej w powiększeniu i gorzej tam, gdzie
 * ikonę faktycznie widać.
 */
const SHADOW_OFFSET = 0.6;

/**
 * Geometria sierpa.
 *
 * Kluczowe jest tu wyśrodkowanie: środek **koła** Księżyca to nie środek
 * **oświetlonej** części. Sierp rozciąga się od punktów przecięcia obu okręgów
 * (x = −SHADOW_OFFSET/2 promienia) do prawej krawędzi koła, więc jego środek
 * optyczny leży o ćwierć promienia w prawo. Ustawienie koła na środku płótna
 * dawało ikonę wyraźnie zepchniętą w prawo.
 */
function geometry(size: number, scale: number) {
  const radius = size * scale;
  // Środek sierpa: (−SHADOW_OFFSET/2 + 1) / 2 promienia od środka koła.
  const lune = ((1 - SHADOW_OFFSET / 2) / 2) * radius;

  return { radius, cx: size / 2 - lune, cy: size / 2, lune };
}

/**
 * Pokrycie piksela przez sierp, w zakresie 0–1.
 *
 * Sierp to koło Księżyca minus koło cienia przesunięte w lewo — oświetlona
 * zostaje prawa strona, czyli faza wieczorna. To nie jest ozdobnik: aplikacja
 * mówi, czy jechać **dziś w nocy**, a Księżyc po nowiu widać zaraz po zmierzchu.
 *
 * Zamiast liczyć pole przecięcia analitycznie, próbkujemy — przy `SUPERSAMPLE`
 * podziałach na oś to szesnaście testów na piksel i kilkadziesiąt milisekund na
 * całość, a kod zostaje czytelny.
 */
function crescentCoverage(px: number, py: number, size: number, scale: number): number {
  const { radius, cx, cy } = geometry(size, scale);
  const shadowX = cx - radius * SHADOW_OFFSET;

  let hits = 0;
  const step = 1 / SUPERSAMPLE;

  for (let sy = 0; sy < SUPERSAMPLE; sy++) {
    for (let sx = 0; sx < SUPERSAMPLE; sx++) {
      const x = px + (sx + 0.5) * step;
      const y = py + (sy + 0.5) * step;

      const inMoon = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
      const inShadow = (x - shadowX) ** 2 + (y - cy) ** 2 <= radius ** 2;

      if (inMoon && !inShadow) hits += 1;
    }
  }

  return hits / (SUPERSAMPLE * SUPERSAMPLE);
}

type Options = {
  size: number;
  /** Promień Księżyca jako ułamek krawędzi. */
  scale: number;
  /** Tło i gwiazdy — `false` dla warstw, które dostają tło od systemu. */
  opaque: boolean;
};

function render({ size, scale, opaque }: Options): Buffer {
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color: Rgba = [0, 0, 0, 0];

      if (opaque) {
        // Pionowy gradient: u góry odrobinę jaśniej, jak niebo tuż po zmierzchu.
        const t = y / (size - 1);
        color = [
          BACKGROUND_TOP[0] + (BACKGROUND_BOTTOM[0] - BACKGROUND_TOP[0]) * t,
          BACKGROUND_TOP[1] + (BACKGROUND_BOTTOM[1] - BACKGROUND_TOP[1]) * t,
          BACKGROUND_TOP[2] + (BACKGROUND_BOTTOM[2] - BACKGROUND_TOP[2]) * t,
          1,
        ];

        for (const star of STARS) {
          const distance = Math.hypot(x + 0.5 - star.x * size, y + 0.5 - star.y * size);
          const edge = star.r * size;
          if (distance < edge) {
            // Gwiazda gaśnie ku krawędzi, żeby nie była kwadratem po skalowaniu.
            color = blend(color, MOON, star.alpha * (1 - distance / edge));
          }
        }
      }

      const coverage = crescentCoverage(x, y, size, scale);
      if (coverage > 0) color = blend(color, MOON, coverage);

      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(color[0]);
      pixels[offset + 1] = Math.round(color[1]);
      pixels[offset + 2] = Math.round(color[2]);
      pixels[offset + 3] = Math.round(color[3] * 255);
    }
  }

  return pixels;
}

/** Kawałek PNG: długość, typ, dane, suma kontrolna. */
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, checksum]);
}

/**
 * Zapisuje RGBA jako PNG.
 *
 * Bez filtrowania wierszy (bajt 0 przed każdym): filtry istnieją po to, żeby
 * poprawić kompresję, a przy czterech okręgach i gradiencie zysk byłby żaden.
 */
function encodePng(pixels: Buffer, size: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bitów na kanał
  header[9] = 6; // RGBA
  header[10] = 0; // deflate
  header[11] = 0; // filtr adaptacyjny
  header[12] = 0; // bez przeplotu

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const FILES: (Options & { path: string; note: string })[] = [
  { path: 'assets/icon.png', size: 1024, scale: 0.3, opaque: true, note: 'ikona iOS/ogólna' },
  {
    path: 'assets/adaptive-icon.png',
    size: 1024,
    // Android przycina ikonę maską, a bezpieczny okrąg to 66% krawędzi. Sierp
    // ma pełną wysokość koła Księżyca, więc ogranicza go średnica: 2 × 0.29
    // to 58% krawędzi, czyli tuż pod progiem. Mniejszy zostawiał w masce
    // pierścień pustego tła i wyglądał na zgubiony.
    scale: 0.29,
    opaque: false,
    note: 'warstwa Androida (maska przycina brzegi)',
  },
  {
    path: 'assets/splash-icon.png',
    size: 1024,
    scale: 0.26,
    opaque: false,
    note: 'ekran startowy',
  },
  { path: 'assets/favicon.png', size: 48, scale: 0.3, opaque: true, note: 'zakładka przeglądarki' },
];

for (const { path, size, scale, opaque, note } of FILES) {
  const png = encodePng(render({ size, scale, opaque }), size);
  writeFileSync(path, png);
  process.stdout.write(
    `${path.padEnd(28)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} kB  ${note}\n`,
  );
}
