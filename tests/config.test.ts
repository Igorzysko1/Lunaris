/**
 * Konfiguracja i zestawy sprzętu.
 *
 * Chodzi o jedno: żaden zapis — stary, ręcznie zepsuty czy niekompletny — nie
 * może wyprodukować konfiguracji, na której rachunek przestaje mieć sens.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_CONFIG, clampConfig, mergeConfig } from '../src/lib/config.ts';
import {
  DEFAULT_OPTICS,
  OPTICS_LIMITS,
  clampOptics,
  describeOptics,
  limitingMagnitude,
  minimumAngularSize,
  profileLabel,
  surfaceBrightness,
  surfaceBrightnessLimit,
  windLimitKmh,
} from '../src/lib/optics.ts';

const clone = <T>(value: T): T => structuredClone(value);

describe('clampOptics', () => {
  it('przycina wartości do zakresu fizycznego', () => {
    const optics = clampOptics({
      aperture: 9999,
      magnification: 1,
      fieldOfView: 40,
      mount: 'tripod',
    });

    assert.equal(optics.aperture, OPTICS_LIMITS.aperture.max);
    assert.equal(optics.magnification, OPTICS_LIMITS.magnification.min);
    assert.equal(optics.fieldOfView, OPTICS_LIMITS.fieldOfView.max);
  });

  it('wartość niebędąca liczbą wraca do domyślnej, zamiast propagować NaN', () => {
    const optics = clampOptics({
      aperture: NaN,
      magnification: Infinity,
      fieldOfView: undefined as unknown as number,
      mount: 'tripod',
    });

    assert.equal(optics.aperture, DEFAULT_OPTICS.aperture);
    assert.equal(optics.fieldOfView, DEFAULT_OPTICS.fieldOfView);
    // Infinity jest liczbą, ale nie skończoną — też wraca do domyślnej.
    assert.equal(optics.magnification, DEFAULT_OPTICS.magnification);
  });

  it('nieznany montaż traktuje jak statyw', () => {
    const optics = clampOptics({ ...DEFAULT_OPTICS, mount: 'segway' as never });
    assert.equal(optics.mount, 'tripod');
  });
});

describe('zasięg sprzętu', () => {
  it('graniczna jasność rośnie z aperturą i spada z jasnością nieba', () => {
    const small = { ...DEFAULT_OPTICS, aperture: 50 };
    const big = { ...DEFAULT_OPTICS, aperture: 200 };

    assert.ok(limitingMagnitude(big, 4) > limitingMagnitude(small, 4));
    assert.ok(limitingMagnitude(small, 8) < limitingMagnitude(small, 2));
  });

  it('70 mm pod niebem Bortle 1 sięga około 11,9 mag', () => {
    assert.ok(Math.abs(limitingMagnitude(DEFAULT_OPTICS, 1) - 11.92) < 0.01);
  });

  it('każdy stopień Bortle kosztuje 0,4 mag', () => {
    const difference = limitingMagnitude(DEFAULT_OPTICS, 4) - limitingMagnitude(DEFAULT_OPTICS, 5);
    assert.ok(Math.abs(difference - 0.4) < 1e-9);
  });

  it('jasność powierzchniowa rozlanego obiektu jest znacznie słabsza od katalogowej', () => {
    // M31: 3,4 mag rozlane na 178 minut kątowych.
    const surface = surfaceBrightness(3.4, 178);
    assert.ok(surface > 20, `jasność powierzchniowa ${surface.toFixed(1)} mag/arcsec²`);
  });

  it('większa apertura podnosi próg jasności powierzchniowej', () => {
    const small = surfaceBrightnessLimit({ ...DEFAULT_OPTICS, aperture: 50 }, 4);
    const big = surfaceBrightnessLimit({ ...DEFAULT_OPTICS, aperture: 200 }, 4);
    assert.ok(big > small);
  });

  it('minimalny rozmiar kątowy maleje z powiększeniem', () => {
    assert.equal(minimumAngularSize({ ...DEFAULT_OPTICS, magnification: 10 }), 0.2);
    assert.ok(
      minimumAngularSize({ ...DEFAULT_OPTICS, magnification: 50 }) <
        minimumAngularSize({ ...DEFAULT_OPTICS, magnification: 10 }),
    );
  });
});

describe('etykieta zestawu', () => {
  it('opis z liczb, gdy nazwy nie ma', () => {
    assert.equal(describeOptics(DEFAULT_OPTICS), '15x70, statyw');
    assert.equal(profileLabel({ id: 'a', label: '   ', optics: DEFAULT_OPTICS }), '15x70, statyw');
  });

  it('nadana nazwa wygrywa', () => {
    assert.equal(
      profileLabel({ id: 'a', label: 'Newton 8"', optics: DEFAULT_OPTICS }),
      'Newton 8"',
    );
  });
});

describe('windLimitKmh', () => {
  it('sprzęt z ręki dostaje niższy próg niż na statywie', () => {
    const limits = { tripod: 25, handheld: 15 };
    assert.equal(windLimitKmh({ ...DEFAULT_OPTICS, mount: 'tripod' }, limits), 25);
    assert.equal(windLimitKmh({ ...DEFAULT_OPTICS, mount: 'handheld' }, limits), 15);
  });
});

describe('clampConfig', () => {
  it('nie pozwala, by minimum sesji przekroczyło maksimum', () => {
    const config = clone(DEFAULT_CONFIG);
    config.session.minDurationHours = 8;
    config.session.maxDurationHours = 2;

    const clamped = clampConfig(config);
    assert.ok(clamped.session.maxDurationHours >= clamped.session.minDurationHours);
  });

  it('godzina „tylko dom" nie wypada przed godziną odrzucenia', () => {
    const config = clone(DEFAULT_CONFIG);
    config.calendar.rejectBeforeHour = 11;
    config.calendar.homeOnlyBeforeHour = 6;

    const clamped = clampConfig(config);
    assert.equal(clamped.calendar.homeOnlyBeforeHour, 11);
  });

  it('lista zestawów nigdy nie jest pusta', () => {
    const config = clone(DEFAULT_CONFIG);
    config.opticsProfiles = [];

    assert.equal(clampConfig(config).opticsProfiles.length, 1);
  });

  it('wpis, który nie jest obiektem, jest pomijany, a zepsute liczby przycinane', () => {
    const config = clone(DEFAULT_CONFIG);
    config.opticsProfiles = [
      null as never,
      'lornetka' as never,
      { id: 'x', label: 'Wielkie', optics: { ...DEFAULT_OPTICS, aperture: 9999 } },
    ];

    const profiles = clampConfig(config).opticsProfiles;
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].optics.aperture, OPTICS_LIMITS.aperture.max);
  });

  it('zestaw bez identyfikatora dostaje wygenerowany', () => {
    const config = clone(DEFAULT_CONFIG);
    config.opticsProfiles = [{ id: '', label: '', optics: DEFAULT_OPTICS }];

    assert.ok(clampConfig(config).opticsProfiles[0].id.length > 0);
  });
});

describe('katalog miejscówek', () => {
  it('domyślna konfiguracja niesie katalog z rozpoznania', () => {
    assert.ok(DEFAULT_CONFIG.sites.length >= 5);
    for (const site of DEFAULT_CONFIG.sites) {
      assert.ok(site.id.length > 0);
      assert.ok(site.name.length > 0);
      assert.ok(site.bortle >= 1 && site.bortle <= 9);
      assert.ok(site.walkMinutes >= 0);
    }
  });

  it('wpis bez współrzędnych jest pomijany — nie ma dla czego liczyć pogody', () => {
    const config = clone(DEFAULT_CONFIG);
    config.sites = [
      null as never,
      {
        id: 'x',
        name: 'Bez punktu',
        region: '',
        lat: NaN,
        lon: 19,
        bortle: 4,
        walkMinutes: 0,
        notes: '',
        accuracyM: null,
        horizonMask: null,
        horizonOverrides: [],
      },
      {
        id: 'ok',
        name: 'Dobra',
        region: 'śląskie',
        lat: 50,
        lon: 19,
        bortle: 4,
        walkMinutes: 5,
        notes: '',
        accuracyM: null,
        horizonMask: null,
        horizonOverrides: [],
      },
    ];

    const sites = clampConfig(config).sites;
    assert.equal(sites.length, 1);
    assert.equal(sites[0].id, 'ok');
  });

  it('przycina Bortle i marsz do sensownego zakresu', () => {
    const config = clone(DEFAULT_CONFIG);
    config.sites = [
      {
        id: 'x',
        name: 'Dziwna',
        region: '',
        lat: 50,
        lon: 19,
        bortle: 42,
        walkMinutes: 9999,
        notes: '',
        accuracyM: null,
        horizonMask: null,
        horizonOverrides: [],
      },
    ];

    const site = clampConfig(config).sites[0];
    assert.equal(site.bortle, 9);
    assert.equal(site.walkMinutes, 240);
  });

  it('pusta lista zostaje pusta — brak własnych miejscówek to normalny stan', () => {
    const config = clone(DEFAULT_CONFIG);
    config.sites = [];
    assert.deepEqual(clampConfig(config).sites, []);
  });

  it('zapis sprzed katalogu dostaje listę domyślną', () => {
    const merged = mergeConfig({ observer: { minSleepHours: 7 } });
    assert.deepEqual(merged.sites, DEFAULT_CONFIG.sites);
  });

  it('dokładność pomiaru przechodzi przez walidację, a jej brak zostaje brakiem', () => {
    const config = clone(DEFAULT_CONFIG);
    config.sites = [
      {
        id: 'a',
        name: 'Zmierzone',
        region: '',
        lat: 50,
        lon: 19,
        bortle: 4,
        walkMinutes: 0,
        notes: '',
        accuracyM: 12.4,
        horizonMask: null,
        horizonOverrides: [],
      },
      {
        id: 'b',
        name: 'Z mapy',
        region: '',
        lat: 50,
        lon: 19,
        bortle: 4,
        walkMinutes: 0,
        notes: '',
        accuracyM: null,
        horizonMask: null,
        horizonOverrides: [],
      },
      // Zero metrów to nie to samo co brak pomiaru — wartość spoza zakresu
      // wraca do granicy, ale niebędąca liczbą zostaje pustką.
      {
        id: 'c',
        name: 'Bzdura',
        region: '',
        lat: 50,
        lon: 19,
        bortle: 4,
        walkMinutes: 0,
        notes: '',
        accuracyM: 'dużo' as never,
        horizonMask: null,
        horizonOverrides: [],
      },
    ];

    const sites = clampConfig(config).sites;
    assert.equal(sites[0].accuracyM, 12.4);
    assert.equal(sites[1].accuracyM, null);
    assert.equal(sites[2].accuracyM, null);
  });

  it('dokładność spoza zakresu jest przycinana', () => {
    const config = clone(DEFAULT_CONFIG);
    config.sites = [
      {
        id: 'a',
        name: 'Fatalny fix',
        region: '',
        lat: 50,
        lon: 19,
        bortle: 4,
        walkMinutes: 0,
        notes: '',
        accuracyM: 999999,
        horizonMask: null,
        horizonOverrides: [],
      },
    ];

    assert.equal(clampConfig(config).sites[0].accuracyM, 10000);
  });

  it('zapisany katalog wygrywa z domyślnym, łącznie z notatkami', () => {
    const merged = mergeConfig({
      sites: [
        {
          id: 'mine',
          name: 'Moja łąka',
          region: 'śląskie',
          lat: 50.1,
          lon: 19.1,
          bortle: 4,
          walkMinutes: 3,
          notes: 'brama od wschodu',
          accuracyM: null,
          horizonMask: null,
          horizonOverrides: [],
        },
      ],
    });

    assert.equal(merged.sites.length, 1);
    assert.equal(merged.sites[0].notes, 'brama od wschodu');
  });
});

describe('mergeConfig', () => {
  it('zapis pusty albo niebędący obiektem daje konfigurację domyślną', () => {
    assert.deepEqual(mergeConfig(null), DEFAULT_CONFIG);
    assert.deepEqual(mergeConfig('coś'), DEFAULT_CONFIG);
  });

  it('uzupełnia brakujące pola sekcji wartościami domyślnymi', () => {
    const merged = mergeConfig({ observer: { minSleepHours: 7 } });

    assert.equal(merged.observer.minSleepHours, 7);
    assert.equal(merged.observer.packUpMin, DEFAULT_CONFIG.observer.packUpMin);
    assert.deepEqual(merged.conditions, DEFAULT_CONFIG.conditions);
  });

  it('zapis z pojedynczą optyką staje się jednoelementową listą zestawów', () => {
    const merged = mergeConfig({
      optics: { aperture: 200, magnification: 48, fieldOfView: 1.2, mount: 'handheld' },
    });

    assert.equal(merged.opticsProfiles.length, 1);
    assert.equal(merged.opticsProfiles[0].optics.aperture, 200);
    assert.equal(merged.opticsProfiles[0].optics.mount, 'handheld');
    assert.ok(merged.opticsProfiles[0].id.length > 0);
  });

  it('nazwa zestawu nie wpływa na żaden rachunek', () => {
    const optics = { ...DEFAULT_OPTICS, aperture: 120 };
    const named = mergeConfig({ opticsProfiles: [{ id: 'a', label: 'Duża', optics }] });
    const anonymous = mergeConfig({ opticsProfiles: [{ id: 'a', label: '', optics }] });

    assert.deepEqual(named.opticsProfiles[0].optics, anonymous.opticsProfiles[0].optics);
  });

  it('wartość spoza zakresu w zapisie jest przycinana przy wczytaniu', () => {
    const merged = mergeConfig({ conditions: { maxCloudTotal: 900, minWindowMinutes: 1 } });

    assert.equal(merged.conditions.maxCloudTotal, 100);
    assert.equal(merged.conditions.minWindowMinutes, 15);
  });
});
