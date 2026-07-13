export type ScenarioKey = 'Dobra' | 'Przeciętna' | 'Słaba';

export type NightData = {
  /** 0–100 overall observing score for the night. */
  rating: number;
  clouds: number;
  humidity: number;
  visibility: number;
  precipitation: number;
  /** Cloud cover % sampled at each entry of CHART_TIMES. */
  bars: number[];
};

/** Half-hour slots the cloud-cover chart is sampled at. */
export const CHART_TIMES = [
  '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30', '00:00',
  '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30',
];

export const SCENARIOS: Record<ScenarioKey, NightData> = {
  Dobra: {
    rating: 74,
    clouds: 24,
    humidity: 58,
    visibility: 28,
    precipitation: 0,
    bars: [12, 8, 15, 22, 18, 14, 20, 16, 10, 8, 12, 25, 30, 22, 15],
  },
  Przeciętna: {
    rating: 52,
    clouds: 46,
    humidity: 72,
    visibility: 14,
    precipitation: 0.2,
    bars: [35, 42, 38, 48, 55, 50, 44, 40, 52, 60, 55, 48, 42, 38, 45],
  },
  Słaba: {
    rating: 26,
    clouds: 84,
    humidity: 88,
    visibility: 6,
    precipitation: 3.4,
    bars: [78, 85, 80, 88, 92, 85, 80, 75, 82, 90, 88, 80, 85, 90, 84],
  },
};

export const ASTRO_TIMES = {
  sunset: '20:43',
  moonrise: '22:15',
  moonset: '09:30',
  sunrise: '04:28',
};

export const MOON_PHASE = {
  glyph: '🌔',
  name: 'Przybywający garbaty',
  detail: 'Pełnia za 3 dni · 15 lip.',
  illumination: 71,
};

export const TODAY_LABEL = 'Niedziela, 12 lipca';
