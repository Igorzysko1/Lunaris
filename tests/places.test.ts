/**
 * Dane miejscowości: identyfikatory muszą być jedyne.
 *
 * Zdublowany identyfikator wywraca listę wyboru miejsca — React odmawia dwóch
 * elementów z tym samym kluczem. Tak było z Włodowicami, które OSM ma jako dwa
 * węzły w tym samym punkcie; wyszło dopiero na ekranie punktu startowego.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CITIES, GMINY } from '../src/data/places.ts';

const duplicates = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

describe('identyfikatory miejscowości', () => {
  it('żadne miasto nie powtarza identyfikatora', () => {
    assert.deepEqual(duplicates(CITIES.map((p) => p.id)), []);
  });

  it('żadna gmina nie powtarza identyfikatora', () => {
    assert.deepEqual(duplicates(GMINY.map((p) => p.id)), []);
  });

  it('miasto i gmina o tej samej nazwie mają różne identyfikatory', () => {
    // „Jaworzno" jest i miastem, i gminą — to dwa różne punkty, nie duplikat.
    assert.deepEqual(duplicates([...CITIES, ...GMINY].map((p) => p.id)), []);
  });
});
