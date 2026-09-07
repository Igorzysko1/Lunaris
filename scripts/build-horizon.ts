/**
 * Liczy maskę horyzontu dla miejsca obserwacyjnego.
 *
 *   npm run build:horizon -- --lat 50.35 --lon 19.53
 *
 * Wynik: 360 wysokości terenu w stopniach, po jednej na azymut, do wklejenia
 * przy miejscu w katalogu. Rachunek jest tutaj, a nie w aplikacji, bo to dwa
 * rastry i dziesiątki tysięcy próbek — telefon w terenie dostaje gotowe liczby.
 *
 * Dane: PZGiK (GUGiK), bezpłatnie i bez klucza.
 * - Bliskie pole: NMPT — model POKRYCIA terenu z lotniczego skaningu, 0,5 m.
 *   Stoi w nim wszystko, co realnie zasłania niebo: ściana lasu, zabudowa.
 * - Dalekie pole: NMT — model GRUNTU, przez usługę punktową. Na tym dystansie
 *   liczą się grzbiety, nie roślinność: 25-metrowe drzewo z 20 km podnosi
 *   horyzont o 0,07°.
 */

const NMPT_WCS =
  'https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMPT/GRID1/WCS/DigitalSurfaceModel';
const NMT_POINTS = 'https://services.gugik.gov.pl/nmt/';

/**
 * Zasięg bliskiego pola. 250 m to nie kompromis z lenistwa, tylko zmierzony
 * limit usługi: kwadrat 500×500 m w rozdzielczości 0,5 m to 18,6 MB odpowiedzi
 * i 18 sekund, a kilometrowy serwer już odrzuca. Zasięg dalej niż to obsługuje
 * model gruntu — kosztem roślinności, której tam nie widzimy.
 */
const NEAR_M = 250;
const FAR_M = 30000;

/** Promień Ziemi powiększony o refrakcję: 7/6 · R. */
const R_EFF = (7 / 6) * 6371000;

/** Wzrost obserwatora ponad grunt. */
const EYE_M = 1.5;

const D2R = Math.PI / 180;

/**
 * Współrzędne PL-1992 (EPSG:2180) — jedyny układ, w którym mówią obie usługi.
 * Poprzeczne odwzorowanie Merkatora na GRS80, południk 19°E, k0 = 0,9993.
 */
function toPL1992(lat: number, lon: number): { x: number; y: number } {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const e2 = f * (2 - f);
  const k0 = 0.9993;
  const L0 = 19 * D2R;

  const p = lat * D2R;
  const l = lon * D2R;
  const N = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2);
  const t = Math.tan(p);
  const ep2 = e2 / (1 - e2);
  const n2 = ep2 * Math.cos(p) ** 2;
  const A = (l - L0) * Math.cos(p);

  const A0 = 1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256;
  const A2 = (3 / 8) * (e2 + e2 ** 2 / 4 + (15 * e2 ** 3) / 128);
  const A4 = (15 / 256) * (e2 ** 2 + (3 * e2 ** 3) / 4);
  const A6 = (35 * e2 ** 3) / 3072;
  const S = a * (A0 * p - A2 * Math.sin(2 * p) + A4 * Math.sin(4 * p) - A6 * Math.sin(6 * p));

  const x =
    S +
    N *
      t *
      ((A * A) / 2 +
        ((5 - t * t + 9 * n2 + 4 * n2 * n2) * A ** 4) / 24 +
        ((61 - 58 * t * t + t ** 4) * A ** 6) / 720);
  const y =
    N *
    (A +
      ((1 - t * t + n2) * A ** 3) / 6 +
      ((5 - 18 * t * t + t ** 4 + 14 * n2 - 58 * t * t * n2) * A ** 5) / 120);

  return { x: k0 * x - 5300000, y: k0 * y + 500000 };
}

/** Siatka tekstowa z WCS: nagłówek plus wiersze wartości, od góry na dół. */
type AsciiGrid = {
  cols: number;
  rows: number;
  xll: number;
  yll: number;
  cell: number;
  values: Float32Array;
};

function parseAsciiGrid(text: string): AsciiGrid {
  const start = text.indexOf('ncols');
  const body = text.slice(start);
  const head = Object.fromEntries(
    body
      .split('\n')
      .slice(0, 5)
      .map((line) => {
        const [key, value] = line.trim().split(/\s+/);
        return [key, Number(value)];
      }),
  );

  const cols = head.ncols;
  const rows = head.nrows;
  const values = new Float32Array(cols * rows);

  let i = 0;
  const lines = body.split('\n').slice(5);
  for (const line of lines) {
    if (!line.trim()) continue;
    for (const token of line.trim().split(/\s+/)) {
      if (i < values.length) values[i++] = Number(token);
    }
  }

  return { cols, rows, xll: head.xllcorner, yll: head.yllcorner, cell: head.cellsize, values };
}

/** Wysokość pokrycia terenu w punkcie siatki; poza siatką `null`. */
function sampleGrid(grid: AsciiGrid, x: number, y: number): number | null {
  const col = Math.floor((y - grid.xll) / grid.cell);
  // Siatka idzie od góry: pierwszy wiersz to największa współrzędna północna.
  const row = grid.rows - 1 - Math.floor((x - grid.yll) / grid.cell);

  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return null;
  return grid.values[row * grid.cols + col];
}

