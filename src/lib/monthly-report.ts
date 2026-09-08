/**
 * Raport miesięczny — co z tego miesiąca wyszło.
 *
 * Dziennik odpowiada na pytanie „czy widziałem ten obiekt". Raport odpowiada na
 * inne: „czy ten miesiąc był udany" — a to pytanie zadaje się raz na trzydzieści
 * dni i odpowiada na nie zestawieniem, nie przeglądaniem wpisów.
 *
 * Rachunek jest jeden, wyjścia dwa: aplikacja pokazuje podgląd bieżącego
 * miesiąca, CLI renderuje pełny tekst. Gdyby każde liczyło po swojemu, po
 * pierwszej poprawce zestawienia rozjechałyby się i nikt by tego nie zauważył —
 * ten sam powód, dla którego brief nie ma własnego silnika.
 *
 * Moduł jest czysty: dostaje dziennik, zwraca dane. Skąd dziennik pochodzi —
 * z pamięci telefonu czy z wyeksportowanego pliku — nie jest jego sprawą.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { Journal, NightLog } from './journal.ts';
import { targetLabel } from './sky-targets.ts';

/**
 * Wersja kontraktu raportu. Wychodzi z aplikacji plikiem i wraca do CLI, więc
 * obowiązuje go ta sama zasada co brief: zmiana kształtu bez podbicia numeru
 * jest cichą awarią u odbiorcy.
 */
export const REPORT_VERSION = 1;

/** Miesiąc jako `RRRR-MM` — ta sama postać, którą niesie prefiks `NightLog.id`. */
export type MonthKey = string;

export type SiteTally = {
  siteId: string | null;
  siteName: string;
  nights: number;
};

export type UnfinishedTarget = {
  targetId: string;
  /** Ile razy w tym miesiącu nie wyszło. */
  attempts: number;
};

export type BestNight = {
  id: string;
  siteName: string;
  seen: number;
  transparency: number | null;
};

export type MonthlyReport = {
  version: number;
  month: MonthKey;
  /** Ile nocy zapisano — nie ile było pogodnych, tylko ile faktycznie wyjechano. */
  nightsOut: number;
  observations: {
    attempted: number;
    seen: number;
    failed: number;
  };
  /**
   * Obiekty zobaczone w tym miesiącu **pierwszy raz w całym dzienniku**.
   *
   * To jedyna miara postępu, jaką te dane niosą: liczba podejść rośnie od samego
   * wyjeżdżania, a lista pierwszych razów rośnie tylko wtedy, gdy naprawdę
   * przybyło nieba.
   */
  firstTimes: string[];
  /**
   * Cele, które w tym miesiącu nie wyszły i których nigdy dotąd nie widziano —
   * dług do odrobienia, a nie lista porażek.
   */
  unfinished: UnfinishedTarget[];
  sites: SiteTally[];
  /** Średnie z ocen subiektywnych; `null`, gdy w tym miesiącu żadnej nie wystawiono. */
  averages: {
    transparency: number | null;
    seeing: number | null;
  };
  bestNight: BestNight | null;
  /** Notatki z nocy — do pełnego renderu; podgląd w aplikacji ich nie pokazuje. */
  notes: { date: string; siteName: string; note: string }[];
};

/** Miesiąc, w którym zaczęła się ta noc. Bierzemy z `id`, czyli z daty wieczoru. */
const monthOf = (log: NightLog): MonthKey => log.id.slice(0, 7);

/** Miesiące obecne w dzienniku, od najnowszego — CLI wypisuje je, gdy nie podano żadnego. */
export function monthsInJournal(journal: Journal): MonthKey[] {
  return [...new Set(journal.logs.map(monthOf))].sort().reverse();
}

/** `RRRR-MM` dla podanej chwili — miesiąc kalendarzowy, lokalnie. */
export function monthKeyOf(date: Date): MonthKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const average = (values: number[]): number | null =>
  values.length === 0
    ? null
    : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

