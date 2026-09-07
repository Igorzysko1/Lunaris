/**
 * Pamięć przeglądu zjawisk między cyklami.
 *
 * Wydzielona od samego przeglądu, bo `event-review.ts` ma pozostać czysty:
 * decyzja „o czym powiadomić" musi dać się sprawdzić testem i wykonać poza
 * aplikacją, a AsyncStorage istnieje tylko w niej.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EventNotice, NoticeLog } from './event-review';

const LOG_KEY = 'lunaris.notices.log';
const PLAN_KEY = 'lunaris.notices.plan';

/** Zgłoszenie po zapisie: sam event nie przechodzi przez dysk, bo liczy się lokalnie. */
export type StoredNotice = {
  eventId: string;
  title: string;
  body: string;
  reason: EventNotice['reason'];
  notifyAt: Date;
  /** Czy zgłoszenie ma werdykt, czy jest samą zapowiedzią. */
  withVerdict: boolean;
};

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function revive(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO.test(value) ? new Date(value) : value;
}

export async function loadNoticeLog(): Promise<NoticeLog> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw, revive) as NoticeLog) : {};
  } catch {
    // Uszkodzona pamięć znaczy tylko tyle, że przegląd zacznie od zera: zgłosi
    // raz za dużo, a nie raz za mało. To właściwy kierunek pomyłki.
    return {};
  }
}

export async function saveNoticeLog(log: NoticeLog): Promise<void> {
  try {
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    // patrz saveForecast — zapis jest udogodnieniem, nie warunkiem działania
  }
}

/**
 * Plan powiadomień z ostatniego cyklu.
 *
 * Zapisujemy go, bo między policzeniem a odezwaniem się mija czas — nawet
 * tydzień przy zapowiedzi — a warstwa, która faktycznie planuje notyfikacje
 * w systemie, uruchamia się niezależnie od tego przebiegu.
 */
export async function saveNoticePlan(notices: EventNotice[]): Promise<void> {
  const stored: StoredNotice[] = notices.map((n) => ({
    eventId: n.event.id,
    title: n.title,
    body: n.body,
    reason: n.reason,
    notifyAt: n.notifyAt,
    withVerdict: n.verdict !== null,
  }));

  try {
    await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(stored));
  } catch {
    // patrz wyżej
  }
}

export async function loadNoticePlan(): Promise<StoredNotice[]> {
  try {
    const raw = await AsyncStorage.getItem(PLAN_KEY);
    return raw ? (JSON.parse(raw, revive) as StoredNotice[]) : [];
  } catch {
    return [];
  }
}
