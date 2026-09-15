/**
 * Karta nocy: zdanie werdyktu, napis na pasku i żetony.
 *
 * Zdanie stoi pod dużym „JEDŹ" albo „ODPUŚĆ" i jest czytane jako uzasadnienie.
 * Dlatego pilnujemy przede wszystkim, żeby liczby w nim były tymi, na których
 * padł werdykt, i żeby „ani na godzinę" padało wyłącznie wtedy, gdy to prawda.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ratingScore } from '../src/lib/astro.ts';
import { DEFAULT_CONFIG } from '../src/lib/config.ts';
import { describeForecastFailure } from '../src/lib/daily-cycle.ts';
import { formatNightSpan } from '../src/lib/date.ts';
import { nightWindLimit, planNights } from '../src/lib/night-plan.ts';
import { nightBar, positionOnAxis, summarizeNight } from '../src/lib/night-summary.ts';
import {
  describeRejection,
  narrateVerdict,
  nightHeading,
  nightRelative,
  rejectionLabels,
  verdictChips,
  type Narration,
} from '../src/lib/session-text.ts';
import type { NightHour, NightSlice } from '../src/lib/weather.ts';
import { CLEAR_NIGHT, CLOUDY_NIGHT, WINDY_NIGHT } from './fixtures/nights.ts';

const SITE = { lat: 50.35, lon: 19.53 };

const text = (narration: Narration) => narration.map(([part]) => part).join('');

function evaluate(slice: NightSlice) {
  const [planned] = planNights({
    nights: [slice],
    target: SITE,
    home: null,
    config: DEFAULT_CONFIG,
    bortle: 4,
    walkMinutes: 0,
  });
  const summary = summarizeNight({ slice, planned, coords: SITE, config: DEFAULT_CONFIG });
  return { planned, summary };
}

function reshape(slice: NightSlice, shape: (hour: NightHour, index: number) => Partial<NightHour>) {
  return { ...slice, hours: slice.hours.map((hour, i) => ({ ...hour, ...shape(hour, i) })) };
}

describe('noc „jedź"', () => {
  it('mówi o chmurach i Księżycu względem sesji', () => {
    const { planned, summary } = evaluate(CLEAR_NIGHT);

    assert.equal(planned.verdict.status, 'go');
    const sentence = text(narrateVerdict(planned.verdict, summary));
    assert.match(sentence, /^Bez chmur przez całe okno\. Księżyc/);
  });

  it('pogrubia liczby, nie słowa', () => {
    const slice = reshape(CLEAR_NIGHT, (_, i) => ({ cloud: i === 3 ? 4 : 15 }));
    const { planned, summary } = evaluate(slice);

    const narration = narrateVerdict(planned.verdict, summary);
    assert.match(text(narration), /^Czysto przez całe okno — chmury schodzą do 4% około 21:00\./);
    assert.ok(narration.filter(([, strong]) => strong).every(([part]) => /\d/.test(part)));
  });

  it('żetony podają chmury, zimno i rosę', () => {
    const { planned, summary } = evaluate(CLEAR_NIGHT);
    const chips = verdictChips(planned, summary, DEFAULT_CONFIG.conditions.dewWarningSpreadC);
    const labels = chips.map((chip) => chip.label);

    assert.ok(labels.includes('chmury 5%'));
    assert.ok(labels.includes('min. 8,0 °C'));
    assert.ok(labels.includes('rosa 4,0 K'));
    assert.ok(chips.every((chip) => !chip.warn));
  });

  it('rosa poniżej progu dostaje ostrzeżenie', () => {
    const { planned, summary } = evaluate(reshape(CLEAR_NIGHT, () => ({ dewSpread: 1.2 })));
    const dew = verdictChips(planned, summary, 2).find((chip) => chip.label.includes('rosa'));

    assert.deepEqual(dew, { label: '! rosa 1,2 K', warn: true });
  });

  it('pasek mieści okno w nocy, a noc w osi od zachodu do wschodu', () => {
    const { planned, summary } = evaluate(CLEAR_NIGHT);
    const bar = nightBar(summary, planned.verdict.window!);

    assert.ok(bar.darkFrom > 0, 'styczniowy zachód jest przed 18:00');
    assert.ok(bar.darkFrom <= bar.windowFrom);
    assert.ok(bar.windowFrom < bar.windowTo);
    assert.ok(bar.windowTo <= 1);
    assert.match(bar.labels.start, / zachód$/);
    assert.equal(positionOnAxis(summary.axis, new Date(2026, 0, 16, 12, 0)), null);
  });
});

describe('noc „odpuść"', () => {
  it('chmury niskie w każdej godzinie: liczba i próg silnika', () => {
    const { planned, summary } = evaluate(CLOUDY_NIGHT);
    const rejection = planned.verdict.rejection!;

    assert.equal(
      text(narrateVerdict(planned.verdict, summary)),
      'Chmury niskie nie schodzą poniżej 80% ani na godzinę — próg to 10%. Z tej lokalizacji nie ma czego ratować.',
    );
    assert.deepEqual(rejectionLabels(rejection, summary), {
      bar: 'CHMURY NISKIE 80% CAŁĄ NOC',
      meta: 'brak okna',
    });
  });

  it('wiatr podaje próg zestawu, nie stałą', () => {
    const { planned, summary } = evaluate(WINDY_NIGHT);

    assert.equal(
      text(narrateVerdict(planned.verdict, summary)),
      `Porywy nie słabną poniżej 55 km/h ani na godzinę — próg to ${nightWindLimit(DEFAULT_CONFIG)} km/h. Z tej lokalizacji nie ma czego ratować.`,
    );
  });

  it('noc odrzucona z kilku powodów nie udaje jednego', () => {
    const mixed = reshape(CLEAR_NIGHT, (_, i) => (i % 2 ? { cloudLow: 80 } : { windGust: 55 }));
    const { planned, summary } = evaluate(mixed);
    const rejection = planned.verdict.rejection!;

    assert.equal(summary.blocking, null);
    assert.deepEqual(narrateVerdict(planned.verdict, summary), [
      [describeRejection(rejection), false],
    ]);
    assert.match(rejectionLabels(rejection, summary).bar, /^BEZ OKNA · GŁÓWNIE/);
  });

  it('pojedyncze pogodne godziny nie są oknem „0 min"', () => {
    const patchy = reshape(CLEAR_NIGHT, (_, i) => (i % 2 ? { cloudLow: 80 } : {}));
    const { planned, summary } = evaluate(patchy);
    const rejection = planned.verdict.rejection!;

    assert.equal(rejection.kind, 'window-too-short');
    assert.equal(
      text(narrateVerdict(planned.verdict, summary)),
      'Przejaśnia się najwyżej na pojedyncze godziny — za krótko na sesję.',
    );
    assert.deepEqual(rejectionLabels(rejection, summary), {
      bar: 'ZA KRÓTKIE OKNO',
      meta: 'brak okna',
    });
  });

  it('żetony zostają przy tym, co widać bez wyjazdu', () => {
    const { planned, summary } = evaluate(CLOUDY_NIGHT);
    const labels = verdictChips(planned, summary, 2).map((chip) => chip.label);

    assert.equal(labels[0], 'chmury 90%');
    assert.match(labels[1], /^Księżyc \d+%$/);
    assert.equal(labels.length, 2);
  });
});

describe('nazwy nocy', () => {
  // 16 stycznia 2026 to piątek.
  const NOW = new Date(2026, 0, 16, 17, 0);
  const nightOn = (day: number) => ({
    from: new Date(2026, 0, day, 18, 0),
    to: new Date(2026, 0, day + 1, 6, 0),
  });

  it('dziś, jutro, pojutrze, dalej dzień tygodnia', () => {
    assert.equal(nightRelative(nightOn(16), NOW), 'dziś');
    assert.equal(nightRelative(nightOn(17), NOW), 'jutro');
    assert.equal(nightRelative(nightOn(18), NOW), 'pojutrze');
    assert.equal(nightRelative(nightOn(19), NOW), 'poniedziałek');
    assert.equal(nightHeading(nightOn(16), NOW), 'Dziś w nocy');
    assert.equal(nightHeading(nightOn(21), NOW), 'W środę w nocy');
  });

  it('po północy trwająca noc nie jest „dziś"', () => {
    assert.equal(nightRelative(nightOn(16), new Date(2026, 0, 17, 2, 0)), 'ta noc');
    assert.equal(nightRelative(nightOn(17), new Date(2026, 0, 17, 2, 0)), 'dziś');
    assert.equal(nightRelative(nightOn(16), new Date(2026, 0, 17, 9, 0)), 'miniona noc');
  });

  it('noc na przełomie miesiąca nazywa oba', () => {
    assert.equal(
      formatNightSpan(new Date(2026, 8, 14, 21), new Date(2026, 8, 15, 4)),
      '14/15 września',
    );
    assert.equal(
      formatNightSpan(new Date(2026, 8, 30, 21), new Date(2026, 9, 1, 4)),
      '30 września/1 października',
    );
  });
});

describe('ocena i brak prognozy', () => {
  it('skala 1–5 ma progi opisu nocy', () => {
    assert.equal(ratingScore(80), 5);
    assert.equal(ratingScore(79), 4);
    assert.equal(ratingScore(40), 3);
    assert.equal(ratingScore(20), 2);
    assert.equal(ratingScore(0), 1);
  });

  it('bez rodzaju błędu nie obwinia serwisu', () => {
    assert.equal(
      describeForecastFailure(null).message,
      'Nie mam jeszcze prognozy dla tego miejsca.',
    );
    assert.equal(describeForecastFailure('offline').bar, 'Brak sieci');
    assert.doesNotMatch(describeForecastFailure(null).message, /serwis/i);
  });
});
