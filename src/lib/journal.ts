/**
 * Dziennik obserwacji — co naprawdę było widać.
 *
 * Aplikacja przewiduje i nigdy się nie dowiaduje, czy miała rację. Zasięg
 * sprzętu, progi zachmurzenia, dobór celów — wszystko to są przybliżenia, które
 * same się tak opisują i czekają na strojenie. Strojenie wymaga danych, a jedyne
 * dane, jakich nikt nie zbiera, to odpowiedź na pytanie „widziałeś?".
 *
 * Dziennik jest więc dwiema rzeczami naraz: pamięcią obserwatora i **jedynym
 * sprzężeniem zwrotnym silnika**. Druga z nich jest ważniejsza, choć mniej widać.
 *
 * Moduł jest czysty — zapis na dysk siedzi w `journal-store.ts`. Dzięki temu
 * reguły porządkowania celów da się sprawdzić testem, a eksport wykonać także
 * poza aplikacją.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import { parseTimeline, type SessionTimeline } from './session-timeline.ts';

/**
 * Wynik podejścia do celu.
 *
 * Brak wpisu znaczy „nie próbowałem" i to jest stan domyślny — milczenie nie
 * jest danymi. `failed` to najcenniejszy zapis w całym dzienniku, bo tylko on
 * mówi, gdzie silnik obiecał za dużo.
 */
export type Outcome = 'seen' | 'failed';

/** Warunki, w jakich podejście się odbyło. Bez nich „wróć, gdy lepiej" nie ma czego porównać. */
export type AttemptConditions = {
  bortle: number;
  /** Najwyższe położenie obiektu tej nocy, w stopniach. */
  altitude: number;
  /** Oświetlenie tarczy Księżyca w procentach. */
  moonIllumination: number;
};

export type TargetObservation = {
  targetId: string;
  outcome: Outcome;
  conditions: AttemptConditions;
  /** Zestaw sprzętu — `SkyTarget` nosi go już przy sobie, więc nikt o to nie pyta. */
  profileId: string;
  /**
   * Dlaczego nie wyszło — jedno słowo z `FAILURE_REASONS` albo własny wpis.
   * Tylko przy `failed`; brak pola znaczy „nie podano", nie „bez powodu".
   */
  reason?: string;
  /**
   * Kiedy cel odhaczono w panelu celu, w ISO. Tylko przy `seen` i tylko wtedy,
   * gdy odhaczenie padło w trakcie nocy — cel dopisany z pamięci godziny nie ma.
   */
  seenAt?: string;
};

/**
 * Zapis jednej nocy.
 *
 * Wszystko poza notatką i dwiema ocenami bierze się z tego, co aplikacja i tak
 * miała w ręku, gdy sugerowała sesję. W rękawicach o trzeciej w nocy liczy się
 * to, żeby zapis w ogóle powstał.
 */
export type NightLog = {
  /** Data wieczoru, `YYYY-MM-DD` — jedna noc to jeden wpis, także po poprawkach. */
  id: string;
  /** Początek nocy w ISO — do porządkowania i do raportów. */
  nightFrom: string;
  siteId: string | null;
  siteName: string;
  observations: TargetObservation[];
  /** Subiektywna przejrzystość i spokój, 1–5. `null` znaczy „nie oceniłem". */
  transparency: number | null;
  seeing: number | null;
  note: string;
  savedAt: string;
  /**
   * Rzeczywisty przebieg nocy — wyjazd, dojazd, zwijanie i powrót obok planu
   * z chwili wyjazdu. Brak pola znaczy „nie mierzono", a nie „nie było".
   */
  timeline?: SessionTimeline;
};

export type Journal = {
  version: number;
  logs: NightLog[];
};

/**
 * Wersja zapisu dziennika.
 *
 * Reguła migracji jest tu inna niż w konfiguracji i w cache'u, i to jest sedno
 * osobnego modułu: dziennik **rozszerzamy, nigdy nie porzucamy**. Powrót do
 * wartości domyślnych po nieudanym odczycie — właściwy dla konfiguracji —
 * kasowałby tu sezon obserwacji.
 */
