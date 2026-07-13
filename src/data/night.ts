/**
 * Ostatnie zamockowane dane ekranu Noc.
 *
 * Zachmurzenie, wilgotność, opady, rosa, ocena nocy, faza Księżyca oraz wschód
 * i zachód Słońca są już liczone z prawdziwych danych (src/lib/weather.ts,
 * src/lib/moon.ts). Zostały tylko godziny wschodu i zachodu Księżyca — Open-Meteo
 * ich nie zwraca, więc wymagają osobnego źródła albo policzenia efemeryd.
 *
 * Patrz: Lunaris/Znane luki.md
 */
export const ASTRO_TIMES = {
  moonrise: '22:15',
  moonset: '09:30',
};
