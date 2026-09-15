/**
 * Skąd aplikacja bierze prognozę: najpierw serwer na Frogu, potem Open-Meteo.
 *
 * Serwer jest pośrednikiem, więc ścieżka i parametry muszą przejść bez zmian —
 * inaczej serwer i Open-Meteo odpowiadałyby na dwa różne pytania.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { forecastSources } from '../src/lib/weather.ts';

const URL_OPEN_METEO = new URL(
  'https://api.open-meteo.com/v1/forecast?latitude=50.35&longitude=19.53&hourly=cloud_cover&past_days=1',
);

describe('źródła prognozy', () => {
  it('bez adresu Froga zostaje samo Open-Meteo', () => {
    assert.deepEqual(forecastSources(URL_OPEN_METEO, ''), [URL_OPEN_METEO.toString()]);
  });

  it('z adresem Froga najpierw serwer, potem Open-Meteo', () => {
    const [frog, direct] = forecastSources(URL_OPEN_METEO, 'https://frog01-30951.wykr.es');

    assert.equal(frog, `https://frog01-30951.wykr.es/v1/forecast${URL_OPEN_METEO.search}`);
    assert.equal(direct, URL_OPEN_METEO.toString());
  });

  it('ukośnik na końcu adresu nie psuje ścieżki', () => {
    const [frog] = forecastSources(URL_OPEN_METEO, 'https://frog01-30951.wykr.es/');

    assert.ok(frog.startsWith('https://frog01-30951.wykr.es/v1/forecast?'));
  });

  it('parametry przechodzą bez zmian', () => {
    const [frog] = forecastSources(URL_OPEN_METEO, 'https://frog01-30951.wykr.es');

    assert.equal(new URL(frog).search, URL_OPEN_METEO.search);
  });
});
