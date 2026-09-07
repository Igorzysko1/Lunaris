/**
 * Codzienny przegląd zjawisk: o czym w ogóle warto powiadomić.
 *
 * Sam rachunek zjawisk jest tani i lokalny — `events.ts` generuje sześćdziesiąt
 * dni z efemeryd, bez jednego żądania. Brakowało czegoś innego: kogoś, kto raz
 * na dobę przejdzie po tym horyzoncie i **wybierze**. Bez tego kroku wyprzedzenie
 * z ustawień nie ma zastosowania, bo powiadomienie z wyprzedzeniem 12 godzin
 * o zjawisku o 23:00 trzeba zaplanować rano — a więc w cyklu, a nie w chwili
 * wejścia na ekran Eventy, które może nie nastąpić wcale.
 *
 * Moduł jest czysty: dostaje zjawiska, werdykty i pamięć poprzedniego przebiegu,
 * zwraca zgłoszenia i nową pamięć. Planowaniem notyfikacji w systemie zajmuje
 * się osobna warstwa — tutaj rozstrzyga się wyłącznie **co i kiedy** zgłosić.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { AstroEvent, EventType } from '../data/events.ts';
import { dayBucket, formatShortDate, formatTime } from './date.ts';
import type { NightVerdict } from './session-engine.ts';

const DAY_MS = 86_400_000;

/**
 * Zapowiedź wypada tydzień przed zjawiskiem, niezależnie od wyprzedzenia
 * z ustawień. Wyprzedzenie dotyczy nocy, w którą się jedzie — dwanaście godzin
 * przed zaćmieniem to za późno, żeby wziąć wolne albo przestawić plany, a po to
 * właśnie jest zapowiedź.
 */
export const PREVIEW_LEAD_DAYS = 7;

/**
 * Które zjawiska są warte zapowiedzi na tygodnie naprzód.
 *
 * Filtr istotności jest konieczny, bo na sześćdziesiąt dni zjawisk jest za dużo,
 * żeby powiadamiać o każdym. Zaćmienie i maksimum roju planuje się z wyprzedzeniem
 * — reszta wraca co miesiąc albo co kilka tygodni i dowiadujemy się o niej
 * wtedy, gdy wejdzie w zasięg prognozy i dostanie werdykt.
 */
const NOTABLE_AHEAD: EventType[] = ['eclipse', 'meteor_shower'];

/** Stan zjawiska w danym przebiegu przeglądu. */
export type EventState =
  /** Poza zasięgiem prognozy — wiadomo, że wypadnie, nie wiadomo, czy pojedziemy. */
  | 'preview'
  /** W zasięgu prognozy, ale noc nie przechodzi przez progi. */
  | 'no-go'
  /** W zasięgu prognozy i noc się nadaje. */
  | 'go';

/**
 * Pamięć poprzednich przebiegów, zapisywana między cyklami.
 *
 * Trzyma osobno to, co **zaobserwowano**, i to, co **zgłoszono**. Bez pierwszego
 * nie da się wykryć nocy, która wczoraj była odrzucona, a dziś przeszła przez
 * progi — a to jedyne naprawdę warte zgłoszenia zdarzenie. Bez drugiego
 * to samo zjawisko wracałoby w powiadomieniu każdego dnia aż do skutku.
 */
export type NoticeLogEntry = {
  seen: EventState;
  announced: 'preview' | 'go' | null;
  /** Moment zjawiska — po nim sprzątamy wpisy, których nie ma po co pamiętać. */
  at: Date;
};

export type NoticeLog = Record<string, NoticeLogEntry>;

export type NoticeReason =
  /** Zapowiedź bez werdyktu: zjawisko dalsze niż prognoza. */
  | 'preview'
  /** Pierwsze zgłoszenie zjawiska, które wypada w noc z werdyktem „jedź". */
  | 'new'
  /** Zapowiadane wcześniej, teraz z potwierdzonym werdyktem. */
  | 'confirmed'
  /** Noc była odrzucona, a po nowej prognozie przeszła przez progi. */
  | 'reopened';

export type EventNotice = {
  event: AstroEvent;
  /** `null` dla zapowiedzi — i tak ma być podpisane, żeby nie czytało się jak obietnica. */
  verdict: NightVerdict | null;
  reason: NoticeReason;
  /** Kiedy powiadomienie ma się odezwać. */
  notifyAt: Date;
  title: string;
  body: string;
};

export type EventReviewInput = {
  now: Date;
  /** Zjawiska dla aktywnej lokalizacji — z `upcomingEvents`. */
  events: AstroEvent[];
  /** Werdykty na noce objęte prognozą; poza nimi zjawisko dostaje zapowiedź. */
  verdicts: NightVerdict[];
  /** Wyprzedzenie z konfiguracji, w godzinach. */
  leadHours: number;
  /** Pora odświeżania — o niej odzywają się zapowiedzi. */
  refreshHour: number;
  previous: NoticeLog;
};

export type EventReview = { notices: EventNotice[]; log: NoticeLog };

/** Noc, w której wypada zjawisko — albo `null`, gdy jest poza zasięgiem prognozy. */
function verdictFor(event: AstroEvent, verdicts: NightVerdict[]): NightVerdict | null {
  return verdicts.find((v) => event.at >= v.night.from && event.at <= v.night.to) ?? null;
}

