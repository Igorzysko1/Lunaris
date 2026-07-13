import { DEVICE_POSITION } from '@/data/places';
import { colors } from '@/theme';

const EARTH_RADIUS_KM = 6371;
const toRad = (x: number) => (x * Math.PI) / 180;

/** Great-circle distance from the device position, in kilometres. */
export function distanceFromDevice(lat: number, lon: number): number {
  const dLat = toRad(lat - DEVICE_POSITION.lat);
  const dLon = toRad(lon - DEVICE_POSITION.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(DEVICE_POSITION.lat)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
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
