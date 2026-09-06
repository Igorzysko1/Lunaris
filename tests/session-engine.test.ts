/**
 * Silnik werdyktu. Testy budują sztuczną prognozę godzina po godzinie, bo
 * chodzi o rozstrzygnięcia, a nie o realizm danych: który próg zadziałał
 * pierwszy i czy powód odrzucenia jest tym, który faktycznie przesądził.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_CONFIG, type LunarisConfig } from '../src/lib/config.ts';
import { evaluateNight, type NightInput } from '../src/lib/session-engine.ts';
import type { NightHour } from '../src/lib/weather.ts';

const KATOWICE = { lat: 50.259, lon: 19.021 };

/** Noc 15/16 stycznia 2026, 18:00 → 00:00. Sześć godzin, siedem próbek. */
const NIGHT = { from: new Date(2026, 0, 15, 18, 0), to: new Date(2026, 0, 16, 0, 0) };

function hour(at: Date, over: Partial<NightHour> = {}): NightHour {
  return {
    at,
    cloud: 0,
    cloudLow: 0,
    cloudHigh: 0,
    humidity: 60,
    temperature: 5,
    dewSpread: 6,
    precipitation: 0,
    windGust: 8,
    ...over,
  };
}

/** Godziny co pełną godzinę w oknie nocy; `shape` nadpisuje wybrane próbki. */
function hours(shape: (index: number) => Partial<NightHour> = () => ({})): NightHour[] {
  return Array.from({ length: 7 }, (_, i) =>
    hour(new Date(NIGHT.from.getTime() + i * 3_600_000), shape(i)),
  );
}

function configWith(patch: Partial<LunarisConfig> = {}): LunarisConfig {
  return { ...structuredClone(DEFAULT_CONFIG), ...patch };
}

function input(over: Partial<NightInput> = {}): NightInput {
  return {
    night: NIGHT,
    hours: hours(),
    moon: { illumination: 5, upAt: () => false },
    target: KATOWICE,
    home: KATOWICE,
    // Pierwsze wydarzenie o 9:00 — sen wychodzi, a reguła „tylko dom" jeszcze działa.
    nextDay: { firstEventAt: new Date(2026, 0, 16, 9, 0), dayOff: false },
    uniquePhenomenon: false,
    windLimitKmh: DEFAULT_CONFIG.conditions.maxWindGustKmh,
    config: configWith(),
    ...over,
  };
}

describe('evaluateNight — brak danych', () => {
  it('pusta prognoza to brak danych, nie zła pogoda', () => {
    const verdict = evaluateNight(input({ hours: [] }));

    assert.equal(verdict.status, 'no-go');
    assert.deepEqual(verdict.rejection, { kind: 'no-forecast' });
  });

  it('godziny spoza okna nocy też są brakiem danych', () => {
    const daytime = [hour(new Date(2026, 0, 15, 12, 0)), hour(new Date(2026, 0, 15, 13, 0))];
    const verdict = evaluateNight(input({ hours: daytime }));

    assert.deepEqual(verdict.rejection, { kind: 'no-forecast' });
  });
});

