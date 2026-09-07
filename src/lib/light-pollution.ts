import { Linking } from 'react-native';

/**
 * Mapa zanieczyszczenia światłem (lightpollutionmap.info).
 *
 * Serwis czyta współrzędne z fragmentu URL — sprawdzone w jego kodzie: parsuje
 * `zoom`, `lat` i `lon` z `window.location.hash`. Dzięki temu wchodzimy od razu
 * na wybraną miejscowość, a nie na środek świata.
 */
const BASE_URL = 'https://www.lightpollutionmap.info/';

/** Na tyle blisko, żeby widzieć łunę miast, i na tyle daleko, by szukać ciemnego miejsca. */
const DEFAULT_ZOOM = 10;

function lightPollutionMapUrl(lat: number, lon: number, zoom = DEFAULT_ZOOM): string {
  return `${BASE_URL}#zoom=${zoom}&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
}

export function openLightPollutionMap(lat: number, lon: number): void {
  // Otwiera przeglądarkę systemową. Gdy się nie uda (brak przeglądarki),
  // nie ma czego pokazać — nie wywracamy z tego powodu ekranu.
  Linking.openURL(lightPollutionMapUrl(lat, lon)).catch(() => {});
}
