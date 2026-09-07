/**
 * Seeing — ocena drgania obrazu, czyli tego, ile szczegółu wytrzyma powiększenie.
 *
 * To coś zupełnie innego niż zachmurzenie. Przejrzystość mówi, **czy** widać;
 * seeing mówi, **jak ostro**. Noc bez jednej chmury potrafi mieć obraz gotujący
 * się jak nad rozgrzaną blachą, a lekka mgiełka bywa nocą, w której Jowisz stoi
 * jak wykuty. Dla lornetki 15x70 seeing prawie nie ma znaczenia — przy takim
 * powiększeniu drganie mieści się poniżej rozdzielczości oka. Zaczyna decydować
 * dopiero przy planetach i gwiazdach podwójnych, czyli powyżej stukrotnego
 * powiększenia.
 *
 * Dlatego seeing **nie odrzuca nocy** i nie wchodzi do werdyktu. Jest informacją:
 * przy fatalnym seeingu nie ma po co brać teleskopu na planety, ale wciąż warto
 * jechać na mgławice.
 *
 * ## Skąd to wiadomo
 *
 * Prawdziwy seeing mierzy się na miejscu, nocą, na gwieździe. Prognozuje się go
 * z modelu atmosfery i wszystkie takie prognozy są przybliżeniem. Open-Meteo nie
 * podaje gotowego wskaźnika, ale podaje to, z czego się go składa — i to tym
 * samym żądaniem co resztę pogody:
 *
 * - **prąd strumieniowy na 250 hPa** (~10 km): główny sprawca. Szybka warstwa
 *   nad wolną wytwarza turbulencję na całej drodze światła.
 * - **wiatr na 500 hPa** (~5,5 km): to samo piętro niżej, słabszy wpływ.
 * - **gradient temperatury 850→500 hPa**: im bliżej gradientu adiabatycznego,
 *   tym chętniej powietrze przelewa się w pionie.
 * - **CAPE**: energia konwekcji. Powyżej zera znaczy, że przelewa się na pewno.
 * - **warstwa graniczna**: jak głęboko sięga mieszanie przy gruncie. Nocą
 *   powinna się wypłaszczyć; jeśli tego nie robi, turbulencja jest tuż nad głową
 *   i to najgorszy rodzaj — najbliżej obiektywu.
 *
 * Progi poniżej pochodzą z praktyki obserwacyjnej, nie z pomiaru, i są do
 * strojenia jak wagi w `computeNightRating`.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { NightHour } from './weather.ts';

/**
 * Skala 1–5, jak w powszechnie używanych prognozach seeingu: 1 to obraz
 * niestabilny, 5 to noc, w której warto wyciągnąć największe powiększenie.
 */
export type SeeingIndex = 1 | 2 | 3 | 4 | 5;

export type Seeing = {
  index: SeeingIndex;
  label: string;
  /** Co zaważyło — do pokazania obok oceny, żeby nie była liczbą znikąd. */
  driver: 'jet' | 'convection' | 'ground' | 'none';
  /** Powyżej tego powiększenia drganie zacznie ograniczać szczegół. */
  usableMagnification: number;
};

/** Wysokość geopotencjalna 850 i 500 hPa w metrach — na tyle stała, że wystarcza stała. */
const LAYER_THICKNESS_KM = 4;

/**
 * Gradient pionowy w K/km. Adiabata sucha to około 9,8 K/km; im bliżej niej,
 * tym mniej trzeba, żeby powietrze ruszyło w pionie.
 */
export function lapseRate(hour: NightHour): number {
  return (hour.temp850 - hour.temp500) / LAYER_THICKNESS_KM;
}

/**
 * Kara za prąd strumieniowy. Progi w km/h: poniżej 30 nie przeszkadza,
 * powyżej 150 nie ma o czym mówić.
 */
function jetPenalty(windJet: number): number {
  if (windJet < 30) return 0;
  if (windJet < 60) return 0.5;
  if (windJet < 100) return 1.5;
  if (windJet < 150) return 2.5;
  return 3.5;
}

function midPenalty(windMid: number): number {
  if (windMid < 40) return 0;
  return windMid < 80 ? 0.3 : 0.8;
}

/** Kara za niestabilność: stromy gradient i energia konwekcji mówią to samo. */
function convectionPenalty(hour: NightHour): number {
  const lapse = lapseRate(hour);
  const fromLapse = lapse < 6 ? 0 : lapse < 7.5 ? 0.4 : lapse < 9 ? 0.9 : 1.4;
  const fromCape = hour.cape < 50 ? 0 : hour.cape < 300 ? 0.4 : 1;

  return fromLapse + fromCape;
}

