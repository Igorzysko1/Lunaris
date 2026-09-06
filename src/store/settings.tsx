import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  FALLBACK_POSITION,
  findPlaceById,
  nearestPlace,
  type Coords,
} from '@/data/places';
import { DEFAULT_OPTICS, clampOptics, type Optics } from '@/lib/optics';
import {
  LEAD_TIMES,
  loadSettings,
  saveSettings,
  type LeadTime,
  type PersistedSettings,
} from '@/lib/settings-storage';
import { useDeviceLocation, type LocationStatus } from '@/lib/use-device-location';

export { LEAD_TIMES, type LeadTime };
export type { Optics };

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
  /** Miejscowość wybrana ręcznie z listy (po id). Ignorowana, gdy działa GPS. */
  placeId: string;
  /** Nazwa tej miejscowości — do wyświetlenia w ustawieniach. */
  placeName: string;
  autoLocation: boolean;
  notifications: boolean;
  leadTime: LeadTime;
  /** Parametry sprzętu — jedno źródło prawdy dla doboru celów. */
  optics: Optics;
  /** Czy wczytaliśmy już zapisane ustawienia — do czasu tego UI nie ma czego pokazywać. */
  hydrated: boolean;
  active: ActiveLocation;
  selectPlace: (id: string) => void;
  useGps: () => void;
  toggleAutoLocation: () => void;
  toggleNotifications: () => void;
  setLeadTime: (value: LeadTime) => void;
  /** Zmiana pojedynczego parametru optyki; reszta zostaje bez zmian. */
  updateOptics: (patch: Partial<Optics>) => void;
  retryGps: () => void;
};

const SettingsContext = createContext<Settings | null>(null);

/** Stan na pierwsze uruchomienie: miejscowość odpowiadająca pozycji zapasowej. */
function defaultSettings(): PersistedSettings {
  return {
    placeId: nearestPlace(FALLBACK_POSITION).id,
    autoLocation: false,
    notifications: true,
    leadTime: '2h',
    optics: DEFAULT_OPTICS,
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [{ placeId, autoLocation, notifications, leadTime, optics }, setPersisted] =
    useState<PersistedSettings>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);

  const setAutoLocation = (next: boolean | ((on: boolean) => boolean)) =>
    setPersisted((s) => ({
      ...s,
      autoLocation: typeof next === 'function' ? next(s.autoLocation) : next,
    }));

  useEffect(() => {
    let active = true;
    loadSettings(defaultSettings()).then((stored) => {
      if (!active) return;
      setPersisted(stored);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Zapisujemy dopiero po wczytaniu, żeby nie nadpisać dysku wartościami domyślnymi.
  useEffect(() => {
    if (!hydrated) return;
    void saveSettings({ placeId, autoLocation, notifications, leadTime, optics });
  }, [hydrated, placeId, autoLocation, notifications, leadTime, optics]);

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
    const place = findPlaceById(placeId) ?? nearestPlace(FALLBACK_POSITION);
    return {
      label: place.name,
      coords: { lat: place.lat, lon: place.lon },
      bortle: place.bortle,
      source: 'manual',
      gpsStatus: device.status,
    };
  }, [autoLocation, device.coords, device.label, device.status, placeId]);

  const value = useMemo<Settings>(
    () => ({
      placeId,
      placeName: findPlaceById(placeId)?.name ?? '—',
      autoLocation,
      notifications,
      leadTime,
      optics,
      hydrated,
      active,
      selectPlace: (id) => setPersisted((s) => ({ ...s, placeId: id, autoLocation: false })),
      useGps: () => setAutoLocation(true),
      toggleAutoLocation: () => setAutoLocation((on) => !on),
      toggleNotifications: () => setPersisted((s) => ({ ...s, notifications: !s.notifications })),
      setLeadTime: (value) => setPersisted((s) => ({ ...s, leadTime: value })),
      updateOptics: (patch) =>
        setPersisted((s) => ({ ...s, optics: clampOptics({ ...s.optics, ...patch }) })),
      retryGps: device.retry,
    }),
    [placeId, autoLocation, notifications, leadTime, optics, hydrated, active, device.retry],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