export const JOURNAL_VERSION = 3;

// Historia wersji:
// 2 — powód nieudanego podejścia (`TargetObservation.reason`). Zapis v1 wczytuje
//     się bez zmian: brak pola znaczy tylko, że powodu nie podano.
// 3 — godzina odhaczenia celu (`TargetObservation.seenAt`). Starsze zapisy jej
//     nie mają i nie muszą: brak znaczy „dopisane po nocy".

export const EMPTY_JOURNAL: Journal = { version: JOURNAL_VERSION, logs: [] };

/** Klucz nocy: data wieczoru, w którym się zaczęła. */
export function nightLogId(nightFrom: Date): string {
  const y = nightFrom.getFullYear();
  const m = String(nightFrom.getMonth() + 1).padStart(2, '0');
  const d = String(nightFrom.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Dokłada zapis nocy, zastępując wcześniejszy z tej samej nocy.
 *
 * Zastąpienie, a nie doklejenie: wpis uzupełniany trzy dni później jest tą samą
 * nocą, a nie drugą. Kolejność chronologiczna, najnowsze na końcu.
 */
export function upsertLog(journal: Journal, log: NightLog): Journal {
  // Przebieg nocy zapisuje karta nocy, a cele — ekran dziennika. Żaden z tych
  // zapisów nie może skasować drugiego tylko dlatego, że go nie niesie.
  const previous = journal.logs.find((l) => l.id === log.id);
  const merged =
    log.timeline || !previous?.timeline ? log : { ...log, timeline: previous.timeline };

  const logs = journal.logs.filter((l) => l.id !== log.id).concat(merged);
  logs.sort((a, b) => a.nightFrom.localeCompare(b.nightFrom));

  return { version: JOURNAL_VERSION, logs };
}

/**
 * Dokłada przebieg nocy do wpisu, który już jest — z celami, notatką
 * i ocenami — albo zakłada nowy, gdy tej nocy jeszcze nic nie zapisano.
 */
export function withTimeline(
  journal: Journal,
  night: { id: string; nightFrom: string; siteId: string | null; siteName: string },
  timeline: SessionTimeline,
  savedAt: string,
): Journal {
  const existing = journal.logs.find((l) => l.id === night.id);
  const log: NightLog = existing
    ? { ...existing, timeline }
    : {
        ...night,
        observations: [],
        transparency: null,
        seeing: null,
        note: '',
        savedAt,
        timeline,
      };

  return upsertLog(journal, log);
}

/**
 * Odhaczenie celu w panelu celu (6a) — w trakcie nocy, zanim powstanie wpis.
 *
 * Dokłada obserwację do wpisu tej nocy albo zakłada szkic, który arkusz „Jak
 * było?" potem uzupełnia. Wcześniejszą obserwację tego celu zastępuje, ale jej
 * warunki zostają: to wciąż to samo podejście tej samej nocy.
 */
export function withSighting(
  journal: Journal,
  night: { id: string; nightFrom: string; siteId: string | null; siteName: string },
  observation: TargetObservation,
  savedAt: string,
): Journal {
  const existing = journal.logs.find((l) => l.id === night.id);
  const log: NightLog = existing ?? {
    ...night,
    observations: [],
    transparency: null,
    seeing: null,
    note: '',
    savedAt,
  };
  const previous = log.observations.find((o) => o.targetId === observation.targetId);
  const next = cleanObservation({
    ...observation,
    conditions: previous?.conditions ?? observation.conditions,
  });

  return upsertLog(journal, {
    ...log,
    observations: log.observations.filter((o) => o.targetId !== observation.targetId).concat(next),
    savedAt,
  });
}

/**
 * Cofnięcie odhaczenia. Wpis, po którym nic nie zostało — bez celów, ocen,
 * notatki i przebiegu — znika, zamiast wisieć w Dzienniku jako pusta noc.
 */
export function withoutSighting(journal: Journal, nightId: string, targetId: string): Journal {
  const existing = journal.logs.find((l) => l.id === nightId);
  if (!existing) return journal;

  const log = {
    ...existing,
    observations: existing.observations.filter((o) => o.targetId !== targetId),
  };
  const empty =
    log.observations.length === 0 &&
    log.transparency === null &&
    log.seeing === null &&
    log.note.trim() === '' &&
    !log.timeline;

  return empty
    ? { version: JOURNAL_VERSION, logs: journal.logs.filter((l) => l.id !== nightId) }
    : upsertLog(journal, log);
}

/** Co dziennik wie o jednym obiekcie. */
export type TargetHistory = {
  seenCount: number;
  /** Ostatnie udane podejście; `null`, gdy obiektu nigdy nie widziano. */
  lastSeenAt: Date | null;
  /** Nieudane podejścia razem z warunkami, w jakich się odbyły. */
  failures: { at: Date; conditions: AttemptConditions }[];
};

/** Historia per obiekt, złożona z całego dziennika. */
export function historyOf(journal: Journal): Map<string, TargetHistory> {
  const history = new Map<string, TargetHistory>();

  for (const log of journal.logs) {
    const at = new Date(log.nightFrom);

    for (const observation of log.observations) {
      const entry = history.get(observation.targetId) ?? {
        seenCount: 0,
        lastSeenAt: null,
        failures: [],
      };

      if (observation.outcome === 'seen') {
        entry.seenCount += 1;
        if (!entry.lastSeenAt || at > entry.lastSeenAt) entry.lastSeenAt = at;
      } else {
        entry.failures.push({ at, conditions: observation.conditions });
      }

      history.set(observation.targetId, entry);
    }
  }

  return history;
}

/**
 * Czy dzisiejsze warunki są lepsze od tych, przy których podejście się nie udało.
 *
 * Wystarczy poprawa w którymkolwiek z trzech wymiarów, bo każdy z nich potrafi
 * samodzielnie przesądzić o dostrzeżeniu słabego obiektu: ciemniejsze niebo,
 * wyższe położenie nad horyzontem albo Księżyc, który nie świeci.
 *
 * Progi są niezerowe celowo — jeden stopień wysokości czy jeden procent fazy to
 * szum, a nie druga szansa.
 */
export function conditionsImproved(
  failure: AttemptConditions,
  tonight: AttemptConditions,
): boolean {
  return (
    tonight.bortle <= failure.bortle - 1 ||
    tonight.altitude >= failure.altitude + 10 ||
    tonight.moonIllumination <= failure.moonIllumination - 20
  );
}

/**
 * Jak wysoko postawić cel na liście, znając historię.
 *
 * Nic z listy nie znika i to jest reguła, nie szczegół: M42 ogląda się co sezon
 * i ukrywanie widzianych opróżniłoby listę po dwóch nocach.
 */
export type TargetRank =
  /** Nigdy nieodhaczony — domyślnie najwyżej. */
  | 'new'
  /** Nie wyszło wcześniej, ale dziś jest lepiej — jedyna podpowiedź, jaką dziennik daje sam z siebie. */
  | 'retry'
  /** Nie wyszło i nic się nie poprawiło. */
  | 'failed'
  /** Widziany — zostaje na liście, tylko niżej. */
  | 'seen';

const RANK_ORDER: Record<TargetRank, number> = { retry: 0, new: 1, failed: 2, seen: 3 };

export function rankOf(history: TargetHistory | undefined, tonight: AttemptConditions): TargetRank {
  if (!history) return 'new';

  if (history.failures.some((f) => conditionsImproved(f.conditions, tonight))) return 'retry';
  if (history.failures.length > 0 && history.seenCount === 0) return 'failed';

  return history.seenCount > 0 ? 'seen' : 'new';
}

/** Element listy celów wzbogacony o to, co dziennik o nim pamięta. */
export type WithHistory<T> = {
  target: T;
  rank: TargetRank;
  history: TargetHistory | undefined;
};

/**
 * Porządkuje cele historią, zachowując kolejność wyjściową wewnątrz grup.
 *
 * Kolejność wejściowa niesie już sens — jest posortowana po jasności — więc
 * historia ją przestawia, a nie zastępuje: najpierw drugie podejścia, potem
 * nowe, na końcu widziane, a w każdej grupie od najjaśniejszych.
 *
 * Planety pomijamy: wracają co roku z natury i „widziałem Jowisza" niczego
 * o nich nie mówi.
 */
export function orderByHistory<
  T extends { id: string; kind: 'planet' | 'dso'; maxAltitude: number },
>(
  targets: T[],
  journal: Journal,
  sky: { bortle: number; moonIllumination: number },
): WithHistory<T>[] {
  const history = historyOf(journal);

  return targets
    .map((target) => {
      if (target.kind === 'planet') {
        return { target, rank: 'new' as TargetRank, history: undefined };
      }

      const entry = history.get(target.id);
      const tonight: AttemptConditions = {
        bortle: sky.bortle,
        altitude: target.maxAltitude,
        moonIllumination: sky.moonIllumination,
      };

      return { target, rank: rankOf(entry, tonight), history: entry };
    })
    .map((item, index) => ({ item, index }))
    .sort((a, b) => RANK_ORDER[a.item.rank] - RANK_ORDER[b.item.rank] || a.index - b.index)
    .map(({ item }) => item);
}

/** np. „widziane 2×, ostatnio 12.03" — podpis pod celem, który już się zna. */
export function describeHistory(history: TargetHistory | undefined): string | null {
  if (!history) return null;

  if (history.seenCount > 0 && history.lastSeenAt) {
    const d = history.lastSeenAt;
    const date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    return history.seenCount === 1
      ? `widziane ${date}`
      : `widziane ${history.seenCount}×, ostatnio ${date}`;
  }

  if (history.failures.length > 0) {
    return history.failures.length === 1
      ? 'próbowane, nie wyszło'
      : `próbowane ${history.failures.length}×, nie wyszło`;
  }

  return null;
}

/**
 * Cały dziennik jako tekst do zapisania na zewnątrz.
 *
 * Eksport istnieje od pierwszej wersji, zanim uzbiera się coś, co szkoda
 * stracić. Format jest tym samym JSON-em, który leży na dysku — plik da się
 * wczytać z powrotem, a nie tylko przeczytać.
 */
export function exportJournal(journal: Journal): string {
  return JSON.stringify(journal, null, 2);
}

/**
 * Wczytuje dziennik z zapisu.
 *
 * Zapis nieczytelny **nie** daje pustego dziennika — w konfiguracji powrót do
 * wartości domyślnych jest właściwy, tutaj kasowałby sezon obserwacji. Zamiast
 * tego zwracamy `null`, a wywołujący ma nie nadpisywać niczego, czego nie umiał
 * przeczytać.
 */
export function parseJournal(raw: string | null): Journal | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Journal>;
    if (!Array.isArray(parsed.logs)) return null;

    // Migracja rozszerzająca: nieznane pola zostają nietknięte, brakujące
    // dostają wartości, których wymaga bieżący kształt.
    const logs = parsed.logs
      .filter((l): l is NightLog => typeof l === 'object' && l !== null && typeof l.id === 'string')
      .map((l) => ({
        ...l,
        observations: Array.isArray(l.observations) ? l.observations.map(cleanObservation) : [],
        transparency: typeof l.transparency === 'number' ? l.transparency : null,
        seeing: typeof l.seeing === 'number' ? l.seeing : null,
        note: typeof l.note === 'string' ? l.note : '',
        // Przebieg sprawdzany pole po polu: godziny zasilają kalibrację, więc
        // uszkodzony zapis nie może trafić do rachunku jako prawdziwy.
        ...(l.timeline !== undefined ? { timeline: parseTimeline(l.timeline) } : {}),
      }));

    return { version: JOURNAL_VERSION, logs };
  } catch {
    return null;
  }
}

