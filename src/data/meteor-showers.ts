/**
 * Katalog rojów meteorów widocznych z Polski.
 *
 * Daty maksimów są stałe w kalendarzu (Ziemia co roku przecina ten sam strumień
 * pyłu) i wahają się o ±1 dzień — dla planowania obserwacji to bez znaczenia.
 * ZHR to liczba teoretyczna: zenithal hourly rate przy radiancie w zenicie i
 * niebie 6.5 mag. Realna liczba jest zawsze niższa, stąd nie podajemy jej jako
 * obietnicy, tylko jako miarę „jak duży to rój".
 *
 * Radiant w równikowym układzie współrzędnych (J2000), w stopniach — potrzebny
 * do policzenia, czy w ogóle wzejdzie nad horyzont danej nocy.
 */
export type MeteorShower = {
  id: string;
  name: string;
  /** Gwiazdozbiór radiantu — do opisu, nie do rachunków. */
  constellation: string;
  /** Maksimum: miesiąc (1–12) i dzień. */
  peakMonth: number;
  peakDay: number;
  /** Zenithal hourly rate w maksimum. */
  zhr: number;
  /** Rektascensja i deklinacja radiantu (stopnie, J2000). */
  ra: number;
  dec: number;
};

export const METEOR_SHOWERS: MeteorShower[] = [
  { id: 'qua', name: 'Kwadrantydy', constellation: 'Wolarz', peakMonth: 1, peakDay: 3, zhr: 110, ra: 230, dec: 49 },
  { id: 'lyr', name: 'Lirydy', constellation: 'Lutnia', peakMonth: 4, peakDay: 22, zhr: 18, ra: 271, dec: 34 },
  { id: 'eta', name: 'Eta Akwarydy', constellation: 'Wodnik', peakMonth: 5, peakDay: 6, zhr: 50, ra: 338, dec: -1 },
  { id: 'sda', name: 'Delta Akwarydy Południowe', constellation: 'Wodnik', peakMonth: 7, peakDay: 30, zhr: 25, ra: 340, dec: -16 },
  { id: 'per', name: 'Perseidy', constellation: 'Perseusz', peakMonth: 8, peakDay: 12, zhr: 100, ra: 48, dec: 58 },
  { id: 'dra', name: 'Drakonidy', constellation: 'Smok', peakMonth: 10, peakDay: 8, zhr: 10, ra: 262, dec: 54 },
  { id: 'ori', name: 'Orionidy', constellation: 'Orion', peakMonth: 10, peakDay: 21, zhr: 20, ra: 95, dec: 16 },
  { id: 'sta', name: 'Taurydy Południowe', constellation: 'Byk', peakMonth: 11, peakDay: 5, zhr: 5, ra: 52, dec: 15 },
  { id: 'leo', name: 'Leonidy', constellation: 'Lew', peakMonth: 11, peakDay: 17, zhr: 15, ra: 152, dec: 22 },
  { id: 'gem', name: 'Geminidy', constellation: 'Bliźnięta', peakMonth: 12, peakDay: 14, zhr: 150, ra: 112, dec: 33 },
  { id: 'urs', name: 'Ursydy', constellation: 'Mała Niedźwiedzica', peakMonth: 12, peakDay: 22, zhr: 10, ra: 217, dec: 76 },
];
