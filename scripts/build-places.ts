/**
 * Generuje src/data/places.generated.ts — wszystkie miasta i gminy w Polsce
 * wraz z Bortle policzonym z mapy zanieczyszczenia światłem.
 *
 *   npm run build:places
 *
 * Źródła:
 *  - gminy      — GeoNames (jednostki ADM3), z kodem województwa
 *  - miasta     — OpenStreetMap (place=city|town) przez Overpass
 *  - Bortle     — World Atlas 2024 (David Lorenz), siatka 1/120° (~700 m)
 *
 * Bortle NIE jest zgadywane. Dane World Atlas są dekodowane wzorami autora mapy
 * (https://djlorenz.github.io/astronomy/lp/overlay/dark.html): piksel → współczynnik
 * jasności sztucznej → mag/arcsec², a stamtąd na skalę Bortle'a po standardowych
 * progach SQM, które pokrywają się z progami stref na tamtej mapie.
 */

import { inflateRawSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { bortleAt } from './world-atlas.ts';

const CACHE = 'scripts/.cache';
const OUT = 'src/data/places.generated.ts';
const ATLAS_YEAR = 2024;

const OVERPASS = 'https://overpass.kumi.systems/api/interpreter';
const GEONAMES_ZIP = 'https://download.geonames.org/export/dump/PL.zip';

/** Kody województw GeoNames (ADM1) → nazwy polskie. */
const VOIVODESHIPS: Record<string, string> = {
  '72': 'dolnośląskie',
  '73': 'kujawsko-pomorskie',
  '74': 'łódzkie',
  '75': 'lubelskie',
  '76': 'lubuskie',
  '77': 'małopolskie',
  '78': 'mazowieckie',
  '79': 'opolskie',
  '80': 'podkarpackie',
  '81': 'podlaskie',
  '82': 'pomorskie',
  '83': 'śląskie',
  '84': 'świętokrzyskie',
  '85': 'warmińsko-mazurskie',
  '86': 'wielkopolskie',
  '87': 'zachodniopomorskie',
};

type Row = { id: string; name: string; region: string; lat: number; lon: number; bortle: number };

/**
 * Nazwa nie identyfikuje miejsca: „Andrychów" to jednocześnie miasto i gmina w tym
 * samym województwie, a „Bolesławiec" występuje pięć razy w kraju. Klucz musi więc
 * zawierać współrzędne.
 */
function placeId(kind: 'm' | 'g', name: string, lat: number, lon: number): string {
  return `${kind}:${name}:${lat.toFixed(3)},${lon.toFixed(3)}`;
}

// ─────────────────────────────── Gminy: GeoNames ───────────────────────────────

/** Wyciąga jeden plik z archiwum ZIP (deflate) — żeby nie dokładać zależności. */
function unzipEntry(zip: Buffer, wanted: string): Buffer {
  // Koniec centralnego katalogu: sygnatura 0x06054b50, skanujemy od tyłu.
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Uszkodzone archiwum ZIP');

  let offset = zip.readUInt32LE(eocd + 16);
  const count = zip.readUInt16LE(eocd + 10);

  for (let i = 0; i < count; i++) {
    const nameLen = zip.readUInt16LE(offset + 28);
    const extraLen = zip.readUInt16LE(offset + 30);
    const commentLen = zip.readUInt16LE(offset + 32);
    const name = zip.subarray(offset + 46, offset + 46 + nameLen).toString();
    const localOffset = zip.readUInt32LE(offset + 42);

    if (name === wanted) {
      const method = zip.readUInt16LE(localOffset + 8);
      const compSize = zip.readUInt32LE(offset + 20);
      const lNameLen = zip.readUInt16LE(localOffset + 26);
      const lExtraLen = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const body = zip.subarray(start, start + compSize);
      return method === 0 ? Buffer.from(body) : inflateRawSync(body);
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }

  throw new Error(`Brak ${wanted} w archiwum`);
}

async function geonames(): Promise<string> {
  const file = `${CACHE}/PL.txt`;
  if (existsSync(file)) return readFileSync(file, 'utf8');

  console.log('Pobieram GeoNames PL.zip…');
  const res = await fetch(GEONAMES_ZIP);
  if (!res.ok) throw new Error(`GeoNames: ${res.status}`);
  const text = unzipEntry(Buffer.from(await res.arrayBuffer()), 'PL.txt').toString('utf8');
  writeFileSync(file, text);
  return text;
}

// ────────────────────────────── Miasta: Overpass ──────────────────────────────

type OsmNode = { lat: number; lon: number; tags: { name?: string } };

async function overpassCities(): Promise<OsmNode[]> {
  const file = `${CACHE}/cities.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).elements;

  const query = `[out:json][timeout:220];
area["ISO3166-1"="PL"][admin_level=2]->.pl;
node(area.pl)["place"~"^(city|town)$"]["name"];
out body;`;

  // Overpass bywa przeciążony — publiczne instancje odrzucają zapytania pod obciążeniem.
  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`Pobieram miasta z Overpass (próba ${attempt})…`);
    const res = await fetch(OVERPASS, { method: 'POST', body: query });
    const text = await res.text();
    if (text.startsWith('{')) {
      writeFileSync(file, text);
      return JSON.parse(text).elements;
    }
    await new Promise((r) => setTimeout(r, 20_000));
  }

  throw new Error('Overpass nie odpowiedział — spróbuj ponownie za chwilę');
}

// ──────────────────────────────────── Build ────────────────────────────────────

function emit(cities: Row[], gminy: Row[]): string {
  const line = (p: Row) =>
    `  { id: ${JSON.stringify(p.id)}, name: ${JSON.stringify(p.name)}, ` +
    `region: ${JSON.stringify(p.region)}, lat: ${p.lat.toFixed(4)}, ` +
    `lon: ${p.lon.toFixed(4)}, bortle: ${p.bortle} },`;

  return `// WYGENEROWANE AUTOMATYCZNIE przez scripts/build-places.ts — nie edytuj ręcznie.
//
// Miasta: OpenStreetMap (place=city|town). Gminy: GeoNames (ADM3).
// Bortle: World Atlas ${ATLAS_YEAR} (David Lorenz) — jasność nieba w mag/arcsec²
// przeliczona na skalę Bortle'a po standardowych progach SQM.
//
// Dane pod licencjami: ODbL (OpenStreetMap), CC BY 4.0 (GeoNames).

import type { Place } from './places';

export const CITIES: Place[] = [
${cities.map(line).join('\n')}
];

export const GMINY: Place[] = [
${gminy.map(line).join('\n')}
];
`;
}

async function main() {
  mkdirSync(CACHE, { recursive: true });

  // ── gminy ──
  const lines = (await geonames()).split('\n');
  const gminaRows: Row[] = [];

  for (const raw of lines) {
    const f = raw.split('\t');
    if (f[6] !== 'A' || f[7] !== 'ADM3') continue;
    const region = VOIVODESHIPS[f[10]];
    if (!region) continue;
    const name = f[1].replace(/^Gmina /, '');
    const lat = Number(f[4]);
    const lon = Number(f[5]);
    gminaRows.push({ id: placeId('g', name, lat, lon), name, region, lat, lon, bortle: 0 });
  }

  // ── miasta ──
  const nodes = await overpassCities();
  const cityRows: Row[] = nodes
    .filter((n) => n.tags?.name)
    .map((n) => ({
      id: placeId('m', n.tags.name!, n.lat, n.lon),
      name: n.tags.name!,
      region: '',
      lat: n.lat,
      lon: n.lon,
      bortle: 0,
    }));

  // Miasto leży w gminie, więc województwo bierzemy z najbliższego centroidu gminy.
  for (const city of cityRows) {
    let best = gminaRows[0];
    let bestD = Infinity;
    for (const g of gminaRows) {
      const d = (g.lat - city.lat) ** 2 + (g.lon - city.lon) ** 2;
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    city.region = best.region;
  }

  // ── Bortle ──
  console.log('Liczę Bortle z World Atlas…');
  for (const row of [...cityRows, ...gminaRows]) {
    row.bortle = await bortleAt(row.lat, row.lon);
  }

  cityRows.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  gminaRows.sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  writeFileSync(OUT, emit(cityRows, gminaRows));
  console.log(`\nZapisano ${OUT}`);
  console.log(`  miasta: ${cityRows.length}`);
  console.log(`  gminy:  ${gminaRows.length}`);
}

await main();