/**
 * Powody nieudanego podejścia (4b): pięć wracających i „inne" z własnym wpisem.
 * Klawiatura otwiera się dopiero po „inne" — w rękawicach to dwa dotknięcia.
 */
export const FAILURE_REASONS = [
  'rosa',
  'chmury',
  'zmęczenie',
  'sprzęt',
  'zwinąłem',
  'inne',
] as const;

/** Powód, który nie opisuje celu, tylko koniec nocy. */
export const PACKED_UP = 'zwinąłem';

/** Wybór otwierający pole na własny powód. */
export const OTHER_REASON = 'inne';

/** Dłużej niż kilka słów to już notatka, a nie powód. */
const REASON_MAX = 60;

/**
 * Powód zostaje tylko przy nieudanym podejściu i tylko jako niepusty tekst,
 * godzina odhaczenia — tylko przy widzianym i tylko jako prawdziwa data.
 */
function cleanObservation(observation: TargetObservation): TargetObservation {
  if (typeof observation !== 'object' || observation === null) return observation;

  const { reason, seenAt, ...rest } = observation;
  if (observation.outcome === 'failed') {
    const text = typeof reason === 'string' ? reason.trim().slice(0, REASON_MAX) : '';
    return text ? { ...rest, reason: text } : rest;
  }

  const valid = typeof seenAt === 'string' && !Number.isNaN(Date.parse(seenAt));
  return valid ? { ...rest, seenAt } : rest;
}

