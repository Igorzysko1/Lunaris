/**
 * Kalendarz, Eventy i powiadomienia po ludzku: żetony zjawisk, stan nocy,
 * kiedy i dlaczego coś się odezwie albo zmilczy, dzień w siatce miesiąca.
 *
 * Rozstrzygnięcia są w `event-review` (co i kiedy zgłosić) i `session-engine`
 * (werdykt nocy); tu tylko zdania, żeby Kalendarz, arkusz zjawiska i ekran
 * powiadomień mówiły o tym samym tymi samymi słowami.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import { CONSTELLATIONS } from '../data/constellations.ts';
import type { AstroEvent } from '../data/events.ts';
import { METEOR_SHOWERS, type MeteorShower } from '../data/meteor-showers.ts';
import type { Coords } from '../data/places.ts';
import { ratingScore } from './astro.ts';
import { formatDayMonth, formatLongDate, formatTime } from './date.ts';
import type { EventOutlook, NoticeReason, NotifyCategory, Silence } from './event-review.ts';
import { moonAt } from './moon.ts';
import type { NightVerdict } from './session-engine.ts';
import { describeRejection } from './session-text.ts';
import { targetLabel } from './sky-targets.ts';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const pad = (value: number) => String(value).padStart(2, '0');
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const dayStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Doby kalendarzowe od dziś do daty — doba zmiany czasu ma 23 albo 25 godzin. */
function daysUntil(at: Date, now: Date): number {
  return Math.round((dayStart(at) - dayStart(now)) / DAY_MS);
}

export const CATEGORY_LABELS: Record<NotifyCategory, string> = {
  eclipses: 'Zaćmienia',
  meteors: 'Roje meteorów',
  planets: 'Koniunkcje i opozycje',
  moon: 'Fazy Księżyca',
};

export const PROPOSAL_NOTE = 'Propozycja z werdyktu „jedź" — w kalendarzu jej jeszcze nie ma.';

export const PREVIEW_BOOKING_NOTE =
  'Wpis obejmie całą noc — planu wyjazdu jeszcze nie ma. Gdy noc wejdzie w prognozę, „Zaktualizuj wpis" w Planie podmieni godziny na wyjazd.';

const PREVIEW_NOTE =
  'Drugi raz odezwie się dopiero wtedy, gdy noc wejdzie w prognozę i przejdzie przez progi. Bez tego byłoby codzienne przypomnienie o czymś za kilka tygodni.';

export const REOPENED_NOTE =
  'Wcześniej ta noc była odrzucona. Zmiana prognozy jest jedyną rzeczą, która wraca w powiadomieniu drugi raz.';

/** „20.09" */
export function dayDot(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
}

/** „20.09 · 01:20" */
export function eventWhen(at: Date): string {
  return `${dayDot(at)} · ${formatTime(at)}`;
}

/** „środa 21 października, 04:57 · maksimum roju" */
export function eventSubtitle(event: Pick<AstroEvent, 'at' | 'type'>): string {
  const date = lowerFirst(formatLongDate(event.at)).replace(',', '');
  const kind = event.type === 'meteor_shower' ? ' · maksimum roju' : '';
  return `${date}, ${formatTime(event.at)}${kind}`;
}

/** Nad listą zjawisk: dla jakiego miejsca i jak daleko sięga prognoza. */
export function horizonNote(nights: number): string {
  return nights > 0
    ? `Policzone dla tego miejsca · prognoza sięga ${nights} nocy`
    : 'Policzone dla tego miejsca · bez prognozy, więc wszystko jest zapowiedzią';
}

export type EventChip = { label: string; tone: 'go' | 'bad' | 'accent' | 'neutral' };

const scoreOf = (rating: number | null) => (rating === null ? '?' : String(ratingScore(rating)));

