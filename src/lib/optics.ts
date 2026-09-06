/**
 * Parametry sprzętu obserwacyjnego i to, co z nich wynika.
 *
 * Świadomie liczby, nie nazwa sprzętu: filtr celów liczy graniczną jasność
 * i minimalny rozmiar kątowy z apertury i powiększenia, zamiast sprawdzać
 * „czy to lornetka 15x70". Zakup teleskopu ma być podmianą kilku wartości
 * w konfiguracji, a nie przepisywaniem logiki doboru celów.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

/** Sposób trzymania sprzętu. Wpływa na próg wiatru i na realne zasięgi. */
export type Mount = 'tripod' | 'handheld';

export type Optics = {
  /** Apertura w milimetrach. */
  aperture: number;
  /** Powiększenie, np. 15 dla 15x. */
  magnification: number;
  /** Rzeczywiste pole widzenia w stopniach. */
  fieldOfView: number;
  mount: Mount;
};

/** Punkt wyjścia: lornetka 15x70 na statywie. Wartość domyślna, nie założenie kodu. */
export const DEFAULT_OPTICS: Optics = {
  aperture: 70,
  magnification: 15,
  fieldOfView: 4.4,
  mount: 'tripod',
};

/** Granice, w których wartości mają sens fizyczny — poza nimi rachunek przestaje cokolwiek znaczyć. */
export const OPTICS_LIMITS = {
  aperture: { min: 20, max: 400 },
  magnification: { min: 3, max: 400 },
  fieldOfView: { min: 0.1, max: 10 },
} as const;

/**
 * Przycina parametry do zakresu, w którym mają sens fizyczny.
 *
 * Wartość, która nie jest liczbą, wraca do domyślnej zamiast propagować NaN —
 * inaczej jeden zepsuty wpis cicho unieważniłby cały rachunek zasięgu, bo każde
 * porównanie z NaN jest fałszywe i wszystkie cele wyszłyby „w zasięgu".
 */
export function clampOptics(optics: Optics): Optics {
  const clamp = (
    value: number,
    { min, max }: { min: number; max: number },
    fallback: number,
  ) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);

  return {
    aperture: clamp(optics.aperture, OPTICS_LIMITS.aperture, DEFAULT_OPTICS.aperture),
    magnification: clamp(
      optics.magnification,
      OPTICS_LIMITS.magnification,
      DEFAULT_OPTICS.magnification,
    ),
    fieldOfView: clamp(optics.fieldOfView, OPTICS_LIMITS.fieldOfView, DEFAULT_OPTICS.fieldOfView),
    mount: optics.mount === 'handheld' ? 'handheld' : 'tripod',
  };
}

/** Źrenica wyjściowa w mm. Powyżej ~7 mm część światła marnuje się poza źrenicą oka. */
export function exitPupil(optics: Optics): number {
  return optics.aperture / optics.magnification;
}

/**
 * Graniczna jasność gwiazdowa dla danej apertury i jakości nieba.
 *
 * Podstawa to klasyczna zależność 7,7 + 5·log₁₀(D) dla apertury w centymetrach,
 * skorygowana o skalę Bortle'a: w skali 1 niebo nie zabiera nic, każdy kolejny
 * stopień zjada około 0,4 mag. Rachunek jest przybliżony — służy do odsiania
 * celów bez szans, nie do fotometrii.
 */
export function limitingMagnitude(optics: Optics, bortle: number): number {
  const apertureCm = optics.aperture / 10;
  const skyPenalty = 0.4 * (bortle - 1);
  return 7.7 + 5 * Math.log10(apertureCm) - skyPenalty;
}

/**
 * Jasność tła nieba w mag/arcsec² dla kolejnych stopni skali Bortle'a.
 * Indeks 0 nieużywany — skala zaczyna się od 1.
 */
const SKY_BRIGHTNESS = [0, 22.0, 21.7, 21.5, 21.0, 20.5, 19.5, 18.5, 18.0, 17.5];

export function skyBrightness(bortle: number): number {
  const step = Math.round(Math.min(9, Math.max(1, bortle)));
  return SKY_BRIGHTNESS[step];
}

/**
 * Średnia jasność powierzchniowa obiektu w mag/arcsec², z jasności całkowitej
 * i rozmiaru kątowego (obiekt przybliżony kołem).
 *
 * To ona, a nie jasność katalogowa, decyduje o widoczności obiektu mgławicowego:
 * M31 ma 3,4 mag, ale rozlane na blisko trzy stopnie, więc pod miejskim niebem
 * nie widać z niej nic, mimo że liczba wygląda na jasną.
 *
 * Uśrednienie po całej powierzchni jest ostrożne wobec obiektów z jasnym jądrem —
 * M42 czy centrum M31 bywają widoczne również wtedy, gdy ten rachunek je odrzuca.
 */
export function surfaceBrightness(magnitude: number, sizeArcmin: number): number {
  const radiusArcsec = (sizeArcmin * 60) / 2;
  const areaArcsec2 = Math.PI * radiusArcsec ** 2;
  return magnitude + 2.5 * Math.log10(areaArcsec2);
}

/**
 * O ile słabsze od tła nieba obiekty wyciąga dana apertura, w magnitudo.
 * Odniesieniem jest źrenica oka (7 mm) — sprzęt zbiera tyle razy więcej światła,
 * ile wynosi stosunek powierzchni obiektywów.
 */
export function contrastGain(optics: Optics): number {
  const EYE_PUPIL_MM = 7;
  return 2.5 * Math.log10(optics.aperture / EYE_PUPIL_MM);
}

/**
 * Najsłabsza jasność powierzchniowa, jaką ten sprzęt wyciągnie pod takim niebem.
 * Obiekt jest widoczny, gdy jego jasność powierzchniowa jest **niższa liczbowo**
 * niż ten próg.
 */
export function surfaceBrightnessLimit(optics: Optics, bortle: number): number {
  return skyBrightness(bortle) + contrastGain(optics);
}

/**
 * Najmniejszy rozmiar kątowy, jaki przy danym powiększeniu widać jako obiekt,
 * a nie jako punkt.
 *
 * Oko rozdziela około 2 minut kątowych, więc po powiększeniu obiekt musi mieć
 * co najmniej tyle podzielone przez powiększenie, żeby w ogóle pokazać kształt.
 */
export function minimumAngularSize(optics: Optics): number {
  const EYE_RESOLUTION_ARCMIN = 2;
  return EYE_RESOLUTION_ARCMIN / optics.magnification;
}

/** Sprzęt z ręki drga już przy słabszym wietrze niż ustawiony na statywie. */
export function windLimitKmh(optics: Optics): number {
  return optics.mount === 'tripod' ? 25 : 15;
}

/** np. „15x70, statyw" — do wyświetlenia w ustawieniach. */
export function describeOptics(optics: Optics): string {
  const mount = optics.mount === 'tripod' ? 'statyw' : 'z ręki';
  return `${optics.magnification}x${optics.aperture}, ${mount}`;
}
