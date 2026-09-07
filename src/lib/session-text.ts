/**
 * Werdykt nocy po ludzku.
 *
 * Te zdania mieszkały w komponencie karty sesji, więc istniały wyłącznie na
 * ekranie. Są jednak czystym rachunkiem na danych werdyktu i potrzebują ich
 * także CLI, raport miesięczny i każde miejsce poza Reactem. Jedno źródło znaczy
 * też, że korekta sformułowania nie rozjedzie dwóch miejsc.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import { formatTime } from './date.ts';
import type { Rejection, Warning } from './session-engine.ts';

const MINUTES_PER_HOUR = 60;

/** np. „3 h 20 min" — długość okna czyta się szybciej niż same minuty. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = Math.round(minutes % MINUTES_PER_HOUR);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Nagłówek nocy: „Dziś w nocy", „Jutro", potem dzień tygodnia. */
export function nightLabel(from: Date, now: Date): string {
  const days = ['niedzieli', 'poniedziałku', 'wtorku', 'środy', 'czwartku', 'piątku', 'soboty'];
  const sameDay =
    from.getFullYear() === now.getFullYear() &&
    from.getMonth() === now.getMonth() &&
    from.getDate() === now.getDate();

  if (sameDay) return 'Dziś w nocy';

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isTomorrow =
    from.getFullYear() === tomorrow.getFullYear() &&
    from.getMonth() === tomorrow.getMonth() &&
    from.getDate() === tomorrow.getDate();

  return isTomorrow ? 'Jutro w nocy' : `Z ${days[from.getDay()]} na następny dzień`;
}

/** Powód odrzucenia po ludzku — użytkownik ma wiedzieć, czego nie da się obejść. */
export function describeRejection(rejection: Rejection): string {
  switch (rejection.kind) {
    case 'no-forecast':
      return 'Brak prognozy na tę noc.';
    case 'conditions':
      switch (rejection.blocker) {
        case 'precipitation':
          return 'Opady przez całą noc.';
        case 'cloud-low':
          return 'Chmury niskie zasłaniają niebo.';
        case 'cloud-high':
          return 'Gęste chmury wysokie przez całą noc.';
        case 'cloud-total':
          return 'Zachmurzenie powyżej progu przez całą noc.';
        case 'wind':
          return 'Porywy wiatru powyżej progu — sprzęt nie ustoi.';
      }
    // Świadome przejście do kolejnego case: każdy blocker wyżej kończy się return.
    case 'window-too-short':
      return `Najdłuższe pogodne okno to ${formatDuration(rejection.longestMinutes)} — za krótko.`;
    case 'not-enough-sleep':
      return `Zostałoby ${rejection.sleepHours.toFixed(1)} h snu przed pobudką.`;
    case 'early-calendar':
      return `Pierwsze jutrzejsze wydarzenie o ${formatTime(rejection.firstEventAt)}.`;
  }
}

export function describeWarning(warning: Warning): string {
  switch (warning.kind) {
    case 'dew':
      return `Rosa: temperatura ${warning.minSpreadC.toFixed(1)}°C od punktu rosy — weź ogrzewacz na obiektyw.`;
    case 'high-clouds':
      return `Chmury wysokie do ${Math.round(warning.maxPercent)}% — kontrast będzie słabszy.`;
    case 'moon':
      return `Księżyc oświetlony w ${warning.illumination}% — tylko cele księżycowe i planetarne.`;
    case 'home-only':
      return `Wydarzenie o ${formatTime(warning.firstEventAt)} — trzymaj się bliskiej lokalizacji.`;
    case 'walk-too-long':
      return `Dojście od parkingu zajmuje ${Math.round(warning.walkMinutes)} min.`;
    case 'tight-sleep':
      return `Sen na styk: ${warning.sleepHours.toFixed(1)} h. Możesz odpuścić.`;
    case 'handheld-wind':
      return `Porywy do ${Math.round(warning.maxGustKmh)} km/h — dla sprzętu z ręki (próg ${warning.handheldLimitKmh} km/h) noc będzie trudna.`;
    case 'session-trimmed':
      return warning.reason === 'sleep'
        ? `Sesja skrócona o ${formatDuration(warning.droppedMinutes)}, żeby zostało na sen. Pogoda pozwala dłużej.`
        : `Sesja skrócona o ${formatDuration(warning.droppedMinutes)} do twojego limitu długości.`;
    case 'sleep-sacrifice':
      return warning.reason === 'phenomenon'
        ? `Zjawisko, które się nie powtórzy — nie skracam nocy. Zostanie ${warning.sleepHours.toFixed(1)} h snu.`
        : `Noc wyjątkowo dobra — nie skracam jej. Zostanie ${warning.sleepHours.toFixed(1)} h snu.`;
    case 'event-in-window':
      return `${warning.title} o ${formatTime(warning.at)} — wypada w trakcie sesji.`;
    case 'session-stretched':
      return `Sesja przedłużona o ${formatDuration(warning.extraMinutes)}, żeby złapać: ${warning.title} o ${formatTime(warning.at)}.`;
    case 'event-after-window':
      return `${warning.title} o ${formatTime(warning.at)} — ${formatDuration(warning.minutesAfter)} po końcu sesji. Zostań dłużej albo odpuść świadomie.`;
  }
}