/** Żetony zjawiska na liście: werdykt nocy w prognozie albo zapowiedź poza nią. */
export function eventChips(
  outlook: EventOutlook,
  rating: number | null,
  at: Date,
  now: Date,
): EventChip[] {
  if (outlook.state === 'go') {
    const window = outlook.verdict?.window;
    return [
      { label: `noc się nadaje · ${scoreOf(rating)}/5`, tone: 'go' },
      ...(window
        ? [
            {
              label: `okno ${formatTime(window.from)} – ${formatTime(window.to)}`,
              tone: 'neutral' as const,
            },
          ]
        : []),
    ];
  }
  if (outlook.state === 'no-go') return [{ label: 'noc odrzucona', tone: 'bad' }];
  if (outlook.silence) return [];

  const days = daysUntil(at, now);
  const when = days <= 0 ? 'dziś' : days === 1 ? 'jutro' : `za ${days} dni`;
  return [{ label: `zapowiedź · ${when}`, tone: 'accent' }];
}

/** Dlaczego zjawisko się nie odezwie. */
export function silenceText(silence: Silence, verdict: NightVerdict | null): string {
  switch (silence) {
    case 'invisible':
      return 'Stąd niewidoczne — nie odezwie się.';
    case 'muted':
      return 'Wyciszone ręcznie — nie odezwie się.';
    case 'category-off':
      return 'Ta kategoria jest wyłączona w powiadomieniach.';
    case 'no-go':
      return verdict?.rejection
        ? `Noc odrzucona — ${lowerFirst(describeRejection(verdict.rejection))}`
        : 'Noc odrzucona — nie odezwie się.';
    case 'not-notable':
      return 'Z wyprzedzeniem zapowiadamy tylko zaćmienia i maksima rojów — o tym powie przegląd, gdy noc wejdzie w prognozę i przejdzie progi.';
  }
}

/** Panel stanu w arkuszu zjawiska (15b). */
export function eventStatus(
  outlook: EventOutlook,
  rating: number | null,
  event: Pick<AstroEvent, 'at' | 'visible'>,
  now: Date,
): { label: string; text: string; tone: 'go' | 'bad' | 'accent' | 'neutral' } {
  if (!event.visible) {
    return {
      label: 'Stąd niewidoczne',
      text: 'Z tego miejsca zjawisko nie wychodzi nad horyzont w oknie nocy.',
      tone: 'neutral',
    };
  }

  if (outlook.state === 'go') {
    const window = outlook.verdict?.window;
    return {
      label: 'W zasięgu prognozy',
      text: `Noc się nadaje · ${scoreOf(rating)}/5${window ? `, okno ${formatTime(window.from)} – ${formatTime(window.to)}` : ''}.`,
      tone: 'go',
    };
  }

  if (outlook.state === 'no-go') {
    return {
      label: 'Noc odrzucona',
      text: outlook.verdict?.rejection
        ? describeRejection(outlook.verdict.rejection)
        : 'Brak okna.',
      tone: 'bad',
    };
  }

  const days = Math.max(0, daysUntil(event.at, now));
  return {
    label: 'Zapowiedź, nie obietnica',
    text: `Za ${days} ${days === 1 ? 'dzień' : 'dni'} — poza zasięgiem prognozy, więc nie wiem, czy noc się nada. Wiem tylko, że zjawisko wypadnie i że stąd je widać.`,
    tone: 'accent',
  };
}

/** Kiedy zjawisko się odezwie — z planu ostatniego przeglądu albo z powodu milczenia. */
export function notifyText(input: {
  outlook: EventOutlook;
  planned: { notifyAt: Date; reason: NoticeReason } | null;
  eventAt: Date;
  enabled: boolean;
}): { text: string; note: string } {
  const { outlook, planned, eventAt, enabled } = input;

  if (!enabled) return { text: 'Powiadomienia są wyłączone — nic się nie odezwie.', note: '' };
  if (outlook.silence) return { text: silenceText(outlook.silence, outlook.verdict), note: '' };

  if (planned) {
    const at = `${formatDayMonth(planned.notifyAt)} o ${formatTime(planned.notifyAt)}`;
    if (planned.reason === 'preview') {
      return {
        text: `Odezwie się ${at} — tydzień wcześniej, o porze przeglądu.`,
        note: PREVIEW_NOTE,
      };
    }

    const hours = Math.max(
      0,
      Math.round((eventAt.getTime() - planned.notifyAt.getTime()) / HOUR_MS),
    );
    return {
      text: `Odezwie się ${at} — ${hours} h przed zjawiskiem.`,
      note: planned.reason === 'reopened' ? REOPENED_NOTE : '',
    };
  }

  return {
    text: 'Już zgłoszone albo zgłosi się przy najbliższym przeglądzie — to samo zjawisko w tym samym stanie nie wraca.',
    note: '',
  };
}

