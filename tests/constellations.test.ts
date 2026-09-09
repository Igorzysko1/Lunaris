/**
 * Warstwa orientacyjna: gwiazdozbiory.
 *
 * Współrzędne kotwic wpisano ręcznie, więc największym ryzykiem jest **cicha
 * pomyłka w danych** — literówka w rektascensji przesuwa gwiazdozbiór o pół
 * nieba i nic tego nie zgłosi. Dlatego najważniejszy test tego pliku nie
 * sprawdza kodu, tylko dane: konfrontuje kotwice z katalogiem obiektów, którego
 * współrzędne są niezależne i sprawdzone.
 *
 * Nazwy w katalogu obiektów niosą gwiazdozbiór po polsku („Gromada otwarta
 * w Łabędziu"), więc dopasowanie da się zrobić maszynowo, bez drugiej listy
 * do utrzymania.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CONSTELLATIONS } from '../src/data/constellations.ts';
import { DEEP_SKY_OBJECTS } from '../src/data/deep-sky.ts';
import { constellationsTonight, describeWhereToLook } from '../src/lib/constellations.ts';

const BLEDOWSKA = { lat: 50.35, lon: 19.53 };
/** Styczniowa noc: długa, więc przez okno przewija się pół nieba. */
const NIGHT = { from: new Date(2026, 0, 16, 18, 0), to: new Date(2026, 0, 17, 6, 0) };

/** Odległość kątowa dwóch punktów nieba, w stopniach. */
function separation(a: { raHours: number; dec: number }, b: { raHours: number; dec: number }) {
  const rad = Math.PI / 180;
  const [d1, d2] = [a.dec * rad, b.dec * rad];
  const dRa = (a.raHours - b.raHours) * 15 * rad;

  const cos = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(dRa);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / rad;
}

/**
 * Forma miejscownikowa z nazwy obiektu → gwiazdozbiór z katalogu.
 *
 * Ręczne, bo polska odmiana nie da się wyprowadzić regułą: „w Łabędziu" od
 * „Łabędź", ale „w Pannie" od „Panna" i „w Rufie" od „Rufa".
 */
const LOCATIVE: Record<string, string> = {
  Andromedzie: 'Andromeda',
  Bliźniętach: 'Bliźnięta',
  Herkulesie: 'Herkules',
  Hydrze: 'Hydra',
  Jednorożcu: 'Jednorożec',
  Kasjopei: 'Kasjopeja',
  Koziorożcu: 'Koziorożec',
  Lutni: 'Lutnia',
  Lwie: 'Lew',
  Orionie: 'Orion',
  Pannie: 'Panna',
  Pegazie: 'Pegaz',
  Perseuszu: 'Perseusz',
  Raku: 'Rak',
  Rufie: 'Rufa',
  Rybach: 'Ryby',
  Skorpionie: 'Skorpion',
  Strzale: 'Strzała',
  Strzelcu: 'Strzelec',
  Tarczy: 'Tarcza',
  Wielorybie: 'Wieloryb',
  Wodniku: 'Wodnik',
  Woźnicy: 'Woźnica',
  Wężowniku: 'Wężownik',
  Wężu: 'Wąż',
  Zającu: 'Zając',
  Łabędziu: 'Łabędź',
};

