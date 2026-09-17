/**
 * Nazwy gwiazd w figurach — sprawdzane względem katalogu IAU, a nie względem
 * niczyjej pamięci.
 *
 * Powód tego testu jest konkretny: nazwy w `constellation-figures.ts` zostały
 * wpisane z głowy, a nazwa brzmiąca wiarygodnie i przypisana do złej gwiazdy
 * wygląda dokładnie tak samo jak prawdziwa. Przy pierwszym porównaniu z katalogiem
 * wyszło pięć takich miejsc — jedna nazwa zwyczajnie błędna (δ Virginis to
 * Minelauva, nie Auva), cztery tradycyjne, ale nigdy niezatwierdzone — plus cztery
 * gwiazdy, którym nazwy brakowało, choć katalog je ma.
 *
 * Odniesieniem jest `fixtures/iau-star-names.json`: wyciąg z IAU-CSN, wersja
 * katalogu z 2022-04-04. Fixture, a nie pobieranie w locie, bo test ma działać
 * bez sieci i dawać ten sam wynik za rok.
 *
 * Trzy odstępstwa są **świadome** i wypisane niżej z nazwiska. Każde musi być
 * używane — martwy wpis w tablicy wyjątków to cicha furtka do wpisania czegokolwiek.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { FIGURES } from '../src/data/constellation-figures.ts';
import { CONSTELLATIONS } from '../src/data/constellations.ts';

const catalog = JSON.parse(
  readFileSync(new URL('./fixtures/iau-star-names.json', import.meta.url), 'utf8'),
) as { names: Record<string, string> };

/**
 * Polskie nazwy własne — jedyne miejsce, gdzie świadomie odchodzimy od zapisu
 * katalogowego. Aplikacja jest po polsku, a „Wega" i „Syriusz" to formy, których
 * używa każdy polski atlas; wymuszanie „Vega" byłoby wiernością wobec pliku,
 * a nie wobec czytelnika.
 */
const POLISH: Record<string, string> = {
  Wega: 'Vega',
  Arktur: 'Arcturus',
  Betelgeza: 'Betelgeuse',
  Kapella: 'Capella',
  Kastor: 'Castor',
  Polluks: 'Pollux',
  Syriusz: 'Sirius',
  Procjon: 'Procyon',
  Spika: 'Spica',
};

/**
 * Węzły figury, które nazywają obiekt, a nie gwiazdę. Rysunek prowadzi w tych
 * miejscach do gromady albo mgławicy i tak jest podpisany — θ Orionis *jest*
 * Trapezem w M42, ε Cancri leży w Żłóbku.
 */
const OBJECTS: Record<string, string> = {
  'tau|η': 'Plejady',
  'gem|η': 'M35',
  'cnc|ε': 'M44',
  'ori|θ': 'M42',
};

/**
 * Gwiazda dzielona między gwiazdozbiory: dawna δ Pegasi rysuje róg kwadratu
 * Pegaza, ale katalog zna ją jako α Andromedae. Figura zostaje przy dawnym
 * oznaczeniu, bo to ono rysuje kształt.
 */
const SHARED: Record<string, string> = { 'peg|δ': 'Alpheratz' };

const keyOf = (constellation: string, bayer: string) => `${constellation}|${bayer}`;

/** Nazwa z katalogu dla tego oznaczenia; oznaczenia z numerem szukamy też bez niego. */
function iauName(constellation: string, bayer: string): string | null {
  const key = keyOf(constellation, bayer);
  return (
    catalog.names[key] ?? catalog.names[keyOf(constellation, bayer.replace(/[0-9]+$/, ''))] ?? null
  );
}

const stars = Object.entries(FIGURES).flatMap(([constellation, figure]) =>
  figure.s.map((star) => ({ constellation, bayer: star[2], name: star[3] ?? null })),
);

describe('nazwy gwiazd wobec katalogu IAU', () => {
  it('każda wpisana nazwa jest nazwą tej właśnie gwiazdy', () => {
    for (const { constellation, bayer, name } of stars) {
      if (!name) continue;

      const key = keyOf(constellation, bayer);
      if (OBJECTS[key] === name || SHARED[key] === name) continue;

      const iau = iauName(constellation, bayer);
      const expected = POLISH[name] ?? name;

      assert.equal(iau, expected, `${key}: „${name}" (katalog: ${iau ?? 'brak'})`);
    }
  });

  it('żadna gwiazda z nazwą w katalogu nie została pominięta', () => {
    // Odwrotna strona tego samego: łatwo zauważyć nazwę błędną, trudno brakującą.
    for (const { constellation, bayer, name } of stars) {
      if (name) continue;

      const iau = iauName(constellation, bayer);
      assert.equal(iau, null, `${keyOf(constellation, bayer)}: katalog ma „${iau}", u nas pusto`);
    }
  });

  it('każdy wyjątek jest używany', () => {
    const named = new Set(stars.filter((s) => s.name).map((s) => `${s.constellation}|${s.bayer}`));
    const used = new Set(stars.map((s) => s.name).filter(Boolean));

    for (const key of [...Object.keys(OBJECTS), ...Object.keys(SHARED)]) {
      assert.ok(named.has(key), `martwy wyjątek: ${key}`);
    }
    for (const polish of Object.keys(POLISH)) {
      assert.ok(used.has(polish), `martwy wyjątek: ${polish}`);
    }
  });

  it('fixture zna wszystkie gwiazdozbiory aplikacji', () => {
    // Literówka w identyfikatorze gwiazdozbioru ukryłaby przed sprawdzeniem
    // cały jego rysunek — wszystkie nazwy wyszłyby wtedy „spoza katalogu".
    const inCatalog = new Set(Object.keys(catalog.names).map((k) => k.split('|')[0]));
    const missing = CONSTELLATIONS.map((c) => c.id).filter((id) => !inCatalog.has(id));

    // Kilka gwiazdozbiorów nie ma żadnej nazwanej gwiazdy i to jest w porządku;
    // chodzi o to, żeby nie zniknęła ich większość.
    assert.ok(missing.length < 6, `bez ani jednej nazwy: ${missing.join(', ')}`);
  });
});
