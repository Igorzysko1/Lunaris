/**
 * Raport miesięczny.
 *
 * Większość liczb w tym raporcie jest oczywista i psuje się głośno. Dwie nie są
 * i psują się cicho, więc mają tu najwięcej miejsca:
 *
 * - **„pierwszy raz"** liczy się względem całego dziennika, nie względem
 *   miesiąca. Policzone po miesiącu wygląda dobrze i rośnie co miesiąc o te same
 *   obiekty — raport przestaje mierzyć postęp, a zaczyna mierzyć wyjazdy.
 * - **„wciąż nieodhaczone"** odsiewa cele, które w międzyczasie się udały.
 *   Bez tego raport wypomina obiekt stojący już w kolumnie „zobaczone".
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { JOURNAL_VERSION, type Journal, type NightLog } from '../src/lib/journal.ts';
import {
  buildMonthlyReport,
  monthKeyOf,
  monthsInJournal,
  renderMonthlyReport,
} from '../src/lib/monthly-report.ts';
import { targetLabel } from '../src/lib/sky-targets.ts';

const conditions = { bortle: 4, altitude: 50, moonIllumination: 10 };

/** Noc z listą wyników: `'m42'` znaczy trafione, `'!m81'` — nieudane. */
function night(id: string, outcomes: string[], over: Partial<NightLog> = {}): NightLog {
  return {
    id,
    nightFrom: `${id}T20:00:00.000Z`,
    siteId: 'site-bledowska',
    siteName: 'Pustynia Błędowska',
    observations: outcomes.map((entry) => ({
      targetId: entry.replace(/^!/, ''),
      outcome: entry.startsWith('!') ? ('failed' as const) : ('seen' as const),
      conditions,
      profileId: 'binoculars',
    })),
    transparency: null,
    seeing: null,
    note: '',
    savedAt: `${id}T23:00:00.000Z`,
    ...over,
  };
}

const journalOf = (...logs: NightLog[]): Journal => ({ version: JOURNAL_VERSION, logs });

describe('pierwsze razy', () => {
  it('liczą się względem całego dziennika, nie względem miesiąca', () => {
    // Sedno raportu. M42 widziany w marcu nie jest kwietniową nowością, choć
    // w kwietniu też go odhaczono.
    const journal = journalOf(
      night('2026-03-14', ['m42', 'm31']),
      night('2026-04-11', ['m42', 'm13']),
    );

    const april = buildMonthlyReport(journal, '2026-04');

    assert.deepEqual(april.firstTimes, ['m13']);
  });

  it('obiekt widziany dopiero później nie zalicza się wstecz', () => {
    // Porządek ma znaczenie w jedną stronę: marzec nie wie o kwietniu.
    const journal = journalOf(night('2026-03-14', ['m42']), night('2026-04-11', ['m42']));

    assert.deepEqual(buildMonthlyReport(journal, '2026-03').firstTimes, ['m42']);
  });

  it('nieudane podejście nie robi z obiektu pierwszego razu', () => {
    const journal = journalOf(night('2026-04-11', ['!m81', 'm13']));

    assert.deepEqual(buildMonthlyReport(journal, '2026-04').firstTimes, ['m13']);
  });

  it('ten sam obiekt dwa razy w miesiącu liczy się raz', () => {
    const journal = journalOf(night('2026-04-11', ['m13']), night('2026-04-19', ['m13']));

    assert.deepEqual(buildMonthlyReport(journal, '2026-04').firstTimes, ['m13']);
  });
});

