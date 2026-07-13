export type Place = {
  name: string;
  region: string;
  lat: number;
  lon: number;
  /** Bortle scale 1 (pristine dark) – 9 (inner-city sky). */
  bortle: number;
};

/** Device GPS position used to sort places by distance — Katowice. */
export const DEVICE_POSITION = { lat: 50.259, lon: 19.021 };

/** The place GPS resolves to. Real geocoding replaces this once expo-location lands. */
export const DEVICE_CITY = 'Katowice';

export const CITIES: Place[] = [
  // śląskie
  { name: 'Katowice', region: 'śląskie', lat: 50.259, lon: 19.021, bortle: 9 },
  { name: 'Chorzów', region: 'śląskie', lat: 50.297, lon: 18.954, bortle: 9 },
  { name: 'Siemianowice Śl.', region: 'śląskie', lat: 50.328, lon: 19.029, bortle: 9 },
  { name: 'Świętochłowice', region: 'śląskie', lat: 50.291, lon: 18.918, bortle: 9 },
  { name: 'Sosnowiec', region: 'śląskie', lat: 50.286, lon: 19.104, bortle: 9 },
  { name: 'Mysłowice', region: 'śląskie', lat: 50.208, lon: 19.133, bortle: 8 },
  { name: 'Ruda Śląska', region: 'śląskie', lat: 50.258, lon: 18.856, bortle: 9 },
  { name: 'Zabrze', region: 'śląskie', lat: 50.303, lon: 18.786, bortle: 9 },
  { name: 'Bytom', region: 'śląskie', lat: 50.348, lon: 18.916, bortle: 9 },
  { name: 'Gliwice', region: 'śląskie', lat: 50.297, lon: 18.677, bortle: 8 },
  { name: 'Piekary Śląskie', region: 'śląskie', lat: 50.383, lon: 18.951, bortle: 8 },
  { name: 'Czeladź', region: 'śląskie', lat: 50.316, lon: 19.079, bortle: 9 },
  { name: 'Będzin', region: 'śląskie', lat: 50.327, lon: 19.128, bortle: 8 },
  { name: 'Dąbrowa Górnicza', region: 'śląskie', lat: 50.323, lon: 19.187, bortle: 8 },
  { name: 'Tychy', region: 'śląskie', lat: 50.124, lon: 18.988, bortle: 8 },
  { name: 'Mikołów', region: 'śląskie', lat: 50.171, lon: 18.906, bortle: 7 },
  { name: 'Jaworzno', region: 'śląskie', lat: 50.205, lon: 19.275, bortle: 7 },
  { name: 'Knurów', region: 'śląskie', lat: 50.219, lon: 18.669, bortle: 7 },
  { name: 'Tarnowskie Góry', region: 'śląskie', lat: 50.445, lon: 18.862, bortle: 7 },
  { name: 'Rybnik', region: 'śląskie', lat: 50.097, lon: 18.542, bortle: 8 },
  { name: 'Żory', region: 'śląskie', lat: 50.045, lon: 18.7, bortle: 7 },
  { name: 'Jastrzębie-Zdrój', region: 'śląskie', lat: 49.951, lon: 18.573, bortle: 7 },
  { name: 'Wodzisław Śląski', region: 'śląskie', lat: 50.001, lon: 18.462, bortle: 7 },
  { name: 'Racibórz', region: 'śląskie', lat: 50.092, lon: 18.219, bortle: 6 },
  { name: 'Bielsko-Biała', region: 'śląskie', lat: 49.822, lon: 19.044, bortle: 7 },
  { name: 'Cieszyn', region: 'śląskie', lat: 49.749, lon: 18.633, bortle: 6 },
  { name: 'Czechowice-Dziedz.', region: 'śląskie', lat: 49.909, lon: 19.01, bortle: 6 },
  { name: 'Żywiec', region: 'śląskie', lat: 49.685, lon: 19.192, bortle: 5 },
  { name: 'Szczyrk', region: 'śląskie', lat: 49.717, lon: 19.037, bortle: 4 },
  { name: 'Częstochowa', region: 'śląskie', lat: 50.797, lon: 19.121, bortle: 7 },
  { name: 'Zawiercie', region: 'śląskie', lat: 50.489, lon: 19.427, bortle: 6 },
  { name: 'Myszków', region: 'śląskie', lat: 50.575, lon: 19.324, bortle: 6 },
  { name: 'Lubliniec', region: 'śląskie', lat: 50.669, lon: 18.677, bortle: 5 },
  // małopolskie
  { name: 'Kraków', region: 'małopolskie', lat: 50.062, lon: 19.937, bortle: 8 },
  { name: 'Chrzanów', region: 'małopolskie', lat: 50.135, lon: 19.401, bortle: 6 },
  { name: 'Trzebinia', region: 'małopolskie', lat: 50.159, lon: 19.468, bortle: 6 },
  { name: 'Olkusz', region: 'małopolskie', lat: 50.281, lon: 19.565, bortle: 6 },
  { name: 'Oświęcim', region: 'małopolskie', lat: 50.038, lon: 19.222, bortle: 6 },
  { name: 'Wadowice', region: 'małopolskie', lat: 49.883, lon: 19.492, bortle: 5 },
  { name: 'Andrychów', region: 'małopolskie', lat: 49.855, lon: 19.34, bortle: 5 },
  { name: 'Sucha Beskidzka', region: 'małopolskie', lat: 49.74, lon: 19.594, bortle: 4 },
  { name: 'Zakopane', region: 'małopolskie', lat: 49.299, lon: 19.949, bortle: 4 },
  { name: 'Nowy Targ', region: 'małopolskie', lat: 49.477, lon: 20.033, bortle: 5 },
  { name: 'Tarnów', region: 'małopolskie', lat: 50.013, lon: 20.986, bortle: 6 },
  // opolskie
  { name: 'Opole', region: 'opolskie', lat: 50.675, lon: 17.921, bortle: 7 },
  { name: 'Kędzierzyn-Koźle', region: 'opolskie', lat: 50.349, lon: 18.226, bortle: 6 },
  { name: 'Strzelce Opolskie', region: 'opolskie', lat: 50.512, lon: 18.303, bortle: 5 },
  { name: 'Krapkowice', region: 'opolskie', lat: 50.475, lon: 17.965, bortle: 5 },
  { name: 'Nysa', region: 'opolskie', lat: 50.474, lon: 17.333, bortle: 6 },
  { name: 'Prudnik', region: 'opolskie', lat: 50.321, lon: 17.577, bortle: 5 },
  { name: 'Kluczbork', region: 'opolskie', lat: 50.974, lon: 18.216, bortle: 5 },
  // łódzkie
  { name: 'Bełchatów', region: 'łódzkie', lat: 51.363, lon: 19.356, bortle: 6 },
  { name: 'Radomsko', region: 'łódzkie', lat: 51.068, lon: 19.445, bortle: 5 },
  { name: 'Piotrków Tryb.', region: 'łódzkie', lat: 51.405, lon: 19.703, bortle: 6 },
  { name: 'Wieluń', region: 'łódzkie', lat: 51.221, lon: 18.57, bortle: 5 },
  // świętokrzyskie
  { name: 'Kielce', region: 'świętokrzyskie', lat: 50.867, lon: 20.629, bortle: 6 },
  { name: 'Jędrzejów', region: 'świętokrzyskie', lat: 50.639, lon: 20.303, bortle: 5 },
  { name: 'Włoszczowa', region: 'świętokrzyskie', lat: 50.855, lon: 19.965, bortle: 4 },
];

