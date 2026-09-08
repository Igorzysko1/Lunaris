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

import { Body, DefineStar, Equator, Horizon, Observer } from 'astronomy-engine';

import { DEEP_SKY_OBJECTS } from '../src/data/deep-sky.ts';
import { DEFAULT_HORIZON, horizonOf } from '../src/lib/horizon.ts';
import { DEFAULT_OPTICS, surfaceBrightness, type Optics } from '../src/lib/optics.ts';
import { nightTargetsForProfiles, rankedTargets, type SkyTarget } from '../src/lib/sky-targets.ts';

const BLEDOWSKA = { lat: 50.35, lon: 19.53 };
/** Styczniowa noc: długa, więc przez okno przewija się pół katalogu. */
const NIGHT = { from: new Date(2026, 0, 16, 18, 0), to: new Date(2026, 0, 17, 6, 0) };

/** Jeden zestaw sprzętu — tą samą ścieżką, którą liczy aplikacja. */
const targetsFor = (optics: Optics = DEFAULT_OPTICS, bortle = 4) =>
  nightTargetsForProfiles(NIGHT, BLEDOWSKA, [{ id: 'test', label: '', optics }], bortle);

/**
 * Wysokość celu liczona niezależnie od modułu, który testujemy — inaczej test
 * potwierdzałby sam siebie. To druga droga do tej samej liczby: prosto
 * z Astronomy Engine, bez próbkowania i bez bisekcji.
 */
function altitudeAt(target: SkyTarget, at: Date): number {
  const observer = new Observer(BLEDOWSKA.lat, BLEDOWSKA.lon, 0);

  const body = target.id.startsWith('planet-')
    ? (target.id.slice('planet-'.length) as Body)
    : (() => {
        const dso = DEEP_SKY_OBJECTS.find((o) => o.id === target.id);
        assert.ok(dso, target.id);
        DefineStar(Body.Star1, dso.raHours, dso.dec, dso.distanceLy);
        return Body.Star1;
      })();

  const equator = Equator(body, at, observer, true, true);
  return Horizon(at, observer, equator.ra, equator.dec, 'normal').altitude;
}

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

describe('odcinek widoczności', () => {
  it('każdy cel w zasięgu ma odcinek, a odrzucony przez horyzont go nie ma', () => {
    // To ta sama informacja z dwóch stron: „nie wychodzi ponad horyzont miejsca"
    // i „odpadł przez horyzont" muszą znaczyć dokładnie to samo, bo werdykt
    // liczy się właśnie z odcinka.
    for (const target of targetsFor()) {
      if (target.outOfReach === 'too-low' || target.outOfReach === 'behind-horizon') {
        assert.equal(target.up, null, target.id);
      } else {
        assert.ok(target.up, target.id);
      }
    }
  });

  it('odcinek mieści się w oknie nocy', () => {
    for (const { id, up } of targetsFor()) {
      if (!up) continue;
      assert.ok(up.from >= NIGHT.from && up.to <= NIGHT.to, id);
      assert.ok(up.from < up.to, id);
    }
  });

  it('obiekt okołobiegunowy stoi nad horyzontem całą noc', () => {
    // h+χ Persei ma deklinację ~+57°, więc z Polski nie schodzi poniżej 15°
    // nawet w dolnym górowaniu. Odcinek jest wtedy całą nocą, a nie wschodem.
    const perseus = targetsFor().find((t) => t.id === 'hchi');
    assert.ok(perseus?.up, 'brak h+χ Persei wśród celów');

    assert.equal(perseus.up.rises, false);
    assert.equal(perseus.up.sets, false);
    assert.deepEqual([perseus.up.from, perseus.up.to], [NIGHT.from, NIGHT.to]);
  });

  it('wschód w środku nocy wypada tam, gdzie obiekt faktycznie przekracza próg', () => {
    // Sprawdzamy sam moment, a nie tylko flagę: kwadrans przed nim obiekt ma
    // być pod progiem, a kwadrans po nim nad. Bisekcja psuje się po cichu —
    // flaga `rises` zostaje prawdziwa, a godzina przestaje cokolwiek znaczyć.
    const rising = targetsFor().filter((t) => t.up?.rises);
    assert.ok(rising.length > 0, 'noc testowa nie ma żadnego wschodu');

    const QUARTER_MS = 15 * 60_000;
    for (const target of rising) {
      const at = target.up!.from.getTime();
      assert.ok(
        altitudeAt(target, new Date(at + QUARTER_MS)) > DEFAULT_HORIZON,
        `${target.id}: kwadrans po wschodzie wciąż pod progiem`,
      );
      assert.ok(
        altitudeAt(target, new Date(at - QUARTER_MS)) < DEFAULT_HORIZON,
        `${target.id}: kwadrans przed wschodem już nad progiem`,
      );
    }
  });

  it('maska terenu przesuwa wschód, a nie tylko odrzuca cele', () => {
    // Cały sens liczenia odcinka względem maski: las na wschodzie nie sprawia,
    // że obiekt jest niewidoczny — sprawia, że wychodzi zza niego później.
    const forest = horizonOf(null, [{ from: 45, to: 135, altitude: 25 }]);
    const flat = targetsFor();
    const masked = nightTargetsForProfiles(
      NIGHT,
      BLEDOWSKA,
      [{ id: 'test', label: '', optics: DEFAULT_OPTICS }],
      4,
      forest,
    );

    const delayed = flat.filter((t) => {
      const other = masked.find((m) => m.id === t.id);
      return t.up?.rises && other?.up?.rises && other.up.from > t.up.from;
    });

    assert.ok(delayed.length > 0, 'żaden wschód nie przesunął się przez las na wschodzie');
  });
});