describe('wciąż nieodhaczone', () => {
  it('cel, który udał się w kolejnej nocy, wypada z długu', () => {
    const journal = journalOf(night('2026-04-11', ['!m81']), night('2026-04-19', ['m81']));

    assert.deepEqual(buildMonthlyReport(journal, '2026-04').unfinished, []);
  });

  it('cel widziany kiedyś wcześniej też nie jest długiem', () => {
    // Nie wyszło tym razem, ale obiekt jest już zaliczony — to informacja
    // o warunkach tamtej nocy, nie o brakującej pozycji na liście.
    const journal = journalOf(night('2026-03-14', ['m81']), night('2026-04-11', ['!m81']));

    assert.deepEqual(buildMonthlyReport(journal, '2026-04').unfinished, []);
  });

  it('liczy podejścia i porządkuje od najbardziej upartych', () => {
    const journal = journalOf(
      night('2026-04-11', ['!m81', '!m101']),
      night('2026-04-19', ['!m101']),
    );

    assert.deepEqual(buildMonthlyReport(journal, '2026-04').unfinished, [
      { targetId: 'm101', attempts: 2 },
      { targetId: 'm81', attempts: 1 },
    ]);
  });
});

describe('zestawienie miesiąca', () => {
  it('liczy noce, podejścia i skuteczność', () => {
    const journal = journalOf(night('2026-04-11', ['m13', '!m81']), night('2026-04-19', ['m42']));

    const report = buildMonthlyReport(journal, '2026-04');

    assert.equal(report.nightsOut, 2);
    assert.deepEqual(report.observations, { attempted: 3, seen: 2, failed: 1 });
  });

  it('noce spoza miesiąca nie wchodzą do zestawienia', () => {
    const journal = journalOf(night('2026-03-31', ['m1']), night('2026-04-01', ['m2']));

    assert.equal(buildMonthlyReport(journal, '2026-04').nightsOut, 1);
  });

  it('brak ocen daje null, a nie zero', () => {
    // Zero znaczyłoby „niebo do niczego", a nie „nie oceniłem" — to dwie różne
    // informacje i mylenie ich zafałszowałoby średnią sezonu.
    const journal = journalOf(night('2026-04-11', ['m13']));

    assert.deepEqual(buildMonthlyReport(journal, '2026-04').averages, {
      transparency: null,
      seeing: null,
    });
  });

  it('średnie pomijają noce bez oceny', () => {
    const journal = journalOf(
      night('2026-04-11', ['m13'], { transparency: 4 }),
      night('2026-04-19', ['m42'], { transparency: 5 }),
      night('2026-04-25', ['m31']),
    );

    assert.equal(buildMonthlyReport(journal, '2026-04').averages.transparency, 4.5);
  });

  it('najlepsza noc to ta z największą liczbą trafień', () => {
    const journal = journalOf(
      night('2026-04-11', ['m13']),
      night('2026-04-19', ['m42', 'm31', '!m81']),
    );

    assert.equal(buildMonthlyReport(journal, '2026-04').bestNight?.id, '2026-04-19');
    assert.equal(buildMonthlyReport(journal, '2026-04').bestNight?.seen, 2);
  });

  it('noc bez trafień nie może być najlepsza', () => {
    const journal = journalOf(night('2026-04-11', ['!m81']));

    assert.equal(buildMonthlyReport(journal, '2026-04').bestNight, null);
  });

  it('grupuje noce po miejscówkach', () => {
    const journal = journalOf(
      night('2026-04-11', ['m13']),
      night('2026-04-19', ['m42'], { siteId: 'site-zborow', siteName: 'Góra Zborów' }),
      night('2026-04-25', ['m31'], { siteId: 'site-zborow', siteName: 'Góra Zborów' }),
    );

    assert.deepEqual(
      buildMonthlyReport(journal, '2026-04').sites.map((s) => [s.siteName, s.nights]),
      [
        ['Góra Zborów', 2],
        ['Pustynia Błędowska', 1],
      ],
    );
  });

  it('pusty miesiąc daje raport, a nie wyjątek', () => {
    const report = buildMonthlyReport(journalOf(), '2026-04');

    assert.equal(report.nightsOut, 0);
    assert.equal(report.bestNight, null);
    assert.deepEqual(report.firstTimes, []);
  });
});

