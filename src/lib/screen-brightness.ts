/**
 * Jasność ekranu. W trybie czerwonym liczy się bardziej niż sam kolor: zjazd
 * do kilku procent robi dla adaptacji wzroku więcej niż przemalowanie interfejsu,
 * bo to ilość światła, a nie jego barwa, kasuje widzenie nocne.
 *
 * Zmieniamy jasność okna aplikacji, nie systemową — po wyjściu z Lunarisa
 * telefon ma świecić tak, jak świecił. `restoreSystemBrightnessAsync` oddaje
 * sterowanie systemowi, gdy tryb czerwony gaśnie.
 *
 * Moduł wczytujemy dopiero przy użyciu, tak samo jak czujniki w `use-device-roll`.
 * `expo-brightness` sięga po moduł natywny już przy imporcie, więc w buildzie bez
 * niego import wywróciłby całą aplikację przy starcie — ten plik wisi pod
 * `src/ui/theme.tsx`, czyli pod korzeniem. Opakowanie samych wywołań w `try`
 * niczego nie ratuje, bo do wywołania nigdy by nie doszło.
 */

/** Ekran nie gaśnie do zera: 1% to najniższa jasność, przy której coś widać. */
const MIN_PERCENT = 1;

/** Ustawia jasność na podany procent; `null` oddaje sterowanie systemowi. */
export async function applyBrightness(percent: number | null): Promise<void> {
  try {
    const Brightness = await import('expo-brightness');

    if (percent === null) {
      await Brightness.restoreSystemBrightnessAsync();
      return;
    }

    await Brightness.setBrightnessAsync(Math.min(100, Math.max(MIN_PERCENT, percent)) / 100);
  } catch {
    // Build bez modułu natywnego (albo starszy klient deweloperski): tryb
    // czerwony ma wtedy działać bez sterowania jasnością, a nie wywracać ekran.
  }
}