describe('evaluateNight — warunki', () => {
  it('czysta noc z zapasem snu daje wyjazd', () => {
    const verdict = evaluateNight(input());

    assert.equal(verdict.status, 'go');
    assert.equal(verdict.rejection, null);
    assert.equal(verdict.window?.durationMinutes, 360);
    assert.equal(verdict.plan?.wakeAt?.getHours(), 8);
  });

  it('opad blokuje każdą godzinę', () => {
    const verdict = evaluateNight(input({ hours: hours(() => ({ precipitation: 0.2 })) }));

    assert.equal(verdict.status, 'no-go');
    assert.deepEqual(verdict.rejection, { kind: 'conditions', blocker: 'precipitation' });
  });

  it('chmury niskie blokują, choć zachmurzenie całkowite mieści się w progu', () => {
    const verdict = evaluateNight(input({ hours: hours(() => ({ cloud: 20, cloudLow: 20 })) }));

    assert.deepEqual(verdict.rejection, { kind: 'conditions', blocker: 'cloud-low' });
  });

  it('chmury wysokie są tolerowane powyżej progu całkowitego', () => {
    // 40% cirrusów: całkowite 40% przekracza próg 25%, ale po odjęciu piętra
    // wysokiego zostaje zero — przez cirrusy widać gwiazdy.
    const verdict = evaluateNight(input({ hours: hours(() => ({ cloud: 40, cloudHigh: 40 })) }));

    assert.equal(verdict.status, 'go');
    assert.ok(verdict.warnings.some((w) => w.kind === 'high-clouds' && w.maxPercent === 40));
  });

  it('powyżej własnego progu chmury wysokie jednak blokują', () => {
    const verdict = evaluateNight(input({ hours: hours(() => ({ cloud: 60, cloudHigh: 60 })) }));

    assert.deepEqual(verdict.rejection, { kind: 'conditions', blocker: 'cloud-high' });
  });

  it('wiatr powyżej progu blokuje noc', () => {
    const verdict = evaluateNight(input({ hours: hours(() => ({ windGust: 30 })) }));

    assert.deepEqual(verdict.rejection, { kind: 'conditions', blocker: 'wind' });
  });

  it('okno krótsze od minimum odpada z podaniem, ile dało się uciągnąć', () => {
    // Dobre tylko dwie sąsiednie godziny — 60 minut przy progu 90.
    const verdict = evaluateNight(
      input({ hours: hours((i) => (i === 2 || i === 3 ? {} : { precipitation: 1 })) }),
    );

    assert.deepEqual(verdict.rejection, { kind: 'window-too-short', longestMinutes: 60 });
  });

  it('bierze najdłuższy ciągły blok, nie sumę dobrych godzin', () => {
    const verdict = evaluateNight(
      input({ hours: hours((i) => (i === 3 ? { cloudLow: 90, cloud: 90 } : {})) }),
    );

    assert.equal(verdict.status, 'go');
    // Blok 18–20 i blok 22–00 mają po dwie godziny; zwycięża wcześniejszy,
    // a nie suma czterech dobrych godzin.
    assert.equal(verdict.window?.durationMinutes, 120);
    assert.equal(verdict.window?.from.getHours(), 18);
  });
});

describe('evaluateNight — ostrzeżenia', () => {
  it('ostrzega o rosie, gdy spread schodzi poniżej progu', () => {
    const verdict = evaluateNight(input({ hours: hours((i) => (i === 5 ? { dewSpread: 1 } : {})) }));

    assert.equal(verdict.status, 'go');
    assert.ok(verdict.warnings.some((w) => w.kind === 'dew' && w.minSpreadC === 1));
  });

  it('jasny Księżyc nad horyzontem zawęża cele, ale nie unieważnia nocy', () => {
    const verdict = evaluateNight(
      input({ moon: { illumination: 80, upAt: () => true } }),
    );

    assert.equal(verdict.status, 'go');
    assert.equal(verdict.window?.moonLimited, true);
    assert.ok(verdict.warnings.some((w) => w.kind === 'moon'));
  });

  it('jasny Księżyc pod horyzontem nie przeszkadza', () => {
    const verdict = evaluateNight(input({ moon: { illumination: 80, upAt: () => false } }));

    assert.equal(verdict.window?.moonLimited, false);
    assert.ok(!verdict.warnings.some((w) => w.kind === 'moon'));
  });

  it('wiatr w granicach statywu, ale nie ręki, daje ostrzeżenie zamiast odrzucenia', () => {
    const verdict = evaluateNight(input({ hours: hours(() => ({ windGust: 20 })) }));

    assert.equal(verdict.status, 'go');
    assert.ok(
      verdict.warnings.some(
        (w) => w.kind === 'handheld-wind' && w.maxGustKmh === 20 && w.handheldLimitKmh === 15,
      ),
    );
  });

  it('gdy wszystkie zestawy stoją na statywie, wiatru z ręki nie komentujemy', () => {
    const config = configWith();
    config.conditions.maxWindGustHandheldKmh = config.conditions.maxWindGustKmh;

    const verdict = evaluateNight(input({ config, hours: hours(() => ({ windGust: 20 })) }));

    assert.ok(!verdict.warnings.some((w) => w.kind === 'handheld-wind'));
  });

  it('wczesny poranek zostawia ostrzeżenie „tylko dom"', () => {
    const verdict = evaluateNight(input());
    assert.ok(verdict.warnings.some((w) => w.kind === 'home-only'));
  });
});

