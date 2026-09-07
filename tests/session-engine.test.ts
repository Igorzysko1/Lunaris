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

/** Zjawisko, które w tym miesiącu się nie powtórzy — łamie regułę poranka. */
const UNIQUE_EVENT = {
  id: 'eclipse-test',
  title: 'Zaćmienie testowe',
  at: new Date(2026, 0, 15, 22, 0),
  unique: true,
};

/**
 * Prawdziwa styczniowa noc: 18:00 → 06:00, dwanaście godzin ciemności.
 *
 * To ona wywołała całą zmianę. Przy sześciogodzinnej nocy reguła snu nigdy nie
 * wiąże — pobudka wypada długo po jej końcu — więc na krótkiej fikstury nie da
 * się sprawdzić tego, co w terenie decyduje o werdykcie.
 */
const LONG_NIGHT = { from: new Date(2026, 0, 15, 18, 0), to: new Date(2026, 0, 16, 6, 0) };

function longHours(): NightHour[] {
  return Array.from({ length: 13 }, (_, i) =>
    hour(new Date(LONG_NIGHT.from.getTime() + i * 3_600_000)),
  );
}

/** Zimowa noc bez własnego limitu długości — wtedy o końcu sesji decyduje sen. */
function sleepBound(over: Partial<NightInput> = {}): NightInput {
  const config = configWith();
  config.session.maxDurationMinutes = 720;

  return input({
    night: LONG_NIGHT,
    hours: longHours(),
    config,
    nextDay: { firstEventAt: new Date(2026, 0, 16, 8, 0), dayOff: false },
    ...over,
  });
}

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
    windJet: 20,
    windMid: 20,
    temp850: 0,
    temp500: -20,
    cape: 0,
    boundaryLayerM: 60,
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
    events: [],
    // Ocena poniżej progu wyjątku: domyślnie noc podlega skracaniu dla snu.
    rating: 50,
    windLimitKmh: DEFAULT_CONFIG.conditions.maxWindGustKmh,
    walkMinutes: 0,
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
  it('czysta noc z zapasem snu daje wyjazd, przycięty do limitu długości', () => {
    const verdict = evaluateNight(input());

    assert.equal(verdict.status, 'go');
    assert.equal(verdict.rejection, null);
    // Pogoda pozwala na 6 h, ale własny limit sesji to 5 h — okno jest
    // skracane, a nie unieważniane, i użytkownik o tym wie.
    assert.equal(verdict.window?.durationMinutes, 300);
    assert.ok(
      verdict.warnings.some((w) => w.kind === 'session-trimmed' && w.reason === 'max-duration'),
    );
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
    const verdict = evaluateNight(
      input({ hours: hours((i) => (i === 5 ? { dewSpread: 1 } : {})) }),
    );

    assert.equal(verdict.status, 'go');
    assert.ok(verdict.warnings.some((w) => w.kind === 'dew' && w.minSpreadC === 1));
  });

  it('jasny Księżyc nad horyzontem zawęża cele, ale nie unieważnia nocy', () => {
    const verdict = evaluateNight(input({ moon: { illumination: 80, upAt: () => true } }));

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

  it('marsz od parkingu powyżej tolerancji daje ostrzeżenie', () => {
    const verdict = evaluateNight(input({ walkMinutes: 45 }));

    assert.equal(verdict.status, 'go');
    assert.ok(verdict.warnings.some((w) => w.kind === 'walk-too-long' && w.walkMinutes === 45));
  });

  it('marsz w granicach tolerancji przechodzi bez słowa', () => {
    const tolerance = DEFAULT_CONFIG.observer.walkToleranceMin;
    const verdict = evaluateNight(input({ walkMinutes: tolerance }));

    assert.ok(!verdict.warnings.some((w) => w.kind === 'walk-too-long'));
  });
});

