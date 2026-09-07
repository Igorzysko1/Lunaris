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
};

/**
 * Punkt wyjścia, z rozpoznania w promieniu ~1,5 h od Jaworzna. Wartości domyślne,
 * nie założenia kodu — użytkownik może je nadpisać, a listę rozszerzyć.
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
  },
];

/**
 * Miejsce obserwacyjne w postaci zwykłej miejscowości.
 *
 * Dzięki temu wybór lokalizacji, prognoza i ocena nocy nie muszą wiedzieć, czy
 * patrzą na miasto z bazy, czy na miejscówkę z katalogu — jedna ścieżka zamiast
 * dwóch równoległych.
 */
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
