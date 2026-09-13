/**
 * Konto Google w aplikacji — logowanie, token i kalendarz porannych dni.
 *
 * Odpowiednik `google-oauth.ts` dla telefonu. Tamten czyta pliki z katalogu
 * domowego i używa sekretu klienta; tutaj nie ma ani jednego, ani drugiego:
 *
 * - **klient typu Android nie ma sekretu.** Google rozpoznaje aplikację po
 *   nazwie pakietu i odcisku SHA-1 certyfikatu, którym podpisano APK, a przed
 *   przechwyceniem kodu autoryzacji chroni PKCE. Identyfikator klienta jest
 *   jawny z definicji — widać go w każdym adresie zgody — więc stoi w kodzie.
 * - **Token odświeżania leży w `expo-secure-store`**, czyli za Android
 *   Keystore, a nie w AsyncStorage. To jedyna rzecz, która daje dostęp do
 *   kalendarza bez ponownej zgody, więc nie może leżeć jawnym tekstem w danych
 *   aplikacji.
 *
 * Token dostępowy żyje tylko w pamięci: ważny godzinę, i tak nie przetrwałby
 * dłuższego zamknięcia aplikacji, a zapisany byłby drugą rzeczą do chronienia.
 *
 * Nic tu nie rzuca. Kalendarz ulepsza werdykt, ale nie jest jego warunkiem —
 * gdy logowanie, sieć albo Google zawiodą, silnik wraca do założonej pobudki.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  AuthRequest,
  TokenError,
  exchangeCodeAsync,
  refreshAsync,
  revokeAsync,
  type DiscoveryDocument,
  type TokenResponse,
} from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { dayKey, fillFromStore, type CalendarDays, type CalendarEntry } from './calendar';
import { clearStoredDays, loadStoredDays, saveFreshDays } from './calendar-store';
import { fetchDayEntries } from './google-calendar';

/** Klient OAuth typu Android z Google Cloud Console. Jawny — patrz wyżej. */
const CLIENT_ID = '173163195418-1f2epvlthho674uhvdrfq3tmupuei6pg.apps.googleusercontent.com';

/**
 * Adres powrotu po zgodzie. Schemat to nazwa pakietu, bo tego Google wymaga od
 * klientów Android, i musi być zarejestrowany w `app.json` — inaczej system nie
 * wie, której aplikacji oddać przekierowanie, a przeglądarka zostaje na pustej
 * stronie.
 */
const REDIRECT_URI = 'com.igormusial.lunaris:/oauthredirect';

/** Ten sam zakres co w CLI: odczyt i zapis wydarzeń, bez ustawień kalendarza. */
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const DISCOVERY: DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const REFRESH_KEY = 'google-refresh-token';

/** Zapas przed wygaśnięciem: żądanie nie może wyjść z tokenem, który wygaśnie w drodze. */
const EXPIRY_MARGIN_MS = 60_000;

/**
 * Jak długo pobrany kalendarz uchodzi za aktualny. Ekran Noc, przegląd
 * miejscówek i cykl pytają o te same poranki w odstępie sekund — trzy komplety
 * żądań do Google dawałyby trzy razy tę samą odpowiedź.
 */
const DAYS_TTL_MS = 10 * 60_000;

/**
 * Czy logowanie ma w tym środowisku szansę się udać.
 *
 * W Expo Go przekierowanie na schemat pakietu nie ma dokąd wrócić — Expo Go ma
 * własny pakiet i własny podpis, a klient Google jest związany z naszym. iOS
 * wymagałby osobnego klienta, którego nie ma.
 */
export const GOOGLE_AVAILABLE =
  Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let access: { token: string; expiresAt: number } | null = null;
let cachedDays: { id: string; at: number; value: CalendarDays } | null = null;
let pendingDays: { id: string; promise: Promise<CalendarDays | null> } | null = null;

const listeners = new Set<(connected: boolean) => void>();

