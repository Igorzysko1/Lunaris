import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  GOOGLE_AVAILABLE,
  connectGoogle,
  disconnectGoogle,
  isGoogleConnected,
  onConnectionChange,
  type ConnectResult,
} from '@/lib/google-account';

type GoogleState = {
  /** Czy logowanie w ogóle działa w tym środowisku — w Expo Go nie. */
  available: boolean;
  /**
   * `null` do czasu odczytu schowka. Przycisk „Połącz" nie może mignąć komuś,
   * kto jest połączony, więc do tej chwili nie pokazujemy żadnego.
   */
  connected: boolean | null;
  busy: boolean;
  connect: () => Promise<ConnectResult>;
  disconnect: () => Promise<void>;
};

const GoogleContext = createContext<GoogleState | null>(null);

/**
 * Stan konta Google wspólny dla ekranów.
 *
 * Provider, bo o połączeniu rozstrzyga jedno miejsce, a patrzą na nie
 * Ustawienia, karty sesji i przegląd miejscówek. Odłączenie wykryte przy
 * odświeżaniu tokenu przychodzi z modułu konta zdarzeniem, więc dociera do
 * wszystkich naraz.
 */
export function GoogleProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState<boolean | null>(GOOGLE_AVAILABLE ? null : false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!GOOGLE_AVAILABLE) return;

    let active = true;
    void isGoogleConnected().then((value) => {
      if (active) setConnected(value);
    });
    const unsubscribe = onConnectionChange((value) => {
      if (active) setConnected(value);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      return await connectGoogle();
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await disconnectGoogle();
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<GoogleState>(
    () => ({ available: GOOGLE_AVAILABLE, connected, busy, connect, disconnect }),
    [connected, busy, connect, disconnect],
  );

  return <GoogleContext.Provider value={value}>{children}</GoogleContext.Provider>;
}

export function useGoogle(): GoogleState {
  const context = useContext(GoogleContext);
  if (!context) throw new Error('useGoogle wymaga GoogleProvider nad drzewem ekranów.');
  return context;
}
