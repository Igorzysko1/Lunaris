/**
 * Granica warstwy domenowej.
 *
 * Rachunek astronomiczny ma się liczyć niezależnie od widoku — po to, żeby dało
 * się go użyć z aplikacji, z CLI i z testu. To reguła, która psuje się po cichu:
 * jeden `import { Linking } from 'react-native'` w module wyliczeniowym nie
 * przeszkadza aplikacji, a wywraca każde uruchomienie poza Metro. Zamiast
 * sprzątać to raz na jakiś czas, sprawdzamy to testem.
 *
 * `src/lib` i `src/data` są warstwą domenową. Hooki mieszkają osobno,
 * w `src/hooks`, i wolno im wszystko — na tym polega ich rola.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const DOMAIN_DIRS = ['src/lib', 'src/data'];

/**
 * Moduły, które z natury dotykają platformy: zapis na dysk i pliki. Nie są
 * rachunkiem, tylko jego obudową, i nigdy nie uruchamiają się pod Node.
 */
const PLATFORM_MODULES = new Set([
  'forecast-cache.ts',
  'settings-storage.ts',
  'notice-store.ts',
  'journal-store.ts',
]);

function domainFiles(): { path: string; name: string; source: string }[] {
  return DOMAIN_DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => ({
        path: join(dir, name),
        name,
        source: readFileSync(join(dir, name), 'utf8'),
      })),
  );
}

describe('warstwa domenowa nie zna widoku', () => {
  it('żaden moduł rachunku nie importuje Reacta ani React Native', () => {
    const offenders = domainFiles()
      .filter(({ name }) => !PLATFORM_MODULES.has(name))
      .filter(({ source }) => /from\s+'react(-native)?'/.test(source))
      .map(({ path }) => path);

    assert.deepEqual(offenders, []);
  });

  it('żaden moduł rachunku nie używa aliasu @/', () => {
    // Alias rozwiązuje Metro. Pod Node to zwykły, nieistniejący pakiet, więc
    // moduł z aliasem przestaje się uruchamiać poza aplikacją — a `tsc` tego
    // nie zauważy, bo alias jest w tsconfig.
    const offenders = domainFiles()
      .filter(({ name }) => !PLATFORM_MODULES.has(name))
      .filter(({ source }) => /from\s+'@\//.test(source))
      .map(({ path }) => path);

    assert.deepEqual(offenders, []);
  });

  it('hooki nie mieszkają w warstwie domenowej', () => {
    // Plik `use-*.ts` w src/lib znaczy, że granica znów się rozmyła.
    const hooks = domainFiles().filter(({ name }) => name.startsWith('use-'));

    assert.deepEqual(
      hooks.map((h) => h.path),
      [],
    );
  });

  it('każdy moduł rachunku faktycznie się ładuje pod Node', async () => {
    // Import, a nie sama analiza tekstu: składnia, która generuje kod, przechodzi
    // przez `tsc`, a wywala się dopiero przy uruchomieniu.
    for (const dir of DOMAIN_DIRS) {
      for (const name of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
        if (PLATFORM_MODULES.has(name)) continue;
        const module = await import(`../${dir}/${name}`);
        assert.equal(typeof module, 'object', `${dir}/${name}`);
      }
    }
  });
});