/**
 * Zmiana stanu połączenia — także ta wykryta przy okazji, gdy Google odrzuci
 * token. Bez tego karty pokazywałyby przyciski rezerwacji dla konta, którego
 * już nie ma.
 */
export function onConnectionChange(listener: (connected: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function expiryOf(tokens: TokenResponse): number {
  // Google podaje ważność zawsze; godzina to jego wartość domyślna.
  return (tokens.issuedAt + (tokens.expiresIn ?? 3600)) * 1000;
}

async function readRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return null;
  }
}

/** Zapomina konto lokalnie: token, zapamiętany kalendarz i stan ekranów. */
async function forget(): Promise<void> {
  access = null;
  cachedDays = null;
  pendingDays = null;

  try {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch {
    // Brak wpisu do usunięcia to ten sam stan, do którego dążymy.
  }

  // Zapisane godziny wydarzeń należą do konta, które właśnie odłączamy.
  await clearStoredDays();

  for (const listener of listeners) listener(false);
}

export async function isGoogleConnected(): Promise<boolean> {
  if (!GOOGLE_AVAILABLE) return false;
  return (await readRefreshToken()) !== null;
}

export type ConnectResult = 'connected' | 'cancelled' | 'failed';

/** Zgoda w przeglądarce i wymiana kodu na tokeny. */
export async function connectGoogle(): Promise<ConnectResult> {
  if (!GOOGLE_AVAILABLE) return 'failed';

  try {
    const request = new AuthRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      scopes: [SCOPE],
      usePKCE: true,
      // Bez `prompt: consent` Google przy ponownym połączeniu tego samego konta
      // nie wydaje nowego tokenu odświeżania: logowanie „się udaje", a aplikacja
      // zostaje z niczym, co przetrwa godzinę.
      extraParams: { access_type: 'offline', prompt: 'consent' },
    });

    const result = await request.promptAsync(DISCOVERY);
    if (result.type === 'cancel' || result.type === 'dismiss') return 'cancelled';
    if (result.type !== 'success' || !request.codeVerifier) return 'failed';

    const tokens = await exchangeCodeAsync(
      {
        clientId: CLIENT_ID,
        code: result.params.code,
        redirectUri: REDIRECT_URI,
        extraParams: { code_verifier: request.codeVerifier },
      },
      DISCOVERY,
    );
    if (!tokens.refreshToken) return 'failed';

    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
    access = { token: tokens.accessToken, expiresAt: expiryOf(tokens) };
    cachedDays = null;

    for (const listener of listeners) listener(true);
    return 'connected';
  } catch {
    return 'failed';
  }
}

/**
 * Odłącza konto — z unieważnieniem po stronie Google, a nie tylko lokalnie.
 * Samo usunięcie tokenu z telefonu zostawiłoby ważną zgodę na liście dostępu
 * konta Google.
 */
export async function disconnectGoogle(): Promise<void> {
  const refreshToken = await readRefreshToken();

  if (refreshToken) {
    try {
      await revokeAsync({ token: refreshToken, clientId: CLIENT_ID }, DISCOVERY);
    } catch {
      // Brak sieci nie może zatrzymać odłączenia; zgodę da się też odebrać
      // ręcznie w ustawieniach konta Google.
    }
  }

  await forget();
}

export type AccessResult =
  { status: 'ok'; token: string } | { status: 'disconnected' } | { status: 'failed' };

/**
 * Ważny token dostępowy.
 *
 * Trzy wyniki, nie dwa: „konto odłączone" wymaga innej reakcji niż „chwilowo
 * nie wyszło". Pierwsze każe pokazać przycisk połączenia, drugie — spróbować
 * później.
 */