/**
 * Kara za mieszanie przy gruncie.
 *
 * Nocą warstwa graniczna powinna opaść do kilkudziesięciu metrów. Gdy zostaje
 * gruba, powietrze miesza się tuż nad obserwatorem — a turbulencja blisko
 * obiektywu psuje obraz najmocniej.
 */
function groundPenalty(boundaryLayerM: number): number {
  if (boundaryLayerM < 150) return 0;
  if (boundaryLayerM < 400) return 0.4;
  return 1;
}

const LABELS: Record<SeeingIndex, string> = {
  1: 'bardzo słaby',
  2: 'słaby',
  3: 'przeciętny',
  4: 'dobry',
  5: 'bardzo dobry',
};

/**
 * Powiększenie, powyżej którego drganie zaczyna zjadać szczegół.
 *
 * Liczby są praktyczne, nie wyprowadzone: przy bardzo słabym seeingu nie ma
 * sensu wychodzić poza jakieś 80x, przy bardzo dobrym można wycisnąć z optyki
 * wszystko, na co pozwala apertura.
 */
const USABLE_MAGNIFICATION: Record<SeeingIndex, number> = {
  1: 80,
  2: 120,
  3: 180,
  4: 250,
  5: 350,
};

/** Ocena dla jednej godziny prognozy. */
export function seeingAt(hour: NightHour): Seeing {
  const jet = jetPenalty(hour.windJet) + midPenalty(hour.windMid);
  const convection = convectionPenalty(hour);
  const ground = groundPenalty(hour.boundaryLayerM);

  const raw = 5 - (jet + convection + ground);
  const index = Math.max(1, Math.min(5, Math.round(raw))) as SeeingIndex;

  // Nazywamy tę przyczynę, która odjęła najwięcej — użytkownik może z nią coś
  // zrobić tylko wtedy, gdy wie, co to jest.
  const worst = Math.max(jet, convection, ground);
  const driver: Seeing['driver'] =
    worst < 0.5 ? 'none' : worst === jet ? 'jet' : worst === convection ? 'convection' : 'ground';

  return {
    index,
    label: LABELS[index],
    driver,
    usableMagnification: USABLE_MAGNIFICATION[index],
  };
}

/**
 * Ocena dla całego okna obserwacyjnego.
 *
 * Bierzemy medianę, nie średnią ani minimum: jedna godzina z przelotną
 * turbulencją nie przekreśla nocy, ale i nie chcemy, żeby kilka spokojnych
 * godzin zamaskowało to, że przez większość czasu obraz się gotuje.
 */
export function seeingOver(hours: NightHour[]): Seeing | null {
  if (hours.length === 0) return null;

  const indices = hours.map((h) => seeingAt(h).index).sort((a, b) => a - b);
  const median = indices[Math.floor(indices.length / 2)];

  // Zwracamy ocenę tej godziny, która trafiła w medianę — razem z jej przyczyną,
  // zamiast składać etykietę z liczby oderwanej od powodu.
  const representative = hours.find((h) => seeingAt(h).index === median);

  return representative ? seeingAt(representative) : null;
}

/** Zdanie do pokazania pod oceną. */
export function describeSeeing(seeing: Seeing): string {
  switch (seeing.driver) {
    case 'jet':
      return `Prąd strumieniowy nad głową — obraz będzie drgał. Sensowne powiększenie do ${seeing.usableMagnification}x.`;
    case 'convection':
      return `Powietrze niestabilne w pionie — szczegół planetarny będzie się rozmywał. Do ${seeing.usableMagnification}x.`;
    case 'ground':
      return `Mieszanie tuż nad gruntem — najgorszy rodzaj drgania, bo najbliżej obiektywu. Do ${seeing.usableMagnification}x.`;
    case 'none':
      // Ocena poniżej maksimum bez jednego winnego znaczy, że punkty odjęło
      // kilka drobnych przyczyn naraz. „Atmosfera spokojna" byłoby wtedy
      // nieprawdą — a to zdanie stoi tuż pod oceną, która mówi co innego.
      return seeing.index === 5
        ? `Atmosfera spokojna — powiększenie ograniczy sprzęt, a nie powietrze (do ${seeing.usableMagnification}x).`
        : `Nic nie psuje obrazu wyraźnie, ale i nic go nie uspokaja. Sensowne powiększenie do ${seeing.usableMagnification}x.`;
  }
}
