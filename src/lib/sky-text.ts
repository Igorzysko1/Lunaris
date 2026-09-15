/**
 * Niebo i panel celu po ludzku: okna celów, krótkie pokrycie z oknem sesji,
 * najbliższe zjawisko i podpisy zestawu.
 *
 * Osobno od `session-text`, bo tamten moduł mówi o werdykcie nocy, a ten
 * o pojedynczym celu. Liczby przychodzą z `night-sky` i `sky-targets`.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { AstroEvent } from '../data/events.ts';
import { formatTime } from './date.ts';
import { compassLabel } from './horizon.ts';
import { plural } from './journal-text.ts';
import { minutesOf, overlapOf } from './night-sky.ts';
import type { NightWindow } from './night-window.ts';
import type { Optics } from './optics.ts';
import { formatDuration } from './session-text.ts';
import type { UpSpan } from './sky-targets.ts';

const DAY_MS = 86_400_000;

const decimal = (value: number) => value.toFixed(1).replace('.', ',');

/**
 * Okno celu na liście: „do 01:05" (zachodzi), „od 23:30" (wschodzi),
 * „23:30–01:05" (jedno i drugie) albo „całe okno".
 */
export function describeUpSpan(up: UpSpan | null): string {
  if (!up) return 'nie wschodzi';
  if (up.rises && up.sets) return `${formatTime(up.from)}–${formatTime(up.to)}`;
  if (up.sets) return `do ${formatTime(up.to)}`;
  if (up.rises) return `od ${formatTime(up.from)}`;
  return 'całe okno';
}

/**
 * Zdanie w panelu celu, gdy cel pokrywa się z oknem sesji na mniej niż połowę
 * (6b). Mówi, co z tym zrobić: złapać na początku, zostawić na koniec albo
 * zmieścić się w konkretnym odcinku. `null`, gdy pokrycie wystarcza.
 */
export function describeShortOverlap(up: UpSpan | null, window: NightWindow): string | null {
  if (!up) return null;

  const overlap = overlapOf(up, window);
  const minutes = minutesOf(overlap);
  if (minutes >= minutesOf(window) / 2) return null;

  if (!overlap) {
    return `Nie pokrywa się z oknem — nad horyzontem od ${formatTime(up.from)} do ${formatTime(up.to)}.`;
  }

  const lead = `Pokrywa się z oknem tylko na ${formatDuration(minutes)}`;
  const setsEarly = up.sets && up.to <= window.to;
  const risesLate = up.rises && up.from >= window.from;

  if (setsEarly && !risesLate) {
    return `${lead} — złap go na początku, zachodzi o ${formatTime(up.to)}.`;
  }
  if (risesLate && !setsEarly) {
    return `${lead} — zostaw go na koniec, wschodzi o ${formatTime(up.from)}.`;
  }
  return `${lead}, od ${formatTime(overlap.from)} do ${formatTime(overlap.to)}.`;
}

const dayStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** „Opozycja Neptuna · za 6 dni" — żeton nad listą celów. */
export function describeEventWhen(event: Pick<AstroEvent, 'title' | 'at'>, now: Date): string {
  const days = Math.round((dayStart(event.at) - dayStart(now)) / DAY_MS);
  const when = days <= 0 ? 'dziś' : days === 1 ? 'jutro' : `za ${days} dni`;
  return `${event.title} · ${when}`;
}

/** „3 cele poza zasięgiem · SCT 8″" */
export function outOfReachTitle(count: number, profile: string): string {
  return `${count} ${plural(count, ['cel', 'cele', 'celów'])} poza zasięgiem · ${profile}`;
}

/** „pow. 81× · pole 36′" — pole poniżej stopnia w minutach, bo tak je podaje okular. */
export function describeOpticsReach(optics: Pick<Optics, 'magnification' | 'fieldOfView'>): string {
  const field =
    optics.fieldOfView < 1
      ? `${Math.round(optics.fieldOfView * 60)}′`
      : `${decimal(optics.fieldOfView)}°`;
  return `pow. ${optics.magnification}× · pole ${field}`;
}

/** Rozmiar kątowy obiektu: „3,2°" albo „20′". */
export function describeSize(arcmin: number): string {
  return arcmin >= 60 ? `${decimal(arcmin / 60)}°` : `${Math.round(arcmin)}′`;
}

/** „azymut 112° E" */
export function describeAzimuth(azimuth: number): string {
  const degrees = ((Math.round(azimuth) % 360) + 360) % 360;
  return `azymut ${degrees}° ${compassLabel(azimuth)}`;
}

/** Tytuł odhaczenia w panelu: „Widziałem — 23:04", a bez godziny samo „Widziałem". */
export function seenTitle(seenAt: string | undefined): string {
  return seenAt ? `Widziałem — ${formatTime(new Date(seenAt))}` : 'Widziałem';
}
