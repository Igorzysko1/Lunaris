/**
 * Ocena seeingu.
 *
 * Seeing jest jedyną wielkością w tej aplikacji, która nie mówi „czy widać",
 * tylko „jak ostro" — i jedyną, która celowo nie wpływa na werdykt. Testy
 * pilnują, żeby tak zostało, oraz żeby ocena reagowała na to, co ją faktycznie
 * napędza, a nie na wszystko naraz.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeSeeing, lapseRate, seeingAt, seeingOver } from '../src/lib/seeing.ts';
import type { NightHour } from '../src/lib/weather.ts';

/** Godzina spokojnej, bezchmurnej nocy: nic nie miesza powietrza. */
function calm(over: Partial<NightHour> = {}): NightHour {
  return {
    at: new Date(2026, 0, 16, 22, 0),
    cloud: 0,
    cloudLow: 0,
    cloudMid: 0,
    cloudHigh: 0,
    humidity: 60,
    temperature: 2,
    dewSpread: 5,
    precipitation: 0,
    windGust: 8,
    windSpeed: 5,
    windJet: 20,
    windMid: 20,
    temp850: 0,
    temp500: -20,
    cape: 0,
    boundaryLayerM: 60,
    ...over,
  };
}

describe('seeingAt', () => {
  it('spokojna atmosfera daje najwyższą ocenę bez wskazywania winnego', () => {
    const seeing = seeingAt(calm());

    assert.equal(seeing.index, 5);
    assert.equal(seeing.driver, 'none');
  });

  it('prąd strumieniowy psuje obraz i jest nazwany po imieniu', () => {
    // 130 km/h na 250 hPa to typowa zima nad Polską — noc bywa bez chmur,
    // a obraz i tak drga.
    const seeing = seeingAt(calm({ windJet: 130 }));

    assert.ok(seeing.index <= 3);
    assert.equal(seeing.driver, 'jet');
    assert.match(describeSeeing(seeing), /strumieniowy/);
  });

  it('im szybszy prąd, tym gorzej — bez skoków w drugą stronę', () => {
    const indices = [20, 50, 80, 120, 200].map((windJet) => seeingAt(calm({ windJet })).index);

    for (let i = 1; i < indices.length; i++) {
      assert.ok(indices[i] <= indices[i - 1], `${indices}`);
    }
  });

  it('konwekcja liczy się nawet przy spokojnym wietrze na górze', () => {
    // Stromy gradient: powietrze przelewa się w pionie samo z siebie.
    const seeing = seeingAt(calm({ temp850: 10, temp500: -30, cape: 400 }));

    assert.equal(seeing.driver, 'convection');
    assert.ok(seeing.index < 5);
  });

  it('gruba warstwa graniczna w nocy to turbulencja tuż nad głową', () => {
    const seeing = seeingAt(calm({ boundaryLayerM: 800 }));

    assert.equal(seeing.driver, 'ground');
    assert.match(describeSeeing(seeing), /gruntem/);
  });

  it('ocena nie wychodzi poza skalę, choćby wszystko było przeciwko', () => {
    const awful = seeingAt(
      calm({
        windJet: 250,
        windMid: 120,
        temp850: 15,
        temp500: -35,
        cape: 2000,
        boundaryLayerM: 1500,
      }),
    );

    assert.equal(awful.index, 1);
    assert.ok(awful.usableMagnification > 0);
  });

  it('zachmurzenie nie ma na seeing wpływu', () => {
    // Przejrzystość i spokój to dwie różne rzeczy: noc bez chmur potrafi
    // drgać, a lekka mgiełka bywa nocą, w której Jowisz stoi jak wykuty.
    const clear = seeingAt(calm({ cloud: 0 }));
    const overcast = seeingAt(calm({ cloud: 100, cloudLow: 100 }));

    assert.deepEqual(clear, overcast);
  });

  it('ocena poniżej maksimum nie nazywa atmosfery spokojną', () => {
    // Kilka drobnych przyczyn naraz nie daje żadnego wyraźnego winnego, ale
    // ocena i tak spada — opis nie może wtedy przeczyć liczbie obok.
    const seeing = seeingAt(calm({ windJet: 45, temp850: 6, temp500: -24, boundaryLayerM: 300 }));

    assert.ok(seeing.index < 5);
    assert.doesNotMatch(describeSeeing(seeing), /spokojna/);
  });
});

describe('lapseRate', () => {
  it('liczy gradient w kelwinach na kilometr', () => {
    // 20 K różnicy na czterech kilometrach to 5 K/km.
    assert.equal(lapseRate(calm({ temp850: 0, temp500: -20 })), 5);
  });
});

describe('seeingOver', () => {
  it('bez godzin nie zmyśla oceny', () => {
    assert.equal(seeingOver([]), null);
  });

  it('jedna zła godzina nie przekreśla spokojnej nocy', () => {
    const hours = [calm(), calm(), calm({ windJet: 200 }), calm(), calm()];

    assert.equal(seeingOver(hours)?.index, 5);
  });

  it('kilka spokojnych godzin nie zamaskuje nocy, która w większości się gotuje', () => {
    const hours = [calm(), calm({ windJet: 200 }), calm({ windJet: 200 }), calm({ windJet: 200 })];

    assert.ok((seeingOver(hours)?.index ?? 5) <= 2);
  });
});