async function fetchNearField(x: number, y: number): Promise<AsciiGrid> {
  const url =
    `${NMPT_WCS}?service=WCS&version=2.0.1&request=GetCoverage` +
    `&coverageId=DSM_PL-EVRF2007-NH&format=image/x-aaigrid` +
    `&subset=x(${Math.round(y - NEAR_M)},${Math.round(y + NEAR_M)})` +
    `&subset=y(${Math.round(x - NEAR_M)},${Math.round(x + NEAR_M)})`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`NMPT: ${res.status}`);
  return parseAsciiGrid(await res.text());
}

/**
 * Wysokości gruntu dla listy punktów. Usługa przyjmuje je wsadowo metodą POST —
 * dwa tysiące punktów w dwie sekundy, więc dalekie pole to kilkadziesiąt żądań,
 * a nie kilkadziesiąt tysięcy.
 */
async function fetchGroundHeights(points: { x: number; y: number }[]): Promise<number[]> {
  const BATCH = 1500;
  const out: number[] = [];

  for (let i = 0; i < points.length; i += BATCH) {
    const chunk = points.slice(i, i + BATCH);
    const list = chunk.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(',');

    const res = await fetch(NMT_POINTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `request=GetHByPointList&list=${encodeURIComponent(list)}`,
    });
    if (!res.ok) throw new Error(`NMT: ${res.status}`);

    for (const entry of (await res.text()).trim().split(',')) {
      const height = Number(entry.trim().split(/\s+/)[2]);
      out.push(Number.isFinite(height) ? height : NaN);
    }
  }

  return out;
}

/**
 * Kąt, pod jakim widać przeszkodę o wysokości `h` z odległości `d`.
 * Odjęcie `d²/(2·R_eff)` to krzywizna Ziemi skorygowana o refrakcję: bez tego
 * grzbiet z 30 km wychodzi wyżej, niż widać go naprawdę.
 */
const elevationAngle = (h: number, hObs: number, d: number) =>
  Math.atan((h - hObs - (d * d) / (2 * R_EFF)) / d) / D2R;

/** Kroki próbkowania: gęsto blisko, rzadziej daleko — kąt zmienia się wolniej. */
function distances(): number[] {
  const out: number[] = [];
  for (let d = 5; d < 100; d += 5) out.push(d);
  for (let d = 100; d < NEAR_M; d += 10) out.push(d);
  for (let d = NEAR_M; d < 2000; d += 50) out.push(d);
  for (let d = 2000; d < 10000; d += 200) out.push(d);
  for (let d = 10000; d <= FAR_M; d += 500) out.push(d);
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? Number(argv[i + 1]) : NaN;
  };

  const lat = arg('lat');
  const lon = arg('lon');
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.error('Podaj --lat i --lon, np. npm run build:horizon -- --lat 50.35 --lon 19.53');
    process.exit(1);
  }

  const origin = toPL1992(lat, lon);
  console.log(`Punkt ${lat}, ${lon} → PL-1992 ${origin.x.toFixed(1)} ${origin.y.toFixed(1)}`);

  console.log('Pobieram bliskie pole (NMPT, 0,5 m)…');
  const near = await fetchNearField(origin.x, origin.y);
  console.log(`  siatka ${near.cols}×${near.rows}, oczko ${near.cell} m`);

  // Wysokość obserwatora z modelu gruntu, nie z GPS: pionowa dokładność
  // odbiornika jest 2–3× gorsza od poziomej, a ta liczba wchodzi w licznik wprost.
  const [groundAtOrigin] = await fetchGroundHeights([origin]);
  const hObs = groundAtOrigin + EYE_M;
  console.log(`  grunt w punkcie ${groundAtOrigin.toFixed(1)} m, oko na ${hObs.toFixed(1)} m`);

  const steps = distances();
  const farSteps = steps.filter((d) => d >= NEAR_M);

  // Dalekie pole jednym wsadem dla wszystkich azymutów naraz.
  const farPoints: { x: number; y: number }[] = [];
  for (let az = 0; az < 360; az++) {
    for (const d of farSteps) {
      farPoints.push({
        x: origin.x + d * Math.cos(az * D2R),
        y: origin.y + d * Math.sin(az * D2R),
      });
    }
  }

  console.log(`Pobieram dalekie pole (NMT, grunt): ${farPoints.length} punktów…`);
  const farHeights = await fetchGroundHeights(farPoints);

  const mask: number[] = [];
  for (let az = 0; az < 360; az++) {
    let maxAngle = 0;

    for (const d of steps) {
      if (d < NEAR_M) {
        const h = sampleGrid(
          near,
          origin.x + d * Math.cos(az * D2R),
          origin.y + d * Math.sin(az * D2R),
        );
        if (h !== null) maxAngle = Math.max(maxAngle, elevationAngle(h, hObs, d));
      } else {
        const h = farHeights[az * farSteps.length + farSteps.indexOf(d)];
        if (Number.isFinite(h)) maxAngle = Math.max(maxAngle, elevationAngle(h, hObs, d));
      }
    }

    mask.push(Math.round(maxAngle * 10) / 10);
  }

  const max = Math.max(...mask);
  const min = Math.min(...mask);
  console.log(
    `\nMaska: od ${min.toFixed(1)}° do ${max.toFixed(1)}°, średnio ${(mask.reduce((a, b) => a + b, 0) / 360).toFixed(1)}°`,
  );
  console.log('Do wklejenia jako horizonMask przy miejscu:\n');
  console.log(`[${mask.join(', ')}]`);
}

await main();