describe('dane: kotwice zgadzają się z katalogiem obiektów', () => {
  it('każdy gwiazdozbiór z nazw obiektów jest w katalogu gwiazdozbiorów', () => {
    const missing = [...new Set(Object.values(LOCATIVE))].filter(
      (name) => !CONSTELLATIONS.some((c) => c.name === name),
    );

    assert.deepEqual(missing, []);
  });

  it('kotwica leży w tej samej części nieba, co obiekty tego gwiazdozbioru', () => {
    // Tolerancja jest hojna świadomie: kotwicą jest **najjaśniejsza gwiazda**,
    // a nie środek obszaru, więc Spika stoi ponad 20° od gromady galaktyk
    // w Pannie. Ten test łapie pomyłkę o pół nieba — literówkę w godzinie
    // rektascensji — a nie przesunięcie o kilka stopni.
    const LIMIT = 40;

    /**
     * Hydra jest najdłuższym gwiazdozbiorem nieba i to nie przenośnia: jej
     * obiekty rozciągają się na 81° rektascensji, od M48 przy głowie po M83
     * w ogonie. Alphard — „samotna", po której się ją znajduje — leży przy
     * głowie, więc odległość do ogona jest **własnością danych, nie błędem**.
     * Wyjątek jest wpisany imiennie, żeby nie rozluźniać progu dla pozostałych
     * dwudziestu sześciu.
     */
    const SPRAWLING = new Set(['Hydra']);
    const offenders: string[] = [];

    for (const dso of DEEP_SKY_OBJECTS) {
      const match = dso.name.match(/\bw(?:e)? ([A-ZŁŚŻŹĆĄĘÓŃa-złśżźćąęóń]+)$/);
      const name = match ? LOCATIVE[match[1]] : undefined;
      if (!name) continue;

      if (SPRAWLING.has(name)) continue;

      const anchor = CONSTELLATIONS.find((c) => c.name === name);
      if (!anchor) continue;

      const distance = separation(anchor, dso);
      if (distance > LIMIT) {
        offenders.push(`${dso.designation} (${name}): ${distance.toFixed(0)}° od kotwicy`);
      }
    }

    assert.deepEqual(offenders, []);
  });

  it('współrzędne mieszczą się w zakresie', () => {
    for (const c of CONSTELLATIONS) {
      assert.ok(c.raHours >= 0 && c.raHours < 24, `${c.name}: rektascensja ${c.raHours}`);
      assert.ok(c.dec >= -90 && c.dec <= 90, `${c.name}: deklinacja ${c.dec}`);
    }
  });

  it('identyfikatory i nazwy są unikalne', () => {
    const ids = CONSTELLATIONS.map((c) => c.id);
    const names = CONSTELLATIONS.map((c) => c.name);

    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(names).size, names.length);
  });

  it('nic, czego z Polski nie da się zobaczyć', () => {
    // Deklinacja poniżej −40° znaczy, że z Błędowskiej gwiazdozbiór nigdy nie
    // wychodzi na sensowną wysokość — obiecywanie go byłoby wysyłaniem w las.
    for (const c of CONSTELLATIONS) {
      assert.ok(c.dec > -40, `${c.name} ma deklinację ${c.dec}`);
    }
  });

  it('każdy ma podpowiedź, po czym go poznać', () => {
    for (const c of CONSTELLATIONS) {
      assert.ok(c.hint.length > 20, `${c.name}: podpowiedź za krótka`);
      assert.ok(c.star.length > 0, `${c.name}: brak gwiazdy przewodniej`);
    }
  });
});

describe('co dziś nad głową', () => {
  it('zwraca tylko te, które stoją dość wysoko, i od najwyższych', () => {
    const tonight = constellationsTonight(NIGHT, BLEDOWSKA);

    assert.ok(tonight.length > 0, 'styczniowa noc bez ani jednego gwiazdozbioru');
    assert.ok(
      tonight.every((c) => c.maxAltitude >= 20),
      'przepuszczony gwiazdozbiór poniżej progu',
    );

    // Porządek: najpierw łatwe do rozpoznania, wewnątrz grupy po wysokości.
    const keys = tonight.map((c) => [c.constellation.ease, -c.maxAltitude] as const);
    const sorted = [...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    assert.deepEqual(sorted, keys);
  });

  it('nie podsuwa najpierw gwiazdozbiorów trudnych do rozpoznania', () => {
    // Regresja z prawdziwych danych: porządek po samej wysokości stawiał na
    // czele Jaszczurkę, bo okołobiegunowe przechodzą przez zenit.
    const [first] = constellationsTonight(NIGHT, BLEDOWSKA);

    assert.equal(first.constellation.ease, 1, `na czele stanął ${first.constellation.name}`);
  });

  it('styczniowa noc pokazuje zimowe gwiazdozbiory', () => {
    // Sprawdzian sensowności całego rachunku: w styczniu Orion i Byk mają być
    // wysoko, a letni Strzelec nie ma prawa się pojawić.
    const names = constellationsTonight(NIGHT, BLEDOWSKA).map((c) => c.constellation.name);

    assert.ok(names.includes('Orion'), 'brak Oriona w styczniu');
    assert.ok(names.includes('Byk'), 'brak Byka w styczniu');
    assert.ok(!names.includes('Strzelec'), 'Strzelec nie może być widoczny w styczniową noc');
  });

  it('okołobiegunowe są oznaczone jako widoczne całą noc', () => {
    const tonight = constellationsTonight(NIGHT, BLEDOWSKA);
    const cassiopeia = tonight.find((c) => c.constellation.id === 'cas');

    assert.ok(cassiopeia, 'Kasjopeja powinna być widoczna z Polski każdej nocy');
    assert.equal(cassiopeia.allNight, true);
  });

  it('opis mówi, gdzie i kiedy patrzeć', () => {
    const [highest] = constellationsTonight(NIGHT, BLEDOWSKA);
    const text = describeWhereToLook(highest);

    assert.match(text, /\d+° nad horyzontem/);
    assert.match(text, /na (N|NE|E|SE|S|SW|W|NW)/);
  });

  it('pusty katalog nie wywraca rachunku', () => {
    assert.deepEqual(constellationsTonight(NIGHT, BLEDOWSKA, []), []);
  });
});
