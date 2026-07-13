import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { DEVICE_CITY } from '@/data/places';

export type LeadTime = '1h' | '2h' | '6h' | '12h';

export const LEAD_TIMES: LeadTime[] = ['1h', '2h', '6h', '12h'];

type Settings = {
  /** Name of the selected place; ignored while autoLocation is on. */
  location: string;
  autoLocation: boolean;
  notifications: boolean;
  leadTime: LeadTime;
  selectPlace: (name: string) => void;
  useGps: () => void;
  toggleAutoLocation: () => void;
  toggleNotifications: () => void;
  setLeadTime: (value: LeadTime) => void;
};

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState('Kraków');
  const [autoLocation, setAutoLocation] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [leadTime, setLeadTime] = useState<LeadTime>('2h');

  const value = useMemo<Settings>(
    () => ({
      location,
      autoLocation,
      notifications,
      leadTime,
      selectPlace: (name) => {
        setLocation(name);
        setAutoLocation(false);
      },
      useGps: () => {
        setAutoLocation(true);
        setLocation(DEVICE_CITY);
      },
      toggleAutoLocation: () =>
        setAutoLocation((on) => {
          if (!on) setLocation(DEVICE_CITY);
          return !on;
        }),
      toggleNotifications: () => setNotifications((v) => !v),
      setLeadTime,
    }),
    [location, autoLocation, notifications, leadTime],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
