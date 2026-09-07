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

/** Pozycja złapana na żądanie, razem z tym, jak bardzo można jej ufać. */
export type PositionFix = {
  coords: Coords;
  /** Promień niepewności w metrach; `null`, gdy system go nie podaje. */
  accuracyM: number | null;
};

export type CaptureResult =
  { ok: true; fix: PositionFix } | { ok: false; reason: 'denied' | 'unavailable' };

/**
 * Jednorazowy odczyt pozycji — do zapisania miejsca, w którym się właśnie stoi.
 *
 * Osobno od `useDeviceLocation`, bo to inna czynność: tamto śledzi pozycję na
 * potrzeby prognozy i jest związane z przełącznikiem GPS w ustawieniach, a to
 * jest gest wykonywany raz, niezależnie od tego, czy śledzenie jest włączone.
 *
 * **Działa bez sieci.** GNSS jej nie potrzebuje, a to właśnie w terenie bez
 * zasięgu ta funkcja ma sens. Dlatego nie wołamy tu geokodowania wstecznego —
 * nazwę nadaje użytkownik, a nie usługa, której akurat nie ma.
 *
 * Dokładność bierzemy wyższą niż przy śledzeniu: punkt zapisuje się raz i na
 * stałe, więc kilkanaście sekund dłuższy pomiar jest tego wart.
 */
export async function capturePosition(): Promise<CaptureResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) return { ok: false, reason: 'denied' };

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      ok: true,
      fix: {
        coords: { lat: position.coords.latitude, lon: position.coords.longitude },
        accuracyM: position.coords.accuracy ?? null,
      },
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
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
