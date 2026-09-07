/**
 * Brief z linii poleceń.
 *
 * Dwie rzeczy są tu warte pilnowania. Po pierwsze: brief ma liczyć **tym samym**
 * silnikiem co aplikacja — gdyby miał własny rachunek, po korekcie progu cron
 * wysyłałby co innego, niż pokazuje telefon, i nikt by tego nie zauważył.
 * Po drugie: wynik przechodzi przez granicę procesu, więc musi być czystym
 * JSON-em, bez obiektów `Date`, które po `JSON.stringify` wracają jako napisy
 * i cicho psują odbiorcę.
 *
 * Snapshoty stoją na zamrożonej pogodzie, nie na prawdziwej: inaczej test
 * odpowiadałby na pytanie o dzisiejsze chmury, a nie o zachowanie silnika.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AstroEvent } from '../src/data/events.ts';
import { BRIEF_VERSION, buildBrief, type BriefInput } from '../src/lib/brief.ts';
import { DEFAULT_CONFIG } from '../src/lib/config.ts';
import { planNights } from '../src/lib/night-plan.ts';
import { CLEAR_NIGHT, CLOUDY_NIGHT, THREE_NIGHTS, WINDY_NIGHT } from './fixtures/nights.ts';

const NOW = new Date(2026, 0, 16, 17, 0);

const SITE = {
  id: 'site-bledowska',
  name: 'Pustynia Błędowska',
  lat: 50.35,
  lon: 19.53,
  bortle: 4,
  walkMinutes: 15,
};

const HOME = { lat: 50.2649, lon: 19.0238 };

const EVENTS: AstroEvent[] = [
  {
    id: 'conj-test',
    cat: 'planets',
    type: 'conjunction',
    at: new Date(2026, 0, 16, 22, 30),
    title: 'Koniunkcja testowa',
    desc: '',
    visible: true,
  },
  {
    id: 'eclipse-test',
    cat: 'moon',
    type: 'eclipse',
    at: new Date(2026, 1, 20, 21, 0),
    title: 'Zaćmienie testowe',
    desc: '',
    visible: true,
  },
];

function input(over: Partial<BriefInput> = {}): BriefInput {
  return {
    now: NOW,
    site: SITE,
    home: HOME,
    nights: THREE_NIGHTS,
    events: EVENTS,
    config: DEFAULT_CONFIG,
    leadHours: 6,
    ...over,
  };
}

describe('kontrakt briefu', () => {
  it('jest czystym JSON-em — żadnych obiektów Date', () => {
    // Data przetrwa JSON.stringify jako napis, ale wróci z parse jako napis
    // i każde .getTime() u odbiorcy wywali się dopiero w locie.
    const { brief } = buildBrief(input());

    assert.deepEqual(JSON.parse(JSON.stringify(brief)), brief);
  });

  it('niesie wersję kontraktu', () => {
    assert.equal(buildBrief(input()).brief.version, BRIEF_VERSION);
  });

  it('nagłówek niesie decyzję, a nie liczby', () => {
    const { brief } = buildBrief(input());

    assert.match(brief.summary.headline, /^Dziś można jechać na Pustynia Błędowska, okno /);
  });

  it('bez ani jednej dobrej nocy mówi to wprost', () => {
    const { brief } = buildBrief(input({ nights: [CLOUDY_NIGHT] }));

    assert.equal(brief.summary.go, 0);
    assert.equal(brief.summary.firstGo, null);
    assert.match(brief.summary.headline, /^Brak nocy do wyjazdu/);
  });
});

describe('cele w briefie', () => {
  it('każdy cel niesie komplet pól i jest w zasięgu', () => {
    const { brief } = buildBrief(input({ nights: [CLEAR_NIGHT] }));
    const targets = brief.nights[0].targets;

    assert.ok(targets.length > 0);
    for (const target of targets) {
      assert.equal(typeof target.id, 'string');
      assert.equal(typeof target.name, 'string');
      assert.ok(['planet', 'dso'].includes(target.kind));
      assert.match(target.bestAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.ok(target.maxAltitude > 0);
    }
  });
});

describe('ten sam silnik co aplikacja', () => {
  it('werdykty są identyczne z tymi, które liczy warstwa domenowa', () => {
    // To jest sedno taska: brief nie ma prawa mieć własnego rachunku.
    const planned = planNights({
      nights: THREE_NIGHTS,
      target: { lat: SITE.lat, lon: SITE.lon },
      home: HOME,
      config: DEFAULT_CONFIG,
      bortle: SITE.bortle,
      walkMinutes: SITE.walkMinutes,
    });

    const { brief } = buildBrief(input());

    assert.deepEqual(
      brief.nights.map((n) => n.status),
      planned.map((p) => p.verdict.status),
    );
    assert.deepEqual(
      brief.nights.map((n) => n.window?.durationMinutes ?? null),
      planned.map((p) => p.verdict.window?.durationMinutes ?? null),
    );
  });

  it('zmiana progu zmienia werdykt bez zmiany danych wejściowych', () => {
    // Reguła snu wyłączona po obu stronach, żeby jedyną zmienną był wiatr —
    // inaczej test przechodziłby albo oblewał z zupełnie innego powodu.
    const base = {
      ...DEFAULT_CONFIG,
      observer: { ...DEFAULT_CONFIG.observer, minSleepHours: 0 },
    };
    const tolerant = {
      ...base,
      conditions: { ...base.conditions, maxWindGustKmh: 80 },
    };

    const strictBrief = buildBrief(input({ nights: [WINDY_NIGHT], config: base })).brief;
    assert.equal(strictBrief.nights[0].status, 'no-go');
    assert.deepEqual(strictBrief.nights[0].rejection, { kind: 'conditions', blocker: 'wind' });

    assert.equal(
      buildBrief(input({ nights: [WINDY_NIGHT], config: tolerant })).brief.nights[0].status,
      'go',
    );
  });

  it('pamięć przeglądu wraca z briefu, zamiast być odtwarzana u wywołującego', () => {
    const first = buildBrief(input());
    assert.ok(first.brief.notices.length > 0);

    // Drugi przebieg z tą samą pamięcią milczy — tak jak w aplikacji.
    const second = buildBrief(input({ previousNotices: first.noticeLog }));
    assert.deepEqual(second.brief.notices, []);
  });
});

/**
 * Do snapshotu idzie sama liczba celów, nie ich lista.
 *
 * Cele mają własne testy, a katalog obiektów rośnie niezależnie od silnika:
 * jedna dopisana galaktyka przestawiałaby kilkaset linii snapshotu i diff
 * przestałby cokolwiek pokazywać. Liczba wciąż łapie zmianę doboru, a snapshot
 * zostaje czytelny.
 */
function withoutTargetList(brief: ReturnType<typeof buildBrief>['brief']) {
  return {
    ...brief,
    nights: brief.nights.map((n) => ({ ...n, targets: n.targets.length })),
  };
}

describe('snapshoty zamrożonych zestawów', () => {
  it('noc czysta', (t) => {
    t.assert.snapshot(withoutTargetList(buildBrief(input({ nights: [CLEAR_NIGHT] })).brief));
  });

  it('noc pod chmurami', (t) => {
    t.assert.snapshot(withoutTargetList(buildBrief(input({ nights: [CLOUDY_NIGHT] })).brief));
  });

  it('noc wietrzna', (t) => {
    t.assert.snapshot(withoutTargetList(buildBrief(input({ nights: [WINDY_NIGHT] })).brief));
  });

  it('trzy noce razem', (t) => {
    t.assert.snapshot(withoutTargetList(buildBrief(input()).brief));
  });
});
