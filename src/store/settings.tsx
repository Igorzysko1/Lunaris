import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  FALLBACK_CITY,
  findPlaceByName,
  nearestPlace,
  type Coords,
} from '@/data/places';
import { useDeviceLocation, type LocationStatus } from '@/lib/use-device-location';

export type LeadTime = '1h' | '2h' | '6h' | '12h';

export const LEAD_TIMES: LeadTime[] = ['1h', '2h', '6h', '12h'];

/** Miejsce, dla którego liczymy pogodę i ocenę nocy — niezależnie od tego, skąd się wzięło. */
export type ActiveLocation = {
  label: string;
  coords: Coords;
  bortle: number;
  source: 'gps' | 'manual';
  /** Gdy GPS jest włączony, ale nie zadziałał — UI musi to pokazać, a nie udawać. */
  gpsStatus: LocationStatus;
};

type Settings = {
  /** Miejscowość wybrana ręcznie z listy. Ignorowana, gdy działa GPS. */
  placeName: string;
  autoLocation: boolean;
  notifications: boolean;
  leadTime: LeadTime;
  active: ActiveLocation;
  selectPlace: (name: string) => void;
  useGps: () => void;
  toggleAutoLocation: () => void;
  toggleNotifications: () => void;
  setLeadTime: (value: LeadTime) => void;
  retryGps: () => void;
};

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [placeName, setPlaceName] = useState('Kraków');
  const [autoLocation, setAutoLocation] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [leadTime, setLeadTime] = useState<LeadTime>('2h');

  // Jedna instancja na całą aplikację — inaczej każdy ekran pytałby o uprawnienia osobno.
  const device = useDeviceLocation(autoLocation);

  const active = useMemo<ActiveLocation>(() => {
    if (autoLocation && device.coords) {
      // Bortle mamy tylko dla miejscowości z listy, więc dla dowolnego punktu GPS
      // bierzemy je z najbliższej znanej. To przybliżenie — patrz vault.
      const near = nearestPlace(device.coords);
      return {
        label: device.label ?? near.name,
        coords: device.coords,
        bortle: near.bortle,
        source: 'gps',
        gpsStatus: device.status,
      };
    }

    // Brak GPS (wyłączony, odmowa, brak sygnału) — wracamy do wyboru ręcznego.
    const place = findPlaceByName(placeName) ?? findPlaceByName(FALLBACK_CITY)!;
    return {
      label: place.name,
      coords: { lat: place.lat, lon: place.lon },
      bortle: place.bortle,
      source: 'manual',
      gpsStatus: device.status,
    };
  }, [autoLocation, device.coords, device.label, device.status, placeName]);

  const value = useMemo<Settings>(
    () => ({
      placeName,
      autoLocation,
      notifications,
      leadTime,
      active,
      selectPlace: (name) => {
        setPlaceName(name);
        setAutoLocation(false);
      },
      useGps: () => setAutoLocation(true),
      toggleAutoLocation: () => setAutoLocation((on) => !on),
      toggleNotifications: () => setNotifications((v) => !v),
      setLeadTime,
      retryGps: device.retry,
    }),
    [placeName, autoLocation, notifications, leadTime, active, device.retry],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