/** Żeton powodu przy zaplanowanym powiadomieniu. */
export function reasonBadge(reason: NoticeReason): { label: string; tone: 'go' | 'accent' } {
  switch (reason) {
    case 'preview':
      return { label: 'zapowiedź', tone: 'accent' };
    case 'new':
      return { label: 'nowe', tone: 'go' };
    case 'confirmed':
      return { label: 'potwierdzone', tone: 'go' };
    case 'reopened':
      return { label: 'wróciło', tone: 'go' };
  }
}

/** „14 października, 18:00 · 7 dni przed" albo „19 września, 13:20 · 12 h przed". */
export function scheduledWhen(notifyAt: Date, reason: NoticeReason, eventAt: Date | null): string {
  const base = `${formatDayMonth(notifyAt)}, ${formatTime(notifyAt)}`;
  if (!eventAt) return base;

  const before =
    reason === 'preview'
      ? `${Math.max(0, daysUntil(eventAt, notifyAt))} dni przed`
      : `${Math.max(0, Math.round((eventAt.getTime() - notifyAt.getTime()) / HOUR_MS))} h przed`;
  return `${base} · ${before}`;
}

/** „12 h" */
export function leadLabel(leadTime: string): string {
  return `${leadTime.slice(0, -1)} h`;
}

/** „18:00" */
export function hourLabel(hour: number): string {
  return `${pad(hour)}:00`;
}

/** Linia werdyktu pod dniem w siatce miesiąca. */
export function dayVerdictLine(verdict: NightVerdict): string {
  if (verdict.status === 'go' && verdict.window) {
    return `Noc: jedź · okno ${formatTime(verdict.window.from)}–${formatTime(verdict.window.to)}`;
  }
  return `Noc: odpuść — ${verdict.rejection ? describeRejection(verdict.rejection) : 'brak okna.'}`;
}

/** „21:05 → 03:25" */
export function spanText(start: Date, end: Date): string {
  return `${formatTime(start)} → ${formatTime(end)}`;
}

function meteorShowerOf(eventId: string): MeteorShower | null {
  const match = /^meteor-(.+)-\d{4}$/.exec(eventId);
  return match ? (METEOR_SHOWERS.find((shower) => shower.id === match[1]) ?? null) : null;
}

/** Żetony faktów w arkuszu zjawiska: Księżyc w chwili zjawiska i ZHR roju. */
export function eventFacts(event: Pick<AstroEvent, 'id' | 'at'>, coords: Coords): string[] {
  const facts = [`Księżyc ${moonAt(event.at, coords.lat, coords.lon).illumination}%`];
  const shower = meteorShowerOf(event.id);
  if (shower) facts.push(`ZHR ${shower.zhr}`);
  return facts;
}

export type ShowTarget = { label: string; kind: 'constellation' | 'target' | 'moon'; id: string };

/**
 * „Pokaż na niebie" z arkusza zjawiska: gwiazdozbiór radiantu roju, planeta
 * w opozycji albo Księżyc. `null`, gdy zjawisko nie ma jednego miejsca do pokazania.
 */
export function showTargetFor(event: Pick<AstroEvent, 'id' | 'type'>): ShowTarget | null {
  const shower = meteorShowerOf(event.id);
  if (shower) {
    const constellation = CONSTELLATIONS.find((c) => c.name === shower.constellation);
    return constellation
      ? { label: `Pokaż: ${constellation.name}`, kind: 'constellation', id: constellation.id }
      : null;
  }

  const opposition = /^opp-(.+)-\d{4}-\d{2}-\d{2}$/.exec(event.id);
  if (opposition) {
    const id = `planet-${opposition[1]}`;
    return { label: `Pokaż: ${targetLabel(id)}`, kind: 'target', id };
  }

  if (event.type === 'moon_phase' || event.id.startsWith('ecl-moon-')) {
    return { label: 'Pokaż Księżyc', kind: 'moon', id: 'moon' };
  }

  return null;
}