describe('evaluateNight — kalendarz i sen', () => {
  it('wydarzenie przed godziną odrzucenia przekreśla wyjazd', () => {
    const verdict = evaluateNight(
      input({ nextDay: { firstEventAt: new Date(2026, 0, 16, 7, 0), dayOff: false } }),
    );

    assert.equal(verdict.status, 'no-go');
    assert.equal(verdict.rejection?.kind, 'early-calendar');
    // Okno i plan zostają — użytkownik ma zobaczyć, co traci.
    assert.ok(verdict.window);
    assert.ok(verdict.plan);
  });

  it('noc wybitna łamie regułę wczesnego poranka', () => {
    const verdict = evaluateNight(
      input({
        nextDay: { firstEventAt: new Date(2026, 0, 16, 7, 0), dayOff: false },
        uniquePhenomenon: true,
      }),
    );

    assert.equal(verdict.status, 'go');
  });

  it('sama czysta pogoda nie czyni nocy wybitną', () => {
    // Bez niepowtarzalnego zjawiska reguła kalendarzowa zostaje w mocy —
    // inaczej łamałaby ją każda bezksiężycowa noc.
    const verdict = evaluateNight(
      input({
        nextDay: { firstEventAt: new Date(2026, 0, 16, 7, 0), dayOff: false },
        uniquePhenomenon: false,
      }),
    );

    assert.equal(verdict.rejection?.kind, 'early-calendar');
  });

  it('dzień wolny znosi regułę godzin', () => {
    const verdict = evaluateNight(
      input({ nextDay: { firstEventAt: new Date(2026, 0, 16, 7, 0), dayOff: true } }),
    );

    assert.equal(verdict.status, 'go');
  });

  it('za mało snu przekreśla wyjazd nawet w dzień wolny', () => {
    const verdict = evaluateNight(
      input({ nextDay: { firstEventAt: new Date(2026, 0, 16, 4, 0), dayOff: true } }),
    );

    assert.equal(verdict.status, 'no-go');
    assert.equal(verdict.rejection?.kind, 'not-enough-sleep');
  });

  it('sen na styk jest widoczny jako ostrzeżenie', () => {
    // Powrót 00:15, pobudka 5:35 → 5 h 20 min: powyżej minimum 5,5 h? nie,
    // dlatego bierzemy 6:05 → 5 h 50 min, czyli w paśmie ostrzeżenia.
    const verdict = evaluateNight(
      input({ nextDay: { firstEventAt: new Date(2026, 0, 16, 6, 45), dayOff: true } }),
    );

    assert.equal(verdict.status, 'go');
    assert.ok(verdict.warnings.some((w) => w.kind === 'tight-sleep'));
  });

  it('nocleg w terenie w ogóle nie liczy snu', () => {
    const config = configWith();
    config.session.overnight = true;

    const verdict = evaluateNight(
      input({ config, nextDay: { firstEventAt: new Date(2026, 0, 16, 4, 0), dayOff: true } }),
    );

    assert.equal(verdict.status, 'go');
    assert.equal(verdict.plan?.sleepHours, null);
    assert.equal(verdict.plan?.wakeAt, null);
  });

  it('bez punktu startowego dojazd wynosi zero', () => {
    const verdict = evaluateNight(input({ home: null }));

    assert.equal(verdict.plan?.travelMinutes, 0);
    assert.equal(verdict.plan?.departAt.getTime(), NIGHT.from.getTime());
  });

  it('dojazd przesuwa wyjazd i powrót', () => {
    // 50 km w linii prostej przy 50 km/h to godzina drogi w każdą stronę.
    const target = { lat: KATOWICE.lat + 0.45, lon: KATOWICE.lon };
    const verdict = evaluateNight(input({ target }));

    assert.ok(Math.abs(verdict.plan!.travelMinutes - 60) < 3);
    assert.ok(verdict.plan!.departAt < NIGHT.from);
    assert.ok(verdict.plan!.returnAt > NIGHT.to);
  });
});
