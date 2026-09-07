/**
 * Cykl dobowy: kiedy pobrać dane i kiedy tego nie robić.
 *
 * Dane z sieci zmieniają się wolniej, niż aplikacja o nie pyta. Prognoza
 * godzinowa aktualizuje się u dostawcy kilka razy na dobę, a decyzja „jadę czy
 * nie" zapada raz, wieczorem. Jedno pobranie dziennie w porze podejmowania
 * decyzji wystarcza — ekrany czytają z zapisu i otwierają się natychmiast,
 * także bez sieci.
 *
 * Telefon nie ma crona: ani Android, ani iOS nie gwarantują wykonania zadania
 * o konkretnej godzinie. Dlatego poprawność opiera się nie na zadaniu w tle,
 * tylko na **nadrobieniu**: przy każdym uruchomieniu sprawdzamy, czy zapis jest
 * starszy niż ostatni termin odświeżenia, i jeśli tak — pobieramy.
 *
 * Moduł jest czysty: żadnego wejścia/wyjścia, żadnego AsyncStorage. Dzięki temu
 * ta sama decyzja obowiązuje w aplikacji i w cronie wołającym CLI.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

/** Pora podejmowania decyzji o wyjeździe — wtedy dane mają być świeże. */
export const DEFAULT_REFRESH_HOUR = 17;

/**
 * Dwie próby w tym samym momencie to nie awaria, tylko normalny zbieg: zadanie
 * w tle i nadrobienie przy starcie mogą wypaść w tej samej minucie. Przez tyle
 * czasu od rozpoczęcia próby uznajemy, że ktoś już pobiera.
 */
export const ATTEMPT_LOCK_MINUTES = 2;

/** Po nieudanej próbie czekamy tyle, zanim spróbujemy ponownie. */
export const RETRY_DELAY_MINUTES = 5;

/**
 * Ile razy w obrębie jednego terminu wolno spróbować. Po wyczerpaniu — cisza do
 * następnego terminu albo do ręcznego odświeżenia. Brak sieci o 17:00 to
 * sytuacja normalna, a nie powód, żeby dobijać się do serwera co minutę.
 */
export const MAX_ATTEMPTS_PER_TERM = 3;

/**
 * Stan cyklu, utrwalany między uruchomieniami.
 *
 * Znacznik **próby** trzymany jest obok znacznika **sukcesu**, bo bez tego
 * pierwszego nie da się odróżnić „nikt jeszcze nie pobierał" od „pobieranie
 * właśnie trwa", a bez drugiego — „pobrało się" od „próbowało i nie wyszło".
 */
export type CycleState = {
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  /** Powód ostatniego niepowodzenia, do pokazania w ustawieniach. */
  lastError: string | null;
  /** Termin, do którego liczą się poniższe próby — po jego zmianie licznik zeruje się sam. */
  attemptTerm: Date | null;
  attemptsThisTerm: number;
};

export const EMPTY_CYCLE_STATE: CycleState = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  attemptTerm: null,
  attemptsThisTerm: 0,
};

/**
 * Ostatni termin odświeżenia, który już minął.
 *
 * Arytmetyka kalendarzowa, nie milisekundowa: doba zmiany czasu ma 23 albo 25
 * godzin, więc odejmowanie 86 400 000 ms wskazywałoby o godzinę obok.
 */
export function lastScheduledRefresh(now: Date, hour: number): Date {
  const term = new Date(now);
  term.setHours(hour, 0, 0, 0);
  if (term > now) term.setDate(term.getDate() - 1);
  return term;
}

export type RefreshReason =
  /** Zapis jest z bieżącego terminu — nie ma czego pobierać. */
  | 'fresh'
  /** Ktoś właśnie pobiera; druga próba tylko podwoiłaby koszt. */
  | 'in-flight'
  /** Poprzednia próba nie wyszła — czekamy przed kolejną. */
  | 'backoff'
  /** Próby na ten termin wyczerpane; cisza do nadrobienia przy następnym. */
  | 'exhausted'
  /** Termin minął, a zapisu z niego nie ma. */
  | 'due';

export type RefreshDecision = { run: boolean; reason: RefreshReason; term: Date };

/**
 * Czy uruchomić cykl teraz.
 *
 * Kolejność warunków jest regułą, nie szczegółem: świeżość bije wszystko inne
 * (nie ma po co pobierać), blokada próby bije backoff (nie wiemy jeszcze, czy
 * tamta próba się uda), a wyczerpanie prób bije termin (inaczej pętla bez sieci
 * kręciłaby się w kółko).
 */
export function decideRefresh(now: Date, state: CycleState, hour: number): RefreshDecision {
  const term = lastScheduledRefresh(now, hour);

  if (state.lastSuccessAt && state.lastSuccessAt >= term) {
    return { run: false, reason: 'fresh', term };
  }

  if (state.lastAttemptAt) {
    const sinceAttemptMin = (now.getTime() - state.lastAttemptAt.getTime()) / 60_000;

    // Zegar przestawiony wstecz dałby ujemny wiek próby; traktujemy to jak
    // trwające pobranie, bo jedyny bezpieczny ruch to nie robić nic.
    if (sinceAttemptMin >= 0 && sinceAttemptMin < ATTEMPT_LOCK_MINUTES) {
      return { run: false, reason: 'in-flight', term };
    }

    const sameTerm = state.attemptTerm !== null && state.attemptTerm.getTime() === term.getTime();

    if (sameTerm && state.attemptsThisTerm >= MAX_ATTEMPTS_PER_TERM) {
      return { run: false, reason: 'exhausted', term };
    }

    if (sameTerm && sinceAttemptMin < RETRY_DELAY_MINUTES) {
      return { run: false, reason: 'backoff', term };
    }
  }

  return { run: true, reason: 'due', term };
}

/** Stan po rozpoczęciu próby — zapisywany PRZED pobraniem, bo to on blokuje drugą. */
export function markAttempt(state: CycleState, now: Date, term: Date): CycleState {
  const sameTerm = state.attemptTerm !== null && state.attemptTerm.getTime() === term.getTime();

  return {
    ...state,
    lastAttemptAt: now,
    attemptTerm: term,
    attemptsThisTerm: sameTerm ? state.attemptsThisTerm + 1 : 1,
  };
}

/** Stan po udanym pobraniu. Licznik prób zeruje się, bo termin został zamknięty. */
export function markSuccess(state: CycleState, now: Date): CycleState {
  return { ...state, lastSuccessAt: now, lastError: null, attemptsThisTerm: 0 };
}

/**
 * Stan po nieudanym pobraniu. Nie rusza `lastSuccessAt` — nieudana próba nie
 * unieważnia poprzednich danych, bo cykl, który po awarii kasuje zapis, jest
 * gorszy niż jego brak.
 */
export function markFailure(state: CycleState, reason: string): CycleState {
  return { ...state, lastError: reason };
}
