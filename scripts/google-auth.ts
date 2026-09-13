/**
 * Jednorazowa autoryzacja w Google — zamienia poświadczenia klienta na token
 * odświeżania, którym CLI posługuje się potem bez udziału człowieka.
 *
 *   npm run google:auth
 *
 * ## Dlaczego pętla zwrotna, a nie wklejanie kodu
 *
 * Google wycofało przepisywanie kodu z przeglądarki do terminala. Zostaje
 * przekierowanie na `http://127.0.0.1:<port>`, więc skrypt na chwilę podnosi
 * własny serwer, łapie kod i natychmiast się wyłącza. Klient typu „aplikacja
 * komputerowa" ma to dozwolone na dowolnym porcie — dlatego właśnie ten typ.
 *
 * ## Dlaczego PKCE mimo posiadania sekretu klienta
 *
 * Sekret klienta aplikacji komputerowej z definicji nie jest tajny: stoi na
 * cudzym komputerze. Bezpieczeństwo tego przepływu opiera się więc na PKCE —
 * jednorazowej parze weryfikatora i jego skrótu, przez którą kod przechwycony
 * po drodze jest bezużyteczny bez pamięci tego procesu.
 *
 * Zapisujemy **token odświeżania**, nie dostępowy: ten wygasa po godzinie,
 * tamten żyje, dopóki nie zostanie cofnięty, i to on pozwala cronowi działać
 * bez Ciebie.
 */

import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname } from 'node:path';

import { CLIENT_PATH, TOKEN_PATH, TOKEN_URL, readClient } from '../src/lib/google-oauth.ts';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/**
 * Odczyt i zapis wydarzeń (rezerwacja sesji) oraz sama lista kalendarzy, bez
 * prawa do jej zmiany — potrzebna, żeby poranki liczyć ze wszystkich własnych
 * kalendarzy, a nie tylko z głównego. Rozszerzenie zakresu wymaga ponownej
 * zgody, czyli powtórzenia tej procedury.
 */
const SCOPE = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
].join(' ');

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** Weryfikator PKCE i jego skrót — para jednorazowa, ważna tylko w tym procesie. */
function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Otwiera przeglądarkę; gdy się nie da, zostaje wypisany adres. */
function openBrowser(url: string): void {
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  try {
    spawn(opener, [url], { stdio: 'ignore', detached: true }).unref();
  } catch {
    // Bez przeglądarki nic się nie psuje — adres i tak jest na ekranie.
  }
}

/** Serwer nasłuchujący na wolnym porcie, razem z numerem, który dostał. */
function listen(): Promise<{ server: Server; port: number; waitForCode: Promise<string> }> {
  return new Promise((resolve, reject) => {
    let settle: { ok: (code: string) => void; err: (error: Error) => void };
    const waitForCode = new Promise<string>((ok, err) => {
      settle = { ok, err };
    });

    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      // Odpowiadamy zawsze, także przy błędzie: przeglądarka ma pokazać wynik,
      // a nie wisieć na pustym połączeniu.
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(
        '<meta charset="utf-8"><body style="font:16px system-ui;padding:3rem;' +
          'background:#0A0A14;color:#F0EFE8">' +
          (code
            ? 'Gotowe. Możesz zamknąć tę kartę i wrócić do terminala.'
            : `Autoryzacja nie doszła do skutku: ${error ?? 'brak kodu'}.`) +
          '</body>',
      );

      if (url.searchParams.get('state') !== state) {
        settle.err(new Error('Niezgodny parametr state — przerywam dla bezpieczeństwa.'));
      } else if (code) {
        settle.ok(code);
      } else {
        settle.err(new Error(error ?? 'Google nie zwróciło kodu.'));
      }
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({ server, port: address.port, waitForCode });
    });
  });
}

const client = readClient();
if (!client) {
  fail(
    `Nie znalazłem poświadczeń w ${CLIENT_PATH}.\n` +
      'Utwórz klienta OAuth typu „aplikacja komputerowa" w Google Cloud Console\n' +
      'i zapisz tam { "client_id": "...", "client_secret": "..." }.',
  );
}

const { verifier, challenge } = pkce();
const state = randomBytes(16).toString('base64url');

const { server, port, waitForCode } = await listen();
const redirectUri = `http://127.0.0.1:${port}`;

const consent = new URL(AUTH_URL);
consent.search = new URLSearchParams({
  client_id: client.clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: SCOPE,
  state,
  code_challenge: challenge,
  code_challenge_method: 'S256',
  // Bez tej pary Google zwraca sam token dostępowy, ważny godzinę — a nam
  // chodzi właśnie o ten odświeżający, żeby cron działał bez człowieka.
  access_type: 'offline',
  prompt: 'consent',
}).toString();

process.stdout.write(`Otwieram przeglądarkę. Gdyby się nie otworzyła, wejdź na:\n${consent}\n\n`);
openBrowser(consent.toString());

let code: string;
try {
  code = await waitForCode;
} catch (error) {
  server.close();
  fail(`Autoryzacja przerwana: ${(error as Error).message}`);
} finally {
  server.close();
}

const response = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  }).toString(),
});

if (!response.ok) {
  fail(`Wymiana kodu nie powiodła się (${response.status}): ${await response.text()}`);
}

const tokens = (await response.json()) as { refresh_token?: string };
if (!tokens.refresh_token) {
  fail(
    'Google nie zwróciło tokenu odświeżania.\n' +
      'Zdarza się przy powtórnej zgodzie — cofnij dostęp aplikacji na\n' +
      'https://myaccount.google.com/permissions i uruchom ponownie.',
  );
}

mkdirSync(dirname(TOKEN_PATH), { recursive: true, mode: 0o700 });
writeFileSync(TOKEN_PATH, JSON.stringify({ refresh_token: tokens.refresh_token }, null, 2));
chmodSync(TOKEN_PATH, 0o600);

process.stdout.write(`\nToken odświeżania zapisany w ${TOKEN_PATH}\n`);
process.stdout.write('Od teraz: npm run brief -- --site=bledowska --calendar\n');
