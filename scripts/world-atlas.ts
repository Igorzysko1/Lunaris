/**
 * Jasność nieba z mapy World Atlas (David Lorenz) → skala Bortle'a.
 *
 * Używane tylko przy budowaniu danych (scripts/), nie w aplikacji.
 *
 * Dekodowanie jest wzięte wprost od autora mapy
 * (https://djlorenz.github.io/astronomy/lp/overlay/dark.html), nie wymyślone:
 * świat jest pokryty kaflami 5°×5°, każdy to siatka 600×600 punktów (1/120°, ~700 m),
 * kodowana różnicowo — pierwszy punkt jest 2-bajtowy, reszta to przyrosty względem
 * sąsiada. Stąd sumowanie wzdłuż kolumny, a potem wiersza.
 */

import { gunzipSync } from 'node:zlib';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const CACHE = 'scripts/.cache';
const YEAR = 2024;

const tiles = new Map<string, Int8Array>();

async function loadTile(tilex: number, tiley: number): Promise<Int8Array> {
  const key = `${tilex}_${tiley}`;
  const cached = tiles.get(key);
  if (cached) return cached;

  const file = `${CACHE}/atlas_${YEAR}_${key}.dat`;
  let raw: Buffer;

  if (existsSync(file)) {
    raw = readFileSync(file);
  } else {
    const url = `https://djlorenz.github.io/astronomy/binary_tiles/${YEAR}/binary_tile_${tilex}_${tiley}.dat.gz`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`World Atlas ${key}: ${res.status}`);
    raw = gunzipSync(Buffer.from(await res.arrayBuffer()));
    writeFileSync(file, raw);
  }

  const data = new Int8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  tiles.set(key, data);
  return data;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Jasność nieba w mag/arcsec² (im więcej, tym ciemniej; ~22 to niebo naturalne). */
export async function skyBrightness(lat: number, lon: number): Promise<number> {
  const lonFromDateLine = mod(lon + 180, 360);
  const latFromStart = lat + 65;

  const tilex = Math.floor(lonFromDateLine / 5) + 1;
  const tiley = Math.floor(latFromStart / 5) + 1;

  const ix = Math.round(120 * (lonFromDateLine - 5 * (tilex - 1) + 1 / 240));
  const iy = Math.round(120 * (latFromStart - 5 * (tiley - 1) + 1 / 240));

  const data = await loadTile(tilex, tiley);

  let value = 128 * data[0] + data[1];
  for (let i = 1; i < iy; i++) value += data[600 * i + 1];
  for (let i = 1; i < ix; i++) value += data[600 * (iy - 1) + 1 + i];

  const brightnessRatio = (5 / 195) * (Math.exp(0.0195 * value) - 1);
  return 22 - (5 * Math.log(1 + brightnessRatio)) / Math.log(100);
}

/**
 * Standardowe progi SQM → Bortle. Nie są zgadnięte: pokrywają się co do setnej
 * z progami stref jasności na mapie World Atlas (21.99 / 21.89 / 21.69 / 20.49 /
 * 19.50 / 18.94 / 18.38 / 17.80).
 */
export function bortleFromSkyBrightness(mpsas: number): number {
  if (mpsas >= 21.99) return 1;
  if (mpsas >= 21.89) return 2;
  if (mpsas >= 21.69) return 3;
  if (mpsas >= 20.49) return 4;
  if (mpsas >= 19.5) return 5;
  if (mpsas >= 18.94) return 6;
  if (mpsas >= 18.38) return 7;
  if (mpsas >= 17.8) return 8;
  return 9;
}

export async function bortleAt(lat: number, lon: number): Promise<number> {
  return bortleFromSkyBrightness(await skyBrightness(lat, lon));
}
