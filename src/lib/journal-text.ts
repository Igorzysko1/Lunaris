/**
 * Dziennik po ludzku: podpisy wpisów, powody i godziny przebiegu.
 *
 * Osobno od `journal.ts`, bo tamten moduł jest kontraktem zapisu — tu żyją
 * wyłącznie zdania, a ich poprawka nie może dotykać migracji dziennika.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import { formatNightSpan } from './date.ts';
import {
  PACKED_UP,
  packedUp,
  parseNightId,
  type AttemptConditions,
  type NightLog,
} from './journal.ts';
import { monthLabel } from './monthly-report.ts';
import type { TimelineStep } from './session-timeline.ts';

export type EntryTone = 'go' | 'warn' | 'bad';

/** Polska liczba mnoga: 1 widziany, 2–4 widziane, 5 widzianych — i 12–14 jak 5. */
export function plural(count: number, [one, few, many]: readonly [string, string, string]): string {
  if (count === 1) return one;

  const last = count % 10;
  const lastTwo = count % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
}

/** „14/15 września" — z identyfikatora nocy, czyli z daty wieczoru. */
export function nightSpanOfLog(log: Pick<NightLog, 'id' | 'nightFrom'>): string {
  const evening = parseNightId(log.id) ?? new Date(log.nightFrom);
  const morning = new Date(evening.getFullYear(), evening.getMonth(), evening.getDate() + 1);
  return formatNightSpan(evening, morning);
}

/** „przej. 4 · see. 3" albo „bez ocen". */
export function ratingsLabel(log: Pick<NightLog, 'transparency' | 'seeing'>): string {
  const parts = [
    log.transparency !== null ? `przej. ${log.transparency}` : null,
    log.seeing !== null ? `see. ${log.seeing}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(' · ') : 'bez ocen';
}

/**
 * Żetony wpisu na liście: ile widziane, ile nie wyszło, i czy noc zwinięto.
 * Cele pominięte przez zwinięcie nie liczą się jako „nie wyszło" — to nie były
 * podejścia, tylko koniec nocy.
 */
export function entryChips(log: NightLog): { label: string; tone: EntryTone }[] {
  const seen = log.observations.filter((o) => o.outcome === 'seen').length;
  const failed = log.observations.filter(
    (o) => o.outcome === 'failed' && o.reason !== PACKED_UP,
  ).length;
  const packed = packedUp(log);

  const chips: { label: string; tone: EntryTone }[] = [];
  if (seen > 0) {
    chips.push({
      label: `${seen} ${plural(seen, ['widziany', 'widziane', 'widzianych'])}`,
      tone: 'go',
    });
  }
  if (failed > 0) chips.push({ label: `${failed} nie wyszło`, tone: 'warn' });
  if (packed) {
    chips.push({
      label: packed.reason ? `${PACKED_UP} — ${packed.reason}` : PACKED_UP,
      tone: 'bad',
    });
  }

  return chips;
}

/** „rosa · nie wyszło przy Bortle 4, 58°, Księżyc 12%" — warunki podejścia obok powodu. */
export function failureWhy(conditions: AttemptConditions, reason?: string): string {
  const where = `nie wyszło przy Bortle ${conditions.bortle}, ${Math.round(conditions.altitude)}°, Księżyc ${Math.round(conditions.moonIllumination)}%`;
  return reason ? `${reason} · ${where}` : where;
}

/** Wiersz nad historią, gdy dziś jest lepiej niż przy nieudanym podejściu. */
export function retryLine(targetName: string): string {
  const designation = targetName.split(' — ')[0];
  return `Dziś lepiej niż wtedy: ${designation} czeka na drugie podejście`;
}

const decimal = (value: number) => value.toFixed(1).replace('.', ',');

/** Propozycja korekty progu rosy pod celami w arkuszu zamknięcia nocy. */
export function describeDewSuggestion(forecastMinSpread: number, proposed: number): string {
  return `Rosa przyszła, choć prognoza dawała zapas ${decimal(forecastMinSpread)} K. Podnieść próg ostrzeżenia do ${proposed} K?`;
}

/** Podpisy kroków przebiegu nocy we wpisie. */
export const TIMELINE_ROW_LABELS: Record<TimelineStep, string> = {
  departed: 'wyjazd',
  arrived: 'na miejscu',
  packing: 'zwijanie',
  home: 'w domu',
};

/**
 * Godzina wpisana z pamięci, osadzona w nocy: przed południem to już ranek po
 * niej. Przyjmuje „21:48" i „21.48"; `null` dla wszystkiego innego.
 */
export function timeOnNight(nightId: string, text: string): Date | null {
  const evening = parseNightId(nightId);
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(text.trim());
  if (!evening || !match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const day = hours < 12 ? evening.getDate() + 1 : evening.getDate();
  return new Date(evening.getFullYear(), evening.getMonth(), day, hours, minutes);
}

/** Wpisy pogrupowane miesiącami, od najnowszego — nagłówek „Wrzesień 2026". */
export function logsByMonth(logs: NightLog[]): { heading: string; logs: NightLog[] }[] {
  const groups = new Map<string, NightLog[]>();

  for (const log of [...logs].sort((a, b) => b.id.localeCompare(a.id))) {
    const month = log.id.slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), log]);
  }

  return [...groups.entries()].map(([month, entries]) => {
    const label = monthLabel(month);
    return { heading: label.charAt(0).toUpperCase() + label.slice(1), logs: entries };
  });
}
