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
import { DEFAULT_CONFIG, clampConfig, type LunarisConfig } from '@/lib/config';
import { defaultProfile, type OpticsProfile } from '@/lib/optics';
import {
  LEAD_TIMES,
  loadSettings,
  saveSettings,
  type LeadTime,
  type PersistedSettings,
} from '@/lib/settings-storage';
import { useDeviceLocation, type LocationStatus } from '@/lib/use-device-location';

export { LEAD_TIMES, type LeadTime };
export type { LunarisConfig };

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
  /** Jedno źródło prawdy dla progów, profilu obserwatora i parametrów sprzętu. */
  config: LunarisConfig;
  /** Czy wczytaliśmy już zapisane ustawienia — do czasu tego UI nie ma czego pokazywać. */
  hydrated: boolean;
  active: ActiveLocation;
  selectPlace: (id: string) => void;
  useGps: () => void;
  toggleAutoLocation: () => void;
  toggleNotifications: () => void;
  setLeadTime: (value: LeadTime) => void;
  /**
   * Zmiana wybranych pól jednej sekcji konfiguracji; reszta zostaje bez zmian.
   * Wynik przechodzi przez walidację, więc UI nie musi pilnować zakresów.
   */
  updateConfig: <K extends keyof LunarisConfig>(
    section: K,
    patch: Partial<LunarisConfig[K]>,
  ) => void;
  /** Dodaje zestaw sprzętu na koniec listy. */
  addOpticsProfile: () => void;
  /** Zmienia nazwę albo wybrane parametry jednego zestawu. */
  updateOpticsProfile: (
    id: string,
    patch: { label?: string; optics?: Partial<OpticsProfile['optics']> },
  ) => void;
  /** Usuwa zestaw. Ostatniego nie da się usunąć — lista nie może być pusta. */
  removeOpticsProfile: (id: string) => void;
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
    config: DEFAULT_CONFIG,
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [{ placeId, autoLocation, notifications, leadTime, config }, setPersisted] =
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
    void saveSettings({ placeId, autoLocation, notifications, leadTime, config });
  }, [hydrated, placeId, autoLocation, notifications, leadTime, config]);

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
      config,
      hydrated,
      active,
      selectPlace: (id) => setPersisted((s) => ({ ...s, placeId: id, autoLocation: false })),
      useGps: () => setAutoLocation(true),
      toggleAutoLocation: () => setAutoLocation((on) => !on),
      toggleNotifications: () => setPersisted((s) => ({ ...s, notifications: !s.notifications })),
      setLeadTime: (value) => setPersisted((s) => ({ ...s, leadTime: value })),
      updateConfig: (section, patch) =>
        setPersisted((s) => ({
          ...s,
          config: clampConfig({ ...s.config, [section]: { ...s.config[section], ...patch } }),
        })),
      addOpticsProfile: () =>
        setPersisted((s) => ({
          ...s,
          config: clampConfig({
            ...s.config,
            opticsProfiles: [...s.config.opticsProfiles, { ...defaultProfile(), label: '' }],
          }),
        })),
      updateOpticsProfile: (id, patch) =>
        setPersisted((s) => ({
          ...s,
          config: clampConfig({
            ...s.config,
            opticsProfiles: s.config.opticsProfiles.map((p) =>
              p.id === id ? { ...p, ...patch, optics: { ...p.optics, ...patch.optics } } : p,
            ),
          }),
        })),
      removeOpticsProfile: (id) =>
        setPersisted((s) => {
          // clampConfig przywróciłby zestaw domyślny, ale użytkownik straciłby swój —
          // dlatego ostatniego po prostu nie usuwamy.
          if (s.config.opticsProfiles.length <= 1) return s;
          return {
            ...s,
            config: clampConfig({
              ...s.config,
              opticsProfiles: s.config.opticsProfiles.filter((p) => p.id !== id),
            }),
          };
        }),
      retryGps: device.retry,
    }),
    [placeId, autoLocation, notifications, leadTime, config, hydrated, active, device.retry],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