/**
 * Obiekty widziane **przed** tym miesiącem.
 *
 * Rozstrzyga o „pierwszym razie" i jest jedynym miejscem w tym module, które
 * musi znać dziennik spoza raportowanego okresu. Liczone z porównania kluczy
 * miesiąca, a nie dat: klucz pochodzi z lokalnej daty wieczoru, więc nie ma tu
 * czego psuć strefą czasową ani zmianą czasu.
 */
function seenBefore(journal: Journal, month: MonthKey): Set<string> {
  const seen = new Set<string>();

  for (const log of journal.logs) {
    if (monthOf(log) >= month) continue;
    for (const observation of log.observations) {
      if (observation.outcome === 'seen') seen.add(observation.targetId);
    }
  }

  return seen;
}

/** Obiekty widziane kiedykolwiek — do odsiania „długu" z rzeczy już odhaczonych. */
function seenEver(journal: Journal): Set<string> {
  const seen = new Set<string>();

  for (const log of journal.logs) {
    for (const observation of log.observations) {
      if (observation.outcome === 'seen') seen.add(observation.targetId);
    }
  }

  return seen;
}

export function buildMonthlyReport(journal: Journal, month: MonthKey): MonthlyReport {
  const logs = journal.logs.filter((log) => monthOf(log) === month);

  const before = seenBefore(journal, month);
  const ever = seenEver(journal);

  const firstTimes = new Set<string>();
  const failures = new Map<string, number>();
  const siteNights = new Map<string, SiteTally>();

  let attempted = 0;
  let seen = 0;

  for (const log of logs) {
    const key = log.siteId ?? log.siteName;
    const tally = siteNights.get(key) ?? {
      siteId: log.siteId,
      siteName: log.siteName,
      nights: 0,
    };
    tally.nights += 1;
    siteNights.set(key, tally);

    for (const observation of log.observations) {
      attempted += 1;

      if (observation.outcome === 'seen') {
        seen += 1;
        // Pierwszy raz liczy się względem całego dziennika, nie względem
        // miesiąca: obiekt widziany w marcu i znowu w kwietniu nie jest
        // kwietniową nowością.
        if (!before.has(observation.targetId)) firstTimes.add(observation.targetId);
      } else {
        failures.set(observation.targetId, (failures.get(observation.targetId) ?? 0) + 1);
      }
    }
  }

  // Dług to cel, który nie wyszedł i nadal nie jest widziany — także wtedy, gdy
  // udało się dopiero w kolejnej nocy tego samego miesiąca. Bez tego warunku
  // raport wypominałby obiekt, który wisi już w kolumnie „zobaczone".
  const unfinished = [...failures.entries()]
    .filter(([targetId]) => !ever.has(targetId))
    .map(([targetId, attempts]) => ({ targetId, attempts }))
    .sort((a, b) => b.attempts - a.attempts || a.targetId.localeCompare(b.targetId));

  const bestNight = logs.reduce<BestNight | null>((best, log) => {
    const count = log.observations.filter((o) => o.outcome === 'seen').length;
    if (count === 0) return best;

    // Remis rozstrzyga przejrzystość, a przy jej braku wcześniejsza noc —
    // żeby wynik nie zależał od kolejności wpisów w pliku.
    const candidate: BestNight = {
      id: log.id,
      siteName: log.siteName,
      seen: count,
      transparency: log.transparency,
    };

    if (!best || count > best.seen) return candidate;
    if (count === best.seen && (candidate.transparency ?? 0) > (best.transparency ?? 0)) {
      return candidate;
    }
    return best;
  }, null);

  return {
    version: REPORT_VERSION,
    month,
    nightsOut: logs.length,
    observations: { attempted, seen, failed: attempted - seen },
    firstTimes: [...firstTimes].sort(),
    unfinished,
    sites: [...siteNights.values()].sort(
      (a, b) => b.nights - a.nights || a.siteName.localeCompare(b.siteName),
    ),
    averages: {
      transparency: average(
        logs.map((l) => l.transparency).filter((v): v is number => typeof v === 'number'),
      ),
      seeing: average(logs.map((l) => l.seeing).filter((v): v is number => typeof v === 'number')),
    },
    bestNight,
    notes: logs
      .filter((log) => log.note.trim().length > 0)
      .map((log) => ({ date: log.id, siteName: log.siteName, note: log.note.trim() })),
  };
}

