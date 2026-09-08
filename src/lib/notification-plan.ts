/**
 * Co i kiedy ma zabrzmieć w telefonie.
 *
 * Moduł **decyduje**, a nie planuje: zwraca listę powiadomień, które powinny być
 * zaplanowane w tej chwili, i nie wie nic o systemie operacyjnym. Cała reszta —
 * uprawnienia, kanał Androida, właściwe wywołanie — siedzi w cienkiej warstwie
 * obok, bo tamtego nie da się uruchomić bez telefonu, a tego owszem.
 *
 * ## Pełny plan zamiast dokładania pojedynczych powiadomień
 *
 * Funkcja zwraca **komplet**, a nie różnicę, i to jest istotne. Powiadomienia
 * przestają być prawdziwe z byle powodu: prognoza się zmienia, użytkownik
 * przestawia miejscówkę, zjawisko przestaje być widoczne. Dokładanie po jednym
 * zostawiłoby w systemie wczorajsze obietnice dotyczące miejsca, do którego już
 * nie jedzie. Uzgodnieniem stanu zajmuje się `reconcile`, a że plan liczy się od
 * zera przy każdym przebiegu cyklu, przeplanowanie po zmianie lokalizacji nie
 * wymaga żadnej osobnej ścieżki — wychodzi samo.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

const MINUTE_MS = 60_000;

/**
 * Ile powiadomień utrzymujemy naraz.
 *
 * iOS trzyma najwyżej 64 oczekujące i po cichu odrzuca nadmiar — nie zgłasza
 * błędu, po prostu część z nich nigdy nie zabrzmi. Zostawiamy zapas, bo licznik
 * jest wspólny dla całego systemu.
 */
export const MAX_PENDING = 32;

/**
 * Gdy właściwy moment już minął, a noc jeszcze się nie zaczęła, powiadamiamy
 * z takim wyprzedzeniem. Sens wyprzedzenia to „daj mi się przygotować", więc
 * krótsze ostrzeżenie jest lepsze niż żadne.
 */
const FALLBACK_LEAD_MINUTES = 5;

export type PlannedNotification = {
  /**
   * Identyfikator wyliczany z treści bodźca, a nie losowy.
   *
   * Dzięki temu ten sam powód daje przy każdym przeliczeniu ten sam wpis
   * i uzgadnianie stanu sprowadza się do porównania zbiorów. Powód zgłoszenia
   * wchodzi do identyfikatora celowo: zapowiedź i potwierdzenie tego samego
   * zjawiska to dwie różne wiadomości, więc druga ma zastąpić pierwszą.
   */
  id: string;
  at: Date;
  title: string;
  body: string;
};

/** Zgłoszenie zjawiska z przeglądu — moment ma już policzony. */
export type NoticeInput = {
  eventId: string;
  reason: string;
  title: string;
  body: string;
  notifyAt: Date;
  /** Kiedy zjawisko wypada — po tym poznajemy, której nocy dotyczy. */
  eventAt: Date;
};

/** Noc z werdyktem i oceną. */
export type NightInput = {
  from: Date;
  to: Date;
  status: 'go' | 'no-go';
  rating: number;
  /** Początek okna obserwacyjnego; `null`, gdy okna nie ma. */
  windowFrom: Date | null;
  windowTo: Date | null;
};

export type NotificationPlanInput = {
  now: Date;
  /** Przełącznik z ustawień. Wyłączony daje pusty plan, a nie brak planu. */
  enabled: boolean;
  leadHours: number;
  notices: NoticeInput[];
  nights: NightInput[];
  /** Od jakiej oceny noc jest warta obudzenia telefonu. */
  minRating: number;
  siteName: string;
};

const time = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * Powiadomienie o dobrze zapowiadającej się nocy.
 *
 * Moment liczymy wstecz od otwarcia okna, nie od zmierzchu: wyprzedzenie ma dać
 * czas na spakowanie się i dojazd, a te odnoszą się do godziny, o której warto
 * już patrzeć.
 */
