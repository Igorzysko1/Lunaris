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

/**
 * Błąd pobierania prognozy, z rozróżnieniem powodu.
 *
 * `offline` znaczy, że żądanie w ogóle nie wyszło — w terenie to normalny stan,
 * a nie awaria, i wtedy sensownie jest pokazać ostatnie zapisane dane. `api`
 * znaczy, że serwer odpowiedział czymś innym niż prognozą; to problem po drugiej
 * stronie i użytkownik nie naprawi go wejściem na wzgórze po zasięg.
 */
export class ForecastError extends Error {
  // Pola zadeklarowane jawnie, a nie jako parametry konstruktora: parametry
  // z modyfikatorem generują kod, którego zdejmowanie typów w Node nie obsłuży,
  // a ten moduł uruchamia się także poza Metro (skrypt scripts/check-weather.ts).
  kind: 'offline' | 'api';
  status?: number;

  constructor(kind: 'offline' | 'api', message: string, status?: number) {
    super(message);
    this.name = 'ForecastError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * Jedno miejsce, w którym rozstrzyga się „nie ma sieci" kontra „serwer odmówił".
 * `fetch` odrzuca obietnicę tylko wtedy, gdy żądanie nie doszło; odpowiedź 500
 * jest z jego punktu widzenia sukcesem, więc status trzeba sprawdzić osobno.
 */
async function getJson(url: URL, signal?: AbortSignal): Promise<unknown> {
  let res: Response;

  try {
    res = await fetch(url.toString(), { signal });
  } catch (error) {
    // Przerwanie przez AbortController to nie awaria sieci — puszczamy dalej,
    // bo wywołujący i tak porzuca wynik.
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ForecastError('offline', 'Brak połączenia z siecią');
  }

  if (!res.ok) {
    throw new ForecastError('api', `Open-Meteo: ${res.status}`, res.status);
  }

  return res.json();
}

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

/** Zwija godziny okna do jednej oceny nocy. Wspólne dla wszystkich pobrań. */
function summarize(all: NightHour[], from: Date, to: Date): NightForecast {
  const hours = all.filter((h) => h.at >= from && h.at <= to);

  if (hours.length === 0) throw new ForecastError('api', 'Brak danych dla okna nocy');

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

  const json = (await getJson(url, signal)) as ApiResponse;
  const { from, to } = sunWindow(json.daily, new Date());

  return summarize(toHours(json), from, to);
}

/** Prognoza godzinowa przypisana do konkretnej nocy astronomicznej. */
export type NightSlice = {
  night: NightWindow;
  hours: NightHour[];
};

/**
 * Kolejne noce dla wielu punktów naraz — jednym żądaniem.
 *
 * Okna liczymy z efemeryd (zmierzch i świt astronomiczny), a nie z zachodu
 * Słońca zwracanego przez API: silnik ocenia ciemne niebo, a nie porę po
 * zachodzie.
 *
 * Open-Meteo przyjmuje listę współrzędnych po przecinku i odpowiada tablicą,
 * po jednym wpisie na punkt, w tej samej kolejności. To jedyny sposób, żeby
 * przegląd całego katalogu miejscówek nie kosztował tylu żądań, ile miejsc —
 * limit darmowego API liczy się od liczby współrzędnych, ale jedno żądanie
 * zamiast dziesięciu to dziesięć razy mniej okazji do zerwania połączenia
 * w połowie i dziesięć razy mniej opóźnienia w terenie.
 *
 * Wynik jest tablicą równoległą do wejścia: `wynik[i]` dotyczy `points[i]`.
 */
export async function fetchUpcomingNightsForPoints(
  points: Coords[],
  nights: number,
  signal?: AbortSignal,
): Promise<NightSlice[][]> {
  if (points.length === 0) return [];

  const url = new URL(API);
  url.searchParams.set('latitude', points.map((p) => p.lat).join(','));
  url.searchParams.set('longitude', points.map((p) => p.lon).join(','));
  url.searchParams.set('hourly', HOURLY_FIELDS);
  url.searchParams.set('timezone', 'auto');
  // Noc n-ta kończy się rano dnia n+1, więc dób trzeba o jedną więcej.
  url.searchParams.set('forecast_days', String(Math.min(16, nights + 1)));

  const json = await getJson(url, signal);

  // Dla jednego punktu API odpowiada obiektem, dla wielu — tablicą. Sprowadzamy
  // do jednego kształtu, żeby dalej był jeden przypadek zamiast dwóch.
  const responses = (Array.isArray(json) ? json : [json]) as ApiResponse[];

  if (responses.length !== points.length) {
    throw new ForecastError(
      'api',
      `Open-Meteo zwróciło ${responses.length} punktów zamiast ${points.length}`,
    );
  }

  return responses.map((response, index) => sliceNights(toHours(response), points[index], nights));
}

/**
 * Rozkłada godziny prognozy na kolejne noce astronomiczne danego punktu.
 *
 * Okno liczymy dla KAŻDEGO punktu osobno: zmierzch na Hali Lipowskiej wypada
 * o innej porze niż na Pustyni Błędowskiej, a przy porównywaniu miejsc
 * oddalonych o sto kilometrów to już nie jest zaokrąglenie.
 *
 * Kolejne doby liczone kalendarzowo, nie przez dorzucanie 24 godzin: doba
 * zmiany czasu ma 23 albo 25 godzin i przy dodawaniu milisekund któraś noc
 * wypadłaby dwa razy albo zniknęła z listy.
 */
function sliceNights(all: NightHour[], coords: Coords, nights: number): NightSlice[] {
  const dayFromNow = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  };

  return Array.from({ length: nights }, (_, i) => {
    const night = nightWindow(dayFromNow(i), coords);
    return { night, hours: all.filter((h) => h.at >= night.from && h.at <= night.to) };
  });
}

/**
 * Komplet danych sieciowych dla jednego punktu — jedno pobranie na cały cykl.
 *
 * Ekran Noc i silnik sesji potrzebują dwóch różnych okien tych samych godzin:
 * pierwszy patrzy od zachodu do wschodu Słońca, drugi na zmierzch i świt
 * astronomiczny. Dotąd każdy pobierał osobno, o zachodzące na siebie zakresy —
 * dwa żądania o te same dane. Tu jedno pobranie karmi oba widoki.
 */
export type ForecastBundle = {
  /** Bieżąca noc w oknie Słońca. */
  current: NightForecast;
  /** Kolejne noce w oknie astronomicznym, od dzisiejszego wieczora. */
  nights: NightSlice[];
};

export async function fetchForecastBundle(
  coords: Coords,
  nights: number,
  signal?: AbortSignal,
): Promise<ForecastBundle> {
  const url = new URL(API);
  url.searchParams.set('latitude', String(coords.lat));
  url.searchParams.set('longitude', String(coords.lon));
  url.searchParams.set('hourly', HOURLY_FIELDS);
  url.searchParams.set('daily', 'sunrise,sunset');
  url.searchParams.set('timezone', 'auto');
  // Doba wstecz jest potrzebna przed świtem: trwa wtedy noc, która zaczęła się
  // wczoraj, a bez niej okno bieżącej nocy nie miałoby początku.
  url.searchParams.set('past_days', '1');
  // Noc n-ta kończy się rano dnia n+1, więc dób trzeba o jedną więcej.
  url.searchParams.set('forecast_days', String(Math.min(16, Math.max(2, nights + 1))));

  const json = (await getJson(url, signal)) as ApiResponse;
  const all = toHours(json);
  const { from, to } = sunWindow(json.daily, new Date());

  return { current: summarize(all, from, to), nights: sliceNights(all, coords, nights) };
}
