/**
 * Jasność ekranu. W trybie czerwonym liczy się bardziej niż sam kolor: zjazd
 * do kilku procent robi dla adaptacji wzroku więcej niż przemalowanie interfejsu,
 * bo to ilość światła, a nie jego barwa, kasuje widzenie nocne.
 *
 * Zmieniamy jasność okna aplikacji, nie systemową — po wyjściu z Lunarisa
 * telefon ma świecić tak, jak świecił. `restoreSystemBrightnessAsync` oddaje
 * sterowanie systemowi, gdy tryb czerwony gaśnie.
 */

import * as Brightness from 'expo-brightness';

/** Ekran nie gaśnie do zera: 1% to najniższa jasność, przy której coś widać. */
const MIN_PERCENT = 1;

/** Ustawia jasność na podany procent; `null` oddaje sterowanie systemowi. */
export async function applyBrightness(percent: number | null): Promise<void> {
  try {
    if (percent === null) {
      await Brightness.restoreSystemBrightnessAsync();
      return;
    }

    await Brightness.setBrightnessAsync(Math.min(100, Math.max(MIN_PERCENT, percent)) / 100);
  } catch {
    // Moduł natywny wchodzi dopiero z nowym buildem deweloperskim, a przed nim
    // każde wywołanie rzuca. Tryb czerwony ma wtedy działać bez sterowania
    // jasnością, a nie wywracać ekran.
  }
}
