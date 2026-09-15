/**
 * Gdzie: podpisy rankingu i katalogu, fix GPS, horyzont i miejsce wybrane
 * w Nocy jako wiersz rankingu.
 *
 * Przeszkoda wpisana ręcznie jest tu najważniejsza: zła korekta horyzontu
 * chowa cele w całym sektorze nieba, więc liczby spoza zakresu odpadają.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_CONFIG } from '../src/lib/config.ts';
import { reviewNights } from '../src/lib/site-review.ts';
import type { NightSlice } from '../src/lib/weather.ts';
import {
  ACTIVE_SITE_ID,
  activeAsSite,
  coordsText,
  dominatedText,
  driveMinutes,
  gpsAccuracyText,
  horizonSummary,
  missingAction,
  missingTitle,
  navigationUrl,
  nightChoice,
  obstacleText,
  parseObstacle,
  partialNote,
  rankingNote,
  shiftText,
  skyText,
  travelLong,
  travelShort,
  uniqueText,
  walkText,
  windowText,
} from '../src/lib/where-text.ts';

describe('ranking', () => {
  it('nagłówek mówi, skąd dojazd i co ustala kolejność', () => {
    assert.equal(
      rankingNote('Jaworzno', 10),
      'Dojazd z: Jaworzno · kolejność: ocena nieba minus kara za drogę',
    );
    assert.equal(rankingNote('Jaworzno', 0), 'Dojazd z: Jaworzno · kolejność: sama ocena nieba');
    assert.equal(rankingNote(null, 10), 'Bez punktu startowego · kolejność: sama ocena nieba');
    assert.equal(partialNote(3, 5, 'Jaworzno'), 'Policzone 3 z 5 miejsc · dojazd z: Jaworzno');
  });

  it('wiersz: okno, dojazd, dojście, cele tylko stąd, zdominowane', () => {
    assert.equal(
      windowText({ from: new Date(2026, 8, 14, 22, 10), to: new Date(2026, 8, 15, 2, 40) }),
      '22:10 – 02:40',
    );
    assert.equal(driveMinutes(70, 50), 84);
    assert.equal(travelShort(25.2, 30), '25 km · 30 min');
    assert.equal(travelLong(70.4, 84), '70 km · ok. 84 min jazdy');
    assert.deepEqual(walkText(15, 30), { text: '15 min od parkingu', warn: false });
    assert.deepEqual(walkText(60, 30), {
      text: '60 min od parkingu — powyżej tolerancji 30 min',
      warn: true,
    });
    assert.deepEqual(walkText(0, 30), { text: 'stanowisko przy samochodzie', warn: false });
    assert.equal(
      uniqueText(['M33 — Galaktyka Trójkąta', 'NGC 7000 — Ameryka Północna']),
      'Tylko stąd: M33, NGC 7000',
    );
    assert.equal(uniqueText(['A', 'B', 'C', 'D', 'E']), 'Tylko stąd: A, B, C i 2 więcej');
    assert.equal(
      dominatedText('Góra Zborów'),
      'Bliżej i lepiej: Góra Zborów. Nic, czego nie widać stamtąd.',
    );
  });

  it('brakujące prognozy i wybór nocy', () => {
    assert.equal(missingTitle(1), 'Bez prognozy · 1 miejsce');
    assert.equal(missingTitle(2), 'Bez prognozy · 2 miejsca');
    assert.equal(missingTitle(5), 'Bez prognozy · 5 miejsc');
    assert.equal(missingAction(1), 'Pobierz prognozę dla tego miejsca');
    assert.equal(missingAction(2), 'Pobierz prognozę dla tych 2 miejsc');
    assert.equal(nightChoice('dziś'), 'noc: dziś ▾');
  });

  it('miejsce wybrane w Nocy staje w rankingu obok katalogu', () => {
    const night = { from: new Date(2026, 0, 15, 18, 0), to: new Date(2026, 0, 16, 0, 0) };
    const clear: NightSlice[] = [
      {
        night,
        hours: Array.from({ length: 7 }, (_, i) => ({
          at: new Date(night.from.getTime() + i * 3_600_000),
          cloud: 5,
          cloudLow: 0,
          cloudMid: 0,
          cloudHigh: 0,
          humidity: 60,
          temperature: 5,
          dewSpread: 6,
          precipitation: 0,
          windGust: 8,
          windSpeed: 5,
          windJet: 20,
          windMid: 20,
          temp850: 0,
          temp500: -20,
          cape: 0,
          boundaryLayerM: 60,
        })),
      },
    ];
    const active = activeAsSite({
      label: 'Zawoja',
      coords: { lat: 49.65, lon: 19.55 },
      bortle: 4,
      walkMinutes: 0,
      horizonMask: null,
      horizonOverrides: [],
    });

    const [review] = reviewNights({
      sites: [active],
      forecasts: new Map([[ACTIVE_SITE_ID, clear]]),
      home: null,
      config: DEFAULT_CONFIG,
      moon: () => ({ illumination: 5, upAt: () => false }),
      nextDay: () => ({ firstEventAt: null, dayOff: true }),
      bortleFor: (site) => site.bortle,
    });

    assert.equal(active.id, ACTIVE_SITE_ID);
    assert.deepEqual(
      [...review.go, ...review.noGo].map((o) => o.site.name),
      ['Zawoja'],
    );
  });
});

describe('katalog i fix GPS', () => {
  it('niebo policzone dla punktu i szacunek to dwie różne wiarygodności', () => {
    assert.equal(
      skyText({ bortle: 3, source: 'map', mpsas: 21.45 }),
      'Bortle 3 · 21,45 mag/arcsec² policzone dla tego punktu',
    );
    assert.equal(
      skyText({ bortle: 4, source: 'nearest', mpsas: null }),
      'Bortle 4 — szacunek, punkt poza wgraną mapą nieba',
    );
  });

  it('dokładność fixa i odległość od istniejących miejsc', () => {
    assert.deepEqual(gpsAccuracyText(38), {
      text: 'dokładność ±38 m — słaby fix, warto powtórzyć',
      warn: true,
    });
    assert.deepEqual(gpsAccuracyText(12), { text: 'dokładność ±12 m', warn: false });
    assert.deepEqual(gpsAccuracyText(null), { text: 'dokładność nieznana', warn: false });
    assert.equal(shiftText(0.42), '420 m stąd');
    assert.equal(shiftText(39.3), '39 km stąd');
    assert.equal(coordsText({ lat: 49.57118, lon: 19.35042 }), '49,571 N 19,350 E');
    assert.equal(
      navigationUrl({ lat: 49.57118, lon: 19.35042 }),
      'https://www.google.com/maps/dir/?api=1&destination=49.57118,19.35042',
    );
  });
});

describe('horyzont miejsca', () => {
  it('przeszkoda i maska po ludzku', () => {
    assert.equal(
      obstacleText({ from: 180, to: 225, altitude: 12 }),
      'S–SW (180°–225°): przeszkoda do 12°',
    );
    assert.equal(horizonSummary(null), 'Brak maski terenu — obowiązuje próg 15°.');
    const mask = Array.from({ length: 360 }, (_, i) => 3 + (i % 16));
    assert.equal(horizonSummary(mask), 'Maska terenu: 3–18°.');
  });

  it('wpisana przeszkoda: azymuty 0–360, także przez północ, wysokość 0–90', () => {
    assert.deepEqual(parseObstacle('180', '225', '12'), { from: 180, to: 225, altitude: 12 });
    assert.deepEqual(parseObstacle('350', '20', '8,5'), { from: 350, to: 20, altitude: 8.5 });
    assert.equal(parseObstacle('', '20', '5'), null);
    assert.equal(parseObstacle('400', '20', '5'), null);
    assert.equal(parseObstacle('10', '20', '95'), null);
    assert.equal(parseObstacle('10', 'las', '5'), null);
  });
});