/** Moment powiadomienia; zjawisko bliższe niż wyprzedzenie zgłaszamy od razu. */
function notifyMoment(at: Date, leadMs: number, now: Date): Date {
  const planned = new Date(at.getTime() - leadMs);
  return planned > now ? planned : now;
}

/**
 * Moment zapowiedzi: tydzień wcześniej, ale o porze podejmowania decyzji.
 *
 * Bez wyrównania godziny zapowiedź dziedziczy porę zjawiska, a maksima rojów
 * wypadają nad ranem — zapowiedź Orionidów odezwałaby się o 4:57. Wyprzedzenie
 * z ustawień dotyczy nocy, w którą się jedzie; zapowiedź jest po to, żeby
 * zaplanować, więc trafia w tę samą porę, o której zapada decyzja o wyjeździe.
 *
 * Arytmetyka kalendarzowa, nie milisekundowa: między zapowiedzią a zjawiskiem
 * może wypaść zmiana czasu.
 */
function previewMoment(at: Date, refreshHour: number, now: Date): Date {
  const day = new Date(at);
  day.setDate(day.getDate() - PREVIEW_LEAD_DAYS);
  day.setHours(refreshHour, 0, 0, 0);

  return day > now ? day : now;
}

function previewBody(event: AstroEvent, now: Date): string {
  return `${formatShortDate(event.at)}, ${formatTime(event.at)} — zapowiedź, bez prognozy na tę noc (${Math.round(
    (event.at.getTime() - now.getTime()) / DAY_MS,
  )} dni).`;
}

function alertBody(event: AstroEvent, verdict: NightVerdict, now: Date): string {
  const when = `${dayBucket(event.at, now)}, ${formatTime(event.at)}`;
  const window = verdict.window;

  if (!window) return `${when} — noc się nadaje.`;

  const range = `okno ${formatTime(window.from)}–${formatTime(window.to)}`;

  // Okno bywa krótsze niż noc, bo ogranicza je sen i droga powrotna. Zjawisko
  // o 4:07 przy oknie do 4:00 to wciąż informacja warta zgłoszenia, ale treść
  // nie może obiecywać okna, które go nie obejmuje.
  const inside = event.at >= window.from && event.at <= window.to;

  return inside
    ? `${when} — noc się nadaje, ${range}.`
    : `${when} — noc się nadaje, ale zjawisko wypada poza oknem (${range}).`;
}

/**
 * Przegląd horyzontu zjawisk.
 *
 * Reguły zgłaszania są tu, a nie w warstwie powiadomień, bo to decyzje
 * merytoryczne, a nie techniczne:
 *
 * - Zjawisko **niewidoczne** z tego miejsca nie generuje zgłoszenia nigdy —
 *   nie ma po co budzić kogoś do czegoś, co u niego nie wzejdzie.
 * - Zjawisko w noc **odrzuconą** przez progi też nie: za pełnym zachmurzeniem
 *   nawet zaćmienie nie jest powodem do wyjazdu.
 * - To samo zjawisko w tym samym stanie **nie wraca** w kolejnych dniach.
 *   Codzienne przypomnienie o roju, który będzie za dwa tygodnie, to szum.
 * - Przejście nocy z odrzuconej w przechodzącą progi jest zgłaszane zawsze,
 *   bo tylko ono niesie nową informację.
 */
export function reviewEvents({
  now,
  events,
  verdicts,
  leadHours,
  refreshHour,
  previous,
}: EventReviewInput): EventReview {
  const leadMs = leadHours * 3_600_000;
  const notices: EventNotice[] = [];
  const log: NoticeLog = {};

  for (const event of events) {
    // Zjawiska, które już minęły, wypadają razem ze swoimi wpisami w pamięci.
    if (event.at <= now) continue;
    if (!event.visible) continue;

    const verdict = verdictFor(event, verdicts);
    const state: EventState = !verdict ? 'preview' : verdict.status === 'go' ? 'go' : 'no-go';
    const before = previous[event.id];
    const announced = before?.announced ?? null;

    log[event.id] = { seen: state, announced, at: event.at };

    if (state === 'no-go') continue;

    if (state === 'preview') {
      if (announced !== null) continue;
      if (!NOTABLE_AHEAD.includes(event.type)) continue;

      notices.push({
        event,
        verdict: null,
        reason: 'preview',
        notifyAt: previewMoment(event.at, refreshHour, now),
        title: event.title,
        body: previewBody(event, now),
      });
      log[event.id].announced = 'preview';
      continue;
    }

    // state === 'go'
    if (announced === 'go') continue;

    const reason: NoticeReason =
      before?.seen === 'no-go' ? 'reopened' : announced === 'preview' ? 'confirmed' : 'new';

    notices.push({
      event,
      verdict,
      reason,
      notifyAt: notifyMoment(event.at, leadMs, now),
      title: event.title,
      body: alertBody(event, verdict as NightVerdict, now),
    });
    log[event.id].announced = 'go';
  }

  notices.sort((a, b) => a.notifyAt.getTime() - b.notifyAt.getTime());

  return { notices, log };
}
