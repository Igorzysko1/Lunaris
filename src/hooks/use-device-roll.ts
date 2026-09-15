import { useEffect, useState } from 'react';

/** Co ile czytamy czujnik — płynnie dla oka, bez zjadania baterii. */
const INTERVAL_MS = 100;

/**
 * Obrót telefonu wokół osi ekranu, w stopniach — do „podążaj za telefonem".
 * Liczony z kierunku grawitacji w płaszczyźnie ekranu.
 *
 * Moduł czujników wczytujemy dopiero przy włączeniu: build bez `expo-sensors`
 * rzuciłby już przy imporcie, a panel gwiazdozbioru ma działać także w nim —
 * wtedy `available` jest `false` i przycisk to mówi. Znak kąta do sprawdzenia
 * na telefonie: Android i iOS podają grawitację z przeciwnymi zwrotami osi.
 */
export function useDeviceRoll(enabled: boolean): {
  roll: number | null;
  available: boolean | null;
} {
  const [roll, setRoll] = useState<number | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let subscription: { remove: () => void } | null = null;

    void (async () => {
      try {
        const { DeviceMotion } = await import('expo-sensors');
        const ok = await DeviceMotion.isAvailableAsync();
        if (!active) return;

        setAvailable(ok);
        if (!ok) return;

        DeviceMotion.setUpdateInterval(INTERVAL_MS);
        subscription = DeviceMotion.addListener(({ accelerationIncludingGravity: gravity }) => {
          if (gravity) setRoll((Math.atan2(gravity.x, -gravity.y) * 180) / Math.PI);
        });
      } catch {
        if (active) setAvailable(false);
      }
    })();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled]);

  return { roll: enabled ? roll : null, available };
}