export const GMINY: Place[] = [
  // śląskie — okolice Katowic / GOP
  { name: 'Wyry', region: 'pow. mikołowski', lat: 50.135, lon: 18.933, bortle: 7 },
  { name: 'Kobiór', region: 'pow. pszczyński', lat: 50.088, lon: 18.936, bortle: 6 },
  { name: 'Bojszowy', region: 'pow. bieruńsko-lędz.', lat: 50.058, lon: 19.053, bortle: 6 },
  { name: 'Chełm Śląski', region: 'pow. bieruńsko-lędz.', lat: 50.156, lon: 19.192, bortle: 7 },
  { name: 'Bobrowniki', region: 'pow. będziński', lat: 50.394, lon: 19.033, bortle: 7 },
  { name: 'Psary', region: 'pow. będziński', lat: 50.376, lon: 19.161, bortle: 7 },
  { name: 'Świerklaniec', region: 'pow. tarnogórski', lat: 50.424, lon: 18.976, bortle: 6 },
  { name: 'Ożarowice', region: 'pow. tarnogórski', lat: 50.452, lon: 18.999, bortle: 6 },
  { name: 'Mierzęcice', region: 'pow. będziński', lat: 50.423, lon: 19.133, bortle: 6 },
  { name: 'Gierałtowice', region: 'pow. gliwicki', lat: 50.226, lon: 18.723, bortle: 7 },
  { name: 'Ornontowice', region: 'pow. mikołowski', lat: 50.181, lon: 18.747, bortle: 6 },
  { name: 'Zbrosławice', region: 'pow. tarnogórski', lat: 50.398, lon: 18.749, bortle: 6 },
  { name: 'Pilchowice', region: 'pow. gliwicki', lat: 50.169, lon: 18.622, bortle: 6 },
  { name: 'Rudziniec', region: 'pow. gliwicki', lat: 50.315, lon: 18.454, bortle: 5 },
  { name: 'Świerklany', region: 'pow. rybnicki', lat: 50.028, lon: 18.59, bortle: 6 },
  { name: 'Godów', region: 'pow. wodzisławski', lat: 49.917, lon: 18.481, bortle: 6 },
  { name: 'Gorzyce', region: 'pow. wodzisławski', lat: 49.978, lon: 18.375, bortle: 5 },
  { name: 'Krzyżanowice', region: 'pow. raciborski', lat: 49.995, lon: 18.283, bortle: 5 },
  { name: 'Lyski', region: 'pow. rybnicki', lat: 50.108, lon: 18.41, bortle: 5 },
  { name: 'Nędza', region: 'pow. raciborski', lat: 50.17, lon: 18.32, bortle: 5 },
  { name: 'Kornowac', region: 'pow. raciborski', lat: 50.055, lon: 18.276, bortle: 5 },
  { name: 'Pietrowice Wlk.', region: 'pow. raciborski', lat: 50.077, lon: 18.128, bortle: 5 },
  { name: 'Wręczyca Wielka', region: 'pow. kłobucki', lat: 50.816, lon: 18.918, bortle: 5 },
  { name: 'Kłobuck', region: 'pow. kłobucki', lat: 50.906, lon: 18.938, bortle: 5 },
  { name: 'Koziegłowy', region: 'pow. myszkowski', lat: 50.605, lon: 19.14, bortle: 5 },
  { name: 'Poraj', region: 'pow. myszkowski', lat: 50.665, lon: 19.213, bortle: 5 },
  { name: 'Woźniki', region: 'pow. lubliniecki', lat: 50.588, lon: 18.994, bortle: 5 },
  { name: 'Kochanowice', region: 'pow. lubliniecki', lat: 50.702, lon: 18.729, bortle: 4 },
  { name: 'Herby', region: 'pow. lubliniecki', lat: 50.717, lon: 18.813, bortle: 4 },
  { name: 'Wilkowice', region: 'pow. bielski', lat: 49.762, lon: 19.041, bortle: 5 },
  { name: 'Buczkowice', region: 'pow. bielski', lat: 49.729, lon: 19.075, bortle: 5 },
  { name: 'Łodygowice', region: 'pow. żywiecki', lat: 49.74, lon: 19.132, bortle: 5 },
  { name: 'Ślemień', region: 'pow. żywiecki', lat: 49.686, lon: 19.428, bortle: 4 },
  // Beskidy (śląskie)
  { name: 'Istebna', region: 'pow. cieszyński', lat: 49.552, lon: 18.902, bortle: 4 },
  { name: 'Wisła', region: 'pow. cieszyński', lat: 49.656, lon: 18.859, bortle: 4 },
  { name: 'Brenna', region: 'pow. cieszyński', lat: 49.723, lon: 18.905, bortle: 4 },
  { name: 'Ujsoły', region: 'pow. żywiecki', lat: 49.485, lon: 19.126, bortle: 3 },
  { name: 'Rajcza', region: 'pow. żywiecki', lat: 49.517, lon: 19.115, bortle: 3 },
  { name: 'Milówka', region: 'pow. żywiecki', lat: 49.55, lon: 19.083, bortle: 4 },
  { name: 'Węgierska Górka', region: 'pow. żywiecki', lat: 49.593, lon: 19.126, bortle: 4 },
  { name: 'Jeleśnia', region: 'pow. żywiecki', lat: 49.593, lon: 19.336, bortle: 3 },
  { name: 'Koszarawa', region: 'pow. żywiecki', lat: 49.598, lon: 19.394, bortle: 3 },
  // Jura Krakowsko-Częstochowska
  { name: 'Żarki', region: 'pow. myszkowski', lat: 50.626, lon: 19.363, bortle: 4 },
  { name: 'Janów', region: 'pow. częstochowski', lat: 50.762, lon: 19.397, bortle: 4 },
  { name: 'Niegowa', region: 'pow. myszkowski', lat: 50.671, lon: 19.516, bortle: 4 },
  { name: 'Lelów', region: 'pow. częstochowski', lat: 50.688, lon: 19.638, bortle: 4 },
  { name: 'Kroczyce', region: 'pow. zawierciański', lat: 50.539, lon: 19.607, bortle: 4 },
  { name: 'Ogrodzieniec', region: 'pow. zawierciański', lat: 50.452, lon: 19.523, bortle: 5 },
  { name: 'Włodowice', region: 'pow. zawierciański', lat: 50.512, lon: 19.48, bortle: 4 },
  { name: 'Mstów', region: 'pow. częstochowski', lat: 50.815, lon: 19.279, bortle: 5 },
  // małopolskie (Babia Góra / Gorce / Orawa)
  { name: 'Zawoja', region: 'pow. suski', lat: 49.632, lon: 19.535, bortle: 3 },
  { name: 'Lipnica Wielka', region: 'pow. nowotarski', lat: 49.52, lon: 19.681, bortle: 3 },
  { name: 'Jabłonka', region: 'pow. nowotarski', lat: 49.478, lon: 19.694, bortle: 3 },
  { name: 'Ochotnica Dolna', region: 'pow. nowotarski', lat: 49.531, lon: 20.281, bortle: 3 },
  { name: 'Bukowina Tatrz.', region: 'pow. tatrzański', lat: 49.323, lon: 20.1, bortle: 4 },
  // opolskie (Góry Opawskie)
  { name: 'Głuchołazy', region: 'pow. nyski', lat: 50.313, lon: 17.382, bortle: 5 },
  { name: 'Korfantów', region: 'pow. nyski', lat: 50.481, lon: 17.585, bortle: 4 },
  // świętokrzyskie
  { name: 'Bodzentyn', region: 'pow. kielecki', lat: 50.943, lon: 20.964, bortle: 4 },
];
