/**
 * Warstwa narracyjna — komentarz agenta doklejany do policzonego briefu.
 *
 * Agent zapisuje codziennie brief obserwacyjny do folderu na Dysku; ten moduł
 * przyjmuje jego wersję maszynową, sprawdza ją i przypina do nocy, których
 * dotyczy. Sam niczego nie liczy i nie ma prawa liczyć.
 *
 * ## Dlaczego narracja nie niesie żadnej liczby
 *
 * Dokument pisze model językowy. Gdyby schemat pozwalał mu podać wysokość,
 * godzinę okna albo werdykt „jedź", jedna halucynacja cicho nadpisałaby wynik
 * rachunku — i to w miejscu, w którym użytkownik ufa aplikacji najbardziej, bo
 * ma pojechać nocą sto kilometrów. Dlatego w całym schemacie nie ma ani jednego
 * pola liczbowego ani logicznego poza numerem wersji: narracja to **wyłącznie
 * tekst przy danych**, nigdy dane.
 *
 * Ta granica jest tańsza niż jakakolwiek walidacja liczb. Nie trzeba pytać, czy
 * model podał sensowną wysokość — nie ma jak jej podać.
 *
 * ## Dlaczego walidacja nigdy nie rzuca i nie odrzuca całości
 *
 * Obowiązuje reguła powtórzona w opisach kilku sekcji: *brak warstwy
 * narracyjnej degraduje widok do surowych okien, nie do błędu*. Skoro brak
 * całości ma być nieszkodliwy, to brak fragmentu tym bardziej — więc zepsuta
 * noc wypada, a reszta dokumentu zostaje. Zwracamy przy tym listę zastrzeżeń,
 * żeby dało się poznać, że agent psuje kontrakt, zanim zniknie połowa tekstu.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { Brief, BriefNight } from './brief.ts';

/**
 * Wersja kontraktu narracji, niezależna od `BRIEF_VERSION`.
 *
 * Osobna, bo to dwa różne kierunki ruchu: brief wychodzi z aplikacji do agenta,
 * narracja wraca od agenta do aplikacji. Zmiana kształtu jednego nie musi
 * dotykać drugiego, a wspólny numer wymuszałby podbijanie obu.
 */
export const NARRATIVE_VERSION = 1;

/**
 * Górne granice długości tekstów.
 *
 * Nie chodzi o oszczędzanie pamięci, tylko o to, że generacja bez końca zdarza
 * się naprawdę: model wpada w pętlę i zwraca sto tysięcy znaków. Bez limitu
 * trafiłoby to do karty i wywróciło ekran — z limitem tekst po prostu wypada
 * jako niezgodny ze schematem.
 */
export const LIMITS = {
  headline: 200,
  comment: 600,
  note: 200,
  /** Nocy w dokumencie — brief liczy najwyżej kilka dób. */
  nights: 14,
  /** Komentarzy do celów w jednej nocy. */
  targets: 30,
} as const;

/** Komentarz do jednego celu — „zacznij od tego, potem przesuń się niżej". */
export type NarrativeTarget = {
  /** Identyfikator celu, ten sam co w `BriefTarget.id`. */
  id: string;
  note: string;
};

export type NarrativeNight = {
  /**
   * Doba, której dotyczy: data **wieczoru**, od którego noc się zaczyna, w postaci
   * RRRR-MM-DD. Data kalendarzowa, nie znacznik czasu — noc z 16 na 17 stycznia
   * jest jedna i ma jedno oznaczenie, niezależnie od tego, o której zapadł zmierzch.
   */
  date: string;
  /** Dlaczego ta noc wygląda tak, jak wygląda. Puste, gdy agent nie miał nic do dodania. */
  comment: string;
  targets: NarrativeTarget[];
};

export type Narrative = {
  version: number;
  generatedAt: string;
  /** Identyfikator miejscówki — narracja o innym miejscu nie ma tu czego szukać. */
  site: string;
  headline: string | null;
  nights: NarrativeNight[];
};

/**
 * Co poszło nie tak. `path` wskazuje miejsce w dokumencie, żeby dało się to
 * odesłać autorowi promptu zamiast zgadywać.
 */
export type Problem = { path: string; reason: string };

