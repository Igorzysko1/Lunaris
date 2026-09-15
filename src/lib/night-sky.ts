/**
 * Noc › Niebo: które z policzonych celów pokazać, w jakiej kolejności i które
 * z nich wymagają decyzji.
 *
 * Rachunek położeń i zasięgu jest w `sky-targets`; tu zapada wybór pod ekran.
 * Mieszka w domenie, bo tej samej listy używa Plan („kolejność z segmentu
 * Niebo") i nie może jej ułożyć po swojemu.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { AstroEvent } from '../data/events.ts';
import type { Journal, TargetHistory } from './journal.ts';
import type { NightWindow } from './night-window.ts';
import { rankedTargets, type SkyTarget } from './sky-targets.ts';

/** Ile celów stoi w Niebie i w Planie — tyle, ile czyta się przed wyjazdem. */
export const SKY_LIST_SIZE = 5;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Część wspólna dwóch odcinków; `null`, gdy się nie stykają. */
export function overlapOf(a: NightWindow | null, b: NightWindow): NightWindow | null {
  if (!a) return null;

  const from = a.from > b.from ? a.from : b.from;
  const to = a.to < b.to ? a.to : b.to;
  return from < to ? { from, to } : null;
}

/** Długość odcinka w pełnych minutach; zero, gdy odcinka nie ma. */
export function minutesOf(span: NightWindow | null): number {
  return span ? Math.round((span.to.getTime() - span.from.getTime()) / MINUTE_MS) : 0;
}

/**
 * Cel pokrywa się z oknem na mniej niż połowę — zachodzi w pierwszej połowie
 * albo wschodzi w drugiej. Taki cel wymaga decyzji, kiedy go złapać, więc na
 * liście jest bursztynowy, a w panelu dostaje zdanie.
 */
export function isShortOverlap(up: NightWindow | null, window: NightWindow): boolean {
  return up !== null && minutesOf(overlapOf(up, window)) < minutesOf(window) / 2;
}

export type SkyRow = { target: SkyTarget; urgent: boolean; picked: boolean };

const endOf = (target: SkyTarget) => target.up?.to.getTime() ?? Infinity;
const startOf = (target: SkyTarget) => target.up?.from.getTime() ?? Infinity;

/**
 * Cele w zasięgu wybranego zestawu do pokazania w Niebie.
 *
 * Wybór i kolejność to dwa różne pytania. **Które** — rozstrzyga jasność
 * (`rankedTargets`), bo w zasięgu bywa kilkadziesiąt obiektów, a lista ma być
 * do przeczytania. **W jakiej kolejności** — okno: pierwszy stoi ten, który
 * najszybciej zachodzi, bo to on nie poczeka. Cele dopisane ręcznie do planu
 * tej nocy wchodzą zawsze, także ponad limit.
 */
export function skyList(
  targets: SkyTarget[],
  profileId: string,
  window: NightWindow,
  picks: readonly string[],
  limit = SKY_LIST_SIZE,
): SkyRow[] {
  const inReach = targets.filter((t) => t.profileId === profileId && t.visible);
  const picked = inReach.filter((t) => picks.includes(t.id));
  const rest = rankedTargets(
    inReach.filter((t) => !picks.includes(t.id)),
    Math.max(0, limit - picked.length),
  );

  return [...picked, ...rest]
    .sort((a, b) => endOf(a) - endOf(b) || startOf(a) - startOf(b) || b.maxAltitude - a.maxAltitude)
    .map((target) => ({
      target,
      urgent: isShortOverlap(target.up, window),
      picked: picks.includes(target.id),
    }));
}

/**
 * Cele, które tej nocy wychodzą nad horyzont, a zestaw ich nie pokaże albo
 * zasłania je teren. Pomijamy te, które w ogóle nie wschodzą — „za nisko" dla
 * połowy katalogu to nie informacja. Najpierw najbliższe granicy zasięgu.
 */
export function outOfReach(targets: SkyTarget[], profileId: string): SkyTarget[] {
  return targets
    .filter((t) => t.profileId === profileId && t.outOfReach !== null && t.outOfReach !== 'too-low')
    .sort((a, b) => b.margin - a.margin);
}

/**
 * „1. RAZ" — obiekt, którego dziennik nie zna jako widzianego. Przy pustym
 * dzienniku znacznik niczego nie odróżnia, więc go nie ma; planety wracają co
 * roku i nie dostają go nigdy, tak jak w `orderByHistory`.
 */
export function isFirstTime(
  target: { kind: 'planet' | 'dso' },
  history: TargetHistory | undefined,
  journal: Journal,
): boolean {
  return target.kind === 'dso' && journal.logs.length > 0 && (history?.seenCount ?? 0) === 0;
}

/** Najbliższe zjawisko widoczne z tego miejsca; `null`, gdy w horyzoncie nie ma żadnego. */
export function nextVisibleEvent(events: AstroEvent[], now: Date): AstroEvent | null {
  return events.find((event) => event.visible && event.at >= now) ?? null;
}

/**
 * Czy w panelu celu wolno odhaczać: od zachodu do wschodu Słońca tej nocy.
 * Wcześniej panel nie udaje, że coś widać; po świcie noc zamyka się już
 * arkuszem „Jak było?", z pamięci i bez godziny.
 */
export function checkOffOpen(axis: NightWindow, now: Date): boolean {
  return now >= axis.from && now <= axis.to;
}

/** Pełne godziny wewnątrz nocy — słupki profilu wysokości w panelu celu. */
export function fullHours(night: NightWindow): Date[] {
  const first = new Date(night.from);
  first.setMinutes(0, 0, 0);
  if (first < night.from) first.setTime(first.getTime() + HOUR_MS);

  const hours: Date[] = [];
  for (let t = first.getTime(); t <= night.to.getTime(); t += HOUR_MS) hours.push(new Date(t));
  return hours;
}

/** Indeksy słupków leżących w odcinku — podświetlenie okna; `null`, gdy żaden. */
export function slotsWithin(hours: Date[], span: NightWindow | null): [number, number] | null {
  if (!span) return null;

  const inside = hours.flatMap((hour, i) => (hour >= span.from && hour <= span.to ? [i] : []));
  return inside.length ? [inside[0], inside[inside.length - 1]] : null;
}
