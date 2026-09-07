/**
 * Maska horyzontu: wysokość przeszkody osobno dla każdego azymutu.
 *
 * Stały próg „cel poniżej 15° się nie liczy" jest zgadywaniem uśrednionym po
 * wszystkich kierunkach i myli się w obie strony naraz. W konkretnym miejscu na
 * południe może stać ściana lasu do 20°, a na północ być czysto do 5° — wtedy
 * jeden próg jednocześnie obiecuje cele, których nie widać, i chowa te, które
 * widać. Maska zastępuje go 360 liczbami policzonymi z modelu terenu.
 *
 * Sama maska powstaje poza aplikacją: to rachunek na dwóch rastrach i dziesiątkach
 * milionów próbek. Telefon dostaje gotowe liczby i nie wie, z czego powstały.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

/**
 * Wysokość przeszkody w stopniach dla azymutów 0–359 (0 = północ, 90 = wschód).
 * Zawsze 360 wartości — brak maski wyraża się przez `null` w miejscu, nie przez
 * krótszą tablicę.
 */
export type HorizonMask = number[];

/**
 * Ręczna korekta sektora: „od 150° do 220° las zasłania do 20°".
 *
 * Ma pierwszeństwo przed policzoną maską, bo jedna linijka wpisana po wyjeździe
 * bije każdy model: nalot lotniczy jest sprzed kilku lat, a las przez ten czas
 * urósł albo został wycięty.
 */
export type HorizonOverride = {
  /** Początek sektora w stopniach azymutu. */
  from: number;
  /** Koniec sektora; sektor może przechodzić przez północ (np. 350 → 20). */
  to: number;
  /** Wysokość przeszkody w stopniach. */
  altitude: number;
};

/**
 * Próg zapasowy dla miejsc bez maski: poniżej tej wysokości obserwacja i tak
 * traci sens przez ekstynkcję atmosferyczną, niezależnie od tego, co stoi na
 * horyzoncie. To ta sama liczba, która wcześniej obowiązywała wszędzie.
 */
export const DEFAULT_HORIZON = 15;

const norm = (azimuth: number) => ((Math.round(azimuth) % 360) + 360) % 360;

/** Czy azymut mieści się w sektorze, który może przechodzić przez północ. */
function inSector(azimuth: number, from: number, to: number): boolean {
  const a = norm(azimuth);
  const f = norm(from);
  const t = norm(to);

  return f <= t ? a >= f && a <= t : a >= f || a <= t;
}

/**
 * Wysokość horyzontu dla danego azymutu.
 *
 * Kolejność jest regułą, nie szczegółem: ręczna korekta bije policzoną maskę,
 * a brak jednego i drugiego oznacza próg zapasowy. Przy nakładających się
 * korektach wygrywa wyższa — przy niepewności bierzemy wartość gorszą, bo lepiej
 * nie obiecać celu, niż obiecać niewidoczny.
 */
export type HorizonPoint = {
  altitude: number;
  /**
   * Czy ta wysokość pochodzi z terenu (maski albo korekty), czy jest progiem
   * zapasowym. Bez tego rozróżnienia nie da się powiedzieć, czy cel odpadł
   * „za terenem na SW", czy po prostu „za nisko" — a to dwie różne informacje:
   * pierwszą naprawia przejście dwustu metrów, drugiej nie naprawi nic.
   */
  fromTerrain: boolean;
};

export function horizonAt(
  azimuth: number,
  mask: HorizonMask | null,
  overrides: HorizonOverride[] = [],
): HorizonPoint {
  const manual = overrides.filter((o) => inSector(azimuth, o.from, o.to)).map((o) => o.altitude);

  if (manual.length > 0) return { altitude: Math.max(...manual), fromTerrain: true };
  if (isValidMask(mask)) return { altitude: mask[norm(azimuth)], fromTerrain: true };

  return { altitude: DEFAULT_HORIZON, fromTerrain: false };
}

/**
 * Gotowa funkcja horyzontu dla miejsca — do wstrzyknięcia w dobór celów.
 * Dzięki temu rachunek celów nie musi wiedzieć nic o katalogu miejsc.
 */
export function horizonOf(
  mask: HorizonMask | null,
  overrides: HorizonOverride[] = [],
): (azimuth: number) => HorizonPoint {
  return (azimuth) => horizonAt(azimuth, mask, overrides);
}

/** Kierunek świata dla azymutu — „na południowy zachód" czyta się lepiej niż „na 214°". */
export function compassLabel(azimuth: number): string {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(norm(azimuth) / 45) % 8];
}

/** Sprawdza, czy tablica nadaje się na maskę — 360 skończonych liczb w zakresie. */
export function isValidMask(value: unknown): value is HorizonMask {
  return (
    Array.isArray(value) &&
    value.length === 360 &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= -10 && v <= 90)
  );
}