export type NarrativeResult = {
  /** `null`, gdy dokumentu nie da się użyć w całości. */
  narrative: Narrative | null;
  problems: Problem[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Tekst nadający się do pokazania, albo `null`.
 *
 * Znaki sterujące wycinamy, bo psują układ, a nie niosą treści — model potrafi
 * wypluć znak zerowy albo pionową tabulację i nic z tego nie wynika. Białe znaki
 * zwijamy do pojedynczych spacji z tego samego powodu.
 */
function text(value: unknown, limit: number): string | null {
  if (typeof value !== 'string') return null;

  const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
  const collapsed = clean.replace(/\s+/g, ' ').trim();

  return collapsed.length === 0 || collapsed.length > limit ? null : collapsed;
}

/** RRRR-MM-DD i faktycznie istniejąca data — „2026-02-31" ma odpaść. */
function calendarDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  // Data wykraczająca poza miesiąc zostałaby przewinięta na kolejny — po tym ją poznajemy.
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseTargets(raw: unknown, path: string, problems: Problem[]): NarrativeTarget[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    problems.push({ path, reason: 'oczekiwano listy' });
    return [];
  }

  const targets: NarrativeTarget[] = [];
  const seen = new Set<string>();

  for (const [index, item] of raw.slice(0, LIMITS.targets).entries()) {
    const at = `${path}[${index}]`;

    if (!isObject(item)) {
      problems.push({ path: at, reason: 'oczekiwano obiektu' });
      continue;
    }

    const id = text(item.id, 100);
    const note = text(item.note, LIMITS.note);

    if (!id) {
      problems.push({ path: `${at}.id`, reason: 'brak identyfikatora celu' });
      continue;
    }
    if (!note) {
      problems.push({ path: `${at}.note`, reason: `pusty tekst albo dłuższy niż ${LIMITS.note}` });
      continue;
    }
    // Dwa komentarze do tego samego celu nie mają jak się rozstrzygnąć —
    // zostaje pierwszy, żeby wynik nie zależał od kolejności w pliku.
    if (seen.has(id)) {
      problems.push({ path: `${at}.id`, reason: `powtórzony cel „${id}"` });
      continue;
    }

    seen.add(id);
    targets.push({ id, note });
  }

  if (raw.length > LIMITS.targets) {
    problems.push({ path, reason: `więcej niż ${LIMITS.targets} celów — nadmiar pominięty` });
  }

  return targets;
}

function parseNights(raw: unknown, problems: Problem[]): NarrativeNight[] {
  if (!Array.isArray(raw)) {
    problems.push({ path: 'nights', reason: 'oczekiwano listy' });
    return [];
  }

  const nights: NarrativeNight[] = [];
  const seen = new Set<string>();

  for (const [index, item] of raw.slice(0, LIMITS.nights).entries()) {
    const at = `nights[${index}]`;

    if (!isObject(item)) {
      problems.push({ path: at, reason: 'oczekiwano obiektu' });
      continue;
    }

    const date = calendarDate(item.date);
    if (!date) {
      problems.push({ path: `${at}.date`, reason: 'oczekiwano daty RRRR-MM-DD' });
      continue;
    }
    if (seen.has(date)) {
      problems.push({ path: `${at}.date`, reason: `powtórzona doba ${date}` });
      continue;
    }

    // Komentarz wolno pominąć: agent może mieć coś do powiedzenia wyłącznie
    // o celach. Pusty tekst i brak pola znaczą tu to samo.
    const comment = item.comment === undefined ? '' : (text(item.comment, LIMITS.comment) ?? null);
    if (comment === null) {
      problems.push({
        path: `${at}.comment`,
        reason: `pusty tekst albo dłuższy niż ${LIMITS.comment}`,
      });
      continue;
    }

    const targets = parseTargets(item.targets, `${at}.targets`, problems);

    // Noc bez komentarza i bez celów nie niesie nic — nie ma po co jej przypinać.
    if (comment === '' && targets.length === 0) {
      problems.push({ path: at, reason: 'ani komentarza, ani celów' });
      continue;
    }

    seen.add(date);
    nights.push({ date, comment, targets });
  }

  if (raw.length > LIMITS.nights) {
    problems.push({
      path: 'nights',
      reason: `więcej niż ${LIMITS.nights} nocy — nadmiar pominięty`,
    });
  }

  return nights;
}

/**
 * Sprawdza dokument narracji i zwraca to, co da się z niego użyć.
 *
 * Nigdy nie rzuca — także dla `undefined`, napisu i tablicy. Wywołujący ma jedną
 * ścieżkę obsługi zamiast `try`, bo dokument przychodzi z zewnątrz i jego
 * zepsucie jest normalnym stanem, a nie wyjątkiem.
 */
export function parseNarrative(raw: unknown): NarrativeResult {
  const problems: Problem[] = [];

  if (!isObject(raw)) {
    return { narrative: null, problems: [{ path: '', reason: 'oczekiwano obiektu JSON' }] };
  }

  // Wersja rozstrzyga o całości, bo przy nieznanym kształcie nie wiadomo nawet,
  // czy pole o tej samej nazwie znaczy jeszcze to samo. Zgadywanie byłoby tu
  // gorsze niż odrzucenie: narracja i tak jest opcjonalna.
  if (raw.version !== NARRATIVE_VERSION) {
    return {
      narrative: null,
      problems: [
        { path: 'version', reason: `oczekiwano ${NARRATIVE_VERSION}, jest ${String(raw.version)}` },
      ],
    };
  }

  const site = text(raw.site, 100);
  if (!site) {
    return { narrative: null, problems: [{ path: 'site', reason: 'brak identyfikatora miejsca' }] };
  }

  const generatedAt = timestamp(raw.generatedAt);
  if (!generatedAt) {
    return { narrative: null, problems: [{ path: 'generatedAt', reason: 'oczekiwano daty ISO' }] };
  }

  // Nagłówek jest ozdobą całości, więc jego zepsucie nie może zabrać nocy.
  const headline = raw.headline === undefined ? null : text(raw.headline, LIMITS.headline);
  if (raw.headline !== undefined && headline === null) {
    problems.push({
      path: 'headline',
      reason: `pusty tekst albo dłuższy niż ${LIMITS.headline}`,
    });
  }

  const nights = parseNights(raw.nights, problems);

  return {
    narrative: {
      version: NARRATIVE_VERSION,
      generatedAt,
      site,
      headline,
      nights,
    },
    problems,
  };
}

/** Noc briefu wzbogacona o tekst — pola policzone zostają nietknięte. */
export type NarratedNight = BriefNight & {
  /** Pusty napis, gdy agent nie miał nic o tej nocy do powiedzenia. */
  comment: string;
  /** Komentarze do celów, kluczowane identyfikatorem celu. */
  targetNotes: Record<string, string>;
};

export type NarratedBrief = Omit<Brief, 'nights'> & {
  nights: NarratedNight[];
  /** Zdanie agenta; `null`, gdy narracji nie ma albo nie pasuje do tego briefu. */
  narrativeHeadline: string | null;
};

/** Data wieczoru, od którego zaczyna się ta noc — klucz łączący z narracją. */
function eveningOf(night: BriefNight): string {
  const from = new Date(night.from);
  const local = new Date(from.getTime() - from.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Doklejenie narracji do briefu.
 *
 * Przypinamy wyłącznie tam, gdzie jest do czego: komentarz do nocy, której
 * brief nie zawiera, i notatka o celu, którego tej nocy nie ma na liście, są
 * pomijane. To nie jest nadgorliwość — dokument pisze model, więc opisanie nocy,
 * której nikt nie policzył, jest dokładnie tym błędem, którego należy się
 * spodziewać. Pokazanie takiego tekstu wyglądałoby jak informacja o czymś, co
 * aplikacja sprawdziła, a czego nie sprawdziła.
 *
 * Narracja z innego miejsca odpada w całości: te same daty nad innym horyzontem
 * opisują inną noc.
 */
/**
 * Czy ta narracja w ogóle dotyczy tego briefu.
 *
 * Wystawione osobno, bo odpowiedź jest potrzebna w dwóch miejscach: tutaj, żeby
 * odrzucić dokument, i u wywołującego, żeby o odrzuceniu powiedzieć. Bez tego
 * cała narracja znika bez śladu przy zwykłej literówce w identyfikatorze
 * miejsca — a to najcichsza z możliwych awarii tej ścieżki.
 */
export function narrativeMatches(brief: Brief, narrative: Narrative | null): boolean {
  return narrative !== null && narrative.site === brief.site.id;
}

export function attachNarrative(brief: Brief, narrative: Narrative | null): NarratedBrief {
  const bare = (): NarratedBrief => ({
    ...brief,
    nights: brief.nights.map((night) => ({ ...night, comment: '', targetNotes: {} })),
    narrativeHeadline: null,
  });

  if (!narrativeMatches(brief, narrative) || !narrative) return bare();

  const byDate = new Map(narrative.nights.map((night) => [night.date, night]));

  return {
    ...brief,
    nights: brief.nights.map((night) => {
      const told = byDate.get(eveningOf(night));
      if (!told) return { ...night, comment: '', targetNotes: {} };

      const present = new Set(night.targets.map((target) => target.id));
      const targetNotes = Object.fromEntries(
        told.targets.filter((target) => present.has(target.id)).map((t) => [t.id, t.note]),
      );

      return { ...night, comment: told.comment, targetNotes };
    }),
    narrativeHeadline: narrative.headline,
  };
}