export async function googleAccessToken(): Promise<AccessResult> {
  if (!GOOGLE_AVAILABLE) return { status: 'disconnected' };

  if (access && access.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return { status: 'ok', token: access.token };
  }

  const refreshToken = await readRefreshToken();
  if (!refreshToken) return { status: 'disconnected' };

  try {
    const tokens = await refreshAsync({ clientId: CLIENT_ID, refreshToken }, DISCOVERY);
    access = { token: tokens.accessToken, expiresAt: expiryOf(tokens) };
    return { status: 'ok', token: tokens.accessToken };
  } catch (error) {
    // `invalid_grant` to zgoda odebrana w koncie Google albo token, który
    // wygasł — przy aplikacji w trybie testowym Google robi to po tygodniu.
    // Konto jest wtedy naprawdę odłączone i ekran ma to pokazać, zamiast co
    // godzinę udawać awarię sieci.
    if (error instanceof TokenError && error.params.error === 'invalid_grant') {
      await forget();
      return { status: 'disconnected' };
    }
    // Do logu Metro: bez tej linii „nie wyszło" z odrzuconego klienta wygląda
    // dokładnie tak samo jak brak sieci.
    console.warn(
      'Google: odświeżenie tokenu nie powiodło się —',
      error instanceof TokenError
        ? `${error.params.error} ${error.description ?? ''}`
        : String(error),
    );
    return { status: 'failed' };
  }
}

async function fetchDays(mornings: Date[], id: string): Promise<CalendarDays | null> {
  const unique = new Map(mornings.map((morning) => [dayKey(morning), morning]));
  const auth = await googleAccessToken();

  // Odłączone konto nie ma kalendarza — także zapisanego, bo `forget` go skasował.
  if (auth.status === 'disconnected') return null;

  const fresh = new Map<string, CalendarEntry[]>();

  if (auth.status === 'ok') {
    await Promise.all(
      [...unique].map(async ([key, morning]) => {
        const entries = await fetchDayEntries(auth.token, morning);
        if (entries) fresh.set(key, entries);
      }),
    );

    // Sprawdzenie po pobraniu, a nie przed: odłączenie w trakcie żądań
    // skasowało już zapis i nie może go przywrócić spóźniona odpowiedź.
    if (await isGoogleConnected()) await saveFreshDays(fresh);
  }

  // W pamięci trzymamy tylko komplet świeżych dni. Dzień, który się nie
  // pobrał, ma dostać drugą szansę przy następnym pytaniu, a nie dziesięć minut
  // zapisu z dysku.
  if (fresh.size === unique.size) {
    cachedDays = { id, at: Date.now(), value: fresh };
    return fresh;
  }

  // Luki — brak sieci albo pojedynczy dzień, który się nie pobrał — wypełnia
  // ostatnie udane pobranie, jeśli jest dość świeże.
  const filled = fillFromStore(fresh, await loadStoredDays(), [...unique.keys()], new Date());

  return auth.status === 'ok' || filled.size > 0 ? filled : null;
}

/**
 * Wydarzenia z podanych poranków, gotowe dla `nextDayWith`.
 *
 * `null`, gdy konta nie ma, albo gdy token się nie odświeżył, a na dysku nie ma
 * dość świeżego zapisu — silnik liczy wtedy całość z założenia. Dzień, którego
 * nie udało się pobrać ani odczytać z zapisu, nie trafia do mapy i tylko on
 * wraca do założenia.
 */
export function loadCalendarDays(mornings: Date[]): Promise<CalendarDays | null> {
  if (!GOOGLE_AVAILABLE) return Promise.resolve(null);

  const id = [...new Set(mornings.map(dayKey))].sort().join(',');

  if (cachedDays?.id === id && Date.now() - cachedDays.at < DAYS_TTL_MS) {
    return Promise.resolve(cachedDays.value);
  }
  // Ekrany pytają równocześnie — drugie pytanie dostaje to samo żądanie.
  if (pendingDays?.id === id) return pendingDays.promise;

  const promise = fetchDays(mornings, id).finally(() => {
    if (pendingDays?.promise === promise) pendingDays = null;
  });
  pendingDays = { id, promise };

  return promise;
}