/** Wieczór nocy z identyfikatora `RRRR-MM-DD`, w południe; `null` dla daty, której nie ma. */
export function parseNightId(id: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(id);
  if (!match) return null;

  const evening = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return nightLogId(evening) === id ? evening : null;
}

/**
 * Własne powody z dziennika, od najświeższych — trafiają do podpowiedzi obok
 * pięciu stałych, żeby „bateria w montażu" wpisać raz, a nie przy każdej nocy.
 */
export function customReasons(journal: Journal, limit = 5): string[] {
  const standard = new Set<string>(FAILURE_REASONS);
  const found: string[] = [];

  for (const log of [...journal.logs].reverse()) {
    for (const observation of log.observations) {
      const reason = observation.reason;
      if (reason && !standard.has(reason) && !found.includes(reason)) found.push(reason);
    }
  }

  return found.slice(0, limit);
}

/**
 * Czy noc skończyła się zwinięciem sprzętu, i przez co.
 *
 * Nie osobne pole wpisu: „zwinąłem" pada jako powód przy celach, do których się
 * nie doszło, a przyczyną jest najczęstszy inny powód tej nocy. Dzięki temu
 * arkusz nie zadaje drugiego pytania o to samo. `null`, gdy noc nie była zwinięta.
 */
export function packedUp(log: NightLog): { reason: string | null } | null {
  const failed = log.observations.filter((o) => o.outcome === 'failed');
  if (!failed.some((o) => o.reason === PACKED_UP)) return null;

  const counts = new Map<string, number>();
  for (const observation of failed) {
    const reason = observation.reason;
    if (reason && reason !== PACKED_UP) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  return { reason: [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null };
}

/** Podsumowanie roku na górze Dziennika: noce, widziane i nieudane podejścia. */
export function yearStats(journal: Journal, year: number) {
  const logs = journal.logs.filter((log) => log.id.startsWith(`${year}-`));
  const observations = logs.flatMap((log) => log.observations);

  return {
    nights: logs.length,
    seen: observations.filter((o) => o.outcome === 'seen').length,
    failed: observations.filter((o) => o.outcome === 'failed').length,
  };
}

/**
 * Propozycja podniesienia progu rosy po nocy, w której cel przepadł przez rosę,
 * choć prognoza jej nie zapowiadała.
 *
 * Gdy prognoza schodziła poniżej progu, ostrzeżenie zadziałało i nie ma czego
 * poprawiać. W przeciwnym razie próg podnosimy do pierwszej pełnej wartości nad
 * najmniejszym prognozowanym zapasem — tej, przy której ta noc dostałaby
 * ostrzeżenie. `null`, gdy propozycji nie ma.
 */
export function dewThresholdSuggestion(input: {
  reasons: readonly string[];
  forecastMinSpread: number | null;
  threshold: number;
  max: number;
}): number | null {
  const { reasons, forecastMinSpread, threshold, max } = input;
  if (!reasons.includes('rosa') || forecastMinSpread === null) return null;
  if (forecastMinSpread < threshold) return null;

  const proposed = Math.min(max, Math.floor(forecastMinSpread) + 1);
  return proposed > threshold ? proposed : null;
}
