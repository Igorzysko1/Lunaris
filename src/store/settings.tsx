import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { newSiteId, siteAsPlace, type ObservingSite } from '@/data/observing-sites';
import { skyQualityAt, type BortleSource } from '@/lib/sky-map';
import type { HorizonMask, HorizonOverride } from '@/lib/horizon';
import { FALLBACK_POSITION, findPlaceById, nearestPlace, type Coords } from '@/data/places';
import { DEFAULT_CONFIG, clampConfig, type LunarisConfig } from '@/lib/config';
import { defaultProfile, type OpticsProfile } from '@/lib/optics';
import {
  LEAD_TIMES,
  loadSettings,
  saveSettings,
  type LeadTime,
  type PersistedSettings,
} from '@/lib/settings-storage';
import { useDeviceLocation, type LocationStatus } from '@/hooks/use-device-location';

export { LEAD_TIMES, type LeadTime };
export type { LunarisConfig };

/** Miejsce, dla którego liczymy pogodę i ocenę nocy — niezależnie od tego, skąd się wzięło. */
export type ActiveLocation = {
  label: string;
  coords: Coords;
  bortle: number;
  source: 'gps' | 'manual';
  /**
   * Skąd wzięła się jakość nieba: policzona dla tego punktu z mapy jasności,
   * czy odziedziczona po najbliższej miejscowości. To dwie różne wiarygodności
   * i UI ma je rozróżniać, a nie podawać obu jako pewnik.
   */
  bortleSource: BortleSource;
  /** Maska horyzontu miejsca, gdy je znamy — dla GPS i miast jej nie ma. */
  horizonMask: HorizonMask | null;
  horizonOverrides: HorizonOverride[];
  /**
   * Marsz od parkingu do stanowiska w minutach — zna go tylko katalog miejsc.
   * Dla miejscowości z bazy i dla pozycji z GPS zostaje zerem: nie wiemy wtedy,
   * gdzie użytkownik faktycznie stanie.
   */
  walkMinutes: number;
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
  /** Nie hook, tylko akcja: przełącza źródło pozycji na GPS. */
  enableGps: () => void;
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
  /**
   * Notatki z wyjazdu przy miejscówce — jedyne pole katalogu, które zmienia się
   * po każdej sesji, więc jedyne edytowalne z aplikacji.
   */
  updateSiteNotes: (id: string, notes: string) => void;
  /**
   * Zapisuje punkt, w którym użytkownik właśnie stoi, jako nowe miejsce.
   * Zwraca jego identyfikator, żeby wywołujący mógł od razu je wybrać.
   */
  addSiteAt: (name: string, coords: Coords, accuracyM: number | null) => string;
  /** Przesuwa istniejące miejsce na zmierzoną pozycję, resztę zostawiając. */
  moveSite: (id: string, coords: Coords, accuracyM: number | null) => void;
  /** Usuwa miejsce z katalogu. */
  removeSite: (id: string) => void;
  /** Dopisuje ręczną korektę horyzontu dla sektora — bije policzoną maskę. */
  addHorizonOverride: (id: string, override: HorizonOverride) => void;
  /** Usuwa korektę po jej pozycji na liście. */
  removeHorizonOverride: (id: string, index: number) => void;
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
      // Mapa jasności zna ten konkretny punkt; najbliższa miejscowość to
      // zabudowa i oświetlenie, więc dziedziczenie zaniża niebo dokładnie tam,
      // gdzie się obserwuje. Zostaje wyłącznie dla punktów spoza mapy.
      const sky = skyQualityAt(device.coords.lat, device.coords.lon, near.bortle);

      return {
        label: device.label ?? near.name,
        coords: device.coords,
        bortle: sky.bortle,
        source: 'gps',
        bortleSource: sky.source,
        horizonMask: null,
        horizonOverrides: [],
        walkMinutes: 0,
        gpsStatus: device.status,
      };
    }

    // Brak GPS (wyłączony, odmowa, brak sygnału) — wracamy do wyboru ręcznego.
    // Najpierw katalog miejscówek, bo tylko one wiedzą o dojściu od parkingu.
    const site = config.sites.find((s) => s.id === placeId);
    const place = site
      ? siteAsPlace(site)
      : (findPlaceById(placeId) ?? nearestPlace(FALLBACK_POSITION));

    const sky = skyQualityAt(place.lat, place.lon, place.bortle);

    return {
      label: place.name,
      coords: { lat: place.lat, lon: place.lon },
      bortle: sky.bortle,
      source: 'manual',
      bortleSource: sky.source,
      horizonMask: site?.horizonMask ?? null,
      horizonOverrides: site?.horizonOverrides ?? [],
      walkMinutes: site?.walkMinutes ?? 0,
      gpsStatus: device.status,
    };
  }, [autoLocation, device.coords, device.label, device.status, placeId, config.sites]);

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
      enableGps: () => setAutoLocation(true),
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
      updateSiteNotes: (id, notes) =>
        setPersisted((s) => ({
          ...s,
          config: clampConfig({
            ...s.config,
            sites: s.config.sites.map((site) => (site.id === id ? { ...site, notes } : site)),
          }),
        })),
      addSiteAt: (name, coords, accuracyM) => {
        const id = newSiteId();

        setPersisted((s) => {
          const site: ObservingSite = {
            id,
            name: name.trim() || 'Nowe miejsce',
            // Region tylko do wyświetlenia; z terenu bierzemy najbliższą znaną
            // miejscowość, bo geokodowanie wymagałoby sieci, której tam nie ma.
            region: nearestPlace(coords).name,
            lat: coords.lat,
            lon: coords.lon,
            // Zapas na wypadek punktu spoza mapy jasności nieba; gdy punkt na
            // niej leży, i tak liczy się go z mapy.
            bortle: nearestPlace(coords).bortle,
            // Skoro stoisz na stanowisku, marsz jest już za tobą.
            walkMinutes: 0,
            notes: '',
            accuracyM,
            // Maska wymaga modelu terenu i liczy się poza aplikacją — punkt
            // zapisany w terenie czeka na nią do powrotu w zasięg.
            horizonMask: null,
            horizonOverrides: [],
          };

          return {
            ...s,
            config: clampConfig({ ...s.config, sites: [...s.config.sites, site] }),
          };
        });

        return id;
      },
      moveSite: (id, coords, accuracyM) =>
        setPersisted((s) => ({
          ...s,
          config: clampConfig({
            ...s.config,
            sites: s.config.sites.map((site) =>
              site.id === id ? { ...site, ...coords, accuracyM } : site,
            ),
          }),
        })),
      removeSite: (id) =>
        setPersisted((s) => ({
          ...s,
          config: clampConfig({
            ...s.config,
            sites: s.config.sites.filter((site) => site.id !== id),
          }),
        })),
      addHorizonOverride: (id, override) =>
        setPersisted((s) => ({
          ...s,
          config: clampConfig({
            ...s.config,
            sites: s.config.sites.map((site) =>
              site.id === id
                ? { ...site, horizonOverrides: [...site.horizonOverrides, override] }
                : site,
            ),
          }),
        })),
      removeHorizonOverride: (id, index) =>
        setPersisted((s) => ({
          ...s,
          config: clampConfig({
            ...s.config,
            sites: s.config.sites.map((site) =>
              site.id === id
                ? { ...site, horizonOverrides: site.horizonOverrides.filter((_, i) => i !== index) }
                : site,
            ),
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
