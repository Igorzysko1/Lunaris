/**
 * Dobór celów i katalog obiektów.
 *
 * Katalog urósł z pięciu pozycji do ponad stu i to zmieniło charakter tego
 * modułu: przy pięciu obiektach filtr sprzętowy nie miał czego odsiewać,
 * a lista nie mogła być za długa. Testy pilnują trzech rzeczy, które przy tej
 * skali psują się po cichu: luk w filtrze, długości listy i spójności danych,
 * do których będzie się odwoływał dziennik obserwacji.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEEP_SKY_OBJECTS } from '../src/data/deep-sky.ts';
import { DEFAULT_OPTICS, surfaceBrightness, type Optics } from '../src/lib/optics.ts';
import { nightTargets, rankedTargets } from '../src/lib/sky-targets.ts';

const BLEDOWSKA = { lat: 50.35, lon: 19.53 };
/** Styczniowa noc: długa, więc przez okno przewija się pół katalogu. */
const NIGHT = { from: new Date(2026, 0, 16, 18, 0), to: new Date(2026, 0, 17, 6, 0) };

const targetsFor = (optics: Optics = DEFAULT_OPTICS, bortle = 4) =>
  nightTargets(NIGHT, BLEDOWSKA, optics, bortle);

describe('katalog obiektów', () => {
  it('identyfikatory są unikalne — dziennik będzie się do nich odwoływał latami', () => {
    const ids = DEEP_SKY_OBJECTS.map((o) => o.id);

    assert.equal(new Set(ids).size, ids.length);
  });

  it('każdy obiekt ma komplet danych, których wymaga rachunek', () => {
    for (const o of DEEP_SKY_OBJECTS) {
      assert.ok(o.id.length > 0, `${o.designation}: pusty id`);
      assert.ok(Number.isFinite(o.magnitude), `${o.id}: jasność`);
      assert.ok(o.sizeArcmin > 0, `${o.id}: rozmiar kątowy`);
      assert.ok(o.raHours >= 0 && o.raHours < 24, `${o.id}: rektascensja`);
      assert.ok(o.dec >= -90 && o.dec <= 90, `${o.id}: deklinacja`);
      assert.ok(o.distanceLy > 0, `${o.id}: odległość`);
    }
  });

  it('nie ma obiektów, których z Polski nie da się obejrzeć', () => {
    // Poniżej −30° deklinacji obiekt góruje u nas kilka stopni nad horyzontem,
    // czyli pod progiem widoczności i zwykle za linią lasu.
    for (const o of DEEP_SKY_OBJECTS) {
      assert.ok(o.dec > -30, `${o.id} ma deklinację ${o.dec}`);
    }
  });

  it('pokrycie obejmuje cały rok, a nie jeden sezon', () => {
    // Rektascensja to pora roku, w której obiekt jest na niebie wieczorem.
    // Puste ćwiartki znaczyłyby miesiące bez celów.
    const quarters = new Set(DEEP_SKY_OBJECTS.map((o) => Math.floor(o.raHours / 6)));

    assert.equal(quarters.size, 4);
  });
});

describe('filtr sprzętowy', () => {
  it('jasność całkowita obowiązuje także obiekty rozmyte', () => {
    // Luka, przez którą do listy wchodziły galaktyki bez szans w lornetce:
    // sprawdzana była sama jasność powierzchniowa, a światła od rozlania na
    // większą powierzchnię nie przybywa.
    const faintGalaxies = DEEP_SKY_OBJECTS.filter(
      (o) => o.kind === 'galaktyka' && o.magnitude > 10.5,
    );
    assert.ok(faintGalaxies.length > 0, 'katalog nie ma czym sprawdzić tej reguły');

    const targets = targetsFor();
    for (const galaxy of faintGalaxies) {
      const target = targets.find((t) => t.id === galaxy.id);
      if (!target) continue;
      assert.equal(
        target.visible,
        false,
        `${galaxy.id} (${galaxy.magnitude} mag) w lornetce 15x70`,
      );
    }
  });

  it('gromadę otwartą ocenia jasność całkowita, nie powierzchniowa', () => {
    // Gromada to zbiór osobnych gwiazd — widać ją, gdy sprzęt pokazuje składniki.
    // Rozmycie na dużą powierzchnię nie może jej wykluczyć.
    const spread = DEEP_SKY_OBJECTS.filter(
      (o) => o.kind === 'gromada otwarta' && o.magnitude < 6 && o.sizeArcmin > 30,
    );
    assert.ok(spread.length > 0);

    const targets = targetsFor();
    for (const cluster of spread) {
      const target = targets.find((t) => t.id === cluster.id);
      // Rozlana jasna gromada ma marną jasność powierzchniową — gdyby liczyła
      // się ona, Plejady odpadłyby jako „zbyt rozmyte".
      assert.ok(
        surfaceBrightness(cluster.magnitude, cluster.sizeArcmin) > 20,
        `${cluster.id}: test straciłby sens, gdyby ta gromada miała zwartą powierzchnię`,
      );
      if (target && target.outOfReach !== 'too-low') {
        assert.notEqual(target.outOfReach, 'too-diffuse', cluster.id);
      }
    }
  });

  it('większa apertura pod tym samym niebem pokazuje więcej', () => {
    const binoculars = targetsFor().filter((t) => t.visible).length;
    const telescope = targetsFor({ ...DEFAULT_OPTICS, aperture: 200, magnification: 50 }).filter(
      (t) => t.visible,
    ).length;

    assert.ok(telescope > binoculars, `${telescope} vs ${binoculars}`);
  });

  it('gorsze niebo odbiera cele', () => {
    const dark = targetsFor(DEFAULT_OPTICS, 3).filter((t) => t.visible).length;
    const city = targetsFor(DEFAULT_OPTICS, 8).filter((t) => t.visible).length;

    assert.ok(city < dark, `${city} vs ${dark}`);
  });
});

describe('rankedTargets', () => {
  it('przycina listę do zadanej długości', () => {
    // Sto obiektów w katalogu znaczy kilkadziesiąt widocznych każdej nocy;
    // lista na siedemdziesiąt pozycji przestaje być listą.
    const all = targetsFor();
    assert.ok(all.filter((t) => t.visible).length > 10, 'noc testowa ma za mało celów');

    assert.equal(rankedTargets(all, 10).length, 10);
  });

  it('od najjaśniejszych — to jedyny porządek obronny na tych danych', () => {
    const ranked = rankedTargets(targetsFor(), 12);
    const magnitudes = ranked.map((t) => t.magnitude);

    assert.deepEqual(
      [...magnitudes].sort((a, b) => a - b),
      magnitudes,
    );
  });

  it('nie przepuszcza celów poza zasięgiem', () => {
    assert.ok(rankedTargets(targetsFor(), 50).every((t) => t.visible));
  });

  it('obiekt jasny nisko bije słaby w zenicie', () => {
    // Wysokość rozstrzyga remisy, a nie kolejność: gdyby rządziła, na górze
    // listy stałyby przypadkowe galaktyki w zenicie zamiast Plejad.
    const ranked = rankedTargets(targetsFor(), 6);

    assert.ok(
      ranked.some((t) => t.maxAltitude < 40),
      'brak celu nisko wśród najjaśniejszych',
    );
  });
});
