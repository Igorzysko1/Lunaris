/**
 * Kształty gwiazdozbiorów z projektu (`constellation-figures.js`) — makieta
 * pola `figure`, którego `src/data/constellations.ts` dziś nie ma.
 *
 * Nazwy własne i litery Bayera są prawdziwe. WSPÓŁRZĘDNE SĄ SCHEMATYCZNE:
 * jednostki −1..1 kadru dobrane tak, by kształt był rozpoznawalny. Przy
 * wdrożeniu do zastąpienia rektascensją i deklinacją z katalogu jasnych gwiazd.
 *
 * s: [x, y, litera Bayera, nazwa własna?]   l: [[indeksy wzdłuż linii], ...]
 */

export type FigureStar = [x: number, y: number, bayer: string, name?: string];
export type Figure = { s: FigureStar[]; l: number[][] };

export const FIGURES: Record<string, Figure> = {
  uma: {
    s: [
      [-0.9, 0.28, 'η', 'Alkaid'],
      [-0.62, 0.18, 'ζ', 'Mizar'],
      [-0.34, 0.1, 'ε', 'Alioth'],
      [-0.06, 0.3, 'δ', 'Megrez'],
      [0.2, 0.52, 'γ', 'Phekda'],
      [0.52, 0.44, 'β', 'Merak'],
      [0.44, 0.14, 'α', 'Dubhe'],
    ],
    l: [[0, 1, 2, 3, 4, 5, 6, 3]],
  },
  umi: {
    s: [
      [0.86, -0.5, 'α', 'Polaris'],
      [0.5, -0.24, 'δ'],
      [0.2, -0.02, 'ε'],
      [-0.1, 0.2, 'ζ'],
      [-0.44, 0.36, 'β', 'Kochab'],
      [-0.26, 0.62, 'γ', 'Pherkad'],
      [-0.02, 0.5, 'η'],
    ],
    l: [[0, 1, 2, 3, 4, 5, 6, 3]],
  },
  cas: {
    s: [
      [-0.82, -0.34, 'ε', 'Segin'],
      [-0.36, 0.22, 'δ', 'Ruchbah'],
      [0.06, -0.28, 'γ', 'Gamma Cas'],
      [0.52, 0.3, 'α', 'Schedar'],
      [0.88, -0.16, 'β', 'Caph'],
    ],
    l: [[0, 1, 2, 3, 4]],
  },
  cep: {
    s: [
      [-0.5, 0.4, 'α', 'Alderamin'],
      [0.1, 0.52, 'β', 'Alfirk'],
      [0.34, 0.06, 'γ', 'Errai'],
      [-0.2, -0.1, 'ι'],
      [-0.62, -0.02, 'ζ'],
      [0.0, -0.62, 'δ'],
    ],
    l: [
      [0, 1, 2, 3, 0],
      [3, 4],
      [2, 5],
    ],
  },
  dra: {
    s: [
      [-0.92, 0.5, 'λ'],
      [-0.6, 0.2, 'κ'],
      [-0.3, 0.36, 'α', 'Thuban'],
      [0.0, 0.1, 'ι'],
      [0.3, 0.3, 'ζ'],
      [0.56, 0.0, 'β', 'Rastaban'],
      [0.82, -0.28, 'γ', 'Eltanin'],
      [0.5, -0.4, 'ξ'],
    ],
    l: [[0, 1, 2, 3, 4, 5, 6, 7, 5]],
  },
  per: {
    s: [
      [-0.7, 0.42, 'γ'],
      [-0.36, 0.2, 'α', 'Mirfak'],
      [-0.02, -0.06, 'δ'],
      [0.28, -0.36, 'ε'],
      [0.02, 0.4, 'ι'],
      [0.3, 0.08, 'β', 'Algol'],
      [0.66, 0.3, 'ρ'],
    ],
    l: [
      [0, 1, 2, 3],
      [1, 4],
      [2, 5, 6],
    ],
  },
  cam: {
    s: [
      [-0.6, 0.3, 'β', 'β Cam'],
      [-0.1, 0.1, 'α'],
      [0.36, 0.34, 'γ'],
      [0.1, -0.4, 'CS'],
    ],
    l: [
      [0, 1, 2],
      [1, 3],
    ],
  },
  lac: {
    s: [
      [-0.7, 0.4, 'α', 'α Lac'],
      [-0.3, 0.0, 'β'],
      [0.1, 0.3, '4'],
      [0.5, -0.1, '5'],
      [0.84, 0.24, '1'],
    ],
    l: [[0, 1, 2, 3, 4]],
  },
  cyg: {
    s: [
      [0.0, -0.78, 'β', 'Albireo'],
      [0.0, -0.24, 'η'],
      [0.0, 0.12, 'γ', 'Sadr'],
      [0.0, 0.7, 'α', 'Deneb'],
      [-0.72, 0.3, 'κ'],
      [-0.36, 0.2, 'δ'],
      [0.42, 0.1, 'ε', 'Gienah'],
      [0.8, 0.2, 'ζ'],
    ],
    l: [
      [0, 1, 2, 3],
      [4, 5, 2, 6, 7],
    ],
  },
  lyr: {
    s: [
      [0.0, 0.72, 'α', 'Wega'],
      [-0.3, 0.3, 'ε'],
      [0.3, 0.24, 'ζ'],
      [-0.22, -0.3, 'β', 'Sheliak'],
      [0.26, -0.42, 'γ', 'Sulafat'],
    ],
    l: [[0, 1, 3, 4, 2, 0]],
  },
  aql: {
    s: [
      [0.0, 0.1, 'α', 'Altair'],
      [-0.28, 0.44, 'γ', 'Tarazed'],
      [0.24, -0.2, 'β', 'Alshain'],
      [-0.66, 0.7, 'ζ'],
      [0.3, 0.56, 'δ'],
      [0.1, -0.68, 'λ'],
      [0.72, 0.3, 'θ'],
    ],
    l: [
      [3, 1, 0, 2, 5],
      [1, 4, 6],
    ],
  },
  her: {
    s: [
      [-0.5, 0.66, 'β', 'Kornephoros'],
      [-0.2, 0.3, 'ζ'],
      [0.24, 0.36, 'ε'],
      [0.42, 0.72, 'δ'],
      [-0.34, -0.12, 'η'],
      [0.1, -0.06, 'π'],
      [-0.5, -0.6, 'θ'],
      [0.4, -0.5, 'ο'],
      [0.76, 0.9, 'α', 'Rasalgethi'],
    ],
    l: [
      [0, 1, 2, 3],
      [1, 4, 6],
      [2, 5, 7],
      [4, 5],
      [3, 8],
    ],
  },
  oph: {
    s: [
      [0.0, 0.8, 'α', 'Rasalhague'],
      [-0.4, 0.4, 'κ'],
      [-0.5, -0.1, 'ζ'],
      [-0.2, -0.6, 'η'],
      [0.3, -0.5, 'θ'],
      [0.44, 0.2, 'β'],
      [0.7, 0.5, 'γ'],
    ],
    l: [[0, 1, 2, 3, 4, 5, 6, 0]],
  },
  ser: {
    s: [
      [-0.86, 0.5, 'β'],
      [-0.6, 0.3, 'γ'],
      [-0.4, 0.0, 'α', 'Unukalhai'],
      [-0.2, -0.4, 'ε'],
      [0.4, -0.2, 'η'],
      [0.8, 0.1, 'θ'],
    ],
    l: [
      [0, 1, 2, 3],
      [4, 5],
    ],
  },
  sge: {
    s: [
      [-0.8, 0.0, 'α'],
      [-0.3, 0.1, 'δ'],
      [0.3, 0.2, 'γ', 'γ Sge'],
      [-0.4, 0.5, 'β'],
    ],
    l: [
      [0, 1, 2],
      [1, 3],
    ],
  },
  vul: {
    s: [
      [-0.7, -0.1, 'α', 'α Vul'],
      [-0.1, 0.1, '13'],
      [0.5, 0.24, '15'],
    ],
    l: [[0, 1, 2]],
  },
  del: {
    s: [
      [-0.4, -0.4, 'ε'],
      [-0.1, 0.1, 'β', 'Rotanev'],
      [0.2, 0.4, 'α', 'Sualocin'],
      [0.5, 0.1, 'γ'],
      [0.2, -0.2, 'δ'],
    ],
    l: [[0, 1, 2, 3, 4, 1]],
  },
  crb: {
    s: [
      [-0.8, 0.3, 'θ'],
      [-0.45, -0.05, 'β', 'Nusakan'],
      [0.0, -0.3, 'α', 'Alphecca'],
      [0.45, -0.05, 'γ'],
      [0.7, 0.25, 'δ'],
      [0.88, 0.5, 'ε'],
    ],
    l: [[0, 1, 2, 3, 4, 5]],
  },
  boo: {
    s: [
      [0.0, -0.7, 'α', 'Arktur'],
      [-0.36, -0.2, 'η'],
      [-0.2, 0.4, 'γ'],
      [0.24, 0.5, 'β', 'Nekkar'],
      [0.34, 0.05, 'δ'],
      [0.2, -0.24, 'ε', 'Izar'],
    ],
    l: [[0, 1, 2, 3, 4, 5, 0]],
  },
  sco: {
    s: [
      [-0.8, 0.5, 'β', 'Acrab'],
      [-0.6, 0.2, 'δ', 'Dschubba'],
      [-0.5, -0.1, 'π'],
      [-0.1, -0.2, 'α', 'Antares'],
      [0.2, -0.4, 'τ'],
      [0.5, -0.6, 'ε'],
      [0.8, -0.4, 'υ'],
    ],
    l: [
      [0, 1, 2],
      [1, 3, 4, 5, 6],
    ],
  },
  sgr: {
    s: [
      [-0.6, 0.3, 'δ', 'Kaus Media'],
      [-0.3, 0.55, 'λ', 'Kaus Borealis'],
      [0.1, 0.4, 'σ', 'Nunki'],
      [0.4, 0.2, 'ζ'],
      [0.1, -0.1, 'ε', 'Kaus Australis'],
      [-0.4, -0.1, 'γ'],
      [0.6, 0.5, 'φ'],
    ],
    l: [
      [5, 0, 1, 2, 3, 4, 0],
      [2, 6],
    ],
  },
  sct: {
    s: [
      [-0.5, 0.2, 'α', 'α Sct'],
      [0.1, 0.4, 'β'],
      [0.3, -0.2, 'δ'],
    ],
    l: [[0, 1, 2, 0]],
  },
  lib: {
    s: [
      [-0.7, 0.3, 'σ'],
      [-0.2, 0.5, 'β', 'Zubeneschamali'],
      [0.3, 0.1, 'α', 'Zubenelgenubi'],
      [0.7, -0.3, 'γ'],
    ],
    l: [
      [0, 1, 2, 3],
      [0, 2],
    ],
  },
  peg: {
    s: [
      [-0.6, 0.6, 'β', 'Scheat'],
      [0.4, 0.6, 'α', 'Markab'],
      [0.4, -0.4, 'γ', 'Algenib'],
      [-0.6, -0.4, 'δ', 'Alpheratz'],
      [-0.9, 0.9, 'μ'],
      [0.8, 0.9, 'ε', 'Enif'],
    ],
    l: [
      [0, 1, 2, 3, 0],
      [0, 4],
      [1, 5],
    ],
  },
  and: {
    s: [
      [-0.8, -0.3, 'α', 'Alpheratz'],
      [-0.2, 0.0, 'δ'],
      [0.3, 0.3, 'β', 'Mirach'],
      [0.8, 0.6, 'γ', 'Almach'],
      [0.1, 0.7, 'μ'],
      [-0.1, -0.5, 'π'],
    ],
    l: [
      [0, 1, 2, 3],
      [2, 4],
      [1, 5],
    ],
  },
  tri: {
    s: [
      [-0.6, 0.4, 'β', 'β Tri'],
      [0.5, 0.5, 'γ'],
      [0.0, -0.4, 'α', 'Mothallah'],
    ],
    l: [[0, 1, 2, 0]],
  },
  psc: {
    s: [
      [-0.9, 0.4, 'ω'],
      [-0.5, 0.2, 'δ'],
      [-0.1, 0.3, 'ν'],
      [0.2, 0.5, 'η', 'η Psc'],
      [0.55, 0.3, 'ρ'],
      [0.8, 0.0, 'β'],
      [0.3, -0.4, 'γ'],
      [0.0, -0.6, 'θ'],
    ],
    l: [
      [0, 1, 2, 3, 4, 5],
      [2, 6, 7],
    ],
  },
  cet: {
    s: [
      [-0.8, 0.2, 'β', 'Deneb Kaitos'],
      [-0.4, 0.4, 'η'],
      [0.0, 0.1, 'τ'],
      [0.4, -0.1, 'δ'],
      [0.7, 0.3, 'α', 'Menkar'],
      [0.3, -0.5, 'ο', 'Mira'],
    ],
    l: [
      [0, 1, 2, 3, 4],
      [3, 5],
    ],
  },
  aqr: {
    s: [
      [-0.8, 0.4, 'β', 'Sadalsuud'],
      [-0.3, 0.5, 'α', 'Sadalmelik'],
      [0.1, 0.3, 'γ'],
      [0.3, 0.5, 'ζ'],
      [0.5, 0.2, 'η'],
      [0.1, -0.3, 'δ'],
      [-0.2, -0.6, 'τ'],
    ],
    l: [
      [0, 1, 2, 3],
      [2, 4],
      [2, 5, 6],
    ],
  },
  cap: {
    s: [
      [-0.7, 0.4, 'α', 'Algedi'],
      [-0.5, 0.2, 'β', 'Dabih'],
      [0.0, -0.4, 'ω'],
      [0.5, -0.2, 'δ', 'Deneb Algedi'],
      [0.7, 0.2, 'γ'],
    ],
    l: [[0, 1, 2, 3, 4, 0]],
  },
  ari: {
    s: [
      [-0.6, -0.2, 'γ', 'Mesarthim'],
      [-0.4, 0.0, 'β', 'Sheratan'],
      [0.2, 0.3, 'α', 'Hamal'],
      [0.7, 0.1, 'δ'],
    ],
    l: [[0, 1, 2, 3]],
  },
  ori: {
    s: [
      [-0.5, 0.7, 'α', 'Betelgeza'],
      [0.5, 0.6, 'γ', 'Bellatrix'],
      [-0.2, 0.0, 'ζ', 'Alnitak'],
      [0.0, 0.05, 'ε', 'Alnilam'],
      [0.2, 0.1, 'δ', 'Mintaka'],
      [-0.45, -0.7, 'κ', 'Saiph'],
      [0.55, -0.65, 'β', 'Rigel'],
      [0.0, -0.35, 'θ', 'M42'],
    ],
    l: [
      [0, 1],
      [1, 4, 3, 2, 0],
      [2, 5],
      [4, 6],
      [3, 7],
    ],
  },
  tau: {
    s: [
      [0.1, 0.2, 'α', 'Aldebaran'],
      [-0.3, 0.45, 'γ'],
      [-0.5, 0.2, 'δ'],
      [-0.35, -0.05, 'ε'],
      [0.7, 0.7, 'β', 'Elnath'],
      [0.5, -0.5, 'ζ'],
      [-0.85, 0.55, 'η', 'Plejady'],
    ],
    l: [
      [3, 2, 1, 0],
      [1, 4],
      [0, 5],
      [2, 6],
    ],
  },
  aur: {
    s: [
      [0.0, 0.7, 'α', 'Kapella'],
      [-0.5, 0.3, 'ε'],
      [-0.3, -0.3, 'η'],
      [0.3, -0.5, 'θ'],
      [0.6, 0.2, 'β', 'Menkalinan'],
      [0.0, -0.1, 'ι'],
    ],
    l: [
      [0, 1, 2, 3, 4, 0],
      [2, 5],
    ],
  },
  gem: {
    s: [
      [-0.5, 0.7, 'α', 'Kastor'],
      [0.1, 0.6, 'β', 'Polluks'],
      [-0.6, 0.2, 'τ'],
      [0.0, 0.1, 'δ'],
      [-0.7, -0.4, 'μ'],
      [-0.2, -0.6, 'γ', 'Alhena'],
      [0.4, -0.2, 'ζ'],
      [-0.9, -0.7, 'η', 'M35'],
    ],
    l: [
      [0, 2, 4, 7],
      [1, 3, 6],
      [3, 5],
      [0, 1],
    ],
  },
  cma: {
    s: [
      [0.0, 0.5, 'α', 'Syriusz'],
      [-0.3, 0.2, 'β', 'Mirzam'],
      [0.2, 0.0, 'δ', 'Wezen'],
      [0.5, -0.3, 'η', 'Aludra'],
      [-0.1, -0.4, 'ε', 'Adhara'],
      [0.4, 0.3, 'γ'],
    ],
    l: [
      [1, 0, 5],
      [0, 2, 3],
      [2, 4],
    ],
  },
  cmi: {
    s: [
      [-0.4, 0.2, 'α', 'Procjon'],
      [0.4, -0.1, 'β', 'Gomeisa'],
    ],
    l: [[0, 1]],
  },
  mon: {
    s: [
      [-0.7, 0.3, 'β', 'β Mon'],
      [-0.1, 0.1, 'δ'],
      [0.4, 0.4, 'α'],
      [0.2, -0.4, 'γ'],
    ],
    l: [
      [0, 1, 2],
      [1, 3],
    ],
  },
  lep: {
    s: [
      [-0.5, 0.4, 'μ'],
      [-0.2, 0.1, 'α', 'Arneb'],
      [0.2, 0.2, 'β', 'Nihal'],
      [0.5, -0.2, 'ε'],
      [-0.4, -0.3, 'δ'],
      [0.0, -0.5, 'γ'],
    ],
    l: [
      [0, 1, 2, 3],
      [1, 4, 5, 2],
    ],
  },
  pup: {
    s: [
      [-0.5, 0.3, 'ξ', 'Okolice M46'],
      [0.0, 0.0, 'ρ'],
      [0.5, 0.3, 'π'],
      [0.2, -0.4, 'ν'],
    ],
    l: [
      [0, 1, 2],
      [1, 3],
    ],
  },
  cnc: {
    s: [
      [-0.6, 0.3, 'ι'],
      [-0.1, 0.1, 'γ', 'Asellus Borealis'],
      [0.1, -0.1, 'δ', 'Asellus Australis'],
      [0.6, -0.4, 'α', 'Acubens'],
      [-0.3, -0.5, 'β', 'Tarf'],
      [-0.4, 0.6, 'ε', 'M44'],
    ],
    l: [
      [0, 1, 2, 3],
      [2, 4],
      [1, 5],
    ],
  },
  lyn: {
    s: [
      [-0.8, 0.4, 'α', 'α Lyn'],
      [-0.3, 0.2, '38'],
      [0.1, 0.35, '31'],
      [0.5, 0.1, '21'],
      [0.8, 0.4, '15'],
    ],
    l: [[0, 1, 2, 3, 4]],
  },
  leo: {
    s: [
      [-0.6, -0.4, 'α', 'Regulus'],
      [-0.5, 0.0, 'η'],
      [-0.3, 0.3, 'γ', 'Algieba'],
      [-0.5, 0.55, 'ζ'],
      [-0.7, 0.35, 'μ'],
      [0.3, 0.4, 'δ', 'Zosma'],
      [0.7, 0.5, 'β', 'Denebola'],
      [0.2, -0.1, 'θ'],
    ],
    l: [
      [0, 1, 2, 3, 4],
      [2, 5, 6],
      [5, 7],
      [0, 7],
    ],
  },
  vir: {
    s: [
      [-0.1, -0.5, 'α', 'Spika'],
      [-0.3, 0.0, 'γ', 'Porrima'],
      [-0.6, 0.3, 'η'],
      [-0.9, 0.5, 'β', 'Zavijava'],
      [0.1, 0.2, 'δ'],
      [0.4, 0.45, 'ε', 'Vindemiatrix'],
      [0.5, -0.3, 'ζ'],
    ],
    l: [
      [0, 1, 2, 3],
      [1, 4, 5],
      [0, 6],
    ],
  },
  com: {
    s: [
      [-0.5, 0.4, 'γ'],
      [0.0, 0.0, 'β', 'β Com'],
      [0.5, 0.3, 'α', 'Diadem'],
    ],
    l: [[0, 1, 2]],
  },
  cvn: {
    s: [
      [-0.4, 0.3, 'α', 'Cor Caroli'],
      [0.4, -0.2, 'β', 'Chara'],
    ],
    l: [[0, 1]],
  },
  hya: {
    s: [
      [-0.95, 0.5, 'δ'],
      [-0.8, 0.6, 'ε'],
      [-0.7, 0.35, 'ζ'],
      [-0.5, 0.2, 'η'],
      [-0.2, 0.0, 'α', 'Alphard'],
      [0.2, -0.2, 'υ'],
      [0.6, -0.35, 'β'],
      [0.9, -0.5, 'γ'],
    ],
    l: [[1, 0, 2, 3, 4, 5, 6, 7]],
  },
  crv: {
    s: [
      [-0.5, 0.4, 'α', 'Alchiba'],
      [-0.3, -0.1, 'ε'],
      [0.2, 0.3, 'γ', 'Gienah'],
      [0.4, -0.2, 'δ', 'Algorab'],
      [0.0, -0.5, 'β', 'Kraz'],
    ],
    l: [[0, 1, 2, 3, 4, 1]],
  },
};