describe('render', () => {
  it('pusty miesiąc mówi to wprost, bez tabelek', () => {
    const text = renderMonthlyReport(buildMonthlyReport(journalOf(), '2026-04'));

    assert.match(text, /Ani jednej zapisanej nocy/);
    assert.doesNotMatch(text, /Pierwszy raz/);
  });

  it('niesie liczby i sekcje, gdy jest z czego', () => {
    const journal = journalOf(
      night('2026-03-14', ['m42']),
      night('2026-04-11', ['m13', '!m101'], {
        transparency: 4,
        seeing: 3,
        note: 'Mgła po drugiej.',
      }),
      night('2026-04-19', ['m42', 'm31'], { siteId: 'site-zborow', siteName: 'Góra Zborów' }),
    );

    const text = renderMonthlyReport(buildMonthlyReport(journal, '2026-04'));

    assert.match(text, /# Raport — kwiecień 2026/);
    assert.match(text, /Nocy w terenie: 2\./);
    // M42 widziany w marcu — w kwietniu nowe są tylko m13 i m31.
    assert.match(text, /## Pierwszy raz \(2\)/);
    assert.match(text, /## Wciąż nieodhaczone/);
    assert.ok(text.includes(`${targetLabel('m101')}: 1 podejście`), text);
    assert.match(text, /## Miejscówki/);
    assert.match(text, /Mgła po drugiej\./);
  });

  it('wypisuje nazwy obiektów, nie klucze z dziennika', () => {
    // Dziennik pamięta `m57`, bo klucz musi być niezmienny latami. Raport czyta
    // człowiek raz na miesiąc i po pół roku sam klucz nic mu nie mówi.
    const journal = journalOf(night('2026-04-11', ['m57', '!m101']));

    const text = renderMonthlyReport(buildMonthlyReport(journal, '2026-04'));

    assert.match(text, /M57/);
    assert.doesNotMatch(text, /^- m57$/m);
  });

  it('nieznany identyfikator wraca surowy, zamiast znikać', () => {
    // Katalog bywa przycinany — zapis sprzed roku ma się nadal czytać.
    const journal = journalOf(night('2026-04-11', ['obiekt-spoza-katalogu']));

    assert.match(
      renderMonthlyReport(buildMonthlyReport(journal, '2026-04')),
      /obiekt-spoza-katalogu/,
    );
  });

  it('nie wypisuje miejscówek, gdy była jedna', () => {
    const journal = journalOf(night('2026-04-11', ['m13']));

    assert.doesNotMatch(renderMonthlyReport(buildMonthlyReport(journal, '2026-04')), /Miejscówki/);
  });

  it('odmienia liczebniki', () => {
    // Polskie „2 podejścia" i „5 podejść" — inaczej raport czyta się jak
    // wydruk z bazy danych.
    const journal = journalOf(
      night('2026-04-11', ['!m101', '!m81']),
      night('2026-04-12', ['!m101', '!m81']),
      night('2026-04-13', ['!m101', '!m81']),
      night('2026-04-14', ['!m101', '!m81']),
      night('2026-04-15', ['!m101']),
    );

    const text = renderMonthlyReport(buildMonthlyReport(journal, '2026-04'));

    assert.ok(text.includes(`${targetLabel('m101')}: 5 podejść`), text);
    assert.ok(text.includes(`${targetLabel('m81')}: 4 podejścia`), text);
  });
});

describe('miesiące w dzienniku', () => {
  it('wypisuje je bez powtórzeń, od najnowszego', () => {
    const journal = journalOf(
      night('2026-03-14', ['m42']),
      night('2026-04-11', ['m13']),
      night('2026-04-19', ['m31']),
    );

    assert.deepEqual(monthsInJournal(journal), ['2026-04', '2026-03']);
  });

  it('klucz miesiąca jest lokalny, a nie z UTC', () => {
    // Pierwszy stycznia tuż po północy w Warszawie jest jeszcze 31 grudnia
    // w UTC. Raport ma iść za kalendarzem obserwatora.
    assert.equal(monthKeyOf(new Date(2026, 0, 1, 0, 30)), '2026-01');
    assert.equal(monthKeyOf(new Date(2026, 11, 31, 23, 30)), '2026-12');
  });
});
