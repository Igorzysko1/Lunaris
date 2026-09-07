import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

import { nearestPlace, type Coords } from '@/data/places';

export type LocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unavailable';

export type DeviceLocation = {
  status: LocationStatus;
  coords: Coords | null;
  /** Nazwa miejsca — z geokodowania wstecznego, a gdy ono zawiedzie, najbliższa znana miejscowość. */
  label: string | null;
};

/**
 * Prawdziwa pozycja urządzenia. Pytamy o nią dopiero, gdy użytkownik włączy GPS —
 * nie zaczepiamy go promptem o uprawnienia przy pierwszym uruchomieniu.
 */
export function useDeviceLocation(enabled: boolean): DeviceLocation & { retry: () => void } {
  const [state, setState] = useState<DeviceLocation>({
    status: 'idle',
    coords: null,
    label: null,
  });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      // Wyłączony GPS ma natychmiast wyczyścić pozycję, a nie zostawić starą.
      setState({ status: 'idle', coords: null, label: null });
      return;
    }

    let active = true;

    (async () => {
      setState((s) => ({ ...s, status: 'loading' }));

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!active) return;

      if (status !== Location.PermissionStatus.GRANTED) {
        setState({ status: 'denied', coords: null, label: null });
        return;
      }

      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) return;

        const coords: Coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };

        setState({ status: 'granted', coords, label: await resolveLabel(coords) });
      } catch {
        // Lokalizacja wyłączona w systemie albo brak sygnału.
        if (active) setState({ status: 'unavailable', coords: null, label: null });
      }
    })();

    return () => {
      active = false;
    };
  }, [enabled, attempt]);

  return { ...state, retry };
}

/** Geokodowanie wsteczne bywa niedostępne (brak sieci, brak usługi) — wtedy bierzemy najbliższe miasto. */
async function resolveLabel(coords: Coords): Promise<string> {
  try {
    const [address] = await Location.reverseGeocodeAsync({
      latitude: coords.lat,
      longitude: coords.lon,
    });
    const name = address?.city ?? address?.subregion ?? address?.name;
    if (name) return name;
  } catch {
    // ignorujemy — mamy fallback
  }
  return nearestPlace(coords).name;
}