describe('evaluateNight — zjawiska w sesji', () => {
  const event = (at: Date, unique = false) => ({
    id: 'conj',
    title: 'Koniunkcja Księżyca i Jowisza',
    at,
    unique,
  });

  it('zjawisko w trakcie sesji jest wymienione z godziną', () => {
    // 23:30 wieczorem tej samej doby, w której noc się zaczyna.
    const verdict = evaluateNight(sleepBound({ events: [event(new Date(2026, 0, 15, 23, 30))] }));

    const mention = verdict.warnings.find((w) => w.kind === 'event-in-window');
    assert.ok(mention, 'brak wzmianki o zjawisku w oknie');
  });

  it('zjawisko tuż za końcem sesji przeciąga ją do siebie', () => {
    // Przypadek z terenu: sesja kończy się o 4:00, koniunkcja wypada o 4:08.
    // Granica sesji jest umowna, godzina koniunkcji nie.
    const withoutEvent = evaluateNight(sleepBound());
    const end = withoutEvent.window!.to;
    const justAfter = new Date(end.getTime() + 8 * 60_000);

    const verdict = evaluateNight(
      sleepBound({ events: [{ id: 'c', title: 'Koniunkcja', at: justAfter, unique: false }] }),
    );

    assert.ok(verdict.window!.to > end, 'sesja nie została przedłużona');
    assert.ok(verdict.window!.to >= justAfter, 'przedłużenie nie sięga zjawiska');
    assert.ok(verdict.warnings.some((w) => w.kind === 'session-stretched'));
  });

  it('przedłużenie nie wychodzi poza pogodę i ciemność', () => {
    // Zjawisko po końcu bloku dobrych godzin: przeciąganie tam niczego nie da.
    const beyond = new Date(LONG_NIGHT.to.getTime() + 30 * 60_000);

    const verdict = evaluateNight(
      sleepBound({ events: [{ id: 'c', title: 'Koniunkcja', at: beyond, unique: false }] }),
    );

    assert.ok(verdict.window!.to <= LONG_NIGHT.to);
    assert.ok(!verdict.warnings.some((w) => w.kind === 'session-stretched'));
  });

  it('zjawiska poza zasięgiem przedłużenia nie milczą, tylko są wymienione', () => {
    // Milczenie byłoby najgorsze: sprzęt spakowany kwadrans przed koniunkcją.
    const config = configWith();
    config.session.maxDurationMinutes = 180;

    const verdict = evaluateNight(
      sleepBound({
        config,
        events: [
          { id: 'c', title: 'Koniunkcja', at: new Date(2026, 0, 15, 22, 30), unique: false },
        ],
      }),
    );

    const mentioned = verdict.warnings.some(
      (w) => w.kind === 'event-in-window' || w.kind === 'event-after-window',
    );
    assert.ok(mentioned, 'zjawisko przepadło bez słowa');
  });

  it('zjawisko niewidoczne w oknie nocy nie przedłuża niczego', () => {
    const verdict = evaluateNight(sleepBound({ events: [] }));

    assert.ok(!verdict.warnings.some((w) => w.kind === 'session-stretched'));
    assert.ok(!verdict.warnings.some((w) => w.kind === 'event-in-window'));
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
        events: [UNIQUE_EVENT],
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
        events: [],
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

  it('sen skraca sesję, zamiast przekreślać noc', () => {
    // Dwunastogodzinna styczniowa noc nie mieści się przed pobudką o 7:20.
    // Wcześniej odpadała w całości; teraz jedzie się na krócej — to użytkownik
    // decyduje, kiedy wrócić, a nie pogoda.
    const verdict = evaluateNight(sleepBound());

    assert.equal(verdict.status, 'go');
    assert.ok((verdict.window?.durationMinutes ?? 0) >= DEFAULT_CONFIG.session.minDurationMinutes);
    assert.ok((verdict.plan?.sleepHours ?? 0) >= DEFAULT_CONFIG.observer.minSleepHours);
    assert.ok(verdict.warnings.some((w) => w.kind === 'session-trimmed' && w.reason === 'sleep'));
  });

  it('sesja krótsza od minimum nie jest warta wyjazdu', () => {
    // Pobudka zostawia dwie godziny obserwacji przy minimum trzech — próg
    // z sekcji sesji przestaje być martwą wartością w ustawieniach.
    const verdict = evaluateNight(
      sleepBound({ nextDay: { firstEventAt: new Date(2026, 0, 15, 21, 15), dayOff: false } }),
    );

    assert.equal(verdict.status, 'no-go');
    assert.equal(verdict.rejection?.kind, 'not-enough-sleep');
  });

  it('gdy po przycięciu nie zostaje sensowne okno, powodem jest sen', () => {
    const verdict = evaluateNight(
      input({ nextDay: { firstEventAt: new Date(2026, 0, 15, 23, 30), dayOff: false } }),
    );

    assert.equal(verdict.status, 'no-go');
    assert.equal(verdict.rejection?.kind, 'not-enough-sleep');
  });

  it('noc wybitna nie jest skracana, ale mówi, ile snu kosztuje', () => {
    const verdict = evaluateNight(sleepBound({ rating: 95 }));

    assert.equal(verdict.status, 'go');
    assert.equal(verdict.window?.durationMinutes, 720);
    assert.ok(verdict.warnings.some((w) => w.kind === 'sleep-sacrifice' && w.reason === 'rating'));
    assert.ok(!verdict.warnings.some((w) => w.kind === 'session-trimmed'));
  });

  it('zjawisko nie do powtórzenia też wstrzymuje skracanie', () => {
    const verdict = evaluateNight(sleepBound({ rating: 40, events: [UNIQUE_EVENT] }));

    assert.equal(verdict.window?.durationMinutes, 720);
    assert.ok(
      verdict.warnings.some((w) => w.kind === 'sleep-sacrifice' && w.reason === 'phenomenon'),
    );
  });

  it('próg wyjątku jest konfigurowalny — sto go wyłącza', () => {
    const config = configWith();
    config.session.maxDurationMinutes = 720;
    config.conditions.exceptionalRating = 100;

    const verdict = evaluateNight(sleepBound({ rating: 95, config }));

    assert.ok(verdict.warnings.some((w) => w.kind === 'session-trimmed'));
    assert.ok(!verdict.warnings.some((w) => w.kind === 'sleep-sacrifice'));
  });

  it('sen na styk jest widoczny jako ostrzeżenie', () => {
    // Dzień wolny znosi pobudkę, więc sen liczy się tylko wtedy, gdy kalendarz
    // narzuca godzinę. Tu narzuca ją tak, że po przycięciu sen wypada tuż nad
    // minimum — czyli w paśmie ostrzeżenia.
    const verdict = evaluateNight(
      sleepBound({ nextDay: { firstEventAt: new Date(2026, 0, 16, 12, 30), dayOff: false } }),
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
