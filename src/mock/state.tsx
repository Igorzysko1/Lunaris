import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Przełączniki stanów makiety. Pozwalają obejrzeć rozrysowane warianty — noc
 * w trakcie, brak konta Google — bez czekania, aż zdarzą się naprawdę. Znikają
 * razem z makietą, gdy ekrany dostaną dane. Prognoza i werdykt są już prawdziwe
 * (etap 1), więc ich przełączników tu nie ma.
 */

export type SessionMock = 'before' | 'live';

export type MockValues = {
  session: SessionMock;
  googleConnected: boolean;
};

type MockContextValue = MockValues & { set: (patch: Partial<MockValues>) => void };

const DEFAULTS: MockValues = {
  session: 'before',
  googleConnected: true,
};

const MockContext = createContext<MockContextValue>({ ...DEFAULTS, set: () => {} });

export function MockProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState(DEFAULTS);
  const value = useMemo(
    () => ({
      ...values,
      set: (patch: Partial<MockValues>) => setValues((current) => ({ ...current, ...patch })),
    }),
    [values],
  );

  return <MockContext.Provider value={value}>{children}</MockContext.Provider>;
}

export function useMock() {
  return useContext(MockContext);
}
