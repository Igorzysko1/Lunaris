// Importy względne (nie alias @/), żeby warstwę domenową dało się uruchomić
// poza Metro — korzysta z niej skrypt scripts/check-weather.ts.
import type { Coords } from '../data/places.ts';
import { colors } from '../theme.ts';

const EARTH_RADIUS_KM = 6371;
const toRad = (x: number) => (x * Math.PI) / 180;

/** Odległość po wielkim kole między dwoma punktami, w kilometrach. */
export function distanceKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return 'tu jesteś';
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function bortleMeta(bortle: number): { label: string; color: string } {
  if (bortle <= 3) return { label: 'CIEMNE', color: colors.teal };
  if (bortle <= 5) return { label: 'PODMIEJSKIE', color: colors.amber };
  return { label: 'MIEJSKIE', color: colors.coral };
}

export type RatingInputs = {
  /** Średnie zachmurzenie w oknie nocy (%). */
  avgCloud: number;
  avgHumidity: number;
  /** Suma opadów w oknie nocy (mm). */
  precipitation: number;
  /** Oświetlenie tarczy Księżyca (%). */
  moonIllumination: number;
  bortle: number;
};

/**
 * Ocena nocy 0–100. Zachmurzenie dominuje, reszta koryguje.
 *
 * Wagi są ustalone arbitralnie (patrz Lunaris/30 Decyzje) — nie wynikają z modelu
 * fizycznego. Wilgotność karze dopiero powyżej 70%, bo poniżej nie przeszkadza.
 */
export function computeNightRating(input: RatingInputs): number {
  const cloudPenalty = 0.6 * input.avgCloud;
  const humidityPenalty = 0.15 * Math.max(0, input.avgHumidity - 70) * 2;
  const precipPenalty = 10 * Math.min(1, input.precipitation);
  const moonPenalty = 0.15 * input.moonIllumination;
  const bortlePenalty = 2 * (input.bortle - 1);

  const score = 100 - cloudPenalty - humidityPenalty - precipPenalty - moonPenalty - bortlePenalty;

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function ratingMeta(rating: number): { label: string; color: string } {
  if (rating >= 80) return { label: 'Doskonała', color: colors.teal };
  if (rating >= 60) return { label: 'Dobra', color: colors.green };
  if (rating >= 40) return { label: 'Przeciętna', color: colors.amber };
  return { label: 'Słaba', color: colors.coral };
}

/** Colour for a single cloud-cover bar: the more cloud, the worse. */
export function cloudBarColor(cloudPct: number): string {
  if (cloudPct < 20) return colors.teal;
  if (cloudPct < 40) return colors.green;
  if (cloudPct < 70) return colors.amber;
  return colors.coral;
}

/**
 * Ryzyko osiadania rosy na optyce, wg różnicy temperatury i punktu rosy (°C).
 * Im ciaśniej temperatura zbliża się do punktu rosy, tym szybciej zaparuje sprzęt.
 *
 * Próg ostrzeżenia przychodzi z konfiguracji, a nie jest tu zaszyty — inaczej
 * jego zmiana w ustawieniach rozjechałaby kolor z werdyktem silnika. Strefa
 * pośrednia to dwa i pół raza próg: tyle zapasu, żeby zdążyć zareagować.
 */
export function dewRiskColor(spreadC: number, warnBelowC: number): string {
  if (spreadC < warnBelowC) return colors.coral;
  if (spreadC < warnBelowC * 2.5) return colors.amber;
  return colors.teal;
}