const MONTH_NAMES = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
];

/** „wrzesień 2026" — nagłówek raportu. */
export function monthLabel(month: MonthKey): string {
  const [year, index] = month.split('-');
  return `${MONTH_NAMES[Number(index) - 1] ?? month} ${year}`;
}

const plural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one;
  const tens = n % 100;
  const units = n % 10;
  if (units >= 2 && units <= 4 && !(tens >= 12 && tens <= 14)) return few;
  return many;
};

/**
 * Pełny raport jako tekst.
 *
 * Renderowanie siedzi w warstwie domenowej razem z rachunkiem, a nie w skrypcie,
 * z tego samego powodu co reszta: skrypt ma parsować argumenty i pisać na
 * stdout, a nie decydować, co znaczy „udany miesiąc". Dzięki temu treść raportu
 * da się sprawdzić testem, nie oglądaniem wydruku.
 */
export function renderMonthlyReport(report: MonthlyReport): string {
  const lines: string[] = [`# Raport — ${monthLabel(report.month)}`, ''];

  if (report.nightsOut === 0) {
    lines.push('Ani jednej zapisanej nocy w tym miesiącu.', '');
    return lines.join('\n');
  }

  const { attempted, seen, failed } = report.observations;

  lines.push(
    `Nocy w terenie: ${report.nightsOut}.`,
    `Podejść do celów: ${attempted} — ${seen} ${plural(seen, 'trafione', 'trafione', 'trafionych')}, ${failed} bez skutku.`,
  );

  if (report.averages.transparency !== null || report.averages.seeing !== null) {
    const parts = [
      report.averages.transparency !== null
        ? `przejrzystość ${report.averages.transparency.toFixed(1)}/5`
        : null,
      report.averages.seeing !== null ? `spokój ${report.averages.seeing.toFixed(1)}/5` : null,
    ].filter(Boolean);
    lines.push(`Średnie oceny nieba: ${parts.join(', ')}.`);
  }

  lines.push('');

  if (report.bestNight) {
    const { id, siteName, seen: count } = report.bestNight;
    lines.push(
      `## Najlepsza noc`,
      `${id}, ${siteName} — ${count} ${plural(count, 'obiekt', 'obiekty', 'obiektów')}.`,
      '',
    );
  }

  // Pierwsze razy przed długiem: raport ma zaczynać od tego, co przybyło.
  if (report.firstTimes.length > 0) {
    lines.push(
      `## Pierwszy raz (${report.firstTimes.length})`,
      // Nazwy, nie klucze: raport czyta człowiek raz na miesiąc i „m57" nic
      // mu nie mówi po pół roku od obserwacji.
      ...report.firstTimes.map((id) => `- ${targetLabel(id)}`),
      '',
    );
  }

  if (report.unfinished.length > 0) {
    lines.push(
      '## Wciąż nieodhaczone',
      ...report.unfinished.map(
        // Dwukropek, nie myślnik: nazwa obiektu sama zawiera myślnik
        // („M101 — Galaktyka Wiatraczek") i wiersz robił się nieczytelny.
        ({ targetId, attempts }) =>
          `- ${targetLabel(targetId)}: ${attempts} ${plural(attempts, 'podejście', 'podejścia', 'podejść')}`,
      ),
      '',
    );
  }

  if (report.sites.length > 1) {
    lines.push(
      '## Miejscówki',
      ...report.sites.map(
        ({ siteName, nights }) =>
          `- ${siteName}: ${nights} ${plural(nights, 'noc', 'noce', 'nocy')}`,
      ),
      '',
    );
  }

  if (report.notes.length > 0) {
    lines.push(
      '## Notatki',
      ...report.notes.map((n) => `- **${n.date}**, ${n.siteName}: ${n.note}`),
      '',
    );
  }

  return lines.join('\n');
}
