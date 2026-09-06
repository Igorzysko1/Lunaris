/**
 * Klient prognozy (Open-Meteo). Darmowe, bez klucza API.
 *
 * Zwraca dane dla okna obserwacyjnego — od zachodu do wschodu Słońca — a nie dla
 * doby kalendarzowej. Okno jest LICZONE z efemeryd, nie zaszyte na sztywno:
 * zachód Słońca przesuwa się przez rok o godziny.
 */

import type { Coords } from '../data/places.ts';
import { nightWindow, type NightWindow } from './night-window.ts';

const API = 'https://api.open-meteo.com/v1/forecast';

/** Pojedyncza godzina wewnątrz okna nocy. */
export type NightHour = {
  at: Date;
  cloud: number;
  /**
   * Piętra chmur osobno, bo znaczą co innego: niskie zasłaniają niebo całkowicie,
   * wysokie tylko zabierają kontrast i są tolerowane wyżej.
   */
  cloudLow: number;
  cloudHigh: number;
  humidity: number;
  temperature: number;
  /** Różnica temperatury i punktu rosy (°C). Mała = rosa osiada na optyce. */
  dewSpread: number;
  precipitation: number;
  /** Porywy wiatru (km/h) — to one trzęsą sprzętem, nie średnia prędkość. */
  windGust: number;
};

export type NightForecast = {
  from: Date;
  to: Date;
  hours: NightHour[];
  /** Średnie zachmurzenie w oknie nocy (%). */
  avgCloud: number;
  avgHumidity: number;
  /** Najmniejszy spread w nocy — najgorszy moment pod kątem rosy. */
  minDewSpread: number;
  /** Suma opadów w oknie nocy (mm). */
  totalPrecipitation: number;
  /** Najniższa temperatura w oknie — do decyzji, jak się ubrać. */
  minTemperature: number;
};

type ApiResponse = {
  hourly: {
    time: string[];
    cloud_cover: (number | null)[];
    cloud_cover_low: (number | null)[];
    cloud_cover_high: (number | null)[];
    relative_humidity_2m: (number | null)[];
    temperature_2m: (number | null)[];
    dew_point_2m: (number | null)[];
    precipitation: (number | null)[];
    wind_gusts_10m: (number | null)[];
  };
  daily: { sunrise: string[]; sunset: string[] };
};

/** Okno obserwacyjne: zachód Słońca → najbliższy wschód. */
function sunWindow(daily: ApiResponse['daily'], now: Date) {
  // daily = [wczoraj, dziś, jutro] — patrz past_days/forecast_days niżej.
  // Przed świtem trwa jeszcze noc, która zaczęła się wczoraj.
  const beforeSunrise = now < new Date(daily.sunrise[1]);
  return beforeSunrise
    ? { from: new Date(daily.sunset[0]), to: new Date(daily.sunrise[1]) }
    : { from: new Date(daily.sunset[1]), to: new Date(daily.sunrise[2]) };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const HOURLY_FIELDS = [
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_high',
  'relative_humidity_2m',
  'temperature_2m',
  'dew_point_2m',
  'precipitation',
  'wind_gusts_10m',
].join(',');

function toHours(json: ApiResponse): NightHour[] {
  return json.hourly.time.map((time, i) => ({
    at: new Date(time),
    cloud: json.hourly.cloud_cover[i] ?? 0,
    cloudLow: json.hourly.cloud_cover_low[i] ?? 0,
    cloudHigh: json.hourly.cloud_cover_high[i] ?? 0,
    humidity: json.hourly.relative_humidity_2m[i] ?? 0,
    temperature: json.hourly.temperature_2m[i] ?? 0,
    dewSpread: (json.hourly.temperature_2m[i] ?? 0) - (json.hourly.dew_point_2m[i] ?? 0),
    precipitation: json.hourly.precipitation[i] ?? 0,
    windGust: json.hourly.wind_gusts_10m[i] ?? 0,
  }));
}

export async function fetchNightForecast(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<NightForecast> {
  const url = new URL(API);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('hourly', HOURLY_FIELDS);
  url.searchParams.set('daily', 'sunrise,sunset');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('past_days', '1');
  url.searchParams.set('forecast_days', '2');

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Open-Meteo: ${res.status}`);
  const json = (await res.json()) as ApiResponse;

  const { from, to } = sunWindow(json.daily, new Date());

  const hours = toHours(json).filter((h) => h.at >= from && h.at <= to);

  if (hours.length === 0) throw new Error('Brak danych dla okna nocy');

  return {
    from,
    to,
    hours,
    avgCloud: avg(hours.map((h) => h.cloud)),
    avgHumidity: avg(hours.map((h) => h.humidity)),
    minDewSpread: Math.min(...hours.map((h) => h.dewSpread)),
    totalPrecipitation: hours.reduce((sum, h) => sum + h.precipitation, 0),
    minTemperature: Math.min(...hours.map((h) => h.temperature)),
  };
}

/** Prognoza godzinowa przypisana do konkretnej nocy astronomicznej. */
export type NightSlice = {
  night: NightWindow;
  hours: NightHour[];
};

/**
 * Kolejne noce od dzisiejszego wieczora — materiał wejściowy dla silnika sesji.
 *
 * Okna liczymy z efemeryd (zmierzch i świt astronomiczny), a nie z zachodu Słońca
 * zwracanego przez API: silnik ocenia ciemne niebo, a nie porę po zachodzie.
 * Open-Meteo daje prognozę godzinową na kilka dób jednym zapytaniem, więc trzy
 * noce nie kosztują trzech żądań.
 */
export async function fetchUpcomingNights(
  coords: Coords,
  nights: number,
  signal?: AbortSignal,
): Promise<NightSlice[]> {
  const url = new URL(API);
  url.searchParams.set('latitude', String(coords.lat));
  url.searchParams.set('longitude', String(coords.lon));
  url.searchParams.set('hourly', HOURLY_FIELDS);
  url.searchParams.set('timezone', 'auto');
  // Noc n-ta kończy się rano dnia n+1, więc dób trzeba o jedną więcej.
  url.searchParams.set('forecast_days', String(Math.min(16, nights + 1)));

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Open-Meteo: ${res.status}`);
  const json = (await res.json()) as ApiResponse;

  const all = toHours(json);
  const DAY_MS = 86_400_000;

  return Array.from({ length: nights }, (_, i) => {
    const night = nightWindow(new Date(Date.now() + i * DAY_MS), coords);
    return {
      night,
      hours: all.filter((h) => h.at >= night.from && h.at <= night.to),
    };
  });
}
