/**
 * Co dziś nad głową — gwiazdozbiory tej nocy, uporządkowane do nauki.
 *
 * Odpowiada na pytanie wcześniejsze niż lista celów: **w którą stronę patrzeć
 * i czego szukać**. Reszta aplikacji zakłada, że wiesz, gdzie jest Łabędź;
 * ta warstwa jest dla kogoś, kto dopiero się tego uczy.
 *
 * Rachunek jest ten sam, co przy celach — `skyPathOverNight` z `sky-targets` —
 * bo dla efemeryd gwiazdozbiór to zwykły punkt nieba. Różni się pytanie, nie
 * matematyka.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import { CONSTELLATIONS, type Constellation } from '../data/constellations.ts';
import type { Coords } from '../data/places.ts';
import { compassLabel } from './horizon.ts';
import type { NightWindow } from './night-window.ts';
import { skyPathOverNight } from './sky-targets.ts';

/**
 * Poniżej tej wysokości gwiazdozbiór nie nadaje się do nauki.
 *
 * Wyżej niż próg celów obserwacyjnych, i celowo: cel można złapać nisko przez
 * chwilę, ale kształtu gwiazdozbioru nie da się rozpoznać, gdy widać z niego
 * tylko górną połowę nad ekstynkcją i światłami miasta.
 */
const MIN_ALTITUDE = 20;

/** Gwiazdozbiór osadzony w konkretnej nocy i miejscu. */
export type ConstellationTonight = {
  constellation: Constellation;
  /** Najwyższe położenie w oknie nocy i moment, w którym wypada. */
  maxAltitude: number;
  bestAt: Date;
  /** Kierunek w tym momencie — „na SW", nie „azymut 214°". */
  direction: string;
  bestAzimuth: number;
  /** Nie schodzi tej nocy poniżej progu: można go szukać o dowolnej porze. */
  allNight: boolean;
};

/**
 * Gwiazdozbiory warte pokazania tej nocy.
 *
 * Kolejność: **najpierw rozpoznawalność, potem wysokość**. Sam porządek po
 * wysokości wyglądał rozsądnie w kodzie i okazał się bez sensu na prawdziwych
 * danych — na wrześniową noc podsuwał na pierwszym miejscu Jaszczurkę,
 * a w pierwszej dziesiątce Żyrafę, bo gwiazdozbiory okołobiegunowe przechodzą
 * przez zenit. Obie są w tym katalogu opisane jako „wąski zygzak" i „ubogi
 * obszar", czyli dokładnie to, czego uczącemu się nie należy podsuwać najpierw.
 *
 * Wysokość rozstrzyga więc wewnątrz grupy, a nie między grupami: Łabędź nisko
 * jest lepszą propozycją niż Ryś w zenicie.
 */
export function constellationsTonight(
  window: NightWindow,
  coords: Coords,
  catalogue: Constellation[] = CONSTELLATIONS,
): ConstellationTonight[] {
  return catalogue
    .map((constellation) => {
      const path = skyPathOverNight(constellation, window, coords);

      return {
        constellation,
        maxAltitude: path.maxAltitude,
        bestAt: path.bestAt,
        direction: compassLabel(path.bestAzimuth),
        bestAzimuth: path.bestAzimuth,
        // Brak wschodu i zachodu w oknie znaczy, że stoi nad horyzontem całą
        // noc — a przy naszym progu wysokości: że przez całą noc da się go
        // szukać.
        allNight: path.up !== null && !path.up.rises && !path.up.sets,
      };
    })
    .filter((entry) => entry.maxAltitude >= MIN_ALTITUDE)
    .sort((a, b) => a.constellation.ease - b.constellation.ease || b.maxAltitude - a.maxAltitude);
}

const time = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * Gdzie i kiedy szukać — jedno zdanie pod nazwą.
 *
 * Gwiazdozbiór stojący całą noc wysoko nie potrzebuje godziny: podanie jej
 * sugerowałoby, że wcześniej albo później nie warto patrzeć, a to nieprawda.
 */
export function describeWhereToLook(entry: ConstellationTonight): string {
  const height = `${Math.round(entry.maxAltitude)}° nad horyzontem`;

  if (entry.allNight) return `Całą noc, ${height} na ${entry.direction}.`;
  return `Najwyżej o ${time(entry.bestAt)} — ${height} na ${entry.direction}.`;
}
