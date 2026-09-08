/**
 * Katalog miejsc obserwacyjnych — punkty, do których realnie się jeździ.
 *
 * To dane wyjściowe, nie prawda objawiona: współrzędne są orientacyjne (środki
 * obszarów, nie zweryfikowane parkingi), a Bortle i czas podejścia to szacunki
 * do skorygowania po wyjazdach. Właśnie po to każde miejsce ma pole na notatki,
 * a cała lista siedzi w konfiguracji — dodanie miejscówki nie wymaga zmiany
 * kodu silnika ani tego pliku.
 *
 * Czasu dojazdu tu NIE MA celowo. Liczy go silnik z odległości i średniej
 * prędkości z profilu obserwatora; zapisany osobno byłby drugim źródłem prawdy,
 * które rozjedzie się przy pierwszej korekcie prędkości. Sprawdzone: model
 * odtwarza czasy z rozpoznania terenowego z dokładnością do kilkunastu minut.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { HorizonMask, HorizonOverride } from '../lib/horizon.ts';
import type { Place } from './places.ts';

export type ObservingSite = {
  id: string;
  name: string;
  /** Region — dla spójności z miejscowościami, które trafiają do tego samego wyboru. */
  region: string;
  lat: number;
  lon: number;
  /**
   * Szacunkowa skala Bortle'a. Przy niepewności („~3–4") bierzemy gorszą wartość:
   * lepiej nie doszacować nieba, niż obiecać cel, którego nie widać.
   */
  bortle: number;
  /**
   * Marsz od parkingu do stanowiska w minutach. Powyżej tolerancji z profilu
   * obserwatora silnik dokłada ostrzeżenie — z całym sprzętem to nie spacer.
   */
  walkMinutes: number;
  /** Notatki z wyjazdów: gdzie faktycznie zaparkować, jaki teren, co przeszkadza. */
  notes: string;
  /**
   * Dokładność pozycji w metrach w chwili zapisu z terenu; `null` dla punktów
   * wpisanych z mapy. Ma znaczenie później: fix złapany pod drzewami potrafi
   * mieć kilkadziesiąt metrów błędu i wtedy warto punkt powtórzyć, zamiast
   * budować na nim maskę horyzontu czy jasność nieba.
   */
  accuracyM: number | null;
  /**
   * Wysokość terenu dla azymutów 0–359, policzona poza aplikacją z modelu
   * terenu. `null` znaczy „jeszcze nie policzona" i jest stanem normalnym:
   * miejsce zapisane w terenie czeka na maskę do powrotu w zasięg.
   */
  horizonMask: HorizonMask | null;
  /** Ręczne korekty sektorów — mają pierwszeństwo przed policzoną maską. */
  horizonOverrides: HorizonOverride[];
};

/**
 * Punkt wyjścia, z rozpoznania w promieniu ~1,5 h od Jaworzna. Wartości domyślne,
 * nie założenia kodu — użytkownik może je nadpisać, a listę rozszerzyć.
 *
 * **Tatrzański Park Narodowy jest tu nieobecny celowo.** Poruszanie się po parku
 * poza godzinami udostępnienia jest zabronione, a obserwacja to z definicji noc
 * — więc żadna maska horyzontu ani poprawka Bortle'a nie zrobi z tego miejsca
 * możliwego do użycia. Notatka stoi tutaj, bo Siwa Polana była najciemniejszym
 * punktem katalogu (~21,4 mag/arcsec²) i bez tego zdania wróci na listę przy
 * pierwszym szukaniu ciemnego nieba. Zasięg w górach domyka Hala Lipowska.
 */
export const DEFAULT_SITES: ObservingSite[] = [
  {
    id: 'site-bledowska',
    name: 'Pustynia Błędowska',
    region: 'małopolskie',
    lat: 50.35,
    lon: 19.53,
    bortle: 4,
    walkMinutes: 15,
    notes: 'Znana łuna od strony zabudowy — psuje obiekty nisko nad horyzontem z tej strony.',
    accuracyM: null,
    horizonMask: null,
    horizonOverrides: [],
  },
  {
    id: 'site-zborow',
    name: 'Góra Zborów / Podlesice',
    region: 'śląskie',
    lat: 50.58,
    lon: 19.44,
    bortle: 4,
    walkMinutes: 10,
    notes: '',
    accuracyM: null,
    horizonMask: null,
    horizonOverrides: [],
  },
  {
    id: 'site-zloty-potok',
    name: 'Złoty Potok / Janów',
    region: 'śląskie',
    lat: 50.7,
    lon: 19.45,
    bortle: 4,
    walkMinutes: 5,
    notes: '',
    accuracyM: null,
    horizonMask: null,
    horizonOverrides: [],
  },
  {
    id: 'site-salmopolska',
    name: 'Przełęcz Salmopolska',
    region: 'śląskie',
    lat: 49.72,
    lon: 19.03,
    bortle: 4,
    walkMinutes: 5,
    notes: '',
    accuracyM: null,
    horizonMask: null,
    horizonOverrides: [],
  },
  {
    id: 'site-hala-lipowska',
    name: 'Hala Lipowska / Korbielów',
    region: 'śląskie',
    lat: 49.57,
    lon: 19.35,
    bortle: 3,
    walkMinutes: 60,
    notes: 'Podejście z Korbielowa — powyżej tolerancji marszu, planować z zapasem.',
    accuracyM: null,
    horizonMask: null,
    horizonOverrides: [],
  },
];

/**
 * Miejsce obserwacyjne w postaci zwykłej miejscowości.
 *
 * Dzięki temu wybór lokalizacji, prognoza i ocena nocy nie muszą wiedzieć, czy
 * patrzą na miasto z bazy, czy na miejscówkę z katalogu — jedna ścieżka zamiast
 * dwóch równoległych.
 */
/** Identyfikator miejsca. Nie musi być kryptograficzny — ma tylko nie kolidować. */
export function newSiteId(): string {
  return `site-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function siteAsPlace(site: ObservingSite): Place {
  return {
    id: site.id,
    name: site.name,
    region: site.region,
    lat: site.lat,
    lon: site.lon,
    bortle: site.bortle,
  };
}
