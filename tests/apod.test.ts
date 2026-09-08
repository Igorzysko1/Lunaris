/**
 * Zdjęcie dnia NASA.
 *
 * Cały ten moduł broni jednej rzeczy: **awaria APOD nie może zrobić nic poza
 * zniknięciem karty**. Nie ma tu więc testów na to, czy dane są sensowne — są
 * testy na to, czy zepsute dane przechodzą przez walidację bez wyjątku i bez
 * przepuszczenia czegoś, czego karta nie umie pokazać.
 *
 * Sieci nie ruszamy: `fetchApod` łapie wszystko i zwraca `null`, a sprawdzanie
 * tego wymagałoby podstawiania globalnego `fetch` po to, by potwierdzić jedną
 * klauzulę `catch`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseApod } from '../src/lib/apod.ts';

const response = (over: Record<string, unknown> = {}) => ({
  date: '2026-09-08',
  title: 'The Great Nebula in Orion',
  explanation: 'A long English description from NASA.',
  media_type: 'image',
  url: 'https://apod.nasa.gov/apod/image/2609/orion.jpg',
  ...over,
});

describe('walidacja odpowiedzi APOD', () => {
  it('cokolwiek dostanie, zwraca wynik zamiast rzucać', () => {
    const garbage = [undefined, null, 0, '', 'tekst', [], [1, 2], true, NaN, () => {}];

    for (const value of garbage) {
      assert.equal(parseApod(value), null, String(value));
    }
  });

  it('bez daty, tytułu albo adresu nie ma czego pokazać', () => {
    for (const field of ['date', 'title', 'url']) {
      assert.equal(parseApod(response({ [field]: undefined })), null, field);
      assert.equal(parseApod(response({ [field]: '   ' })), null, `${field} (same spacje)`);
      assert.equal(parseApod(response({ [field]: 42 })), null, `${field} (liczba)`);
    }
  });

  it('brak opisu nie unieważnia zdjęcia', () => {
    // Opis jest dodatkiem — karta bez niego po prostu nie ma czego rozwijać.
    const apod = parseApod(response({ explanation: undefined }));

    assert.equal(apod?.explanation, '');
    assert.equal(apod?.title, 'The Great Nebula in Orion');
  });

  it('nieznany rodzaj mediów traktuje jak wideo, nie jak obraz', () => {
    // Zapas w bezpieczną stronę: karta pokaże wtedy tytuł zamiast ramki
    // z niewczytanym plikiem.
    for (const media of [undefined, 'other', 'interactive', 7]) {
      assert.equal(parseApod(response({ media_type: media }))?.mediaType, 'video', String(media));
    }
  });

  it('podgląd wideo bierze z osobnego pola', () => {
    const apod = parseApod(
      response({
        media_type: 'video',
        url: 'https://www.youtube.com/embed/abc',
        thumbnail_url: 'https://img.youtube.com/vi/abc/0.jpg',
      }),
    );

    assert.equal(apod?.mediaType, 'video');
    assert.equal(apod?.thumbnailUrl, 'https://img.youtube.com/vi/abc/0.jpg');
  });

  it('brak podglądu to null, a nie pusty napis', () => {
    // Karta rozstrzyga o pokazaniu obrazu po tym polu, więc pusty napis
    // przeszedłby jako adres i dał ramkę z niewczytanym plikiem.
    assert.equal(parseApod(response())?.thumbnailUrl, null);
  });

  it('podpis autora przechodzi, gdy jest', () => {
    // Zdjęcia APOD bywają cudzą własnością i wtedy podpis jest warunkiem
    // użycia — pominięcie go byłoby użyciem pracy bez nazwiska.
    assert.equal(parseApod(response({ copyright: 'Jan Kowalski' }))?.copyright, 'Jan Kowalski');
    assert.equal(parseApod(response())?.copyright, null);
  });

  it('zwija wielolinijkowy podpis do jednego wiersza', () => {
    // Nie hipotetyczne: NASA zwraca podpisy w rodzaju
    // „\nKeighley Rockcliffe  \n(NASA\nGSFC, \nUMBC CSST, \nCRESST II)\n".
    // Wstawione wprost rozjeżdżały kartę na sześć wierszy.
    assert.equal(
      parseApod(response({ copyright: '\nKeighley Rockcliffe  \n(NASA\nGSFC, \nCRESST II)\n' }))
        ?.copyright,
      'Keighley Rockcliffe (NASA GSFC, CRESST II)',
    );
  });

  it('wideo bez miniatury zostawia null, zamiast udawać obraz', () => {
    // Też z żywych danych: `thumbs=true` nie gwarantuje miniatury — APOD
    // z 19.08.2026 jej nie miał. Karta pokazuje wtedy sam tytuł i odnośnik.
    const apod = parseApod(response({ media_type: 'video', thumbnail_url: undefined }));

    assert.equal(apod?.mediaType, 'video');
    assert.equal(apod?.thumbnailUrl, null);
  });

  it('nieznane pola nie przeszkadzają', () => {
    assert.ok(parseApod(response({ hdurl: 'https://...', service_version: 'v1' })));
  });
});
