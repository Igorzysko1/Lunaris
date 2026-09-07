/**
 * Buduje mapę jasności nieba dla aplikacji z kafli World Atlas.
 *
 *   npm run build:sky-map
 *
 * Dlaczego etap budowania, a nie dekodowanie na telefonie: oryginalne kafle są
 * skompresowane gzipem i kodowane różnicowo, a odczyt jednego punktu wymaga
 * zsumowania całej kolumny i kawałka wiersza. W React Native nie ma ani
 * `node:zlib`, ani `node:fs`, a i tak nie ma po co powtarzać tej pracy przy
 * każdym zapytaniu — wynik jest stały.
 *
 * Zapisujemy siatkę wyciętą do obszaru dojazdowego, po jednym bajcie na punkt.
 * Cała Polska w natywnej rozdzielczości to ~1,2 MB w base64; obszar, po którym
 * się realnie jeździ, mieści się w ~190 kB, a dla punktów spoza niego zostaje
 * dziedziczenie po najbliższej miejscowości.
 */

import { writeFileSync } from 'node:fs';

import { bortleFromSkyBrightness, skyBrightness } from './world-atlas.ts';

/**
 * Obszar dojazdowy z Jaworzna: Jura, Beskidy, Tatry, Kielecczyzna, Opolskie.
 * Rozszerzenie to zmiana tych czterech liczb i ponowne uruchomienie skryptu.
 */
const REGION = { lat0: 49, lat1: 51, lon0: 17, lon1: 22 };

/** Rozdzielczość mapy źródłowej: 1/120° to około 700 m. */
const STEP = 1 / 120;

/** Kwantyzacja jasności: 0,05 mag/arcsec² wystarcza, a mieści się w bajcie. */
const BASE_MPSAS = 16;
const QUANT = 0.05;

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Globalny indeks komórki w siatce World Atlas.
 *
 * Wyprowadzony z oryginalnego wzoru: indeks lokalny w kaflu to
 * `round(120·(la − 5·(ty−1)) + ½)`, a `600·(ty−1)` jest całkowite, więc po
 * dodaniu wychodzi `round(120·la + ½)` bez śladu po numerze kafla. Aplikacja
 * używa dokładnie tego samego wzoru, dzięki czemu trafia w tę samą komórkę,
 * a nie w sąsiednią przy krawędzi.
 */
const cellY = (lat: number) => Math.round(120 * (lat + 65) + 0.5);
const cellX = (lon: number) => Math.round(120 * mod(lon + 180, 360) + 0.5);

/**
 * Odwrotność `cellY`/`cellX`: dokładny środek komórki o danym indeksie.
 *
 * Próbkowanie „co 1/120° od krawędzi obszaru" wygląda na to samo, ale nim nie
 * jest: `49 + 203/120` daje w arytmetyce zmiennoprzecinkowej 13882.999999999998
 * zamiast 13883, więc zaokrąglenie spada o jeden i cały wiersz zapisuje wartości
 * z sąsiedniej komórki. Liczenie wprost ze środka komórki nie ma tej pułapki.
 */
const latOfCell = (gy: number) => (gy - 0.5) / 120 - 65;
const lonOfCell = (gx: number) => (gx - 0.5) / 120 - 180;

async function main() {
  const rows = Math.round((REGION.lat1 - REGION.lat0) / STEP);
  const cols = Math.round((REGION.lon1 - REGION.lon0) / STEP);

  // Indeksy komórek atlasu dla lewego dolnego rogu obszaru. Aplikacja liczy je
  // tym samym wzorem, więc wiersz i kolumna znaczą po obu stronach to samo.
  const originY = cellY(REGION.lat0);
  const originX = cellX(REGION.lon0);

  console.log(`Siatka ${cols}×${rows} = ${((cols * rows) / 1000).toFixed(0)} tys. punktów`);

  const bytes = new Uint8Array(rows * cols);
  let snapped = 0;

  for (let r = 0; r < rows; r++) {
    const lat = latOfCell(originY + r);

    for (let c = 0; c < cols; c++) {
      const mpsas = await skyBrightness(lat, lonOfCell(originX + c));
      const exact = bortleFromSkyBrightness(mpsas);

      let level = Math.round((mpsas - BASE_MPSAS) / QUANT);

      // Zaokrąglenie potrafi przerzucić punkt przez próg Bortle'a i wtedy
      // aplikacja pokazałaby inną klasę nieba niż generator bazy miejscowości.
      // Kryterium mówi, że obie strony mają dawać ten sam wynik, więc przy
      // takim przerzuceniu cofamy się o jeden poziom kwantyzacji.
      if (bortleFromSkyBrightness(BASE_MPSAS + level * QUANT) !== exact) {
        const nudged = mpsas > BASE_MPSAS + level * QUANT ? level + 1 : level - 1;
        if (bortleFromSkyBrightness(BASE_MPSAS + nudged * QUANT) === exact) {
          level = nudged;
          snapped++;
        }
      }

      bytes[r * cols + c] = Math.max(0, Math.min(255, level));
    }

    if (r % 60 === 0) process.stdout.write(`\r  ${Math.round((100 * r) / rows)}%`);
  }

  console.log(`\r  gotowe. Poprawek na progach klas: ${snapped}`);

  const base64 = Buffer.from(bytes).toString('base64');

  const file = `/**
 * Mapa jasności nieba — WYGENEROWANE, nie edytować ręcznie.
 * Źródło: World Atlas 2024 (David Lorenz). Generator: scripts/build-sky-map.ts.
 *
 * Jeden bajt na punkt siatki ${cols}×${rows}, krok ${STEP.toFixed(6)}° (~700 m).
 * Wartość to poziom kwantyzacji jasności: mag/arcsec² = ${BASE_MPSAS} + poziom × ${QUANT}.
 */

export const SKY_MAP = {
  lat0: ${REGION.lat0},
  lat1: ${REGION.lat1},
  lon0: ${REGION.lon0},
  lon1: ${REGION.lon1},
  rows: ${rows},
  cols: ${cols},
  baseMpsas: ${BASE_MPSAS},
  quant: ${QUANT},
  data: '${base64}',
} as const;
`;

  writeFileSync('src/data/sky-map.generated.ts', file);
  console.log(
    `Zapisano src/data/sky-map.generated.ts — ${(bytes.length / 1024).toFixed(0)} kB surowo, ${(base64.length / 1024).toFixed(0)} kB w base64`,
  );
}

await main();
