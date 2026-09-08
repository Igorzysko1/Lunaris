/**
 * Zdjęcie dnia NASA (APOD) — jedyna rzecz w tej aplikacji, która nie służy
 * podjęciu decyzji.
 *
 * I to jest jej cały kontrakt: **nic tu nie może wpłynąć na werdykt**. Karta
 * jest ozdobą ekranu, więc każda awaria — brak sieci, limit zapytań, zmieniony
 * kształt odpowiedzi — kończy się jej nieobecnością, nigdy komunikatem o błędzie
 * i nigdy zatrzymaniem czegokolwiek innego. Ekran Noc ma działać identycznie,
 * gdy NASA leży.
 *
 * Dane przychodzą z sieci, więc obowiązuje je ta sama zasada co prognozę: idą
 * przez zapis na dysku. APOD zmienia się raz na dobę, a na Pustyni Błędowskiej
 * zasięgu bywa zero.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

const API = 'https://api.nasa.gov/planetary/apod';

/**
 * Klucz API. `DEMO_KEY` działa bez rejestracji, ale ma ciasny limit liczony na
 * adres IP (rzędu 30 zapytań na godzinę). Przy pobraniu raz na dobę to
 * z zapasem wystarcza, a własny klucz — darmowy, z api.nasa.gov — wystarczy
 * podać w `EXPO_PUBLIC_NASA_KEY` przy budowaniu.
 *
 * Zmienna jest odczytywana przez `process.env`, a nie z konfiguracji
 * użytkownika, bo to parametr wydania, a nie preferencja obserwatora.
 */
const KEY = process.env.EXPO_PUBLIC_NASA_KEY || 'DEMO_KEY';

/** Ile czekamy, zanim uznamy, że nie ma po co. Ozdoba nie może wisieć na ekranie. */
const TIMEOUT_MS = 8_000;

export type Apod = {
  /** Data publikacji, `RRRR-MM-DD` — APOD zmienia się raz na dobę. */
  date: string;
  title: string;
  /** Opis od NASA. Po angielsku i nie tłumaczymy go — patrz `ApodCard`. */
  explanation: string;
  /**
   * Wideo zamiast zdjęcia zdarza się kilka razy w miesiącu i wtedy `url` wskazuje
   * osadzenie YouTube'a, a nie obraz. Bez tego rozróżnienia karta pokazywałaby
   * pustą ramkę.
   */
  mediaType: 'image' | 'video';
  url: string;
  /**
   * Podgląd dla materiałów wideo — prosimy o niego parametrem `thumbs=true`.
   * Dzięki niemu karta wygląda tak samo niezależnie od rodzaju materiału,
   * zamiast raz pokazywać obraz, a raz sam tytuł.
   */
  thumbnailUrl: string | null;
  /**
   * Autor, gdy zdjęcie nie jest w domenie publicznej.
   *
   * Pole nieobowiązkowe w API i łatwe do przeoczenia, a jego pominięcie znaczy
   * użycie cudzej pracy bez podpisu. Gdy jest, karta **musi** je pokazać.
   */
  copyright: string | null;
};

/**
 * Tekst nadający się do pokazania w jednym wierszu.
 *
 * Białe znaki zwijamy, a nie tylko przycinamy brzegi: pole `copyright` bywa
 * w odpowiedzi wielolinijkowe — sprawdzone na żywych danych, gdzie podpis
 * przychodzi jako „\nKeighley Rockcliffe  \n(NASA\nGSFC, \nUMBC CSST…)".
 * Wstawiony wprost rozjeżdżałby kartę na sześć wierszy.
 */
const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;

  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length > 0 ? collapsed : null;
};

/**
 * Sprawdza odpowiedź API i zwraca to, co da się pokazać.
 *
 * Nigdy nie rzuca — także dla `null`, napisu i tablicy. To dane z zewnątrz,
 * więc ich zepsucie jest stanem normalnym, a nie wyjątkiem, a wywołujący ma
 * mieć jedną ścieżkę: jest karta albo jej nie ma.
 */
export function parseApod(raw: unknown): Apod | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const value = raw as Record<string, unknown>;

  const date = text(value.date);
  const title = text(value.title);
  const url = text(value.url);
  if (!date || !title || !url) return null;

  // Nieznany rodzaj mediów traktujemy jak wideo, a nie jak obraz: karta pokaże
  // wtedy sam tytuł zamiast ramki z komunikatem o niewczytanym pliku.
  const mediaType = value.media_type === 'image' ? 'image' : 'video';

  return {
    date,
    title,
    explanation: text(value.explanation) ?? '',
    mediaType,
    url,
    thumbnailUrl: text(value.thumbnail_url),
    copyright: text(value.copyright),
  };
}

/**
 * Pobiera zdjęcie dnia. Zwraca `null` zamiast rzucać — z tego samego powodu,
 * dla którego `parseApod` nie rzuca.
 */
export async function fetchApod(signal?: AbortSignal): Promise<Apod | null> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  // Przerwać może i limit czasu, i odmontowanie ekranu.
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    const response = await fetch(`${API}?api_key=${encodeURIComponent(KEY)}&thumbs=true`, {
      signal: combined,
    });
    if (!response.ok) return null;

    return parseApod(await response.json());
  } catch {
    return null;
  }
}
