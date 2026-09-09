/**
 * Poświadczenia Google i zamiana tokenu odświeżania na dostępowy.
 *
 * Wspólne dla jednorazowej autoryzacji i dla codziennego użycia w CLI, żeby
 * ścieżki plików i adres punktu tokenów istniały w jednym miejscu — rozjazd
 * między nimi objawiłby się dopiero na serwerze, po tygodniu cichego milczenia
 * crona.
 *
 * Moduł **nie działa w aplikacji**: czyta pliki z katalogu domowego, więc jest
 * warstwą platformy, tak samo jak zapis dziennika. Telefon dostanie własną
 * ścieżkę autoryzacji, gdy przyjdzie na nią czas.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Poświadczenia klienta — z Google Cloud Console, wprowadzane ręcznie raz. */
export const CLIENT_PATH = join(homedir(), '.lunaris', 'google-client.json');

/** Token odświeżania — wynik `npm run google:auth`. */
export const TOKEN_PATH = join(homedir(), '.lunaris', 'google-token.json');

export type GoogleClient = { clientId: string; clientSecret: string };

/**
 * Czyta poświadczenia klienta. `null`, gdy pliku nie ma albo jest niepełny —
 * wywołujący ma wtedy powiedzieć, co zrobić, a nie wywalić się śladem stosu.
 *
 * Google zapisuje je płasko albo zagnieżdżone w `installed` (tak wygląda plik
 * pobrany z konsoli), więc przyjmujemy oba kształty.
 */
export function readClient(): GoogleClient | null {
  try {
    const parsed = JSON.parse(readFileSync(CLIENT_PATH, 'utf8')) as Record<string, unknown>;
    const inner = (parsed.installed ?? parsed.web ?? parsed) as Record<string, unknown>;

    const clientId = inner.client_id;
    const clientSecret = inner.client_secret;
    if (typeof clientId !== 'string' || typeof clientSecret !== 'string') return null;

    return { clientId, clientSecret };
  } catch {
    return null;
  }
}

/** Token odświeżania z dysku; `null`, gdy autoryzacji jeszcze nie było. */
export function readRefreshToken(): string | null {
  try {
    const parsed = JSON.parse(readFileSync(TOKEN_PATH, 'utf8')) as { refresh_token?: unknown };
    return typeof parsed.refresh_token === 'string' ? parsed.refresh_token : null;
  } catch {
    return null;
  }
}

/**
 * Świeży token dostępowy.
 *
 * Nie buforujemy go między uruchomieniami: żyje godzinę, a CLI startuje raz na
 * dobę, więc zapisany i tak byłby przeterminowany. Jedno dodatkowe żądanie jest
 * tańsze niż plik, który trzeba unieważniać.
 */
export async function accessToken(
  client: GoogleClient,
  refreshToken: string,
): Promise<string | null> {
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: client.clientId,
        client_secret: client.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!response.ok) return null;

    const token = (await response.json()) as { access_token?: unknown };
    return typeof token.access_token === 'string' ? token.access_token : null;
  } catch {
    return null;
  }
}