function nightNotification(
  night: NightInput,
  { now, leadHours, minRating, siteName }: NotificationPlanInput,
): PlannedNotification | null {
  if (night.status !== 'go' || !night.windowFrom || night.rating < minRating) return null;

  // Okno już otwarte to nie zapowiedź, tylko wyrzut sumienia.
  if (night.windowFrom <= now) return null;

  const ideal = new Date(night.windowFrom.getTime() - leadHours * 60 * MINUTE_MS);

  // Gdy właściwa chwila minęła — bo cykl odświeżania wypada później niż
  // wyprzedzenie — dajemy ostrzeżenie krótsze, zamiast milczeć. Informacja jest
  // wciąż aktualna, a to ona jest tu celem, nie punktualność.
  const at = ideal > now ? ideal : new Date(now.getTime() + FALLBACK_LEAD_MINUTES * MINUTE_MS);
  if (at >= night.windowFrom) return null;

  const window = night.windowTo
    ? `${time(night.windowFrom)}–${time(night.windowTo)}`
    : time(night.windowFrom);

  return {
    id: `night:${night.from.toISOString().slice(0, 10)}`,
    at,
    title: `Dobra noc — ${siteName}`,
    body: `Ocena ${night.rating}/100, okno ${window}.`,
  };
}

/**
 * Komplet powiadomień, które powinny być teraz zaplanowane.
 *
 * Kolejność wynika z pierwszeństwa: zjawiska przed nocami, bo zjawisko jest
 * konkretem („zaćmienie o 21:04"), a ocena nocy tylko zachętą. Przy ograniczeniu
 * liczby to zjawiska mają zostać.
 */
export function planNotifications(input: NotificationPlanInput): PlannedNotification[] {
  if (!input.enabled) return [];

  const { now, notices, nights } = input;

  // Powiadomienie z przeszłości nie jest opóźnione — na części systemów
  // odpala się natychmiast po zaplanowaniu. Cisza jest tu jedyną poprawną
  // odpowiedzią.
  const events = notices
    .filter((notice) => notice.notifyAt > now)
    .map((notice) => ({
      id: `event:${notice.eventId}:${notice.reason}`,
      at: notice.notifyAt,
      title: notice.title,
      body: notice.body,
    }));

  const announced = notices.map((notice) => notice.eventAt);

  const promising = nights
    .filter((night) => {
      // Noc, o której i tak powiadomi zjawisko, nie potrzebuje drugiego
      // brzęczenia „ładnie się zapowiada". Wygrywa konkret.
      return !announced.some((at) => at >= night.from && at <= night.to);
    })
    .map((night) => nightNotification(night, input))
    .filter((notification): notification is PlannedNotification => notification !== null);

  return [...events, ...promising]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_PENDING);
}

export type Reconciliation = {
  /** Do zaplanowania — jeszcze ich nie ma w systemie. */
  schedule: PlannedNotification[];
  /** Identyfikatory do odwołania: nieaktualne albo już nieprawdziwe. */
  cancel: string[];
};

/**
 * Różnica między tym, co ma być, a tym, co system trzyma.
 *
 * Wpisów, które są w obu zbiorach, **nie ruszamy** — odwołanie i ponowne
 * zaplanowanie tego samego wygląda identycznie w kodzie, a na telefonie potrafi
 * przeskoczyć porę albo zgubić się przy wyłączonym ekranie. Nic nie robić to tu
 * najbezpieczniejsze działanie.
 */
export function reconcile(
  desired: PlannedNotification[],
  scheduled: readonly string[],
): Reconciliation {
  const wanted = new Set(desired.map((notification) => notification.id));
  const present = new Set(scheduled);

  return {
    schedule: desired.filter((notification) => !present.has(notification.id)),
    cancel: scheduled.filter((id) => !wanted.has(id)),
  };
}
