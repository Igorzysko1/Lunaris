/**
 * Które kalendarze wyznaczają pobudkę.
 *
 * Konto Google ma zwykle kilka kalendarzy, a dotąd liczył się tylko główny —
 * spotkanie z kalendarza „Praca" nie skracało sesji. Testy pilnują dwóch
 * kierunków pomyłki: pominięcia własnego kalendarza (za długa sesja) i wliczenia
 * subskrypcji w rodzaju świąt czy urodzin (odrzucona noc bez powodu).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  defaultCalendarIds,
  effectiveCalendarIds,
  toCalendarInfos,
  type CalendarInfo,
} from '../src/lib/calendar.ts';
import { DEFAULT_CONFIG, clampConfig, mergeConfig } from '../src/lib/config.ts';

const calendar = (over: Partial<CalendarInfo>): CalendarInfo => ({
  id: 'x',
  name: 'x',
  primary: false,
  selected: true,
  accessRole: 'owner',
  color: null,
  ...over,
});

const ACCOUNT: CalendarInfo[] = [
  calendar({ id: 'me@gmail.com', name: 'me@gmail.com', primary: true }),
  calendar({ id: 'praca', name: 'Praca' }),
  calendar({ id: 'ukryty', name: 'Ukryty', selected: false }),
  calendar({
    id: 'pl.polish#holiday@group.v.calendar.google.com',
    name: 'Święta w Polsce',
    accessRole: 'reader',
  }),
  calendar({ id: 'wspolny', name: 'Wspólny', accessRole: 'writer' }),
];

describe('domyślne kalendarze', () => {
  it('główny i własne widoczne, bez subskrypcji i ukrytych', () => {
    assert.deepEqual(defaultCalendarIds(ACCOUNT), ['me@gmail.com', 'praca', 'wspolny']);
  });

  it('główny liczy się zawsze, nawet schowany w widoku', () => {
    const ids = defaultCalendarIds([calendar({ id: 'me', primary: true, selected: false })]);

    assert.deepEqual(ids, ['me']);
  });

  it('pusta lista konta wraca do głównego', () => {
    assert.deepEqual(defaultCalendarIds([]), ['primary']);
  });
});

describe('wybór z konfiguracji', () => {
  it('wybór wygrywa z domyślnymi', () => {
    assert.deepEqual(effectiveCalendarIds(['praca'], ACCOUNT), ['praca']);
  });

  it('subskrypcję da się świadomie dołączyć', () => {
    const holiday = 'pl.polish#holiday@group.v.calendar.google.com';

    assert.deepEqual(effectiveCalendarIds(['praca', holiday], ACCOUNT), ['praca', holiday]);
  });

  it('kalendarz usunięty w Google wypada z wyboru', () => {
    assert.deepEqual(effectiveCalendarIds(['praca', 'usuniety'], ACCOUNT), ['praca']);
  });

  it('gdy z wyboru nic nie zostaje, liczą się domyślne', () => {
    // „Żaden kalendarz" to wolny poranek z definicji — dokładnie pomyłka,
    // przed którą ta integracja ma chronić.
    assert.deepEqual(effectiveCalendarIds(['usuniety'], ACCOUNT), defaultCalendarIds(ACCOUNT));
    assert.deepEqual(effectiveCalendarIds([], ACCOUNT), defaultCalendarIds(ACCOUNT));
  });

  it('bez listy konta zostaje wybór albo główny', () => {
    // Stary token bez uprawnienia do listy albo brak sieci: nie ma jak sprawdzić,
    // co istnieje, więc ufamy zapisanemu wyborowi.
    assert.deepEqual(effectiveCalendarIds(['praca'], null), ['praca']);
    assert.deepEqual(effectiveCalendarIds(null, null), ['primary']);
  });
});

describe('odczyt listy kalendarzy z Google', () => {
  it('czyta pola i woli nazwę nadaną przez użytkownika', () => {
    const [first] = toCalendarInfos([
      {
        id: 'praca',
        summary: 'Work',
        summaryOverride: 'Praca',
        primary: false,
        selected: true,
        accessRole: 'owner',
        backgroundColor: '#123456',
      },
    ]);

    assert.deepEqual(first, {
      id: 'praca',
      name: 'Praca',
      primary: false,
      selected: true,
      accessRole: 'owner',
      color: '#123456',
    });
  });

  it('brakujące pola nie dają praw, których Google nie potwierdził', () => {
    const [first] = toCalendarInfos([{ id: 'x' }]);

    assert.equal(first.name, 'x');
    assert.equal(first.primary, false);
    assert.equal(first.selected, false);
    assert.equal(first.accessRole, 'reader');
  });

  it('śmieci wypadają, a nie wywracają listy', () => {
    assert.equal(toCalendarInfos([null, 'x', { summary: 'bez id' }, { id: 'ok' }]).length, 1);
    assert.deepEqual(toCalendarInfos({}), []);
  });
});

describe('wybór kalendarzy w konfiguracji', () => {
  it('domyślnie niczego nie wybrano', () => {
    assert.equal(DEFAULT_CONFIG.calendar.calendarIds, null);
  });

  it('lista identyfikatorów przechodzi przez zapis', () => {
    const merged = mergeConfig({ calendar: { calendarIds: ['praca', 7, 'dom'] } });

    assert.deepEqual(merged.calendar.calendarIds, ['praca', 'dom']);
  });

  it('pusta lista i śmieci znaczą brak wyboru', () => {
    for (const value of [[], 'praca', [1, 2], null, {}]) {
      assert.equal(
        mergeConfig({ calendar: { calendarIds: value } }).calendar.calendarIds,
        null,
        JSON.stringify(value),
      );
    }
  });

  it('wybór przeżywa zmianę innego ustawienia', () => {
    // Ustawienia przepuszczają każdą zmianę przez clampConfig — pole, którego
    // tam nie ma, znikałoby przy przesunięciu dowolnego suwaka.
    const config = clampConfig({
      ...DEFAULT_CONFIG,
      calendar: { ...DEFAULT_CONFIG.calendar, calendarIds: ['praca'] },
    });

    assert.deepEqual(config.calendar.calendarIds, ['praca']);
  });
});