/**
 * Cele z podpowiedzi katalogu — tylko te, które repozytorium samo wymienia.
 * W aplikacji tę listę ma dobierać filtr celów po współrzędnych, nie ten plik.
 */
export const FIGURE_TARGETS: Record<string, [designation: string, detail: string][]> = {
  cas: [
    ['M52', 'gromada otwarta, 6.9 mag'],
    ['M103', 'gromada otwarta, 7.4 mag'],
  ],
  per: [
    ['h+χ Persei', 'gromada otwarta, 4.3 mag'],
    ['M34', 'gromada otwarta, 5.2 mag'],
  ],
  lyr: [
    ['M57', 'mgławica, 8.8 mag'],
    ['M56', 'gromada kulista, 8.4 mag'],
  ],
  her: [
    ['M13', 'gromada kulista, 5.8 mag'],
    ['M92', 'gromada kulista, 6.5 mag'],
  ],
  and: [
    ['M31', 'galaktyka, 3.4 mag'],
    ['M32', 'galaktyka, 8.1 mag'],
    ['M110', 'galaktyka, 8.2 mag'],
  ],
  ori: [
    ['M42', 'mgławica, 4.0 mag'],
    ['M43', 'mgławica, 9.0 mag'],
    ['M78', 'mgławica, 8.0 mag'],
  ],
  tau: [
    ['M45 Plejady', 'gromada otwarta, 1.2 mag'],
    ['M1', 'mgławica, 8.4 mag'],
  ],
  aur: [
    ['M36', 'gromada otwarta, 6.0 mag'],
    ['M37', 'gromada otwarta, 5.6 mag'],
    ['M38', 'gromada otwarta, 6.4 mag'],
  ],
  gem: [['M35', 'gromada otwarta, 5.1 mag']],
  cnc: [
    ['M44 Żłóbek', 'gromada otwarta, 3.1 mag'],
    ['M67', 'gromada otwarta, 6.9 mag'],
  ],
  sct: [
    ['M11', 'gromada otwarta, 5.8 mag'],
    ['M26', 'gromada otwarta, 8.9 mag'],
  ],
  vul: [['M27', 'mgławica, 7.4 mag']],
  tri: [['M33', 'galaktyka, 5.8 mag']],
  cvn: [
    ['M51', 'galaktyka, 8.4 mag'],
    ['M3', 'gromada kulista, 6.4 mag'],
    ['M63', 'galaktyka, 8.6 mag'],
  ],
  cyg: [
    ['M29', 'gromada otwarta, 6.6 mag'],
    ['M39', 'gromada otwarta, 4.6 mag'],
  ],
  sgr: [
    ['M8 Laguna', 'mgławica, 5.8 mag'],
    ['M22', 'gromada kulista, 6.2 mag'],
    ['M17 Omega', 'mgławica, 7.0 mag'],
  ],
  oph: [
    ['M10', 'gromada kulista, 5.0 mag'],
    ['M12', 'gromada kulista, 6.1 mag'],
    ['M19', 'gromada kulista, 5.6 mag'],
  ],
  peg: [['M15', 'gromada kulista, 6.3 mag']],
  leo: [
    ['M65', 'galaktyka, 9.3 mag'],
    ['M66', 'galaktyka, 8.9 mag'],
    ['M95', 'galaktyka, 9.8 mag'],
    ['M96', 'galaktyka, 9.2 mag'],
  ],
  vir: [
    ['M87', 'galaktyka, 9.0 mag'],
    ['M49', 'galaktyka, 8.3 mag'],
    ['M104 Sombrero', 'galaktyka, 8.6 mag'],
  ],
  com: [
    ['M53', 'gromada kulista, 7.8 mag'],
    ['M64 Czarne Oko', 'galaktyka, 8.5 mag'],
    ['M100', 'galaktyka, 9.5 mag'],
  ],
  uma: [
    ['M81 Bodego', 'galaktyka, 6.9 mag'],
    ['M82 Cygaro', 'galaktyka, 8.3 mag'],
    ['M97 Sowa', 'mgławica, 9.9 mag'],
    ['M101 Wiatraczek', 'galaktyka, 7.9 mag'],
  ],
  ser: [
    ['M5', 'gromada kulista, 6.0 mag'],
    ['M16 Orzeł', 'mgławica, 6.0 mag'],
  ],
  sge: [['M71', 'gromada kulista, 6.1 mag']],
  aqr: [
    ['M2', 'gromada kulista, 6.2 mag'],
    ['M72', 'gromada kulista, 9.0 mag'],
  ],
  cap: [['M30', 'gromada kulista, 7.1 mag']],
  sco: [
    ['M4', 'gromada kulista, 5.4 mag'],
    ['M80', 'gromada kulista, 7.3 mag'],
  ],
  cma: [['M41', 'gromada otwarta, 4.5 mag']],
  mon: [['M50', 'gromada otwarta, 5.9 mag']],
  pup: [
    ['M46', 'gromada otwarta, 6.1 mag'],
    ['M47', 'gromada otwarta, 4.4 mag'],
    ['M93', 'gromada otwarta, 6.2 mag'],
  ],
  hya: [
    ['M48', 'gromada otwarta, 5.8 mag'],
    ['M68', 'gromada kulista, 8.0 mag'],
    ['M83', 'galaktyka, 7.2 mag'],
  ],
  lep: [['M79', 'gromada kulista, 8.2 mag']],
  psc: [['M74', 'galaktyka, 9.3 mag']],
  cet: [['M77', 'galaktyka, 9.3 mag']],
};

/** Grupy sezonowe z komentarzy w katalogu — przewijanie galerii ma rytm. */
export const SEASON_ORDER: [label: string, ids: string[]][] = [
  ['okołobiegunowe', ['uma', 'umi', 'cas', 'cep', 'dra', 'per', 'cam', 'lac']],
  [
    'lato i wczesna jesień',
    [
      'cyg',
      'lyr',
      'aql',
      'her',
      'oph',
      'ser',
      'sge',
      'vul',
      'del',
      'crb',
      'boo',
      'sco',
      'sgr',
      'sct',
      'lib',
    ],
  ],
  ['jesień', ['peg', 'and', 'tri', 'psc', 'cet', 'aqr', 'cap', 'ari']],
  ['zima', ['ori', 'tau', 'aur', 'gem', 'cma', 'cmi', 'mon', 'lep', 'pup', 'cnc', 'lyn']],
  ['wiosna', ['leo', 'vir', 'com', 'cvn', 'hya', 'crv']],
];

/** Szukanie bez ogonków: „labedz" ma znaleźć Łabędzia, „bootes" Wolarza. */
export function foldForSearch(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
}
